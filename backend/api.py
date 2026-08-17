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
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import shopgoodwill

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_sniper_process: Optional[subprocess.Popen] = None
_scan_lock = threading.Lock()
_scan_running = False
_scheduler = BackgroundScheduler()
# Rolling sniper log buffer (most recent 500 lines)
_sniper_logs: collections.deque = collections.deque(maxlen=500)


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
    settings = db.get_settings()
    interval = int(settings.get("scan_interval_minutes", 15))
    _schedule_scan(interval)
    _scheduler.start()
    logger.info("Scheduler started")
    # Auto-start sniper and keep it alive
    _ensure_sniper_running()
    _start_sniper_watchdog()
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
    """Read sniper stdout line-by-line into the in-memory log buffer."""
    try:
        for raw in proc.stdout:  # type: ignore[union-attr]
            line = raw.rstrip()
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
            entry = {"ts": ts, "line": line}
            _sniper_logs.append(entry)
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Deals ──────────────────────────────────────────────────────────────────

@app.get("/deals")
def list_deals(
    min_profit: float = Query(0),
    min_margin: float = Query(0),
    status: str = Query("active"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    deals = db.get_deals(
        min_profit=min_profit,
        min_margin=min_margin / 100 if min_margin > 1 else min_margin,
        status=status,
        limit=limit,
        offset=offset,
    )
    return {"deals": deals, "count": len(deals)}


# ── Watchlist ───────────────────────────────────────────────────────────────

class WatchlistAddRequest(BaseModel):
    item_id: int
    max_bid: float


@app.get("/watchlist")
def get_watchlist():
    return {"watchlist": db.get_watchlist()}


@app.post("/watchlist")
def add_to_watchlist(req: WatchlistAddRequest, background_tasks: BackgroundTasks):
    deals = db.get_deals(limit=1000, status="active")
    deal = next((d for d in deals if d["item_id"] == req.item_id), None)

    if deal is None:
        # Item may be a favorite not yet in the deals table — fetch basic info from SGW
        try:
            sgw = _get_sgw_client()
            item_info = sgw.get_item_info(req.item_id)
            deal = {
                "item_id": req.item_id,
                "title": item_info.get("title", f"Item #{req.item_id}"),
                "current_bid": float(item_info.get("currentPrice") or item_info.get("currentBid") or 0),
                "end_time": item_info.get("endTime") or item_info.get("endDateTime"),
                "sgw_url": f"https://shopgoodwill.com/item/{req.item_id}",
                "image_url": None,
                "ebay_median": None,
                "profit": None,
            }
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Deal not found and could not fetch from SGW: {e}")

    if req.max_bid <= (deal.get("current_bid") or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Max bid must be greater than current bid of ${deal.get('current_bid', 0):.2f}",
        )

    db.add_to_watchlist({
        "item_id": req.item_id,
        "title": deal["title"],
        "max_bid": req.max_bid,
        "current_bid": deal["current_bid"],
        "end_time": deal["end_time"],
        "sgw_url": deal["sgw_url"],
        "image_url": deal["image_url"],
        "ebay_median": deal["ebay_median"],
        "profit": deal["profit"],
    })

    background_tasks.add_task(_add_sgw_favorite, req.item_id, req.max_bid)

    return {"success": True, "item_id": req.item_id, "max_bid": req.max_bid}


@app.delete("/watchlist/{item_id}")
def remove_from_watchlist(item_id: int, background_tasks: BackgroundTasks):
    db.remove_from_watchlist(item_id)
    background_tasks.add_task(_remove_sgw_favorite, item_id)
    return {"success": True}


def _add_sgw_favorite(item_id: int, max_bid: float):
    try:
        sgw = _get_sgw_client()
        note = json.dumps({"max_bid": max_bid})
        sgw.add_favorite(item_id, note=note)
        logger.info(f"Added item {item_id} to SGW favorites with max_bid={max_bid}")
    except Exception as e:
        logger.error(f"Failed to add SGW favorite {item_id}: {e}")


def _remove_sgw_favorite(item_id: int):
    try:
        sgw = _get_sgw_client()
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


# ── Scanner ─────────────────────────────────────────────────────────────────

@app.post("/scan")
def trigger_scan(background_tasks: BackgroundTasks):
    global _scan_running
    if _scan_running:
        return {"message": "Scan already running"}
    background_tasks.add_task(_run_scan)
    return {"message": "Scan started"}


@app.get("/scan/status")
def scan_status():
    recent = db.get_recent_scans(limit=5)
    return {"running": _scan_running, "recent_scans": recent}


def _run_scan():
    global _scan_running
    with _scan_lock:
        _scan_running = True
        try:
            from scanner import Scanner
            Scanner().scan()
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
            "refresh_seconds": 300,
            "favorites_max_cache_seconds": 60,
            "alert_time_deltas": ["5 minutes", "1 minute"],
        },
        "friend_list": [],
        "logging": {"log_level": 20},
    }


@app.post("/sniper/start")
def start_sniper():
    global _sniper_process
    if _sniper_process and _sniper_process.poll() is None:
        return {"running": True, "message": "Sniper already running"}

    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    config = _build_sniper_config()
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    logger.info("Wrote config.json from env/DB settings")

    _sniper_process = subprocess.Popen(
        [sys.executable, "bid_sniper.py", "--config", config_path],
        cwd=os.path.dirname(__file__),
    )
    return {"running": True, "pid": _sniper_process.pid}


@app.post("/sniper/stop")
def stop_sniper():
    global _sniper_process
    if _sniper_process and _sniper_process.poll() is None:
        _sniper_process.terminate()
        return {"running": False, "message": "Sniper stopped"}
    return {"running": False, "message": "Sniper was not running"}


@app.get("/sniper/status")
def sniper_status():
    global _sniper_process
    running = _sniper_process is not None and _sniper_process.poll() is None
    return {
        "running": running,
        "pid": _sniper_process.pid if running else None,
    }


@app.get("/sniper/logs")
def get_sniper_logs(n: int = Query(default=100, le=500)):
    """Return the last n lines from the sniper's output."""
    logs = list(_sniper_logs)
    return {"logs": logs[-n:]}


# ── Settings ─────────────────────────────────────────────────────────────────

@app.get("/settings")
def get_settings():
    return db.get_settings()


class SettingsUpdateRequest(BaseModel):
    key: str
    value: object


@app.put("/settings")
def update_setting(req: SettingsUpdateRequest):
    db.update_setting(req.key, req.value)
    if req.key == "scan_interval_minutes":
        _schedule_scan(int(req.value))
    return {"success": True, "key": req.key, "value": req.value}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Favorites scan ────────────────────────────────────────────────────────────

_favorites_running = False
_favorites_lock = threading.Lock()


@app.get("/favorites")
def get_all_favorites():
    """Return all SGW favorites with enrichment from the deals table where available."""
    try:
        sgw = _get_sgw_client()
        raw_favorites = sgw.get_favorites()
    except Exception as e:
        logger.error(f"Failed to fetch SGW favorites: {e}")
        raise HTTPException(status_code=502, detail=f"Could not reach SGW: {e}")

    # Load any analyzed deals for these item IDs
    all_deals = {d["item_id"]: d for d in db.get_deals(limit=1000, status="active")}

    result = []
    for item_id, fav in raw_favorites.items():
        deal = all_deals.get(item_id)
        entry = {
            "item_id": item_id,
            "title": fav.get("title") or fav.get("itemTitle") or f"Item #{item_id}",
            "current_bid": float(fav.get("currentPrice") or fav.get("currentBid") or 0),
            "end_time": _sgw_to_utc(fav.get("endTime") or fav.get("endDateTime")),
            "image_url": (fav.get("imageURL") or fav.get("imageUrl") or "").replace("\\", "/") or None,
            "sgw_url": f"https://shopgoodwill.com/item/{item_id}",
            "seller_id": fav.get("sellerId"),
            # eBay analysis — only present if item has been scanned
            "analyzed": deal is not None,
            "ebay_median": deal["ebay_median"] if deal else None,
            "ebay_low": deal["ebay_low"] if deal else None,
            "ebay_high": deal["ebay_high"] if deal else None,
            "ebay_sold_count": deal["ebay_sold_count"] if deal else None,
            "profit": deal["profit"] if deal else None,
            "margin": deal["margin"] if deal else None,
            "shipping_est": deal["shipping_est"] if deal else None,
        }
        result.append(entry)

    # Sort: analyzed first (by profit desc), then unanalyzed
    result.sort(key=lambda x: (not x["analyzed"], -(x["profit"] or 0)))
    return {"favorites": result, "count": len(result)}


@app.post("/favorites/scan")
def trigger_favorites_scan(background_tasks: BackgroundTasks):
    global _favorites_running
    if _favorites_running:
        return {"message": "Favorites scan already running"}
    background_tasks.add_task(_run_favorites_scan)
    return {"message": "Favorites scan started"}


@app.get("/favorites/status")
def favorites_scan_status():
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
def get_categories():
    try:
        sgw = _get_sgw_client()
        return {"categories": sgw.get_categories()}
    except Exception as e:
        logger.error(f"Failed to fetch categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))
