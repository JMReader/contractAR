import type { Metadata } from "next";
import { AppShell } from "@/components/nav-bar";
import { AcuerdosLista } from "@/components/acuerdos-lista";

export const metadata: Metadata = {
  title: "Tus acuerdos — ContractAR",
  description: "Tus acuerdos con plata protegida, en pesos y con estados claros.",
};

export default function AcuerdosPage() {
  return (
    <AppShell>
      <AcuerdosLista />
    </AppShell>
  );
}
