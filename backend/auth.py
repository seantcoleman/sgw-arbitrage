"""
Supabase JWT verification for FastAPI.
"""

from __future__ import annotations

import os
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

SUPABASE_JWT_SECRET = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
# Auto-disable auth when JWT secret is missing so single-tenant Oracle keeps working
# until Supabase is configured. Set AUTH_DISABLED=false once secrets are in place.
_auth_env = (os.getenv("AUTH_DISABLED") or "").strip().lower()
if _auth_env in ("1", "true", "yes"):
    AUTH_DISABLED = True
elif _auth_env in ("0", "false", "no"):
    AUTH_DISABLED = False
else:
    AUTH_DISABLED = not bool(SUPABASE_JWT_SECRET)
DEV_USER_ID = (os.getenv("DEV_USER_ID") or "00000000-0000-0000-0000-000000000001").strip()


class AuthUser:
    def __init__(self, id: str, email: Optional[str] = None):
        self.id = id
        self.email = email

    @property
    def uuid(self) -> UUID:
        return UUID(self.id)


def _decode_supabase_jwt(token: str) -> dict:
    try:
        from jose import JWTError, jwt
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="python-jose is required for auth",
        ) from e

    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured",
        )

    try:
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        ) from e


async def current_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> AuthUser:
    """Require a valid Supabase access token (Bearer)."""
    if AUTH_DISABLED:
        return AuthUser(id=DEV_USER_ID, email="dev@local")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_jwt(token)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing sub claim")
    return AuthUser(id=str(sub), email=claims.get("email"))


async def optional_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[AuthUser]:
    if AUTH_DISABLED:
        return AuthUser(id=DEV_USER_ID, email="dev@local")
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return await current_user(authorization)
    except HTTPException:
        return None


# FastAPI dependency aliases
RequireUser = Annotated[AuthUser, Depends(current_user)]
OptionalUser = Annotated[Optional[AuthUser], Depends(optional_user)]
