"""
Goals Service: CRUD for employee career goals with progress tracking.
"""

import json
import logging
import os
from postgres_service import get_db_connection, release_connection
from jwt_utils import get_current_user, require_roles

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', '')} "
    f"password={os.getenv('POSTGRES_PASS', '')} "
    f"dbname={os.getenv('POSTGRES_NAME', '')} "
    f"connect_timeout=15"
)
IS_LOCAL = os.getenv("IS_LOCAL", "true") == "true"
if not IS_LOCAL:
    PG_CONFIG += " sslmode=require"

VALID_STATUSES = ["not_started", "in_progress", "completed", "on_hold"]


def init_db():
    conn = get_db_connection(PG_CONFIG)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS goals (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'not_started',
                due_date DATE,
                progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
                priority VARCHAR(20) DEFAULT 'medium',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("SELECT COUNT(*) FROM goals;")
        if cur.fetchone()[0] == 0:
            sample = [
                (1, "Complete AWS Solutions Architect Certification", "Achieve AWS SA Pro cert by Q2", "in_progress", "2025-06-30", 60, "high"),
                (1, "Mentor junior engineers", "Conduct weekly 1:1s with junior team members", "in_progress", "2025-12-31", 40, "medium"),
                (2, "Design microservices migration plan", "Create architecture docs for monolith decomposition", "completed", "2024-12-01", 100, "high"),
                (3, "Launch product beta", "Coordinate cross-team effort for beta release", "in_progress", "2025-03-31", 75, "high"),
                (5, "Improve code review scores", "Achieve >90% positive feedback on PRs", "not_started", "2025-06-30", 0, "medium"),
                (6, "Expand enterprise accounts by 30%", "Identify and close 5 new enterprise deals", "in_progress", "2025-12-31", 45, "high"),
                (7, "Rebrand marketing collateral", "Refresh all brand assets with new guidelines", "in_progress", "2025-04-30", 80, "high"),
                (8, "Implement FP&A dashboard", "Build real-time financial planning dashboard", "not_started", "2025-09-30", 0, "medium"),
            ]
            for s in sample:
                cur.execute("""
                    INSERT INTO goals (employee_id, title, description, status, due_date, progress, priority)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, s)
        conn.commit()
    release_connection(conn)


def response(status, data):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(data, default=str),
    }


def bad_request(msg): return response(400, {"error": msg})
def unauthorized(msg): return response(401, {"error": msg})
def forbidden(msg): return response(403, {"error": msg})
def not_found(msg): return response(404, {"error": msg})
def server_error(msg): return response(500, {"error": msg})


def row_to_dict(row):
    keys = ["id", "employee_id", "title", "description", "status", "due_date", "progress", "priority", "created_at", "updated_at"]
    return dict(zip(keys, row))


_db_initialized = False


def handler(event=None, context=None):
    global _db_initialized
    if not _db_initialized:
        try:
            init_db()
            _db_initialized = True
        except Exception as e:
            return server_error(f"Database initialization failed: {str(e)}")

    event = event or {}
    method = (event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "GET")).upper()
    path = event.get("path") or event.get("rawPath") or "/"
    path = path.rstrip("/")

    if method == "OPTIONS":
        return response(200, {})

    try:
        body = {}
        if event.get("body"):
            body = json.loads(event["body"])

        user = get_current_user(event)
        if not user:
            return unauthorized("Authentication required")

        params = event.get("queryStringParameters") or {}
        parts = [p for p in path.split("/") if p]

        goal_id = None
        is_progress = False
        if len(parts) >= 2:
            if parts[-1] == "progress" and len(parts) >= 3 and parts[-2].isdigit():
                goal_id = int(parts[-2])
                is_progress = True
            elif parts[-1].isdigit():
                goal_id = int(parts[-1])

        if method == "GET" and goal_id is None:
            employee_id = params.get("employee_id")
            status_f = params.get("status")
            query = "SELECT id, employee_id, title, description, status, due_date, progress, priority, created_at, updated_at FROM goals WHERE 1=1"
            args = []
            if employee_id:
                query += " AND employee_id = %s"; args.append(employee_id)
            if status_f:
                query += " AND status = %s"; args.append(status_f)
            query += " ORDER BY priority DESC, due_date ASC"
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, args)
                    rows = cur.fetchall()
                return response(200, [row_to_dict(r) for r in rows])
            finally:
                release_connection(conn)

        if method == "GET" and goal_id:
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, employee_id, title, description, status, due_date, progress, priority, created_at, updated_at FROM goals WHERE id = %s", (goal_id,))
                    row = cur.fetchone()
                if not row:
                    return not_found("Goal not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "POST":
            title = (body.get("title") or "").strip()
            employee_id = body.get("employee_id")
            if not title or not employee_id:
                return bad_request("title and employee_id are required")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO goals (employee_id, title, description, status, due_date, progress, priority)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, employee_id, title, description, status, due_date, progress, priority, created_at, updated_at
                    """, (employee_id, title, body.get("description"),
                          body.get("status", "not_started"), body.get("due_date"),
                          body.get("progress", 0), body.get("priority", "medium")))
                    row = cur.fetchone()
                    conn.commit()
                return response(201, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "PUT" and goal_id and is_progress:
            progress = body.get("progress")
            if progress is None:
                return bad_request("progress is required")
            try:
                progress = int(progress)
                if not (0 <= progress <= 100):
                    return bad_request("progress must be 0-100")
            except (ValueError, TypeError):
                return bad_request("Invalid progress value")
            status = "completed" if progress == 100 else ("in_progress" if progress > 0 else "not_started")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("UPDATE goals SET progress = %s, status = %s, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, title, description, status, due_date, progress, priority, created_at, updated_at", (progress, status, goal_id))
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Goal not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "PUT" and goal_id:
            fields = ["title", "description", "status", "due_date", "progress", "priority"]
            updates = []
            params_list = []
            for f in fields:
                if f in body:
                    updates.append(f"{f} = %s")
                    params_list.append(body[f])
            if not updates:
                return bad_request("No fields to update")
            params_list.append(goal_id)
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE goals SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, title, description, status, due_date, progress, priority, created_at, updated_at", params_list)
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Goal not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "DELETE" and goal_id:
            if user["role"] not in ["admin", "manager"]:
                return forbidden("Insufficient permissions")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM goals WHERE id = %s RETURNING id", (goal_id,))
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Goal not found")
                return response(204, {})
            finally:
                release_connection(conn)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
