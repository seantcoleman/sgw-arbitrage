#!/usr/bin/env python3
"""
Standalone shared-pool scanner process.

Run under systemd as sgw-scanner.service so only one process owns the eBay quota.
The API can still trigger scans via POST /scan; this process owns the interval.
"""

import logging
import os
import time

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import db
from scanner import Scanner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sgw-scanner")


def main():
    db.init_db()
    settings = db.get_settings()
    interval = int(settings.get("scan_interval_minutes") or 120)
    interval = max(15, interval)
    logger.info(f"Shared scanner starting (interval={interval}m)")
    while True:
        try:
            Scanner().scan()
        except Exception as e:
            logger.error(f"Scan failed: {e}")
        settings = db.get_settings()
        interval = max(15, int(settings.get("scan_interval_minutes") or 120))
        time.sleep(interval * 60)


if __name__ == "__main__":
    main()
