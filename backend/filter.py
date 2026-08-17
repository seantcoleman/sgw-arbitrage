"""
Three-stage item filter pipeline.

Stage 1 — Pre-filter (instant, no API calls):
  - Junk keyword exclusion
  - Bid range filter
  - Minimum photo count

Stage 2 — Title cleaning (GPT-4o-mini, ~$0.0001/item):
  - Extracts brand + model from messy SGW titles
  - Returns clean eBay search term

Stage 3 — eBay confidence check (handled in scanner.py):
  - Requires min_comps sold listings
"""

import os
import re
from typing import Optional, Tuple

JUNK_WORDS = [
    "lot of", "as is", "as-is", "for parts", "untested", "broken",
    "damaged", "incomplete", "missing", "cracked", "read desc",
    "read description", "not working", "parts only", "spares",
    "no power", "powers on", "unknown", "unverified", "sold as is",
    "bag of", "bundle of", "mixed lot", "various", "assorted",
    "junk drawer", "estate lot",
]

JUNK_PATTERN = re.compile(
    "|".join(re.escape(w) for w in JUNK_WORDS),
    re.IGNORECASE,
)


def pre_filter(
    item: dict,
    min_bid: float = 3.0,
    max_bid: float = 300.0,
    min_photos: int = 2,
) -> Tuple[bool, str]:
    """
    Returns (passes: bool, reason: str).
    Fast check — no external API calls.
    """
    title = item.get("title", "")
    current_bid = float(item.get("currentPrice", item.get("current_bid", 0)) or 0)

    # Photo count — old API used numOfPhotos; new Azure Search API uses imageURL presence
    photo_count = int(item.get("numOfPhotos", item.get("photo_count", 0)) or 0)
    if photo_count == 0:
        # Fall back to checking if an image URL is present
        has_image = bool(item.get("imageURL") or item.get("galleryURL") or item.get("imageUrls"))
        photo_count = 1 if has_image else 0

    # Junk word check
    if JUNK_PATTERN.search(title):
        matched = JUNK_PATTERN.search(title).group()
        return False, f"junk word: '{matched}'"

    # Bid range
    if current_bid < min_bid:
        return False, f"bid too low: ${current_bid:.2f}"
    if current_bid > max_bid:
        return False, f"bid too high: ${current_bid:.2f}"

    # Photo count
    if photo_count < min_photos:
        return False, f"too few photos: {photo_count}"

    return True, "ok"


def clean_title_for_ebay(sgw_title: str) -> Optional[str]:
    """
    Use GPT-4o-mini to extract a clean brand + model search term
    from a messy ShopGoodwill title.

    Falls back to a simple regex cleanup if OPENAI_API_KEY is not set.
    """
    openai_key = os.getenv("OPENAI_API_KEY")

    if openai_key:
        return _clean_with_gpt(sgw_title, openai_key)
    else:
        return _clean_with_regex(sgw_title)


def _clean_with_gpt(title: str, api_key: str) -> Optional[str]:
    """Extract a clean eBay search term using GPT-4o-mini."""
    import httpx

    prompt = (
        "You are an eBay search expert. Extract the brand and model from this messy "
        "auction title so it can be searched on eBay sold listings.\n\n"
        f"Title: {title}\n\n"
        "Rules:\n"
        "- Return ONLY the search term, nothing else\n"
        "- Include brand + model number if present\n"
        "- Remove condition words (used, broken, etc.)\n"
        "- Remove lot/bundle language\n"
        "- Keep it under 6 words\n"
        "- If you can't identify a product, return SKIP\n\n"
        "Search term:"
    )

    try:
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 20,
                "temperature": 0,
            },
            timeout=8,
        )
        result = resp.json()["choices"][0]["message"]["content"].strip()
        if result.upper() == "SKIP" or not result:
            return None
        return result
    except Exception:
        return _clean_with_regex(title)


def _clean_with_regex(title: str) -> str:
    """
    Simple regex-based title cleanup as fallback.
    Strips common noise words and truncates to 5 words.
    """
    noise = re.compile(
        r"\b(used|lot|set|bundle|vintage|antique|rare|nice|great|"
        r"works|tested|clean|good|fair|poor|estate|thrift|"
        r"goodwill|charity|auction|bid|item|piece|unit|each)\b",
        re.IGNORECASE,
    )
    cleaned = noise.sub("", title)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    words = cleaned.split()[:5]
    return " ".join(words)
