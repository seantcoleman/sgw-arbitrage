"""
FastAPI backend — serves the web dashboard.

Run with: uvicorn api:app --reload --port 8000
"""

import collections
import io
import json
import logging
import os
import subprocess
import sys
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import auth
import crypto_creds
import db
import ebay
import profit as profit_calc
import search_term
import shopgoodwill
from auth import RequireUser
from db_conn import using_postgres
from rate_limit import check_rate_limit

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_sniper_process: Optional[subprocess.Popen] = None
_scan_lock = threading.Lock()
_scan_running = False
_scheduler = BackgroundScheduler()
# Rolling sniper log buffer (most recent 500 lines) — also mirrored to disk
_sniper_logs: collections.deque = collections.deque(maxlen=500)
_SNIPER_LOG_PATH = os.path.join(os.path.dirname(__file__), "sniper_activity.log")
_sniper_log_lock = threading.Lock()


def _load_sniper_logs_from_disk() -> None:
    """Seed the in-memory buffer from the on-disk ring so UI survives restarts."""
    try:
        if not os.path.isfile(_SNIPER_LOG_PATH):
            return
        with open(_SNIPER_LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-500:]
        for raw in lines:
            raw = raw.rstrip("\n")
            if not raw:
                continue
            # Stored as "ISO-UTC\\tmessage" (or legacy "HH:MM:SS\\tmessage")
            if "\t" in raw:
                ts, line = raw.split("\t", 1)
            else:
                ts, line = "", raw
            _sniper_logs.append({"ts": ts, "line": line})
        logger.info(f"Loaded {len(_sniper_logs)} sniper log line(s) from disk")
    except Exception as e:
        logger.warning(f"Could not load sniper log file: {e}")


def _append_sniper_log(ts: str, line: str) -> None:
    entry = {"ts": ts, "line": line}
    _sniper_logs.append(entry)
    try:
        with _sniper_log_lock:
            with open(_SNIPER_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(f"{ts}\t{line}\n")
            # Trim file if it grows too large (~2000 lines)
            try:
                size = os.path.getsize(_SNIPER_LOG_PATH)
            except OSError:
                size = 0
            if size > 512_000:
                with open(_SNIPER_LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
                    keep = f.readlines()[-500:]
                with open(_SNIPER_LOG_PATH, "w", encoding="utf-8") as f:
                    f.writelines(keep)
    except Exception:
        pass


def _schedule_scan(interval_minutes: int) -> None:
    """(Re)schedule the recurring auto-scan job."""
    _scheduler.remove_all_jobs()
    if interval_minutes > 0:
        _scheduler.add_job(
            _run_scan,
            "interval",
            minutes=interval_minutes,
            id="auto_scan",
            replace_existing=True,
        )
        logger.info(f"Auto-scan scheduled every {interval_minutes} minutes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    logger.info("Database initialized")
    _load_sniper_logs_from_disk()
    n = db.backfill_watchlist_from_deals()
    if n:
        logger.info(f"Backfilled image/eBay fields on {n} watchlist row(s) from deals")
    synced = db.sync_ebay_search_to_titles()
    if synced:
        logger.info(f"Synced ebay_search to full title on {synced} row(s)")
    settings = db.get_settings()
    if not settings.get("healed_browse_stale_v1"):
        restored = db.reactivate_prematurely_ended_deals()
        db.update_setting("healed_browse_stale_v1", True)
        if restored:
            logger.info(
                f"Restored {restored} still-live deal(s) previously wiped by browse stale-mark"
            )
    if not settings.get("healed_missed_losses_v1"):
        n = _relabel_missed_losses()
        db.update_setting("healed_missed_losses_v1", True)
        if n:
            logger.info(f"Relabeled {n} no-bid loss(es) as missed")
    jobs = db.backfill_snipe_jobs()
    if jobs:
        logger.info(f"Backfilled {jobs} durable snipe job(s) from watchlist")
    reclaimed = db.reclaim_expired_snipe_leases()
    if reclaimed:
        logger.info(f"Reclaimed {reclaimed} expired snipe lease(s) on startup")
    # Catalog auto-scans are disabled to conserve eBay API quota.
    # Favorites scan + per-item reprice still call eBay on demand.
    logger.info("Catalog auto-scan disabled — use Favorites scan or Watchlist paste-URL reprice")
    _scheduler.add_job(
        _check_bid_results,
        "interval",
        minutes=3,
        id="bid_result_check",
        replace_existing=True,
    )
    _scheduler.add_job(
        db.prune_snipe_activity,
        "interval",
        hours=12,
        id="prune_snipe_activity",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started")
    # Auto-start in-process sniper unless workers own bidding
    if os.getenv("SNIPER_IN_API", "1").lower() not in ("0", "false", "no"):
        _ensure_sniper_running()
        _start_sniper_watchdog()
    else:
        logger.info("SNIPER_IN_API disabled — use sgw-worker@ units")
    # Run an immediate win-check sweep on startup
    threading.Thread(target=_check_bid_results, daemon=True, name="bid-result-startup").start()
    yield
    _scheduler.shutdown(wait=False)
    if _sniper_process and _sniper_process.poll() is None:
        _sniper_process.terminate()


def _ensure_sniper_running() -> None:
    """Start the sniper if it isn't already running."""
    global _sniper_process
    if _sniper_process and _sniper_process.poll() is None:
        return
    try:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        config = _build_sniper_config()
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        _sniper_process = subprocess.Popen(
            [sys.executable, "bid_sniper.py", "--config", config_path],
            cwd=os.path.dirname(__file__),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        threading.Thread(
            target=_tail_sniper_output,
            args=(_sniper_process,),
            daemon=True,
            name="sniper-tail",
        ).start()
        logger.info(f"Sniper started (pid={_sniper_process.pid})")
    except Exception as e:
        logger.error(f"Failed to start sniper: {e}")


def _tail_sniper_output(proc: subprocess.Popen) -> None:
    """Read sniper stdout line-by-line into the in-memory + on-disk log buffer."""
    try:
        for raw in proc.stdout:  # type: ignore[union-attr]
            line = raw.rstrip()
            # Canonical UTC ISO — UI converts to the viewer's local timezone
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            _append_sniper_log(ts, line)
            # Mirror to uvicorn console so nothing is lost
            logger.info(f"[sniper] {line}")
    except (ValueError, OSError):
        pass


def _start_sniper_watchdog() -> None:
    """Background thread that restarts the sniper if it dies."""
    def watchdog():
        while True:
            time.sleep(30)
            _ensure_sniper_running()
    t = threading.Thread(target=watchdog, daemon=True, name="sniper-watchdog")
    t.start()
    logger.info("Sniper watchdog started")


app = FastAPI(title="SGW Arbitrage API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # Vercel preview + production (*.vercel.app). Same-origin /backend proxy
    # is preferred; this covers direct browser calls if needed.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    user_id = "-"
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            from jose import jwt as jose_jwt
            token = auth_header.split(" ", 1)[1]
            # Logs only — do not treat this as authentication.
            claims = jose_jwt.get_unverified_claims(token)
            user_id = str(claims.get("sub") or "-")
        except Exception:
            user_id = "-"
    response = await call_next(request)
    ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request method=%s path=%s status=%s user_id=%s duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        user_id,
        ms,
    )
    return response


# ── Deals ──────────────────────────────────────────────────────────────────

@app.get("/deals")
def list_deals(
    user: RequireUser,
    min_profit: float = Query(0),
    min_margin: float = Query(0),
    status: str = Query("active"),
    limit: int = Query(200, le=500),
    offset: int = Query(0),
):
    # Hide auctions that have already ended even if a scan hasn't run yet
    if status == "active":
        expired = db.expire_past_deals()
        if expired:
            logger.info(f"Expired {expired} past-due deal(s)")
        settings = db.get_settings(user.id)
        if bool(settings.get("auctions_only", True)):
            dropped = db.end_long_horizon_deals(max_days=14)
            if dropped:
                logger.info(f"Ended {dropped} buy-now / long-horizon deal(s)")
    deals = db.get_deals(
        min_profit=0,
        min_margin=0,
        status=status,
        limit=500,
        offset=0,
    )
    fee_pct, resale_ship = profit_calc.fee_settings(db.get_settings(user.id))
    min_m = min_margin / 100 if min_margin > 1 else min_margin
    annotated = []
    for d in deals:
        row = profit_calc.annotate_deal(dict(d), fee_pct, resale_ship)
        profit = row.get("profit")
        margin = row.get("margin") or 0
        if profit is None:
            continue
        if profit < min_profit or margin < min_m:
            continue
        annotated.append(row)
    # Preserve profit-desc order after recompute
    annotated.sort(key=lambda x: x.get("profit") or 0, reverse=True)
    page = annotated[offset: offset + limit]
    return {"deals": page, "count": len(annotated)}


# ── Watchlist ───────────────────────────────────────────────────────────────

class WatchlistAddRequest(BaseModel):
    item_id: int
    max_bid: float


@app.get("/watchlist")
def get_watchlist(user: RequireUser):
    fee_pct, resale_ship = profit_calc.fee_settings(db.get_settings(user.id))
    items = [dict(w) for w in db.get_watchlist(user.id)]

    # Keep live auction prices in sync — current_bid was snapshotted at add time
    # and otherwise goes stale vs Favorites / SGW.
    active = [
        w for w in items
        if (w.get("sniper_status") or "").lower() in (
            "scheduled", "bid_placed", "error", "skipped", "rejected"
        )
        and _watchlist_item_ended(w) is not True
    ]
    if active:
        try:
            favs = _get_sgw_client_for_user(user.id).get_favorites()
            for w in active:
                fav = favs.get(int(w["item_id"]))
                if not fav:
                    continue
                live_bid = float(fav.get("currentPrice") or fav.get("currentBid") or 0)
                end_raw = fav.get("endTime") or fav.get("endDateTime")
                live_end = _sgw_to_utc(end_raw) if end_raw else None
                stored_bid = float(w.get("current_bid") or 0)
                if live_bid > 0 and abs(live_bid - stored_bid) >= 0.01:
                    db.update_watchlist_live_bid(w["item_id"], live_bid, live_end)
                    w["current_bid"] = live_bid
                    if live_end:
                        w["end_time"] = live_end
                elif live_end and live_end != w.get("end_time"):
                    db.update_watchlist_live_bid(w["item_id"], stored_bid or live_bid, live_end)
                    w["end_time"] = live_end
        except Exception as e:
            logger.warning(f"Watchlist live-bid sync skipped: {e}")

    items = [profit_calc.annotate_deal(w, fee_pct, resale_ship) for w in items]
    # Attach success-fee ledger rows for won/awaiting/shipped items
    try:
        fees = {int(f["item_id"]): f for f in db.list_win_fees(user.id, limit=500)}
        for w in items:
            fee = fees.get(int(w["item_id"]))
            if fee:
                w["success_fee_cents"] = fee.get("fee_cents")
                w["success_fee_status"] = fee.get("status")
    except Exception as e:
        logger.warning(f"Win-fee annotate skipped: {e}")
    return {"watchlist": items}


def _sgw_item_image_url(item_info: dict) -> Optional[str]:
    """Pull a usable image URL from an SGW itemDetail payload."""
    image_list = item_info.get("imageList") or []
    if image_list and isinstance(image_list, list):
        first = image_list[0] if image_list else {}
        if isinstance(first, dict):
            url = first.get("imageUrl") or first.get("imageURL")
            if url:
                return str(url).replace("\\", "/")
    for key in ("imageURL", "imageUrl", "galleryURL", "imageUrls"):
        val = item_info.get(key)
        if isinstance(val, list) and val:
            return str(val[0]).replace("\\", "/")
        if isinstance(val, str) and val:
            return val.replace("\\", "/")

    # Item detail API often returns relative paths: imageServer + imageUrlString
    # e.g. imageServer="https://…/production/"
    #      imageUrlString="68\\Items\\…\\foo.png;68\\Items\\…\\bar.png"
    server = (item_info.get("imageServer") or "").strip()
    path_blob = (
        item_info.get("imageUrlString")
        or item_info.get("thumbnailUrlString")
        or ""
    )
    if isinstance(path_blob, str) and path_blob.strip():
        first_path = path_blob.split(";")[0].strip().replace("\\", "/")
        if first_path.startswith("http"):
            return first_path
        if server and first_path:
            return f"{server.rstrip('/')}/{first_path.lstrip('/')}"
        if first_path.startswith("http") is False and first_path:
            # Fallback CDN root used by SGW listings
            return f"https://shopgoodwillimages.azureedge.net/production/{first_path.lstrip('/')}"
    return None


def _price_watchlist_deal(deal: dict, user_id) -> dict:
    """Fill ebay_median / profit / ebay_search on a deal-shaped dict when missing."""
    if deal.get("ebay_median") is not None:
        return deal
    title = (deal.get("title") or "").strip()
    if not title:
        return deal
    settings = db.get_settings(user_id)
    days_back = int(settings.get("ebay_days_back", 90))
    fee_pct, resale_ship = profit_calc.fee_settings(settings)
    shipping = float(deal.get("shipping_est") or 12.0)
    current_bid = float(deal.get("current_bid") or 0)
    try:
        resolved = search_term.resolve_ebay_search(
            title,
            days_back=days_back,
            min_comps=1,
            preferred_term=None,
            learn=True,
        )
        price_result = resolved.price_result
    except Exception as e:
        logger.warning(f"eBay comps on watchlist add failed for '{title[:60]}': {e}")
        return deal
    if price_result is None:
        return deal

    you_get, total_cost, profit = profit_calc.net_profit(
        price_result.median, current_bid, shipping, fee_pct, resale_ship
    )
    margin = round(profit / total_cost, 4) if total_cost > 0 else 0.0
    deal = {
        **deal,
        "ebay_median": round(price_result.median, 2),
        "ebay_low": round(price_result.low, 2),
        "ebay_high": round(price_result.high, 2),
        "ebay_sold_count": price_result.sold_count,
        "ebay_search": resolved.term or title,
        "profit": round(profit, 2),
        "margin": margin,
        "shipping_est": shipping,
        "you_get": round(you_get, 2),
    }
    return deal


@app.post("/watchlist")
def add_to_watchlist(req: WatchlistAddRequest, background_tasks: BackgroundTasks, user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    can = db.user_can_snipe(user.id)
    if not can.get("ok"):
        raise HTTPException(status_code=402, detail=can.get("reason") or "Billing required")
    # Prefer any deal row (active/ended/skipped) so ended auctions keep image + eBay comps
    matches = db.get_deals_by_ids([req.item_id])
    deal = matches[0] if matches else None

    if deal is None:
        # Item may be a favorite not yet in the deals table — fetch basic info from SGW
        try:
            sgw = _get_sgw_client_for_user(user.id)
            item_info = sgw.get_item_info(req.item_id)
            deal = {
                "item_id": req.item_id,
                "title": item_info.get("title", f"Item #{req.item_id}"),
                "current_bid": float(item_info.get("currentPrice") or item_info.get("currentBid") or 0),
                "end_time": item_info.get("endTime") or item_info.get("endDateTime"),
                "sgw_url": f"https://shopgoodwill.com/item/{req.item_id}",
                "image_url": _sgw_item_image_url(item_info),
                "ebay_median": None,
                "profit": None,
                "ebay_search": None,
                "shipping_est": float(item_info.get("defaultShippingPrice") or item_info.get("shippingPrice") or 12.0),
            }
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Deal not found and could not fetch from SGW: {e}")
    elif not deal.get("image_url"):
        # Deal row exists but image missing — refresh from SGW item detail
        try:
            sgw = _get_sgw_client_for_user(user.id)
            item_info = sgw.get_item_info(req.item_id)
            deal = {**deal, "image_url": _sgw_item_image_url(item_info) or deal.get("image_url")}
        except Exception as e:
            logger.debug(f"Could not refresh image for {req.item_id}: {e}")

    if req.max_bid <= (deal.get("current_bid") or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Max bid must be greater than current bid of ${deal.get('current_bid', 0):.2f}",
        )

    # Price before insert so the first watchlist paint already has comps + image
    deal = _price_watchlist_deal(deal, user.id)

    end_time = deal["end_time"]
    # Normalize SGW Pacific times to UTC for durable scheduling
    if end_time and not (str(end_time).endswith("Z") or "+" in str(end_time)[10:]):
        end_time = _sgw_to_utc(str(end_time)) or end_time

    sgw_account_id = db.get_primary_sgw_account_id(user.id)
    if using_postgres() and not sgw_account_id:
        # Fall back to env-seeded account only in single-tenant SQLite mode;
        # on Postgres require a connected SGW account to enqueue snipes.
        raise HTTPException(
            status_code=400,
            detail="Connect your ShopGoodwill account before adding snipes",
        )

    db.add_to_watchlist({
        "item_id": req.item_id,
        "title": deal["title"],
        "max_bid": req.max_bid,
        "current_bid": deal["current_bid"],
        "end_time": end_time,
        "sgw_url": deal["sgw_url"],
        "image_url": deal.get("image_url"),
        "ebay_median": deal.get("ebay_median"),
        "profit": deal.get("profit"),
        "ebay_search": deal.get("ebay_search"),
        "user_id": user.id,
        "sgw_account_id": sgw_account_id,
    })
    db.upsert_snipe_job(
        req.item_id,
        req.max_bid,
        end_time,
        user_id=user.id,
        sgw_account_id=sgw_account_id,
    )

    background_tasks.add_task(_add_sgw_favorite_for_user, user.id, req.item_id, req.max_bid)

    return {
        "success": True,
        "item_id": req.item_id,
        "max_bid": req.max_bid,
        "image_url": deal.get("image_url"),
        "ebay_median": deal.get("ebay_median"),
        "ebay_search": deal.get("ebay_search"),
        "profit": deal.get("profit"),
        "you_get": deal.get("you_get"),
        "title": deal.get("title"),
    }


@app.delete("/watchlist/{item_id}")
def remove_from_watchlist(item_id: int, background_tasks: BackgroundTasks, user: RequireUser):
    db.cancel_snipe_job(item_id, user_id=user.id)
    db.remove_from_watchlist(item_id, user_id=user.id)
    background_tasks.add_task(_remove_sgw_favorite_for_user, user.id, item_id)
    return {"success": True}


class WatchlistMaxBidRequest(BaseModel):
    max_bid: float


@app.patch("/watchlist/{item_id}")
def update_watchlist_max_bid(item_id: int, req: WatchlistMaxBidRequest, background_tasks: BackgroundTasks, user: RequireUser):
    """Update sniper max bid for a live, not-yet-sniped watchlist item."""
    watch = next((w for w in db.get_watchlist(user.id) if w["item_id"] == item_id), None)
    if not watch:
        raise HTTPException(status_code=404, detail="Item not on watchlist")

    if _watchlist_item_ended(watch) is True:
        raise HTTPException(status_code=400, detail="Auction has already ended")

    status = (watch.get("sniper_status") or "scheduled").lower()
    if status in ("won", "awaiting_payment", "shipped", "lost", "ended", "missed"):
        raise HTTPException(status_code=400, detail=f"Cannot edit max bid when status is '{status}'")
    if status == "bid_placed":
        raise HTTPException(status_code=400, detail="Bid already placed — max bid can no longer be changed")

    current = float(watch.get("current_bid") or 0)
    if req.max_bid <= current:
        raise HTTPException(
            status_code=400,
            detail=f"Max bid must be greater than current bid of ${current:.2f}",
        )

    db.update_watchlist_max_bid(item_id, req.max_bid, user_id=user.id)
    background_tasks.add_task(_update_sgw_favorite_max_bid_for_user, user.id, item_id, req.max_bid)
    return {"success": True, "item_id": item_id, "max_bid": req.max_bid}


class RepriceRequest(BaseModel):
    search_term: str


@app.post("/items/{item_id}/reprice")
def reprice_item(item_id: int, req: RepriceRequest, user: RequireUser):
    """Re-run eBay lookup with a user-supplied search term and update deal/watchlist pricing."""
    check_rate_limit(user.id, "reprice", limit=30, window_seconds=3600)
    term = (req.search_term or "").strip()
    if not term:
        raise HTTPException(status_code=400, detail="search_term is required")

    settings = db.get_settings(user.id)
    days_back = int(settings.get("ebay_days_back", 90))
    fee_pct, resale_ship = profit_calc.fee_settings(settings)

    # Prefer existing deal row; fall back to watchlist / SGW for cost basis
    records = db.get_deals_by_ids([item_id])
    deal = records[0] if records else None
    watch = next((w for w in db.get_watchlist(user.id) if w["item_id"] == item_id), None)

    title = (deal or {}).get("title") or (watch or {}).get("title") or f"Item #{item_id}"

    try:
        resolved = search_term.resolve_ebay_search(
            title,
            days_back=days_back,
            min_comps=1,
            preferred_term=term,
            learn=True,
        )
        price_result = resolved.price_result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"eBay lookup failed: {e}")

    if price_result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No matching eBay listings found for '{term}'",
        )

    current_bid = float(
        (deal or {}).get("current_bid")
        or (watch or {}).get("current_bid")
        or (watch or {}).get("final_price")
        or 0
    )
    shipping = float((deal or {}).get("shipping_est") or 12.0)

    # For shipped items, profit vs actual total paid is more useful on the watchlist UI;
    # still store estimate using bid+shipping for the deals table consistency.
    you_get, total_cost, profit = profit_calc.net_profit(
        price_result.median, current_bid, shipping, fee_pct, resale_ship
    )
    margin = round(profit / total_cost, 4) if total_cost > 0 else 0.0
    profit = round(profit, 2)
    you_get = round(you_get, 2)

    image_url = (deal or {}).get("image_url") or (watch or {}).get("image_url")
    end_time = (deal or {}).get("end_time") or (watch or {}).get("end_time")
    sgw_url = (deal or {}).get("sgw_url") or (watch or {}).get("sgw_url") or f"https://shopgoodwill.com/item/{item_id}"

    db.upsert_deal({
        "item_id": item_id,
        "title": title,
        "sgw_url": sgw_url,
        "current_bid": current_bid,
        "shipping_est": shipping,
        "end_time": end_time,
        "seller_id": (deal or {}).get("seller_id"),
        "image_url": image_url,
        "keyword": (deal or {}).get("keyword") or "manual reprice",
        **price_result.to_dict(),
        "profit": profit,
        "margin": margin,
        "ebay_search": term,
    })

    if watch:
        db.update_watchlist_pricing(item_id, price_result.median, profit, term)

    return {
        "item_id": item_id,
        "ebay_search": term,
        "ebay_median": round(price_result.median, 2),
        "ebay_low": round(price_result.low, 2),
        "ebay_high": round(price_result.high, 2),
        "ebay_sold_count": price_result.sold_count,
        "you_get": you_get,
        "profit": profit,
        "margin": margin,
        "ebay_fee_pct": fee_pct,
        "ebay_resale_shipping": resale_ship,
    }


def _add_sgw_favorite(item_id: int, max_bid: float):
    _add_sgw_favorite_for_user(None, item_id, max_bid)


def _add_sgw_favorite_for_user(user_id, item_id: int, max_bid: float):
    try:
        sgw = _get_sgw_client_for_user(user_id) if user_id else _get_sgw_client()
        note = json.dumps({"max_bid": max_bid})
        sgw.add_favorite(item_id, note=note)
        # Verify the note stuck — empty notes are why snipes get silently skipped
        favs = sgw.get_favorites()
        fav = favs.get(item_id)
        notes = (fav or {}).get("notes") or ""
        if not fav:
            raise RuntimeError("favorite missing after AddToFavorite")
        if f"{max_bid}" not in notes and '"max_bid"' not in notes:
            sgw.add_favorite_note(item_id, note)
            favs = sgw.get_favorites()
            notes = (favs.get(item_id) or {}).get("notes") or ""
            if '"max_bid"' not in notes:
                raise RuntimeError(f"favorite note not saved (got {notes!r})")
        logger.info(f"Added item {item_id} to SGW favorites with max_bid={max_bid}")
    except Exception as e:
        logger.error(f"Failed to add SGW favorite {item_id}: {e}")


def _relabel_missed_losses() -> int:
    """Flip lost rows with no bid evidence to 'missed' when final ≤ max."""
    n = 0
    for w in db.get_watchlist():
        if (w.get("sniper_status") or "").lower() != "lost":
            continue
        try:
            final_price = float(w["final_price"]) if w.get("final_price") is not None else None
            max_bid = float(w["max_bid"]) if w.get("max_bid") is not None else None
        except (TypeError, ValueError):
            continue
        if final_price is None or max_bid is None:
            continue
        if final_price <= max_bid + 1e-9:
            db.update_watchlist_status(int(w["item_id"]), "missed")
            n += 1
    return n


def _update_sgw_favorite_max_bid(item_id: int, max_bid: float):
    _update_sgw_favorite_max_bid_for_user(None, item_id, max_bid)


def _update_sgw_favorite_max_bid_for_user(user_id, item_id: int, max_bid: float):
    """Update the favorite note the sniper reads for max_bid."""
    try:
        sgw = _get_sgw_client_for_user(user_id) if user_id else _get_sgw_client()
        note = json.dumps({"max_bid": max_bid})
        try:
            sgw.add_favorite_note(item_id, note)
        except Exception:
            # Not favorited yet — add then set note
            sgw.add_favorite(item_id, note=note)
        logger.info(f"Updated SGW favorite note for {item_id} to max_bid={max_bid}")
    except Exception as e:
        logger.error(f"Failed to update SGW favorite max_bid for {item_id}: {e}")


def _remove_sgw_favorite(item_id: int):
    _remove_sgw_favorite_for_user(None, item_id)


def _remove_sgw_favorite_for_user(user_id, item_id: int):
    try:
        sgw = _get_sgw_client_for_user(user_id) if user_id else _get_sgw_client()
        sgw.remove_favorite(item_id)
        logger.info(f"Removed item {item_id} from SGW favorites")
    except Exception as e:
        logger.error(f"Failed to remove SGW favorite {item_id}: {e}")


def _sgw_to_utc(end_time_str: Optional[str]) -> Optional[str]:
    """Convert SGW Pacific-time string to UTC ISO-8601 with Z suffix."""
    if not end_time_str:
        return None
    if end_time_str.endswith("Z") or "+" in end_time_str:
        return end_time_str  # already UTC
    try:
        fmt = "%Y-%m-%dT%H:%M:%S"
        if "." in end_time_str:
            fmt += ".%f"
        dt = datetime.strptime(end_time_str, fmt)
        dt = dt.replace(tzinfo=ZoneInfo("America/Los_Angeles"))
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return end_time_str


def _watchlist_item_ended(item: dict) -> Optional[bool]:
    """True if auction end_time is past, False if still live, None if unknown."""
    end_time_str = item.get("end_time")
    if not end_time_str:
        return None
    try:
        end_dt = datetime.fromisoformat(str(end_time_str).replace("Z", "+00:00"))
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=ZoneInfo("America/Los_Angeles"))
        return end_dt <= datetime.now(timezone.utc)
    except Exception:
        return None


def _bidder_is_us(winner: Optional[str], username: str) -> bool:
    """Match SGW high-bidder strings, including masked names like s********n."""
    if not winner or not username:
        return False
    w, u = winner.strip().lower(), username.strip().lower()
    if w == u:
        return True
    if "*" in w and len(w) == len(u) and w[0] == u[0] and w[-1] == u[-1]:
        return True
    return False


def _check_bid_results() -> None:
    """Resolve watchlist outcomes for every owner, each with their own SGW login."""
    owners = db.list_watchlist_user_ids()
    if not owners:
        # Single-tenant / SQLite: one env-backed account owns the whole watchlist
        _check_bid_results_for_owner(None)
        return
    for user_id in owners:
        try:
            _check_bid_results_for_owner(user_id)
        except Exception as e:
            logger.error(f"Win-check sweep failed for user {user_id}: {e}")


def _check_bid_results_for_owner(user_id: Optional[str]) -> None:
    """
    Resolve one owner's watchlist outcomes from ShopGoodwill:
    1. Open/shipped orders are ground truth for a win (also heals false 'lost')
    2. Remaining ended scheduled/bid_placed items → won/lost from bid history
    """
    watchlist = db.get_watchlist(user_id)
    if not watchlist:
        return
    if user_id is not None and not db.get_primary_sgw_account_id(user_id):
        return  # nothing to check against until they connect ShopGoodwill

    try:
        sgw = (
            _get_sgw_client_for_user(user_id) if user_id is not None else _get_sgw_client()
        )
    except Exception as e:
        logger.error(f"Win-check: could not create SGW client for {user_id or 'owner'}: {e}")
        return

    try:
        open_orders = {int(o["itemId"]): o for o in sgw.get_open_orders()}
        shipped_orders = {int(o["itemId"]): o for o in sgw.get_shipped_orders()}
    except Exception as e:
        logger.error(f"Order fetch failed: {e}")
        open_orders, shipped_orders = {}, {}

    username = (getattr(sgw, "username", "") or os.getenv("SGW_USERNAME", "")).lower()

    # ── Step 1: orders are the source of truth (fixes false Lost on wins) ────
    for item in watchlist:
        item_id = int(item["item_id"])
        try:
            if item_id in shipped_orders:
                o = shipped_orders[item_id]
                db.update_watchlist_order(
                    item_id,
                    status="shipped",
                    order_id=o.get("orderId"),
                    final_price=o.get("price"),
                    final_shipping=o.get("shippingPrice"),
                    handling_price=o.get("handlingPrice"),
                    tax=o.get("tax"),
                    tracking_number=o.get("trackingNumber") or None,
                    shipper_name=o.get("shipperName") or None,
                )
                if user_id is not None and o.get("price") is not None:
                    try:
                        import billing as billing_mod
                        billing_mod.record_and_maybe_invoice(
                            user_id=str(user_id),
                            item_id=item_id,
                            final_price=float(o["price"]),
                            title=item.get("title"),
                        )
                    except Exception as fee_err:
                        logger.error(f"Win-fee record failed for {item_id}: {fee_err}")
                logger.info(f"Order shipped: '{item.get('title', item_id)}' — tracking {o.get('trackingNumber')}")
            elif item_id in open_orders:
                o = open_orders[item_id]
                db.update_watchlist_order(
                    item_id,
                    status="awaiting_payment",
                    order_id=o.get("orderId"),
                    final_price=o.get("price"),
                    due_date=o.get("pastDueEndDate"),
                )
                if user_id is not None and o.get("price") is not None:
                    try:
                        import billing as billing_mod
                        billing_mod.record_and_maybe_invoice(
                            user_id=str(user_id),
                            item_id=item_id,
                            final_price=float(o["price"]),
                            title=item.get("title"),
                        )
                    except Exception as fee_err:
                        logger.error(f"Win-fee record failed for {item_id}: {fee_err}")
                logger.info(f"Open order: '{item.get('title', item_id)}' — pay by {o.get('pastDueEndDate', '')[:10]}")
        except Exception as e:
            logger.error(f"Order sync failed for item {item_id}: {e}")

    # ── Step 2: bid-history win/loss for items not already in orders ─────────
    watchlist = db.get_watchlist(user_id)
    pending = [
        w for w in watchlist
        if w.get("sniper_status") in (
            "scheduled", "bid_placed", "error", "skipped", "rejected"
        )
        and _watchlist_item_ended(w) is not False
    ]
    if pending:
        logger.info(
            f"Win-check sweep: {len(pending)} ended item(s) still unresolved"
        )
    for item in pending:
        item_id = item["item_id"]
        try:
            info = sgw.get_item_info(item_id)
            try:
                final_price = float(info.get("currentPrice") or 0)
            except (TypeError, ValueError):
                final_price = None
            try:
                final_shipping = float(info.get("shippingPrice") or 0)
            except (TypeError, ValueError):
                final_shipping = None
            bid_summary = info.get("bidHistory", {}).get("bidSummary", [])
            winner = bid_summary[0]["bidderName"] if bid_summary else None

            ended = _watchlist_item_ended(item)
            if ended is False:
                continue

            if not winner and not info.get("isClosed") and ended is not True:
                continue

            if _bidder_is_us(winner, username):
                db.update_watchlist_result(item_id, "won", final_price, final_shipping)
                our_max = item.get("max_bid")
                logger.warning(
                    f"WIN confirmed: '{item.get('title', item_id)}' — ${final_price:.2f}"
                    + (f" (our max ${float(our_max):.2f})" if our_max else "")
                )
            elif ended is True and (info.get("isClosed") or winner):
                we_bid = any(_bidder_is_us(b.get("bidderName"), username) for b in bid_summary)
                status = "lost" if we_bid else "missed"
                # Also treat prior bid_placed as evidence we attempted a bid
                if (item.get("sniper_status") or "").lower() == "bid_placed":
                    status = "lost"
                db.update_watchlist_result(item_id, status, final_price, final_shipping)
                our_max = item.get("max_bid")
                max_bit = f", our max ${float(our_max):.2f}" if our_max else ""
                if status == "missed":
                    logger.error(
                        f"MISSED snipe: '{item.get('title', item_id)}' — no bid placed "
                        f"(final ${final_price:.2f}{max_bit}, winner: {winner or 'unknown'})"
                    )
                else:
                    note = ""
                    try:
                        if our_max is not None and final_price is not None and float(final_price) > float(our_max) + 1e-9:
                            note = " — final above our max (outbid or bid never accepted)"
                    except (TypeError, ValueError):
                        pass
                    logger.info(
                        f"Lost: '{item.get('title', item_id)}' — final "
                        f"${final_price:.2f}{max_bit}, winner: {winner or 'unknown'}{note}"
                    )
        except Exception as e:
            logger.error(f"Win-check failed for item {item_id}: {e}")


def _get_sgw_client() -> shopgoodwill.Shopgoodwill:
    if os.getenv("SGW_ENCRYPTED_USERNAME"):
        auth_info = {
            "encrypted_username": os.getenv("SGW_ENCRYPTED_USERNAME"),
            "encrypted_password": os.getenv("SGW_ENCRYPTED_PASSWORD"),
        }
    else:
        auth_info = {
            "username": os.getenv("SGW_USERNAME", ""),
            "password": os.getenv("SGW_PASSWORD", ""),
        }
    return shopgoodwill.Shopgoodwill(auth_info)


def _get_sgw_client_for_account(account_id: int) -> shopgoodwill.Shopgoodwill:
    """Build a client from an encrypted sgw_accounts row (or env fallback)."""
    acct = db.get_sgw_account_secrets(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail="SGW account not found")
    if acct.get("auth_source") == "env" or not acct.get("encrypted_username"):
        return _get_sgw_client()
    try:
        raw = crypto_creds.decrypt_secret(
            acct["encrypted_username"],
            acct["nonce"],
            int(acct.get("key_version") or 1),
        )
        # Blob mode: JSON {"username","password"}; legacy: separate fields
        if raw.strip().startswith("{"):
            data = json.loads(raw)
            username, password = data["username"], data["password"]
        else:
            username = raw
            password = crypto_creds.decrypt_secret(
                acct["encrypted_password"],
                acct["nonce"],
                int(acct.get("key_version") or 1),
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not decrypt SGW credentials: {e}")
    return shopgoodwill.Shopgoodwill({"username": username, "password": password})


def _get_sgw_client_for_user(user_id) -> shopgoodwill.Shopgoodwill:
    account_id = db.get_primary_sgw_account_id(user_id)
    if account_id:
        try:
            return _get_sgw_client_for_account(account_id)
        except HTTPException:
            pass
    # Single-tenant / bootstrap fallback
    if not using_postgres():
        return _get_sgw_client()
    raise HTTPException(
        status_code=400,
        detail="Connect your ShopGoodwill account in Account settings first",
    )


# ── Account / SGW credentials ───────────────────────────────────────────────

class SgwConnectRequest(BaseModel):
    username: str
    password: str
    label: str = "Default"


@app.get("/me")
def get_me(user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    accounts = db.list_sgw_accounts(user.id)
    billing = db.get_billing_profile(user.id) or {}
    can = db.user_can_snipe(user.id)
    return {
        "id": user.id,
        "email": user.email,
        "sgw_accounts": accounts,
        "has_sgw": any(a.get("status") == "active" for a in accounts),
        "postgres": using_postgres(),
        "billing": {
            "plan": billing.get("plan") or "standard",
            "has_payment_method": bool(billing.get("has_payment_method")),
            "billing_blocked": bool(billing.get("billing_blocked")),
            "stripe_subscription_status": billing.get("stripe_subscription_status"),
            "tos_accepted_at": (
                billing.get("tos_accepted_at").isoformat()
                if hasattr(billing.get("tos_accepted_at"), "isoformat")
                else billing.get("tos_accepted_at")
            ),
            "can_snipe": bool(can.get("ok")),
            "can_snipe_reason": can.get("reason"),
            "success_fee_pct": 0 if (
                (billing.get("plan") or "") == "pro"
                and (billing.get("stripe_subscription_status") or "") in ("active", "trialing")
            ) else 2,
        },
        "win_fees": db.list_win_fees(user.id, limit=20),
    }


class TosAcceptRequest(BaseModel):
    accepted: bool = True


@app.post("/me/tos")
def accept_tos(req: TosAcceptRequest, user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    if req.accepted:
        db.accept_tos(user.id)
    return {"success": True}


@app.get("/billing/fees")
def list_billing_fees(user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    return {"fees": db.list_win_fees(user.id, limit=100)}


@app.get("/account/sgw")
def list_my_sgw_accounts(user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    return {"accounts": db.list_sgw_accounts(user.id)}


@app.post("/account/sgw")
def connect_sgw_account(req: SgwConnectRequest, user: RequireUser):
    """Encrypt + store SGW credentials after a live test login."""
    check_rate_limit(user.id, "sgw_connect", limit=5, window_seconds=3600)
    db.ensure_user_profile(user.id, user.email)
    username = (req.username or "").strip()
    password = req.password or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password are required")

    # Test login before storing
    try:
        client = shopgoodwill.Shopgoodwill({"username": username, "password": password})
        # Cheap authenticated call
        client.get_favorites()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ShopGoodwill login failed: {e}")

    try:
        # Single ciphertext blob keeps one nonce for the credential pair
        blob, nonce, key_ver = crypto_creds.encrypt_secret(
            json.dumps({"username": username, "password": password})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {e}")

    account_id = db.upsert_user_sgw_account(
        user.id,
        label=req.label or "Default",
        encrypted_username=blob,  # full JSON blob
        encrypted_password="",    # unused when blob mode
        nonce=nonce,
        key_version=key_ver,
        status="active",
    )
    db.mark_sgw_account_verified(account_id, True)
    return {
        "success": True,
        "account": next(
            (a for a in db.list_sgw_accounts(user.id) if a["id"] == account_id),
            {"id": account_id},
        ),
    }


@app.post("/account/sgw/{account_id}/verify")
def verify_sgw_account(account_id: int, user: RequireUser):
    check_rate_limit(user.id, "sgw_verify", limit=10, window_seconds=3600)
    accounts = {a["id"]: a for a in db.list_sgw_accounts(user.id)}
    if account_id not in accounts:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        client = _get_sgw_client_for_account(account_id)
        client.get_favorites()
        db.mark_sgw_account_verified(account_id, True)
        return {"success": True, "status": "active"}
    except Exception as e:
        db.mark_sgw_account_verified(account_id, False, str(e)[:300])
        raise HTTPException(status_code=400, detail=f"Verification failed: {e}")


# ── Scanner ─────────────────────────────────────────────────────────────────

@app.post("/scan")
def trigger_scan(user: RequireUser):
    raise HTTPException(
        status_code=410,
        detail="Catalog scans are disabled. Paste a ShopGoodwill URL on Watchlist or use Favorites → Check eBay Prices.",
    )


@app.get("/scan/status")
def scan_status(user: RequireUser):
    recent = db.get_recent_scans(limit=5)
    return {"running": _scan_running, "recent_scans": recent}


def _run_scan(refresh_deals: bool = False):
    """Run a scan. User-triggered scans pass refresh_deals=True so clearing
    filters replaces the deals list instead of keeping the previous scope.
    """
    global _scan_running
    with _scan_lock:
        if _scan_running:
            logger.info("Scan already running — skip")
            return
        _scan_running = True
    try:
        from scanner import Scanner
        Scanner().scan(refresh_deals=refresh_deals)
    except Exception as e:
        logger.error(f"Scan error: {e}")
    finally:
        _scan_running = False


# ── Bid Sniper ───────────────────────────────────────────────────────────────

def _build_sniper_config() -> dict:
    """Build sniper config from env vars + DB settings."""
    settings = db.get_settings()
    snipe_secs = int(settings.get("snipe_seconds_before", 30))

    if os.getenv("SGW_ENCRYPTED_USERNAME"):
        auth_info = {
            "encrypted_username": os.getenv("SGW_ENCRYPTED_USERNAME"),
            "encrypted_password": os.getenv("SGW_ENCRYPTED_PASSWORD"),
            "username": os.getenv("SGW_USERNAME", ""),
        }
    else:
        auth_info = {
            "username": os.getenv("SGW_USERNAME", ""),
            "password": os.getenv("SGW_PASSWORD", ""),
        }

    return {
        "auth_info": auth_info,
        "bid_sniper": {
            "bid_snipe_time_delta": f"{snipe_secs} seconds",
            # Idle poll when nothing ends soon
            "refresh_seconds": 60,
            # Within 1 hour of an ending: poll more often
            "mid_end_window_seconds": 3600,
            "mid_refresh_seconds": 30,
            # Within 10 minutes: poll aggressively + keep favorites cache fresh
            "near_end_window_seconds": 600,
            "near_end_refresh_seconds": 5,
            "favorites_max_cache_seconds": 60,
            # One log reminder only — never places a bid. Kept ahead of the
            # snipe moment so it can't land on the same second as the bid.
            "alert_time_deltas": [f"{snipe_secs + 60} seconds"],
        },
        "friend_list": [],
        "logging": {"log_level": 20},
    }


@app.get("/sniper/status")
def sniper_status(user: RequireUser):
    """Whether bidding is being serviced, plus this user's queue depth.

    The bid service is infrastructure, not a per-user toggle: either the API
    hosts it (SNIPER_IN_API) or the sgw-worker@ units do.
    """
    global _sniper_process
    in_process = _sniper_process is not None and _sniper_process.poll() is None
    external = os.getenv("SNIPER_IN_API", "1").lower() in ("0", "false", "no")
    try:
        pending = db.count_pending_snipe_jobs(user.id)
    except Exception:
        pending = 0
    return {
        "running": in_process or external,
        "mode": "workers" if external else "in-process",
        "pending_snipes": pending,
    }


@app.get("/sniper/logs")
def get_sniper_logs(user: RequireUser, n: int = Query(default=100, le=500)):
    """This user's snipe activity, oldest first."""
    return {"logs": db.get_snipe_activity(user.id, limit=n)}


# ── Settings ─────────────────────────────────────────────────────────────────

@app.get("/settings")
def get_settings(user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    return db.get_settings(user.id)


class SettingsUpdateRequest(BaseModel):
    key: str
    value: Any


def _restart_sniper() -> None:
    """Stop the running sniper so the watchdog/ensure path starts it with fresh config."""
    global _sniper_process
    if _sniper_process and _sniper_process.poll() is None:
        logger.info("Restarting sniper to pick up new settings")
        _sniper_process.terminate()
        try:
            _sniper_process.wait(timeout=5)
        except Exception:
            _sniper_process.kill()
        _sniper_process = None
    _ensure_sniper_running()


@app.put("/settings")
def update_setting(req: SettingsUpdateRequest, user: RequireUser):
    db.ensure_user_profile(user.id, user.email)
    db.update_setting(req.key, req.value, user_id=user.id)
    # Fire times live on the durable job rows, so only this user's queue moves.
    if req.key == "snipe_seconds_before":
        try:
            secs = int(req.value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            secs = 5
        db.refresh_pending_snipe_times(secs, user_id=user.id)
    return {"success": True, "key": req.key, "value": req.value}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "ebay_cache": ebay.get_cache_stats()}


# ── Favorites scan ────────────────────────────────────────────────────────────

_favorites_running = False
_favorites_lock = threading.Lock()


@app.get("/favorites")
def get_all_favorites(user: RequireUser):
    """Return all SGW favorites with enrichment from the deals table where available."""
    try:
        sgw = _get_sgw_client_for_user(user.id)
        raw_favorites = sgw.get_favorites()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch SGW favorites: {e}")
        raise HTTPException(status_code=502, detail=f"Could not reach SGW: {e}")

    records = {d["item_id"]: d for d in db.get_deals_by_ids(list(raw_favorites.keys()))}
    fee_pct, resale_ship = profit_calc.fee_settings(db.get_settings(user.id))

    result = []
    for item_id, fav in raw_favorites.items():
        record = records.get(item_id)
        # Favorites often aren't in the keyword scan, so mark_deals_stale marks them
        # "ended" even while the auction is still live — don't require status=active.
        has_profit = record is not None and record.get("profit") is not None
        is_deal = bool(has_profit and record.get("status") != "skipped")
        entry = {
            "item_id": item_id,
            "title": fav.get("title") or fav.get("itemTitle") or f"Item #{item_id}",
            "current_bid": float(fav.get("currentPrice") or fav.get("currentBid") or 0),
            "end_time": _sgw_to_utc(fav.get("endTime") or fav.get("endDateTime")),
            "image_url": (fav.get("imageURL") or fav.get("imageUrl") or "").replace("\\", "/") or None,
            "sgw_url": f"https://shopgoodwill.com/item/{item_id}",
            "seller_id": fav.get("sellerId"),
            "analyzed": record is not None,
            "is_deal": is_deal,
            "skip_reason": None if is_deal else (record.get("skip_reason") if record else None),
            "ebay_median": record["ebay_median"] if record else None,
            "ebay_low": record["ebay_low"] if record else None,
            "ebay_high": record["ebay_high"] if record else None,
            "ebay_sold_count": record["ebay_sold_count"] if record else None,
            "ebay_search": record.get("ebay_search") if record else None,
            "profit": record["profit"] if record else None,
            "margin": record["margin"] if record else None,
            "shipping_est": record["shipping_est"] if record else None,
        }
        if record and record.get("ebay_median") is not None:
            # Prefer live SGW bid for cost basis when annotating
            entry["shipping_est"] = record.get("shipping_est")
            profit_calc.annotate_deal(entry, fee_pct, resale_ship)
        result.append(entry)

    # Soonest ending first; missing end times last
    result.sort(key=lambda x: (x["end_time"] is None, x["end_time"] or ""))
    return {"favorites": result, "count": len(result)}


@app.post("/favorites/scan")
def trigger_favorites_scan(background_tasks: BackgroundTasks, user: RequireUser):
    check_rate_limit(user.id, "favorites_scan", limit=5, window_seconds=3600)
    global _favorites_running
    if _favorites_running:
        return {"message": "Favorites scan already running"}
    background_tasks.add_task(_run_favorites_scan)
    return {"message": "Favorites scan started"}


@app.get("/favorites/status")
def favorites_scan_status(user: RequireUser):
    return {"running": _favorites_running}


def _run_favorites_scan():
    global _favorites_running
    with _favorites_lock:
        _favorites_running = True
        try:
            from scanner import Scanner
            Scanner().scan_favorites()
        except Exception as e:
            logger.error(f"Favorites scan error: {e}")
        finally:
            _favorites_running = False


# ── Categories ────────────────────────────────────────────────────────────────

@app.get("/categories")
def get_categories(user: RequireUser):
    try:
        # Shared catalog — env client is fine for category tree
        sgw = _get_sgw_client()
        return {"categories": sgw.get_categories()}
    except Exception as e:
        logger.error(f"Failed to fetch categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/browse")
def browse_category(
    user: RequireUser,
    category_ids: str = Query("", description="Comma-separated scids"),
    page: int = Query(1, ge=1),
):
    """Browse raw SGW items by category without profit filtering. Paginated, 40 items per page."""
    try:
        sgw = _get_sgw_client()
        scids = [int(x) for x in category_ids.split(",") if x.strip().isdigit()]
        result = sgw.browse_category(scids, page=page)

        # Enrich with end_time UTC conversion
        items = []
        for item in result["items"]:
            end_raw = item.get("endTime") or item.get("endDateTime") or ""
            items.append({
                "itemId":        item.get("itemId"),
                "title":         item.get("title", ""),
                "currentPrice":  float(item.get("currentPrice") or 0),
                "endTime":       _sgw_to_utc(end_raw) if end_raw else None,
                "imageUrl":      (item.get("imageURL") or item.get("galleryURL") or "").replace("\\", "/"),
                "categoryName":  item.get("categoryName", ""),
                "sellerId":      item.get("sellerId"),
                "sgwUrl":        f"https://shopgoodwill.com/item/{item.get('itemId')}",
            })

        return {"items": items, "total": result["total"], "page": page}
    except Exception as e:
        logger.error(f"Browse failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
