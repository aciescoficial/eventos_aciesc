import type { MetadataRoute } from "next";
import { getPublishedEvents } from "@/lib/public-data";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const events = await getPublishedEvents();
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    ...events.map((e) => ({ url: `${site}/e/${e.slug}/`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${site}/validar/`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
