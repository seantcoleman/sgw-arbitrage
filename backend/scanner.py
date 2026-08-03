"""
SGW keyword scanner + arbitrage engine.

For each configured keyword:
  1. Search ShopGoodwill
  2. Pre-filter junk (Stage 1)
  3. Clean title for eBay (Stage 2)
  4. Look up eBay sold prices (Stage 3)
  5. Calculate profit/margin
  6. Save deals to DB
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import db
import ebay
import filter as item_filter
import shopgoodwill

logger = logging.getLogger(__name__)

EBAY_FEE_RATE = 0.87  # eBay takes ~13% (final value + payment processing)

SGW_SEARCH_TEMPLATE = {
    "searchText": "",
    "categoryId": [],
    "page": 1,
    "pageSize": 40,
    "maximumPrice": None,
    "minimumPrice": None,
    "goodwillId": [],
    "locationId": [],
    "bookmarkListId": [],
    "isForCharityOnly": False,
    "isOnlineAuctionsOnly": False,
    "selectedSortType": "EndTime",
}


class Scanner:
    def __init__(self):
        settings = db.get_settings()
        self.min_profit = float(settings.get("min_profit_usd", 15))
        self.min_margin = float(settings.get("min_margin_pct", 25)) / 100
        self.min_sold_comps = int(settings.get("min_sold_comps", 5))
        self.max_bid_cap = float(settings.get("max_bid_cap", 300))
        self.min_bid_floor = float(settings.get("min_bid_floor", 3))
        self.zip_code = str(settings.get("your_zip_code", "90210"))
        self.days_back = int(settings.get("ebay_days_back", 90))
        self.keywords = settings.get(
            "scan_keywords",
            ["sony headphones", "apple watch", "canon camera"],
        )

        auth_info = {
            "username": os.getenv("SGW_USERNAME", ""),
            "password": os.getenv("SGW_PASSWORD", ""),
        }
        # Support pre-encrypted credentials
        if os.getenv("SGW_ENCRYPTED_USERNAME"):
            auth_info = {
                "encrypted_username": os.getenv("SGW_ENCRYPTED_USERNAME"),
                "encrypted_password": os.getenv("SGW_ENCRYPTED_PASSWORD"),
            }

        self.sgw = shopgoodwill.Shopgoodwill(auth_info)

    def scan(self) -> dict:
        scan_id = db.log_scan_start()
        total_scanned = 0
        total_deals = 0
        active_item_ids = []
        errors = []

        for keyword in self.keywords:
            logger.info(f"Scanning keyword: '{keyword}'")
            try:
                results = self._scan_keyword(keyword)
                total_scanned += results["scanned"]
                total_deals += results["deals"]
                active_item_ids.extend(results["item_ids"])
            except Exception as e:
                logger.error(f"Error scanning '{keyword}': {e}")
                errors.append(f"{keyword}: {e}")
            time.sleep(1)  # Be polite to SGW servers

        db.mark_deals_stale(active_item_ids)
        db.log_scan_finish(
            scan_id,
            total_scanned,
            total_deals,
            "; ".join(errors) if errors else None,
        )

        logger.info(f"Scan complete. Scanned: {total_scanned}, Deals: {total_deals}")
        return {"scanned": total_scanned, "deals": total_deals, "errors": errors}

    def _scan_keyword(self, keyword: str) -> dict:
        query = {**SGW_SEARCH_TEMPLATE, "searchText": keyword}
        try:
            items = self.sgw.get_query_results(query, page_size=40)
        except Exception as e:
            logger.error(f"SGW query failed for '{keyword}': {e}")
            return {"scanned": 0, "deals": 0, "item_ids": []}

        scanned = 0
        deals = 0
        item_ids = []

        for item in items:
            scanned += 1
            item_id = int(item.get("itemId", 0))
            if not item_id:
                continue

            item_ids.append(item_id)
            current_bid = float(item.get("currentPrice", 0) or 0)
            title = item.get("title", "")

            # Stage 1: Pre-filter
            passes, reason = item_filter.pre_filter(
                item,
                min_bid=self.min_bid_floor,
                max_bid=self.max_bid_cap,
            )
            if not passes:
                logger.debug(f"Pre-filter rejected '{title}': {reason}")
                continue

            # Stage 2: Clean title for eBay search
            clean_term = item_filter.clean_title_for_ebay(title)
            if not clean_term:
                logger.debug(f"Could not extract search term from: '{title}'")
                continue

            # Shipping estimate
            shipping = self._get_shipping(item_id) or 12.0  # default estimate

            # Stage 3: eBay sold price lookup
            try:
                price_result = ebay.get_sold_prices(
                    clean_term,
                    days_back=self.days_back,
                    min_comps=self.min_sold_comps,
                )
            except Exception as e:
                logger.warning(f"eBay lookup failed for '{clean_term}': {e}")
                continue

            if price_result is None:
                logger.debug(f"Not enough eBay comps for: '{clean_term}'")
                continue

            # Calculate profit
            ebay_net = price_result.median * EBAY_FEE_RATE
            total_cost = current_bid + shipping
            profit = ebay_net - total_cost
            margin = profit / total_cost if total_cost > 0 else 0

            if profit < self.min_profit or margin < self.min_margin:
                logger.debug(
                    f"Not profitable enough: '{title}' "
                    f"profit=${profit:.2f} margin={margin:.1%}"
                )
                continue

            # It's a deal — save it
            logger.info(
                f"DEAL: '{title}' | Bid: ${current_bid:.2f} | "
                f"eBay: ${price_result.median:.2f} | Profit: ${profit:.2f} | "
                f"Margin: {margin:.1%}"
            )

            image_urls = item.get("imageUrls", [])
            image_url = image_urls[0] if image_urls else None

            db.upsert_deal({
                "item_id": item_id,
                "title": title,
                "sgw_url": f"https://shopgoodwill.com/item/{item_id}",
                "current_bid": current_bid,
                "shipping_est": shipping,
                "end_time": self._to_utc(item.get("endTime")),
                "seller_id": item.get("sellerId"),
                "image_url": image_url,
                "keyword": keyword,
                **price_result.to_dict(),
                "profit": round(profit, 2),
                "margin": round(margin, 4),
            })
            deals += 1

        return {"scanned": scanned, "deals": deals, "item_ids": item_ids}

    @staticmethod
    def _to_utc(end_time_str: str | None) -> str | None:
        """Convert SGW's Pacific-time end time string to UTC ISO format."""
        if not end_time_str:
            return None
        try:
            fmt = "%Y-%m-%dT%H:%M:%S"
            if "." in end_time_str:
                fmt += ".%f"
            dt = datetime.strptime(end_time_str, fmt)
            dt = dt.replace(tzinfo=ZoneInfo("America/Los_Angeles"))
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            return end_time_str

    def _get_shipping(self, item_id: int) -> Optional[float]:
        try:
            return self.sgw.get_item_shipping_estimate(item_id, self.zip_code)
        except Exception:
            return None
