#!/usr/bin/env python3
"""
Standalone shared-pool scanner process.

Catalog auto-scans are currently disabled to conserve eBay API quota.
This process stays up under systemd without calling Scanner.scan().
Favorites scan and Watchlist reprice still run via the API.

To re-enable interval catalog scans later, restore the loop that called
Scanner().scan() and re-wire POST /scan in api.py.
"""

import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sgw-scanner")


def main():
    logger.info(
        "Catalog scanner idle — auto-scans disabled. "
        "Favorites scan and Watchlist paste-URL reprice still use eBay via the API."
    )
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
