import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-2xl font-extrabold">Entrar</h1>
        <p className="mt-2 text-muted">
          Informe seu e-mail e enviaremos um link de acesso. Não precisa de senha.
        </p>
        <div className="mt-6">
          {/* useSearchParams num site estático precisa de Suspense */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
