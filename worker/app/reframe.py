"""Face-aware 9:16 crop. Samples frames, finds the main face, returns a smooth crop x-offset."""
import cv2
import numpy as np


def detect_crop_x(video_path: str, start: float, end: float, src_w: int, src_h: int, samples: int = 8) -> int:
    """Return the x offset (in source pixels) of a 9:16 crop window."""
    crop_w = int(src_h * 9 / 16)
    crop_w -= crop_w % 2
    if crop_w >= src_w:
        return 0

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(video_path)
    centers = []
    try:
        for i in range(samples):
            t = start + (end - start) * (i + 0.5) / samples
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, frame = cap.read()
            if not ok:
                continue
            small_w = 480
            scale = small_w / frame.shape[1]
            small = cv2.resize(frame, (small_w, int(frame.shape[0] * scale)))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
            if len(faces):
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                centers.append((x + w / 2) / scale)
    finally:
        cap.release()

    center = float(np.median(centers)) if centers else src_w / 2
    x = int(center - crop_w / 2)
    x = max(0, min(src_w - crop_w, x))
    return x - (x % 2)
