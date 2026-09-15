"""Simple in-memory per-user rate limiter."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException

_lock = threading.Lock()
_hits: Dict[str, Deque[float]] = defaultdict(deque)


def check_rate_limit(user_id: str, action: str, *, limit: int, window_seconds: int) -> None:
    key = f"{user_id}:{action}"
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and q[0] <= now - window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded for {action} ({limit}/{window_seconds}s)",
            )
        q.append(now)
