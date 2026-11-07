# Backlog de backend y contratos

| Prioridad | Entregable | Criterio de listo | Responsable | Estado |
|---|---|---|---|---|
| P0 | Contrato escrow | Custodia ERC-20 y evita doble liberación (spec: `docs/specs/02_FUNDS_STATE_MACHINE.md`) | Nano / H1 | En curso |
| P0 | Token mock tARGt | ERC-20 18 decimales con mint de demo, dirección parametrizada | Nano / H1 | En curso |
| P0 | Árbitro mock | `rule()` restringido al árbitro del acuerdo, eventos estilo ERC-792 | Nano / H1 | En curso |
| P0 | Eventos onchain | Emite eventos para cada transición relevante | H1 | En curso |
| P0 | Pruebas de contrato | Fondeo, liberación, reembolso, parcial, disputa, permisos inválidos, fuzz+invariantes | H1 | En curso |
| P0 | Capa demo pesos (API en `apps/web/app/api`) | Mock MP con idempotencia, ledger ARS, operador testnet | H3 | En curso |
| P1 | Estados indexados | La interfaz recupera el estado onchain del acuerdo | H3 | Pendiente |
| P1 | Deploy Fuji verificado | Sólo con autorización explícita; direcciones en `shared/addresses.json` | P+Nano | Bloqueado por autorización |

Plantillas vigentes: **A garantía de auto** y **B compraventa de entrada** (ver decisión de alcance 2026-11-07). Los ejemplos freelance/seña quedaron desactualizados.

No guardar claves privadas ni secretos en el repositorio. Crear un issue por cada fila tomada y enlazar la PR correspondiente.
