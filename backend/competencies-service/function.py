"""
Competencies Service: Manage competency definitions and employee competency assessments.
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
            CREATE TABLE IF NOT EXISTS competencies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                category VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS employee_competencies (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                competency_id INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
                current_level INTEGER CHECK (current_level >= 1 AND current_level <= 5),
                target_level INTEGER CHECK (target_level >= 1 AND target_level <= 5),
                assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(employee_id, competency_id)
            );
        """)
        cur.execute("SELECT COUNT(*) FROM competencies;")
        if cur.fetchone()[0] == 0:
            comps = [
                ("Python", "Python programming language proficiency", "Technical"),
                ("SQL", "Database querying and optimization", "Technical"),
                ("Leadership", "Ability to guide and inspire teams", "Leadership"),
                ("Communication", "Clear and effective communication", "Soft Skills"),
                ("Problem Solving", "Analytical and critical thinking", "Cognitive"),
                ("Project Management", "Planning and delivering projects on time", "Management"),
                ("Cloud Architecture", "AWS/Azure/GCP design and implementation", "Technical"),
                ("Agile/Scrum", "Agile methodologies and Scrum practices", "Process"),
                ("Data Analysis", "Interpreting data to drive decisions", "Technical"),
                ("Customer Focus", "Understanding and meeting customer needs", "Soft Skills"),
            ]
            for c in comps:
                cur.execute("INSERT INTO competencies (name, description, category) VALUES (%s, %s, %s)", c)
            # Seed employee assessments
            assessments = [
                (1, 1, 5, 5), (1, 2, 4, 5), (1, 7, 3, 4), (1, 5, 4, 5),
                (2, 1, 5, 5), (2, 7, 5, 5), (2, 2, 4, 4), (2, 8, 4, 5),
                (3, 3, 4, 5), (3, 6, 4, 5), (3, 10, 5, 5), (3, 4, 4, 4),
                (5, 1, 2, 4), (5, 2, 2, 3), (5, 5, 3, 4), (5, 8, 3, 4),
                (6, 10, 5, 5), (6, 4, 4, 5), (6, 3, 3, 4), (6, 6, 4, 5),
                (7, 4, 5, 5), (7, 9, 4, 5), (7, 10, 4, 5), (7, 3, 3, 4),
                (8, 2, 4, 5), (8, 9, 4, 5), (8, 5, 4, 4), (8, 6, 3, 4),
            ]
            for a in assessments:
                cur.execute("""
                    INSERT INTO employee_competencies (employee_id, competency_id, current_level, target_level)
                    VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING
                """, a)
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

        parts = [p for p in path.split("/") if p]
        # /competencies-service/employee/{id}
        if "employee" in parts:
            emp_idx = parts.index("employee")
            emp_id = parts[emp_idx + 1] if emp_idx + 1 < len(parts) else None
            if not emp_id:
                return bad_request("Employee ID required")
            if method == "GET":
                conn = get_db_connection(PG_CONFIG)
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT ec.id, ec.employee_id, ec.competency_id, c.name, c.category,
                                   ec.current_level, ec.target_level, ec.assessed_at
                            FROM employee_competencies ec
                            JOIN competencies c ON c.id = ec.competency_id
                            WHERE ec.employee_id = %s ORDER BY c.category, c.name
                        """, (emp_id,))
                        rows = cur.fetchall()
                    keys = ["id", "employee_id", "competency_id", "competency_name", "category",
                            "current_level", "target_level", "assessed_at"]
                    return response(200, [dict(zip(keys, r)) for r in rows])
                finally:
                    release_connection(conn)
            if method == "POST":
                comp_id = body.get("competency_id")
                current = body.get("current_level")
                target = body.get("target_level")
                if not comp_id or current is None:
                    return bad_request("competency_id and current_level are required")
                conn = get_db_connection(PG_CONFIG)
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO employee_competencies (employee_id, competency_id, current_level, target_level)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (employee_id, competency_id)
                            DO UPDATE SET current_level = EXCLUDED.current_level,
                                          target_level = EXCLUDED.target_level,
                                          assessed_at = NOW()
                            RETURNING id, employee_id, competency_id, current_level, target_level, assessed_at
                        """, (emp_id, comp_id, current, target))
                        row = cur.fetchone()
                        conn.commit()
                    keys = ["id", "employee_id", "competency_id", "current_level", "target_level", "assessed_at"]
                    return response(201, dict(zip(keys, row)))
                finally:
                    release_connection(conn)

        # /competencies-service  — list / create competency definitions
        comp_id = None
        if len(parts) >= 2 and parts[-1].isdigit():
            comp_id = int(parts[-1])

        if method == "GET" and comp_id is None:
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, name, description, category, created_at FROM competencies ORDER BY category, name")
                    rows = cur.fetchall()
                keys = ["id", "name", "description", "category", "created_at"]
                return response(200, [dict(zip(keys, r)) for r in rows])
            finally:
                release_connection(conn)

        if method == "GET" and comp_id:
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, name, description, category, created_at FROM competencies WHERE id = %s", (comp_id,))
                    row = cur.fetchone()
                if not row:
                    return not_found("Competency not found")
                return response(200, dict(zip(["id", "name", "description", "category", "created_at"], row)))
            finally:
                release_connection(conn)

        if method == "POST":
            if user["role"] not in ["admin", "manager"]:
                return forbidden("Insufficient permissions")
            name = (body.get("name") or "").strip()
            if not name:
                return bad_request("Name is required")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO competencies (name, description, category) VALUES (%s, %s, %s) RETURNING id, name, description, category, created_at",
                                (name, body.get("description"), body.get("category")))
                    row = cur.fetchone()
                    conn.commit()
                return response(201, dict(zip(["id", "name", "description", "category", "created_at"], row)))
            finally:
                release_connection(conn)

        if method == "DELETE" and comp_id:
            if user["role"] != "admin":
                return forbidden("Insufficient permissions")
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM competencies WHERE id = %s RETURNING id", (comp_id,))
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Competency not found")
                return response(204, {})
            finally:
                release_connection(conn)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
