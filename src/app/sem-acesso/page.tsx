import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Sem acesso", robots: { index: false } };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-2xl font-extrabold">Sem acesso ao painel</h1>
        <p className="mt-2 text-muted">
          Sua conta ainda não tem permissão para o painel. Fale com a administração da ACIESC.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Voltar ao início
        </Link>
      </main>
    </>
  );
}
