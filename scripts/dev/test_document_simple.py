"""
Simple test to verify document persistence
"""
import requests
import json

BASE_URL = "http://localhost:8002"

# Login
login_resp = requests.post(
    f"{BASE_URL}/api/v1/auth/login",
    data={"username": "admin", "password": "admin"}
)

if login_resp.status_code != 200:
    print(f"Login failed: {login_resp.status_code}")
    exit(1)

token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get studies
studies_resp = requests.get(f"{BASE_URL}/api/v1/studies", headers=headers)
if studies_resp.status_code == 200:
    studies = studies_resp.json()
    print(f"Found {len(studies)} studies")
    
    if studies:
        study_id = studies[0]["id"]
        print(f"Testing with study: {study_id}")
        
        # List documents
        docs_resp = requests.get(
            f"{BASE_URL}/api/v1/studies/{study_id}/documents",
            headers=headers,
            params={"active_only": True}
        )
        
        if docs_resp.status_code == 200:
            docs = docs_resp.json()
            print(f"\n✓ Found {len(docs)} documents:")
            for doc in docs:
                print(f"  - {doc['original_file_name']}")
                print(f"    Uploaded: {doc.get('uploaded_at', 'N/A')}")
                print(f"    Size: {doc.get('size_bytes', 0)} bytes")
                print(f"    Status: {doc.get('processing_status', 'unknown')}")
        else:
            print(f"✗ Failed to list documents: {docs_resp.status_code}")
            print(docs_resp.text)
    else:
        print("No studies found")
else:
    print(f"Failed to get studies: {studies_resp.status_code}")

