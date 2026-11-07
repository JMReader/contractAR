import type { Metadata } from "next";
import { AppShell } from "@/components/nav-bar";
import { AcuerdoForm } from "@/components/acuerdo-form";

export const metadata: Metadata = {
  title: "Nuevo acuerdo — ContractAR",
  description: "Creá un acuerdo con plata protegida: garantía de auto o compra de entrada.",
};

export default function NuevoAcuerdoPage() {
  return (
    <AppShell>
      <AcuerdoForm />
    </AppShell>
  );
}
