import { NextResponse } from "next/server";
import { disconnectShopGoodwill } from "@/lib/account-lifecycle";
import { getStripe } from "@/lib/stripe";
import { createServiceClient, userFromAuthHeader } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function cancelProSubscription(customerId: string, subscriptionId: string | null) {
  const stripe = getStripe();
  const ids = new Set<string>();
  if (subscriptionId) ids.add(subscriptionId);
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  for (const sub of listed.data) {
    if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
      ids.add(sub.id);
    }
  }
  for (const id of ids) {
    try {
      await stripe.subscriptions.cancel(id);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "resource_missing") continue;
      throw err;
    }
  }
}

export async function POST(req: Request) {
  try {
    const user = await userFromAuthHeader(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const typed = String(body.email || "").trim().toLowerCase();
    const actual = (user.email || "").trim().toLowerCase();
    if (!actual || typed !== actual) {
      return NextResponse.json(
        { error: "Type your account email to confirm deletion" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      await cancelProSubscription(profile.stripe_customer_id, profile.stripe_subscription_id);
    }

    await disconnectShopGoodwill(user.id);

    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("delete account error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete account" },
      { status: 500 }
    );
  }
}
