"""
Training Records Service: CRUD for employee training and development activities.
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
            CREATE TABLE IF NOT EXISTS training_records (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                course_name VARCHAR(255) NOT NULL,
                provider VARCHAR(255),
                training_type VARCHAR(100) DEFAULT 'online',
                completion_date DATE,
                hours NUMERIC(5,1),
                status VARCHAR(50) NOT NULL DEFAULT 'enrolled',
                certificate_url VARCHAR(500),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("SELECT COUNT(*) FROM training_records;")
        if cur.fetchone()[0] == 0:
            sample = [
                (1, "AWS Solutions Architect Professional", "AWS", "certification", "2024-11-15", 40, "completed", None, "Passed with score 870/1000"),
                (1, "Advanced Python Patterns", "Udemy", "online", "2024-09-20", 12, "completed", None, "Excellent course on design patterns"),
                (2, "System Design Interview Prep", "Educative.io", "online", None, 20, "in_progress", None, None),
                (3, "Product-Led Growth Certification", "Product School", "certification", "2024-10-01", 16, "completed", None, None),
                (5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online", "2024-12-01", 8, "completed", None, None),
                (5, "Python for Data Science", "Coursera", "online", None, 30, "enrolled", None, None),
                (6, "Negotiation Skills", "Harvard Online", "online", "2024-08-30", 6, "completed", None, None),
                (7, "Google Analytics 4 Certification", "Google", "certification", "2024-07-15", 10, "completed", None, None),
                (8, "Financial Modeling & Valuation", "CFI", "online", None, 25, "in_progress", None, None),
                (4, "Employment Law Essentials", "SHRM", "certification", "2024-05-20", 20, "completed", None, None),
            ]
            for s in sample:
                cur.execute("""
                    INSERT INTO training_records (employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes)
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
    keys = ["id", "employee_id", "course_name", "provider", "training_type",
            "completion_date", "hours", "status", "certificate_url", "notes", "created_at", "updated_at"]
    return dict(zip(keys, row))


def check_manager_access(conn, user_id, target_employee_id):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT manager_id FROM employees WHERE id = %s", (target_employee_id,))
            row = cur.fetchone()
            return bool(row and str(row[0]) == str(user_id))
    except Exception:
        return False


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
        rec_id = None
        if len(parts) >= 2 and parts[-1].isdigit():
            rec_id = int(parts[-1])

        if method == "GET" and rec_id is None:
            employee_id = params.get("employee_id")
            status_f = params.get("status")
            query = "SELECT id, employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes, created_at, updated_at FROM training_records WHERE 1=1"
            args = []
            if employee_id:
                query += " AND employee_id = %s"; args.append(employee_id)
            if status_f:
                query += " AND status = %s"; args.append(status_f)
            if user["role"] == "manager":
                query += " AND employee_id IN (SELECT id FROM employees WHERE manager_id = %s)"
                args.append(user["sub"])
            query += " ORDER BY created_at DESC"
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute(query, args)
                    rows = cur.fetchall()
                return response(200, [row_to_dict(r) for r in rows])
            finally:
                release_connection(conn)

        if method == "GET" and rec_id:
            conn = get_db_connection(PG_CONFIG)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes, created_at, updated_at FROM training_records WHERE id = %s", (rec_id,))
                    row = cur.fetchone()
                if not row:
                    return not_found("Training record not found")
                if user["role"] == "manager" and not check_manager_access(conn, user["sub"], row[1]):
                    return forbidden("Not authorized to view this record")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "POST":
            course_name = (body.get("course_name") or "").strip()
            employee_id = body.get("employee_id")
            if not course_name or not employee_id:
                return bad_request("course_name and employee_id are required")
            conn = get_db_connection(PG_CONFIG)
            if user["role"] == "manager" and not check_manager_access(conn, user["sub"], employee_id):
                release_connection(conn)
                return forbidden("Not authorized to create record for this employee")
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO training_records (employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes, created_at, updated_at
                    """, (employee_id, course_name, body.get("provider"),
                          body.get("training_type", "online"), body.get("completion_date"),
                          body.get("hours"), body.get("status", "enrolled"),
                          body.get("certificate_url"), body.get("notes")))
                    row = cur.fetchone()
                    conn.commit()
                return response(201, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "PUT" and rec_id:
            fields = ["course_name", "provider", "training_type", "completion_date", "hours", "status", "certificate_url", "notes"]
            updates = []
            params_list = []
            for f in fields:
                if f in body:
                    updates.append(f"{f} = %s")
                    params_list.append(body[f])
            if not updates:
                return bad_request("No fields to update")
            params_list.append(rec_id)
            conn = get_db_connection(PG_CONFIG)

            if user["role"] == "manager":
                cur = conn.cursor()
                cur.execute("SELECT employee_id FROM training_records WHERE id = %s", (rec_id,))
                emp_row = cur.fetchone()
                cur.close()
                if not emp_row or not check_manager_access(conn, user["sub"], emp_row[0]):
                    release_connection(conn)
                    return forbidden("Not authorized to update this record")

            try:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE training_records SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, course_name, provider, training_type, completion_date, hours, status, certificate_url, notes, created_at, updated_at", params_list)
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Training record not found")
                return response(200, row_to_dict(row))
            finally:
                release_connection(conn)

        if method == "DELETE" and rec_id:
            if user["role"] not in ["admin", "manager", "hr"]:
                return forbidden("Insufficient permissions")
            conn = get_db_connection(PG_CONFIG)

            if user["role"] == "manager":
                cur = conn.cursor()
                cur.execute("SELECT employee_id FROM training_records WHERE id = %s", (rec_id,))
                emp_row = cur.fetchone()
                cur.close()
                if not emp_row or not check_manager_access(conn, user["sub"], emp_row[0]):
                    release_connection(conn)
                    return forbidden("Not authorized to delete this record")

            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM training_records WHERE id = %s RETURNING id", (rec_id,))
                    row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Training record not found")
                return response(204, {})
            finally:
                release_connection(conn)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
