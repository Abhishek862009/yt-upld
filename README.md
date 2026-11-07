# ClipForge

Long video → scored, captioned, vertical short clips. Two deployable pieces:

| Piece | Folder | Runs on | Why |
|---|---|---|---|
| Web app (UI, auth, API, plans) | `web/` | **Vercel** | Next.js 15 |
| Worker (download, Whisper, LLM, FFmpeg) | `worker/` | **Hugging Face Space (Docker, free)** | Vercel can't run FFmpeg/Whisper or long jobs |
| Database + file storage + login | `supabase/` | **Supabase (free)** | Postgres, Auth, Storage |

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Storage → New bucket → name `clips` → **Public**.
4. Authentication → Providers → Email. (Turn off "Confirm email" while testing if you want instant login.)
5. Project Settings → API: copy the URL, `anon` key and `service_role` key.

## 2. Push to GitHub
```bash
cd clipforge
git init && git add . && git commit -m "ClipForge"
git branch -M main
git remote add origin https://github.com/<you>/clipforge.git
git push -u origin main
```

## 3. Worker on Hugging Face Spaces
1. huggingface.co → New Space → SDK **Docker** → blank.
2. Upload the **contents of `worker/`** as the Space repo root (Dockerfile at top level).
3. Space → Settings → Secrets, add everything from `worker/.env.example`:
   - `WORKER_SECRET` (a long random string, reuse it in Vercel)
   - `WEB_CALLBACK_URL` = `https://<your-vercel-app>.vercel.app/api/worker/callback`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=clips`
   - LLM: HF Spaces can't run Ollama, so use a free API: `LLM_PROVIDER=groq` + `GROQ_API_KEY` (or `gemini` + `GEMINI_API_KEY`).
     Whisper transcription itself runs locally on the Space CPU, no API.
4. Your worker URL is `https://<user>-<space>.hf.space`.

## 4. Web on Vercel
1. vercel.com → Add New → Project → import the GitHub repo.
2. **Root Directory: `web`**.
3. Environment variables (see `web/.env.example`): the three Supabase values, `WORKER_URL`, `WORKER_SECRET`,
   `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
4. Deploy. Then put the Vercel URL into the worker's `WEB_CALLBACK_URL`.

## Switching a user to a paid plan
Payments aren't wired yet. Until they are, upgrade manually in Supabase SQL Editor:
```sql
update public.profiles set plan = 'pro' where email = 'user@example.com';
```

## Known limits / honest notes
- **YouTube blocking:** YouTube often blocks downloads from cloud IPs. If links fail, set `YTDLP_COOKIES` on the worker, or use the file-upload tab.
- **Upload size:** Supabase free plan caps files at 50 MB.
- **Auto-posting:** scheduling UI + hourly cron are built, but actual posting to YouTube/Instagram/TikTok needs your approved developer apps and per-user OAuth. `web/lib/publish.ts` is the single place to plug that in; until then scheduled posts are marked `failed: not connected`.
- **Speed:** CPU Whisper (`base`) on the free Space is slow for long videos; a 1-hour video can take many minutes. Jobs run one at a time.
- Vercel Hobby cron runs at most once a day; change `web/vercel.json` to `0 9 * * *` if the deploy complains.
