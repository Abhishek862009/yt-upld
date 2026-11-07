import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.WORKER_SECRET}` || !process.env.WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const admin = adminClient();
  const { data: video } = await admin.from("videos").select("id,user_id,status").eq("id", body.video_id).maybeSingle();
  if (!video) return NextResponse.json({ error: "Unknown video" }, { status: 404 });

  const patch: Record<string, unknown> = { status: body.status };
  if (body.stage) patch.stage = body.stage;
  if (body.title) patch.title = body.title;
  if (body.duration_sec) patch.duration_sec = body.duration_sec;
  if (body.error) patch.error = body.error;
  await admin.from("videos").update(patch).eq("id", video.id);

  if (body.status === "done" && Array.isArray(body.clips)) {
    await admin.from("clips").delete().eq("video_id", video.id);
    const rows = body.clips.map((c: any) => ({
      video_id: video.id,
      user_id: video.user_id,
      start_sec: c.start,
      end_sec: c.end,
      title: c.title,
      hook: c.hook,
      reason: c.reason,
      score: c.score,
      transcript: c.transcript,
      video_url: c.video_url,
      thumbnail_url: c.thumbnail_url,
    }));
    if (rows.length) await admin.from("clips").insert(rows);
  }

  // Give the monthly credit back when a job fails.
  if (body.status === "failed" && video.status !== "failed") {
    const { data: p } = await admin.from("profiles").select("videos_used").eq("id", video.user_id).single();
    if (p && p.videos_used > 0) await admin.from("profiles").update({ videos_used: p.videos_used - 1 }).eq("id", video.user_id);
  }
  return NextResponse.json({ ok: true });
}
