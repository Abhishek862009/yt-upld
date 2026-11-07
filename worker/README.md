---
title: ClipForge Worker
emoji: 🎬
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# ClipForge worker

FastAPI service that does the heavy lifting: yt-dlp download, faster-whisper transcription,
LLM clip selection, FFmpeg 9:16 render with word-by-word captions, upload to Supabase Storage.

This folder is the root of the Hugging Face Space (the block above is the Space config).
Set the variables from `.env.example` as Space **Secrets**. Optional: `YTDLP_COOKIES` (cookies.txt contents)
if YouTube blocks downloads from the server.
