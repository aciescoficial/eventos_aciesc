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
      return {
        subject: `Seu ingresso: ${p.event_title}`,
        html: layout("Inscrição confirmada", `${hi}<p>Sua inscrição está confirmada.</p>${when}${venueBlock(p)}
          <p>Código do ingresso: <strong>${esc(p.ticket_code)}</strong></p>
          ${button(String(p.tickets_url), "Ver meu ingresso (QR Code)")}`),
      };
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
