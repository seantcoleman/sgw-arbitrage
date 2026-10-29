import { NextResponse } from "next/server";
import { disconnectShopGoodwill } from "@/lib/account-lifecycle";
import { userFromAuthHeader } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await userFromAuthHeader(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await disconnectShopGoodwill(user.id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("disconnect sgw error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not disconnect ShopGoodwill" },
      { status: 500 }
    );
  }
}
