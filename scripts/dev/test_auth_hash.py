"""Test and generate password hash"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'backend'))

from passlib.context import CryptContext

# Create password context
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=29000
)

# Generate hash for "admin"
password = "admin"
hash_value = pwd_context.hash(password)
print(f"Password: {password}")
print(f"Hash: {hash_value}")

# Test verification
result = pwd_context.verify(password, hash_value)
print(f"Verification test: {result}")

# Test with existing hash
existing_hash = "$pbkdf2-sha256$29000$gxBCqFXKWSvlHMPYW6vVWg$hwL2MZU7eygg.POl1tauSQp6XTunA3ZmQlxD62XX7zc"
result2 = pwd_context.verify(password, existing_hash)
print(f"Verification with existing hash: {result2}")

