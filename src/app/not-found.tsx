import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { NotFoundRedirect } from "./not-found-redirect";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 text-center">
        <NotFoundRedirect />
        <h1 className="text-2xl font-extrabold">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço pode ter mudado ou o evento ainda está sendo publicado.</p>
        <Link href="/" className="btn-primary mt-6">Ver a agenda</Link>
      </main>
      <SiteFooter />
    </>
  );
}
