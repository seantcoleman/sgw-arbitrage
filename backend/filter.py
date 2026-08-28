"""
Three-stage item filter pipeline.

Stage 1 — Pre-filter (instant, no API calls):
  - Junk keyword exclusion
  - Bid range filter
  - Minimum photo count

Stage 2 — Title cleaning (GPT-4o-mini when OPENAI_API_KEY is set):
  - Brand + model when a model token exists
  - Longer descriptive phrases when it does not
  - Regex heuristic fallback when GPT is unavailable

Stage 3 — eBay confidence check (handled in scanner / search_term):
  - Requires min_comps matched listings
"""

import os
import re
from typing import List, Optional, Tuple

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

# Filler stripped for all titles (brand+model and descriptive)
_SEARCH_NOISE = {
    "used", "lot", "set", "bundle", "vintage", "antique", "rare", "nice", "great",
    "works", "working", "tested", "clean", "good", "fair", "poor", "estate", "thrift",
    "goodwill", "charity", "auction", "bid", "item", "piece", "unit", "each",
    "with", "and", "the", "for", "from", "plus", "including", "includes", "w",
    "manual", "original", "box", "adapter", "cord", "cable", "power", "powers",
    "stand", "cover", "case", "bag", "remote", "batteries", "battery", "charger",
    "new", "open", "cib", "nib", "oem", "genuine", "authentic",
    "black", "white", "silver", "gray", "grey", "blue", "red", "green",
    "portable", "digital", "electric", "electronic", "wireless", "bluetooth",
    "made", "malaysia", "china", "japan", "store", "pickup", "only", "ship",
    "shipping", "free", "fast", "read", "description", "desc", "see", "photos",
    # Category fluff safe to drop once a model token exists (Pass 1 returns early)
    "sampling", "keyboard", "keyboards", "piano", "synthesizer", "synth",
    "instrument", "instruments", "gear", "music", "audio",
}

# Extra filler only for descriptive (no-model) titles
_DESCRIPTIVE_NOISE = {
    "inspired", "style", "styled", "design", "decorative", "decor", "beautiful",
    "stunning", "gorgeous", "lovely", "unique", "custom", "handmade",
}

# Model-ish tokens: letters + digits, optional hyphen (SK-5, CTK-533, WH-1000XM4)
_MODEL_RE = re.compile(r"^[A-Za-z]{1,8}-?\d[\w\-]{0,12}$")
# Pure size / capacity numbers that often follow a product line (Roadie 60)
_SIZE_RE = re.compile(r"^\d{1,4}$")
# Spec units that look like models but aren't (2-Channel, 4-Track, 35mm, 60L)
_FALSE_MODEL_RE = re.compile(
    r"^\d+[-.]?(channels?|tracks?|keys?|mm|cm|in|inch|inches|ft|oz|lbs?|"
    r"gb|tb|mhz|khz|hz|watts?|volts?|pack|pcs?|bits?|ways?|quarts?|qt|l|ml)$",
    re.IGNORECASE,
)
# camelCase gadget names without digits (iRig, eBike)
_CAMEL_PRODUCT_RE = re.compile(r"^[a-z]{1,3}[A-Z][A-Za-z0-9\-]{1,16}$")
_PRODUCT_SUFFIXES = {
    "pro", "duo", "max", "plus", "mini", "air", "lite", "se", "xl", "ultra",
}
# Words that sit next to a model but aren't the brand
_BRAND_SKIP = {
    "console", "recorder", "camera", "microphone", "mic", "pedal", "amp",
    "amplifier", "mixer", "interface", "controller", "machine", "system",
    "model", "series", "edition", "version", "type", "cooler", "pack",
    "backpack", "bag", "drum", "guitar", "bass", "violin", "flute",
    "program", "body",
}
_DANGLING_TAIL = re.compile(
    r"\b(with|and|for|or|the|a|an|of|to|from|plus|w/?)\s*$",
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

    photo_count = int(item.get("numOfPhotos", item.get("photo_count", 0)) or 0)
    if photo_count == 0:
        has_image = bool(item.get("imageURL") or item.get("galleryURL") or item.get("imageUrls"))
        photo_count = 1 if has_image else 0

    if JUNK_PATTERN.search(title):
        matched = JUNK_PATTERN.search(title).group()
        return False, f"junk word: '{matched}'"

    if current_bid < min_bid:
        return False, f"bid too low: ${current_bid:.2f}"
    if current_bid > max_bid:
        return False, f"bid too high: ${current_bid:.2f}"

    if photo_count < min_photos:
        return False, f"too few photos: {photo_count}"

    return True, "ok"


def clean_title_for_ebay(sgw_title: str) -> Optional[str]:
    primary, _confidence = propose_search_term(sgw_title)
    return primary


def propose_search_term(sgw_title: str) -> Tuple[Optional[str], float]:
    """
    Return (term, confidence 0..1).

    High (~0.9): clear brand + model.
    Medium (~0.6): descriptive multi-word product phrase.
    Low (~0.35): weak / GPT-only fallback.
    """
    if not sgw_title or not sgw_title.strip():
        return None, 0.0

    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    gpt_term = _clean_with_gpt(sgw_title, openai_key) if openai_key else None
    heuristic = _clean_with_regex(sgw_title)
    heuristic_conf = _confidence_for_term(heuristic) if heuristic else 0.0

    if gpt_term:
        normalized = _normalize_search_term(gpt_term)
        if normalized and _looks_like_product_query(normalized):
            gpt_conf = _confidence_for_term(normalized)
            if not heuristic or gpt_conf >= heuristic_conf:
                return normalized, gpt_conf

    if heuristic:
        return heuristic, heuristic_conf

    if gpt_term:
        normalized = _normalize_search_term(gpt_term)
        return normalized, 0.35 if normalized else 0.0

    return None, 0.0


def product_fingerprint(sgw_title: str) -> Optional[str]:
    """Stable brand+model key for cache lookups, e.g. 'casio sk-5'."""
    term = _clean_with_regex(sgw_title)
    if not term:
        return None
    if not any(_is_model_token(w) for w in term.split()):
        return None
    return term.lower().strip()


def title_has_model(sgw_title: str) -> bool:
    return product_fingerprint(sgw_title) is not None


def generate_search_candidates(sgw_title: str, preferred: Optional[str] = None) -> List[str]:
    """
    Ordered unique search-term variants to try against eBay.

    With a model token: short brand+model first.
    Without a model: longest descriptive phrase first, then progressive shorten.
    """
    primary, _ = propose_search_term(sgw_title)
    heuristic = _clean_with_regex(sgw_title)

    seeds: List[str] = []
    for t in (preferred, primary, heuristic):
        n = _normalize_search_term(t)
        if n:
            seeds.append(n)

    out: List[str] = []
    seen = set()

    def add(term: Optional[str]):
        n = _normalize_search_term(term)
        if not n:
            return
        key = n.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(n)

    base = max(seeds, key=lambda s: len(s.split())) if seeds else None
    has_model = bool(base and any(_is_model_token(w) for w in base.split())) or title_has_model(sgw_title)

    if has_model:
        for seed in seeds:
            add(seed)
            for alt in _spelling_variants(seed):
                add(alt)
        if base:
            words = base.split()
            for length in range(min(len(words), 3), 1, -1):
                add(" ".join(words[:length]))
    else:
        if base:
            words = base.split()
            for length in range(len(words), 2, -1):
                add(" ".join(words[:length]))
        for seed in seeds:
            add(seed)

    return out


def _confidence_for_term(term: Optional[str]) -> float:
    if not term:
        return 0.0
    words = term.split()
    if _DANGLING_TAIL.search(term):
        return 0.25
    has_model = any(_is_model_token(w) for w in words)
    if has_model and len(words) <= 3:
        return 0.9
    if has_model:
        return 0.75
    if 4 <= len(words) <= 8:
        return 0.6
    if len(words) <= 3:
        return 0.4
    return 0.35


def _spelling_variants(term: str) -> List[str]:
    """SK-5 ↔ SK5, CTK-533 ↔ CTK533, etc."""
    variants: List[str] = []
    words = term.split()
    for i, w in enumerate(words):
        if "-" in w and _is_model_token(w):
            alt = words.copy()
            alt[i] = w.replace("-", "")
            variants.append(" ".join(alt))
        elif _is_model_token(w) and any(c.isdigit() for c in w) and any(c.isalpha() for c in w):
            m = re.match(r"^([A-Za-z]+)(\d.*)$", w)
            if m and "-" not in w:
                alt = words.copy()
                alt[i] = f"{m.group(1)}-{m.group(2)}"
                variants.append(" ".join(alt))
    return variants


def _looks_like_product_query(term: str) -> bool:
    words = term.split()
    if not words or len(words) > 8:
        return False
    if _DANGLING_TAIL.search(term):
        return False
    if any(_is_model_token(w) for w in words):
        return True
    return 1 <= len(words) <= 8


def _normalize_search_term(term: Optional[str]) -> Optional[str]:
    if not term:
        return None
    cleaned = re.sub(r"[\"'`]", "", term.strip())
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = _DANGLING_TAIL.sub("", cleaned).strip(" -/,")
    if not cleaned or cleaned.upper() == "SKIP":
        return None
    return cleaned


def _is_model_token(tok: str) -> bool:
    raw = tok.strip(".-")
    if not raw or raw.lower() in _SEARCH_NOISE:
        return False
    if _FALSE_MODEL_RE.match(raw):
        return False
    if _MODEL_RE.match(raw):
        return True
    if _CAMEL_PRODUCT_RE.match(raw):
        return True
    return any(c.isdigit() for c in raw) and any(c.isalpha() for c in raw) and 2 <= len(raw) <= 16


def _clean_with_gpt(title: str, api_key: str) -> Optional[str]:
    """Extract a clean eBay search term using GPT-4o-mini."""
    import httpx

    prompt = (
        "You are an eBay search expert. Turn this auction title into a good eBay search.\n\n"
        f"Title: {title}\n\n"
        "Rules:\n"
        "- Return ONLY the search term, nothing else\n"
        "- If there is a brand + model number, return just those (e.g. \"Casio SK-5\", \"Yamaha DX7\")\n"
        "- If there is NO model number (furniture, art, decor), keep the distinctive product "
        "words (region/style, motif, material, object) — about 5–8 words "
        "(e.g. \"Chinese Qing Dynasty dragon armchair marble\")\n"
        "- Remove accessories (manual, box, stand, adapter, case) and filler (inspired, style, vintage)\n"
        "- Do NOT end with filler words (with, and, for, of)\n"
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
                "max_tokens": 40,
                "temperature": 0,
            },
            timeout=8,
        )
        resp.raise_for_status()
        result = resp.json()["choices"][0]["message"]["content"].strip()
        return _normalize_search_term(result)
    except Exception:
        return None


def _clean_with_regex(title: str) -> Optional[str]:
    """
    Deterministic search-term extraction.

    With model: brand + model (Casio SK-5, Yamaha DX7, YETI Roadie 60).
    Without model: longer descriptive phrase keeping product nouns.
    """
    text = re.sub(r"[/\\|]+", " ", title)
    text = re.sub(r"[^\w\s\-.]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None

    tokens = [t.strip(".-") for t in text.split() if t.strip(".-")]
    if not tokens:
        return None

    # Pass 1: brand + alphanumeric / camelCase model (+ Pro/Duo-style suffixes)
    for i, tok in enumerate(tokens):
        if not _is_model_token(tok):
            continue
        brand = _prior_brand(tokens, i)
        parts: List[str] = []
        if brand:
            parts.extend(brand.split())
        parts.append(tok)
        k = i + 1
        while k < len(tokens) and tokens[k].lower() in _PRODUCT_SUFFIXES and len(parts) < 6:
            parts.append(tokens[k])
            k += 1
        return _normalize_search_term(" ".join(parts))

    # Pass 2: brand + product line + size number (YETI Roadie 60)
    for i, tok in enumerate(tokens):
        if not _SIZE_RE.match(tok):
            continue
        if i == 0:
            continue
        product = tokens[i - 1]
        if product.lower() in _SEARCH_NOISE or _is_model_token(product) or product.isdigit():
            continue
        if not product.isalpha() and not re.match(r"^[A-Za-z][A-Za-z0-9\-]+$", product):
            continue
        brand = _prior_brand(tokens, i - 1)
        parts = []
        if brand:
            for b in brand.split():
                if b.lower() != product.lower():
                    parts.append(b)
        parts.extend([product, tok])
        return _normalize_search_term(" ".join(parts))

    # Pass 3: descriptive — keep up to 7 product words
    kept: List[str] = []
    for tok in tokens:
        low = tok.lower()
        if not tok or low in _SEARCH_NOISE or low in _DESCRIPTIVE_NOISE:
            continue
        if tok.isdigit() and not kept:
            continue
        kept.append(tok)
        if len(kept) >= 7:
            break
    return _normalize_search_term(" ".join(kept)) if kept else None


def _prior_brand(tokens: List[str], model_idx: int) -> Optional[str]:
    """
    Brand / product-line word(s) before the model.

    Takes up to two prior alpha tokens so names like
    "IK Multimedia", "Tascam Portastudio", "Nintendo Switch" survive.
    """
    for j in range(model_idx - 1, -1, -1):
        cand = tokens[j]
        low = cand.lower()
        if not cand or low in _SEARCH_NOISE or low in _BRAND_SKIP:
            continue
        if any(c.isdigit() for c in cand):
            continue
        if not (cand.isalpha() and len(cand) >= 2):
            continue
        parts = [cand]
        if j > 0:
            prev = tokens[j - 1]
            prev_low = prev.lower()
            if (
                prev.isalpha()
                and len(prev) >= 2
                and prev_low not in _SEARCH_NOISE
                and prev_low not in _BRAND_SKIP
            ):
                parts.insert(0, prev)
        return " ".join(parts)
    return None
