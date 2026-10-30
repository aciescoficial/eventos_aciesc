import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui";
import { LiveEvent } from "./live-event";

export const metadata: Metadata = { title: "Evento", robots: { index: false } };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<Spinner />}>
          <LiveEvent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
