"""
FastAPI backend — serves the web dashboard.

Run with: uvicorn api:app --reload --port 8000
"""

import json
import logging
import os
import subprocess
import sys
import threading
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import shopgoodwill

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SGW Arbitrage API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global sniper process reference
_sniper_process: Optional[subprocess.Popen] = None
_scan_lock = threading.Lock()
_scan_running = False


@app.on_event("startup")
def startup():
    db.init_db()
    logger.info("Database initialized")


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
    # Find the deal in our DB
    deals = db.get_deals(limit=1000, status="active")
    deal = next((d for d in deals if d["item_id"] == req.item_id), None)

    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")

    if req.max_bid <= deal["current_bid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Max bid must be greater than current bid of ${deal['current_bid']:.2f}",
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

    # Add to SGW favorites with max_bid in notes
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

@app.post("/sniper/start")
def start_sniper():
    global _sniper_process
    if _sniper_process and _sniper_process.poll() is None:
        return {"running": True, "message": "Sniper already running"}

    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        raise HTTPException(status_code=400, detail="config.json not found — see config.json.example")

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
    return {"success": True, "key": req.key, "value": req.value}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}
