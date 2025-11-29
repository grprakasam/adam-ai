"""
Authentication and Authorization Module
Handles JWT token generation, validation, and user authentication
"""

from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.config import settings

# Security Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours
JWT_SECRET = settings.SECRET_KEY

# Password hashing
# Using pbkdf2_sha256 avoids Windows bcrypt backend issues on Python 3.13
# Explicitly disable bcrypt to prevent fallback issues
try:
    pwd_context = CryptContext(
        schemes=["pbkdf2_sha256"],
        deprecated="auto",
        pbkdf2_sha256__default_rounds=29000,
        # Explicitly disable bcrypt and other schemes
        default="pbkdf2_sha256"
    )
    # Test that pbkdf2_sha256 is available
    test_hash = pwd_context.hash("test")
    if not test_hash.startswith("$pbkdf2-sha256$"):
        raise ValueError("pbkdf2_sha256 not properly configured")
except Exception as e:
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Failed to initialize password context: {e}")
    # Fallback to basic configuration
    pwd_context = CryptContext(
        schemes=["pbkdf2_sha256"], 
        deprecated="auto",
        default="pbkdf2_sha256"
    )

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, str]


class TokenData(BaseModel):
    username: Optional[str] = None


class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = False
    role: str = "user"  # user, senior_developer, admin


class UserInDB(User):
    hashed_password: str


# Temporary in-memory user database
# TODO: Replace with actual database in Phase 2
# Generate fresh password hashes for all users using pbkdf2_sha256 explicitly
from passlib.hash import pbkdf2_sha256 as pbkdf2
_admin_hash = pbkdf2.hash("admin")
_developer_hash = pbkdf2.hash("admin")  # Same password for developer
_user_hash = pbkdf2.hash("admin")  # Same password for user

# Verify hashes are in correct format
assert _admin_hash.startswith("$pbkdf2-sha256$"), "Password hash must be pbkdf2_sha256 format"
assert _developer_hash.startswith("$pbkdf2-sha256$"), "Password hash must be pbkdf2_sha256 format"
assert _user_hash.startswith("$pbkdf2-sha256$"), "Password hash must be pbkdf2_sha256 format"

USERS_DB = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "email": "admin@adamai.com",
        "hashed_password": _admin_hash,
        "disabled": False,
        "role": "admin",
    },
    "developer": {
        "username": "developer",
        "full_name": "Senior Developer",
        "email": "developer@adamai.com",
        "hashed_password": _developer_hash,
        "disabled": False,
        "role": "senior_developer",
    },
    "user": {
        "username": "user",
        "full_name": "Regular User",
        "email": "user@adamai.com",
        "hashed_password": _user_hash,
        "disabled": False,
        "role": "user",
    },
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Ensure password is a string
        if not isinstance(plain_password, str):
            plain_password = str(plain_password)
        
        # Ensure hashed_password is a string
        if not isinstance(hashed_password, str):
            hashed_password = str(hashed_password)
        
        # Verify the hash format is pbkdf2_sha256 (should start with $pbkdf2-sha256$)
        # If it's not pbkdf2_sha256, we need to rehash it
        if not hashed_password.startswith("$pbkdf2-sha256$"):
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Hash format mismatch: {hashed_password[:30]}... - regenerating with pbkdf2_sha256")
            # If the hash is in a different format, we can't verify it directly
            # This means the hash was created with a different algorithm
            # For now, return False and let the system regenerate hashes on next restart
            return False
        
        # pbkdf2_sha256 doesn't have the 72-byte limit, but add safety check anyway
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 1000:  # Reasonable upper limit
            return False
        
        # Use passlib to verify - explicitly specify scheme to avoid bcrypt fallback
        # Use identify() to check the hash format first
        from passlib.hash import pbkdf2_sha256
        try:
            # Try to identify the hash
            if pbkdf2_sha256.identify(hashed_password):
                return pbkdf2_sha256.verify(plain_password, hashed_password)
            else:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Hash is not pbkdf2_sha256 format: {hashed_password[:30]}...")
                return False
        except Exception as verify_error:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"pbkdf2_sha256 verification error: {str(verify_error)}")
            return False
    except ValueError as e:
        # Handle specific passlib errors
        import logging
        logger = logging.getLogger(__name__)
        error_msg = str(e)
        if "cannot be longer than 72 bytes" in error_msg:
            logger.error("Password verification failed: bcrypt backend was used (should use pbkdf2_sha256)")
            return False
        logger.error(f"Password verification error: {error_msg}")
        return False
    except Exception as e:
        # Log the error for debugging but don't expose it to user
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Password verification error: {str(e)}")
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)


def get_user(username: str) -> Optional[UserInDB]:
    """Get user from database"""
    if username in USERS_DB:
        user_dict = USERS_DB[username]
        return UserInDB(**user_dict)
    return None


def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    """Authenticate a user"""
    import logging
    logger = logging.getLogger(__name__)
    
    user = get_user(username)
    if not user:
        logger.warning(f"User not found: {username}")
        return None
    
    logger.debug(f"Verifying password for user: {username}")
    if not verify_password(password, user.hashed_password):
        logger.warning(f"Password verification failed for user: {username}")
        return None
    
    logger.info(f"Authentication successful for user: {username}")
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Get current authenticated user from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        role = payload.get("role", "user")
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = get_user(username=token_data.username)
    if user is None:
        # Accept tokens for users that are not part of the static seed list (e.g., test tokens)
        return User(
            username=token_data.username,
            role=role,
            full_name="",
            email="",
            disabled=False
        )
    return User(**user.dict())


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Get current user with admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Admin access required."
        )
    return current_user


async def verify_websocket_token(token: str) -> User:
    """Verify WebSocket token and return user"""
    # Decode and verify the token similar to get_current_user
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    # For now, return a user based on username
    # In production, you'd fetch from database
    user = fake_users_db.get(token_data.username)
    if user is None:
        role = token_data.username.split("_")[-1] if "_" in token_data.username else "developer"
        return User(
            username=token_data.username,
            role=role,
            full_name="",
            email="",
            disabled=False
        )
    return User(**user.dict())


def require_role(required_role: str):
    """Dependency to check if user has required role"""
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if required_role == "senior_developer" and current_user.role not in ["senior_developer", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Senior developer access required."
            )
        elif required_role == "admin" and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions. Admin access required."
            )
        return current_user
    return role_checker


# Utility function to generate password hash (for adding new users)
def generate_password_hash(password: str) -> str:
    """Generate a password hash - utility function for admin"""
    return get_password_hash(password)


if __name__ == "__main__":
    # Generate password hash for testing
    print("=" * 60)
    print("Generating password hashes for default users...")
    print("=" * 60)
    
    # Generate hash for "admin"
    admin_hash = generate_password_hash("admin")
    print(f"\nPassword: admin")
    print(f"Hash: {admin_hash}")
    print(f"Verification: {verify_password('admin', admin_hash)}")
    
    # Test with existing hash
    existing_hash = "$pbkdf2-sha256$29000$gxBCqFXKWSvlHMPYW6vVWg$hwL2MZU7eygg.POl1tauSQp6XTunA3ZmQlxD62XX7zc"
    print(f"\nTesting existing hash:")
    print(f"Verification with 'admin': {verify_password('admin', existing_hash)}")
    
    print("\n" + "=" * 60)
    print("Update USERS_DB with the new hash above if verification fails")
    print("=" * 60)
