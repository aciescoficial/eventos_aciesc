// Gera um arquivo .ics (Adicionar à agenda).
export function downloadIcs(o: { title: string; start: string; end: string; location?: string; url?: string }) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACIESC//Eventos//PT-BR",
    "BEGIN:VEVENT",
    `UID:${fmt(o.start)}-${Math.random().toString(36).slice(2)}@eventos.aciesc.com.br`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(o.start)}`,
    `DTEND:${fmt(o.end)}`,
    `SUMMARY:${esc(o.title)}`,
    o.location ? `LOCATION:${esc(o.location)}` : "",
    o.url ? `URL:${o.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "evento-aciesc.ics";
  a.click();
}
