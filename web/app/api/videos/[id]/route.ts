import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS limits both queries to the signed-in user's rows.
  const { data: video } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: clips } = await supabase.from("clips").select("*").eq("video_id", id).order("score", { ascending: false });
  return NextResponse.json({ video, clips: clips ?? [] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { adminClient } = await import("@/lib/supabase/admin");
  await adminClient().from("videos").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
