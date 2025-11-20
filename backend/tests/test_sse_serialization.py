import json
from datetime import datetime
from fastapi.encoders import jsonable_encoder


def test_jsonable_encoder_handles_datetime():
    payload = {
        "status": "success",
        "data": {
            "metadata": {
                "generated_at": datetime.utcnow(),
                "llm_provider": "gemini",
                "model_used": "gemini-2.0-flash-exp",
                "execution_mode": "api",
            }
        }
    }

    # Should not raise TypeError: Object of type datetime is not JSON serializable
    encoded = jsonable_encoder(payload)
    dumped = json.dumps(encoded)
    assert isinstance(dumped, str)
