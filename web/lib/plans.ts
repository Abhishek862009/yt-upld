export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number;
  videosPerMonth: number;
  clipsPerVideo: number;
  resolution: string;
  watermark: boolean;
  scheduling: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceInr: 0,
    videosPerMonth: 3,
    clipsPerVideo: 3,
    resolution: "720p",
    watermark: true,
    scheduling: false,
    features: ["3 videos / month", "Up to 3 clips per video", "720p export", "Watermark", "Auto captions"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInr: 999,
    videosPerMonth: 30,
    clipsPerVideo: 10,
    resolution: "1080p",
    watermark: false,
    scheduling: true,
    features: ["30 videos / month", "Up to 10 clips per video", "1080p export", "No watermark", "Scheduling & auto-post"],
  },
  business: {
    id: "business",
    name: "Business",
    priceInr: 2999,
    videosPerMonth: 150,
    clipsPerVideo: 15,
    resolution: "1080p",
    watermark: false,
    scheduling: true,
    features: ["150 videos / month", "Up to 15 clips per video", "1080p export", "No watermark", "Scheduling & auto-post", "Priority queue"],
  },
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}
