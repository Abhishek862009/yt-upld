"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg({ type: "err", text: error.message });
      else if (!data.session) setMsg({ type: "ok", text: "Check your email to confirm your account, then log in." });
      else router.push("/dashboard");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "err", text: error.message });
      else {
        router.push("/dashboard");
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 60 }}>
      <Link href="/" className="logo">Clip<span>Forge</span></Link>
      <h2 style={{ margin: "24px 0 6px" }}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>3 free videos every month, no card needed.</p>
      <form onSubmit={submit} className="grid">
        <input className="field" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" type="password" required minLength={6} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        {msg && <div className={msg.type === "err" ? "err" : "ok"}>{msg.text}</div>}
      </form>
      <p className="muted" style={{ fontSize: 14 }}>
        {mode === "login" ? "New here? " : "Already have an account? "}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} style={{ color: "var(--accent-2)" }}>
          {mode === "login" ? "Create an account" : "Log in"}
        </a>
      </p>
    </div>
  );
}
