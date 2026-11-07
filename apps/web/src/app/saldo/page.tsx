import type { Metadata } from "next";
import { AppShell } from "@/components/nav-bar";
import { SaldoView } from "@/components/saldo-view";

export const metadata: Metadata = {
  title: "Tu saldo — ContractAR",
  description: "Saldo en pesos de demostración: carga y retiro simulados, etiquetados como demo.",
};

export default function SaldoPage() {
  return (
    <AppShell>
      <SaldoView />
    </AppShell>
  );
}
