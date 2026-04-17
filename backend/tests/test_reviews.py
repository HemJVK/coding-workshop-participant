import json
import pytest
from test_utils import load_module

reviews_module = load_module("reviews-service", "function")
auth_jwt = load_module("auth-service", "function")


@pytest.fixture
def reviews_mock_db(mocker):
    mock_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    mocker.patch.object(reviews_module, "get_db_connection", return_value=mock_conn)
    mocker.patch.object(reviews_module, "release_connection")

    reviews_module._db_initialized = True
    return mock_conn, mock_cursor


def test_create_review_hr_forbidden(reviews_mock_db):
    token = auth_jwt.create_token(1, "hr@acme.com", "hr", "HR User")

    event = {
        "httpMethod": "POST",
        "path": "/reviews-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({"employee_id": 2, "period": "Annual", "rating": 4})
    }

    resp = reviews_module.handler(event, None)
    assert resp["statusCode"] == 403


def test_create_review_manager_allowed_for_direct_report(reviews_mock_db):
    conn, cur = reviews_mock_db
    token = auth_jwt.create_token(3, "manager@acme.com", "manager", "Manager User")

    cur.fetchone.side_effect = [
        (3,),
        (11, 2, 3, "Annual", 2024, 4.0, None, None, None, "draft", "2024-01-01", "2024-01-01"),
    ]

    event = {
        "httpMethod": "POST",
        "path": "/reviews-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({"employee_id": 2, "period": "Annual", "rating": 4})
    }

    resp = reviews_module.handler(event, None)
    assert resp["statusCode"] == 201
