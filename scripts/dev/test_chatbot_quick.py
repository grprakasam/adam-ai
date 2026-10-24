from pathlib import Path
"""Quick test for Study Chatbot"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1/study-chatbot"

print("=== Quick Study Chatbot Test ===\n")

# Step 1: Upload
print("1. Uploading test_protocol.txt...")
with open(Path(__file__).with_name('test_protocol.txt'), 'rb') as f:
    files = {'files': ('test_protocol.txt', f, 'text/plain')}
    response = requests.post(f"{BASE_URL}/upload", files=files, timeout=10)

if response.status_code != 200:
    print(f"[FAIL] Upload failed: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
session_id = data['session_id']
print(f"[PASS] Uploaded. Session: {session_id}")

# Step 2: Create KB
print("\n2. Creating knowledge base...")
kb_request = {
    "session_id": session_id,
    "file_paths": [file['path'] for file in data['files']]
}

response = requests.post(f"{BASE_URL}/knowledge-base", json=kb_request, timeout=30)

if response.status_code != 200:
    print(f"[FAIL] KB creation failed: {response.status_code}")
    print(response.text)
    exit(1)

kb_data = response.json()

if kb_data['status'] != 'success':
    print(f"[FAIL] KB status: {kb_data.get('error_message', 'Unknown error')}")
    exit(1)

print(f"[PASS] KB created! Files: {kb_data['files_processed']}, Time: {kb_data['processing_time_ms']}ms")

# Step 3: Test chat
print("\n3. Testing chat...")
chat_request = {
    "session_id": session_id,
    "message": "What is the primary endpoint?",
    "response_style": "concise",
    "show_sources": True
}

print(f"   Asking: {chat_request['message']}")
response = requests.post(f"{BASE_URL}/chat", json=chat_request, timeout=60)

print(f"   Status code: {response.status_code}")

if response.status_code == 200:
    chat_data = response.json()
    print(f"   [PASS] Answer: {chat_data['response'][:150]}...")
    print(f"   Grounding: {int(chat_data.get('grounding_score', 0)*100)}%")
    if chat_data.get('sources'):
        print(f"   Sources: {len(chat_data['sources'])} citations")
else:
    print(f"   [FAIL] Chat error:")
    print(f"   {response.text}")
    exit(1)

print("\n[SUCCESS] Test completed!")
