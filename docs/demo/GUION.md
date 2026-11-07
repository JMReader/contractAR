---
project: escrow-argt
author: h4-qa-landing (devin)
date: 2026-11-07
status: draft
---

# Guion de demo — ContractAR (≤ 3 min)

#project/escrow-argt #status/draft

Demo pesos-a-pesos del caso A (garantía de auto) sobre el flujo completo:
cargar → crear → aceptar → fondear → entrega → cierre → retirar.
Duración objetivo: **2:30–3:00** sin contar esperas de red. Ensayar antes de
mostrar; los tiempos de confirmación se narran, no se cuentan en el guion.

## Preparación (antes de empezar, no se muestra)

- `pnpm install` y `pnpm --filter @contractar/web dev` (o `build && start`).
- Una pestaña en la landing `/`, otra lista en `/acuerdos`.
- Datos de ejemplo decididos: rentadora "Ana" / cliente "Bruno", garantía
  **$ 600.000**, plazo de devolución 48 h.
- Si la corrida es local (Anvil): decirlo una sola vez al inicio —
  "las operaciones se registran en una red de pruebas"; si es Fuji, mostrar el
  hash real al final en el panel técnico.

## Escena 1 — Landing (0:00–0:20)

- Mostrar la home: titular, CTAs y la escultura ASCII moviéndose.
- Decir: *"ContractAR deja la plata de un acuerdo en garantía hasta que se
  cumpla lo pactado. En pesos, sin que nadie tenga que aprender cripto."*
- Entrar por **Crear un acuerdo**.

## Escena 2 — Cargar saldo (0:20–0:45)

- Ir a saldo → **Cargar pesos**, monto $ 600.000, confirmar.
- Mostrar el estado del pago simulado (pendiente → aprobado) y el saldo
  disponible actualizado una sola vez.
- Frase: *"La carga y el retiro de pesos están simulados — es el equivalente al
  pago por Mercado Pago que tendría el producto real."*

## Escena 3 — Crear el acuerdo de auto (0:45–1:15)

- **Crear un acuerdo** → plantilla *Garantía de auto*.
- Completar: partes (rentadora/cliente), monto $ 600.000, condiciones
  ("devolución tras inspección del auto", plazo 48 h).
- Revisar el resumen → compartir el enlace.

## Escena 4 — Aceptación de la contraparte (1:15–1:40)

- Abrir el enlace "como cliente" (segunda pestaña o modo contraparte).
- El cliente lee las mismas condiciones, tilda el consentimiento explícito y
  **acepta**.
- Frase: *"Las dos partes ven lo mismo; nadie acepta a ciegas."*

## Escena 5 — Fondear (1:40–2:05)

- El cliente **deposita la garantía**: la ficha muestra monto, activo y costo
  conocidos antes de confirmar.
- Esperar la confirmación: estado `Fondos protegidos` visible para ambos.
- Si hay hash real (Fuji): abrir **Ver comprobante** y mostrarlo un segundo.

## Escena 6 — Entrega y cierre (2:05–2:40)

Elegir UNO según el tiempo (el de arriba es el camino feliz):

1. **Devolución total:** el auto vuelve bien → la rentadora confirma → la
   garantía vuelve entera al cliente. Frase: *"Sin reclamo, devolución
   completa, sin cargo."*
2. **Reclamo parcial:** la rentadora propone un reparto (p. ej. $ 180.000 por
   un rayón) → el cliente revisa y acepta → se libera $ 180.000 a la rentadora
   y vuelven $ 420.000 al cliente. Frase: *"El reparto lo acuerdan las partes;
   nadie liquida solo."*

## Escena 7 — Retiro (2:40–3:00)

- Ir a saldo → **Retirar** el monto liberado a pesos simulados.
- Mostrar que sólo el saldo disponible se puede retirar (lo protegido, no).
- Cierre: *"El mismo motor sirve para una entrada entre particulares — cambian
  los campos, no el recorrido."*

## Panel técnico (si preguntan o sobra tiempo)

En cada ficha, **Ver comprobante** muestra: dirección del escrow y del token en
la red de pruebas (Fuji), `termsHash` del acuerdo y hashes de las transacciones
reales (`create`, `accept`, `fund`, `settle`/`rule`). En la landing, el detalle
técnico declara con honestidad: la escena es **Canvas 2D** (funciona sin GPU,
se pausa fuera de pantalla y con pestaña oculta, y es estática con
`prefers-reduced-motion`); el sondeo WebGPU se informa pero no se usa — vgpu
queda como trabajo posterior.

## Qué NO decir

- No prometer dinero real, conversión bancaria ni autenticidad de entradas.
- No llamar "confirmado" a una firma: una firma no es un recibo.
- 1 tARGt = 1 ARS es convención de demo, no cotización.
