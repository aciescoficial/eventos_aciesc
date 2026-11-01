"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hasAnyRole, useCurrentUser, type AppRole, type CurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { Spinner, cx } from "./ui";

// Menu lateral conforme o protótipo aprovado ("A · Início — meus eventos").
const NAV: { href: string; label: string; roles: AppRole[]; icon: ReactNode; match?: (path: string) => boolean }[] = [
  {
    href: "/admin/",
    label: "Início",
    roles: ["organizer", "finance"],
    match: (p) => p === "/admin/" || p.startsWith("/admin/evento") || p.startsWith("/admin/participantes"),
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    href: "/admin/dados/",
    label: "Dados",
    roles: ["organizer", "finance"],
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 16v-4M12 16V8M16 16v-6" />
      </>
    ),
  },
  {
    href: "/admin/base/",
    label: "Base ACIESC",
    roles: ["organizer", "finance"],
    match: (p) => p.startsWith("/admin/base") || p.startsWith("/admin/pessoa"),
    icon: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  },
  {
    href: "/admin/dados/#certificados",
    label: "Certificados",
    roles: ["organizer", "finance"],
    match: () => false,
    icon: (
      <>
        <circle cx="12" cy="9" r="6" />
        <path d="M8.5 14L7 22l5-3 5 3-1.5-8" />
      </>
    ),
  },
  {
    href: "/admin/dados/#financeiro",
    label: "Financeiro",
    roles: ["organizer", "finance"],
    match: () => false,
    icon: (
      <>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
  },
  {
    href: "/admin/configuracoes/",
    label: "Equipe e permissões",
    roles: ["admin"],
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2" />
      </>
    ),
  },
];

function initials(email: string | null) {
  const name = (email ?? "").split("@")[0].replace(/[^a-zA-Z]+/g, " ").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

function canSee(user: CurrentUser, roles: AppRole[]) {
  if (roles.includes("door")) return user.roles.length > 0 && (hasAnyRole(user, roles) || user.roles.some((r) => r.role === "door"));
  return hasAnyRole(user, roles);
}

// Moldura do painel: exige login e papel. A autorização real dos dados é feita pelo RLS.
export function AdminPage({
  title,
  roles = ["organizer", "finance"],
  actions,
  children,
}: {
  title?: ReactNode;
  roles?: AppRole[];
  actions?: ReactNode;
  children: (user: CurrentUser) => ReactNode;
}) {
  const auth = useCurrentUser();
  const router = useRouter();
  const path = usePathname();
  const allowed = auth.status === "ready" && canSee(auth.user, roles);

  useEffect(() => {
    if (auth.status === "anonymous") router.replace(`/entrar/?next=${encodeURIComponent(path)}`);
    else if (auth.status === "ready" && !allowed) {
      router.replace(auth.user.roles.some((r) => r.role === "door") ? "/admin/portaria/" : "/sem-acesso/");
    }
  }, [auth, allowed, router, path]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-panel text-ink-2">
      <header className="bg-org-header text-white print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin/" aria-label="ACIESC — início do organizador">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-aciesc.webp" alt="ACIESC" width={209} height={77} className="block h-11 w-auto" />
            </Link>
            <span aria-hidden className="h-[30px] w-px bg-white/25" />
            <span className="text-[13px] font-bold uppercase tracking-[.08em] text-lime">Área do organizador</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/" className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-white hover:underline">
              Ver vitrine pública
            </Link>
            {auth.status === "ready" && (
              <>
                <span
                  aria-hidden
                  title={auth.user.email ?? undefined}
                  className="flex size-10 items-center justify-center rounded-full bg-lime text-sm font-bold text-lime-ink"
                >
                  {initials(auth.user.email)}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-white/80 hover:text-white"
                  onClick={() => getSupabase().auth.signOut().then(() => router.replace("/"))}
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        {auth.status === "ready" && (
          <nav
            aria-label="Menu do organizador"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-rule bg-white px-3.5 py-3 md:w-[230px] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:py-5 print:hidden"
          >
            {NAV.filter((n) => canSee(auth.user, n.roles)).map((n) => {
              const active = n.match ? n.match(path) : path.startsWith(n.href);
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex shrink-0 items-center gap-3 rounded-[10px] border p-3 text-[15px]",
                    active ? "border-sage bg-mist font-bold text-pine" : "border-transparent font-semibold text-text-2 hover:bg-mist",
                  )}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {n.icon}
                  </svg>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-[22px] p-4 sm:p-7">
          {!allowed ? (
            <Spinner />
          ) : (
            <>
              {(title || actions) && (
                <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
                  {title && <h1 className="text-[26px] font-extrabold">{title}</h1>}
                  {actions}
                </div>
              )}
              <Suspense fallback={<Spinner />}>{children(auth.user)}</Suspense>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
