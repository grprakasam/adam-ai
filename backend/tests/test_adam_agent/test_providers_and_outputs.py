import asyncio
import json

import pandas as pd
import pytest

from app.modules.adam_agent.components import LLMCodeGenerator
from app.modules.adam_agent.dataset_json import to_dataset_json
from app.modules.adam_agent.routing import Route


class FakeBedrockClient:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.requests = response, error, []

    def converse(self, **request):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.response


BEDROCK_RESPONSE = {
    "output": {"message": {"content": [{"text": "```r\nadsl <- dm\n```"}]}},
    "usage": {"inputTokens": 100, "outputTokens": 40, "cacheReadInputTokens": 1200, "cacheWriteInputTokens": 0},
    "stopReason": "end_turn",
}


def test_bedrock_provider_maps_request_and_usage():
    from app.modules.llm_integration.service import BedrockProvider

    client = FakeBedrockClient(BEDROCK_RESPONSE)
    provider = BedrockProvider(
        model="anthropic.claude-sonnet-5-5", region="us-east-1", prompt_caching=True, client=client
    )
    result = asyncio.run(BedrockProvider.generate.__wrapped__(provider, "Derive ADSL", temperature=0.1, max_tokens=500))
    request = client.requests[0]
    assert request["modelId"] == "anthropic.claude-sonnet-5-5"
    assert request["system"][-1] == {"cachePoint": {"type": "default"}}
    assert request["inferenceConfig"] == {"maxTokens": 500, "temperature": 0.1}
    assert result["usage"]["prompt_tokens"] == 1300 and result["usage"]["cache_read_tokens"] == 1200
    assert result["usage"]["completion_tokens"] == 40 and result["finish_reason"] == "end_turn"


def test_bedrock_without_caching_has_no_cache_point():
    from app.modules.llm_integration.service import BedrockProvider

    provider = BedrockProvider(client=FakeBedrockClient(BEDROCK_RESPONSE))
    assert all("cachePoint" not in block for block in provider._request("x", 0.0, 10)["system"])


def test_bedrock_throttling_maps_to_rate_limit():
    from app.modules.llm_integration.service import BedrockProvider, LLMRateLimitError

    class Throttled(Exception):
        response = {"Error": {"Code": "ThrottlingException"}}

    provider = BedrockProvider(client=FakeBedrockClient(error=Throttled("slow down")))
    with pytest.raises(LLMRateLimitError):
        asyncio.run(BedrockProvider.generate.__wrapped__(provider, "x", temperature=0.1, max_tokens=10))


def test_llm_code_generator_extracts_code_and_usage():
    class FakeService:
        def __init__(self):
            self.kwargs = None

        async def generate(self, **kwargs):
            self.kwargs = kwargs
            return {
                "content": "```r\nadsl <- dm\n```",
                "model": "claude-haiku-5-5",
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15, "cache_read_tokens": 3},
            }

    service = FakeService()
    result = asyncio.run(
        LLMCodeGenerator(service=service).generate("p", route=Route("anthropic", "claude-haiku-5-5"), attempt=1)
    )
    assert result.code == "adsl <- dm" and result.cache_read_tokens == 3
    assert service.kwargs["provider"] == "anthropic" and service.kwargs["model"] == "claude-haiku-5-5"


def test_dataset_json_structure(small_spec):
    frame = pd.DataFrame([{"USUBJID": "S1", "AGE": "63", "SAFFL": "Y"}, {"USUBJID": "S2", "AGE": "", "SAFFL": "N"}])
    payload = to_dataset_json(frame, small_spec, study_oid="CDISCPILOT01")
    assert payload["datasetJSONVersion"] == "1.1.0" and payload["records"] == 2
    columns = {c["name"]: c for c in payload["columns"]}
    assert columns["USUBJID"]["keySequence"] == 1 and columns["AGE"]["dataType"] == "double"
    assert payload["rows"] == [["S1", 63, "Y"], ["S2", None, "N"]]
    json.dumps(payload)  # serialisable
