"""
Test authentication password hash
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test password
password = "admin"
stored_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"

print("Testing password verification...")
print(f"Password: {password}")
print(f"Stored hash: {stored_hash}")
print(f"Verification result: {pwd_context.verify(password, stored_hash)}")

# Generate new hash
new_hash = pwd_context.hash(password)
print(f"\nNew hash generated: {new_hash}")
print(f"New hash verification: {pwd_context.verify(password, new_hash)}")
