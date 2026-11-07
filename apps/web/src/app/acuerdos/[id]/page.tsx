import type { Metadata } from "next";
import { AppShell } from "@/components/nav-bar";
import { AcuerdoDetalle } from "@/components/acuerdo-detalle";

export const metadata: Metadata = {
  title: "Acuerdo — ContractAR",
  description: "Ficha del acuerdo: monto, estado real, próximo paso, condiciones y comprobante.",
};

export default async function AcuerdoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <AcuerdoDetalle id={id} />
    </AppShell>
  );
}
