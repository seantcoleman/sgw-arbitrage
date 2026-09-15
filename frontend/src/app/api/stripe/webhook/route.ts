import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function userIdFromCustomer(customerId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: unknown) {
    console.error("webhook signature failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const userId =
          session.metadata?.supabase_user_id ||
          (customerId ? await userIdFromCustomer(customerId) : null);
        if (!userId) break;

        if (session.mode === "setup") {
          await supabase
            .from("profiles")
            .update({
              has_payment_method: true,
              billing_blocked: false,
              plan: "standard",
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          // Attach setup payment method as default for invoices
          if (session.setup_intent && customerId) {
            const siId =
              typeof session.setup_intent === "string"
                ? session.setup_intent
                : session.setup_intent.id;
            const si = await stripe.setupIntents.retrieve(siId);
            const pm =
              typeof si.payment_method === "string"
                ? si.payment_method
                : si.payment_method?.id;
            if (pm) {
              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: pm },
              });
            }
          }
        }

        if (session.mode === "subscription") {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          await supabase
            .from("profiles")
            .update({
              plan: "pro",
              has_payment_method: true,
              billing_blocked: false,
              stripe_subscription_id: subId || null,
              stripe_subscription_status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const userId =
          sub.metadata?.supabase_user_id ||
          (customerId ? await userIdFromCustomer(customerId) : null);
        if (!userId) break;

        const active = ["active", "trialing"].includes(sub.status);
        await supabase
          .from("profiles")
          .update({
            plan: active ? "pro" : "standard",
            stripe_subscription_id: sub.id,
            stripe_subscription_status: sub.status,
            // canceled/unpaid pro falls back to standard — still need a card
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.id;
        if (invoiceId) {
          await supabase
            .from("win_fees")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_invoice_id", invoiceId);
        }
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const userId = customerId ? await userIdFromCustomer(customerId) : null;
        if (userId) {
          await supabase
            .from("profiles")
            .update({
              billing_blocked: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const userId = customerId ? await userIdFromCustomer(customerId) : null;
        // Soft signal — block new snipes after failed payment (grace via Stripe retries first)
        if (userId && invoice.attempt_count && invoice.attempt_count >= 2) {
          await supabase
            .from("profiles")
            .update({
              billing_blocked: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "invoice.marked_uncollectible": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const userId = customerId ? await userIdFromCustomer(customerId) : null;
        if (userId) {
          await supabase
            .from("profiles")
            .update({
              billing_blocked: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
