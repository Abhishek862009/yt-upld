import type { SupabaseClient } from "@supabase/supabase-js";
import { isPremiumEmail } from "@/lib/premium";

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Fetch the profile (creating it if missing), reset the monthly counter in a new month,
 *  and auto-upgrade verified emails from lib/premium.ts. */
export async function getProfile(admin: SupabaseClient, userId: string, email?: string | null) {
  let { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) {
    const { data } = await admin
      .from("profiles")
      .insert({ id: userId, email: email ?? null })
      .select("*")
      .single();
    profile = data;
  }
  if (profile && new Date(profile.period_start) < monthStart()) {
    const { data } = await admin
      .from("profiles")
      .update({ videos_used: 0, period_start: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();
    profile = data ?? profile;
  }

  // Premium email allow-list (only for verified emails).
  if (profile && profile.plan === "free" && isPremiumEmail(email ?? profile.email)) {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    if (u?.user?.email_confirmed_at) {
      const { data } = await admin.from("profiles").update({ plan: "business" }).eq("id", userId).select("*").single();
      profile = data ?? { ...profile, plan: "business" };
    }
  }
  return profile;
}
