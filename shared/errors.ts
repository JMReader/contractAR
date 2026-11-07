// Mapa de errores del contrato/servicio a castellano claro (persona 2 / H2 lo consume).
// Clave: selector o identificador de revert. Mantener alineado con Escrow.sol.

export const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorized: "Esta acción no corresponde a tu rol en el acuerdo.",
  InvalidState: "El acuerdo ya cambió de estado; recargá para ver el paso actual.",
  NotDepositor: "Sólo quien deposita puede hacer esto.",
  NotBeneficiary: "Sólo quien cobra puede hacer esto.",
  NotArbiter: "Sólo el árbitro designado puede resolver la disputa.",
  AlreadySettled: "El acuerdo ya está cerrado.",
  WrongAmount: "El monto no coincide con lo pactado.",
  SplitMismatch: "La suma de lo que recibe cada parte debe ser igual al depósito.",
  DeadlinePassed: "El plazo venció.",
  DeadlineNotPassed: "El plazo todavía no venció.",
  InsufficientBalance: "Saldo insuficiente para esta operación.",
  InsufficientAllowance: "Falta autorizar el monto al contrato.",
  PaymentPending: "El pago todavía está pendiente.",
  PaymentRejected: "El pago fue rechazado.",
  DuplicateOperation: "Esta operación ya fue registrada.",
  WithdrawLocked: "No podés retirar saldo que está protegido en un acuerdo.",
};

export function toHumanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  for (const [key, text] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) return text;
  }
  if (msg.includes("UserRejected") || msg.includes("user rejected"))
    return "Cancelaste la firma. Podés reintentar cuando quieras.";
  if (msg.includes("network") || msg.includes("chain"))
    return "La red no responde o no es la correcta. Reintentá en unos segundos.";
  return "Algo salió mal. Reintentá; si sigue, revisá el comprobante técnico.";
}
