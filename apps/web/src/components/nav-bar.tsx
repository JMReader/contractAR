"use client";

// Navegación: header con marca + links en escritorio; en móvil las dos
// destinos principales pasan a una barra inferior al alcance del pulgar
// (antislop-layoutmobile: la nav reflows, no se comprime).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Wallet } from "lucide-react";
import { DemoTag } from "./estado-pill";

const LINKS = [
  { href: "/acuerdos", label: "Acuerdos", icon: FileText },
  { href: "/saldo", label: "Saldo", icon: Wallet },
];

function activo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/acuerdos"
            className="inline-flex min-h-11 items-center text-xl font-extrabold tracking-tight text-ink no-underline"
          >
            contract<span className="text-ice">AR</span>
          </Link>
          <nav aria-label="Secciones" className="hidden items-center gap-1 sm:flex">
            {LINKS.map(({ href, label }) => {
              const on = activo(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-lg px-4 font-semibold no-underline ${
                    on ? "text-ink" : "text-muted"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <DemoTag />
        </div>
      </header>

      {/* Barra inferior móvil — reservada con padding en AppShell */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const on = activo(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold no-underline ${
                  on ? "text-ice" : "text-muted"
                }`}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <NavBar />
      {/* pb reserva la barra inferior móvil para que nunca tape contenido */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-12 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
