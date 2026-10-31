// Modelos de e-mail (pt-BR, identidade ACIESC). Textos curtos e objetivos.

type Payload = Record<string, unknown> & {
  name?: string;
  event_title?: string;
  starts_at?: string;
  venue?: { name: string; address: string; city: string; maps_url?: string; parking_info?: string } | null;
  format?: string;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function formatDate(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function button(href: string, label: string) {
  return `<p style="margin:28px 0"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#3BE58A;color:#062A1C;font-weight:700;text-decoration:none">${esc(label)}</a></p>`;
}

function venueBlock(p: Payload) {
  if (!p.venue) return p.format === "online" ? "<p>Evento online — o link de acesso está em Meus ingressos.</p>" : "";
  const v = p.venue;
  return `<p><strong>Local:</strong> ${esc(v.name)} — ${esc(v.address)}, ${esc(v.city)}${
    v.maps_url ? ` · <a href="${esc(v.maps_url)}" style="color:#256958">Ver no mapa</a>` : ""
  }${v.parking_info ? `<br><strong>Estacionamento:</strong> ${esc(v.parking_info)}` : ""}</p>`;
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F6F8F7;font-family:Poppins,Arial,sans-serif;color:#14201C">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:linear-gradient(90deg,#0B2E25,#0F4434 55%,#13604A);background-color:#0F4434;padding:20px 28px;color:#fff;font-weight:800;font-size:18px">ACIESC <span style="color:#3BE58A;font-style:italic">Eventos</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="background:#0A1F1A;color:#ffffffb3;padding:16px 28px;font-size:12px">ACIESC — Associação de Corretores e Imobiliárias do Estado de Santa Catarina</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmail(template: string, p: Payload): { subject: string; html: string } {
  const hi = `<p>Olá, ${esc(p.name ?? "")}!</p>`;
  const when = `<p><strong>${esc(p.event_title)}</strong><br>${esc(formatDate(p.starts_at))}</p>`;
  switch (template) {
    case "ticket":
      return { subject: `Seu ingresso para o evento: ${p.event_title} - Pedido ${p.order_number ?? p.ticket_code}`, html: ticketEmail(p) };
    case "confirm_presence":
      return {
        subject: `Confirme sua presença: ${p.event_title}`,
        html: layout("Você vai comparecer?", `${hi}${when}
          <p>Confirme sua presença para manter sua vaga. Vagas não confirmadas podem ser liberadas para a lista de espera.</p>
          ${button(String(p.presence_url), "Confirmar presença")}`),
      };
    case "reminder":
      return {
        subject: `Começa em breve: ${p.event_title}`,
        html: layout("Seu evento começa em breve", `${hi}${when}${venueBlock(p)}
          ${button(String(p.tickets_url), "Abrir meu ingresso")}`),
      };
    case "released":
      return {
        subject: `Vaga liberada: ${p.event_title}`,
        html: layout("Sua vaga foi liberada", `${hi}${when}
          <p>Como a presença não foi confirmada a tempo, sua vaga foi oferecida à lista de espera.</p>`),
      };
    case "waitlist_offer":
      return {
        subject: `Abriu uma vaga: ${p.event_title}`,
        html: layout("Abriu uma vaga para você", `${hi}${when}
          <p>Você tem <strong>${esc(p.hours)} horas</strong> para garantir sua vaga.</p>
          ${button(String(p.accept_url), "Garantir minha vaga")}`),
      };
    case "certificate":
      return {
        subject: `Seu certificado: ${p.event_title}`,
        html: layout("Seu certificado está pronto", `${hi}<p>Obrigado por participar de <strong>${esc(p.event_title)}</strong>.</p>
          ${button(String(p.certificate_url), "Baixar certificado")}`),
      };
    case "invite_associate":
      return {
        subject: "Associe-se à ACIESC",
        html: layout("Faça parte da ACIESC", `${hi}<p>Associados têm acesso gratuito a cursos e condições especiais nos eventos da ACIESC.</p>
          ${button("https://aciesc.com.br", "Quero me associar")}`),
      };
    case "renewal_reminder":
      return {
        subject: "Renove sua anuidade ACIESC",
        html: layout("Sua anuidade está vencida", `${hi}<p>Renove sua anuidade para continuar com os benefícios de associado nos eventos da ACIESC.</p>
          ${button("https://aciesc.com.br", "Renovar anuidade")}`),
      };
    case "invite_adept":
      return {
        subject: "Seja Adepto ACIESC — é gratuito",
        html: layout("Seja Adepto ACIESC", `${hi}<p>Torne-se Adepto ACIESC gratuitamente na sua próxima inscrição e aproveite condições especiais.</p>
          ${button(String(p.site_url ?? "https://eventos.aciesc.com.br"), "Ver eventos")}`),
      };
    case "custom":
    default:
      return {
        subject: String(p.subject || p.event_title || "ACIESC Eventos"),
        html: layout(String(p.subject || p.event_title || "ACIESC Eventos"),
          `${hi}${p.event_title ? when : ""}<p style="white-space:pre-line">${esc(p.body)}</p>`),
      };
  }
}

// Variáveis simples para modelos aprovados de WhatsApp.
export function whatsappVariables(p: Payload): Record<string, string> {
  return {
    name: String(p.name ?? ""),
    event_title: String(p.event_title ?? ""),
    starts_at: formatDate(p.starts_at),
    link: String(p.presence_url ?? p.accept_url ?? p.certificate_url ?? p.tickets_url ?? ""),
  };
}

// ---------------------------------------------------------------------------
// E-mail de ingresso (pedido confirmado), com o PDF do ingresso em anexo.
// ---------------------------------------------------------------------------
const C = {
  dark: "#07211b",
  green: "#155f4b",
  brand: "#1e7a5f",
  accent: "#22e06c",
  onAccent: "#04231a",
  ink: "#0e2a22",
  muted: "#51695f",
  line: "#dceee4",
  bg: "#f2faf6",
  tint: "#e3f6eb",
  warnBg: "#fff4db",
  warnFg: "#6b4600",
};

const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão de crédito", free: "Ingresso gratuito" };

export function money(v: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

function hour(d: Date) {
  const s = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
  return s.replace(":", "h").replace(/h00$/, "h");
}

// "quinta-feira, 6 de agosto de 2026 · 18h30 às 21h"
export function eventWhen(starts?: unknown, ends?: unknown) {
  if (!starts) return "";
  const s = new Date(String(starts));
  const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(s);
  return `${day} · ${hour(s)}${ends ? ` às ${hour(new Date(String(ends)))}` : ""}`;
}

export function shortDateTime(iso?: unknown) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    .format(new Date(String(iso)));
}

function siteOrigin(p: Payload) {
  try {
    return new URL(String(p.tickets_url)).origin;
  } catch {
    return "https://eventos.aciesc.com.br";
  }
}

function calendarUrl(p: Payload) {
  if (!p.starts_at) return "";
  const z = (v: unknown) => new Date(String(v)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = p.ends_at ?? new Date(new Date(String(p.starts_at)).getTime() + 2 * 3600e3).toISOString();
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: String(p.event_title ?? ""),
    dates: `${z(p.starts_at)}/${z(end)}`,
    details: `Ingresso: ${p.ticket_code ?? ""}\n${p.tickets_url ?? ""}`,
    location: p.venue ? `${p.venue.name}, ${p.venue.address}, ${p.venue.city}` : "Online",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

function mapsUrl(p: Payload) {
  if (!p.venue) return "";
  return p.venue.maps_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.venue.name}, ${p.venue.address}, ${p.venue.city}`)}`;
}

function summaryRow(label: string, value: string) {
  return `<tr><td style="padding:0 0 14px">
<div style="font-size:12px;font-weight:700;color:${C.brand}">${esc(label)}</div>
<div style="font-size:15px;color:${C.ink}">${value}</div></td></tr>`;
}

function ticketEmail(p: Payload) {
  const site = siteOrigin(p);
  const first = String(p.name ?? "").trim().split(/\s+/)[0] || "Olá";
  const free = Number(p.order_total ?? p.unit_price ?? 0) === 0;
  const cal = calendarUrl(p);
  const map = mapsUrl(p);
  const place = p.venue
    ? `${esc(p.venue.name)}, ${esc(p.venue.city)}`
    : p.format === "online" ? "Evento online" : "A definir";
  const link = (href: string, label: string) =>
    href ? `<a href="${esc(href)}" style="color:${C.brand};font-size:13px;font-weight:700;text-decoration:none">${label}</a>` : "";
  const cover = p.cover_url
    ? `<tr><td><img src="${esc(p.cover_url)}" width="568" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:12px 12px 0 0"></td></tr>`
    : `<tr><td style="background:${C.dark};background-image:linear-gradient(100deg,#07211b,#0e362c 45%,#155f4b);padding:28px 24px;border-radius:12px 12px 0 0;color:#fff;font-size:20px;font-weight:800">${esc(p.event_title)}</td></tr>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.event_title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Poppins,'Segoe UI',Arial,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

<tr><td align="center" style="background:${C.dark};background-image:linear-gradient(100deg,#07211b,#0e362c 45%,#155f4b);border-radius:16px 16px 0 0;padding:22px">
<a href="https://aciesc.com.br"><img src="${site}/logo-aciesc.png" width="150" alt="ACIESC" style="display:block;border:0;width:150px;height:auto"></a>
</td></tr>

<tr><td style="background:${C.tint};padding:24px 16px;border-radius:0 0 16px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:14px;color:${C.ink}"><span style="display:inline-block;width:16px;height:16px;line-height:16px;border-radius:8px;background:${C.accent};color:${C.onAccent};text-align:center;font-size:11px;font-weight:800">&#10003;</span>&nbsp; Pedido confirmado</td></tr>
<tr><td style="padding:8px 0 0"><span style="display:inline-block;background:${C.brand};color:#fff;border-radius:999px;padding:4px 12px;font-size:12px">Número do pedido: <strong>${esc(p.order_number ?? p.ticket_code)}</strong></span></td></tr>
<tr><td align="center" style="padding:24px 8px 6px;font-size:24px;font-weight:800;line-height:1.25">${esc(first)}, seu ingresso está disponível!</td></tr>
<tr><td align="center" style="padding:0 8px;font-size:15px;line-height:1.5">O ingresso em PDF com o <strong>QR Code de entrada</strong> está anexado a este e-mail. Ele também fica em <strong>Meus ingressos</strong>, acessando com este e-mail.</td></tr>
<tr><td align="center" style="padding:22px 0 26px"><a href="${esc(p.tickets_url)}" style="display:inline-block;padding:14px 30px;border-radius:999px;background:${C.accent};color:${C.onAccent};font-weight:800;font-size:15px;text-decoration:none">Acessar meu ingresso</a></td></tr>

<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${C.line};border-radius:12px">
${cover}
<tr><td style="padding:20px 22px 6px;font-size:17px;font-weight:800;text-transform:uppercase">${esc(p.event_title)}</td></tr>
<tr><td style="padding:8px 22px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="50%" style="padding-right:8px"><div style="font-size:14px;font-weight:700">&#128197; Data</div>
<div style="font-size:14px;padding:4px 0">${esc(eventWhen(p.starts_at, p.ends_at))}</div>${link(cal, "Adicionar ao calendário")}</td>
<td valign="top" width="50%" style="padding-left:8px"><div style="font-size:14px;font-weight:700">&#128205; Local</div>
<div style="font-size:14px;padding:4px 0">${place}</div>${link(map, "Ver mapa")}</td>
</tr></table></td></tr>
</table></td></tr>

<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${C.line};border-radius:12px"><tr><td style="padding:18px 22px;font-size:13px;line-height:1.7">
<div style="font-size:14px;font-weight:800;padding-bottom:6px">&#9432; Como acesso meu ingresso?</div>
&bull; Abra o <strong>PDF anexo</strong> ou acesse <a href="${esc(p.tickets_url)}" style="color:${C.brand}">Meus ingressos</a> entrando com este e-mail.<br>
&bull; Na entrada, apresente o <strong>QR Code</strong> (no celular ou impresso).<br>
&bull; Código do ingresso: <strong style="font-family:monospace;letter-spacing:1px">${esc(p.ticket_code)}</strong>
</td></tr></table></td></tr>

${free ? `<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.warnBg};border:1px solid #f0c36d;border-radius:12px"><tr><td style="padding:16px 22px;font-size:13px;line-height:1.6;color:${C.warnFg}">
<div style="font-size:14px;font-weight:800;padding-bottom:4px">&#9888; Atenção</div>
Você garantiu <strong>um ingresso gratuito</strong>, ele deve ser 100% sem custo! Desconfie se alguém te pedir pagamento.
</td></tr></table></td></tr>` : ""}
</table>
</td></tr>

<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:22px">
<div style="font-size:20px;font-weight:800;padding-bottom:16px">Resumo do seu pedido</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${summaryRow("Quem comprou?", `<a href="mailto:${esc(p.buyer_email)}" style="color:${C.brand}">${esc(p.buyer_email)}</a>`)}
${summaryRow("Participante", esc(p.name))}
${summaryRow("Qual é o ingresso?", esc(p.ticket_type ?? "Ingresso"))}
${summaryRow("Quando comprei?", esc(shortDateTime(p.purchased_at)))}
${summaryRow("Forma de pagamento", esc(PAYMENT_LABEL[String(p.payment_method)] ?? ""))}
<tr><td style="font-size:16px;font-weight:800">Total ${esc(money(p.order_total))}</td></tr>
</table>
${p.order_url ? `<p style="margin:14px 0 0;font-size:13px"><a href="${esc(p.order_url)}" style="color:${C.brand}">Ver detalhes do pedido</a></p>` : ""}
</td></tr></table></td></tr>

<tr><td align="center" style="padding:24px 12px 8px;font-size:14px"><strong>Precisa de ajuda?</strong><br><span style="color:${C.muted}">Responda este e-mail que a equipe ACIESC te atende.</span></td></tr>
<tr><td align="center" style="padding:8px 12px 24px;font-size:12px;color:${C.muted};line-height:1.6">
© ${new Date().getFullYear()} ACIESC — Associação de Corretores e Imobiliárias do Estado de Santa Catarina<br>
Este é um e-mail automático. <a href="${site}/privacidade/" style="color:${C.brand}">Política de Privacidade</a> · <a href="https://aciesc.com.br" style="color:${C.brand}">aciesc.com.br</a>
</td></tr>

</table></td></tr></table></body></html>`;
}
