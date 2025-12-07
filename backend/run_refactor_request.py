import requests

url = "http://localhost:8000/api/v1/code-refactorer/analyze"

payload = {
    "code": """data adeff;
set sdtm.ex;
where usubjid ne '';
chg = aval - baseline;
run;""",
    "language": "SAS"
}

print("Sending request to", url)
resp = requests.post(url, json=payload, timeout=120)
print("status", resp.status_code)
print("response body (first 1200 chars):\n", resp.text[:1200])
