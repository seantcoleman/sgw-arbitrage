"""
Resolve eBay search terms for SGW titles.

Pipeline:
  1. Learned cache (exact title, then brand+model fingerprint)
  2. Heuristic / GPT candidates + spelling variants + shortenings
  3. Validate each candidate against eBay comps; pick first that meets
     min_comps, else the best partial result
  4. Remember successful terms for next time
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import db
import ebay
import filter as item_filter

logger = logging.getLogger(__name__)


@dataclass
class ResolvedSearch:
    term: str
    price_result: Optional[ebay.EbayPriceResult]
    confidence: float
    source: str  # cache_title | cache_product | heuristic | manual
    candidates_tried: int


def title_cache_key(title: str) -> str:
    normalized = " ".join((title or "").lower().split())
    return f"title:{normalized}"


def resolve_ebay_search(
    title: str,
    *,
    days_back: int = 90,
    min_comps: int = 5,
    preferred_term: Optional[str] = None,
    learn: bool = True,
) -> ResolvedSearch:
    """
    Pick the best eBay search term for a title and fetch comps.

    preferred_term: force that term first (manual reprice / Wrong item?).
    """
    cached_term, cache_source = _lookup_cache(title)
    seed_preferred = preferred_term or cached_term

    primary, confidence = item_filter.propose_search_term(title)
    candidates = item_filter.generate_search_candidates(title, preferred=seed_preferred)
    if not candidates:
        return ResolvedSearch(
            term=preferred_term or "",
            price_result=None,
            confidence=0.0,
            source="none",
            candidates_tried=0,
        )

    if preferred_term:
        source = "manual"
        confidence = max(confidence, 0.95)
    elif cache_source:
        source = cache_source
        confidence = max(confidence, 0.85)
    else:
        source = "heuristic"

    best: Optional[ebay.EbayPriceResult] = None
    best_term = candidates[0]
    tried = 0

    for term in candidates:
        tried += 1
        try:
            result = ebay.get_sold_prices(term, days_back=days_back, min_comps=1)
        except Exception as e:
            logger.warning(f"eBay lookup failed for '{term}': {e}")
            continue

        if result is None:
            continue

        if best is None or result.sold_count > best.sold_count:
            best = result
            best_term = result.search_term or term

        if result.sold_count >= min_comps:
            best = result
            best_term = result.search_term or term
            break

    if learn and best is not None and (
        preferred_term or best.sold_count >= min_comps or confidence >= 0.85
    ):
        remember_search_term(
            title,
            best_term,
            source="manual" if preferred_term else "auto",
        )

    return ResolvedSearch(
        term=best_term,
        price_result=best,
        confidence=confidence,
        source=source,
        candidates_tried=tried,
    )


def remember_search_term(title: str, search_term: str, source: str = "auto") -> None:
    """Persist title + product fingerprint → search term mappings."""
    term = (search_term or "").strip()
    if not title or not term:
        return

    db.upsert_search_term_cache(title_cache_key(title), term, source)

    fingerprint = item_filter.product_fingerprint(title)
    if fingerprint:
        db.upsert_search_term_cache(f"product:{fingerprint}", term, source)

    # Also fingerprint from the chosen term itself (brand+model)
    term_fp = item_filter.product_fingerprint(term)
    if term_fp and term_fp != fingerprint:
        db.upsert_search_term_cache(f"product:{term_fp}", term, source)


def _lookup_cache(title: str) -> tuple[Optional[str], Optional[str]]:
    row = db.get_search_term_cache(title_cache_key(title))
    if row:
        db.touch_search_term_cache(row["cache_key"])
        return row["search_term"], "cache_title"

    fingerprint = item_filter.product_fingerprint(title)
    if fingerprint:
        row = db.get_search_term_cache(f"product:{fingerprint}")
        if row:
            db.touch_search_term_cache(row["cache_key"])
            return row["search_term"], "cache_product"

    return None, None
