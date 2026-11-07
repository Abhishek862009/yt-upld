import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClipForge: turn long videos into viral shorts",
  description: "Paste a YouTube link. Get captioned, vertical, ready-to-post clips scored for virality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
