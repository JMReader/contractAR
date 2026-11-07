import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContractAR — acuerdos con plata protegida",
  description:
    "Acordá condiciones, protegí el dinero en garantía y liberá o devolvé el pago cuando se cumpla. Demo: carga y retiro de pesos simulados.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101317",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--line)",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <Link
            href="/"
            style={{
              fontWeight: 800,
              fontSize: "20px",
              letterSpacing: "-0.05em",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            contract<span style={{ color: "var(--ice)" }}>AR</span>
          </Link>
          <nav aria-label="Principal" style={{ display: "flex", gap: "18px", fontSize: "13px" }}>
            <Link href="/acuerdos" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Acuerdos
            </Link>
            <Link href="/saldo" style={{ color: "var(--muted)", textDecoration: "none" }}>
              Saldo
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
