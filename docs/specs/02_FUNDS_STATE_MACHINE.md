---
project: escrow-argt
author: devin-swe2 (para korita)
date: 2026-11-07
status: proposed
---

# Máquina de estados de fondos — propuesta de spec (F1 a congelar con Nano)

#project/escrow-argt #status/proposed

Un solo motor para plantilla A (garantía) y B (compraventa): cambian roles, labels y quién inicia, no la máquina. Todos los montos en unidades mínimas del token (`uint256`, 18 decimales); **jamás float**.

## Roles (por acuerdo, fijados al crear)

| Rol | A (auto) | B (entrada) | Poderes |
|---|---|---|---|
| `creator` | rentadora | vendedor | crea, cancela antes de aceptar |
| `depositor` | cliente | comprador | acepta, fondea, recibe devoluciones |
| `beneficiary` | rentadora | vendedor | recibe porción neta en liquidaciones |
| `arbiter` | árbitro mock designado | ídem | `rule()` sobre disputa |
| `treasury` | plataforma (fija en deploy del escrow) | ídem | recibe fee, sin otros poderes |

En la capa de demo pesos-a-pesos, cada usuario tiene una cuenta efímera de testnet custodiada por el servicio operador; las llamadas onchain se firman con la clave del rol correspondiente — los permisos onchain siguen siendo reales.

## Estados

```
NONE → CREATED → ACCEPTED → FUNDED → SETTLED (terminal)
           ↓         ↑          │
        CANCELLED   │          ├─ OUTCOME_PROPOSED → (accept) → SETTLED
                    │          ├─ DISPUTED → RESOLVED → SETTLED
                    │          └─ EXPIRED → refund al depositor
                    └─ (acceptDeadline expira) → CANCELLED
```

- `OUTCOME_PROPOSED` y `DISPUTED` son subestados con fondos intactos: el depósito queda congelado hasta `acceptOutcome`, rechazo+repropuesta, `rule` o timeout.
- Terminales: `SETTLED`, `CANCELLED`. `SETTLED` registra `toBeneficiary`, `toDepositor`, `fee`.

## Transiciones y permisos

| Transición | Quién | Precondición | Efecto |
|---|---|---|---|
| `create` | cualquiera (queda `creator`) | términos, partes, plazos, `termsHash` | emite `AgreementCreated(id,…)` |
| `accept` | `depositor` | `CREATED`, antes de `acceptDeadline` | `ACCEPTED`; hash de términos mostrado debe coincidir |
| `cancel` | `creator` | `CREATED` o `ACCEPTED` sin fondos | `CANCELLED` |
| `cancelExpired` | `creator`/`depositor` | `CREATED` y `now>acceptDeadline` | `CANCELLED` |
| `fund` | `depositor` | `ACCEPTED`, `transferFrom` exacto = `deposit` | `FUNDED`; fondos custodiados |
| `proposeOutcome(toBeneficiary)` | `depositor` o `beneficiary` | `FUNDED` o `OUTCOME_PROPOSED` (repropone si la otra parte; invalida propuesta previa) | registra propuesta + proponente |
| `acceptOutcome` | la **otra** parte (no quien propuso) | `OUTCOME_PROPOSED` | `settle` con la propuesta vigente |
| `dispute` | `depositor` o `beneficiary` | `FUNDED`/`OUTCOME_PROPOSED` | `DISPUTED`, emite `Dispute(id)`; congela outcomes |
| `rule(toBeneficiary, toDepositor)` | `arbiter` | `DISPUTED`, suma == depósito restante | `settle` + `Ruling`; `RESOLVED→SETTLED` |
| `refundAfterTimeout` | `depositor` | `FUNDED`/`OUTCOME_PROPOSED`, `now>reviewDeadline`, sin disputa | `settle(0, deposit)` |

`settle(toBeneficiary, toDepositor)` interna: exige `toBeneficiary + toDepositor == remaining`; `fee = floor(toBeneficiary*FEE_BPS/10_000)` con `FEE_BPS=100`; transfiere `toBeneficiary-fee` al beneficiario, `fee` a `treasury`, `toDepositor` al depositante. Devoluciones sin fee. Una sola ejecución terminal por acuerdo.

## Decisiones de diseño (pendientes de aprobación, D5–D9)

- **Liquidación parcial iterativa:** si se aprueban outcomes parciales sucesivos, `remaining` se decrementa por liquidación ejecutada y el acuerdo sigue `FUNDED` hasta liquidar el total. Propuesta MVP: outcome parcial ejecuta split y **reabre** `FUNDED` con `remaining` actualizado — mismo mecanismo, contabilidad explícita.
- **Timeout:** segundos desde timestamps del bloque; `refundAfterTimeout` favorece al depositante en ambas plantillas (A: garantía se devuelve; B: comprador protegido si el vendedor desaparece). La beneficiaria debe actuar antes del deadline.
- **ERC-792 mock:** `event Dispute(uint256 disputeID)` en `dispute()`; `event Ruling(uint256 disputeID, uint8 ruling)` en `rule()`; `MockArbitrator` sólo puede llamarse desde la dirección `arbiter` del acuerdo. No se afirma integración Kleros.

## Invariantes (tests obligatorios)

1. `balance(escrow) >= Σ remaining` de acuerdos vivos.
2. Toda liquidación: `toBeneficiary + toDepositor == remaining` y `fee <= toBeneficiary`.
3. Ninguna transición mueve fondos fuera de `settle`/`rule`/`fund`.
4. Doble settle / settle post-terminal: revert.
5. Callback de árbitro ajeno, ruling con suma ≠ depósito, outcome propuesto por ambos: revert.
6. Reentrancy: `nonReentrant` + checks-effects-interactions + `SafeERC20`.
