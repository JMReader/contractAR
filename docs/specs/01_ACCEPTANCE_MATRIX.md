---
project: escrow-argt
author: devin-swe2 (para korita)
date: 2026-11-07
status: proposed
---

# Matriz de aceptación — ContractAR

#project/escrow-argt #status/proposed

Criterios propuestos para aprobación. Una métrica sin evidencia queda pendiente; nunca se declara aprobada sin artefacto enlazado. Owner: H1 fondos, H2 interfaz, H3 integración, H4 QA/landing, P principal.

## Métricas M1–M16

| ID | Objetivo | Evidencia requerida | Owner |
|---|---|---|---|
| M1 | 100% casos A-01..A-09 aprobados en suite integrada | Matriz test→comando→resultado→SHA, sin skips | P+H4 |
| M2 | Conservación exacta de fondos, cero doble cobro | Unit + fuzz ≥256 casos/propiedad + invariantes; `fee+neto+refund=depósito` | H1 |
| M3 | Cero autorización indebida | Tests negativos por rol/estado/id/callback ajeno/repetición | H1 |
| M4 | Feedback verificable en cada movimiento | UI distingue firma/envío/confirmación/revert; E2E con transporte controlado; hashes Fuji sólo si autorizados | H3+H4 |
| M5 | Usuario identifica monto/estado/próximo actor | 5 tareas guiadas, revisión humana 5/5 | H2 |
| M6 | Sin error JS ni desborde a 390/1440 px (+320 legible) | Navegador real, capturas, logs | H2+H4 |
| M7 | Teclado, foco, consentimiento, contraste AA | Recorrido teclado, modales, ≥44px, 4.5:1; cero hallazgos serios | H2+H4 |
| M8 | Herramientas de calidad sobre SHA entregado | build+typecheck+lint+forge test+playwright | P |
| M9 | Demo A ≤3 min (excl. espera de red) | Ensayo grabado con guion; duración UI y confirmaciones separadas | P+H4 |
| M10 | Cierre de fase visible en cerebro#2 | URL comentario + PR/commit + métricas + pendientes | P |
| M11 | Instalación reproducible, sin secretos | README desde checkout limpio, lockfiles, diff revisado | H3+P |
| M12 | Landing usable sin GPU/animación y con reduced-motion | Fallback, pestaña oculta, móvil; Lighthouse móvil ≥85 orientativo con hardware registrado | H4 |
| M13 | Carga/retiro mock idempotentes | Tests callbacks duplicados/fuera de orden/rechazo/reintento; reconciliación ARS/tARGt/escrow/fee; cero retiros sobre saldo bloqueado | H3 |
| M14 | A y B completos pesos-a-pesos | 2 recorridos E2E: cargar→aceptar→fondear→salida→retirar; disputa mock y devolución | P+H4 |
| M15 | Sin pasos técnicos obligatorios para cliente demo | Revisión humana + E2E: sin seed/dirección/red en camino principal; operador identificado como demo | H2+H3 |
| M16 | Landing GPU realmente integrada y fallback correcto | Versión vgpu registrada, escena ejecutada, medición en navegador; pruebas sin soporte/pérdida de dispositivo/reduced-motion/oculta | H4 |

## Casos A — garantía de auto (obligatorios)

| Caso | Criterio |
|---|---|
| A-01 Crear/aceptar | Rentadora propone; cliente ve partes, token, importe, fee, condiciones, plazos; sólo el actor autorizado acepta; términos no cambian unilateralmente |
| A-02 Aprobar/fondear | `approve` no mueve saldo; `fund` custodia monto exacto; red equivocada, saldo/allowance insuficiente, rechazo, repetición, revert, desconexión cubiertos |
| A-03 Devolución total | Sin reclamo válido → devolución completa al depositante, fee cero |
| A-04 Reclamo parcial | Propuesta itemizada (ej. 180.000/600.000), acuerdo de partes, reparto/fee exactos; rechazo probado; nadie liquida unilateral |
| A-05 Reclamo total | Nunca excede depósito; neto/fee correctos; cierra una única vez |
| A-06 Disputa | Congela acciones incompatibles; caso en árbitro mock; sólo resolución autorizada mueve fondos; callback ajeno, ruling fuera de rango y resolución repetida inválidos |
| A-07 Cancelación/timeout | Antes de fondos sin transferencia; después según consentimiento/plazos; ambos lados de cada frontera temporal |
| A-08 Recuperación | Refrescar/reabrir enlace, cambiar cuenta, reconectar: estado, permisos y próxima acción correctos; URL manipulada no altera términos |
| A-09 UX financiera honesta | Token mock visible, costos conocidos, comprobante de red real si existe, simulados etiquetados |

## Casos B — compraventa de entrada (F6)

| Caso | Criterio |
|---|---|
| B-01 | Vendedor propone, comprador acepta/fondea, entrega y confirmación autorizadas; release al vendedor con fee; disputa/reembolso según reglas; sin certificar autenticidad |
| B-02 | Repetir permisos y conservación de M2/M3 sobre el flujo B |
| B-03 | Devolución al comprador nunca se presenta como "pago al vendedor" ni viceversa |

## Casos P — pesos a pesos (obligatorios)

| Caso | Criterio |
|---|---|
| P-01 Carga | Pago mock aprobado acredita una sola vez; pendiente/rechazado no acredita; correspondencia con token de prueba documentada y comprobante real si se ejecutó onchain |
| P-02 Conversión | Equivalencia demo ARS↔tARGt conservada; sin doble saldo entre representaciones; retenido ≠ gastable |
| P-03 Retiro | Liquidados retirables a pesos simulados con éxito/rechazo/reintento; una solicitud no se ejecuta dos veces; nunca se insinúa transferencia bancaria real |
| P-04 Entrada E2E | Cargar→aceptar→fondear→entrega→confirmar→neto al vendedor→retirar; disputa no equivale a validación de autenticidad |
| P-05 Disputa | Reclamo → árbitro mock autorizado resuelve → balance y fee reconciliados; UI muestra estado real y rol demo |
| P-06 Condiciones | Importe, destinatarios, plazo, fee y términos ligados al acuerdo; cambiar metadatos de URL no cambia autorización ni condiciones onchain |
