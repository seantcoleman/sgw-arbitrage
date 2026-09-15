"""
Supabase JWT verification for FastAPI.

New Supabase projects sign user access tokens with ES256 (JWKS).
Legacy projects may still use HS256 with SUPABASE_JWT_SECRET.
"""

from __future__ import annotations

import json
import os
import time
import urllib.request
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

SUPABASE_JWT_SECRET = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
# Auto-disable auth when neither JWKS nor HMAC secret is configured so
# single-tenant Oracle keeps working until Supabase is wired up.
_auth_env = (os.getenv("AUTH_DISABLED") or "").strip().lower()
if _auth_env in ("1", "true", "yes"):
    AUTH_DISABLED = True
elif _auth_env in ("0", "false", "no"):
    AUTH_DISABLED = False
else:
    AUTH_DISABLED = not bool(SUPABASE_JWT_SECRET or SUPABASE_URL)
DEV_USER_ID = (os.getenv("DEV_USER_ID") or "00000000-0000-0000-0000-000000000001").strip()

_JWKS_TTL_SECONDS = 3600
_jwks_cache: Optional[dict] = None
_jwks_fetched_at = 0.0


class AuthUser:
    def __init__(self, id: str, email: Optional[str] = None):
        self.id = id
        self.email = email

    @property
    def uuid(self) -> UUID:
        return UUID(self.id)


def _jose():
    try:
        from jose import JWTError, jwk, jwt
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="python-jose is required for auth",
        ) from e
    return JWTError, jwk, jwt


def _fetch_jwks(*, force: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if (
        not force
        and _jwks_cache is not None
        and now - _jwks_fetched_at < _JWKS_TTL_SECONDS
    ):
        return _jwks_cache
    if not SUPABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured for JWKS verification",
        )
    url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Supabase JWKS: {e}",
        ) from e
    if not isinstance(payload, dict) or not payload.get("keys"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWKS response was empty",
        )
    _jwks_cache = payload
    _jwks_fetched_at = now
    return payload


def _jwk_for_kid(kid: Optional[str], *, retry: bool = True):
    JWTError, jwk, jwt = _jose()  # jwt unused; keep unpack consistent
    del JWTError, jwt
    keys = _fetch_jwks().get("keys") or []
    match = next((k for k in keys if not kid or k.get("kid") == kid), None)
    if match is None and retry:
        keys = _fetch_jwks(force=True).get("keys") or []
        match = next((k for k in keys if not kid or k.get("kid") == kid), None)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token signing key is not in Supabase JWKS",
        )
    return jwk.construct(match)


def _decode_supabase_jwt(token: str) -> dict:
    JWTError, jwk, jwt = _jose()
    del jwk

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {e}",
        ) from e

    alg = (header.get("alg") or "").upper()
    decode_kwargs = {
        "algorithms": [alg] if alg else ["ES256", "RS256", "HS256"],
        "audience": "authenticated",
        "options": {
            "verify_aud": True,
            "verify_iss": bool(SUPABASE_URL),
            "leeway": 30,
        },
    }
    if SUPABASE_URL:
        decode_kwargs["issuer"] = f"{SUPABASE_URL}/auth/v1"

    try:
        if alg in ("ES256", "RS256"):
            key = _jwk_for_kid(header.get("kid"))
            return jwt.decode(token, key, **decode_kwargs)
        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="SUPABASE_JWT_SECRET is not configured",
                )
            return jwt.decode(token, SUPABASE_JWT_SECRET, **decode_kwargs)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported token algorithm: {alg or 'unknown'}",
        )
    except HTTPException:
        raise
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
    role = claims.get("role")
    if role and role != "authenticated":
        raise HTTPException(status_code=401, detail="Token is not an authenticated user")
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
