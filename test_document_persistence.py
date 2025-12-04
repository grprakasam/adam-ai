"""
Test script to verify document persistence across sessions
Tests:
1. Upload a document
2. Verify it's stored in database
3. Retrieve it in a "new session" (new API call)
4. Verify all metadata is correct
"""
import requests
import json
import time
from datetime import datetime
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8002"
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin"

# Test file
TEST_FILE_PATH = Path("test_document.txt")
TEST_STUDY_ID = None  # Will be set after creating a study
ACCESS_TOKEN = None

def create_test_file():
    """Create a test document file"""
    content = f"Test Document Content\nCreated at: {datetime.now().isoformat()}\nThis is a test document for persistence testing."
    TEST_FILE_PATH.write_text(content)
    print(f"✓ Created test file: {TEST_FILE_PATH}")
    return TEST_FILE_PATH

def login():
    """Login and get access token"""
    global ACCESS_TOKEN
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }
    )
    if response.status_code == 200:
        ACCESS_TOKEN = response.json()["access_token"]
        print(f"✓ Logged in successfully")
        return True
    else:
        print(f"✗ Login failed: {response.status_code} - {response.text}")
        return False

def get_headers():
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

def create_test_study():
    """Create a test study"""
    global TEST_STUDY_ID
    study_data = {
        "name": f"Document Persistence Test Study - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "protocol_number": "TEST-PROTO-001",
        "sponsor": "Test Sponsor",
        "therapeutic_area": "Oncology",
        "phase": "Phase II",
        "description": "Test study for document persistence",
        "sdtm_version": "SDTM v2.0",
        "adam_ig_version": "ADaM IG v1.3",
        "meddra_version": "MedDRA v27.1"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/studies",
        json=study_data,
        headers=get_headers()
    )
    
    if response.status_code == 201:
        TEST_STUDY_ID = response.json()["id"]
        print(f"✓ Created test study: {TEST_STUDY_ID}")
        return True
    else:
        print(f"✗ Failed to create study: {response.status_code} - {response.text}")
        return False

def upload_document(file_path: Path):
    """Upload a document"""
    with open(file_path, 'rb') as f:
        files = {'file': (file_path.name, f, 'text/plain')}
        data = {
            'document_type': 'SPECIFICATION',  # Valid types: SPECIFICATION, SAP, PROTOCOL, ADAM_SPEC, etc.
            'description': 'Test document for persistence testing'
        }
        
        headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v1/studies/{TEST_STUDY_ID}/documents",
            files=files,
            data=data,
            headers=headers
        )
        
        if response.status_code == 201:
            doc = response.json()
            print(f"✓ Document uploaded successfully")
            print(f"  Document ID: {doc['id']}")
            print(f"  File name: {doc['original_file_name']}")
            print(f"  Upload date: {doc['uploaded_at']}")
            print(f"  Size: {doc.get('size_bytes', 0)} bytes")
            return doc
        else:
            print(f"✗ Failed to upload document: {response.status_code} - {response.text}")
            return None

def list_documents():
    """List all documents for the study"""
    response = requests.get(
        f"{BASE_URL}/api/v1/studies/{TEST_STUDY_ID}/documents",
        headers=get_headers(),
        params={"active_only": True}
    )
    
    if response.status_code == 200:
        documents = response.json()
        print(f"✓ Retrieved {len(documents)} documents")
        return documents
    else:
        print(f"✗ Failed to list documents: {response.status_code} - {response.text}")
        return []

def verify_document_persistence(uploaded_doc):
    """Verify document persists across 'sessions'"""
    print("\n" + "="*60)
    print("TESTING DOCUMENT PERSISTENCE ACROSS SESSIONS")
    print("="*60)
    
    # Simulate a new session by waiting and re-querying
    print("\n[Simulating new session - waiting 2 seconds...]")
    time.sleep(2)
    
    # Get documents again (simulating a new session)
    documents = list_documents()
    
    if not documents:
        print("✗ FAILED: No documents found in new session")
        return False
    
    # Find the uploaded document
    found_doc = None
    for doc in documents:
        if doc['id'] == uploaded_doc['id']:
            found_doc = doc
            break
    
    if not found_doc:
        print("✗ FAILED: Uploaded document not found in new session")
        return False
    
    print(f"\n✓ Document found in new session!")
    print(f"  Document ID: {found_doc['id']}")
    print(f"  Original file name: {found_doc['original_file_name']}")
    print(f"  Storage path: {found_doc['storage_path']}")
    print(f"  Upload date: {found_doc['uploaded_at']}")
    print(f"  Size: {found_doc.get('size_bytes', 0)} bytes")
    print(f"  Status: {found_doc.get('processing_status', 'unknown')}")
    print(f"  Download URL: {found_doc.get('storage_url', 'N/A')}")
    
    # Verify metadata matches
    checks_passed = 0
    total_checks = 5
    
    if found_doc['id'] == uploaded_doc['id']:
        checks_passed += 1
        print("  ✓ Document ID matches")
    else:
        print("  ✗ Document ID mismatch")
    
    if found_doc['original_file_name'] == uploaded_doc['original_file_name']:
        checks_passed += 1
        print("  ✓ File name matches")
    else:
        print("  ✗ File name mismatch")
    
    if found_doc.get('size_bytes') == uploaded_doc.get('size_bytes'):
        checks_passed += 1
        print("  ✓ File size matches")
    else:
        print("  ✗ File size mismatch")
    
    if found_doc.get('uploaded_at') == uploaded_doc.get('uploaded_at'):
        checks_passed += 1
        print("  ✓ Upload date matches")
    else:
        print("  ✗ Upload date mismatch")
    
    if found_doc.get('storage_url'):
        checks_passed += 1
        print("  ✓ Download URL is present")
    else:
        print("  ✗ Download URL is missing")
    
    print(f"\n[Verification Results: {checks_passed}/{total_checks} checks passed]")
    
    return checks_passed == total_checks

def test_download(doc_id):
    """Test document download"""
    print("\n" + "="*60)
    print("TESTING DOCUMENT DOWNLOAD")
    print("="*60)
    
    response = requests.get(
        f"{BASE_URL}/api/v1/studies/{TEST_STUDY_ID}/documents/{doc_id}/download",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        print(f"✓ Document download successful")
        print(f"  Content length: {len(response.content)} bytes")
        print(f"  Content type: {response.headers.get('content-type', 'unknown')}")
        return True
    else:
        print(f"✗ Document download failed: {response.status_code} - {response.text}")
        return False

def cleanup():
    """Cleanup test files"""
    if TEST_FILE_PATH.exists():
        TEST_FILE_PATH.unlink()
        print(f"✓ Cleaned up test file")

def main():
    """Run all tests"""
    print("="*60)
    print("DOCUMENT PERSISTENCE TEST SUITE")
    print("="*60)
    print(f"Test started at: {datetime.now().isoformat()}\n")
    
    try:
        # Setup
        test_file = create_test_file()
        
        if not login():
            print("\n✗ TEST FAILED: Could not login")
            return False
        
        if not create_test_study():
            print("\n✗ TEST FAILED: Could not create test study")
            return False
        
        # Test 1: Upload document
        print("\n" + "="*60)
        print("TEST 1: UPLOAD DOCUMENT")
        print("="*60)
        uploaded_doc = upload_document(test_file)
        if not uploaded_doc:
            print("\n✗ TEST FAILED: Document upload failed")
            return False
        
        # Test 2: Verify persistence
        persistence_ok = verify_document_persistence(uploaded_doc)
        
        # Test 3: Test download
        download_ok = test_download(uploaded_doc['id'])
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Document Upload: {'✓ PASSED' if uploaded_doc else '✗ FAILED'}")
        print(f"Persistence Test: {'✓ PASSED' if persistence_ok else '✗ FAILED'}")
        print(f"Download Test: {'✓ PASSED' if download_ok else '✗ FAILED'}")
        
        all_passed = uploaded_doc and persistence_ok and download_ok
        print(f"\nOverall Result: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}")
        print(f"Test completed at: {datetime.now().isoformat()}")
        
        return all_passed
        
    except Exception as e:
        print(f"\n✗ TEST ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cleanup()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

