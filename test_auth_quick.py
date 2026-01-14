"""Quick test of authentication"""
import sys
sys.path.insert(0, 'backend')

from app.core.auth import verify_password, USERS_DB

print("="*60)
print("Testing Password Verification")
print("="*60)

for username, user_data in USERS_DB.items():
    hashed_password = user_data['hashed_password']
    print(f"\nUser: {username}")
    print(f"Hash format: {hashed_password[:30]}...")
    result = verify_password("admin", hashed_password)
    status = "[PASS]" if result else "[FAIL]"
    print(f"Verify 'admin': {result} {status}")

print("\n" + "="*60)
