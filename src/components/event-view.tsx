import { dateLong, time } from "@/lib/format";
import { FORMAT_LABEL, KIND_LABEL, type EventFull } from "@/lib/public-data";
import { ShareButton } from "./share-button";
import { TicketBox } from "./ticket-box";

// Página do evento — renderizável no build (SEO) e no navegador (/evento/?s=).
export function EventView({ e }: { e: EventFull }) {
  const dates = [...e.event_dates].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const first = dates[0];
  const mapsUrl =
    e.venues?.maps_url ??
    (e.venues ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venues.address}, ${e.venues.city}`)}` : null);
  const wazeUrl = e.venues ? `https://waze.com/ul?q=${encodeURIComponent(`${e.venues.address}, ${e.venues.city}`)}` : null;
  const speakers = [...(e.speakers ?? [])].sort((a, b) => a.sort - b.sort);

  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1fr_420px] md:py-12">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{KIND_LABEL[e.kind]}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{FORMAT_LABEL[e.format]}</span>
              {e.certificate_hours > 0 && (
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">
                  Certificado · {Number(e.certificate_hours)}h
                </span>
              )}
              {e.visibility === "associates" && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-green-800">Exclusivo associados</span>
              )}
              {e.visibility === "associates_adepts" && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-green-800">Associados e adeptos</span>
              )}
            </div>
            <h1 className="text-3xl font-black uppercase leading-tight sm:text-4xl">{e.title}</h1>
            {first && (
              <p className="text-white/90">
                <strong>{dateLong(first.starts_at)}</strong> · {time(first.starts_at)} às {time(first.ends_at)}
                {dates.length > 1 && ` · +${dates.length - 1} data(s)`}
              </p>
            )}
            {e.venues && e.format !== "online" && (
              <p className="text-white/90">
                {e.venues.name} — {e.venues.address}, {e.venues.city}
                {mapsUrl && (
                  <>
                    {" · "}
                    <a href={mapsUrl} target="_blank" rel="noopener" className="font-semibold text-accent underline">
                      Ver no mapa
                    </a>
                  </>
                )}
              </p>
            )}
            {e.status === "closed" && <p className="font-semibold text-accent">Evento encerrado</p>}
            <div className="mt-2">
              <ShareButton title={e.title} />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white/10">
            {e.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.cover_url} alt={`Arte do evento ${e.title}`} className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-aciesc.webp" alt="" width={209} height={77} className="h-20 w-auto opacity-90" />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1fr_420px]">
        <div className="order-2 flex flex-col gap-8 md:order-1">
          {e.summary && <p className="text-lg font-semibold">{e.summary}</p>}
          {e.description && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Sobre o evento</h2>
              <details className="group">
                <summary className="list-none">
                  <p className="line-clamp-6 whitespace-pre-line text-ink/90 group-open:line-clamp-none">{e.description}</p>
                  <span className="mt-2 inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand group-open:hidden">
                    Ver mais
                  </span>
                </summary>
              </details>
            </section>
          )}
          {speakers.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Palestrantes</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {speakers.map((s) => (
                  <li key={s.name} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                    {s.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.photo_url} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tint font-bold text-brand">
                        {s.name.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{s.name}</p>
                      {s.bio && <p className="text-sm text-muted">{s.bio}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {e.venues && e.format !== "online" && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Local</h2>
              <div className="rounded-2xl border border-line bg-white p-4">
                <p className="font-bold">{e.venues.name}</p>
                <p className="text-muted">{e.venues.address}, {e.venues.city}</p>
                {e.venues.parking_info && <p className="mt-2 text-sm">Estacionamento: {e.venues.parking_info}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
                      Google Maps
                    </a>
                  )}
                  {wazeUrl && (
                    <a href={wazeUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
                      Waze
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-xl font-extrabold">Formas de pagamento</h2>
            <p className="text-muted">
              Pix ou cartão de crédito. Sem taxa de serviço: o valor exibido é o valor pago. Inscrições gratuitas são confirmadas na hora.
            </p>
          </section>
        </div>
        <aside className="order-1 md:order-2">
          <div className="md:sticky md:top-4">
            <TicketBox eventId={e.id} eventTitle={e.title} />
          </div>
        </aside>
      </div>
    </>
  );
}
