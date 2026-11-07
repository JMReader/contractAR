import type { Metadata } from "next";
import { AppShell } from "@/components/nav-bar";
import { AceptarAcuerdo } from "@/components/aceptar-acuerdo";

export const metadata: Metadata = {
  title: "Revisar y aceptar — ContractAR",
  description: "Revisá las condiciones del acuerdo que te compartieron antes de aceptar.",
};

export default async function AceptarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <AceptarAcuerdo id={id} />
    </AppShell>
  );
}
