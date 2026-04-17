"""
Analytics Service: Aggregates metrics to answer key business questions.
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

def handle_skill_gaps(user):
    conn = get_db_connection(PG_CONFIG)
    query = """
        SELECT e.id, e.name, e.department, c.name as competency, 
               ec.current_level, ec.target_level
        FROM employee_competencies ec
        JOIN competencies c ON c.id = ec.competency_id
        JOIN employees e ON e.id = ec.employee_id
        WHERE ec.current_level < ec.target_level
          AND e.status = 'active'
    """
    args = []
    if user["role"] == "manager":
        query += " AND e.manager_id = %s"
        args.append(user["sub"])
    query += " ORDER BY e.department, e.name"
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        keys = ["employee_id", "employee_name", "department", "competency", "current_level", "target_level"]
        return response(200, [dict(zip(keys, r)) for r in rows])
    finally:
        release_connection(conn)

def handle_high_potentials(user):
    conn = get_db_connection(PG_CONFIG)
    # High potential: avg rating >= 4.0 OR goals avg progress > 80%
    query = """
        SELECT e.id, e.name, e.department, e.job_title,
               COALESCE(AVG(pr.rating), 0) as avg_rating,
               COALESCE(AVG(g.progress), 0) as avg_goal_progress
        FROM employees e
        LEFT JOIN performance_reviews pr ON pr.employee_id = e.id
        LEFT JOIN goals g ON g.employee_id = e.id
        WHERE e.status = 'active'
    """
    args = []
    if user["role"] == "manager":
        query += " AND e.manager_id = %s"
        args.append(user["sub"])
    
    query += """
        GROUP BY e.id, e.name, e.department, e.job_title
        HAVING COALESCE(AVG(pr.rating), 0) >= 4.0 OR COALESCE(AVG(g.progress), 0) >= 80
        ORDER BY avg_rating DESC
    """
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        keys = ["employee_id", "employee_name", "department", "job_title", "avg_rating", "avg_goal_progress"]
        # Convert Decimals to float for JSON
        def safe_float(v):
            if v is None: return 0.0
            try: return float(v)
            except: return 0.0

        res = []
        for r in rows:
            d = dict(zip(keys, r))
            d["avg_rating"] = safe_float(d["avg_rating"])
            d["avg_goal_progress"] = safe_float(d["avg_goal_progress"])
            res.append(d)
        return response(200, res)
    finally:
        release_connection(conn)

def handle_attrition_risks(user):
    conn = get_db_connection(PG_CONFIG)
    # Attrition risk: recent review rating < 3.0
    query = """
        SELECT DISTINCT e.id, e.name, e.department, pr.rating, pr.period, pr.year
        FROM employees e
        JOIN performance_reviews pr ON pr.employee_id = e.id
        WHERE pr.rating < 3.0 AND e.status = 'active'
    """
    args = []
    if user["role"] == "manager":
        query += " AND e.manager_id = %s"
        args.append(user["sub"])
    query += " ORDER BY pr.year DESC, pr.period DESC"
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        keys = ["employee_id", "employee_name", "department", "rating", "period", "year"]
        def safe_float(v):
            if v is None: return 0.0
            try: return float(v)
            except: return 0.0

        res = []
        for r in rows:
            d = dict(zip(keys, r))
            d["rating"] = safe_float(d["rating"])
            res.append(d)
        return response(200, res)
    finally:
        release_connection(conn)

def handle_skills_distribution(user):
    conn = get_db_connection(PG_CONFIG)
    query = """
        SELECT c.category, c.name, AVG(ec.current_level) as avg_level, COUNT(ec.id) as assessment_count
        FROM competencies c
        JOIN employee_competencies ec ON ec.competency_id = c.id
        JOIN employees e ON e.id = ec.employee_id
        WHERE e.status = 'active'
    """
    args = []
    if user["role"] == "manager":
        query += " AND e.manager_id = %s"
        args.append(user["sub"])
    query += " GROUP BY c.category, c.name ORDER BY c.category, c.name"
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        keys = ["category", "competency_name", "avg_level", "assessment_count"]
        def safe_float(v):
            if v is None: return 0.0
            try: return float(v)
            except: return 0.0

        res = []
        for r in rows:
            d = dict(zip(keys, r))
            d["avg_level"] = safe_float(d["avg_level"])
            res.append(d)
        return response(200, res)
    finally:
        release_connection(conn)


def handle_team_summary(user):
    conn = get_db_connection(PG_CONFIG)
    query = """
        WITH filtered_teams AS (
            SELECT t.id, t.name, t.primary_location, t.leader_employee_id, t.owner_user_id, t.org_leader_employee_id
            FROM teams t
            WHERE 1 = 1
    """
    args = []
    if user["role"] == "manager":
        query += " AND t.owner_user_id = %s"
        args.append(user["sub"])
    query += """
        ),
        team_member_stats AS (
            SELECT
                ft.id AS team_id,
                COUNT(tm.employee_id) AS member_count,
                SUM(CASE WHEN tm.direct_staff = FALSE THEN 1 ELSE 0 END) AS non_direct_count,
                MAX(CASE WHEN tm.employee_id = ft.leader_employee_id AND tm.direct_staff = FALSE THEN 1 ELSE 0 END) AS leader_non_direct,
                MAX(CASE WHEN tm.employee_id <> ft.leader_employee_id AND COALESCE(e.location, '') = COALESCE(leader.location, '') THEN 1 ELSE 0 END) AS leader_has_colocated_member
            FROM filtered_teams ft
            LEFT JOIN team_members tm ON tm.team_id = ft.id
            LEFT JOIN employees e ON e.id = tm.employee_id
            LEFT JOIN employees leader ON leader.id = ft.leader_employee_id
            GROUP BY ft.id
        )
        SELECT
            COUNT(ft.id) AS total_teams,
            SUM(CASE WHEN COALESCE(tms.leader_has_colocated_member, 0) = 0 THEN 1 ELSE 0 END) AS leader_not_colocated_count,
            SUM(CASE WHEN COALESCE(tms.leader_non_direct, 0) = 1 THEN 1 ELSE 0 END) AS leader_non_direct_count,
            SUM(
                CASE
                    WHEN COALESCE(tms.member_count, 0) > 0
                     AND (COALESCE(tms.non_direct_count, 0)::decimal / tms.member_count) > 0.20
                    THEN 1 ELSE 0
                END
            ) AS non_direct_ratio_above_twenty_count,
            SUM(CASE WHEN ft.org_leader_employee_id IS NOT NULL THEN 1 ELSE 0 END) AS reporting_to_org_leader_count
        FROM filtered_teams ft
        LEFT JOIN team_member_stats tms ON tms.team_id = ft.id
    """
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            row = cur.fetchone()
        keys = [
            "total_teams",
            "leader_not_colocated_count",
            "leader_non_direct_count",
            "non_direct_ratio_above_twenty_count",
            "reporting_to_org_leader_count",
        ]
        return response(200, dict(zip(keys, row)))
    finally:
        release_connection(conn)


def handle_teams_overview(user):
    conn = get_db_connection(PG_CONFIG)
    query = """
        SELECT
            t.id,
            t.name,
            t.primary_location,
            leader.name AS leader_name,
            org_leader.name AS org_leader_name,
            COUNT(DISTINCT tm.employee_id) AS member_count,
            STRING_AGG(DISTINCT COALESCE(e.location, 'Unknown'), ', ' ORDER BY COALESCE(e.location, 'Unknown')) AS member_locations
        FROM teams t
        LEFT JOIN employees leader ON leader.id = t.leader_employee_id
        LEFT JOIN employees org_leader ON org_leader.id = t.org_leader_employee_id
        LEFT JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN employees e ON e.id = tm.employee_id
        WHERE 1 = 1
    """
    args = []
    if user["role"] == "manager":
        query += " AND t.owner_user_id = %s"
        args.append(user["sub"])
    query += """
        GROUP BY t.id, leader.name, org_leader.name
        ORDER BY t.name
    """

    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()

            overview = []
            for row in rows:
                team_id, name, primary_location, leader_name, org_leader_name, member_count, member_locations = row
                cur.execute(
                    """
                    SELECT title, achievement_month, impact_metric
                    FROM team_achievements
                    WHERE team_id = %s
                    ORDER BY achievement_month DESC, created_at DESC
                    LIMIT 3
                    """,
                    (team_id,),
                )
                achievements = [
                    {
                        "title": achievement_row[0],
                        "achievement_month": achievement_row[1],
                        "impact_metric": achievement_row[2],
                    }
                    for achievement_row in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT e.name, e.location
                    FROM team_members tm
                    JOIN employees e ON e.id = tm.employee_id
                    WHERE tm.team_id = %s
                    ORDER BY tm.is_team_lead DESC, e.name
                    """,
                    (team_id,),
                )
                members = [
                    {"name": member_row[0], "location": member_row[1]}
                    for member_row in cur.fetchall()
                ]
                overview.append(
                    {
                        "team_id": team_id,
                        "team_name": name,
                        "primary_location": primary_location,
                        "leader_name": leader_name,
                        "org_leader_name": org_leader_name,
                        "member_count": member_count,
                        "member_locations": member_locations.split(", ") if member_locations else [],
                        "members": members,
                        "recent_achievements": achievements,
                    }
                )
        return response(200, overview)
    finally:
        release_connection(conn)

def handler(event=None, context=None):
    event = event or {}
    method = (event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "GET")).upper()
    path = event.get("path") or event.get("rawPath") or "/"
    path = path.rstrip("/")

    if method == "OPTIONS":
        return response(200, {})

    try:
        user = get_current_user(event)
        if not user:
            return unauthorized("Authentication required")

        if method == "GET" and path.endswith("/skill-gaps"):
            return handle_skill_gaps(user)
        if method == "GET" and path.endswith("/high-potentials"):
            return handle_high_potentials(user)
        if method == "GET" and path.endswith("/attrition-risks"):
            return handle_attrition_risks(user)
        if method == "GET" and path.endswith("/distribution/skills"):
            return handle_skills_distribution(user)
        if method == "GET" and path.endswith("/team-summary"):
            return handle_team_summary(user)
        if method == "GET" and path.endswith("/teams-overview"):
            return handle_teams_overview(user)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
