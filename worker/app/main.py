import os
import threading
from queue import Queue

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import pipeline

app = FastAPI(title="ClipForge worker")

# One job at a time: CPU Whisper + FFmpeg are heavy on small free hosts.
jobs: Queue = Queue()


def _loop():
    while True:
        job = jobs.get()
        try:
            pipeline.process(job)
        finally:
            jobs.task_done()


threading.Thread(target=_loop, daemon=True).start()


class Job(BaseModel):
    video_id: str
    user_id: str
    source_type: str  # "youtube" | "upload"
    source_url: str
    plan: str = "free"
    max_clips: int = 5


@app.get("/")
def health():
    return {"ok": True, "queued": jobs.qsize()}


@app.post("/jobs")
def create_job(job: Job, authorization: str = Header(default="")):
    if authorization != f"Bearer {os.environ.get('WORKER_SECRET', '')}" or not os.environ.get("WORKER_SECRET"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    jobs.put(job.model_dump())
    return {"queued": True, "position": jobs.qsize()}
