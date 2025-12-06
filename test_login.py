"""
Test script to verify backend authentication
"""
import requests
import json

# Backend URL
BASE_URL = "http://localhost:8000"

def test_login(username: str, password: str):
    """Test login endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing login for: {username}")
    print(f"{'='*60}")

    # Login endpoint
    login_url = f"{BASE_URL}/api/v1/auth/login"

    # Login data (OAuth2 format)
    login_data = {
        "username": username,
        "password": password,
    }

    try:
        # Send POST request
        print(f"\n1. Sending login request to: {login_url}")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password)}")

        response = requests.post(
            login_url,
            data=login_data,  # OAuth2 uses form data, not JSON
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout=10
        )

        print(f"\n2. Response Status Code: {response.status_code}")

        if response.status_code == 200:
            print(f"   [SUCCESS] LOGIN SUCCESSFUL!")

            # Parse response
            result = response.json()
            print(f"\n3. Response Data:")
            print(f"   Token Type: {result.get('token_type')}")
            print(f"   Access Token: {result.get('access_token')[:50]}...")
            print(f"   User Info:")
            user_info = result.get('user', {})
            for key, value in user_info.items():
                print(f"      {key}: {value}")

            # Test token by accessing /me endpoint
            print(f"\n4. Testing token with /me endpoint...")
            me_url = f"{BASE_URL}/api/v1/auth/me"
            me_response = requests.get(
                me_url,
                headers={
                    "Authorization": f"Bearer {result.get('access_token')}"
                },
                timeout=10
            )

            if me_response.status_code == 200:
                print(f"   [SUCCESS] Token is valid!")
                me_data = me_response.json()
                print(f"   Current user: {me_data.get('username')} ({me_data.get('role')})")
            else:
                print(f"   [FAILED] Token validation failed: {me_response.status_code}")
                print(f"   Response: {me_response.text}")

        elif response.status_code == 401:
            print(f"   [FAILED] LOGIN FAILED: Invalid credentials")
            print(f"   Response: {response.text}")

        else:
            print(f"   [ERROR] UNEXPECTED ERROR: {response.status_code}")
            print(f"   Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print(f"   [ERROR] CONNECTION ERROR: Cannot connect to backend at {BASE_URL}")
        print(f"   Make sure the backend is running!")

    except requests.exceptions.Timeout:
        print(f"   [ERROR] TIMEOUT: Request took too long")

    except Exception as e:
        print(f"   [ERROR] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


def test_password_verification():
    """Test password verification directly"""
    print(f"\n{'='*60}")
    print(f"Testing Password Verification (Direct)")
    print(f"{'='*60}")

    try:
        # Import the auth module
        import sys
        sys.path.insert(0, 'backend')

        from app.core.auth import verify_password, USERS_DB

        # Test each user
        for username, user_data in USERS_DB.items():
            hashed_password = user_data['hashed_password']

            print(f"\nTesting: {username}")
            print(f"  Hash: {hashed_password[:60]}...")

            # Test with correct password
            result = verify_password("admin", hashed_password)
            status = "[PASS]" if result else "[FAIL]"
            print(f"  Verify 'admin': {result} {status}")

    except ImportError as e:
        print(f"[ERROR] Cannot import auth module: {e}")
        print(f"Make sure you're running this from the project root")

    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("ADAM AI - Authentication Test Script")
    print("="*60)

    # Test password verification first
    test_password_verification()

    # Test login endpoints
    test_login("admin", "admin")
    test_login("developer", "admin")
    test_login("user", "admin")

    # Test with wrong password
    print(f"\n{'='*60}")
    print("Testing with WRONG password (should fail)")
    print(f"{'='*60}")
    test_login("admin", "wrongpassword")

    print("\n" + "="*60)
    print("Test Complete!")
    print("="*60 + "\n")
