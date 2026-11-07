import Link from "next/link";
import Nav from "@/components/Nav";

const FEATURES = [
  ["AI clip finder", "A language model reads the transcript and picks the moments with the strongest hooks and payoffs."],
  ["Viral score", "Every clip gets a 0-100 score and a one-line reason, so you post the best ones first."],
  ["Word-by-word captions", "Animated, highlighted captions burned in, the style short-form viewers expect."],
  ["Auto 9:16 reframe", "Face-aware cropping keeps the speaker centered when we turn 16:9 into vertical."],
  ["YouTube link or upload", "Paste a link or drop in a file. Podcasts, interviews, webinars, tutorials."],
  ["Schedule & publish", "Queue clips for YouTube Shorts, Reels and TikTok (Pro)."],
];

export default function Home() {
  return (
    <>
      <Nav />
      <div className="wrap">
        <section className="hero">
          <h1>
            One long video. <em>A week of shorts.</em>
          </h1>
          <p>Paste a YouTube link and get captioned, vertical, ready-to-post clips, ranked by viral potential.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/login" className="btn primary">Start free</Link>
            <Link href="/pricing" className="btn">See pricing</Link>
          </div>
        </section>
        <section className="grid cols3">
          {FEATURES.map(([t, d]) => (
            <div className="card" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </section>
        <div className="footer">© {new Date().getFullYear()} ClipForge</div>
      </div>
    </>
  );
}
