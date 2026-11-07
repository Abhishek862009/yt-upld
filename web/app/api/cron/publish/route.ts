import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { publish } from "@/lib/publish";

export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = adminClient();
  const { data: due } = await admin
    .from("scheduled_posts")
    .select("id,user_id,platform,caption,clips(video_url)")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(25);

  let posted = 0;
  let failed = 0;
  for (const post of (due ?? []) as any[]) {
    try {
      await publish(post.platform, { userId: post.user_id, videoUrl: post.clips?.video_url, caption: post.caption ?? "" });
      await admin.from("scheduled_posts").update({ status: "posted" }).eq("id", post.id);
      posted++;
    } catch (e: any) {
      await admin.from("scheduled_posts").update({ status: "failed", error: String(e.message).slice(0, 300) }).eq("id", post.id);
      failed++;
    }
  }
  return NextResponse.json({ posted, failed });
}
