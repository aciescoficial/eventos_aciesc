import { Suspense, type ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-header";
import { Spinner } from "./ui";

export function PublicPage({ title, children, wide }: { title?: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        {title && <h1 className="mb-6 text-2xl font-extrabold">{title}</h1>}
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
