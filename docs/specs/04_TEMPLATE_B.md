# Plantilla B: compraventa de entrada P2P

Entrega O1 sobre `Template.Sale` del dominio compartido. Cambia los campos, los roles y el copy; reutiliza el motor de fondos de `02_FUNDS_STATE_MACHINE.md` y las interfaces de `03_INTERFACE_CONTRACT.md`. No agrega pantallas ni modifica contratos. Registro: `apps/web/src/lib/templates/index.ts`. Pruebas: `index.test.ts` en el mismo directorio.

## Contrato de consumo

`templateRegistry` y `getTemplate(Template.Sale)` devuelven campos, condiciones por defecto, avisos, estados y ayudas tipados. También se incluye `Template.Guarantee`, con rentadora/cliente, devolución sugerida y revisión del auto. `defaultOutcome` es una sugerencia para armar una propuesta; nunca autoriza una liquidación automática.

| Rol del motor | Garantía | Entrada | Función en B |
| --- | --- | --- | --- |
| creator | Rentadora | Vendedor | Crea; cancela antes de fondos |
| depositor | Cliente | Comprador | Acepta, aporta y recibe devoluciones |
| beneficiary | Rentadora | Vendedor | Entrega, propone cobro y recibe el neto |
| arbiter | Árbitro de demo | Árbitro de demo | Resuelve una disputa abierta |

El vendedor ocupa `creator` y `beneficiary`; el comprador ocupa `depositor`. La integración debe preservar esas identidades al crear el acuerdo. El registro describe roles, no autentica personas. El enlace público no concede permisos.

Los campos B son evento (nombre, lugar y fecha), entrada (cantidad, sector y ubicación), forma de entrega, fecha límite de entrega, importe ARS, fecha límite de aceptación, fecha límite de revisión y condiciones. Son obligatorios. No publicar códigos de acceso, la entrada ni datos personales sensibles en los metadatos públicos. Antes de crear, validar fechas y zona horaria: aceptación anterior a entrega, entrega anterior a revisión y revisión antes del evento. El plazo de entrega es una condición acordada; el motor sólo conoce los plazos de aceptación y revisión.

`amountARS` se expresa en centavos enteros según la interfaz del ledger. `isValidAmountARS` exige un entero seguro positivo: $120.000 se guarda como `12_000_000`. No se usa punto flotante para calcular repartos. La integración convierte a unidades mínimas del motor con aritmética entera; esta plantilla no convierte ni calcula comisiones.

## Mapeo de aceptación al motor

| Caso | Recorrido y permisos | Evidencia de esta entrega |
| --- | --- | --- |
| B-01 | Vendedor crea `Created`; comprador ejecuta `accept` hacia `Accepted` y `fund` por el importe exacto hacia `Funded`. Vendedor entrega por el medio pactado y hace `proposeOutcome(remaining)` hacia `OutcomeProposed`. Comprador confirma esa propuesta con `acceptOutcome` hacia `Settled`. | Roles y pasos tipados; prueba de actores y secuencia. Aviso de autenticidad obligatorio en términos. |
| B-02 | Ambos pueden proponer o disputar en `Funded`/`OutcomeProposed`. Sólo la contraparte confirma. `dispute` lleva a `Disputed`; sólo `arbiter` llama `rule` para liquidar. `refundAfterTimeout` sólo por comprador después de `reviewDeadline`, sin disputa. | Prueba del catálogo compartido de transiciones y ausencia de acciones incompatibles en disputa/terminales. No sustituye tests del contrato de permisos o conservación. |
| B-03 | `Settled` puede significar cobro total, devolución total o reparto. Los destinatarios se obtienen de los importes confirmados, nunca del nombre de la plantilla ni del último botón pulsado. | `getSettlementLabel` probado con los tres resultados, incluida devolución de fracciones de centavo en unidades mínimas. |

No hay estado ni llamada `deliver`, `confirmDelivery`, `collect` o `withdraw` en el motor compartido. La entrega ocurre fuera del motor y su declaración acompaña la propuesta del vendedor; no prueba autenticidad ni recepción. Confirmar significa aceptar la propuesta vigente de la contraparte. Si el comprador propuso un reparto, el vendedor debe confirmarlo: no usar el CTA de confirmación de entrega para esa dirección inversa.

`engineTransitions` describe las acciones existentes de `shared/types.ts`; no reemplaza comprobaciones del contrato, del proponente vigente, de los plazos ni del hash de condiciones. `create` se describe en el paso de creación. `cancelExpired` aparece en la spec de fondos pero no en `Action` ni en la interfaz congelada; no se inventa como acción disponible en el registro.

Se asume la liquidación terminal del reparto completo: `toBeneficiary + toDepositor == remaining`. Un reparto parcial asigna una parte al vendedor y el resto al comprador en esa misma liquidación. No se implementan pagos parciales sucesivos: están pendientes en la spec del motor. `Resolved` tiene copy de verificación; no habilita otro cobro. La integración espera el resultado confirmado antes de mostrar dinero disponible.

## Copy del recorrido B

El texto implementado vive en el registro. Este recorrido usa la propuesta de cobro total del vendedor.

| Paso | Título y acción | Ayuda y resultado |
| --- | --- | --- |
| Crear, vendedor | Crear venta de entrada / Crear acuerdo de entrada | Completá el evento, la entrada, el precio y la forma de entrega. Compartí el acuerdo con el comprador. Estado: Esperando aceptación. |
| Cargar, comprador | Cargar saldo de demo / Cargar pesos de demo | Cargá el importe acordado. Una carga pendiente o rechazada no suma saldo disponible. La carga es simulada y no cambia el estado del acuerdo. |
| Aceptar, comprador | Aceptar compra / Aceptar condiciones de compra | Revisá la entrada, el vendedor, el importe, el costo del servicio y los plazos. ContractAR no certifica la autenticidad de la entrada. Estado: Esperando fondos. |
| Fondear, comprador | Dejar el pago retenido / Aportar el pago | El importe queda retenido cuando se confirma el movimiento. El vendedor todavía no puede cobrarlo. Estado: Pago retenido: esperando entrega de la entrada. |
| Entregar, vendedor | Entregar entrada y proponer cobro / Ya entregué: proponer cobro | Entregá la entrada por el medio acordado y proponé el cobro del importe completo. El comprador debe confirmar para liberarlo. Estado: Reparto propuesto: revisá la entrega y los importes. |
| Confirmar, comprador | Revisar entrada y confirmar / Confirmar entrega y liberar pago | Confirmá sólo si recibiste lo acordado y aceptás el reparto vigente. Si hay un problema, podés abrir una disputa antes de la liquidación. |
| Cobrar, vendedor | Cobro del vendedor / Ver cobro y costo del servicio | Tras la confirmación de la liquidación, el vendedor recibe el importe asignado menos el 1% de costo del servicio. Revisá el saldo disponible. No hay un segundo movimiento de cobro. |
| Retirar, vendedor | Retirar cobro en pesos de demo / Simular retiro en pesos | Pedí el retiro sólo sobre el saldo disponible. El retiro es simulado y no realiza una transferencia bancaria real. No modifica el estado terminal del acuerdo. |

Cargar puede hacerse antes de aceptar; debe completarse antes de aportar fondos. El retiro se pide al adaptador de pagos, con su clave de idempotencia, y nunca sobre saldo retenido. Una devolución deja saldo al comprador, que puede pedir su retiro simulado con el mismo adaptador.

### Estados y salidas alternativas

| Situación | Copy |
| --- | --- |
| Sin crear | Acuerdo sin crear |
| Disputa abierta | En disputa con árbitro de demo |
| Resolución observada | Disputa resuelta: verificando liquidación |
| Liquidación confirmada | Liquidación completada: revisá el cobro y la devolución |
| Cobro completo | Pago al vendedor |
| Devolución completa | Devolución total al comprador |
| Reparto | Pago al vendedor y devolución al comprador |
| Cancelación sin fondos | Acuerdo cancelado sin movimiento de fondos |
| Propuesta de devolución | Proponer devolución al comprador |
| Aceptación de devolución | Confirmar devolución al comprador |
| Desacuerdo | Abrir disputa de demo |
| Vencimiento sin disputa | Pedir devolución por plazo vencido |

El consumidor debe mostrar importes confirmados separados: asignado al vendedor, costo del servicio, neto del vendedor y devolución al comprador. `getSettlementLabel` sólo elige el título, no calcula esos valores ni verifica conservación. Para un ejemplo de $120.000 con cobro total, el costo es $1.200 y el vendedor recibe $118.800; con devolución total, el comprador recupera $120.000 y el costo es cero. La regla del motor es `fee = floor(toBeneficiary * 100 / 10_000)` en sus unidades mínimas. No redondear primero a centavos: conservar precisión en la integración y definir su presentación al reconciliar el ledger.

### Espera, fallo y recuperación para quien integre las pantallas

- Carga pendiente: “Tu carga de demo está pendiente. Todavía no sumamos saldo.”
- Carga rechazada: “La carga de demo fue rechazada. Podés volver a intentarlo.”
- Movimiento pendiente: “Estamos esperando la confirmación. Revisá el estado antes de volver a intentar.”
- Movimiento fallido: “El movimiento no se confirmó. Revisá el comprobante y el saldo antes de reintentar.”
- Saldo insuficiente: “Te falta saldo disponible para cubrir el importe acordado.”
- Actor incorrecto: “Esta acción le corresponde a la otra parte del acuerdo.”
- Condiciones distintas: “Las condiciones no coinciden con el acuerdo. No aceptes y pedí un enlace válido.”
- Retiro pendiente: “Tu retiro de demo está pendiente. Ese importe ya no está disponible para otro retiro.”
- Retiro rechazado: “El retiro de demo fue rechazado. Revisá el saldo disponible antes de reintentar.”
- Retiro confirmado: “Retiro de demo completado. No se realizó una transferencia bancaria real.”

Al reabrir el enlace, recuperar estado, propuesta vigente, importes y permisos desde sus fuentes verificadas. Nunca inferir entrega o pago a partir de la URL.

## Términos B por defecto

El vendedor propone la venta de la entrada y el comprador acepta las condiciones y aporta el importe acordado. El vendedor entrega la entrada por el medio y dentro del plazo pactados. Después propone el cobro. El comprador revisa la entrega y confirma la propuesta sólo si está de acuerdo: esa confirmación libera el importe al vendedor, descontando el costo del servicio. La entrega por sí sola no libera fondos. Una devolución o un reparto requieren la aceptación de la otra parte, el vencimiento aplicable o una resolución del árbitro de demo.

ContractAR no certifica la autenticidad de la entrada ni garantiza el acceso al evento.

Demo: las cargas y los retiros son simulados. No se realizan transferencias bancarias reales.

El costo del servicio es del 1% sobre la parte asignada a quien cobra; las devoluciones no tienen ese costo. Revisá el importe, las partes, los plazos y las condiciones antes de aceptar. Las condiciones aceptadas no se cambian desde el enlace.

Las disputas las resuelve un árbitro de demo. Abrir una disputa mantiene los fondos retenidos hasta su resolución.

Si vence el plazo de revisión y no hay una disputa abierta, quien puso los fondos puede pedir su devolución. El vencimiento no ejecuta movimientos automáticamente.

El consumidor debe conservar los avisos obligatorios al editar condiciones y ligar el texto final al hash del acuerdo antes de aceptar. Los tests garantizan su presencia en los valores por defecto, no validan términos arbitrarios enviados a la API.

## Verificación y límites de entrega

Comando: `pnpm --filter @contractar/web exec vitest run src/lib/templates/index.test.ts`.

Resultado local: 18 tests aprobados en Vitest; `tsc --noEmit --incremental false` aprobado. ESLint no pudo iniciar porque la configuración existente importa `@eslint/eslintrc`, que no está disponible como dependencia resoluble. No se cambian dependencias ni configuración por la restricción de alcance.

Las pruebas locales cubren el contrato de datos de las plantillas, actores del recorrido feliz, catálogo de transiciones, enteros seguros, avisos obligatorios y títulos de liquidación. B-02 completo requiere ejecutar los tests de conservación y autorizaciones del motor con acuerdos Sale. B-01/P-04 completos requieren integración de pantallas, pagos y comprobantes confirmados; esta entrega aislada no los declara aprobados.

Revisión de copy: PASS, CTAs concretos, castellano rioplatense, montos ARS, avisos de demo y autenticidad, sin jerga técnica en textos para usuarios. No se construyó interfaz visual en esta tarea.

Memoria para el ejecutor: integrar el registro sin duplicar estados de fondos, aplicar permisos y plazos reales, conservar los avisos al guardar términos y usar el resultado confirmado para B-03. La publicación en el cerebro y su bitácora queda a cargo del ejecutor: este hijo tiene autorización de escritura sólo en templates y este documento, con commits locales sin push.
