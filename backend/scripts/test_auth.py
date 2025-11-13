"""
Test script for authentication endpoints
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_login():
    """Test login endpoint"""
    print("\n=== Testing Login ===")
    
    # Test with admin credentials
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": "admin",
            "password": "admin"
        }
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        data = response.json()
        token = data['access_token']
        print(f"\n✅ Login successful! Token: {token[:50]}...")
        return token
    else:
        print("\n❌ Login failed!")
        return None


def test_verify_token(token):
    """Test token verification"""
    print("\n=== Testing Token Verification ===")
    
    response = requests.get(
        f"{BASE_URL}/auth/verify",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        print("\n✅ Token is valid!")
    else:
        print("\n❌ Token verification failed!")


def test_get_current_user(token):
    """Test getting current user info"""
    print("\n=== Testing Get Current User ===")
    
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        print("\n✅ User info retrieved successfully!")
    else:
        print("\n❌ Failed to get user info!")


def test_list_users(token):
    """Test listing all users (admin only)"""
    print("\n=== Testing List Users (Admin Only) ===")
    
    response = requests.get(
        f"{BASE_URL}/auth/users",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        print("\n✅ Users list retrieved successfully!")
    else:
        print("\n❌ Failed to get users list!")


if __name__ == "__main__":
    try:
        # Test login
        token = test_login()
        
        if token:
            # Test other endpoints with the token
            test_verify_token(token)
            test_get_current_user(token)
            test_list_users(token)
        
        print("\n" + "="*50)
        print("✅ All authentication tests completed!")
        print("="*50 + "\n")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to backend server!")
        print("Please make sure the backend is running on http://localhost:8000")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
