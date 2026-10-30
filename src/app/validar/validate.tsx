"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, TextInput } from "@/components/ui";
import { errorMessage } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Cert = { code: string; person_name: string; event_title: string; event_date: string; hours: number; revoked: boolean };

export function Validate() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState(params.get("c") ?? "");
  const [cert, setCert] = useState<Cert | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("c");
    if (!c) return;
    getSupabase()
      .rpc("validate_certificate", { p_code: c })
      .then(({ data, error }) => (error ? setError(errorMessage(error)) : setCert((data as unknown as Cert) ?? null)));
  }, [params]);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/validar/?c=${encodeURIComponent(code.trim().toUpperCase())}`);
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1">
          <TextInput label="Código do certificado" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </div>
        <Button type="submit">Validar</Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {cert === null && <Alert>Certificado não encontrado.</Alert>}
      {cert && (
        <Card className={cert.revoked ? "border-error-fg" : "border-brand"}>
          <p className={`font-bold ${cert.revoked ? "text-error-fg" : "text-brand"}`}>
            {cert.revoked ? "Certificado revogado" : "Certificado válido"}
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Participante</dt><dd className="font-semibold">{cert.person_name}</dd></div>
            <div><dt className="text-muted">Evento</dt><dd className="font-semibold">{cert.event_title}</dd></div>
            <div>
              <dt className="text-muted">Data</dt>
              <dd className="font-semibold">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(cert.event_date))}</dd>
            </div>
            <div><dt className="text-muted">Carga horária</dt><dd className="font-semibold">{Number(cert.hours)}h</dd></div>
          </dl>
        </Card>
      )}
    </div>
  );
}
