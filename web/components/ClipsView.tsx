"use client";
import { useEffect, useState } from "react";

type Video = { id: string; title: string | null; status: string; stage: string | null; error: string | null; source_url: string };
type Clip = {
  id: string; title: string; hook: string | null; reason: string | null; score: number;
  start_sec: number; end_sec: number; video_url: string | null; thumbnail_url: string | null; transcript: string | null;
};

function scoreColor(s: number) {
  return s >= 80 ? "#35d07f" : s >= 60 ? "#ffb020" : "#ff5c6c";
}
function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClipsView({ initialVideo, initialClips, canSchedule }: { initialVideo: Video; initialClips: Clip[]; canSchedule: boolean }) {
  const [video, setVideo] = useState(initialVideo);
  const [clips, setClips] = useState(initialClips);
  const [sched, setSched] = useState<Clip | null>(null);

  useEffect(() => {
    if (video.status === "done" || video.status === "failed") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/videos/${video.id}`);
      if (!r.ok) return;
      const j = await r.json();
      setVideo(j.video);
      setClips(j.clips);
    }, 4000);
    return () => clearInterval(t);
  }, [video.id, video.status]);

  const working = video.status === "queued" || video.status === "processing";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ margin: "0 0 6px" }}>{video.title || "Processing your video…"}</h2>
        <span className={`badge ${video.status}`}>{video.status}</span>
      </div>

      {working && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600 }}>{video.stage || "Queued"}</div>
          <div className="progress"><div /></div>
          <div className="muted" style={{ fontSize: 13 }}>This takes a few minutes for long videos. You can leave this page; we'll keep working.</div>
        </div>
      )}
      {video.status === "failed" && <div className="card err">Something went wrong: {video.error || "unknown error"}</div>}

      <div className="clipgrid">
        {clips.map((c) => (
          <div className="clip" key={c.id}>
            {c.video_url && <video src={c.video_url} poster={c.thumbnail_url ?? undefined} controls preload="none" playsInline />}
            <div className="body">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <h4>{c.title}</h4>
                <span className="score">
                  <i data-v={c.score} style={{ ["--p" as any]: c.score, ["--c" as any]: scoreColor(c.score) }} />
                </span>
              </div>
              {c.hook && <div style={{ fontSize: 13 }}>“{c.hook}”</div>}
              {c.reason && <div className="muted" style={{ fontSize: 12 }}>{c.reason}</div>}
              <div className="muted" style={{ fontSize: 12 }}>{fmt(c.start_sec)} – {fmt(c.end_sec)}</div>
              <div className="row">
                {c.video_url && <a className="btn small" href={c.video_url} download target="_blank" rel="noreferrer">Download</a>}
                <button className="btn small" onClick={() => navigator.clipboard?.writeText(c.transcript || "")}>Copy text</button>
                <button className="btn small primary" onClick={() => setSched(c)}>Schedule</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sched && <ScheduleModal clip={sched} canSchedule={canSchedule} onClose={() => setSched(null)} />}
    </div>
  );
}

function ScheduleModal({ clip, canSchedule, onClose }: { clip: Clip; canSchedule: boolean; onClose: () => void }) {
  const [platform, setPlatform] = useState("youtube");
  const [when, setWhen] = useState("");
  const [caption, setCaption] = useState(clip.hook || clip.title);
  const [msg, setMsg] = useState<{ t: "err" | "ok"; s: string } | null>(null);

  async function go() {
    setMsg(null);
    const r = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clip_id: clip.id, platform, scheduled_at: new Date(when).toISOString(), caption }),
    });
    const j = await r.json();
    setMsg(r.ok ? { t: "ok", s: "Scheduled!" } : { t: "err", s: j.error || "Failed" });
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>Schedule post</h3>
        {!canSchedule && <div className="err">Scheduling is a Pro feature.</div>}
        <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="youtube">YouTube Shorts</option>
          <option value="instagram">Instagram Reels</option>
          <option value="tiktok">TikTok</option>
        </select>
        <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <textarea className="field" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        {msg && <div className={msg.t === "ok" ? "ok" : "err"}>{msg.s}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={go} disabled={!when}>Schedule</button>
        </div>
      </div>
    </div>
  );
}
