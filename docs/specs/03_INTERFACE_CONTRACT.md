---
project: escrow-argt
author: devin-swe2 (para korita)
date: 2026-11-07
status: proposed
---

# Contrato de interfaces — propuesta (congelar en F1, Nano confirma)

#project/escrow-argt #status/proposed

Firmas candidatas. Si Nano publica `feat/contracts` con ABI distinta y sana, **prevalece la suya** y se reetiquetan los adaptadores.

## 1. `contracts/` (Solidity ^0.8.24, evm_version cancun)

### `MockARGt.sol` — ERC-20 18 decimales
```solidity
function mint(address to, uint256 amount) external;      // sólo owner de demo
function decimals() external pure returns (uint8);       // 18
// ERC-20 estándar: approve/transfer/transferFrom/balanceOf/allowance
```

### `Escrow.sol`
```solidity
enum State { None, Created, Accepted, Funded, OutcomeProposed, Disputed, Settled, Cancelled, Resolved }
enum Template { Guarantee, Sale }

struct Agreement {
  Template template; State state;
  address creator; address depositor; address beneficiary; address arbiter;
  uint256 deposit; uint256 remaining;
  bytes32 termsHash;
  uint40 acceptDeadline; uint40 reviewDeadline;
  address outcomeProposer; uint256 proposedToBeneficiary;
  uint256 disputeId;
}

function create(Template, address depositor, address beneficiary, address arbiter,
                uint256 deposit, bytes32 termsHash, uint40 acceptDeadline, uint40 reviewDeadline)
    external returns (uint256 id);
function accept(uint256 id) external;
function cancel(uint256 id) external;
function fund(uint256 id) external;                       // transferFrom(depositor, deposit)
function proposeOutcome(uint256 id, uint256 toBeneficiary) external;
function acceptOutcome(uint256 id) external;
function dispute(uint256 id) external returns (uint256 disputeId);
function rule(uint256 id, uint256 toBeneficiary, uint256 toDepositor) external; // sólo arbiter
function refundAfterTimeout(uint256 id) external;
function agreements(uint256 id) external view returns (Agreement memory);

event AgreementCreated(uint256 indexed id, Template, address depositor, address beneficiary, uint256 deposit, bytes32 termsHash);
event Accepted(uint256 indexed id); event Funded(uint256 indexed id, uint256 amount);
event OutcomeProposed(uint256 indexed id, address proposer, uint256 toBeneficiary);
event Dispute(uint256 indexed id, uint256 indexed disputeId);
event Ruling(uint256 indexed disputeId, uint8 ruling);
event Settled(uint256 indexed id, uint256 toBeneficiary, uint256 fee, uint256 toDepositor);
event Cancelled(uint256 indexed id);
```

Reglas clave: `fund` exige `ACCEPTED`; outcomes válidos `toBeneficiary <= remaining`; `acceptOutcome` sólo por la parte que **no** propuso; `rule` exige `msg.sender == arbiter` y `toBeneficiary + toDepositor == remaining`; `fee = floor(toBeneficiary*100/10_000)` a `treasury` fijada en constructor.

## 2. `shared/` (publicado por fondos, consumido por interfaz)

```
shared/abi/{Escrow,MockARGt,MockArbitrator}.json
shared/addresses.json        { chainId:43113, escrow, token, treasury, deployedAt, sha }
shared/types.ts              Agreement, State, Template, Party, ActionAvailability
shared/errors.ts             mapa revert→texto castellano (consumido por H2)
```

## 3. `apps/web/app/api/` — capa simulada (etiquetada «Demo»)

### Mock MP adapter (`/api/payments`)
| Endpoint | Semántica |
|---|---|
| `POST /api/payments/load` | `{userId, amountARS, idempotencyKey}` → `{paymentId, status:pending}`; resolución simulada `approved/rejected` por endpoint de control |
| `POST /api/payments/:id/resolve` | simula callback `{approved|rejected}` — idempotente; duplicado no reacredita |
| `POST /api/payments/withdraw` | `{userId, amountARS, idempotencyKey}` → una sola ejecución sobre saldo disponible liberado |
| `GET /api/payments/:id` | estado real del registro |

### Ledger (`/api/ledger`)
`GET /api/ledger/:userId` → `{available, inEscrow, withdrawing}` en centavos ARS enteros. Cada movimiento guarda `kind, amount, ref, idempotencyKey, txHash?`.

### Operador demo (`/api/operator`)
Cuentas efímeras testnet por usuario (`GET /api/operator/:userId` → `{address}`); firma server-side `mint`/`approve`/`fund`/`proposeOutcome`/`acceptOutcome`/`dispute`/`rule` con la clave del rol; devuelve `{txHash}` real. Nunca expone claves. Etiquetado «operador de demo» en UI.

### Metadata (`/api/agreements`)
`POST` guarda JSON canónico → devuelve `termsHash`; `GET /:id` devuelve metadatos + hash verificado contra `AgreementCreated`. Sin datos sensibles; el enlace público no autentica permisos.

## 4. Fronteras de confianza (declaradas en UI)

- Mock MP **no** es prueba onchain: `fund` sólo se habilita tras mint+approve+`fund` con receipt verificado.
- `1 tARGt = 1 ARS` es convención de demo, no cotización.
- Retiro completado una sola vez y sólo sobre `available` liberado — nunca sobre `inEscrow`.
- El panel técnico lista direcciones Fuji y hashes; los estados financieros provienen del contrato, no del ledger.
