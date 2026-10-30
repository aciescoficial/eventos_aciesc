import type { Metadata } from "next";
import { Suspense } from "react";
import { Callback } from "./callback";

export const metadata: Metadata = { title: "Entrando", robots: { index: false } };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <p role="status" className="text-muted">
        Entrando…
      </p>
      <Suspense>
        <Callback />
      </Suspense>
    </main>
  );
}
