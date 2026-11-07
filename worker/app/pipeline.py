"""Full job pipeline: download -> transcribe -> pick clips -> render -> upload -> callback."""
import json
import os
import shutil
import subprocess
import tempfile
import traceback
from pathlib import Path

import httpx
from faster_whisper import WhisperModel

from . import captions, llm, reframe

_model = None


def whisper() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(
            os.environ.get("WHISPER_MODEL", "base"),
            device=os.environ.get("WHISPER_DEVICE", "cpu"),
            compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
        )
    return _model


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {p.stderr[-800:]}")
    return p.stdout


def probe(path: str) -> dict:
    out = run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height:format=duration", "-of", "json", path]
    )
    j = json.loads(out)
    return {"w": j["streams"][0]["width"], "h": j["streams"][0]["height"], "duration": float(j["format"]["duration"])}


def download(source_type: str, url: str, dest: Path) -> tuple[str, str]:
    """Return (video_path, title)."""
    if source_type == "upload":
        out = dest / "source.mp4"
        with httpx.stream("GET", url, follow_redirects=True, timeout=600) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
        return str(out), Path(url.split("?")[0]).stem

    template = str(dest / "source.%(ext)s")
    # YouTube often blocks datacenter IPs. Optional fix: put your exported cookies.txt
    # (Netscape format) into the YTDLP_COOKIES env var.
    extra: list[str] = []
    cookies = os.environ.get("YTDLP_COOKIES")
    if cookies:
        cookie_file = dest / "cookies.txt"
        cookie_file.write_text(cookies, encoding="utf-8")
        extra = ["--cookies", str(cookie_file)]
    run(
        ["yt-dlp", *extra, "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4",
         "--no-playlist", "-o", template, url]
    )
    title = run(["yt-dlp", *extra, "--no-playlist", "--print", "title", url]).strip().splitlines()[0]
    return str(dest / "source.mp4"), title


def transcribe(video_path: str, work: Path):
    audio = work / "audio.wav"
    run(["ffmpeg", "-y", "-i", video_path, "-vn", "-ac", "1", "-ar", "16000", str(audio)])
    segments_iter, _info = whisper().transcribe(str(audio), word_timestamps=True, vad_filter=True)
    segments, words = [], []
    for seg in segments_iter:
        segments.append({"start": seg.start, "end": seg.end, "text": seg.text})
        for w in seg.words or []:
            words.append({"word": w.word, "start": w.start, "end": w.end})
    return segments, words


def render_clip(src: str, info: dict, clip: dict, words, out_path: Path, plan: str, work: Path):
    start, end = clip["start"], clip["end"]
    x = reframe.detect_crop_x(src, start, end, info["w"], info["h"])
    crop_w = int(info["h"] * 9 / 16)
    crop_w -= crop_w % 2

    ass_path = work / f"{out_path.stem}.ass"
    ass_path.write_text(captions.build_ass(words, start, end), encoding="utf-8")

    # Free plan: 720p. Paid plans: 1080p.
    out_w, out_h = (1080, 1920) if plan != "free" else (720, 1280)
    vf = f"crop={crop_w}:{info['h']}:{x}:0,scale={out_w}:{out_h},subtitles='{ass_path}'"
    if plan == "free":
        vf += ",drawtext=text='ClipForge':fontcolor=white@0.6:fontsize=36:x=w-tw-30:y=60"
    run(
        ["ffmpeg", "-y", "-ss", f"{start:.2f}", "-to", f"{end:.2f}", "-i", src,
         "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out_path)]
    )
    thumb = out_path.with_suffix(".jpg")
    mid = (end - start) / 2
    run(["ffmpeg", "-y", "-ss", f"{mid:.2f}", "-i", str(out_path), "-frames:v", "1", "-q:v", "3", str(thumb)])
    return thumb


def upload(path: Path, key: str, content_type: str) -> str:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    bucket = os.environ.get("SUPABASE_BUCKET", "clips")
    key_hdr = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    with open(path, "rb") as f:
        r = httpx.post(
            f"{base}/storage/v1/object/{bucket}/{key}",
            headers={"Authorization": f"Bearer {key_hdr}", "apikey": key_hdr,
                     "Content-Type": content_type, "x-upsert": "true"},
            content=f.read(),
            timeout=600,
        )
    r.raise_for_status()
    return f"{base}/storage/v1/object/public/{bucket}/{key}"


def callback(payload: dict):
    httpx.post(
        os.environ["WEB_CALLBACK_URL"],
        headers={"Authorization": f"Bearer {os.environ['WORKER_SECRET']}"},
        json=payload,
        timeout=60,
    )


def process(job: dict):
    video_id = job["video_id"]
    user_id = job["user_id"]
    plan = job.get("plan", "free")
    n_clips = int(job.get("max_clips", 5))
    work = Path(tempfile.mkdtemp(prefix=f"job-{video_id}-"))
    try:
        callback({"video_id": video_id, "status": "processing", "stage": "Downloading video"})
        src, title = download(job["source_type"], job["source_url"], work)
        info = probe(src)
        max_min = int(os.environ.get("MAX_VIDEO_MINUTES", "60"))
        if info["duration"] > max_min * 60:
            raise RuntimeError(f"Video is longer than {max_min} minutes")

        callback({"video_id": video_id, "status": "processing", "stage": "Transcribing", "title": title,
                  "duration_sec": int(info["duration"])})
        segments, words = transcribe(src, work)
        if not segments:
            raise RuntimeError("No speech detected in this video")

        callback({"video_id": video_id, "status": "processing", "stage": "Finding the best moments"})
        picks = llm.pick_clips(segments, info["duration"], n_clips)[:n_clips]

        clips_out = []
        for i, c in enumerate(picks, 1):
            callback({"video_id": video_id, "status": "processing", "stage": f"Rendering clip {i}/{len(picks)}"})
            out = work / f"clip{i}.mp4"
            thumb = render_clip(src, info, c, words, out, plan, work)
            key = f"{user_id}/{video_id}/clip{i}"
            c["video_url"] = upload(out, f"{key}.mp4", "video/mp4")
            c["thumbnail_url"] = upload(thumb, f"{key}.jpg", "image/jpeg")
            c["transcript"] = " ".join(
                w["word"].strip() for w in words if w["start"] >= c["start"] and w["end"] <= c["end"]
            )
            clips_out.append(c)

        callback({"video_id": video_id, "status": "done", "stage": "Done", "title": title, "clips": clips_out})
    except Exception as e:
        traceback.print_exc()
        callback({"video_id": video_id, "status": "failed", "error": str(e)[:500]})
    finally:
        shutil.rmtree(work, ignore_errors=True)
