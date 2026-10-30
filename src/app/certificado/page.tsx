import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { CertificateDoc } from "./certificate-doc";

export const metadata: Metadata = { title: "Certificado", robots: { index: false } };

export default function Page() {
  return (
    <main className="flex-1 bg-bg print:bg-white">
      <Suspense fallback={<Spinner />}>
        <CertificateDoc />
      </Suspense>
    </main>
  );
}
