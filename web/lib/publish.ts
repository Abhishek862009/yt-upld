/**
 * Platform publishers. Each takes a clip URL + caption and posts it.
 *
 * Posting needs per-user OAuth tokens and approved developer apps:
 *   - YouTube Shorts: Google Cloud OAuth + YouTube Data API (videos.insert)
 *   - Instagram Reels: Meta app review + Instagram Graph API
 *   - TikTok: TikTok Content Posting API (app audit required)
 * Until those are connected, every call fails with a clear message and the post is marked "failed".
 */
export interface PublishInput {
  userId: string;
  videoUrl: string;
  caption: string;
}

export async function publish(platform: string, _input: PublishInput): Promise<void> {
  throw new Error(`${platform} account is not connected yet`);
}
