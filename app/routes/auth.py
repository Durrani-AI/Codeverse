"""
Authentication endpoints - register, login, profile, and password management.

Uses passlib (bcrypt) for password hashing and python-jose for JWT tokens.
Exposes reusable ``get_current_user`` / ``get_current_active_user`` dependencies
that other routers can import to protect their endpoints.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import PasswordChange, Token, UserCreate, UserLogin, UserResponse

router = APIRouter()
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme - points at the login endpoint so Swagger "Authorize" works
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# --- JWT dependency (importable by other routers) ---

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode the Bearer JWT and return the corresponding User ORM object.

    Raises 401 if the token is missing, expired, malformed, or the user
    no longer exists in the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user account is still active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


# --- Register ---

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""

    result = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=_hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Registered user %s", user.username)
    return UserResponse.model_validate(user)


# --- Login ---

@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and return a JWT."""

    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    token = _create_access_token({"sub": user.id})
    return Token(access_token=token)


# --- Profile ---

@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """Return the authenticated user's profile."""
    return UserResponse.model_validate(current_user)


# --- Password change ---

@router.put("/password", status_code=status.HTTP_200_OK)
async def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password.

    Requires the current password for verification before setting the new one.
    """
    if not _verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Current password is incorrect",
        )

    current_user.hashed_password = _hash_password(body.new_password)
    await db.commit()
    logger.info("Password changed for user %s", current_user.username)
    return {"message": "Password updated successfully"}


# --- Update username ---

@router.put("/username", response_model=UserResponse)
async def change_username(
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's username."""
    new_username = body.get("username", "").strip()
    if not new_username or len(new_username) < 3:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username must be at least 3 characters")
    if not new_username.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username may only contain letters, digits, _ and -")

    existing = await db.execute(select(User).where(User.username == new_username))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    current_user.username = new_username
    await db.commit()
    await db.refresh(current_user)
    logger.info("Username changed to %s", new_username)
    return UserResponse.model_validate(current_user)


# --- Delete account ---

@router.delete("/account", status_code=status.HTTP_200_OK)
async def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the authenticated user's account and all data."""
    logger.info("Deleting account for user %s", current_user.username)
    await db.delete(current_user)
    await db.commit()
    return {"message": "Account deleted successfully"}


# --- Profile picture upload ---

UPLOAD_DIR = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.put("/profile-picture", response_model=UserResponse)
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace profile picture. Max 5 MB, jpeg/png/gif/webp only."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"File type not allowed. Use: {', '.join(ALLOWED_TYPES)}",
        )

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "File too large. Maximum size is 5 MB.",
        )

    # Delete old avatar if exists
    if current_user.profile_picture:
        old_path = Path(current_user.profile_picture.lstrip("/"))
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    ext = ext.lower()
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        ext = "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    current_user.profile_picture = f"/uploads/avatars/{filename}"
    await db.commit()
    await db.refresh(current_user)
    logger.info("Profile picture updated for user %s", current_user.username)
    return UserResponse.model_validate(current_user)


@router.delete("/profile-picture", response_model=UserResponse)
async def remove_profile_picture(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the user's profile picture."""
    if current_user.profile_picture:
        old_path = Path(current_user.profile_picture.lstrip("/"))
        if old_path.exists():
            old_path.unlink(missing_ok=True)
        current_user.profile_picture = None
        await db.commit()
        await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# --- Change email ---

@router.put("/email", response_model=UserResponse)
async def change_email(
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's email."""
    new_email = body.get("email", "").strip().lower()
    if not new_email or "@" not in new_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid email address")

    existing = await db.execute(select(User).where(User.email == new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")

    current_user.email = new_email
    await db.commit()
    await db.refresh(current_user)
    logger.info("Email changed for user %s", current_user.username)
    return UserResponse.model_validate(current_user)
