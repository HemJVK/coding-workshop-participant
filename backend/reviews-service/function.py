"""
Performance Reviews Service: CRUD for employee performance reviews.
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

VALID_STATUSES = ["draft", "submitted", "acknowledged"]
VALID_PERIODS = ["Q1", "Q2", "Q3", "Q4", "Annual", "Mid-Year"]


def init_db():
    conn = get_db_connection(PG_CONFIG)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS performance_reviews (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                reviewer_id INTEGER,
                period VARCHAR(50) NOT NULL,
                year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
                rating NUMERIC(3,1) CHECK (rating >= 1 AND rating <= 5),
                comments TEXT,
                strengths TEXT,
                improvements TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("SELECT COUNT(*) FROM performance_reviews;")
        if cur.fetchone()[0] == 0:
            # Seed some sample reviews
            sample = [
                (1, 2, "Annual", 2024, 4.5, "Excellent technical skills, delivered all projects on time.", "Strong problem-solving", "Could improve documentation", "acknowledged"),
                (3, 4, "Annual", 2024, 4.0, "Great product instincts, collaborative.", "Strategic thinking", "Needs to delegate more", "acknowledged"),
                (5, 1, "Q4", 2024, 3.5, "Good progress for a junior engineer.", "Fast learner", "Improve code review quality", "submitted"),
                (2, None, "Mid-Year", 2024, 4.8, "Outstanding contributions to the architecture.", "Technical leadership", "None significant", "acknowledged"),
                (6, None, "Annual", 2024, 4.2, "Exceeded sales targets by 15%.", "Client relationships", "Internal communication", "acknowledged"),
                (7, 4, "Annual", 2024, 3.8, "Solid marketing campaigns.", "Creative thinking", "Data analysis skills", "submitted"),
                (8, 4, "Q3", 2024, 4.0, "Good financial modeling.", "Attention to detail", "Presentation skills", "draft"),
            ]
            for s in sample:
                cur.execute("""
                    INSERT INTO performance_reviews (employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status)
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
    keys = ["id", "employee_id", "reviewer_id", "period", "year", "rating",
            "comments", "strengths", "improvements", "status", "created_at", "updated_at"]
    return dict(zip(keys, row))


def handle_list(event):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")

    params = event.get("queryStringParameters") or {}
    employee_id = params.get("employee_id")
    period = params.get("period")
    status = params.get("status")
    year = params.get("year")

    query = "SELECT id, employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status, created_at, updated_at FROM performance_reviews WHERE 1=1"
    args = []
    if employee_id:
        query += " AND employee_id = %s"; args.append(employee_id)
    if period:
        query += " AND period = %s"; args.append(period)
    if status:
        query += " AND status = %s"; args.append(status)
    if year:
        query += " AND year = %s"; args.append(year)
    query += " ORDER BY created_at DESC"

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall()
        return response(200, [row_to_dict(r) for r in rows])
    finally:
        release_connection(conn)


def handle_get_one(event, review_id):
    user = get_current_user(event)
    if not user:
        return unauthorized("Authentication required")
    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status, created_at, updated_at FROM performance_reviews WHERE id = %s", (review_id,))
            row = cur.fetchone()
        if not row:
            return not_found("Review not found")
        return response(200, row_to_dict(row))
    finally:
        release_connection(conn)


def handle_create(event, body):
    user, err = require_roles(event, ["admin", "manager", "contributor"])
    if err:
        return err
    employee_id = body.get("employee_id")
    period = body.get("period")
    if not employee_id or not period:
        return bad_request("employee_id and period are required")
    rating = body.get("rating")
    if rating is not None:
        try:
            rating = float(rating)
            if not (1 <= rating <= 5):
                return bad_request("Rating must be between 1 and 5")
        except (ValueError, TypeError):
            return bad_request("Invalid rating value")

    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO performance_reviews (employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status, created_at, updated_at
            """, (employee_id, user["sub"], period,
                  body.get("year", 2024), rating,
                  body.get("comments"), body.get("strengths"), body.get("improvements"),
                  body.get("status", "draft")))
            row = cur.fetchone()
            conn.commit()
        return response(201, row_to_dict(row))
    finally:
        release_connection(conn)


def handle_update(event, review_id, body):
    user, err = require_roles(event, ["admin", "manager", "contributor"])
    if err:
        return err
    fields = ["period", "year", "rating", "comments", "strengths", "improvements", "status", "reviewer_id"]
    updates = []
    params = []
    for f in fields:
        if f in body:
            updates.append(f"{f} = %s")
            params.append(body[f])
    if not updates:
        return bad_request("No fields to update")
    params.append(review_id)
    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE performance_reviews SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s RETURNING id, employee_id, reviewer_id, period, year, rating, comments, strengths, improvements, status, created_at, updated_at", params)
            row = cur.fetchone()
            conn.commit()
        if not row:
            return not_found("Review not found")
        return response(200, row_to_dict(row))
    finally:
        release_connection(conn)


def handle_delete(event, review_id):
    user, err = require_roles(event, ["admin"])
    if err:
        return err
    conn = get_db_connection(PG_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM performance_reviews WHERE id = %s RETURNING id", (review_id,))
            row = cur.fetchone()
            conn.commit()
        if not row:
            return not_found("Review not found")
        return response(204, {})
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

        parts = [p for p in path.split("/") if p]
        review_id = None
        if len(parts) >= 2 and parts[-1].isdigit():
            review_id = int(parts[-1])

        if method == "GET" and review_id is None:
            return handle_list(event)
        if method == "GET" and review_id:
            return handle_get_one(event, review_id)
        if method == "POST":
            return handle_create(event, body)
        if method == "PUT" and review_id:
            return handle_update(event, review_id, body)
        if method == "DELETE" and review_id:
            return handle_delete(event, review_id)

        return not_found("Endpoint not found")
    except Exception as e:
        logger.error("Handler error: %s", e, exc_info=True)
        return server_error(str(e))
