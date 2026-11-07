"""Word-by-word (karaoke style) captions as an ASS subtitle file."""


def _ts(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,78,&H00FFFFFF,&H0000E5FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def build_ass(words, clip_start: float, clip_end: float, group: int = 3) -> str:
    """words: list of {word, start, end} in source-video seconds.
    Shows `group` words at a time and highlights the one being spoken."""
    ws = [w for w in words if w["end"] > clip_start and w["start"] < clip_end]
    lines = [HEADER]
    for i in range(0, len(ws), group):
        chunk = ws[i : i + group]
        for j, active in enumerate(chunk):
            start = max(active["start"], clip_start) - clip_start
            end = (chunk[j + 1]["start"] if j + 1 < len(chunk) else active["end"])
            end = min(max(end, active["end"]), clip_end) - clip_start
            if end <= start:
                continue
            parts = []
            for k, w in enumerate(chunk):
                text = w["word"].strip().upper().replace("{", "").replace("}", "")
                if k == j:
                    parts.append(r"{\c&H00E5FF&\fscx115\fscy115}" + text + r"{\c&HFFFFFF&\fscx100\fscy100}")
                else:
                    parts.append(text)
            lines.append(f"Dialogue: 0,{_ts(start)},{_ts(end)},Default,,0,0,0,,{' '.join(parts)}\n")
    return "".join(lines)
