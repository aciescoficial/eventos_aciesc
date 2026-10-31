// PDF do ingresso (A4), anexado ao e-mail de inscrição confirmada.
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { eventWhen, money, shortDateTime } from "./templates.ts";

type Venue = { name: string; address: string; city: string } | null;

export type TicketPdfData = {
  qr: string;
  name: string;
  event_title: string;
  starts_at?: string;
  ends_at?: string;
  venue?: Venue;
  format?: string;
  ticket_code: string;
  ticket_type?: string;
  order_number?: string;
  buyer_email?: string;
  order_total?: number;
  purchased_at?: string;
  tickets_url?: string;
  cover_url?: string | null;
};

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const DARK = hex("#07211b");
const GREEN = hex("#155f4b");
const BRAND = hex("#1e7a5f");
const ACCENT = hex("#22e06c");
const INK = hex("#0e2a22");
const MUTED = hex("#51695f");
const LINE = hex("#dceee4");
const TINT = hex("#e3f6eb");
const WHITE = rgb(1, 1, 1);

// Helvetica padrão só cobre WinAnsi (latim): remove o que não for suportado.
const clean = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E\xA0-\xFF–—•]/g, "");

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of clean(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= max) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchImage(doc: PDFDocument, url?: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
    return null; // webp/svg não são suportados pelo pdf-lib
  } catch {
    return null;
  }
}

function drawQr(page: PDFPage, value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y, width: size, height: size, color: WHITE });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.data[r * n + c]) {
        page.drawRectangle({
          x: x + (c + quiet) * cell,
          y: y + size - (r + quiet + 1) * cell,
          width: cell + 0.2,
          height: cell + 0.2,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}

export async function ticketPdf(d: TicketPdfData, siteOrigin: string): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ingresso ${clean(d.event_title)}`);
  doc.setAuthor("ACIESC");
  const page = doc.addPage([595.28, 841.89]);
  const { width: W, height: H } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const M = 40;
  const CW = W - M * 2;

  const [logo, cover] = await Promise.all([fetchImage(doc, `${siteOrigin}/logo-aciesc.png`), fetchImage(doc, d.cover_url)]);

  // Cabeçalho
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: DARK });
  page.drawRectangle({ x: W * 0.55, y: H - 90, width: W * 0.45, height: 90, color: GREEN, opacity: 0.6 });
  if (logo) {
    const s = 44 / logo.height;
    page.drawImage(logo, { x: M, y: H - 67, width: logo.width * s, height: 44 });
  } else {
    page.drawText("ACIESC", { x: M, y: H - 55, size: 22, font: bold, color: WHITE });
  }
  const tag = "INGRESSO";
  page.drawText(tag, { x: W - M - bold.widthOfTextAtSize(tag, 16), y: H - 50, size: 16, font: bold, color: ACCENT });
  const sub = "Eventos ACIESC";
  page.drawText(sub, { x: W - M - reg.widthOfTextAtSize(sub, 10), y: H - 66, size: 10, font: reg, color: WHITE });

  let y = H - 90 - 24;

  // Capa do evento
  if (cover) {
    const h = Math.min(CW * (cover.height / cover.width), 170);
    const w = h * (cover.width / cover.height);
    page.drawImage(cover, { x: M + (CW - w) / 2, y: y - h, width: w, height: h });
    y -= h + 22;
  }

  // Título e dados do evento
  for (const line of wrap(String(d.event_title).toUpperCase(), bold, 18, CW)) {
    page.drawText(line, { x: M, y: y - 18, size: 18, font: bold, color: INK });
    y -= 24;
  }
  y -= 6;
  const info = (label: string, value: string) => {
    page.drawText(clean(label), { x: M, y: y - 10, size: 9, font: bold, color: BRAND });
    y -= 14;
    for (const line of wrap(value, reg, 12, CW)) {
      page.drawText(line, { x: M, y: y - 12, size: 12, font: reg, color: INK });
      y -= 16;
    }
    y -= 8;
  };
  info("DATA", eventWhen(d.starts_at, d.ends_at));
  info(
    "LOCAL",
    d.venue ? `${d.venue.name} — ${d.venue.address}, ${d.venue.city}` : d.format === "online" ? "Evento online (link em Meus ingressos)" : "A definir",
  );

  // Cartão do ingresso
  y -= 6;
  const boxH = 210;
  const boxY = y - boxH;
  page.drawRectangle({ x: M, y: boxY, width: CW, height: boxH, color: TINT, borderColor: LINE, borderWidth: 1 });
  page.drawRectangle({ x: M, y: boxY, width: 6, height: boxH, color: ACCENT });
  const qrSize = 175;
  drawQr(page, d.qr, M + CW - qrSize - 20, boxY + (boxH - qrSize) / 2, qrSize);

  const tx = M + 24;
  const tw = CW - qrSize - 64;
  let ty = y - 26;
  const field = (label: string, value: string, font: PDFFont = bold, size = 13) => {
    page.drawText(clean(label), { x: tx, y: ty, size: 9, font: bold, color: BRAND });
    ty -= 16;
    for (const line of wrap(value, font, size, tw).slice(0, 2)) {
      page.drawText(line, { x: tx, y: ty, size, font, color: INK });
      ty -= size + 4;
    }
    ty -= 8;
  };
  field("PARTICIPANTE", d.name, bold, 15);
  field("TIPO DE INGRESSO", d.ticket_type ?? "Ingresso", reg, 12);
  field("CÓDIGO DO INGRESSO", d.ticket_code, mono, 16);
  field("NÚMERO DO PEDIDO", d.order_number ?? "", reg, 12);
  y = boxY - 26;

  // Instruções
  page.drawText("Como usar", { x: M, y, size: 12, font: bold, color: INK });
  y -= 18;
  const tips = [
    "Apresente o QR Code na entrada do evento, no celular ou impresso.",
    "Se preferir, informe o código do ingresso na recepção.",
    `Seu ingresso também está disponível em Meus ingressos: ${d.tickets_url ?? `${siteOrigin}/meus-ingressos/`}`,
  ];
  for (const tip of tips) {
    const lines = wrap(tip, reg, 10, CW - 14);
    page.drawText("•", { x: M, y, size: 10, font: bold, color: BRAND });
    for (const line of lines) {
      page.drawText(line, { x: M + 14, y, size: 10, font: reg, color: INK });
      y -= 14;
    }
    y -= 2;
  }

  // Resumo do pedido
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 18;
  const summary = [
    ["Comprador", d.buyer_email ?? ""],
    ["Data da compra", shortDateTime(d.purchased_at)],
    ["Total do pedido", money(d.order_total)],
  ];
  const colW = CW / summary.length;
  summary.forEach(([label, value], i) => {
    page.drawText(clean(label), { x: M + colW * i, y, size: 8, font: bold, color: MUTED });
    page.drawText(wrap(value, reg, 10, colW - 8)[0] ?? "", { x: M + colW * i, y: y - 14, size: 10, font: reg, color: INK });
  });

  // Rodapé
  page.drawRectangle({ x: 0, y: 0, width: W, height: 44, color: DARK });
  const foot = "ACIESC — Associação de Corretores e Imobiliárias do Estado de Santa Catarina · aciesc.com.br";
  page.drawText(clean(foot), { x: (W - reg.widthOfTextAtSize(clean(foot), 8.5)) / 2, y: 18, size: 8.5, font: reg, color: WHITE });

  return await doc.saveAsBase64();
}
