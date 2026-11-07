"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewVideoForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let source_url = url.trim();
      if (tab === "upload") {
        if (!file) throw new Error("Choose a video file first");
        setStatus("Uploading…");
        const r = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Upload failed");
        const supabase = createClient();
        const { error: upErr } = await supabase.storage.from("clips").uploadToSignedUrl(j.path, j.token, file);
        if (upErr) throw new Error(upErr.message);
        source_url = j.publicUrl;
      }
      setStatus("Starting…");
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: tab, source_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start");
      router.push(`/videos/${data.id}/clips`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="tabs">
        <button type="button" className={`tab ${tab === "youtube" ? "on" : ""}`} onClick={() => setTab("youtube")}>YouTube link</button>
        <button type="button" className={`tab ${tab === "upload" ? "on" : ""}`} onClick={() => setTab("upload")}>Upload file</button>
      </div>
      <div className="row">
        {tab === "youtube" ? (
          <input className="field" style={{ flex: 1, minWidth: 240 }} placeholder="https://youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} required />
        ) : (
          <input className="field" style={{ flex: 1, minWidth: 240 }} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        )}
        <button className="btn primary" disabled={busy}>{busy ? status || "Working…" : "Generate clips"}</button>
      </div>
      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
    </form>
  );
}
