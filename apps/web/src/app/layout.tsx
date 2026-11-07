import type { Metadata, Viewport } from "next";
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
      <body>{children}</body>
    </html>
  );
}
