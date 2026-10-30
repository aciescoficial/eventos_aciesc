import Link from "next/link";
import { dateShort, time } from "@/lib/format";
import { FORMAT_LABEL, isUpcoming, nextDate, type EventCard } from "@/lib/public-data";

export function EventCardView({ e }: { e: EventCard }) {
  const d = nextDate(e);
  const upcoming = isUpcoming(e);
  return (
    <Link
      href={`/e/${e.slug}/`}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-3 focus-visible:outline-ink"
    >
      <div className="relative aspect-[16/9] bg-hero">
        {e.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.cover_url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center p-4 text-center text-lg font-black uppercase text-white">
            {e.title}
          </div>
        )}
        {e.kind === "free_course" && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-on-accent">
            Grátis p/ associados
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {d && (
          <p className="text-xs font-bold uppercase tracking-wide text-brand">
            {dateShort(d.starts_at)} · {time(d.starts_at)}
            {!upcoming && " · Encerrado"}
          </p>
        )}
        <h3 className="font-bold leading-snug group-hover:text-brand">{e.title}</h3>
        <p className="mt-auto pt-1 text-sm text-muted">
          {e.format === "online" ? "Online" : e.venues ? `${e.venues.name} · ${e.venues.city}` : FORMAT_LABEL[e.format]}
        </p>
      </div>
    </Link>
  );
}
