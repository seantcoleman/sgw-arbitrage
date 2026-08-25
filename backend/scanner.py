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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional, Union
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
        self.max_items = min(int(settings.get("scan_max_items", 200)), 200)  # hard cap
        self.keywords = settings.get(
            "scan_keywords",
            ["sony headphones", "apple watch", "canon camera"],
        )
        self.category_ids = settings.get("scan_category_ids", [])
        self._category_names: dict = {}

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

        # If categories are set but no keywords, browse each category directly
        scan_targets = self.keywords if self.keywords else (
            [None] if self.category_ids else []
        )

        for keyword in scan_targets:
            label = f"keyword: '{keyword}'" if keyword else f"category browse (ids={self.category_ids})"
            logger.info(f"Scanning {label}")
            try:
                results = self._scan_keyword(keyword)
                total_scanned += results["scanned"]
                total_deals += results["deals"]
                active_item_ids.extend(results["item_ids"])
            except Exception as e:
                logger.error(f"Error scanning {label}: {e}")
                errors.append(f"{label}: {e}")

        db.mark_deals_stale(active_item_ids)
        db.log_scan_finish(
            scan_id,
            total_scanned,
            total_deals,
            "; ".join(errors) if errors else None,
        )

        logger.info(f"Scan complete. Scanned: {total_scanned}, Deals: {total_deals}")
        return {"scanned": total_scanned, "deals": total_deals, "errors": errors}

    def _scan_keyword(self, keyword: Optional[str]) -> dict:
        query = {**SGW_SEARCH_TEMPLATE, "searchText": keyword or ""}
        if self.category_ids:
            query["categoryId"] = self.category_ids
        label = f"'{keyword}'" if keyword else f"category {self.category_ids}"
        try:
            items = self.sgw.get_query_results(query, page_size=40)
        except Exception as e:
            logger.error(f"SGW query failed for {label}: {e}")
            return {"scanned": 0, "deals": 0, "item_ids": []}

        # Cap per the configured max items
        items = items[:self.max_items]

        scanned = len(items)
        deals = 0
        item_ids = [int(item.get("itemId", 0)) for item in items if item.get("itemId")]

        # Run eBay lookups in parallel (8 workers) to drastically cut scan time
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {
                pool.submit(self._process_item, item, keyword): item
                for item in items
                if item.get("itemId")
            }
            for future in as_completed(futures):
                try:
                    if future.result():
                        deals += 1
                except Exception as e:
                    logger.warning(f"Item processing error: {e}")

        return {"scanned": scanned, "deals": deals, "item_ids": item_ids}

    @staticmethod
    def _to_utc(end_time_str: Optional[str]) -> Optional[str]:
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

    def scan_favorites(self) -> dict:
        """Fetch the user's SGW favorites and run each through the arbitrage pipeline."""
        logger.info("Scanning SGW favorites...")
        try:
            favorites = self.sgw.get_favorites()
        except Exception as e:
            logger.error(f"Failed to fetch SGW favorites: {e}")
            return {"scanned": 0, "deals": 0, "errors": [str(e)]}

        scanned = 0
        deals = 0
        errors = []

        for item_id, fav_data in favorites.items():
            scanned += 1
            try:
                # Favorites may not include full details — fetch them
                item = self.sgw.get_item_info(item_id)
                # Normalize field names from itemDetail response
                normalized = {
                    "itemId": item_id,
                    "title": item.get("title") or fav_data.get("title", ""),
                    "currentPrice": float(
                        item.get("currentPrice") or
                        item.get("currentBid") or
                        fav_data.get("currentPrice") or 0
                    ),
                    "endTime": item.get("endTime") or item.get("endDateTime") or fav_data.get("endTime"),
                    "sellerId": item.get("sellerId") or fav_data.get("sellerId"),
                    "imageURL": (
                        (item.get("imageList") or [{}])[0].get("imageUrl") or
                        item.get("imageURL") or
                        fav_data.get("imageURL")
                    ),
                }
                result = self._process_item(normalized, keyword="⭐ favorite", save_skipped=True)
                if result:
                    deals += 1
            except Exception as e:
                logger.warning(f"Error processing favorite {item_id}: {e}")
                errors.append(str(e))

        logger.info(f"Favorites scan complete. Scanned: {scanned}, Deals: {deals}")
        return {"scanned": scanned, "deals": deals, "errors": errors}

    def _source_label(self, item: dict, keyword: Optional[str]) -> str:
        """Human-readable source tag for a deal (search keyword or category name)."""
        if keyword:
            return keyword
        name = (item.get("categoryName") or "").strip()
        if name:
            return name
        if not self._category_names:
            try:
                for cat in self.sgw.get_categories():
                    self._category_names[int(cat["id"])] = cat["name"]
            except Exception as e:
                logger.warning(f"Could not load category names: {e}")
        names = [
            self._category_names.get(int(cid), f"Category {cid}")
            for cid in (self.category_ids or [])
        ]
        return ", ".join(names) if names else "Category browse"

    def _process_item(self, item: dict, keyword: Optional[str] = None, save_skipped: bool = False) -> bool:
        """Run a single normalized item through the full arbitrage pipeline. Returns True if saved as a deal."""
        item_id = int(item.get("itemId", 0))
        if not item_id:
            return False

        keyword = self._source_label(item, keyword)
        title = item.get("title", "")
        current_bid = float(item.get("currentPrice", 0) or 0)

        def _save_skipped(reason: str, price_result=None):
            if not save_skipped:
                return
            image_urls = item.get("imageUrls") or item.get("imageURL") or item.get("galleryURL")
            image_url = image_urls[0] if isinstance(image_urls, list) else image_urls
            db.upsert_skipped({
                "item_id": item_id,
                "title": title,
                "sgw_url": f"https://shopgoodwill.com/item/{item_id}",
                "current_bid": current_bid,
                "shipping_est": None,
                "end_time": self._to_utc(item.get("endTime")),
                "seller_id": item.get("sellerId"),
                "image_url": image_url.replace("\\", "/") if image_url else None,
                "keyword": keyword,
                "ebay_median": price_result.median if price_result else None,
                "ebay_low": price_result.low if price_result else None,
                "ebay_high": price_result.high if price_result else None,
                "ebay_sold_count": price_result.sold_count if price_result else None,
                "ebay_search": price_result.search_term if price_result else None,
                "profit": None,
                "margin": None,
                "skip_reason": reason,
            })

        passes, reason = item_filter.pre_filter(
            item,
            min_bid=self.min_bid_floor,
            max_bid=self.max_bid_cap,
            min_photos=1,
        )
        if not passes:
            logger.debug(f"Pre-filter rejected '{title}': {reason}")
            _save_skipped(reason)
            return False

        clean_term = item_filter.clean_title_for_ebay(title)
        if not clean_term:
            _save_skipped("title couldn't be cleaned for eBay search")
            return False

        shipping = self._get_shipping(item_id) or 12.0

        try:
            price_result = ebay.get_sold_prices(
                clean_term,
                days_back=self.days_back,
                min_comps=self.min_sold_comps,
            )
        except Exception as e:
            logger.warning(f"eBay lookup failed for '{clean_term}': {e}")
            _save_skipped(f"eBay error: {e}")
            return False

        if price_result is None:
            _save_skipped(f"fewer than {self.min_sold_comps} eBay listings found")
            return False

        ebay_net = price_result.median * EBAY_FEE_RATE
        total_cost = current_bid + shipping
        profit = ebay_net - total_cost
        margin = profit / total_cost if total_cost > 0 else 0

        if profit < self.min_profit or margin < self.min_margin:
            if save_skipped:
                image_urls = item.get("imageUrls") or item.get("imageURL") or item.get("galleryURL")
                image_url = image_urls[0] if isinstance(image_urls, list) else image_urls
                db.upsert_skipped({
                    "item_id": item_id,
                    "title": title,
                    "sgw_url": f"https://shopgoodwill.com/item/{item_id}",
                    "current_bid": current_bid,
                    "shipping_est": shipping,
                    "end_time": self._to_utc(item.get("endTime")),
                    "seller_id": item.get("sellerId"),
                    "image_url": image_url.replace("\\", "/") if image_url else None,
                    "keyword": keyword,
                    "ebay_median": price_result.median,
                    "ebay_low": price_result.low,
                    "ebay_high": price_result.high,
                    "ebay_sold_count": price_result.sold_count,
                    "ebay_search": price_result.search_term,
                    "profit": round(profit, 2),
                    "margin": round(margin, 4),
                    "skip_reason": f"below threshold (est. ${profit:.0f} profit, {margin*100:.0f}% margin)",
                })
            return False

        logger.info(
            f"DEAL ({keyword}): '{title}' | Bid: ${current_bid:.2f} | "
            f"eBay: ${price_result.median:.2f} | Profit: ${profit:.2f}"
        )

        image_urls = item.get("imageUrls") or item.get("imageURL") or item.get("galleryURL")
        image_url = image_urls[0] if isinstance(image_urls, list) else image_urls
        if image_url:
            image_url = image_url.replace("\\", "/")

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
        return True

    def _get_shipping(self, item_id: int) -> Optional[float]:
        try:
            return self.sgw.get_item_shipping_estimate(item_id, self.zip_code)
        except Exception:
            return None
