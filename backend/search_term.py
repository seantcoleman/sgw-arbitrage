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
    Default search is the full listing title — short auto-extracted terms
    were dropping brands like "Nintendo Switch".
    """
    # Only honor manual / explicit preferred terms. Ignore auto cache that
    # learned truncated queries.
    seed_preferred = preferred_term
    if not seed_preferred:
        cached_term, cache_source = _lookup_cache(title)
        if cache_source == "manual" or (cached_term and cache_source):
            # Only reuse cache when it looks like a full title (not a stub)
            full = item_filter._normalize_full_title(title) or ""
            if cached_term and (
                cache_source == "manual"
                or len(cached_term.split()) >= max(4, len(full.split()) - 3)
            ):
                seed_preferred = cached_term

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
    elif seed_preferred:
        source = "cache_title"
        confidence = max(confidence, 0.85)
    else:
        source = "full_title"

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
    if row and _cache_term_usable(title, row):
        db.touch_search_term_cache(row["cache_key"])
        return row["search_term"], "cache_title"

    fingerprint = item_filter.product_fingerprint(title)
    if fingerprint:
        row = db.get_search_term_cache(f"product:{fingerprint}")
        if row and _cache_term_usable(title, row):
            db.touch_search_term_cache(row["cache_key"])
            return row["search_term"], "cache_product"

    return None, None


def _cache_term_usable(title: str, row: dict) -> bool:
    """Ignore short/stale auto cache entries that conflict with a better heuristic."""
    term = (row.get("search_term") or "").strip()
    if not term:
        return False
    source = (row.get("source") or "").lower()
    if source == "manual":
        return True

    heuristic = item_filter._clean_with_regex(title)
    if heuristic:
        h_tokens = {w.lower() for w in heuristic.split()}
        t_tokens = {w.lower() for w in term.split()}
        # Cached term must share a model-ish or product token with the heuristic
        h_models = {w for w in h_tokens if item_filter._is_model_token(w)}
        if h_models and not (h_models & t_tokens):
            return False
        # Reject cache that's much shorter / weaker than heuristic brand+model
        if len(h_tokens) >= 3 and len(t_tokens) <= 2 and not (h_models & t_tokens):
            return False

    if item_filter.title_has_model(title):
        return True
    # Descriptive titles need a reasonably specific cached phrase
    return len(term.split()) >= 4
