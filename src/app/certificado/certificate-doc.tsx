"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QrCode } from "@/components/qr";
import { Alert, Button, ButtonLink, Spinner } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

type Doc = {
  code: string;
  person_name: string;
  event_title: string;
  event_date: string;
  hours: number;
  background_url: string | null;
  signer_name: string | null;
  signer_role: string | null;
  signature_url: string | null;
  validate_url: string;
};

// Certificado em A4 paisagem. "Baixar PDF" usa a impressão do navegador (Salvar como PDF).
export function CertificateDoc() {
  const code = useSearchParams().get("c") ?? "";
  const auth = useCurrentUser();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);

  useEffect(() => {
    if (auth.status === "anonymous") router.replace(`/entrar/?next=${encodeURIComponent(`/certificado/?c=${code}`)}`);
    if (auth.status !== "ready") return;
    getSupabase().rpc("certificate_document", { p_code: code }).then(({ data }) => setDoc((data as unknown as Doc) ?? null));
  }, [auth.status, code, router]);

  if (auth.status !== "ready" || doc === undefined) return <Spinner />;
  if (!doc)
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>Certificado não encontrado para esta conta.</Alert>
      </div>
    );

  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(doc.event_date));
  return (
    <div className="flex flex-col items-center gap-4 p-4 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 0 } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Baixar PDF / Imprimir</Button>
        <ButtonLink href="/meus-ingressos/" variant="secondary">Voltar</ButtonLink>
      </div>
      <div className="w-full max-w-[1123px] overflow-x-auto print:overflow-visible">
        <article
          className="relative mx-auto flex aspect-[297/210] w-[1123px] flex-col items-center justify-center bg-white bg-cover bg-center px-24 text-center shadow-lg print:w-[297mm] print:shadow-none"
          style={doc.background_url ? { backgroundImage: `url(${doc.background_url})` } : undefined}
        >
          {!doc.background_url && <div className="absolute inset-6 rounded-2xl border-4 border-brand" aria-hidden />}
          <p className="text-2xl font-extrabold text-brand">
            ACIESC <span className="italic">Eventos</span>
          </p>
          <h1 className="mt-6 text-5xl font-black uppercase tracking-wide text-green-800">Certificado</h1>
          <p className="mt-8 text-lg">Certificamos que</p>
          <p className="mt-2 text-4xl font-extrabold text-ink">{doc.person_name}</p>
          <p className="mt-6 max-w-3xl text-lg">
            participou de <strong>{doc.event_title}</strong>, realizado em {date}, com carga horária de{" "}
            <strong>{Number(doc.hours)} hora{Number(doc.hours) === 1 ? "" : "s"}</strong>.
          </p>
          <div className="mt-12 flex w-full items-end justify-between px-8">
            <div className="flex flex-col items-center text-left">
              <QrCode value={doc.validate_url} size={96} label="QR Code de validação" />
              <p className="mt-1 text-xs text-muted">Código {doc.code}</p>
            </div>
            <div className="flex flex-col items-center">
              {doc.signature_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.signature_url} alt="" className="h-16 object-contain" />
              )}
              <div className="mt-1 w-64 border-t border-ink pt-1 text-sm">
                {doc.signer_name || "ACIESC"}
                {doc.signer_role && <span className="block text-xs text-muted">{doc.signer_role}</span>}
              </div>
            </div>
            <p className="max-w-48 text-right text-xs text-muted">Valide em {doc.validate_url.replace(/^https?:\/\//, "")}</p>
          </div>
        </article>
      </div>
    </div>
  );
}
