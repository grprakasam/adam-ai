"""
Authentication API Endpoints
Login, logout, token refresh, and user management
"""

from datetime import timedelta
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
    require_role,
    Token,
    User,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login endpoint - authenticate user and return JWT token
    
    Default credentials:
    - admin/admin (Admin role)
    - developer/admin (Senior Developer role)
    - user/admin (Regular user role)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Ensure password is a string and handle encoding
    password = str(form_data.password) if form_data.password else ""
    username = str(form_data.username) if form_data.username else ""
    
    logger.info(f"Login attempt for username: {username}")
    logger.debug(f"Password length: {len(password)}")
    
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "username": user.username,
            "email": user.email or "",
            "full_name": user.full_name or "",
            "role": user.role,
        }
    )


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logout endpoint (client should delete token)
    In a production app, you might want to maintain a token blacklist
    """
    return {"message": "Successfully logged out"}


@router.get("/verify")
async def verify_token(current_user: User = Depends(get_current_active_user)):
    """Verify if the current token is valid"""
    return {
        "valid": True,
        "user": {
            "username": current_user.username,
            "role": current_user.role,
            "full_name": current_user.full_name,
        }
    }


@router.get("/users", response_model=Dict)
async def list_users(current_user: User = Depends(require_role("admin"))):
    """List all users (Admin only)"""
    from app.core.auth import USERS_DB
    
    users = []
    for username, user_data in USERS_DB.items():
        users.append({
            "username": user_data["username"],
            "full_name": user_data["full_name"],
            "email": user_data["email"],
            "role": user_data["role"],
            "disabled": user_data["disabled"],
        })
    
    return {"users": users, "total": len(users)}
