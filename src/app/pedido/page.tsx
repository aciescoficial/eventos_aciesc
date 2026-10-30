import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui";
import { OrderView } from "./order-view";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Suspense fallback={<Spinner />}>
          <OrderView />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
