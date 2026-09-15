"""
Database connection layer — Postgres (Supabase) when DATABASE_URL is set,
otherwise local SQLite for single-tenant / offline development.
"""

from __future__ import annotations

import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable, Optional

DB_PATH = Path(__file__).parent / "arbitrage.db"
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
USE_POSTGRES = bool(DATABASE_URL)

_pg_pool = None


def using_postgres() -> bool:
    return USE_POSTGRES


def _to_postgres_sql(sql: str) -> str:
    """Convert SQLite-ish SQL to Postgres-compatible SQL."""
    # datetime('now') / datetime("now") → now()
    sql = re.sub(r"datetime\(\s*['\"]now['\"]\s*\)", "now()", sql, flags=re.IGNORECASE)
    # INSERT OR REPLACE / INSERT OR IGNORE
    sql = re.sub(r"INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
    sql = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
    # ON CONFLICT(col) → ON CONFLICT (col)
    sql = re.sub(r"ON\s+CONFLICT\s*\(", "ON CONFLICT (", sql, flags=re.IGNORECASE)
    # ? placeholders → %s (skip :: type casts)
    out: list[str] = []
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "?" and (i == 0 or sql[i - 1] != ":"):
            out.append("%s")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def _get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
        from psycopg_pool import ConnectionPool
        from psycopg.rows import dict_row

        _pg_pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=True,
        )
    return _pg_pool


class _Result:
    """Normalize sqlite3 / psycopg cursor results."""

    def __init__(self, rows: list, rowcount: int = -1, lastrowid: Any = None):
        self._rows = rows
        self.rowcount = rowcount
        self.lastrowid = lastrowid

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)

    def __iter__(self):
        return iter(self._rows)


class _ConnProxy:
    def __init__(self, conn, postgres: bool):
        self._conn = conn
        self.postgres = postgres

    def execute(self, sql: str, params: Optional[Any] = None) -> _Result:
        if params is None:
            params = ()
        if self.postgres:
            sql = _to_postgres_sql(sql)
            # Convert named :foo params to %(foo)s if a dict was passed
            if isinstance(params, dict):
                def repl(m):
                    return "%(" + m.group(1) + ")s"
                sql = re.sub(r":([a-zA-Z_][a-zA-Z0-9_]*)", repl, sql)
            cur = self._conn.execute(sql, params)
            rows = list(cur.fetchall()) if cur.description else []
            lastrowid = None
            if rows and isinstance(rows[0], dict) and "id" in rows[0] and "RETURNING" in sql.upper():
                lastrowid = rows[0]["id"]
            return _Result(rows, rowcount=cur.rowcount, lastrowid=lastrowid)

        cur = self._conn.execute(sql, params)
        if cur.description:
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        else:
            rows = []
        return _Result(rows, rowcount=cur.rowcount, lastrowid=cur.lastrowid)

    def executescript(self, script: str) -> None:
        if self.postgres:
            # Postgres schema lives in supabase/migrations — ignore SQLite bootstrap.
            return
        self._conn.executescript(script)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        if not self.postgres:
            self._conn.close()


@contextmanager
def get_conn():
    if USE_POSTGRES:
        pool = _get_pg_pool()
        with pool.connection() as raw:
            proxy = _ConnProxy(raw, postgres=True)
            try:
                yield proxy
                raw.commit()
            except Exception:
                raw.rollback()
                raise
    else:
        raw = sqlite3.connect(DB_PATH)
        raw.row_factory = sqlite3.Row
        raw.execute("PRAGMA journal_mode=WAL")
        proxy = _ConnProxy(raw, postgres=False)
        try:
            yield proxy
            raw.commit()
        except Exception:
            raw.rollback()
            raise
        finally:
            raw.close()
