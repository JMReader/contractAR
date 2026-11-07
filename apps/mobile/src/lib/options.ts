import type { Template } from "./api";

export const CONDICIONES: Record<Template, string[]> = {
  guarantee: [
    "Devolución del auto sin daños nuevos, comparando fotos de entrega y devolución.",
    "Mismo nivel de combustible al retirar y devolver el vehículo.",
    "Devolución en la fecha y el horario acordados.",
    "Multas y peajes del período a cargo de quien alquila, con comprobante.",
    "Garantía devuelta completa si se cumplen las condiciones; reclamos hasta 48 horas después.",
  ],
  sale: [
    "Entrega de la entrada original antes del evento.",
    "La entrada debe coincidir con el evento, la fecha y el sector acordados.",
    "El pago se libera cuando el comprador confirma que pudo ingresar.",
    "Reembolso completo si el evento se cancela o la entrada no es válida.",
  ],
};
export const VERIFICACIONES = [
  { id: "ia", nombre: "Inteligencia artificial", detalle: "Revisión de fotos y evidencia. Integración de IA pendiente en esta demo." },
  { id: "kleros", nombre: "Humana · Kleros", detalle: "Arbitraje humano ante un desacuerdo. Kleros se presenta como opción, sin enviar disputas reales." },
  { id: "automatica", nombre: "Confirmación sí / no", detalle: "Una persona designada confirma si se cumplió. La demo muestra una decisión manual." },
];

