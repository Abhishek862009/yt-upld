import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import ClipsView from "@/components/ClipsView";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ClipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: video } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
  if (!video) notFound();
  const { data: clips } = await supabase.from("clips").select("*").eq("video_id", id).order("score", { ascending: false });
  const profile = await getProfile(adminClient(), user!.id, user!.email);

  return (
    <>
      <Nav />
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <Link href="/dashboard" className="muted" style={{ fontSize: 14 }}>← All videos</Link>
        <div style={{ height: 12 }} />
        <ClipsView initialVideo={video} initialClips={clips ?? []} canSchedule={getPlan(profile?.plan).scheduling} />
      </div>
    </>
  );
}
