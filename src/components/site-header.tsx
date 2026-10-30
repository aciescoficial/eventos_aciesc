import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-hero text-white">
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-3" aria-label="ACIESC Eventos — início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-aciesc.webp" alt="ACIESC" width={209} height={77} className="h-10 w-auto" />
          <span className="border-l border-white/25 pl-3 text-sm font-semibold uppercase tracking-widest text-accent">Eventos</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center text-sm font-semibold">
          <Link href="/#agenda" className="hidden min-h-11 items-center rounded-full px-3 hover:bg-white/10 sm:inline-flex">
            Agenda
          </Link>
          <Link href="/meus-ingressos/" className="inline-flex min-h-11 items-center rounded-full px-3 hover:bg-white/10">
            Meus ingressos
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-green-900 text-white/80">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-aciesc.webp" alt="ACIESC" width={209} height={77} className="h-11 w-auto" loading="lazy" />
          <p className="mt-2">Associação de Corretores e Imobiliárias do Estado de Santa Catarina · Itapema/SC</p>
        </div>
        <nav aria-label="Links úteis" className="flex flex-col gap-2">
          <Link href="/meus-ingressos/" className="hover:text-white">Meus ingressos</Link>
          <Link href="/validar/" className="hover:text-white">Validar certificado</Link>
          <a href="https://aciesc.com.br" className="hover:text-white">aciesc.com.br</a>
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-2">
          <Link href="/termos/" className="hover:text-white">Termos de uso</Link>
          <Link href="/privacidade/" className="hover:text-white">Política de privacidade</Link>
          <Link href="/entrar/?next=/admin/" className="hover:text-white">Área do organizador</Link>
        </nav>
      </div>
    </footer>
  );
}
