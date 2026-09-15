#!/usr/bin/env python3
"""
One-time SQLite → Postgres migration.

Usage (on a machine with both DBs reachable):

  export DATABASE_URL=postgresql://...
  export OWNER_USER_ID=<supabase-auth-user-uuid>
  python migrate_sqlite_to_postgres.py

Assigns existing watchlist / snipe_jobs / deals to OWNER_USER_ID.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SQLITE_PATH = Path(__file__).parent / "arbitrage.db"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
OWNER_USER_ID = os.getenv("OWNER_USER_ID", "").strip()


def main():
    if not DATABASE_URL:
        print("DATABASE_URL required", file=sys.stderr)
        sys.exit(1)
    if not OWNER_USER_ID:
        print("OWNER_USER_ID (Supabase auth user UUID) required", file=sys.stderr)
        sys.exit(1)
    if not SQLITE_PATH.exists():
        print(f"No SQLite DB at {SQLITE_PATH}", file=sys.stderr)
        sys.exit(1)

    import psycopg
    from psycopg.rows import dict_row

    sq = sqlite3.connect(SQLITE_PATH)
    sq.row_factory = sqlite3.Row

    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as pg:
        # Profile
        email_row = sq.execute("SELECT email FROM users ORDER BY id LIMIT 1").fetchone()
        sqlite_email = (email_row["email"] if email_row else None) or ""
        # Prefer the live Auth email; never clobber a real signup with owner@local.
        email = sqlite_email if sqlite_email and sqlite_email != "owner@local" else None
        pg.execute(
            """
            INSERT INTO profiles (id, email) VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET
              email = COALESCE(profiles.email, EXCLUDED.email)
            """,
            (OWNER_USER_ID, email),
        )
        pg.execute(
            "INSERT INTO user_settings (user_id) VALUES (%s) ON CONFLICT DO NOTHING",
            (OWNER_USER_ID,),
        )

        # App settings from legacy settings
        for row in sq.execute("SELECT key, value FROM settings").fetchall():
            key = row["key"]
            if key in (
                "snipe_seconds_before",
                "your_zip_code",
                "ebay_fee_pct",
                "ebay_resale_shipping",
                "ebay_display_mode",
                "ebay_days_back",
            ):
                try:
                    val = json.loads(row["value"])
                except Exception:
                    val = row["value"]
                pg.execute(
                    f"UPDATE user_settings SET {key} = %s WHERE user_id = %s",
                    (val, OWNER_USER_ID),
                )
            else:
                pg.execute(
                    """
                    INSERT INTO app_settings (key, value) VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    (key, row["value"]),
                )

        # Deals
        deals = sq.execute("SELECT * FROM deals").fetchall()
        for d in deals:
            pg.execute(
                """
                INSERT INTO deals (
                  item_id, title, sgw_url, current_bid, shipping_est, end_time,
                  seller_id, image_url, keyword, ebay_median, ebay_low, ebay_high,
                  ebay_sold_count, ebay_search, profit, margin, status, skip_reason
                ) VALUES (
                  %(item_id)s, %(title)s, %(sgw_url)s, %(current_bid)s, %(shipping_est)s, %(end_time)s,
                  %(seller_id)s, %(image_url)s, %(keyword)s, %(ebay_median)s, %(ebay_low)s, %(ebay_high)s,
                  %(ebay_sold_count)s, %(ebay_search)s, %(profit)s, %(margin)s, %(status)s, %(skip_reason)s
                )
                ON CONFLICT (item_id) DO NOTHING
                """,
                dict(d),
            )
        print(f"Migrated {len(deals)} deals")

        # SGW env account placeholder
        acct = pg.execute(
            """
            INSERT INTO sgw_accounts (user_id, label, auth_source, status)
            VALUES (%s, 'Migrated (env)', 'env', 'active')
            RETURNING id
            """,
            (OWNER_USER_ID,),
        ).fetchone()
        account_id = acct["id"]

        # Watchlist
        watch = sq.execute("SELECT * FROM watchlist").fetchall()
        id_map = {}  # old item_id -> new watchlist.id
        for w in watch:
            row = pg.execute(
                """
                INSERT INTO watchlist (
                  user_id, item_id, sgw_account_id, title, max_bid, current_bid, end_time,
                  sgw_url, image_url, ebay_median, profit, ebay_search, sniper_status,
                  final_price, final_shipping, handling_price, tax, order_id,
                  tracking_number, shipper_name, due_date
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (user_id, item_id) DO UPDATE SET max_bid = EXCLUDED.max_bid
                RETURNING id, item_id
                """,
                (
                    OWNER_USER_ID,
                    w["item_id"],
                    account_id,
                    w["title"],
                    w["max_bid"],
                    w["current_bid"],
                    w["end_time"],
                    w["sgw_url"],
                    w["image_url"],
                    w["ebay_median"],
                    w["profit"],
                    w["ebay_search"] if "ebay_search" in w.keys() else None,
                    w["sniper_status"],
                    w["final_price"] if "final_price" in w.keys() else None,
                    w["final_shipping"] if "final_shipping" in w.keys() else None,
                    w["handling_price"] if "handling_price" in w.keys() else None,
                    w["tax"] if "tax" in w.keys() else None,
                    w["order_id"] if "order_id" in w.keys() else None,
                    w["tracking_number"] if "tracking_number" in w.keys() else None,
                    w["shipper_name"] if "shipper_name" in w.keys() else None,
                    w["due_date"] if "due_date" in w.keys() else None,
                ),
            ).fetchone()
            id_map[w["item_id"]] = row["id"]
        print(f"Migrated {len(watch)} watchlist rows")

        # Snipe jobs
        jobs = sq.execute("SELECT * FROM snipe_jobs").fetchall()
        n_jobs = 0
        for j in jobs:
            wl_id = id_map.get(j["watchlist_item_id"])
            if not wl_id:
                continue
            pg.execute(
                """
                INSERT INTO snipe_jobs (
                  watchlist_id, item_id, user_id, sgw_account_id,
                  max_bid, end_time, snipe_at, status, attempt_count, last_error
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (watchlist_id) DO NOTHING
                """,
                (
                    wl_id,
                    j["watchlist_item_id"],
                    OWNER_USER_ID,
                    account_id,
                    j["max_bid"],
                    j["end_time"],
                    j["snipe_at"],
                    j["status"],
                    j["attempt_count"] or 0,
                    j["last_error"],
                ),
            )
            n_jobs += 1
        print(f"Migrated {n_jobs} snipe jobs")
        pg.commit()
        print("Done.")


if __name__ == "__main__":
    main()
