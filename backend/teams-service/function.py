"""
Teams Service: CRUD for teams, team members, monthly achievements, and team metadata.
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
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                team_type VARCHAR(100) DEFAULT 'delivery',
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                primary_location VARCHAR(255),
                leader_employee_id INTEGER,
                owner_user_id INTEGER,
                org_leader_employee_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS team_members (
                id SERIAL PRIMARY KEY,
                team_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                role_title VARCHAR(255),
                direct_staff BOOLEAN NOT NULL DEFAULT TRUE,
                is_team_lead BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(team_id, employee_id)
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS team_achievements (
                id SERIAL PRIMARY KEY,
                team_id INTEGER NOT NULL,
                achievement_month DATE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                impact_metric VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS team_metadata (
                id SERIAL PRIMARY KEY,
                team_id INTEGER NOT NULL,
                meta_key VARCHAR(255) NOT NULL,
                meta_value TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            """
        )

        cur.execute("SELECT COUNT(*) FROM teams")
        if cur.fetchone()[0] == 0:
            cur.execute(
                """
                INSERT INTO teams (name, description, team_type, status, primary_location, leader_employee_id, owner_user_id, org_leader_employee_id)
                VALUES
                  ('Platform Engineering', 'Builds core internal platforms and developer experience.', 'engineering', 'active', 'New York', 2, 3, 1),
                  ('Product Innovation', 'Runs product discovery, experimentation, and roadmap delivery.', 'product', 'active', 'Austin', 3, 3, 1),
                  ('Revenue Operations', 'Coordinates sales, finance, and reporting operations.', 'operations', 'active', 'Seattle', 7, 1, 6)
                """
            )
            cur.execute(
                """
                INSERT INTO team_members (team_id, employee_id, role_title, direct_staff, is_team_lead)
                VALUES
                  (1, 1, 'Senior Engineer', TRUE, FALSE),
                  (1, 2, 'Platform Team Lead', FALSE, TRUE),
                  (1, 5, 'Junior Engineer', TRUE, FALSE),
                  (2, 3, 'Product Team Lead', TRUE, TRUE),
                  (2, 4, 'HR Business Partner', FALSE, FALSE),
                  (2, 1, 'Technical Advisor', TRUE, FALSE),
                  (3, 6, 'Operations Sponsor', FALSE, FALSE),
                  (3, 7, 'Revenue Operations Lead', TRUE, TRUE),
                  (3, 8, 'Financial Analyst', FALSE, FALSE)
                """
            )
            cur.execute(
                """
                INSERT INTO team_achievements (team_id, achievement_month, title, description, impact_metric)
                VALUES
                  (1, DATE '2026-03-01', 'Developer portal launch', 'Released a self-service portal for internal engineering teams.', '42 onboarding tasks automated'),
                  (1, DATE '2026-04-01', 'Incident MTTR reduction', 'Reduced median incident response time across platform services.', 'MTTR down 28%'),
                  (2, DATE '2026-03-01', 'Customer discovery sprint', 'Completed 16 interviews to validate roadmap assumptions.', '3 roadmap bets validated'),
                  (2, DATE '2026-04-01', 'Beta release readiness', 'Delivered beta readiness package with go-to-market support.', 'Beta delivered on schedule'),
                  (3, DATE '2026-04-01', 'Forecast accuracy improvement', 'Improved reporting workflow and finance handoffs.', 'Forecast variance down to 6%')
                """
            )
            cur.execute(
                """
                INSERT INTO team_metadata (team_id, meta_key, meta_value)
                VALUES
                  (1, 'business_unit', 'Engineering'),
                  (1, 'transformation_priority', 'high'),
                  (2, 'business_unit', 'Product'),
                  (2, 'cadence', 'monthly'),
                  (3, 'business_unit', 'Operations'),
                  (3, 'reporting_scope', 'organization leader')
                """
            )

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


def bad_request(msg):
    return response(400, {"error": msg})


def unauthorized(msg):
    return response(401, {"error": msg})


def forbidden(msg):
    return response(403, {"error": msg})


def not_found(msg):
    return response(404, {"error": msg})


def server_error(msg):
    return response(500, {"error": msg})


def normalize_month(value):
    if not value:
        return None
    value = str(value).strip()
    if len(value) == 7:
        return f"{value}-01"
    return value


def get_team_summary_row(cur, team_id):
    cur.execute(
        """
        SELECT
            t.id,
            t.name,
            t.description,
            t.team_type,
            t.status,
            t.primary_location,
            t.leader_employee_id,
            leader.name,
            t.owner_user_id,
            t.org_leader_employee_id,
            org_leader.name,
            COUNT(DISTINCT tm.employee_id) AS member_count,
            COUNT(DISTINCT ta.id) AS achievement_count
        FROM teams t
        LEFT JOIN employees leader ON leader.id = t.leader_employee_id
        LEFT JOIN employees org_leader ON org_leader.id = t.org_leader_employee_id
        LEFT JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN team_achievements ta ON ta.team_id = t.id
        WHERE t.id = %s
        GROUP BY t.id, leader.name, org_leader.name
        """,
        (team_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    keys = [
        "id",
        "name",
        "description",
        "team_type",
        "status",
        "primary_location",
        "leader_employee_id",
        "leader_name",
        "owner_user_id",
        "org_leader_employee_id",
        "org_leader_name",
        "member_count",
        "achievement_count",
    ]
    return dict(zip(keys, row))


def get_team_members(cur, team_id):
    cur.execute(
        """
        SELECT
            tm.id,
            tm.employee_id,
            e.name,
            e.email,
            e.department,
            e.job_title,
            e.location,
            tm.role_title,
            tm.direct_staff,
            tm.is_team_lead
        FROM team_members tm
        JOIN employees e ON e.id = tm.employee_id
        WHERE tm.team_id = %s
        ORDER BY tm.is_team_lead DESC, e.name
        """,
        (team_id,),
    )
    keys = [
        "id",
        "employee_id",
        "employee_name",
        "email",
        "department",
        "job_title",
        "location",
        "role_title",
        "direct_staff",
        "is_team_lead",
    ]
    return [dict(zip(keys, row)) for row in cur.fetchall()]


def get_team_achievements(cur, team_id):
    cur.execute(
        """
        SELECT id, team_id, achievement_month, title, description, impact_metric, created_at, updated_at
        FROM team_achievements
        WHERE team_id = %s
        ORDER BY achievement_month DESC, created_at DESC
        """,
        (team_id,),
    )
    keys = ["id", "team_id", "achievement_month", "title", "description", "impact_metric", "created_at", "updated_at"]
    return [dict(zip(keys, row)) for row in cur.fetchall()]


def get_team_metadata(cur, team_id):
    cur.execute(
        """
        SELECT id, team_id, meta_key, meta_value, created_at, updated_at
        FROM team_metadata
        WHERE team_id = %s
        ORDER BY meta_key
        """,
        (team_id,),
    )
    keys = ["id", "team_id", "meta_key", "meta_value", "created_at", "updated_at"]
    return [dict(zip(keys, row)) for row in cur.fetchall()]


def handle_list(event):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")

    params = event.get("queryStringParameters") or {}
    search = (params.get("search") or "").strip()
    status = (params.get("status") or "").strip()
    location = (params.get("location") or "").strip()

    query = """
        SELECT
            t.id,
            t.name,
            t.description,
            t.team_type,
            t.status,
            t.primary_location,
            t.leader_employee_id,
            leader.name,
            t.owner_user_id,
            t.org_leader_employee_id,
            org_leader.name,
            COUNT(DISTINCT tm.employee_id) AS member_count,
            COUNT(DISTINCT ta.id) AS achievement_count
        FROM teams t
        LEFT JOIN employees leader ON leader.id = t.leader_employee_id
        LEFT JOIN employees org_leader ON org_leader.id = t.org_leader_employee_id
        LEFT JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN team_achievements ta ON ta.team_id = t.id
        WHERE 1 = 1
    """
    args = []
    if search:
        query += " AND (t.name ILIKE %s OR COALESCE(t.description, '') ILIKE %s)"
        args.extend([f"%{search}%", f"%{search}%"])
    if status:
        query += " AND t.status = %s"
        args.append(status)
    if location:
        query += " AND COALESCE(t.primary_location, '') = %s"
        args.append(location)

    query += " GROUP BY t.id, leader.name, org_leader.name ORDER BY t.name"

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        keys = [
            "id",
            "name",
            "description",
            "team_type",
            "status",
            "primary_location",
            "leader_employee_id",
            "leader_name",
            "owner_user_id",
            "org_leader_employee_id",
            "org_leader_name",
            "member_count",
            "achievement_count",
        ]
        return response(200, [dict(zip(keys, row)) for row in rows])
    finally:
        release_connection(conn)


def handle_get_one(event, team_id):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            team = get_team_summary_row(cur, team_id)
            if not team:
                return not_found("Team not found")
            team["members"] = get_team_members(cur, team_id)
            team["achievements"] = get_team_achievements(cur, team_id)
            team["metadata"] = get_team_metadata(cur, team_id)
            distinct_locations = sorted({m["location"] for m in team["members"] if m.get("location")})
            team["member_locations"] = distinct_locations
            team["non_direct_staff_ratio"] = round(
                (
                    sum(1 for member in team["members"] if not member["direct_staff"]) /
                    len(team["members"])
                ) if team["members"] else 0,
                2,
            )
        return response(200, team)
    finally:
        release_connection(conn)


def handle_create(event, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    name = (body.get("name") or "").strip()
    if not name:
        return bad_request("Team name is required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM teams WHERE name = %s", (name,))
            if cur.fetchone():
                return bad_request("Team name already exists")

            cur.execute(
                """
                INSERT INTO teams (name, description, team_type, status, primary_location, leader_employee_id, owner_user_id, org_leader_employee_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    name,
                    body.get("description"),
                    body.get("team_type") or "delivery",
                    body.get("status") or "active",
                    body.get("primary_location"),
                    body.get("leader_employee_id"),
                    body.get("owner_user_id"),
                    body.get("org_leader_employee_id"),
                ),
            )
            team_id = cur.fetchone()[0]
            conn.commit()
        return handle_get_one(event, team_id)
    finally:
        release_connection(conn)


def handle_update(event, team_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    fields = [
        "name",
        "description",
        "team_type",
        "status",
        "primary_location",
        "leader_employee_id",
        "owner_user_id",
        "org_leader_employee_id",
    ]
    updates = []
    params = []
    for field in fields:
        if field in body:
            updates.append(f"{field} = %s")
            params.append(body[field] if body[field] != "" else None)
    if not updates:
        return bad_request("No fields to update")
    params.append(team_id)

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE teams SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id",
                params,
            )
            row = cur.fetchone()
            conn.commit()
        if not row:
            return not_found("Team not found")
        return handle_get_one(event, team_id)
    finally:
        release_connection(conn)


def handle_delete(event, team_id):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM team_metadata WHERE team_id = %s", (team_id,))
            cur.execute("DELETE FROM team_achievements WHERE team_id = %s", (team_id,))
            cur.execute("DELETE FROM team_members WHERE team_id = %s", (team_id,))
            cur.execute("DELETE FROM teams WHERE id = %s RETURNING id", (team_id,))
            row = cur.fetchone()
            conn.commit()
        if not row:
            return not_found("Team not found")
        return response(204, {})
    finally:
        release_connection(conn)


def handle_list_members(event, team_id):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            if not get_team_summary_row(cur, team_id):
                return not_found("Team not found")
            return response(200, get_team_members(cur, team_id))
    finally:
        release_connection(conn)


def handle_add_member(event, team_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    employee_id = body.get("employee_id")
    if not employee_id:
        return bad_request("employee_id is required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
            if not cur.fetchone():
                return not_found("Team not found")
            cur.execute("SELECT id FROM employees WHERE id = %s", (employee_id,))
            if not cur.fetchone():
                return bad_request("Employee not found")
            cur.execute(
                """
                INSERT INTO team_members (team_id, employee_id, role_title, direct_staff, is_team_lead)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (team_id, employee_id) DO UPDATE
                SET role_title = EXCLUDED.role_title,
                    direct_staff = EXCLUDED.direct_staff,
                    is_team_lead = EXCLUDED.is_team_lead,
                    updated_at = NOW()
                """,
                (
                    team_id,
                    employee_id,
                    body.get("role_title"),
                    body.get("direct_staff", True),
                    body.get("is_team_lead", False),
                ),
            )
            conn.commit()
            members = get_team_members(cur, team_id)
        return response(200, members)
    finally:
        release_connection(conn)


def handle_update_member(event, team_id, employee_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    fields = ["role_title", "direct_staff", "is_team_lead"]
    updates = []
    params = []
    for field in fields:
        if field in body:
            updates.append(f"{field} = %s")
            params.append(body[field])
    if not updates:
        return bad_request("No fields to update")
    params.extend([team_id, employee_id])

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE team_members SET {', '.join(updates)}, updated_at = NOW() WHERE team_id = %s AND employee_id = %s RETURNING id",
                params,
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Team member not found")
            members = get_team_members(cur, team_id)
        return response(200, members)
    finally:
        release_connection(conn)


def handle_remove_member(event, team_id, employee_id):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM team_members WHERE team_id = %s AND employee_id = %s RETURNING id",
                (team_id, employee_id),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Team member not found")
            members = get_team_members(cur, team_id)
        return response(200, members)
    finally:
        release_connection(conn)


def handle_list_achievements(event, team_id):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")
    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
            if not cur.fetchone():
                return not_found("Team not found")
            return response(200, get_team_achievements(cur, team_id))
    finally:
        release_connection(conn)


def handle_create_achievement(event, team_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    title = (body.get("title") or "").strip()
    achievement_month = normalize_month(body.get("achievement_month"))
    if not title or not achievement_month:
        return bad_request("title and achievement_month are required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO team_achievements (team_id, achievement_month, title, description, impact_metric)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (team_id, achievement_month, title, body.get("description"), body.get("impact_metric")),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return server_error("Failed to create achievement")
            achievements = get_team_achievements(cur, team_id)
        return response(201, achievements)
    finally:
        release_connection(conn)


def handle_update_achievement(event, team_id, achievement_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    field_map = {
        "achievement_month": normalize_month(body.get("achievement_month")) if "achievement_month" in body else None,
        "title": body.get("title"),
        "description": body.get("description"),
        "impact_metric": body.get("impact_metric"),
    }
    updates = []
    params = []
    for field, value in field_map.items():
        if field in body:
            updates.append(f"{field} = %s")
            params.append(value if value != "" else None)
    if not updates:
        return bad_request("No fields to update")
    params.extend([team_id, achievement_id])

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE team_achievements SET {', '.join(updates)}, updated_at = NOW() WHERE team_id = %s AND id = %s RETURNING id",
                params,
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Achievement not found")
            achievements = get_team_achievements(cur, team_id)
        return response(200, achievements)
    finally:
        release_connection(conn)


def handle_delete_achievement(event, team_id, achievement_id):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM team_achievements WHERE team_id = %s AND id = %s RETURNING id",
                (team_id, achievement_id),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Achievement not found")
            achievements = get_team_achievements(cur, team_id)
        return response(200, achievements)
    finally:
        release_connection(conn)


def handle_list_metadata(event, team_id):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")
    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
            if not cur.fetchone():
                return not_found("Team not found")
            return response(200, get_team_metadata(cur, team_id))
    finally:
        release_connection(conn)


def handle_create_metadata(event, team_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    meta_key = (body.get("meta_key") or "").strip()
    if not meta_key:
        return bad_request("meta_key is required")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO team_metadata (team_id, meta_key, meta_value)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (team_id, meta_key, body.get("meta_value")),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return server_error("Failed to create metadata")
            metadata = get_team_metadata(cur, team_id)
        return response(201, metadata)
    finally:
        release_connection(conn)


def handle_update_metadata(event, team_id, metadata_id, body):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    updates = []
    params = []
    for field in ["meta_key", "meta_value"]:
        if field in body:
            updates.append(f"{field} = %s")
            params.append(body[field] if body[field] != "" else None)
    if not updates:
        return bad_request("No fields to update")
    params.extend([team_id, metadata_id])

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE team_metadata SET {', '.join(updates)}, updated_at = NOW() WHERE team_id = %s AND id = %s RETURNING id",
                params,
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Metadata record not found")
            metadata = get_team_metadata(cur, team_id)
        return response(200, metadata)
    finally:
        release_connection(conn)


def handle_delete_metadata(event, team_id, metadata_id):
    user, err = require_roles(event, ["admin"])
    if err:
        return err

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM team_metadata WHERE team_id = %s AND id = %s RETURNING id",
                (team_id, metadata_id),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                return not_found("Metadata record not found")
            metadata = get_team_metadata(cur, team_id)
        return response(200, metadata)
    finally:
        release_connection(conn)


_db_initialized = False


def handler(event=None, context=None):
    global _db_initialized
    if not _db_initialized:
        try:
            init_db()
            _db_initialized = True
        except Exception as e:
            logger.error("DB init failed: %s", e)
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

        parts = [part for part in path.split("/") if part]
        team_id = int(parts[0]) if parts and parts[0].isdigit() else None

        if not team_id:
            if method == "GET":
                return handle_list(event)
            if method == "POST":
                return handle_create(event, body)
            return not_found("Endpoint not found")

        if len(parts) == 1:
            if method == "GET":
                return handle_get_one(event, team_id)
            if method == "PUT":
                return handle_update(event, team_id, body)
            if method == "DELETE":
                return handle_delete(event, team_id)
            return not_found("Endpoint not found")

        resource = parts[1]
        if resource == "members":
            if len(parts) == 2:
                if method == "GET":
                    return handle_list_members(event, team_id)
                if method == "POST":
                    return handle_add_member(event, team_id, body)
            if len(parts) == 3 and parts[2].isdigit():
                employee_id = int(parts[2])
                if method == "PUT":
                    return handle_update_member(event, team_id, employee_id, body)
                if method == "DELETE":
                    return handle_remove_member(event, team_id, employee_id)

        if resource == "achievements":
            if len(parts) == 2:
                if method == "GET":
                    return handle_list_achievements(event, team_id)
                if method == "POST":
                    return handle_create_achievement(event, team_id, body)
            if len(parts) == 3 and parts[2].isdigit():
                achievement_id = int(parts[2])
                if method == "PUT":
                    return handle_update_achievement(event, team_id, achievement_id, body)
                if method == "DELETE":
                    return handle_delete_achievement(event, team_id, achievement_id)

        if resource == "metadata":
            if len(parts) == 2:
                if method == "GET":
                    return handle_list_metadata(event, team_id)
                if method == "POST":
                    return handle_create_metadata(event, team_id, body)
            if len(parts) == 3 and parts[2].isdigit():
                metadata_id = int(parts[2])
                if method == "PUT":
                    return handle_update_metadata(event, team_id, metadata_id, body)
                if method == "DELETE":
                    return handle_delete_metadata(event, team_id, metadata_id)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
