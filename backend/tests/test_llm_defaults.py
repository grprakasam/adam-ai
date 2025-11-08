import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_llm_defaults_endpoint(monkeypatch, client):
    # Mock llm_service.get_provider_info to return deterministic info
    async def mock_get_provider_info():
        return {
            "google": {"model": "gemini-2.5-flash", "available": True},
            "openai": {"model": "gpt-4", "available": False}
        }

    # Import the llm_service and monkeypatch
    from app.modules.llm_integration import service

    monkeypatch.setattr(service.llm_service, "get_provider_info", mock_get_provider_info)

    response = client.get("/api/v1/llm/defaults")
    assert response.status_code == 200
    data = response.json()
    assert "default_provider" in data
    assert "default_model" in data
    assert data["available_providers"]["google"]["available"] is True
    assert data["available_providers"]["google"]["model"] == "gemini-2.5-flash"
