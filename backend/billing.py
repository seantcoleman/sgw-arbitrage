"""
Win-fee billing helpers — 2% of hammer on Standard, waived on Pro.

Stripe invoicing runs from the Oracle API when a win is recorded.
Checkout / Customer Portal / webhooks live on Vercel.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

SUCCESS_FEE_PCT = 0.02
STRIPE_MIN_CENTS = 50  # US card minimum


def _stripe_client():
    key = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
    if not key:
        return None
    try:
        import stripe
    except ImportError:
        logger.warning("stripe package not installed — win fees will stay pending")
        return None
    return stripe.StripeClient(key)


def fee_cents_for_hammer(hammer_dollars: float) -> int:
    return max(0, int(round(float(hammer_dollars) * SUCCESS_FEE_PCT * 100)))


def record_and_maybe_invoice(
    *,
    user_id: str,
    item_id: int,
    final_price: float,
    title: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Insert win_fees row (idempotent) and invoice if accrued pending >= $0.50."""
    import db

    if not db.using_postgres():
        return None
    if final_price is None or float(final_price) < 0:
        return None

    profile = db.get_billing_profile(user_id)
    plan = (profile or {}).get("plan") or "standard"
    sub_status = (profile or {}).get("stripe_subscription_status") or ""
    pro_active = plan == "pro" and sub_status in ("active", "trialing")

    hammer_cents = int(round(float(final_price) * 100))
    if pro_active:
        fee_cents = 0
        status = "waived"
    else:
        fee_cents = fee_cents_for_hammer(final_price)
        status = "pending" if fee_cents > 0 else "waived"

    row = db.upsert_win_fee(
        user_id=user_id,
        item_id=item_id,
        hammer_cents=hammer_cents,
        fee_cents=fee_cents,
        status=status,
    )

    if status == "pending":
        try:
            maybe_invoice_pending_fees(user_id)
        except Exception as e:
            logger.error(f"Invoice drain failed for {user_id}: {e}")

    return row


def maybe_invoice_pending_fees(user_id: str) -> Optional[str]:
    """Create/finalize a Stripe invoice when pending fee total >= $0.50."""
    import db

    profile = db.get_billing_profile(user_id)
    if not profile:
        return None
    customer_id = profile.get("stripe_customer_id")
    if not customer_id:
        logger.info(f"No stripe customer for {user_id} — fees stay pending")
        return None

    pending = db.list_pending_win_fees(user_id)
    total = sum(int(r["fee_cents"]) for r in pending)
    if total < STRIPE_MIN_CENTS:
        return None

    stripe = _stripe_client()
    if stripe is None:
        return None

    # One invoice for the accrued batch; items use per-win idempotency keys
    invoice = stripe.v1.invoices.create(
        params={
            "customer": customer_id,
            "auto_advance": True,
            "collection_method": "charge_automatically",
            "metadata": {"supabase_user_id": str(user_id), "purpose": "win_fees"},
        },
        options={
            "idempotency_key": f"winfee-inv:{user_id}:{pending[0]['id']}:{total}",
        },
    )
    invoice_id = invoice["id"] if isinstance(invoice, dict) else invoice.id

    for fee in pending:
        item = stripe.v1.invoice_items.create(
            params={
                "customer": customer_id,
                "invoice": invoice_id,
                "amount": int(fee["fee_cents"]),
                "currency": "usd",
                "description": f"Success fee 2% — SGW item {fee['item_id']}",
                "metadata": {
                    "supabase_user_id": str(user_id),
                    "item_id": str(fee["item_id"]),
                    "win_fee_id": str(fee["id"]),
                },
            },
            options={
                "idempotency_key": f"winfee:{user_id}:{fee['item_id']}",
            },
        )
        item_id = item["id"] if isinstance(item, dict) else item.id
        db.mark_win_fee_invoiced(
            fee["id"],
            stripe_invoice_id=invoice_id,
            stripe_invoice_item_id=item_id,
        )

    finalized = stripe.v1.invoices.finalize_invoice(invoice_id)
    try:
        stripe.v1.invoices.pay(invoice_id)
    except Exception as e:
        # Payment may require retries / dunning — invoice still exists
        logger.warning(f"Invoice {invoice_id} pay deferred: {e}")

    fid = finalized["id"] if isinstance(finalized, dict) else getattr(finalized, "id", invoice_id)
    logger.info(f"Invoiced {total}¢ win fees for user {user_id} as {fid}")
    return fid
