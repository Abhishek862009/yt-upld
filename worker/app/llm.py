"""Clip selection with a swappable, free LLM backend (Ollama / Groq / Gemini)."""
import json
import os
import re

import httpx

PROMPT = """You are an expert short-form video editor (TikTok, Reels, YouTube Shorts).
Below is a timestamped transcript of a long video. Pick the {n} best self-contained moments
to turn into vertical clips.

Rules:
- Each clip must be between {min_len} and {max_len} seconds long.
- Each clip must start at the beginning of a sentence and end at the end of a sentence.
- Prefer strong hooks, surprising claims, stories with a payoff, clear tips, emotional moments.
- Clips must not overlap.
- score is an integer 0-100 estimating viral potential.

Return ONLY a JSON array, no prose. Each item:
{{"start": <seconds>, "end": <seconds>, "title": "<catchy title, max 70 chars>",
  "hook": "<first line viewers see, max 100 chars>", "reason": "<one sentence why it works>", "score": <int>}}

TRANSCRIPT:
{transcript}
"""


def _extract_json(text: str):
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("LLM did not return a JSON array")
    return json.loads(text[start : end + 1])


def _call_ollama(prompt: str) -> str:
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
    r = httpx.post(
        f"{url}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.3}},
        timeout=600,
    )
    r.raise_for_status()
    return r.json()["response"]


def _call_groq(prompt: str) -> str:
    r = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
        json={
            "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _call_gemini(prompt: str) -> str:
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    r = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": os.environ["GEMINI_API_KEY"]},
        json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3}},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


PROVIDERS = {"ollama": _call_ollama, "groq": _call_groq, "gemini": _call_gemini}


def format_transcript(segments) -> str:
    return "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text'].strip()}" for s in segments)


def pick_clips(segments, duration: float, n: int, min_len: int = 20, max_len: int = 60):
    provider = os.environ.get("LLM_PROVIDER", "ollama")
    call = PROVIDERS[provider]
    transcript = format_transcript(segments)
    # Keep prompts bounded for small local models.
    if len(transcript) > 60000:
        transcript = transcript[:60000]
    prompt = PROMPT.format(n=n, min_len=min_len, max_len=max_len, transcript=transcript)

    last_err = None
    for _ in range(3):
        try:
            items = _extract_json(call(prompt))
            return _clean(items, duration, min_len, max_len)
        except Exception as e:  # retry on malformed output
            last_err = e
    raise RuntimeError(f"Clip selection failed: {last_err}")


def _clean(items, duration, min_len, max_len):
    out = []
    for it in items:
        try:
            s, e = float(it["start"]), float(it["end"])
        except (KeyError, TypeError, ValueError):
            continue
        s = max(0.0, s)
        e = min(duration, e)
        if e - s < min_len * 0.7:
            continue
        if e - s > max_len * 1.3:
            e = s + max_len
        if any(not (e <= o["start"] or s >= o["end"]) for o in out):
            continue
        out.append(
            {
                "start": s,
                "end": e,
                "title": str(it.get("title", "Untitled clip"))[:100],
                "hook": str(it.get("hook", ""))[:140],
                "reason": str(it.get("reason", ""))[:300],
                "score": max(0, min(100, int(it.get("score", 50)))),
            }
        )
    out.sort(key=lambda c: c["score"], reverse=True)
    if not out:
        raise ValueError("No usable clips returned")
    return out
