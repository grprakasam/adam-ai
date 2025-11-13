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

# Security Configuration
SECRET_KEY = "adam-ai-secret-key-change-in-production"  # TODO: Move to environment variables
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


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
USERS_DB = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "email": "admin@adamai.com",
        "hashed_password": "$2b$12$uFvvtnyMN9aRTK/2sWe4huxqCUOQR/40UvdRUSAz4pwd4Yeu4B.E6",  # "admin"
        "disabled": False,
        "role": "admin",
    },
    "developer": {
        "username": "developer",
        "full_name": "Senior Developer",
        "email": "developer@adamai.com",
        "hashed_password": "$2b$12$uFvvtnyMN9aRTK/2sWe4huxqCUOQR/40UvdRUSAz4pwd4Yeu4B.E6",  # "admin"
        "disabled": False,
        "role": "senior_developer",
    },
    "user": {
        "username": "user",
        "full_name": "Regular User",
        "email": "user@adamai.com",
        "hashed_password": "$2b$12$uFvvtnyMN9aRTK/2sWe4huxqCUOQR/40UvdRUSAz4pwd4Yeu4B.E6",  # "admin"
        "disabled": False,
        "role": "user",
    },
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


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
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Get current authenticated user from token"""
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
    
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return User(**user.dict())


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


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
    print("Password hash for 'admin':", generate_password_hash("admin"))
