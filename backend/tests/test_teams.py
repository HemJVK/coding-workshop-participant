import json
import pytest
from test_utils import load_module

teams_module = load_module("teams-service", "function")
auth_jwt = load_module("auth-service", "function")


@pytest.fixture
def teams_mock_db(mocker):
    mock_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    mocker.patch.object(teams_module, "get_db_connection", return_value=mock_conn)
    mocker.patch.object(teams_module, "release_connection")

    teams_module._db_initialized = True
    return mock_conn, mock_cursor


def test_list_teams(teams_mock_db):
    _, cur = teams_mock_db
    token = auth_jwt.create_token(1, "admin@acme.com", "admin", "Admin User")
    cur.fetchall.return_value = [
        (1, "Platform Engineering", "Core platform team", "engineering", "active", "New York", 2, "Bob Smith", 3, 1, "Alice Johnson", 3, 2),
    ]

    event = {
        "httpMethod": "GET",
        "path": "/teams-service",
        "headers": {"Authorization": f"Bearer {token}"},
    }

    resp = teams_module.handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert len(body) == 1
    assert body[0]["name"] == "Platform Engineering"


def test_create_team_admin_allowed(teams_mock_db):
    _, cur = teams_mock_db
    token = auth_jwt.create_token(1, "admin@acme.com", "admin", "Admin User")
    cur.fetchone.side_effect = [
        None,
        (9,),
        (9, "Data Operations", "Data team", "operations", "active", "Boston", 6, "Frank Miller", 1, 1, "Alice Johnson", 2, 1),
    ]
    cur.fetchall.side_effect = [
        [],
        [],
        [],
    ]

    event = {
        "httpMethod": "POST",
        "path": "/teams-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({"name": "Data Operations", "description": "Data team", "team_type": "operations"}),
    }

    resp = teams_module.handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["name"] == "Data Operations"


def test_create_team_hr_forbidden(teams_mock_db):
    token = auth_jwt.create_token(2, "hr@acme.com", "hr", "HR User")

    event = {
        "httpMethod": "POST",
        "path": "/teams-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({"name": "People Ops"}),
    }

    resp = teams_module.handler(event, None)
    assert resp["statusCode"] == 403
