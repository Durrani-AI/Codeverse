"""
Admin management endpoints.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, InterviewSession
from app.schemas import UserResponse
from app.routes.auth import get_current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency to check if the current user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges",
        )
    return current_user

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Get list of users (Admin only)."""
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Delete a user account (Admin only)."""
    if user_id == admin_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    await db.delete(user)
    await db.commit()
    logger.info("Admin %s deleted user %s", admin_user.username, user.username)

@router.get("/stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Get system-wide statistics (Admin only)."""
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0

    # Total sessions
    sessions_result = await db.execute(select(func.count(InterviewSession.id)))
    total_sessions = sessions_result.scalar() or 0

    # Completed sessions
    completed_result = await db.execute(select(func.count(InterviewSession.id)).where(InterviewSession.status == "completed"))
    completed_sessions = completed_result.scalar() or 0

    return {
        "total_users": total_users,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
    }
