"""Generate password hash for admin user"""
import sys
sys.path.insert(0, '.')

from app.core.auth import get_password_hash

# Generate hash for "admin" password
password = "admin"
hash_value = get_password_hash(password)
print(f"Password: {password}")
print(f"Hash: {hash_value}")

# Test verification
from app.core.auth import verify_password
result = verify_password(password, hash_value)
print(f"Verification test: {result}")

