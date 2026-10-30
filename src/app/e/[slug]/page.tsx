import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventView } from "@/components/event-view";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getAllEventSlugs, getEventBySlug } from "@/lib/public-data";

// Gerado no build para cada evento publicado. Eventos novos ficam em /evento/?s= até o próximo build.
export const dynamicParams = false;

// Placeholder garante que a rota exista mesmo sem eventos no build.
const PLACEHOLDER = "_";

export async function generateStaticParams() {
  const slugs = await getAllEventSlugs();
  return [...slugs, PLACEHOLDER].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) return { title: "Evento", robots: { index: false } };
  const description = e.summary ?? e.description?.slice(0, 160) ?? undefined;
  return {
    title: e.title,
    description,
    alternates: { canonical: `/e/${e.slug}/` },
    robots: e.visibility === "private" ? { index: false } : undefined,
    openGraph: {
      title: e.title,
      description,
      type: "website",
      url: `/e/${e.slug}/`,
      images: e.cover_url ? [{ url: e.cover_url }] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (slug === PLACEHOLDER) notFound();
  const e = await getEventBySlug(slug);
  if (!e) notFound();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const jsonLd = e.event_dates.map((d) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.summary ?? undefined,
    startDate: d.starts_at,
    endDate: d.ends_at,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      e.format === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : e.format === "hybrid"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    image: e.cover_url ? [e.cover_url] : undefined,
    url: `${site}/e/${e.slug}/`,
    location:
      e.format === "online" || !e.venues
        ? { "@type": "VirtualLocation", url: `${site}/e/${e.slug}/` }
        : {
            "@type": "Place",
            name: e.venues.name,
            address: { "@type": "PostalAddress", streetAddress: e.venues.address, addressLocality: e.venues.city, addressRegion: "SC", addressCountry: "BR" },
          },
    organizer: { "@type": "Organization", name: "ACIESC", url: "https://aciesc.com.br" },
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <EventView e={e} />
      </main>
      <SiteFooter />
    </>
  );
}
