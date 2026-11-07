import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

// Returns a signed upload URL so the browser uploads straight to Supabase Storage
// (Vercel functions can't accept large request bodies).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  const { filename } = await req.json();
  const ext = String(filename ?? "video.mp4").split(".").pop()?.toLowerCase() ?? "mp4";
  if (!["mp4", "mov", "mkv", "webm", "m4v"].includes(ext))
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const path = `uploads/${user.id}/${Date.now()}.${ext}`;
  const admin = adminClient();
  const { data, error } = await admin.storage.from("clips").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });

  const { data: pub } = admin.storage.from("clips").getPublicUrl(path);
  return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl });
}
