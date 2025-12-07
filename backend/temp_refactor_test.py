from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

payload = {
    "code": """data adeff;\nset sdtm.ex;\nwhere usubjid ne '';\nchg = aval - baseline;\nrun;""",
    "language": "SAS"
}

resp = client.post("/api/v1/code-refactorer/analyze", json=payload)
print("status", resp.status_code)
print("body", resp.text[:800])
