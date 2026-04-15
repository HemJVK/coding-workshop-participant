"""
Development Plans Service: CRUD for employee development plans.
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


def init_db():
    conn = get_db_connection(PG_CONFIG)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS development_plans (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                manager_id INTEGER,
                title VARCHAR(255) NOT NULL,
                objectives TEXT,
                actions TEXT,
                resources TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                start_date DATE,
                end_date DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("SELECT COUNT(*) FROM development_plans;")
        if cur.fetchone()[0] == 0:
            sample = [
                (1, 2, "Senior to Staff Engineer Transition", "Build technical leadership skills, lead cross-team projects", "Complete system design course; present at internal tech talks", "Internal budget for courses, mentorship from VP Eng", "active", "2024-01-01", "2024-12-31"),
                (5, 1, "Junior Engineer Growth Plan", "Develop core engineering skills and code quality", "Complete Python advanced course; participate in design reviews", "Online learning subscription, pair programming sessions", "active", "2024-07-01", "2025-06-30"),
                (3, 4, "Product Leadership Development", "Grow into a Director of Product role", "Lead a major product initiative, attend PM leadership conference", "Conference budget, executive coaching", "active", "2024-01-01", "2025-12-31"),
                (7, 4, "Data-Driven Marketing Skills", "Become proficient in analytics and data storytelling", "Complete Google Analytics certification; build monthly dashboard", "Analytics tools access, training budget", "completed", "2023-06-01", "2024-06-30"),
            ]
            for s in sample:
                cur.execute("""
                    INSERT INTO development_plans (employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    keys = ["id", "employee_id", "manager_id", "title", "objectives", "actions",
            "resources", "status", "start_date", "end_date", "created_at", "updated_at"]
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
        plan_id = None
        if len(parts) >= 2 and parts[-1].isdigit():
            plan_id = int(parts[-1])

        if method == "GET" and plan_id is None:
            employee_id = params.get("employee_id")
            status_f = params.get("status")
            query = "SELECT id, employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date, created_at, updated_at FROM development_plans WHERE 1=1"
            args = []
            if employee_id:
                query += " AND employee_id = %s"; args.append(employee_id)
            if status_f:
                query += " AND status = %s"; args.append(status_f)
            query += " ORDER BY created_at DESC"
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, args)
                    rows = cur.fetchall()
                return response(200, [row_to_dict(r) for r in rows])
            finally:
                release_connection(conn)

        if method == "GET" and plan_id:
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date, created_at, updated_at FROM development_plans WHERE id = %s", (plan_id,))
                    row = cur.fetchone()
                if not row:
                    return not_found("Development plan not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "POST":
            title = (body.get("title") or "").strip()
            employee_id = body.get("employee_id")
            if not title or not employee_id:
                return bad_request("title and employee_id are required")
            if user["role"] not in ["admin", "manager"]:
                return forbidden("Insufficient permissions")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO development_plans (employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date, created_at, updated_at
                    """, (employee_id, user["sub"], title, body.get("objectives"),
                          body.get("actions"), body.get("resources"),
                          body.get("status", "active"), body.get("start_date"), body.get("end_date")))
                    row = cur.fetchone()
                    conn.commit()
                return response(201, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "PUT" and plan_id:
            if user["role"] not in ["admin", "manager"]:
                return forbidden("Insufficient permissions")
            fields = ["title", "objectives", "actions", "resources", "status", "start_date", "end_date"]
            updates = []
            params_list = []
            for f in fields:
                if f in body:
                    updates.append(f"{f} = %s")
                    params_list.append(body[f])
            if not updates:
                return bad_request("No fields to update")
            params_list.append(plan_id)
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE development_plans SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, manager_id, title, objectives, actions, resources, status, start_date, end_date, created_at, updated_at", params_list)
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Development plan not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "DELETE" and plan_id:
            if user["role"] not in ["admin", "manager"]:
                return forbidden("Insufficient permissions")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM development_plans WHERE id = %s RETURNING id", (plan_id,))
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Development plan not found")
                return response(204, {})
            finally:
                release_connection(conn)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
