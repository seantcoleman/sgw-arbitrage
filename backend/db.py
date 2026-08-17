"""
SQLite database layer using plain sqlite3 — no ORM dependency.
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).parent / "arbitrage.db"


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS deals (
                item_id         INTEGER PRIMARY KEY,
                title           TEXT NOT NULL,
                sgw_url         TEXT,
                current_bid     REAL NOT NULL,
                shipping_est    REAL,
                end_time        TEXT,
                seller_id       INTEGER,
                image_url       TEXT,
                keyword         TEXT,
                ebay_median     REAL,
                ebay_low        REAL,
                ebay_high       REAL,
                ebay_sold_count INTEGER,
                ebay_search     TEXT,
                profit          REAL,
                margin          REAL,
                status          TEXT DEFAULT 'active',
                first_seen      TEXT DEFAULT (datetime('now')),
                last_updated    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS watchlist (
                item_id     INTEGER PRIMARY KEY,
                title       TEXT NOT NULL,
                max_bid     REAL NOT NULL,
                current_bid REAL,
                end_time    TEXT,
                sgw_url     TEXT,
                image_url   TEXT,
                ebay_median REAL,
                profit      REAL,
                sniper_status TEXT DEFAULT 'scheduled',
                final_price REAL,
                final_shipping REAL,
                handling_price REAL,
                tax         REAL,
                order_id    INTEGER,
                tracking_number TEXT,
                shipper_name TEXT,
                due_date    TEXT,
                added_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scan_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at  TEXT,
                finished_at TEXT,
                items_scanned INTEGER DEFAULT 0,
                deals_found   INTEGER DEFAULT 0,
                error       TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('scan_keywords', '["sony headphones", "apple watch", "canon camera", "nintendo switch"]'),
                ('min_profit_usd', '15'),
                ('min_margin_pct', '25'),
                ('min_sold_comps', '5'),
                ('max_bid_cap', '300'),
                ('min_bid_floor', '3'),
                ('scan_interval_minutes', '15'),
                ('snipe_seconds_before', '30'),
                ('your_zip_code', '90210'),
                ('ebay_days_back', '90'),
                ('scan_category_ids', '[]');
        """)
        # Migrate existing DBs that predate final_price / final_shipping columns
        existing = {r[1] for r in conn.execute("PRAGMA table_info(watchlist)").fetchall()}
        for col, typedef in [
            ("final_price",    "REAL"),
            ("final_shipping", "REAL"),
            ("handling_price", "REAL"),
            ("tax",            "REAL"),
            ("order_id",       "INTEGER"),
            ("tracking_number","TEXT"),
            ("shipper_name",   "TEXT"),
            ("due_date",       "TEXT"),
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE watchlist ADD COLUMN {col} {typedef}")

        # Migrate deals table to add skip_reason column
        deals_cols = {r[1] for r in conn.execute("PRAGMA table_info(deals)").fetchall()}
        if "skip_reason" not in deals_cols:
            conn.execute("ALTER TABLE deals ADD COLUMN skip_reason TEXT")


# ── Deals ──────────────────────────────────────────────────────────────────

def upsert_deal(deal: Dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO deals (
                item_id, title, sgw_url, current_bid, shipping_est, end_time,
                seller_id, image_url, keyword, ebay_median, ebay_low, ebay_high,
                ebay_sold_count, ebay_search, profit, margin, status, last_updated
            ) VALUES (
                :item_id, :title, :sgw_url, :current_bid, :shipping_est, :end_time,
                :seller_id, :image_url, :keyword, :ebay_median, :ebay_low, :ebay_high,
                :ebay_sold_count, :ebay_search, :profit, :margin, 'active', datetime('now')
            )
            ON CONFLICT(item_id) DO UPDATE SET
                current_bid  = excluded.current_bid,
                end_time     = excluded.end_time,
                ebay_median  = excluded.ebay_median,
                profit       = excluded.profit,
                margin       = excluded.margin,
                skip_reason  = NULL,
                status       = 'active',
                last_updated = datetime('now')
        """, deal)


def upsert_skipped(item: Dict[str, Any]) -> None:
    """Store analysis for items that were checked but didn't qualify as deals.

    Never overwrite an existing active deal — a later skip (e.g. bid-floor
    mismatch on a favorites re-scan) must not hide a previously found deal.
    """
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT status FROM deals WHERE item_id = ?", (item["item_id"],)
        ).fetchone()
        if existing and existing["status"] == "active":
            return
        conn.execute("""
            INSERT INTO deals (
                item_id, title, sgw_url, current_bid, shipping_est, end_time,
                seller_id, image_url, keyword, ebay_median, ebay_low, ebay_high,
                ebay_sold_count, ebay_search, profit, margin, status, skip_reason, last_updated
            ) VALUES (
                :item_id, :title, :sgw_url, :current_bid, :shipping_est, :end_time,
                :seller_id, :image_url, :keyword, :ebay_median, :ebay_low, :ebay_high,
                :ebay_sold_count, :ebay_search, :profit, :margin, 'skipped', :skip_reason, datetime('now')
            )
            ON CONFLICT(item_id) DO UPDATE SET
                current_bid  = excluded.current_bid,
                end_time     = excluded.end_time,
                ebay_median  = excluded.ebay_median,
                profit       = excluded.profit,
                margin       = excluded.margin,
                skip_reason  = excluded.skip_reason,
                status       = 'skipped',
                last_updated = datetime('now')
        """, item)


def get_deals(
    min_profit: float = 0,
    min_margin: float = 0,
    status: str = "active",
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM deals
            WHERE profit >= ? AND margin >= ? AND status = ?
            ORDER BY profit DESC
            LIMIT ? OFFSET ?
        """, (min_profit, min_margin, status, limit, offset)).fetchall()
    return [dict(r) for r in rows]


def get_deals_by_ids(item_ids: List[int]) -> List[Dict]:
    """Fetch deals/skipped records by item ID with no profit or status filter."""
    if not item_ids:
        return []
    placeholders = ",".join("?" * len(item_ids))
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM deals WHERE item_id IN ({placeholders})",
            item_ids,
        ).fetchall()
    return [dict(r) for r in rows]


def count_deals(
    min_profit: float = 0,
    min_margin: float = 0,
    status: str = "active",
) -> int:
    with get_conn() as conn:
        row = conn.execute("""
            SELECT COUNT(*) FROM deals
            WHERE profit >= ? AND margin >= ? AND status = ?
        """, (min_profit, min_margin, status)).fetchone()
    return row[0] if row else 0


def mark_deals_stale(active_item_ids: List[int]) -> None:
    """Mark deals no longer in scan results as ended."""
    if not active_item_ids:
        return
    placeholders = ",".join("?" * len(active_item_ids))
    with get_conn() as conn:
        conn.execute(f"""
            UPDATE deals SET status = 'ended'
            WHERE status = 'active' AND item_id NOT IN ({placeholders})
        """, active_item_ids)


# ── Watchlist ───────────────────────────────────────────────────────────────

def add_to_watchlist(item: Dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO watchlist (
                item_id, title, max_bid, current_bid, end_time,
                sgw_url, image_url, ebay_median, profit
            ) VALUES (
                :item_id, :title, :max_bid, :current_bid, :end_time,
                :sgw_url, :image_url, :ebay_median, :profit
            )
        """, item)


def get_watchlist() -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY end_time ASC").fetchall()
    return [dict(r) for r in rows]


def remove_from_watchlist(item_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM watchlist WHERE item_id = ?", (item_id,))


def update_watchlist_status(item_id: int, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE watchlist SET sniper_status = ? WHERE item_id = ?",
            (status, item_id),
        )


def update_watchlist_result(item_id: int, status: str, final_price: Optional[float], final_shipping: Optional[float]) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE watchlist SET sniper_status = ?, final_price = ?, final_shipping = ? WHERE item_id = ?",
            (status, final_price, final_shipping, item_id),
        )


def update_watchlist_order(
    item_id: int,
    status: str,
    order_id: Optional[int] = None,
    final_price: Optional[float] = None,
    final_shipping: Optional[float] = None,
    handling_price: Optional[float] = None,
    tax: Optional[float] = None,
    tracking_number: Optional[str] = None,
    shipper_name: Optional[str] = None,
    due_date: Optional[str] = None,
) -> None:
    with get_conn() as conn:
        conn.execute("""
            UPDATE watchlist SET
                sniper_status   = ?,
                order_id        = COALESCE(?, order_id),
                final_price     = COALESCE(?, final_price),
                final_shipping  = COALESCE(?, final_shipping),
                handling_price  = COALESCE(?, handling_price),
                tax             = COALESCE(?, tax),
                tracking_number = COALESCE(?, tracking_number),
                shipper_name    = COALESCE(?, shipper_name),
                due_date        = COALESCE(?, due_date)
            WHERE item_id = ?
        """, (status, order_id, final_price, final_shipping,
              handling_price, tax, tracking_number, shipper_name,
              due_date, item_id))


# ── Settings ────────────────────────────────────────────────────────────────

def get_settings() -> Dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    result = {}
    for row in rows:
        try:
            result[row["key"]] = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            result[row["key"]] = row["value"]
    return result


def update_setting(key: str, value: Any) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )


# ── Scan log ────────────────────────────────────────────────────────────────

def log_scan_start() -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO scan_log (started_at) VALUES (datetime('now'))"
        )
        return cur.lastrowid


def log_scan_finish(scan_id: int, items_scanned: int, deals_found: int, error: Optional[str] = None):
    with get_conn() as conn:
        conn.execute("""
            UPDATE scan_log
            SET finished_at = datetime('now'),
                items_scanned = ?,
                deals_found = ?,
                error = ?
            WHERE id = ?
        """, (items_scanned, deals_found, error, scan_id))


def get_recent_scans(limit: int = 10) -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM scan_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]
