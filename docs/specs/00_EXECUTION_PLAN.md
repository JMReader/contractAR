---
project: escrow-argt
author: devin-swe2 (para korita)
date: 2026-11-07
status: proposed
---

# ContractAR — Plan de ejecución F0 (propuesta para aprobación)

#project/escrow-argt #implementation-plan #status/proposed

Adaptación del plan maestro del cerebro (`team/projects/escrow-argt/07_PLAN_EJECUTOR_DEVIN_SWE2.md`, cerebro @ `b8b1712`) al estado real inspeccionado. **Sin aprobación explícita no se implementa.**

## 0. Estado real verificado (SHAs)

| Fuente | SHA / estado | Observación |
|---|---|---|
| `JMReader/contractAR` origin/main | `c4fc7ec` | Sólo scaffolding: `apps/web/.gitkeep`, `contracts/.gitkeep`, `services/api/.gitkeep`, docs y 6 skills. **Cero código implementado.** |
| Cerebro `hackatwin-brain` | `b8b1712` | Sincronizado. Decisiones E-01..E-10 y alcance pesos-a-pesos vigentes. |
| `feat/contracts` (Nano) | **inexistente** | Sin ramas remotas adicionales ni PRs. `each_one/nanoo17` vacío. |
| Worktree local | `contractar-completo` @ `c4fc7ec`, limpio | Worktree de `/Users/korita/hackathons/hackatwin/contractAR`. |

## 1. Alcance aprobado a confirmar

Entrega solicitada: **A (garantía de auto) + B (compraventa de entradas)**, secuenciales con gate entre ellas, sobre el mismo motor. Incluye: condiciones aceptadas ligadas al acuerdo, carga/retiro de saldo en pesos simulados (Mock MP), conversión ARS↔tARGt mock, liquidación parcial, disputa con árbitro mock, landing con escena GPU/vgpu + fallback, UX pesos-a-pesos sin que el cliente aprenda wallets/gas. C (alquiler) y binario React Native quedan **posteriores**.

## 2. Capacidades reales del entorno

| Capacidad | Estado |
|---|---|
| Modelos `devin` | `swe-2-high/medium/max` + variantes; **no existe Orca** en `devin models list` |
| Delegación | `run_subagent` (perfiles `subagent_general`, `subagent_explore`), hasta 4 activos en paralelo, sin nietos |
| GitHub | `gh` como JMReader, scopes repo+workflow+project — push, PRs, issues, comentarios OK |
| Toolchain | node 24.19, pnpm 10.30.1, python 3.11; **sin Foundry** (instalar en F1 vía foundryup); RPC Fuji responde |
| Bitácora | `worklog.py doctor` → `ready:true`, issue hackatwin-brain#2 abierto |
| Octa | Repo público `Voyager-Ov/cerebro-propuesta/frontend`: Next 16.4.5, React 19.3, Tailwind v4, GSAP 3.15.1, three 0.187, blobatar 2.7 — inspeccionado, reutilizable selectivamente |

## 3. Arquitectura propuesta (resumen; detalle en `03_INTERFACE_CONTRACT.md`)

- **Onchain (Fuji 43113):** `MockARGt.sol` (ERC-20 18 dec, mint de demo), `Escrow.sol` (máquina de estados + fee 1% sobre porción del beneficiario + settle parcial + disputa ERC-792 con árbitro mock), `MockArbitrator.sol`.
- **Offchain (`apps/web`, Next.js API routes):** ledger ARS simulado (SQLite `better-sqlite3`), adaptador Mock MP con idempotency keys, servicio operador que custodia **claves efímeras de testnet por usuario demo** y firma `approve`/`fund`/`settle` en nombre del rol asignado. Panel técnico muestra direcciones y hashes reales de Fuji.
- **Frontend:** Next.js 16 mobile first, identidad oscura `#101317` + cobalt `#0047FF` (tokens de DESIGN.md/propuesta-identidad), 7 vistas + saldo/carga/retiro, landing con escena Canvas/WebGPU diferida y fallback estático.
- **Reconciliación:** `1 tARGt = 1 ARS` sólo convención demo; ledger ARS (disponible/en escrow/retirando) jamás debita dos veces ni permite retirar saldo bloqueado; callbacks del mock no son prueba onchain — se exige receipt real antes de habilitar fondos.
- **Directriz UX (korita, 07/11):** el token **no es protagonista** — la experiencia debe sentirse sencilla "por atrás" para quien la ve. Toda la superficie habla en pesos y lenguaje cotidiano ("cargaste", "quedó protegido", "te llegó"); token, direcciones, red y hashes sólo aparecen en el panel técnico colapsable "Ver comprobante". Esto refuerza D3 (operador demo custodiado) y el copy de todas las vistas.

## 4. Reparto de trabajo (hijos Devin, máx. 4 activos)

| Hijo | Propiedad | Entrega |
|---|---|---|
| H1 Fondos | `contracts/`, `shared/abi` (coordinado con Nano: su propiedad se ejerce vía revisión de PR; ver decisión D1) | Token, escrow, árbitro mock, tests Foundry unit+fuzz+invariantes |
| H2 Interfaz | `apps/web/app/**`, `apps/web/components/**` | 7 vistas + saldo/carga/retiro, tokens de diseño, estados accesibles |
| H3 Integración | `apps/web/lib/{chain,payments,ledger,operator}/**`, `apps/web/app/api/**` | Tipos/viem, Mock MP, operador signer, reconciliación, metadata+termsHash |
| H4 QA+Landing | `apps/web/e2e/**`, `apps/web/components/landing/**`, `docs/demo/**` | E2E Playwright, landing GPU/fallback, mediciones, guion |

Principal: specs congeladas, `package.json`/lockfiles/workspace, integración por dependencia, reportes. Conflictos de archivos: un solo escritor por archivo a la vez.

## 5. Fases y gates

| Fase | Contenido | Gate |
|---|---|---|
| F0 | Este plan, specs, status.json, reporte cerebro#2 | **Aprobación explícita** |
| F1 | Workspace pnpm, Next.js base, Foundry instalado, `foundry.toml`, spec congelada, `shared/` esqueleto, harness vitest+playwright | build/typecheck/test verdes, sin secretos |
| F2 | Contratos+tests (H1), vistas A con fixtures (H2), adapter+mock MP+operador (H3), tests adversariales (H4) | M2/M3 verdes; fixtures nunca como recibos Fuji |
| F3 | E2E local completo (Anvil): A-01..A-09, P-01..P-03, P-05, P-06 | Todos los casos A+P locales, sin bugs altos |
| F4 | Fuji (sólo con autorización) + landing GPU + calidad visual/accesibilidad | A-01..A-09 objetivo; evidencia Fuji si autorizada; fallback probado |
| F5 | Cierre gate A: métricas, release report, guion demo, PR revisión | M1–M16 con evidencia o limitación expresa |
| F6 | **B obligatoria**: plantilla entradas sobre el mismo motor + P-04 | Casos B+P-04 verdes, regresión A |
| F7+ | C, React Native — posteriores, requieren aprobación nueva | — |

## 6. Decisiones pendientes (tabla para aprobación conjunta)

| # | Decisión | Recomendación | Bloquea |
|---|---|---|---|
| D1 | Propiedad de contratos: Nano sin commits remotos | Spec congelada por el principal; si Nano no publica `feat/contracts` antes del gate F1, H1 implementa en rama propia y Nano revisa el PR — sin pisar su trabajo, sin bloquear el calendario | F2 contratos |
| D2 | Hijos "Orca" no existen en este Devin | Usar `run_subagent` (`subagent_general`) como hijos Devin: mismas reglas (worktree, brief, sin publicar, máx. 4) | Reparto general |
| D3 | Abstracción wallet pesos-a-pesos | Cuentas demo efímeras custodiadas en el servicio (server-side signer, sólo testnet); MetaMask queda como modo operador/técnico, no como onboarding del cliente | F2/F3 UX de dinero |
| D4 | Backend: `services/api` FastAPI vs Next API routes | Consolidar MVP en `apps/web/app/api/**` (SQLite embebido): menos piezas para demo; `services/api` queda para futuro | F1 estructura |
| D5 | Fee | `fee = floor(toBeneficiary*100/10000)`; tesorería fija en deploy; cobro dentro de `settle`/`rule`; devoluciones sin fee | Spec fondos |
| D6 | Liquidación terminal | `toBeneficiary + toDepositor == deposit` exacto, sin residuos; parciales sucesivos como outcomes sobre saldo restante contabilizado | Spec fondos |
| D7 | Consentimiento liquidación parcial | `proposeOutcome` + `acceptOutcome` onchain (2 txs auditables), sin firmas offchain en MVP | Spec fondos |
| D8 | Vencimientos | Segundos desde creación por acuerdo (`acceptDeadline`, `reviewDeadline`); nadie autoejecuta: `cancelExpired`/`refundAfterTimeout` invocables por la parte favorecida | Spec fondos |
| D9 | Árbitro mock | Dirección de árbitro por acuerdo; `dispute()` congela; `rule(split)` sólo árbitro; interfaz mínima estilo ERC-792 (`Dispute`/`Ruling` events) sin prometer Kleros | Spec fondos |
| D10 | Metadatos y enlace | `termsHash` onchain; JSON canónico en API; UI verifica hash antes de aceptar; sin datos sensibles | F2 |
| D11 | Despliegue Fuji y publicación web | Preparar todo; ejecutar sólo con autorización + cuenta deployer con AVAX de faucet | F4 |
| D12 | React Native | **No** prometer binario: documentar como objetivo de producto con dominio compartido | Declaración |
| D13 | Rebill sandbox | Descartar (mock MP propio cubre P-01..P-03); reabrir sólo si el jurado lo pide | — |
| D14 | Issues/backlogs del repo (freelance/seña) | Actualizar en F1 a plantillas auto/entrada según alcance vigente | housekeeping |

## 7. Estimación y riesgos (supuestos, no promesa)

Contexto: hackatón con entrega ~18:00 y demo ~19:00 del 07/11. Supongo ~3–3,5 h de build efectiva desde la aprobación, 4 hijos en paralelo en F2/F4.

| Tramo | Estimación | Supuestos |
|---|---|---|
| F1 base | 30–45 min | foundryup y npm install sin fricción |
| F2 dominio+pantallas | 60–90 min | spec congelada aceptada sin iteración |
| F3 E2E local | 30–45 min | Anvil estable; debugging acotado |
| F4 Fuji+landing | 45–60 min | autorización y AVAX faucet disponibles; vgpu o Canvas fallback |
| F5 gate A | 20–30 min | evidencias ya recolectadas |
| F6 B | 40–60 min | mismo motor, reutilización alta |

**Riesgos:** (1) Fuji/faucet sin credenciales a tiempo → se reporta "gate testnet pendiente", demo sobre Anvil con evidencia local verificable; (2) Nano publica contratos tarde con ABI distinta → se adopta la suya si está sana, reetiquetando adaptadores; (3) vgpu no madura en tiempo → fallback Canvas 2D/CSS de la propuesta HTML (movimiento real, no estático) cumpliendo el mínimo; (4) tiempo insuficiente para B completa → B-lite documentada con el mismo motor y gate explícito, nunca declarada como entregada si no lo está; (5) nunca se recorta seguridad, honestidad de estados ni reportes.
