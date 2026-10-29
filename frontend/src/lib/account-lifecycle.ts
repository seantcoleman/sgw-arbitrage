import { createServiceClient } from "@/lib/supabase/admin";

/** Stop bidding and remove stored ShopGoodwill passwords for this user. */
export async function disconnectShopGoodwill(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error: jobsError } = await supabase
    .from("snipe_jobs")
    .update({
      status: "cancelled",
      lease_owner: null,
      lease_until: null,
      updated_at: now,
    })
    .eq("user_id", userId)
    .in("status", ["pending", "leased"]);
  if (jobsError) throw new Error(jobsError.message);

  const { error: watchError } = await supabase
    .from("watchlist")
    .update({ sniper_status: "cancelled" })
    .eq("user_id", userId)
    .eq("sniper_status", "scheduled");
  if (watchError) throw new Error(watchError.message);

  const { error: credsError } = await supabase
    .from("sgw_accounts")
    .delete()
    .eq("user_id", userId);
  if (credsError) throw new Error(credsError.message);
}
