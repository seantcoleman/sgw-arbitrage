"""Shared net-profit math for SGW buy → eBay sell.

you_get = median * (1 - fee_pct/100) - ebay_resale_shipping
you_pay = current_bid + sgw_shipping
profit  = you_get - you_pay
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

DEFAULT_EBAY_FEE_PCT = 13.0
DEFAULT_EBAY_RESALE_SHIPPING = 7.0
DEFAULT_SGW_SHIPPING = 12.0


def fee_settings(settings: Optional[Dict[str, Any]] = None) -> Tuple[float, float]:
    """Return (ebay_fee_pct, ebay_resale_shipping) from settings or defaults."""
    s = settings or {}
    try:
        fee_pct = float(s.get("ebay_fee_pct", DEFAULT_EBAY_FEE_PCT))
    except (TypeError, ValueError):
        fee_pct = DEFAULT_EBAY_FEE_PCT
    try:
        resale_ship = float(s.get("ebay_resale_shipping", DEFAULT_EBAY_RESALE_SHIPPING))
    except (TypeError, ValueError):
        resale_ship = DEFAULT_EBAY_RESALE_SHIPPING
    return fee_pct, resale_ship


def you_get(
    ebay_median: float,
    fee_pct: float = DEFAULT_EBAY_FEE_PCT,
    resale_shipping: float = DEFAULT_EBAY_RESALE_SHIPPING,
) -> float:
    keep = max(0.0, 1.0 - fee_pct / 100.0)
    return ebay_median * keep - resale_shipping


def you_pay(current_bid: float, sgw_shipping: float) -> float:
    return current_bid + sgw_shipping


def net_profit(
    ebay_median: float,
    current_bid: float,
    sgw_shipping: float,
    fee_pct: float = DEFAULT_EBAY_FEE_PCT,
    resale_shipping: float = DEFAULT_EBAY_RESALE_SHIPPING,
) -> Tuple[float, float, float]:
    """Return (you_get, you_pay, profit)."""
    yg = you_get(ebay_median, fee_pct, resale_shipping)
    yp = you_pay(current_bid, sgw_shipping)
    return yg, yp, yg - yp


def annotate_deal(
    deal: Dict[str, Any],
    fee_pct: float,
    resale_shipping: float,
) -> Dict[str, Any]:
    """Recompute you_get / profit / margin on a deal-like dict in place and return it."""
    median = deal.get("ebay_median")
    if median is None:
        deal["you_get"] = None
        return deal
    try:
        median_f = float(median)
    except (TypeError, ValueError):
        deal["you_get"] = None
        return deal

    bid = float(deal.get("current_bid") or deal.get("final_price") or 0)
    ship = float(deal.get("shipping_est") if deal.get("shipping_est") is not None else DEFAULT_SGW_SHIPPING)
    yg, yp, profit = net_profit(median_f, bid, ship, fee_pct, resale_shipping)
    deal["you_get"] = round(yg, 2)
    deal["profit"] = round(profit, 2)
    deal["margin"] = round(profit / yp, 4) if yp > 0 else 0.0
    deal["ebay_fee_pct"] = fee_pct
    deal["ebay_resale_shipping"] = resale_shipping
    return deal


def you_get_caption(fee_pct: float, resale_shipping: float) -> str:
    fee = int(fee_pct) if fee_pct == int(fee_pct) else fee_pct
    ship = int(resale_shipping) if resale_shipping == int(resale_shipping) else f"{resale_shipping:.2f}"
    return f"after {fee}% + ${ship} ship"
