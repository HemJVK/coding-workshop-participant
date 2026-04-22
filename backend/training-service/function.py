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
                competency_id INTEGER,
                completion_date DATE,
                hours NUMERIC(5,1),
                status VARCHAR(50) NOT NULL DEFAULT 'enrolled',
                certificate_url VARCHAR(500),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS training_competency_mappings (
                id SERIAL PRIMARY KEY,
                course_name VARCHAR(255) NOT NULL,
                competency_name VARCHAR(255) NOT NULL,
                level_increment INTEGER NOT NULL DEFAULT 1 CHECK (level_increment >= 1 AND level_increment <= 5),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(course_name, competency_name)
            );
        """)
        cur.execute("ALTER TABLE training_records ADD COLUMN IF NOT EXISTS competency_id INTEGER")
        cur.execute("SELECT COUNT(*) FROM training_records;")
        if cur.fetchone()[0] == 0:
            sample = [
                (1, "AWS Solutions Architect Professional", "AWS", "certification", None, "2024-11-15", 40, "completed", None, "Passed with score 870/1000"),
                (1, "Advanced Python Patterns", "Udemy", "online", None, "2024-09-20", 12, "completed", None, "Excellent course on design patterns"),
                (2, "System Design Interview Prep", "Educative.io", "online", None, None, 20, "in_progress", None, None),
                (3, "Product-Led Growth Certification", "Product School", "certification", None, "2024-10-01", 16, "completed", None, None),
                (5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online", None, "2024-12-01", 8, "completed", None, None),
                (5, "Python for Data Science", "Coursera", "online", None, None, 30, "enrolled", None, None),
                (6, "Negotiation Skills", "Harvard Online", "online", None, "2024-08-30", 6, "completed", None, None),
                (7, "Google Analytics 4 Certification", "Google", "certification", None, "2024-07-15", 10, "completed", None, None),
                (8, "Financial Modeling & Valuation", "CFI", "online", None, None, 25, "in_progress", None, None),
                (4, "Employment Law Essentials", "SHRM", "certification", None, "2024-05-20", 20, "completed", None, None),
            ]
            for s in sample:
                cur.execute("""
                    INSERT INTO training_records (employee_id, course_name, provider, training_type, competency_id, completion_date, hours, status, certificate_url, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, s)
        cur.execute("SELECT COUNT(*) FROM training_competency_mappings;")
        if cur.fetchone()[0] == 0:
            mappings = [
                ("AWS Solutions Architect Professional", "Cloud Architecture", 1),
                ("Advanced Python Patterns", "Python", 1),
                ("System Design Interview Prep", "Problem Solving", 1),
                ("Product-Led Growth Certification", "Customer Focus", 1),
                ("Docker & Kubernetes Fundamentals", "Cloud Architecture", 1),
                ("Python for Data Science", "Python", 1),
                ("Python for Data Science", "Data Analysis", 1),
                ("Negotiation Skills", "Communication", 1),
                ("Negotiation Skills", "Leadership", 1),
                ("Google Analytics 4 Certification", "Data Analysis", 1),
                ("Financial Modeling & Valuation", "Data Analysis", 1),
                ("Employment Law Essentials", "Communication", 1),
            ]
            for mapping in mappings:
                cur.execute("""
                    INSERT INTO training_competency_mappings (course_name, competency_name, level_increment)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (course_name, competency_name) DO NOTHING
                """, mapping)
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
    keys = ["id", "employee_id", "course_name", "provider", "training_type", "competency_id", "competency_name",
            "completion_date", "hours", "status", "certificate_url", "notes", "created_at", "updated_at"]
    return dict(zip(keys, row))


def is_completed(status):
    return str(status or "").strip().lower() == "completed"


def normalize_optional_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def normalize_optional_number(value):
    if value is None or value == "":
        return None
    return value


def fetch_competency_name(cur, competency_id):
    if not competency_id:
        return None
    cur.execute("SELECT name FROM competencies WHERE id = %s", (competency_id,))
    row = cur.fetchone()
    return row[0] if row else None


def sync_training_mapping(cur, course_name, competency_id):
    competency_name = fetch_competency_name(cur, competency_id)
    if not course_name or not competency_name:
        return
    cur.execute("""
        INSERT INTO training_competency_mappings (course_name, competency_name, level_increment)
        VALUES (%s, %s, %s)
        ON CONFLICT (course_name, competency_name) DO NOTHING
    """, (course_name, competency_name, 1))


def apply_training_completion_effects(cur, employee_id, course_name, competency_id=None):
    direct_competency_name = fetch_competency_name(cur, competency_id)
    if competency_id and direct_competency_name:
        cur.execute("""
            SELECT
                c.name AS competency_name,
                %s AS level_increment,
                c.id AS competency_id,
                ec.current_level,
                ec.target_level
            FROM competencies c
            LEFT JOIN employee_competencies ec
                ON ec.employee_id = %s
               AND ec.competency_id = c.id
            WHERE c.id = %s
        """, (1, employee_id, competency_id))
        mappings = cur.fetchall()
    else:
        try:
            cur.execute("""
                SELECT
                    m.competency_name,
                    m.level_increment,
                    c.id AS competency_id,
                    ec.current_level,
                    ec.target_level
                FROM training_competency_mappings m
                LEFT JOIN competencies c
                    ON LOWER(c.name) = LOWER(m.competency_name)
                LEFT JOIN employee_competencies ec
                    ON ec.employee_id = %s
                   AND ec.competency_id = c.id
                WHERE LOWER(m.course_name) = LOWER(%s)
                ORDER BY m.competency_name
            """, (employee_id, course_name))
            mappings = cur.fetchall()
        except Exception as exc:
            logger.warning("Unable to calculate competency updates for course '%s': %s", course_name, exc)
            return [{"course_name": course_name, "action": "skipped", "reason": "competency_sync_unavailable"}]

    if not mappings:
        return [{"course_name": course_name, "action": "skipped", "reason": "no_mapping"}]

    updates = []
    for competency_name, level_increment, competency_id, current_level, target_level in mappings:
        if competency_id is None:
            updates.append({
                "competency_name": competency_name,
                "action": "skipped",
                "reason": "competency_not_defined",
            })
            continue

        if current_level is None or target_level is None:
            updates.append({
                "competency_name": competency_name,
                "action": "skipped",
                "reason": "assessment_not_found",
            })
            continue

        new_level = min(target_level, current_level + level_increment)
        if new_level <= current_level:
            updates.append({
                "competency_name": competency_name,
                "action": "unchanged",
                "current_level": current_level,
                "target_level": target_level,
            })
            continue

        cur.execute("""
            UPDATE employee_competencies
            SET current_level = %s,
                assessed_at = NOW()
            WHERE employee_id = %s
              AND competency_id = %s
            RETURNING current_level, target_level, assessed_at
        """, (new_level, employee_id, competency_id))
        updated_level, updated_target, assessed_at = cur.fetchone()
        updates.append({
            "competency_name": competency_name,
            "action": "increased",
            "previous_level": current_level,
            "current_level": updated_level,
            "target_level": updated_target,
            "assessed_at": assessed_at,
        })

    return updates


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
            query = """
                SELECT
                    tr.id, tr.employee_id, tr.course_name, tr.provider, tr.training_type,
                    tr.competency_id, c.name AS competency_name, tr.completion_date, tr.hours,
                    tr.status, tr.certificate_url, tr.notes, tr.created_at, tr.updated_at
                FROM training_records tr
                LEFT JOIN competencies c ON c.id = tr.competency_id
                WHERE 1=1
            """
            args = []
            if employee_id:
                query += " AND tr.employee_id = %s"; args.append(employee_id)
            if status_f:
                query += " AND tr.status = %s"; args.append(status_f)
            if user["role"] == "manager":
                query += " AND tr.employee_id IN (SELECT id FROM employees WHERE manager_id = %s)"
                args.append(user["sub"])
            query += " ORDER BY tr.created_at DESC"
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
                    cur.execute("""
                        SELECT
                            tr.id, tr.employee_id, tr.course_name, tr.provider, tr.training_type,
                            tr.competency_id, c.name AS competency_name, tr.completion_date, tr.hours,
                            tr.status, tr.certificate_url, tr.notes, tr.created_at, tr.updated_at
                        FROM training_records tr
                        LEFT JOIN competencies c ON c.id = tr.competency_id
                        WHERE tr.id = %s
                    """, (rec_id,))
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
            competency_id = body.get("competency_id")
            completion_date = normalize_optional_text(body.get("completion_date"))
            hours = normalize_optional_number(body.get("hours"))
            provider = normalize_optional_text(body.get("provider"))
            certificate_url = normalize_optional_text(body.get("certificate_url"))
            notes = normalize_optional_text(body.get("notes"))
            if not course_name or not employee_id:
                return bad_request("course_name and employee_id are required")
            conn = get_db_connection(PG_CONFIG)
            if user["role"] == "manager" and not check_manager_access(conn, user["sub"], employee_id):
                release_connection(conn)
                return forbidden("Not authorized to create record for this employee")
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO training_records (employee_id, course_name, provider, training_type, competency_id, completion_date, hours, status, certificate_url, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, employee_id, course_name, provider, training_type, competency_id
                    """, (employee_id, course_name, provider,
                          body.get("training_type", "online"), competency_id, completion_date,
                          hours, body.get("status", "enrolled"),
                          certificate_url, notes))
                    row = cur.fetchone()
                    sync_training_mapping(cur, row[2], row[5])
                    competency_updates = []
                    if is_completed(body.get("status", "enrolled")):
                        competency_updates = apply_training_completion_effects(cur, row[1], row[2], row[5])
                    cur.execute("""
                        SELECT
                            tr.id, tr.employee_id, tr.course_name, tr.provider, tr.training_type,
                            tr.competency_id, c.name AS competency_name, tr.completion_date, tr.hours,
                            tr.status, tr.certificate_url, tr.notes, tr.created_at, tr.updated_at
                        FROM training_records tr
                        LEFT JOIN competencies c ON c.id = tr.competency_id
                        WHERE tr.id = %s
                    """, (row[0],))
                    payload_row = cur.fetchone()
                    conn.commit()
                payload = row_to_dict(payload_row)
                payload["competency_updates"] = competency_updates
                return response(201, payload)
            finally:
                release_connection(conn)

        if method == "PUT" and rec_id:
            fields = ["course_name", "provider", "training_type", "competency_id", "completion_date", "hours", "status", "certificate_url", "notes"]
            updates = []
            params_list = []
            for f in fields:
                if f in body:
                    updates.append(f"{f} = %s")
                    value = body[f]
                    if f in ["provider", "completion_date", "certificate_url", "notes"]:
                        value = normalize_optional_text(value)
                    elif f == "hours":
                        value = normalize_optional_number(value)
                    params_list.append(value)
            if not updates:
                return bad_request("No fields to update")
            params_list.append(rec_id)
            conn = get_db_connection(PG_CONFIG)

            existing_row = None
            prefetch_cur = conn.cursor()
            prefetch_cur.execute("SELECT employee_id, course_name, status, competency_id FROM training_records WHERE id = %s", (rec_id,))
            existing_row = prefetch_cur.fetchone()
            prefetch_cur.close()

            if user["role"] == "manager":
                if not existing_row or not check_manager_access(conn, user["sub"], existing_row[0]):
                    release_connection(conn)
                    return forbidden("Not authorized to update this record")

            try:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE training_records SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, course_name, provider, training_type, competency_id", params_list)
                    row = cur.fetchone()
                    competency_updates = []
                    if row and existing_row:
                        sync_training_mapping(cur, row[2], row[5])
                        completed_before = is_completed(existing_row[2])
                        completed_after = is_completed(body.get("status", existing_row[2]))
                        competency_added_after_completion = completed_before and completed_after and not existing_row[3] and row[5]
                        if (not completed_before and completed_after) or competency_added_after_completion:
                            competency_updates = apply_training_completion_effects(cur, row[1], row[2], row[5])
                    if row:
                        cur.execute("""
                            SELECT
                                tr.id, tr.employee_id, tr.course_name, tr.provider, tr.training_type,
                                tr.competency_id, c.name AS competency_name, tr.completion_date, tr.hours,
                                tr.status, tr.certificate_url, tr.notes, tr.created_at, tr.updated_at
                            FROM training_records tr
                            LEFT JOIN competencies c ON c.id = tr.competency_id
                            WHERE tr.id = %s
                        """, (row[0],))
                        payload_row = cur.fetchone()
                    conn.commit()
                if not row:
                    return not_found("Training record not found")
                payload = row_to_dict(payload_row)
                payload["competency_updates"] = competency_updates
                return response(200, payload)
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
