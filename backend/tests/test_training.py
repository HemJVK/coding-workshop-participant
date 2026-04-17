import json
import pytest
from test_utils import load_module

training_module = load_module("training-service", "function")
auth_module = load_module("auth-service", "function")


@pytest.fixture
def training_mock_db(mocker):
    mock_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    mocker.patch.object(training_module, "get_db_connection", return_value=mock_conn)
    mocker.patch.object(training_module, "release_connection")
    mocker.patch.object(training_module, "_db_initialized", True)

    return mock_conn, mock_cursor


def test_create_completed_training_updates_competencies(training_mock_db):
    _, cur = training_mock_db
    token = auth_module.create_token(1, "admin@acme.com", "admin", "Admin User")

    cur.fetchone.side_effect = [
        (11, 5, "Python for Data Science", "Coursera", "online", None),
        (3, 4, "2026-04-17T10:00:00Z"),
        (5, 5, "2026-04-17T10:00:00Z"),
        (11, 5, "Python for Data Science", "Coursera", "online", None, None, "2026-04-17", 30, "completed", None, None, "2026-04-17T10:00:00Z", "2026-04-17T10:00:00Z"),
    ]
    cur.fetchall.return_value = [
        ("Python", 1, 1, 2, 4),
        ("Data Analysis", 1, 9, 4, 5),
    ]

    event = {
        "httpMethod": "POST",
        "path": "/training-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({
            "employee_id": 5,
            "course_name": "Python for Data Science",
            "provider": "Coursera",
            "status": "completed",
            "completion_date": "2026-04-17",
            "hours": 30,
        }),
    }

    resp = training_module.handler(event, None)
    assert resp["statusCode"] == 201

    body = json.loads(resp["body"])
    assert body["course_name"] == "Python for Data Science"
    assert [update["action"] for update in body["competency_updates"]] == ["increased", "increased"]
    assert [update["competency_name"] for update in body["competency_updates"]] == ["Python", "Data Analysis"]
    assert body["competency_updates"][0]["previous_level"] == 2
    assert body["competency_updates"][0]["current_level"] == 3
    assert body["competency_updates"][1]["current_level"] == 5


def test_transition_to_completed_updates_competencies_once(training_mock_db):
    conn, cur = training_mock_db
    token = auth_module.create_token(1, "admin@acme.com", "admin", "Admin User")

    lookup_cursor = conn.cursor.return_value
    lookup_cursor.fetchone.return_value = (5, "Docker & Kubernetes Fundamentals", "in_progress", None)

    cur.fetchone.side_effect = [
        (9, 5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online", None),
        (4, 4, "2026-04-17T10:00:00Z"),
        (9, 5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online", None, None, "2026-04-17", 8, "completed", None, None, "2026-04-10T10:00:00Z", "2026-04-17T10:00:00Z"),
    ]
    cur.fetchall.return_value = [
        ("Cloud Architecture", 1, 7, 3, 4),
    ]

    event = {
        "httpMethod": "PUT",
        "path": "/training-service/9",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({
            "status": "completed",
            "completion_date": "2026-04-17",
        }),
    }

    resp = training_module.handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert len(body["competency_updates"]) == 1
    assert body["competency_updates"][0]["competency_name"] == "Cloud Architecture"
    assert body["competency_updates"][0]["current_level"] == 4


def test_completed_training_is_not_double_counted_on_later_updates(training_mock_db):
    conn, cur = training_mock_db
    token = auth_module.create_token(1, "admin@acme.com", "admin", "Admin User")

    lookup_cursor = conn.cursor.return_value
    lookup_cursor.fetchone.return_value = (5, "Docker & Kubernetes Fundamentals", "completed", None)

    cur.fetchone.side_effect = [
        (9, 5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online", None),
        (
            9, 5, "Docker & Kubernetes Fundamentals", "Linux Foundation", "online",
            None, None, "2026-04-17", 8, "completed", None, "certificate added",
            "2026-04-10T10:00:00Z", "2026-04-18T10:00:00Z"
        ),
    ]

    event = {
        "httpMethod": "PUT",
        "path": "/training-service/9",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({
            "notes": "certificate added",
        }),
    }

    resp = training_module.handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["competency_updates"] == []
    assert not any("training_competency_mappings" in call.args[0] for call in cur.execute.call_args_list)


def test_create_completed_training_uses_selected_competency(training_mock_db):
    _, cur = training_mock_db
    token = auth_module.create_token(1, "admin@acme.com", "admin", "Admin User")

    cur.fetchone.side_effect = [
        (15, 5, "Custom Python Coaching", "Internal", "coaching", 1),
        ("Python",),
        ("Python",),
        (3, 4, "2026-04-17T10:00:00Z"),
        (15, 5, "Custom Python Coaching", "Internal", "coaching", 1, "Python", "2026-04-17", 3, "completed", None, None, "2026-04-17T10:00:00Z", "2026-04-17T10:00:00Z"),
    ]
    cur.fetchall.return_value = [
        ("Python", 1, 1, 2, 4),
    ]

    event = {
        "httpMethod": "POST",
        "path": "/training-service",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({
            "employee_id": 5,
            "course_name": "Custom Python Coaching",
            "provider": "Internal",
            "training_type": "coaching",
            "competency_id": 1,
            "status": "completed",
            "completion_date": "2026-04-17",
            "hours": 3,
        }),
    }

    resp = training_module.handler(event, None)
    assert resp["statusCode"] == 201

    body = json.loads(resp["body"])
    assert body["competency_id"] == 1
    assert body["competency_name"] == "Python"
    assert len(body["competency_updates"]) == 1
    assert body["competency_updates"][0]["competency_name"] == "Python"


def test_completed_training_adds_competency_when_updated_later(training_mock_db):
    conn, cur = training_mock_db
    token = auth_module.create_token(1, "admin@acme.com", "admin", "Admin User")

    lookup_cursor = conn.cursor.return_value
    lookup_cursor.fetchone.return_value = (5, "Custom Python Coaching", "completed", None)

    cur.fetchone.side_effect = [
        (15, 5, "Custom Python Coaching", "Internal", "coaching", 1),
        ("Python",),
        ("Python",),
        (3, 4, "2026-04-17T10:00:00Z"),
        (15, 5, "Custom Python Coaching", "Internal", "coaching", 1, "Python", "2026-04-17", 3, "completed", None, None, "2026-04-10T10:00:00Z", "2026-04-17T10:00:00Z"),
    ]
    cur.fetchall.return_value = [
        ("Python", 1, 1, 2, 4),
    ]

    event = {
        "httpMethod": "PUT",
        "path": "/training-service/15",
        "headers": {"Authorization": f"Bearer {token}"},
        "body": json.dumps({
            "competency_id": 1,
        }),
    }

    resp = training_module.handler(event, None)
    assert resp["statusCode"] == 200

    body = json.loads(resp["body"])
    assert body["competency_id"] == 1
    assert len(body["competency_updates"]) == 1
    assert body["competency_updates"][0]["competency_name"] == "Python"
