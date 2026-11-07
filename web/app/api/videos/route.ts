import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export const maxDuration = 30;

const YT = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const source_type = body.source_type as "youtube" | "upload";
  const source_url = String(body.source_url ?? "").trim();

  if (source_type === "youtube") {
    if (!YT.test(source_url)) return NextResponse.json({ error: "Enter a valid YouTube link" }, { status: 400 });
  } else if (source_type === "upload") {
    if (!source_url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!))
      return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const admin = adminClient();
  const profile = await getProfile(admin, user.id, user.email);
  const plan = getPlan(profile?.plan);

  if ((profile?.videos_used ?? 0) >= plan.videosPerMonth) {
    return NextResponse.json(
      { error: `You've used all ${plan.videosPerMonth} videos on the ${plan.name} plan this month. Upgrade for more.` },
      { status: 402 }
    );
  }

  const { data: video, error } = await admin
    .from("videos")
    .insert({ user_id: user.id, source_type, source_url, status: "queued", stage: "Queued" })
    .select("id")
    .single();
  if (error || !video) return NextResponse.json({ error: "Could not create video" }, { status: 500 });

  await admin.from("profiles").update({ videos_used: (profile?.videos_used ?? 0) + 1 }).eq("id", user.id);

  try {
    const r = await fetch(`${process.env.WORKER_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WORKER_SECRET}` },
      body: JSON.stringify({
        video_id: video.id,
        user_id: user.id,
        source_type,
        source_url,
        plan: plan.id,
        max_clips: plan.clipsPerVideo,
      }),
    });
    if (!r.ok) throw new Error(`Worker responded ${r.status}`);
  } catch (e: any) {
    await admin.from("videos").update({ status: "failed", error: "Processing server is unreachable. Try again." }).eq("id", video.id);
    await admin.from("profiles").update({ videos_used: profile?.videos_used ?? 0 }).eq("id", user.id);
    return NextResponse.json({ error: "Processing server is unreachable. Try again later." }, { status: 502 });
  }

  return NextResponse.json({ id: video.id });
}
