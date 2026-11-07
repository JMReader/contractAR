import { AgreementState, Template, type Action, type Role } from "@contractar/shared";

export interface TemplateField {
  key: string;
  label: string;
  input: "text" | "datetime-local" | "amountARS";
  required: boolean;
  help: string;
}

export type StepId = "create" | "load" | "accept" | "fund" | "deliver" | "confirm" | "collect" | "withdraw";

export interface TemplateStep {
  title: string;
  cta: string;
  help: string;
  actor: Role;
  action: Action | "create" | null;
}

export interface AgreementTemplate {
  id: Template;
  title: string;
  currency: "ARS";
  amountUnit: "centavos";
  roles: Readonly<Record<Role, string>>;
  fields: readonly TemplateField[];
  defaultTerms: string;
  disclaimers: readonly string[];
  states: Readonly<Record<AgreementState, string>>;
  steps: Readonly<Record<StepId, TemplateStep>>;
  defaultOutcome: "refund" | "release";
}

const demoDisclaimer = "Demo: las cargas y los retiros son simulados. No se realizan transferencias bancarias reales.";
const disputeDisclaimer = "Las disputas las resuelve un árbitro de demo. Abrir una disputa mantiene los fondos retenidos hasta su resolución.";
const authenticityDisclaimer = "ContractAR no certifica la autenticidad de la entrada ni garantiza el acceso al evento.";
const commonTerms = `${demoDisclaimer}\nEl costo del servicio es del 1% sobre la parte asignada a quien cobra; las devoluciones no tienen ese costo. Revisá el importe, las partes, los plazos y las condiciones antes de aceptar. Las condiciones aceptadas no se cambian desde el enlace.\n${disputeDisclaimer}\nSi vence el plazo de revisión y no hay una disputa abierta, quien puso los fondos puede pedir su devolución. El vencimiento no ejecuta movimientos automáticamente.`;

const commonFields: readonly TemplateField[] = [
  { key: "amountARS", label: "Importe en pesos", input: "amountARS", required: true, help: "Ingresá pesos argentinos. El importe se guarda en centavos enteros." },
  { key: "acceptDeadline", label: "Fecha límite para aceptar", input: "datetime-local", required: true, help: "Indicá fecha, hora y zona horaria antes de compartir el acuerdo." },
  { key: "reviewDeadline", label: "Fecha límite para revisar", input: "datetime-local", required: true, help: "Debe ser posterior al plazo de aceptación. Después de este plazo se puede pedir la devolución si no hay disputa." },
  { key: "terms", label: "Condiciones del acuerdo", input: "text", required: true, help: "Incluí qué se entrega, cómo se revisa y qué pasa si hay un problema. Conservá los avisos de esta demo." },
];

const commonStates = {
  [AgreementState.None]: "Acuerdo sin crear",
  [AgreementState.Created]: "Esperando aceptación",
  [AgreementState.Accepted]: "Esperando fondos",
  [AgreementState.Funded]: "Fondos retenidos",
  [AgreementState.OutcomeProposed]: "Propuesta pendiente de confirmación",
  [AgreementState.Disputed]: "En disputa con árbitro de demo",
  [AgreementState.Settled]: "Liquidación completada: revisá el cobro y la devolución",
  [AgreementState.Cancelled]: "Acuerdo cancelado sin movimiento de fondos",
  [AgreementState.Resolved]: "Disputa resuelta: verificando liquidación",
} satisfies Record<AgreementState, string>;

export const templateRegistry: Readonly<Record<Template, AgreementTemplate>> = {
  [Template.Guarantee]: {
    id: Template.Guarantee,
    title: "Garantía de auto",
    currency: "ARS",
    amountUnit: "centavos",
    roles: { creator: "Rentadora", depositor: "Cliente", beneficiary: "Rentadora", arbiter: "Árbitro de demo" },
    fields: [
      { key: "vehicle", label: "Auto", input: "text", required: true, help: "Identificá el auto sin incluir datos personales sensibles." },
      { key: "returnConditions", label: "Condiciones de devolución del auto", input: "text", required: true, help: "Detallá los controles y los posibles descuentos sobre la garantía." },
      ...commonFields,
    ],
    defaultTerms: `La rentadora propone la garantía y el cliente acepta y aporta los fondos. Al devolver el auto, las partes revisan las condiciones pactadas. Sin reclamos, acuerdan devolver la garantía completa al cliente. Cualquier descuento requiere una propuesta y la aceptación de la otra parte, o una resolución del árbitro de demo.\n${commonTerms}`,
    disclaimers: [demoDisclaimer, disputeDisclaimer],
    states: { ...commonStates, [AgreementState.Funded]: "Garantía retenida: pendiente de revisión del auto" },
    defaultOutcome: "refund",
    steps: {
      create: { title: "Crear garantía", cta: "Crear acuerdo", actor: "creator", action: "create", help: "Completá el auto, el importe y las condiciones de devolución." },
      load: { title: "Cargar saldo de demo", cta: "Cargar pesos de demo", actor: "depositor", action: null, help: "Cargá saldo simulado para cubrir la garantía." },
      accept: { title: "Aceptar garantía", cta: "Aceptar condiciones", actor: "depositor", action: "accept", help: "Revisá el auto, el importe, los plazos y los posibles descuentos." },
      fund: { title: "Aportar garantía", cta: "Dejar garantía", actor: "depositor", action: "fund", help: "El importe queda retenido cuando se confirma el movimiento." },
      deliver: { title: "Revisar devolución del auto", cta: "Proponer devolución", actor: "beneficiary", action: "proposeOutcome", help: "Proponé devolver toda la garantía al cliente o detallá un descuento." },
      confirm: { title: "Confirmar reparto", cta: "Confirmar propuesta", actor: "depositor", action: "acceptOutcome", help: "Si la rentadora propuso, revisá el reparto y confirmá sólo si estás de acuerdo." },
      collect: { title: "Ver devolución y cobro", cta: "Ver liquidación", actor: "depositor", action: null, help: "La liquidación muestra lo devuelto al cliente, lo cobrado por la rentadora y el costo del servicio." },
      withdraw: { title: "Retirar saldo de demo", cta: "Simular retiro en pesos", actor: "depositor", action: null, help: "Retirá sólo el saldo disponible. El retiro es simulado." },
    },
  },
  [Template.Sale]: {
    id: Template.Sale,
    title: "Compra de entrada",
    currency: "ARS",
    amountUnit: "centavos",
    roles: { creator: "Vendedor", depositor: "Comprador", beneficiary: "Vendedor", arbiter: "Árbitro de demo" },
    fields: [
      { key: "event", label: "Evento", input: "text", required: true, help: "Indicá nombre, lugar y fecha del evento." },
      { key: "ticket", label: "Entrada acordada", input: "text", required: true, help: "Detallá cantidad, sector y ubicación. No publiques códigos de acceso ni la entrada en este enlace." },
      { key: "deliveryMethod", label: "Forma de entrega", input: "text", required: true, help: "Acordá cómo recibirá la entrada el comprador, sin datos sensibles en el enlace público." },
      { key: "deliveryDeadline", label: "Fecha límite de entrega", input: "datetime-local", required: true, help: "Dejá tiempo para revisar la entrega antes del plazo de revisión y del evento." },
      ...commonFields,
    ],
    defaultTerms: `El vendedor propone la venta de la entrada y el comprador acepta las condiciones y aporta el importe acordado. El vendedor entrega la entrada por el medio y dentro del plazo pactados. Después propone el cobro. El comprador revisa la entrega y confirma la propuesta sólo si está de acuerdo: esa confirmación libera el importe al vendedor, descontando el costo del servicio. La entrega por sí sola no libera fondos. Una devolución o un reparto requieren la aceptación de la otra parte, el vencimiento aplicable o una resolución del árbitro de demo.\n${authenticityDisclaimer}\n${commonTerms}`,
    disclaimers: [authenticityDisclaimer, demoDisclaimer, disputeDisclaimer],
    states: { ...commonStates, [AgreementState.Funded]: "Pago retenido: esperando entrega de la entrada", [AgreementState.OutcomeProposed]: "Reparto propuesto: revisá la entrega y los importes" },
    defaultOutcome: "release",
    steps: {
      create: { title: "Crear venta de entrada", cta: "Crear acuerdo de entrada", actor: "creator", action: "create", help: "Completá el evento, la entrada, el precio y la forma de entrega. Compartí el acuerdo con el comprador." },
      load: { title: "Cargar saldo de demo", cta: "Cargar pesos de demo", actor: "depositor", action: null, help: "Cargá el importe acordado. Una carga pendiente o rechazada no suma saldo disponible." },
      accept: { title: "Aceptar compra", cta: "Aceptar condiciones de compra", actor: "depositor", action: "accept", help: "Revisá la entrada, el vendedor, el importe, el costo del servicio y los plazos. ContractAR no certifica la autenticidad de la entrada." },
      fund: { title: "Dejar el pago retenido", cta: "Aportar el pago", actor: "depositor", action: "fund", help: "El importe queda retenido cuando se confirma el movimiento. El vendedor todavía no puede cobrarlo." },
      deliver: { title: "Entregar entrada y proponer cobro", cta: "Ya entregué: proponer cobro", actor: "beneficiary", action: "proposeOutcome", help: "Entregá la entrada por el medio acordado y proponé el cobro del importe completo. El comprador debe confirmar para liberarlo." },
      confirm: { title: "Revisar entrada y confirmar", cta: "Confirmar entrega y liberar pago", actor: "depositor", action: "acceptOutcome", help: "Confirmá sólo si recibiste lo acordado y aceptás el reparto vigente. Si hay un problema, podés abrir una disputa antes de la liquidación." },
      collect: { title: "Cobro del vendedor", cta: "Ver cobro y costo del servicio", actor: "beneficiary", action: null, help: "Tras la confirmación de la liquidación, el vendedor recibe el importe asignado menos el 1% de costo del servicio. Revisá el saldo disponible." },
      withdraw: { title: "Retirar cobro en pesos de demo", cta: "Simular retiro en pesos", actor: "beneficiary", action: null, help: "Pedí el retiro sólo sobre el saldo disponible. El retiro es simulado y no realiza una transferencia bancaria real." },
    },
  },
};

export function getTemplate(template: Template): AgreementTemplate {
  return templateRegistry[template];
}

export function isValidAmountARS(amountCentavos: number): boolean {
  return Number.isSafeInteger(amountCentavos) && amountCentavos > 0;
}

// Los importes provienen de la liquidación confirmada, en unidades mínimas del motor.
export function getSettlementLabel(template: Template, toBeneficiary: bigint, toDepositor: bigint): string {
  if (toBeneficiary < 0n || toDepositor < 0n || toBeneficiary + toDepositor === 0n) {
    throw new RangeError("La liquidación debe tener importes válidos.");
  }
  const { roles } = getTemplate(template);
  const beneficiary = `${template === Template.Guarantee ? "a la" : "al"} ${roles.beneficiary.toLowerCase()}`;
  if (toBeneficiary === 0n) return `Devolución total al ${roles.depositor.toLowerCase()}`;
  if (toDepositor === 0n) return `Pago ${beneficiary}`;
  return `Pago ${beneficiary} y devolución al ${roles.depositor.toLowerCase()}`;
}

export interface TemplateTransition {
  from: readonly AgreementState[];
  to: AgreementState;
  actors: readonly Role[];
  help: string;
}

// Describe el motor para el copy; los permisos efectivos los verifica el contrato.
export const engineTransitions: Readonly<Record<Action, TemplateTransition>> = {
  accept: { from: [AgreementState.Created], to: AgreementState.Accepted, actors: ["depositor"], help: "Sólo quien aporta los fondos, antes del límite de aceptación y con las mismas condiciones." },
  cancel: { from: [AgreementState.Created, AgreementState.Accepted], to: AgreementState.Cancelled, actors: ["creator"], help: "Sólo quien creó el acuerdo, mientras no haya fondos retenidos." },
  fund: { from: [AgreementState.Accepted], to: AgreementState.Funded, actors: ["depositor"], help: "Aportá el importe exacto; esperá la confirmación antes de mostrarlo como retenido." },
  proposeOutcome: { from: [AgreementState.Funded, AgreementState.OutcomeProposed], to: AgreementState.OutcomeProposed, actors: ["depositor", "beneficiary"], help: "Proponé cuánto cobra cada parte. Una nueva propuesta de la otra parte reemplaza la anterior." },
  acceptOutcome: { from: [AgreementState.OutcomeProposed], to: AgreementState.Settled, actors: ["depositor", "beneficiary"], help: "Sólo la otra parte puede confirmar la propuesta vigente. Quien propuso no puede confirmarla." },
  dispute: { from: [AgreementState.Funded, AgreementState.OutcomeProposed], to: AgreementState.Disputed, actors: ["depositor", "beneficiary"], help: "Abrí una disputa antes de la liquidación. Los fondos siguen retenidos." },
  rule: { from: [AgreementState.Disputed], to: AgreementState.Settled, actors: ["arbiter"], help: "El árbitro de demo decide el reparto completo; esperá la confirmación de la liquidación." },
  refundAfterTimeout: { from: [AgreementState.Funded, AgreementState.OutcomeProposed], to: AgreementState.Settled, actors: ["depositor"], help: "Pedí la devolución después del plazo de revisión, si no hay disputa abierta." },
};
