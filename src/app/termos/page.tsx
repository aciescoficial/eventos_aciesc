import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";

export const metadata: Metadata = { title: "Termos de uso" };

// [DECISÃO PENDENTE] Texto jurídico a ser fornecido pela ACIESC. Ao publicar uma nova versão,
// atualize a configuração "terms_version" no painel.
export default function Page() {
  return (
    <PublicPage title="Termos de uso">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
        <p>Este documento está sendo elaborado pela ACIESC e será publicado aqui.</p>
        <p className="text-muted">
          Dúvidas sobre o uso dos seus dados ou pedidos de acesso, correção e exclusão: entre em contato pelo site{" "}
          <a href="https://aciesc.com.br" className="font-semibold text-brand underline">aciesc.com.br</a>.
        </p>
      </div>
    </PublicPage>
  );
}
