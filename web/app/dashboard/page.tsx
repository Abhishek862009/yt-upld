import Link from "next/link";
import Nav from "@/components/Nav";
import NewVideoForm from "@/components/NewVideoForm";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/usage";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getProfile(adminClient(), user!.id, user!.email);
  const plan = getPlan(profile?.plan);
  const { data: videos } = await supabase.from("videos").select("*").order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <Nav />
      <div className="wrap" style={{ display: "grid", gap: 20, paddingBottom: 60 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Your videos</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            {plan.name} plan · {profile?.videos_used ?? 0}/{plan.videosPerMonth} videos used this month
            {plan.id === "free" && <> · <Link href="/pricing" style={{ color: "var(--accent-2)" }}>Upgrade</Link></>}
          </div>
        </div>
        <NewVideoForm />
        <div className="list">
          {(videos ?? []).length === 0 && <div className="muted">No videos yet. Paste a link above to make your first clips.</div>}
          {(videos ?? []).map((v: any) => (
            <Link key={v.id} href={`/videos/${v.id}/clips`} className="item">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || v.source_url}</div>
                <div className="muted" style={{ fontSize: 13 }}>{new Date(v.created_at).toLocaleString()}</div>
              </div>
              <span className={`badge ${v.status}`}>{v.status === "processing" ? v.stage || "processing" : v.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
