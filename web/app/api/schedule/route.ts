import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const { clip_id, platform, scheduled_at, caption } = await req.json();
  if (!["youtube", "instagram", "tiktok"].includes(platform))
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  const when = new Date(scheduled_at);
  if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000)
    return NextResponse.json({ error: "Pick a time in the future" }, { status: 400 });

  const admin = adminClient();
  const profile = await getProfile(admin, user.id, user.email);
  if (!getPlan(profile?.plan).scheduling)
    return NextResponse.json({ error: "Scheduling is a Pro feature. Upgrade to use it." }, { status: 402 });

  const { data: clip } = await admin.from("clips").select("id").eq("id", clip_id).eq("user_id", user.id).maybeSingle();
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const { error } = await admin.from("scheduled_posts").insert({
    clip_id,
    user_id: user.id,
    platform,
    caption: String(caption ?? "").slice(0, 2000),
    scheduled_at: when.toISOString(),
  });
  if (error) return NextResponse.json({ error: "Could not schedule" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
