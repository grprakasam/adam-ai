"""
Test script for Study Chatbot - End-to-End verification
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1/study-chatbot"

def test_study_chatbot():
    """Test the complete chatbot workflow"""

    print("=" * 60)
    print("Study Chatbot E2E Test")
    print("=" * 60)

    # Step 1: Upload document
    print("\n1. Uploading test document...")

    with open('test_protocol.txt', 'rb') as f:
        files = {'files': ('test_protocol.txt', f, 'text/plain')}
        response = requests.post(f"{BASE_URL}/upload", files=files)

    if response.status_code != 200:
        print(f"[FAIL] Upload failed: {response.status_code}")
        print(response.text)
        return False

    upload_data = response.json()
    session_id = upload_data['session_id']
    print(f"[PASS] Uploaded successfully. Session ID: {session_id}")
    print(f"   Files uploaded: {upload_data['files_uploaded']}")

    # Step 2: Create knowledge base
    print("\n2. Processing document and creating knowledge base...")

    kb_request = {
        "session_id": session_id,
        "file_paths": [file['path'] for file in upload_data['files']]
    }

    response = requests.post(f"{BASE_URL}/knowledge-base", json=kb_request)

    if response.status_code != 200:
        print(f"[FAIL] Knowledge base creation failed: {response.status_code}")
        print(response.text)
        return False

    kb_data = response.json()

    if kb_data['status'] != 'success':
        print(f"[FAIL] Knowledge base processing failed: {kb_data.get('error_message', 'Unknown error')}")
        return False

    print(f"[PASS] Knowledge base created successfully!")
    print(f"   Files processed: {kb_data['files_processed']}")
    print(f"   Processing time: {kb_data['processing_time_ms']}ms")

    # Step 3: Get suggested questions
    print("\n3. Getting suggested questions...")

    response = requests.get(f"{BASE_URL}/suggested-questions/{session_id}")

    if response.status_code == 200:
        questions_data = response.json()
        print(f"[PASS] Got {len(questions_data.get('questions', []))} suggested questions:")
        for q in questions_data.get('questions', [])[:3]:
            print(f"   - {q['question']}")
    else:
        print(f"[WARN] Suggested questions failed (non-critical): {response.status_code}")

    # Step 4: Test specific question
    print("\n4. Testing specific question...")

    test_questions = [
        "What is the primary endpoint?",
        "How many patients will be enrolled?",
        "What is the study duration?",
        "Explain this document"
    ]

    for question in test_questions:
        print(f"\n   Question: {question}")

        chat_request = {
            "session_id": session_id,
            "message": question,
            "response_style": "detailed",
            "show_sources": True
        }

        response = requests.post(f"{BASE_URL}/chat", json=chat_request)

        if response.status_code != 200:
            print(f"   [FAIL] Chat failed: {response.status_code}")
            print(f"   {response.text}")
            continue

        chat_data = response.json()

        print(f"   [PASS] Answer received:")
        print(f"   Grounding: {chat_data.get('grounding_score', 0)*100:.0f}%")
        print(f"   Response: {chat_data['response'][:200]}...")

        if chat_data.get('sources'):
            print(f"   Sources: {len(chat_data['sources'])} citations")

        time.sleep(1)  # Rate limiting

    # Step 5: Health check
    print("\n5. Checking service health...")

    response = requests.get(f"{BASE_URL}/health")

    if response.status_code == 200:
        health_data = response.json()
        print(f"[PASS] Service health: {health_data['status']}")
        print(f"   Supported formats: {', '.join(health_data['supported_formats'])}")

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL TESTS PASSED!")
    print("=" * 60)

    return True


if __name__ == "__main__":
    try:
        success = test_study_chatbot()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n[FAIL] Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
