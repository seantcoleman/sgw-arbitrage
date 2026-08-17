"""
eBay Browse API — current listing price lookup for arbitrage comparison.

Uses the eBay Browse API v1 with OAuth Client Credentials flow.
Fetches current BIN (Buy It Now) prices for used items as a market-rate reference.
The Finding API (findCompletedItems) was deprecated by eBay in June 2023.

Credentials: set EBAY_APP_ID and EBAY_CERT_ID in .env
Register / manage at: https://developer.ebay.com/
"""

import base64
import os
import statistics
import time
from typing import Optional

import requests

EBAY_APP_ID = os.getenv("EBAY_APP_ID", "")
EBAY_CERT_ID = os.getenv("EBAY_CERT_ID", "")
BROWSE_API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"

# Used / pre-owned condition IDs (eBay Browse API)
USED_CONDITION_IDS = "1500|2000|2500|3000"

_token: Optional[str] = None
_token_expires_at: float = 0.0


class EbayPriceResult:
    def __init__(
        self,
        search_term: str,
        median: float,
        low: float,
        high: float,
        sold_count: int,
        prices: list,
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


def _get_token() -> str:
    """Fetch or refresh an OAuth2 client credentials token."""
    global _token, _token_expires_at

    now = time.time()
    if _token and now < _token_expires_at - 60:
        return _token

    if not EBAY_APP_ID or not EBAY_CERT_ID:
        raise ValueError("EBAY_APP_ID and EBAY_CERT_ID environment variables required")

    creds = base64.b64encode(f"{EBAY_APP_ID}:{EBAY_CERT_ID}".encode()).decode()
    resp = requests.post(
        TOKEN_URL,
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data="grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        raise RuntimeError(f"eBay OAuth failed: {data}")

    _token = data["access_token"]
    _token_expires_at = now + data.get("expires_in", 7200)
    return _token


def get_sold_prices(
    search_term: str,
    days_back: int = 90,
    max_results: int = 20,
    min_comps: int = 5,
) -> Optional[EbayPriceResult]:
    """
    Query eBay Browse API for current used-condition BIN listings matching search_term.
    Returns None if fewer than min_comps results found after outlier filtering.

    Note: eBay deprecated findCompletedItems (Finding API) in June 2023.
    This uses current BIN prices for used items as a market-rate reference.
    """
    token = _get_token()

    try:
        resp = requests.get(
            BROWSE_API_URL,
            headers={"Authorization": f"Bearer {token}"},
            params={
                "q": search_term,
                "filter": f"conditionIds:{{{USED_CONDITION_IDS}}},buyingOptions:{{FIXED_PRICE}}",
                "limit": str(max(max_results, 40)),
                # Default sort = relevance; do NOT sort by price (accessories dominate low end)
            },
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"eBay Browse API request failed: {e}")

    data = resp.json()
    items = data.get("itemSummaries", [])

    prices = []
    for item in items:
        price_info = item.get("price", {})
        if price_info and price_info.get("currency") == "USD":
            try:
                prices.append(float(price_info["value"]))
            except (ValueError, TypeError):
                continue

    if not prices:
        return None

    # Remove outliers: keep items within 0.25x to 4x of the rough median
    # This filters accessories (too cheap) and overpriced anomalies
    rough_median = statistics.median(prices)
    prices_filtered = [
        p for p in prices
        if rough_median * 0.25 <= p <= rough_median * 4.0
    ]

    if len(prices_filtered) < min_comps:
        return None

    return EbayPriceResult(
        search_term=search_term,
        median=statistics.median(prices_filtered),
        low=min(prices_filtered),
        high=max(prices_filtered),
        sold_count=len(prices_filtered),
        prices=prices_filtered,
    )
