"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hasAnyRole, useCurrentUser, type AppRole, type CurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { Spinner, cx } from "./ui";

const NAV: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/admin/", label: "Eventos", roles: ["organizer", "finance"] },
  { href: "/admin/dados/", label: "Dados", roles: ["organizer", "finance"] },
  { href: "/admin/base/", label: "Base ACIESC", roles: ["organizer", "finance"] },
  { href: "/admin/portaria/", label: "Portaria", roles: ["organizer", "door"] },
  { href: "/admin/configuracoes/", label: "Configurações", roles: ["admin"] },
];

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
  title: ReactNode;
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
    <>
      <header className="bg-green-900 text-white print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link href="/admin/" className="flex min-h-11 items-center gap-3" aria-label="Painel ACIESC — início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-aciesc.webp" alt="ACIESC" width={209} height={77} className="h-8 w-auto" />
            <span className="border-l border-white/25 pl-3 text-xs font-semibold uppercase tracking-widest text-accent">Painel</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-3 text-white/80 hover:text-white">Ver site</Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-white/80 hover:text-white"
              onClick={() => getSupabase().auth.signOut().then(() => router.replace("/"))}
            >
              Sair
            </button>
          </div>
        </div>
        {auth.status === "ready" && (
          <nav aria-label="Painel" className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
            {NAV.filter((n) => canSee(auth.user, n.roles)).map((n) => {
              const active = n.href === "/admin/" ? path === "/admin/" || path.startsWith("/admin/evento") : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx("inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold", active ? "bg-white text-green-900" : "text-white/85 hover:bg-white/10")}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {!allowed ? (
          <Spinner />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <h1 className="text-2xl font-extrabold">{title}</h1>
              {actions}
            </div>
            <Suspense fallback={<Spinner />}>{children(auth.user)}</Suspense>
          </>
        )}
      </main>
    </>
  );
}
