"""Mocked Azure contract test: no credentials, network or paid requests."""
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

@pytest.mark.asyncio
async def test_azure_deployment_routing_and_usage(monkeypatch):
    import openai
    from app.modules.llm_integration import service
    captured = {}
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="adsl <- dm"), finish_reason="stop")],
        model="model-snapshot", usage=SimpleNamespace(prompt_tokens=12, completion_tokens=8, total_tokens=20)
    )
    create = AsyncMock(return_value=response)
    def client(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(openai, "AsyncAzureOpenAI", client)
    monkeypatch.setattr(service.settings, "AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.setattr(service.settings, "AZURE_OPENAI_API_VERSION", "configured-test-version")
    provider = service.AzureOpenAIProvider("test-key", "clinical-deployment")
    result = await provider.generate("Generate an ADaM program")
    assert captured["azure_endpoint"] == "https://example.openai.azure.com"
    assert captured["api_version"] == "configured-test-version"
    assert create.call_args.kwargs["model"] == "clinical-deployment"
    assert result["usage"]["total_tokens"] == 20
    assert result["content"] == "adsl <- dm"
