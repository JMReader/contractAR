// Estado textual con ícono y color — nunca color solo (M7 / antislop-human).

import {
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Scale,
  ShieldCheck,
  Split,
  type LucideIcon,
} from "lucide-react";
import { AgreementState } from "@contractar/shared";
import { estadoInfo, type Tono } from "./domain";

const TONOS: Record<Tono, string> = {
  neutro: "border-[#7d8ba3] text-muted",
  activo: "border-ice text-ice",
  exito: "border-green text-green",
  alerta: "border-coral text-coral",
  error: "border-coral text-coral",
  demo: "border-[#7d8ba3] text-muted border-dashed",
};

const ICONOS: Partial<Record<AgreementState, LucideIcon>> = {
  [AgreementState.Created]: Clock,
  [AgreementState.Accepted]: CircleCheck,
  [AgreementState.Funded]: ShieldCheck,
  [AgreementState.OutcomeProposed]: Split,
  [AgreementState.Disputed]: Scale,
  [AgreementState.Settled]: CircleCheck,
  [AgreementState.Resolved]: CircleCheck,
  [AgreementState.Cancelled]: CircleX,
};

export function EstadoPill({
  estado,
  className = "",
}: {
  estado: AgreementState;
  className?: string;
}) {
  const { label, tono } = estadoInfo(estado);
  const Icon = ICONOS[estado] ?? Hourglass;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${TONOS[tono]} ${className}`}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.2} />
      {label}
    </span>
  );
}

/** Etiqueta "Demo"/"Simulación" — datos simulados siempre etiquetados. */
export function DemoTag({ children = "Demo" }: { children?: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-dashed px-2 py-0.5 text-xs font-semibold ${TONOS.demo}`}
    >
      {children}
    </span>
  );
}

export function TonoPill({
  label,
  tono,
  icon: Icon,
}: {
  label: string;
  tono: Tono;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${TONOS[tono]}`}
    >
      {Icon ? <Icon aria-hidden className="size-4" strokeWidth={2.2} /> : null}
      {label}
    </span>
  );
}
