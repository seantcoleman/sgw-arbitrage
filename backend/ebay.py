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
import re
import statistics
import time
from typing import List, Optional

import requests

EBAY_APP_ID = os.getenv("EBAY_APP_ID", "")
EBAY_CERT_ID = os.getenv("EBAY_CERT_ID", "")
BROWSE_API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"

# Used / pre-owned condition IDs (eBay Browse API)
USED_CONDITION_IDS = "1500|2000|2500|3000"

# Stopwords ignored when matching search tokens to listing titles
_STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "for", "with", "by", "in", "on",
    "to", "from", "set", "lot", "new", "used", "black", "white", "red",
    "blue", "green", "brown", "silver", "gold", "size", "full", "right",
    "left", "hand", "handed", "guitar", "acoustic", "electric", "vintage",
}

_token: Optional[str] = None
_token_expires_at: float = 0.0

# In-memory cache: key=(search_term, days_back, version) → (result, expires_at)
# 4-hour TTL — eBay prices don't change meaningfully in minutes
_CACHE_TTL = 4 * 3600
_cache: dict = {}
_cache_hits = 0
_cache_misses = 0


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


def _extract_tokens(search_term: str) -> tuple:
    """
    Split search term into (model_tokens, other_tokens).

    Model tokens contain digits (e.g. SA41BKCH, WH-1000XM4) and must appear
    in a listing title for it to count as a comparable.
    """
    raw = re.findall(r"[A-Za-z0-9][A-Za-z0-9\-/\.]*", search_term)
    models: List[str] = []
    others: List[str] = []
    for t in raw:
        lower = t.lower().strip(".-/")
        if not lower or lower in _STOPWORDS:
            continue
        if any(c.isdigit() for c in lower) and len(lower) >= 3:
            models.append(lower)
        elif len(lower) >= 3:
            others.append(lower)
    return models, others


def _title_matches(title: str, model_tokens: List[str], other_tokens: List[str]) -> bool:
    """
    Strict title match:
    - If model tokens exist (e.g. sa41bkch), ALL of them must appear in the title.
    - Otherwise require most other significant tokens (brand etc.).
    """
    t = title.lower()
    # Normalize separators so SA-41BKCH matches SA41BKCH
    t_compact = re.sub(r"[\s\-/\.]+", "", t)

    if model_tokens:
        for m in model_tokens:
            m_compact = re.sub(r"[\s\-/\.]+", "", m)
            if m not in t and m_compact not in t_compact:
                return False
        return True

    if not other_tokens:
        return True
    # Require at least ceil(2/3) of brand/product words
    hits = sum(1 for w in other_tokens if w in t)
    need = max(1, (len(other_tokens) * 2 + 2) // 3)
    return hits >= need


def get_sold_prices(
    search_term: str,
    days_back: int = 90,
    max_results: int = 20,
    min_comps: int = 5,
) -> Optional[EbayPriceResult]:
    """
    Query eBay Browse API for current used-condition BIN listings matching search_term.
    Results are cached for 4 hours to stay within eBay API rate limits.
    Returns None only when no title-matched listings are found.
    Callers should compare sold_count to min_comps for deal thresholds;
    partial comps are still returned so UIs can show estimates + skip reasons.
    """
    global _cache_hits, _cache_misses

    # Bust cache when matching / partial-comps logic changes
    cache_key = (search_term.lower().strip(), days_back, "v3-partial-comps")
    now = time.time()

    if cache_key in _cache:
        result, expires_at = _cache[cache_key]
        if now < expires_at:
            _cache_hits += 1
            return result

    _cache_misses += 1
    result = _fetch_sold_prices(search_term, days_back, max_results, min_comps)
    _cache[cache_key] = (result, now + _CACHE_TTL)

    if _cache_misses % 500 == 0:
        _cache.clear()

    return result


def get_cache_stats() -> dict:
    total = _cache_hits + _cache_misses
    return {
        "hits": _cache_hits,
        "misses": _cache_misses,
        "hit_rate": round(_cache_hits / total, 3) if total else 0,
        "cached_terms": len(_cache),
    }


def _fetch_sold_prices(
    search_term: str,
    days_back: int = 90,
    max_results: int = 20,
    min_comps: int = 5,
) -> Optional[EbayPriceResult]:
    """
    Raw eBay Browse API call. Use get_sold_prices() for the cached version.

    Matching is stricter than eBay's default relevance: model numbers in the
    search term must appear in listing titles so unrelated high-priced brand
    siblings don't inflate the median.
    """
    token = _get_token()
    model_tokens, other_tokens = _extract_tokens(search_term)

    try:
        resp = requests.get(
            BROWSE_API_URL,
            headers={"Authorization": f"Bearer {token}"},
            params={
                "q": search_term,
                "filter": f"conditionIds:{{{USED_CONDITION_IDS}}},buyingOptions:{{FIXED_PRICE}}",
                "limit": str(max(max_results, 40)),
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
        title = item.get("title") or ""
        if not _title_matches(title, model_tokens, other_tokens):
            continue
        price_info = item.get("price", {})
        if price_info and price_info.get("currency") == "USD":
            try:
                prices.append(float(price_info["value"]))
            except (ValueError, TypeError):
                continue

    if not prices:
        return None

    # Tighter band once title matching has already dropped brand siblings
    rough_median = statistics.median(prices)
    prices_filtered = [
        p for p in prices
        if rough_median * 0.4 <= p <= rough_median * 2.5
    ]

    # Prefer the filtered band when it still meets min_comps; otherwise keep
    # whatever title-matched prices we have so callers can show partial comps
    # and skip reasons instead of discarding the lookup entirely.
    if len(prices_filtered) < min_comps:
        if len(prices) >= min_comps or not prices_filtered:
            prices_filtered = prices

    return EbayPriceResult(
        search_term=search_term,
        median=statistics.median(prices_filtered),
        low=min(prices_filtered),
        high=max(prices_filtered),
        sold_count=len(prices_filtered),
        prices=prices_filtered,
    )
