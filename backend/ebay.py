"""
eBay Finding API — sold price lookup.
Uses findCompletedItems with soldItemsOnly=true.
Free tier: 5,000 calls/day. No OAuth required — just an App ID.
Register at: https://developer.ebay.com/
"""

import os
import statistics
from typing import Optional
from xml.etree import ElementTree as ET

import requests

FINDING_API_URL = "https://svcs.ebay.com/services/search/FindingService/v1"
EBAY_APP_ID = os.getenv("EBAY_APP_ID", "")

NS = "http://www.ebay.com/marketplace/search/v1/services"


class EbayPriceResult:
    def __init__(
        self,
        search_term: str,
        median: float,
        low: float,
        high: float,
        sold_count: int,
        prices: list[float],
    ):
        self.search_term = search_term
        self.median = median
        self.low = low
        self.high = high
        self.sold_count = sold_count
        self.prices = prices

    def to_dict(self):
        return {
            "ebay_search": self.search_term,
            "ebay_median": round(self.median, 2),
            "ebay_low": round(self.low, 2),
            "ebay_high": round(self.high, 2),
            "ebay_sold_count": self.sold_count,
        }


def get_sold_prices(
    search_term: str,
    days_back: int = 90,
    max_results: int = 20,
    min_comps: int = 5,
) -> Optional[EbayPriceResult]:
    """
    Query eBay for completed/sold listings matching search_term.
    Returns None if fewer than min_comps results found.
    """
    if not EBAY_APP_ID:
        raise ValueError("EBAY_APP_ID environment variable not set")

    params = {
        "OPERATION-NAME": "findCompletedItems",
        "SERVICE-VERSION": "1.0.0",
        "SECURITY-APPNAME": EBAY_APP_ID,
        "RESPONSE-DATA-FORMAT": "XML",
        "REST-PAYLOAD": "",
        "keywords": search_term,
        "itemFilter(0).name": "SoldItemsOnly",
        "itemFilter(0).value": "true",
        "itemFilter(1).name": "ListingType",
        "itemFilter(1).value": "Auction",
        "itemFilter(2).name": "ListingType(1)",
        "itemFilter(2).value": "AuctionWithBIN",
        "itemFilter(3).name": "ListingType(2)",
        "itemFilter(3).value": "FixedPrice",
        "sortOrder": "EndTimeSoonest",
        "paginationInput.entriesPerPage": str(max_results),
        "paginationInput.pageNumber": "1",
    }

    try:
        resp = requests.get(FINDING_API_URL, params=params, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"eBay API request failed: {e}")

    root = ET.fromstring(resp.content)

    ack = root.find(f".//{{{NS}}}ack")
    if ack is None or ack.text not in ("Success", "Warning"):
        error_msg = root.find(f".//{{{NS}}}errorMessage/{{{NS}}}error/{{{NS}}}message")
        raise RuntimeError(f"eBay API error: {error_msg.text if error_msg is not None else 'unknown'}")

    items = root.findall(f".//{{{NS}}}item")
    prices = []

    for item in items:
        selling_status = item.find(f"{{{NS}}}sellingStatus")
        if selling_status is None:
            continue
        price_el = selling_status.find(f"{{{NS}}}convertedCurrentPrice")
        if price_el is not None:
            try:
                prices.append(float(price_el.text))
            except (ValueError, TypeError):
                continue

    if len(prices) < min_comps:
        return None

    return EbayPriceResult(
        search_term=search_term,
        median=statistics.median(prices),
        low=min(prices),
        high=max(prices),
        sold_count=len(prices),
        prices=prices,
    )
