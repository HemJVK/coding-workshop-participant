import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main


def test_workshop_token_not_required_locally(monkeypatch):
    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME", raising=False)
    monkeypatch.delenv("IS_LOCAL", raising=False)

    assert main.should_require_workshop_token() is False


def test_workshop_token_required_in_cloud_lambda(monkeypatch):
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "acme-api")
    monkeypatch.setenv("IS_LOCAL", "false")

    assert main.should_require_workshop_token() is True


def test_workshop_token_not_required_in_localstack_lambda(monkeypatch):
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "acme-api")
    monkeypatch.setenv("IS_LOCAL", "true")

    assert main.should_require_workshop_token() is False
