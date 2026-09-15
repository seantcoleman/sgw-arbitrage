"""
Database layer — SQLite locally, Postgres (Supabase) when DATABASE_URL is set.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union

from db_conn import get_conn, using_postgres

UserId = Union[str, int]


def init_db():
    # Postgres schema is applied via supabase/migrations — only bootstrap SQLite.
    if using_postgres():
        with get_conn() as conn:
            # Ensure shared app_settings seed exists
            defaults = [
                ("scan_keywords", "[]"),
                ("scan_category_ids", "[]"),
                ("min_profit_usd", "20"),
                ("min_margin_pct", "30"),
                ("min_sold_comps", "5"),
                ("max_bid_cap", "300"),
                ("min_bid_floor", "3"),
                ("scan_interval_minutes", "120"),
                ("max_scan_items", "200"),
                ("auctions_only", "true"),
            ]
            for k, v in defaults:
                conn.execute(
                    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
                    (k, v),
                )
        return

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
                ('min_profit_usd', '20'),
                ('min_margin_pct', '30'),
                ('min_sold_comps', '5'),
                ('max_bid_cap', '300'),
                ('min_bid_floor', '3'),
                ('scan_interval_minutes', '15'),
                ('snipe_seconds_before', '30'),
                ('your_zip_code', '90210'),
                ('ebay_days_back', '90'),
                ('scan_category_ids', '[]'),
                ('ebay_fee_pct', '13'),
                ('ebay_resale_shipping', '7'),
                ('ebay_display_mode', '"net"'),
                ('auctions_only', 'true');
        """)
        # Seed resale-cost settings on DBs created before these keys existed
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ebay_fee_pct', '13')")
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ebay_resale_shipping', '7')")
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ebay_display_mode', '\"net\"')")
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('auctions_only', 'true')")
        # Migrate existing DBs that predate final_price / final_shipping columns
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(watchlist)").fetchall()}
        for col, typedef in [
            ("final_price",    "REAL"),
            ("final_shipping", "REAL"),
            ("handling_price", "REAL"),
            ("tax",            "REAL"),
            ("order_id",       "INTEGER"),
            ("tracking_number","TEXT"),
            ("shipper_name",   "TEXT"),
            ("due_date",       "TEXT"),
            ("ebay_search",    "TEXT"),
            ("user_id",        "INTEGER"),
            ("sgw_account_id", "INTEGER"),
        ]:
            if col not in existing:
                conn.execute(f"ALTER TABLE watchlist ADD COLUMN {col} {typedef}")

        # Multi-tenant foundations (Phase 1 seeds a single local owner + env SGW account)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                email      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sgw_accounts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         INTEGER NOT NULL,
                label           TEXT,
                auth_source     TEXT NOT NULL DEFAULT 'env',
                encrypted_username TEXT,
                encrypted_password TEXT,
                status          TEXT NOT NULL DEFAULT 'active',
                created_at      TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS snipe_jobs (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_item_id  INTEGER NOT NULL,
                user_id            INTEGER,
                sgw_account_id     INTEGER,
                max_bid            REAL NOT NULL,
                end_time           TEXT,
                snipe_at           TEXT NOT NULL,
                status             TEXT NOT NULL DEFAULT 'pending',
                lease_owner        TEXT,
                lease_until        TEXT,
                attempt_count      INTEGER NOT NULL DEFAULT 0,
                last_error         TEXT,
                updated_at         TEXT DEFAULT (datetime('now')),
                created_at         TEXT DEFAULT (datetime('now')),
                UNIQUE(watchlist_item_id)
            );

            CREATE INDEX IF NOT EXISTS idx_snipe_jobs_pending_at
                ON snipe_jobs(status, snipe_at);
        """)

        # Seed default owner + env-backed SGW account
        row = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        if not row:
            cur = conn.execute(
                "INSERT INTO users (email) VALUES (?)",
                ("owner@local",),
            )
            user_id = cur.lastrowid
        else:
            user_id = row["id"]

        acct = conn.execute(
            "SELECT id FROM sgw_accounts WHERE user_id = ? AND auth_source = 'env' LIMIT 1",
            (user_id,),
        ).fetchone()
        if not acct:
            cur = conn.execute(
                """
                INSERT INTO sgw_accounts (user_id, label, auth_source, status)
                VALUES (?, 'Default (env)', 'env', 'active')
                """,
                (user_id,),
            )
            account_id = cur.lastrowid
        else:
            account_id = acct["id"]

        conn.execute(
            """
            UPDATE watchlist
            SET user_id = COALESCE(user_id, ?),
                sgw_account_id = COALESCE(sgw_account_id, ?)
            """,
            (user_id, account_id),
        )

        # Backfill ebay_search onto watchlist from deals where missing
        conn.execute("""
            UPDATE watchlist
            SET ebay_search = (
                SELECT d.ebay_search FROM deals d WHERE d.item_id = watchlist.item_id
            )
            WHERE ebay_search IS NULL
              AND EXISTS (SELECT 1 FROM deals d WHERE d.item_id = watchlist.item_id AND d.ebay_search IS NOT NULL)
        """)

        # Migrate deals table to add skip_reason column
        deals_cols = {r["name"] for r in conn.execute("PRAGMA table_info(deals)").fetchall()}
        if "skip_reason" not in deals_cols:
            conn.execute("ALTER TABLE deals ADD COLUMN skip_reason TEXT")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS search_term_cache (
                cache_key    TEXT PRIMARY KEY,
                search_term  TEXT NOT NULL,
                source       TEXT DEFAULT 'auto',
                hit_count    INTEGER DEFAULT 1,
                last_used    TEXT DEFAULT (datetime('now')),
                created_at   TEXT DEFAULT (datetime('now'))
            )
        """)

        # Seed cache from existing deal/watchlist search terms (once-ish; upsert is cheap)
        rows = conn.execute("""
            SELECT title, ebay_search FROM deals
            WHERE ebay_search IS NOT NULL AND trim(ebay_search) != '' AND title IS NOT NULL
            UNION
            SELECT title, ebay_search FROM watchlist
            WHERE ebay_search IS NOT NULL AND trim(ebay_search) != '' AND title IS NOT NULL
        """).fetchall()
        for row in rows:
            title, term = row["title"], row["ebay_search"]
            if not title or not term:
                continue
            tkey = "title:" + " ".join(title.lower().split())
            conn.execute("""
                INSERT INTO search_term_cache (cache_key, search_term, source, hit_count, last_used, created_at)
                VALUES (?, ?, 'seed', 1, datetime('now'), datetime('now'))
                ON CONFLICT(cache_key) DO NOTHING
            """, (tkey, term))
            # product fingerprint: brand+model-ish short terms only
            words = term.split()
            if 1 <= len(words) <= 3:
                pkey = "product:" + term.lower().strip()
                conn.execute("""
                    INSERT INTO search_term_cache (cache_key, search_term, source, hit_count, last_used, created_at)
                    VALUES (?, ?, 'seed', 1, datetime('now'), datetime('now'))
                    ON CONFLICT(cache_key) DO NOTHING
                """, (pkey, term))

        # Backfill durable snipe jobs for still-scheduled watchlist rows
        _backfill_snipe_jobs_conn(conn)


# ── Search term cache ──────────────────────────────────────────────────────

def upsert_search_term_cache(cache_key: str, search_term: str, source: str = "auto") -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO search_term_cache (cache_key, search_term, source, hit_count, last_used, created_at)
            VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
            ON CONFLICT(cache_key) DO UPDATE SET
                search_term = excluded.search_term,
                source      = CASE
                    WHEN excluded.source = 'manual' THEN 'manual'
                    WHEN search_term_cache.source = 'manual' THEN search_term_cache.source
                    ELSE excluded.source
                END,
                hit_count   = search_term_cache.hit_count + 1,
                last_used   = datetime('now')
        """, (cache_key, search_term, source))


def get_search_term_cache(cache_key: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM search_term_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        return dict(row) if row else None


def touch_search_term_cache(cache_key: str) -> None:
    with get_conn() as conn:
        conn.execute("""
            UPDATE search_term_cache
            SET hit_count = hit_count + 1, last_used = datetime('now')
            WHERE cache_key = ?
        """, (cache_key,))


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
                current_bid     = excluded.current_bid,
                end_time        = excluded.end_time,
                shipping_est    = excluded.shipping_est,
                ebay_median     = excluded.ebay_median,
                ebay_low        = excluded.ebay_low,
                ebay_high       = excluded.ebay_high,
                ebay_sold_count = excluded.ebay_sold_count,
                ebay_search     = excluded.ebay_search,
                profit          = excluded.profit,
                margin          = excluded.margin,
                skip_reason     = NULL,
                status          = 'active',
                last_updated    = datetime('now')
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
                title            = excluded.title,
                current_bid      = excluded.current_bid,
                shipping_est     = excluded.shipping_est,
                end_time         = excluded.end_time,
                image_url        = excluded.image_url,
                keyword          = excluded.keyword,
                ebay_median      = excluded.ebay_median,
                ebay_low         = excluded.ebay_low,
                ebay_high        = excluded.ebay_high,
                ebay_sold_count  = excluded.ebay_sold_count,
                ebay_search      = excluded.ebay_search,
                profit           = excluded.profit,
                margin           = excluded.margin,
                skip_reason      = excluded.skip_reason,
                status           = 'skipped',
                last_updated     = datetime('now')
        """, item)


# Favorites "Check eBay Prices" stores enrichment rows under this keyword.
# They must not appear on the Deals page or be wiped by keyword-scan stale marking.
FAVORITE_KEYWORD = "⭐ favorite"


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
              AND (keyword IS NULL OR keyword != ?)
            ORDER BY profit DESC
            LIMIT ? OFFSET ?
        """, (min_profit, min_margin, status, FAVORITE_KEYWORD, limit, offset)).fetchall()
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
            SELECT COUNT(*) AS n FROM deals
            WHERE profit >= ? AND margin >= ? AND status = ?
              AND (keyword IS NULL OR keyword != ?)
        """, (min_profit, min_margin, status, FAVORITE_KEYWORD)).fetchone()
    return int(row["n"]) if row else 0


def mark_deals_stale(active_item_ids: List[int]) -> None:
    """Mark deals no longer in scan results as ended.

    Skips favorite-enrichment rows so a keyword/browse scan doesn't wipe
    Favorites page analysis.
    """
    if not active_item_ids:
        return
    placeholders = ",".join("?" * len(active_item_ids))
    with get_conn() as conn:
        conn.execute(f"""
            UPDATE deals SET status = 'ended'
            WHERE status = 'active'
              AND (keyword IS NULL OR keyword != ?)
              AND item_id NOT IN ({placeholders})
        """, [FAVORITE_KEYWORD, *active_item_ids])


def reactivate_prematurely_ended_deals() -> int:
    """Re-open deals marked ended while their auction is still live.

    Used to heal rows wiped by site-wide browse stale-marking (a sample of
    listings incorrectly treated as the full active inventory).
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_conn() as conn:
        cur = conn.execute(
            """
            UPDATE deals
            SET status = 'active'
            WHERE status = 'ended'
              AND (keyword IS NULL OR keyword != ?)
              AND end_time IS NOT NULL
              AND REPLACE(REPLACE(end_time, ' ', 'T'), '+00:00', 'Z') > ?
            """,
            (FAVORITE_KEYWORD, now),
        )
        return cur.rowcount


def expire_past_deals() -> int:
    """Mark active deals whose end_time is in the past as ended."""
    with get_conn() as conn:
        # end_time is stored as ISO UTC (often with Z). Compare lexicographically
        # against current UTC ISO so we don't need SQLite datetime parsing quirks.
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cur = conn.execute(
            """
            UPDATE deals
            SET status = 'ended'
            WHERE status = 'active'
              AND end_time IS NOT NULL
              AND REPLACE(REPLACE(end_time, ' ', 'T'), '+00:00', 'Z') <= ?
            """,
            (now,),
        )
        return cur.rowcount


def end_long_horizon_deals(max_days: int = 14) -> int:
    """End active deals whose end_time is farther out than a normal SGW auction.

    Pure Buy Now listings often carry 30–150+ day listing expiry dates. When
    auctions_only is on, drop those so Deals stays sniper-relevant.
    """
    cutoff = (
        datetime.now(timezone.utc) + timedelta(days=max_days)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_conn() as conn:
        cur = conn.execute(
            """
            UPDATE deals
            SET status = 'ended'
            WHERE status = 'active'
              AND (keyword IS NULL OR keyword != ?)
              AND end_time IS NOT NULL
              AND REPLACE(REPLACE(end_time, ' ', 'T'), '+00:00', 'Z') > ?
            """,
            (FAVORITE_KEYWORD, cutoff),
        )
        return cur.rowcount


# ── Watchlist ───────────────────────────────────────────────────────────────

def add_to_watchlist(item: Dict[str, Any]) -> None:
    if using_postgres():
        user_id = item.get("user_id")
        if not user_id:
            raise ValueError("user_id required")
        sgw_account_id = item.get("sgw_account_id") or get_primary_sgw_account_id(user_id)
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO watchlist (
                    user_id, item_id, sgw_account_id, title, max_bid, current_bid, end_time,
                    sgw_url, image_url, ebay_median, profit, ebay_search
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                ON CONFLICT (user_id, item_id) DO UPDATE SET
                    max_bid = EXCLUDED.max_bid,
                    current_bid = EXCLUDED.current_bid,
                    end_time = EXCLUDED.end_time,
                    sgw_url = COALESCE(EXCLUDED.sgw_url, watchlist.sgw_url),
                    image_url = COALESCE(EXCLUDED.image_url, watchlist.image_url),
                    ebay_median = COALESCE(EXCLUDED.ebay_median, watchlist.ebay_median),
                    profit = COALESCE(EXCLUDED.profit, watchlist.profit),
                    ebay_search = COALESCE(EXCLUDED.ebay_search, watchlist.ebay_search),
                    sgw_account_id = COALESCE(EXCLUDED.sgw_account_id, watchlist.sgw_account_id),
                    sniper_status = 'scheduled'
                """,
                (
                    str(user_id),
                    item["item_id"],
                    sgw_account_id,
                    item["title"],
                    item["max_bid"],
                    item.get("current_bid"),
                    item.get("end_time"),
                    item.get("sgw_url"),
                    item.get("image_url"),
                    item.get("ebay_median"),
                    item.get("profit"),
                    item.get("ebay_search"),
                ),
            )
        return

    owner = get_default_owner()
    payload = {
        **item,
        "user_id": item.get("user_id") or owner["user_id"],
        "sgw_account_id": item.get("sgw_account_id") or owner["sgw_account_id"],
    }
    with get_conn() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO watchlist (
                item_id, title, max_bid, current_bid, end_time,
                sgw_url, image_url, ebay_median, profit, ebay_search,
                user_id, sgw_account_id
            ) VALUES (
                :item_id, :title, :max_bid, :current_bid, :end_time,
                :sgw_url, :image_url, :ebay_median, :profit, :ebay_search,
                :user_id, :sgw_account_id
            )
        """, payload)


def backfill_watchlist_from_deals() -> int:
    """Copy image/eBay fields from deals onto watchlist rows that are missing them."""
    with get_conn() as conn:
        cur = conn.execute("""
            UPDATE watchlist
            SET
                image_url = COALESCE(
                    watchlist.image_url,
                    (SELECT d.image_url FROM deals d WHERE d.item_id = watchlist.item_id)
                ),
                ebay_median = COALESCE(
                    watchlist.ebay_median,
                    (SELECT d.ebay_median FROM deals d WHERE d.item_id = watchlist.item_id)
                ),
                profit = COALESCE(
                    watchlist.profit,
                    (SELECT d.profit FROM deals d WHERE d.item_id = watchlist.item_id)
                ),
                ebay_search = COALESCE(
                    watchlist.ebay_search,
                    (SELECT d.ebay_search FROM deals d WHERE d.item_id = watchlist.item_id)
                )
            WHERE
                (image_url IS NULL OR ebay_median IS NULL OR profit IS NULL OR ebay_search IS NULL)
                AND EXISTS (SELECT 1 FROM deals d WHERE d.item_id = watchlist.item_id)
        """)
        return cur.rowcount


def sync_ebay_search_to_titles() -> int:
    """Fill empty ebay_search from the listing title. Never overwrite a custom term."""
    with get_conn() as conn:
        deals = conn.execute("""
            UPDATE deals
            SET ebay_search = TRIM(title)
            WHERE title IS NOT NULL AND TRIM(title) != ''
              AND (ebay_search IS NULL OR TRIM(ebay_search) = '')
        """)
        watch = conn.execute("""
            UPDATE watchlist
            SET ebay_search = TRIM(title)
            WHERE title IS NOT NULL AND TRIM(title) != ''
              AND (ebay_search IS NULL OR TRIM(ebay_search) = '')
        """)
        return (deals.rowcount or 0) + (watch.rowcount or 0)


def update_watchlist_pricing(
    item_id: int,
    ebay_median: float,
    profit: float,
    ebay_search: str,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """UPDATE watchlist SET ebay_median = ?, profit = ?, ebay_search = ?
               WHERE item_id = ?""",
            (ebay_median, profit, ebay_search, item_id),
        )


def get_watchlist(user_id: Optional[UserId] = None) -> List[Dict]:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            rows = conn.execute(
                """
                SELECT * FROM watchlist
                WHERE user_id = ?
                ORDER BY added_at DESC, item_id DESC
                """,
                (str(user_id),),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM watchlist ORDER BY added_at DESC, item_id DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def remove_from_watchlist(item_id: int, user_id: Optional[UserId] = None) -> None:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            wl = conn.execute(
                "SELECT id FROM watchlist WHERE user_id = ? AND item_id = ?",
                (str(user_id), item_id),
            ).fetchone()
            if wl:
                conn.execute(
                    """
                    UPDATE snipe_jobs
                    SET status = 'cancelled', updated_at = now(),
                        lease_owner = NULL, lease_until = NULL
                    WHERE watchlist_id = ? AND status IN ('pending', 'leased')
                    """,
                    (wl["id"],),
                )
                conn.execute(
                    "DELETE FROM watchlist WHERE id = ?",
                    (wl["id"],),
                )
            return
        conn.execute(
            """
            UPDATE snipe_jobs
            SET status = 'cancelled', updated_at = datetime('now'),
                lease_owner = NULL, lease_until = NULL
            WHERE watchlist_item_id = ? AND status IN ('pending', 'leased')
            """,
            (item_id,),
        )
        conn.execute("DELETE FROM watchlist WHERE item_id = ?", (item_id,))


def update_watchlist_max_bid(item_id: int, max_bid: float, user_id: Optional[UserId] = None) -> None:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            conn.execute(
                "UPDATE watchlist SET max_bid = ? WHERE user_id = ? AND item_id = ?",
                (max_bid, str(user_id), item_id),
            )
            row = conn.execute(
                "SELECT id, end_time, user_id, sgw_account_id FROM watchlist WHERE user_id = ? AND item_id = ?",
                (str(user_id), item_id),
            ).fetchone()
        else:
            conn.execute(
                "UPDATE watchlist SET max_bid = ? WHERE item_id = ?",
                (max_bid, item_id),
            )
            row = conn.execute(
                "SELECT end_time, user_id, sgw_account_id FROM watchlist WHERE item_id = ?",
                (item_id,),
            ).fetchone()
    if row:
        upsert_snipe_job(
            item_id,
            max_bid,
            row["end_time"],
            user_id=row["user_id"],
            sgw_account_id=row.get("sgw_account_id"),
            watchlist_id=row.get("id"),
        )


def update_watchlist_live_bid(
    item_id: int,
    current_bid: float,
    end_time: Optional[str] = None,
) -> None:
    """Refresh the live auction price (and optionally end time) on a watchlist row."""
    with get_conn() as conn:
        if end_time is not None:
            conn.execute(
                "UPDATE watchlist SET current_bid = ?, end_time = ? WHERE item_id = ?",
                (current_bid, end_time, item_id),
            )
        else:
            conn.execute(
                "UPDATE watchlist SET current_bid = ? WHERE item_id = ?",
                (current_bid, item_id),
            )
        row = conn.execute(
            "SELECT max_bid, end_time, user_id, sgw_account_id, sniper_status FROM watchlist WHERE item_id = ?",
            (item_id,),
        ).fetchone()
    if row and (row["sniper_status"] or "scheduled").lower() == "scheduled":
        upsert_snipe_job(
            item_id,
            float(row["max_bid"]),
            row["end_time"],
            user_id=row["user_id"],
            sgw_account_id=row["sgw_account_id"],
        )


def update_watchlist_status(item_id: int, status: str, user_id: Optional[UserId] = None) -> None:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            conn.execute(
                "UPDATE watchlist SET sniper_status = ? WHERE user_id = ? AND item_id = ?",
                (status, str(user_id), item_id),
            )
        else:
            conn.execute(
                "UPDATE watchlist SET sniper_status = ? WHERE item_id = ?",
                (status, item_id),
            )


def update_watchlist_result(
    item_id: int,
    status: str,
    final_price: Optional[float],
    final_shipping: Optional[float],
    user_id: Optional[UserId] = None,
) -> None:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            conn.execute(
                """
                UPDATE watchlist
                SET sniper_status = ?, final_price = ?, final_shipping = ?
                WHERE user_id = ? AND item_id = ?
                """,
                (status, final_price, final_shipping, str(user_id), item_id),
            )
        else:
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


# ── Multi-tenant seed + durable snipe jobs ──────────────────────────────────

def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_end_time_utc(end_time_str: Optional[str]) -> Optional[datetime]:
    """Parse watchlist/job end times (UTC ISO or naive Pacific) to aware UTC."""
    if not end_time_str:
        return None
    raw = str(end_time_str).strip()
    try:
        if raw.endswith("Z") or "+" in raw[10:] or raw.endswith("-00:00"):
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        # Naive → treat as America/Los_Angeles (SGW favorite style)
        from zoneinfo import ZoneInfo
        fmt = "%Y-%m-%dT%H:%M:%S"
        if "." in raw:
            fmt += ".%f"
        dt = datetime.strptime(raw, fmt).replace(tzinfo=ZoneInfo("America/Los_Angeles"))
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def compute_snipe_at(end_time_str: Optional[str], snipe_seconds_before: int) -> Optional[str]:
    end_dt = parse_end_time_utc(end_time_str)
    if end_dt is None:
        return None
    snipe_at = end_dt - timedelta(seconds=max(1, int(snipe_seconds_before)))
    return snipe_at.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_default_owner() -> Dict[str, int]:
    """Return the seeded local owner user_id + env sgw_account_id."""
    with get_conn() as conn:
        user = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        if not user:
            cur = conn.execute("INSERT INTO users (email) VALUES (?)", ("owner@local",))
            user_id = cur.lastrowid
        else:
            user_id = user["id"]
        acct = conn.execute(
            "SELECT id FROM sgw_accounts WHERE user_id = ? AND auth_source = 'env' LIMIT 1",
            (user_id,),
        ).fetchone()
        if not acct:
            cur = conn.execute(
                """
                INSERT INTO sgw_accounts (user_id, label, auth_source, status)
                VALUES (?, 'Default (env)', 'env', 'active')
                """,
                (user_id,),
            )
            account_id = cur.lastrowid
        else:
            account_id = acct["id"]
    return {"user_id": int(user_id), "sgw_account_id": int(account_id)}


def get_sgw_account(account_id: int) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sgw_accounts WHERE id = ?", (account_id,)
        ).fetchone()
    return dict(row) if row else None


def _snipe_seconds_before_conn(conn) -> int:
    row = conn.execute(
        "SELECT value FROM settings WHERE key = 'snipe_seconds_before'"
    ).fetchone()
    if not row:
        return 5
    try:
        return int(json.loads(row["value"]))
    except Exception:
        try:
            return int(row["value"])
        except Exception:
            return 5


def _backfill_snipe_jobs_conn(conn) -> int:
    """Create pending jobs for scheduled watchlist rows that lack one."""
    snipe_secs = _snipe_seconds_before_conn(conn)
    owner_user = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
    owner_acct = conn.execute(
        "SELECT id FROM sgw_accounts WHERE auth_source = 'env' ORDER BY id LIMIT 1"
    ).fetchone()
    user_id = owner_user["id"] if owner_user else None
    account_id = owner_acct["id"] if owner_acct else None
    rows = conn.execute(
        """
        SELECT item_id, max_bid, end_time, user_id, sgw_account_id, sniper_status
        FROM watchlist
        WHERE LOWER(COALESCE(sniper_status, 'scheduled')) = 'scheduled'
        """
    ).fetchall()
    created = 0
    for w in rows:
        existing = conn.execute(
            "SELECT id, status FROM snipe_jobs WHERE watchlist_item_id = ?",
            (w["item_id"],),
        ).fetchone()
        snipe_at = compute_snipe_at(w["end_time"], snipe_secs)
        if not snipe_at:
            continue
        if existing:
            if existing["status"] in ("pending", "leased"):
                conn.execute(
                    """
                    UPDATE snipe_jobs
                    SET max_bid = ?, end_time = ?, snipe_at = ?,
                        user_id = COALESCE(user_id, ?),
                        sgw_account_id = COALESCE(sgw_account_id, ?),
                        updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        w["max_bid"],
                        w["end_time"],
                        snipe_at,
                        w["user_id"] or user_id,
                        w["sgw_account_id"] or account_id,
                        existing["id"],
                    ),
                )
            continue
        conn.execute(
            """
            INSERT INTO snipe_jobs (
                watchlist_item_id, user_id, sgw_account_id,
                max_bid, end_time, snipe_at, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
            """,
            (
                w["item_id"],
                w["user_id"] or user_id,
                w["sgw_account_id"] or account_id,
                w["max_bid"],
                w["end_time"],
                snipe_at,
            ),
        )
        created += 1
    return created


def backfill_snipe_jobs() -> int:
    with get_conn() as conn:
        return _backfill_snipe_jobs_conn(conn)


def upsert_snipe_job(
    item_id: int,
    max_bid: float,
    end_time: Optional[str],
    user_id: Optional[UserId] = None,
    sgw_account_id: Optional[int] = None,
    snipe_seconds_before: Optional[int] = None,
    watchlist_id: Optional[int] = None,
) -> Optional[int]:
    """Create or refresh a pending snipe job for a watchlist item."""
    if using_postgres():
        if user_id is None:
            raise ValueError("user_id required on Postgres")
        if snipe_seconds_before is None:
            settings = get_settings(user_id)
            snipe_seconds_before = int(settings.get("snipe_seconds_before", 5))
        snipe_at = compute_snipe_at(end_time, int(snipe_seconds_before))
        if not snipe_at:
            return None
        if sgw_account_id is None:
            sgw_account_id = get_primary_sgw_account_id(user_id)
        with get_conn() as conn:
            if watchlist_id is None:
                wl = conn.execute(
                    "SELECT id, sgw_account_id FROM watchlist WHERE user_id = ? AND item_id = ?",
                    (str(user_id), item_id),
                ).fetchone()
                if not wl:
                    return None
                watchlist_id = wl["id"]
                sgw_account_id = sgw_account_id or wl.get("sgw_account_id")
            existing = conn.execute(
                "SELECT id, status FROM snipe_jobs WHERE watchlist_id = ?",
                (watchlist_id,),
            ).fetchone()
            if existing and existing["status"] in ("fired", "done"):
                return existing["id"]
            if existing:
                conn.execute(
                    """
                    UPDATE snipe_jobs SET
                        max_bid = ?, end_time = ?, snipe_at = ?,
                        user_id = ?, sgw_account_id = ?, item_id = ?,
                        status = CASE
                            WHEN status = 'cancelled' THEN 'pending'
                            WHEN status = 'leased' THEN status
                            ELSE 'pending'
                        END,
                        last_error = NULL,
                        updated_at = now()
                    WHERE id = ?
                    """,
                    (
                        max_bid, end_time, snipe_at,
                        str(user_id), sgw_account_id, item_id,
                        existing["id"],
                    ),
                )
                return existing["id"]
            row = conn.execute(
                """
                INSERT INTO snipe_jobs (
                    watchlist_id, item_id, user_id, sgw_account_id,
                    max_bid, end_time, snipe_at, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', now())
                RETURNING id
                """,
                (watchlist_id, item_id, str(user_id), sgw_account_id, max_bid, end_time, snipe_at),
            ).fetchone()
            return int(row["id"])

    owner = get_default_owner()
    user_id = user_id or owner["user_id"]
    sgw_account_id = sgw_account_id or owner["sgw_account_id"]
    if snipe_seconds_before is None:
        settings = get_settings()
        snipe_seconds_before = int(settings.get("snipe_seconds_before", 5))
    snipe_at = compute_snipe_at(end_time, int(snipe_seconds_before))
    if not snipe_at:
        return None

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM snipe_jobs WHERE watchlist_item_id = ?",
            (item_id,),
        ).fetchone()
        if existing and existing["status"] in ("fired", "done"):
            return existing["id"]
        if existing:
            conn.execute(
                """
                UPDATE snipe_jobs SET
                    max_bid = ?, end_time = ?, snipe_at = ?,
                    user_id = ?, sgw_account_id = ?,
                    status = CASE
                        WHEN status = 'cancelled' THEN 'pending'
                        WHEN status = 'leased' THEN status
                        ELSE 'pending'
                    END,
                    last_error = NULL,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (max_bid, end_time, snipe_at, user_id, sgw_account_id, existing["id"]),
            )
            return existing["id"]
        cur = conn.execute(
            """
            INSERT INTO snipe_jobs (
                watchlist_item_id, user_id, sgw_account_id,
                max_bid, end_time, snipe_at, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
            """,
            (item_id, user_id, sgw_account_id, max_bid, end_time, snipe_at),
        )
        return cur.lastrowid


def cancel_snipe_job(item_id: int, user_id: Optional[UserId] = None) -> None:
    with get_conn() as conn:
        if using_postgres() and user_id is not None:
            conn.execute(
                """
                UPDATE snipe_jobs
                SET status = 'cancelled', updated_at = now(),
                    lease_owner = NULL, lease_until = NULL
                WHERE item_id = ? AND user_id = ? AND status IN ('pending', 'leased')
                """,
                (item_id, str(user_id)),
            )
            return
        conn.execute(
            """
            UPDATE snipe_jobs
            SET status = 'cancelled', updated_at = datetime('now'),
                lease_owner = NULL, lease_until = NULL
            WHERE watchlist_item_id = ? AND status IN ('pending', 'leased')
            """,
            (item_id,),
        )


def refresh_pending_snipe_times(snipe_seconds_before: Optional[int] = None) -> int:
    """Recompute snipe_at for all pending jobs (e.g. after settings change)."""
    if snipe_seconds_before is None:
        snipe_seconds_before = int(get_settings().get("snipe_seconds_before", 5))
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, end_time FROM snipe_jobs WHERE status = 'pending'"
        ).fetchall()
        n = 0
        for r in rows:
            snipe_at = compute_snipe_at(r["end_time"], int(snipe_seconds_before))
            if not snipe_at:
                continue
            conn.execute(
                """
                UPDATE snipe_jobs SET snipe_at = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (snipe_at, r["id"]),
            )
            n += 1
    return n


def reclaim_expired_snipe_leases() -> int:
    """Return leased jobs whose lease expired back to pending."""
    now = _utcnow_iso()
    with get_conn() as conn:
        cur = conn.execute(
            """
            UPDATE snipe_jobs
            SET status = 'pending', lease_owner = NULL, lease_until = NULL,
                updated_at = datetime('now')
            WHERE status = 'leased'
              AND lease_until IS NOT NULL
              AND lease_until < ?
            """,
            (now,),
        )
        return cur.rowcount


def soonest_pending_snipe_seconds() -> Optional[float]:
    """Seconds until the soonest pending snipe_at (None if none)."""
    now = datetime.now(timezone.utc)
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT snipe_at FROM snipe_jobs
            WHERE status = 'pending'
            ORDER BY snipe_at ASC
            LIMIT 1
            """
        ).fetchone()
    if not row or not row["snipe_at"]:
        return None
    dt = parse_end_time_utc(row["snipe_at"])
    if dt is None:
        return None
    return (dt - now).total_seconds()


def claim_due_snipe_jobs(
    worker_id: str,
    lease_seconds: int = 60,
    look_ahead_seconds: int = 2,
    limit: int = 10,
) -> List[Dict]:
    """
    Atomically claim pending jobs whose snipe_at is due (or within look_ahead).
    Returns claimed job dicts.
    """
    now = datetime.now(timezone.utc)
    due_before = (now + timedelta(seconds=look_ahead_seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")
    lease_until = (now + timedelta(seconds=lease_seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")
    claimed: List[Dict] = []

    with get_conn() as conn:
        # Reclaim stale leases first
        conn.execute(
            """
            UPDATE snipe_jobs
            SET status = 'pending', lease_owner = NULL, lease_until = NULL,
                updated_at = datetime('now')
            WHERE status = 'leased'
              AND lease_until IS NOT NULL
              AND lease_until < ?
            """,
            (_utcnow_iso(),),
        )
        rows = conn.execute(
            """
            SELECT * FROM snipe_jobs
            WHERE status = 'pending'
              AND snipe_at <= ?
            ORDER BY snipe_at ASC
            LIMIT ?
            """,
            (due_before, limit),
        ).fetchall()
        for r in rows:
            cur = conn.execute(
                """
                UPDATE snipe_jobs
                SET status = 'leased',
                    lease_owner = ?,
                    lease_until = ?,
                    attempt_count = attempt_count + 1,
                    updated_at = datetime('now')
                WHERE id = ? AND status = 'pending'
                """,
                (worker_id, lease_until, r["id"]),
            )
            if cur.rowcount:
                job = dict(r)
                job["status"] = "leased"
                job["lease_owner"] = worker_id
                job["lease_until"] = lease_until
                job["attempt_count"] = int(r["attempt_count"] or 0) + 1
                # Normalize SGW item id across SQLite (watchlist_item_id) and Postgres (item_id)
                if job.get("item_id") is None and job.get("watchlist_item_id") is not None:
                    job["item_id"] = job["watchlist_item_id"]
                claimed.append(job)
    return claimed


def complete_snipe_job(
    job_id: int,
    status: str = "done",
    last_error: Optional[str] = None,
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE snipe_jobs
            SET status = ?, last_error = ?, lease_owner = NULL, lease_until = NULL,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (status, last_error, job_id),
        )


def release_snipe_job(job_id: int, last_error: Optional[str] = None, retry: bool = True) -> None:
    """Release a lease — retry as pending or mark done with error."""
    with get_conn() as conn:
        if retry:
            conn.execute(
                """
                UPDATE snipe_jobs
                SET status = 'pending', last_error = ?, lease_owner = NULL,
                    lease_until = NULL, updated_at = datetime('now')
                WHERE id = ?
                """,
                (last_error, job_id),
            )
        else:
            conn.execute(
                """
                UPDATE snipe_jobs
                SET status = 'done', last_error = ?, lease_owner = NULL,
                    lease_until = NULL, updated_at = datetime('now')
                WHERE id = ?
                """,
                (last_error, job_id),
            )


def mark_snipe_job_fired(job_id: int) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE snipe_jobs
            SET status = 'fired', updated_at = datetime('now')
            WHERE id = ?
            """,
            (job_id,),
        )


def get_snipe_job_for_item(item_id: int, user_id: Optional[UserId] = None) -> Optional[Dict]:
    with get_conn() as conn:
        if using_postgres():
            if user_id is not None:
                row = conn.execute(
                    "SELECT * FROM snipe_jobs WHERE item_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
                    (item_id, str(user_id)),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM snipe_jobs WHERE item_id = ? ORDER BY id DESC LIMIT 1",
                    (item_id,),
                ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM snipe_jobs WHERE watchlist_item_id = ?",
                (item_id,),
            ).fetchone()
    return dict(row) if row else None


# ── Settings ────────────────────────────────────────────────────────────────

_USER_SETTING_KEYS = {
    "snipe_seconds_before",
    "your_zip_code",
    "ebay_fee_pct",
    "ebay_resale_shipping",
    "ebay_display_mode",
    "ebay_days_back",
}


def get_settings(user_id: Optional[UserId] = None) -> Dict[str, Any]:
    """Merge app-wide + per-user settings (Postgres) or legacy settings table (SQLite)."""
    result: Dict[str, Any] = {}
    with get_conn() as conn:
        if using_postgres():
            rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
            for row in rows:
                try:
                    result[row["key"]] = json.loads(row["value"])
                except (json.JSONDecodeError, TypeError):
                    result[row["key"]] = row["value"]
            if user_id is not None:
                us = conn.execute(
                    "SELECT * FROM user_settings WHERE user_id = ?",
                    (str(user_id),),
                ).fetchone()
                if us:
                    for k in _USER_SETTING_KEYS:
                        if k in us and us[k] is not None:
                            result[k] = us[k]
                else:
                    # defaults
                    result.setdefault("snipe_seconds_before", 5)
                    result.setdefault("your_zip_code", "90210")
                    result.setdefault("ebay_fee_pct", 13)
                    result.setdefault("ebay_resale_shipping", 7)
                    result.setdefault("ebay_display_mode", "net")
                    result.setdefault("ebay_days_back", 90)
        else:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            for row in rows:
                try:
                    result[row["key"]] = json.loads(row["value"])
                except (json.JSONDecodeError, TypeError):
                    result[row["key"]] = row["value"]
    return result


def update_setting(key: str, value: Any, user_id: Optional[UserId] = None) -> None:
    with get_conn() as conn:
        if using_postgres():
            if key in _USER_SETTING_KEYS:
                if user_id is None:
                    raise ValueError(f"{key} requires user_id")
                # Ensure row exists
                conn.execute(
                    "INSERT INTO user_settings (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING",
                    (str(user_id),),
                )
                conn.execute(
                    f"UPDATE user_settings SET {key} = ?, updated_at = now() WHERE user_id = ?",
                    (value, str(user_id)),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO app_settings (key, value) VALUES (?, ?)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    (key, json.dumps(value)),
                )
        else:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )


def ensure_user_profile(user_id: UserId, email: Optional[str] = None) -> None:
    """Idempotent profile + settings bootstrap (service role)."""
    if not using_postgres():
        return
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO profiles (id, email) VALUES (?, ?)
            ON CONFLICT (id) DO UPDATE SET
              email = COALESCE(EXCLUDED.email, profiles.email),
              updated_at = now()
            """,
            (str(user_id), email),
        )
        conn.execute(
            "INSERT INTO user_settings (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING",
            (str(user_id),),
        )


# ── SGW accounts (encrypted) ────────────────────────────────────────────────

def list_sgw_accounts(user_id: UserId) -> List[Dict]:
    with get_conn() as conn:
        if using_postgres():
            rows = conn.execute(
                """
                SELECT id, user_id, label, auth_source, status, last_verified_at,
                       last_error, key_version, created_at, updated_at
                FROM sgw_accounts WHERE user_id = ? ORDER BY id
                """,
                (str(user_id),),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, user_id, label, auth_source, status, created_at
                FROM sgw_accounts WHERE user_id = ? ORDER BY id
                """,
                (user_id,),
            ).fetchall()
    return [dict(r) for r in rows]


def get_sgw_account_secrets(account_id: int) -> Optional[Dict]:
    """Service-role only — includes ciphertext fields."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sgw_accounts WHERE id = ?", (account_id,)
        ).fetchone()
    return dict(row) if row else None


def upsert_user_sgw_account(
    user_id: UserId,
    *,
    label: str,
    encrypted_username: str,
    encrypted_password: str,
    nonce: str,
    key_version: int,
    status: str = "pending",
    last_error: Optional[str] = None,
) -> int:
    with get_conn() as conn:
        if using_postgres():
            existing = conn.execute(
                "SELECT id FROM sgw_accounts WHERE user_id = ? AND auth_source = 'user' ORDER BY id LIMIT 1",
                (str(user_id),),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE sgw_accounts SET
                      label = ?, encrypted_username = ?, encrypted_password = ?,
                      nonce = ?, key_version = ?, status = ?, last_error = ?,
                      updated_at = now()
                    WHERE id = ?
                    """,
                    (
                        label, encrypted_username, encrypted_password,
                        nonce, key_version, status, last_error, existing["id"],
                    ),
                )
                return int(existing["id"])
            row = conn.execute(
                """
                INSERT INTO sgw_accounts (
                  user_id, label, auth_source, encrypted_username, encrypted_password,
                  nonce, key_version, status, last_error
                ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                (
                    str(user_id), label, encrypted_username, encrypted_password,
                    nonce, key_version, status, last_error,
                ),
            ).fetchone()
            return int(row["id"])
        # SQLite fallback (dev)
        existing = conn.execute(
            "SELECT id FROM sgw_accounts WHERE user_id = ? ORDER BY id LIMIT 1",
            (user_id,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE sgw_accounts SET label = ?, encrypted_username = ?,
                  encrypted_password = ?, status = ?
                WHERE id = ?
                """,
                (label, encrypted_username, encrypted_password, status, existing["id"]),
            )
            return int(existing["id"])
        cur = conn.execute(
            """
            INSERT INTO sgw_accounts (user_id, label, auth_source, encrypted_username, encrypted_password, status)
            VALUES (?, ?, 'user', ?, ?, ?)
            """,
            (user_id, label, encrypted_username, encrypted_password, status),
        )
        return int(cur.lastrowid)


def mark_sgw_account_verified(account_id: int, ok: bool, error: Optional[str] = None) -> None:
    with get_conn() as conn:
        if using_postgres():
            conn.execute(
                """
                UPDATE sgw_accounts SET
                  status = ?, last_verified_at = CASE WHEN ? THEN now() ELSE last_verified_at END,
                  last_error = ?, updated_at = now()
                WHERE id = ?
                """,
                ("active" if ok else "invalid", ok, error, account_id),
            )
        else:
            conn.execute(
                "UPDATE sgw_accounts SET status = ? WHERE id = ?",
                ("active" if ok else "invalid", account_id),
            )


def get_primary_sgw_account_id(user_id: UserId) -> Optional[int]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id FROM sgw_accounts
            WHERE user_id = ? AND status IN ('active', 'pending')
            ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, id
            LIMIT 1
            """,
            (str(user_id) if using_postgres() else user_id,),
        ).fetchone()
    return int(row["id"]) if row else None


def list_sgw_accounts_due_reverify(stale_hours: int = 24, limit: int = 20) -> List[Dict]:
    """User-stored accounts that need a fresh login check."""
    with get_conn() as conn:
        if using_postgres():
            rows = conn.execute(
                """
                SELECT id, user_id, label, status, last_verified_at
                FROM sgw_accounts
                WHERE auth_source = 'user'
                  AND encrypted_username IS NOT NULL
                  AND status IN ('active', 'pending')
                  AND (
                    last_verified_at IS NULL
                    OR last_verified_at < now() - (? || ' hours')::interval
                  )
                ORDER BY last_verified_at NULLS FIRST
                LIMIT ?
                """,
                (str(int(stale_hours)), limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, user_id, label, status, created_at AS last_verified_at
                FROM sgw_accounts
                WHERE auth_source = 'user'
                  AND encrypted_username IS NOT NULL
                  AND status IN ('active', 'pending')
                ORDER BY id
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


# ── eBay price cache (Postgres) ─────────────────────────────────────────────

def ebay_cache_get(cache_key: str) -> Optional[Dict]:
    if not using_postgres():
        return None
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT payload FROM ebay_price_cache
            WHERE cache_key = ? AND expires_at > now()
            """,
            (cache_key,),
        ).fetchone()
    if not row:
        return None
    payload = row["payload"]
    return payload if isinstance(payload, dict) else json.loads(payload)


def ebay_cache_set(cache_key: str, payload: Dict, ttl_seconds: int = 14400) -> None:
    if not using_postgres():
        return
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO ebay_price_cache (cache_key, payload, expires_at)
            VALUES (?, ?::jsonb, now() + (? || ' seconds')::interval)
            ON CONFLICT (cache_key) DO UPDATE SET
              payload = EXCLUDED.payload,
              expires_at = EXCLUDED.expires_at
            """,
            (cache_key, json.dumps(payload), str(int(ttl_seconds))),
        )


# ── Scan log ────────────────────────────────────────────────────────────────

def log_scan_start() -> int:
    with get_conn() as conn:
        if using_postgres():
            row = conn.execute(
                "INSERT INTO scan_log (started_at) VALUES (now()) RETURNING id"
            ).fetchone()
            return int(row["id"])
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

