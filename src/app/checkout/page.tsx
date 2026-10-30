import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Inscrição", robots: { index: false } };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold">Finalizar inscrição</h1>
        <Suspense fallback={<Spinner />}>
          <CheckoutForm />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
