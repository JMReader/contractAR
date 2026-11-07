# contractAR

Pagos protegidos para acuerdos cotidianos: las partes aceptan reglas, bloquean un token ERC-20 de prueba y liberan, devuelven o disputan los fondos según el estado del acuerdo.

**Demo pesos-a-pesos:** el cliente opera en pesos sin ver wallets ni tokens. La carga y el retiro son **simulados** (Mock MP); el escrow registra operaciones reales en una red de pruebas (Avalanche Fuji o Anvil local). Nada de esto es dinero real.

## Estructura

- `apps/web/`: app Next.js 16 (mobile first). Incluye la capa de demo (`app/api/`: Mock MP, ledger ARS en SQLite, operador de testnet).
- `contracts/`: `MockARGt.sol` (ERC-20 18 dec), `Escrow.sol` (máquina de estados), tests Foundry.
- `shared/`: tipos de dominio, mapa de errores, ABI y `addresses.json` (autoridad Fuji; los deploys locales generan `addresses.local.json`).
- `docs/specs/`: plan de ejecución, matriz de aceptación, máquina de estados de fondos, contrato de interfaces.
- `services/api/`: reservado para backend futuro (el MVP usa `apps/web/app/api`).

## Requisitos

- Node 24, pnpm 10
- Foundry (`forge`, `cast`, `anvil`) vía `foundryup`
- Git

## Levantar en local (demo completa)

```bash
pnpm install
./scripts/dev-local.sh   # anvil → deploy → next dev en http://localhost:3000
```

El script levanta Anvil (chain-id 43113), despliega `MockARGt` + `Escrow` con la cuenta por defecto de Anvil, escribe `shared/addresses.local.json` y arranca Next con las direcciones configuradas.

## Modo Fuji (testnet)

Los contratos están deployados y verificados en Avalanche Fuji (deploy de Nano; `shared/addresses.json` es la autoridad — **no se pisa**: los deploys locales escriben `shared/addresses.local.json`):

| Contrato | Dirección |
|---|---|
| Escrow | `0x48716Fe685f1c9Cb85Bc53B7e980685336b2261C` |
| MockARGt (tARGt) | `0x380Ef72aAd020e5C47e8117a6291D1397D174a86` |
| MockArbitrator | `0xC5bf825358E3b1355bFb81F6d26d780f793e32Bb` |
| Treasury / deployer | `0x6745CB1aE8673BA4966b324d6FF4aCCD8510C2A4` |

Verificado: `RULING_SPLIT()=2`, `FEE_BPS()=100`, `token()`/`treasury()` coinciden; `owner()` del token y del árbitro es el deployer de Nano. Ya hay un loop A ejecutado onchain (acuerdo #1 en `Settled`).

**Smoke read-only** (sólo `eth_call`, no firma ni gasta gas):

```bash
./scripts/smoke-fuji.sh
```

**Para correr la app contra Fuji**, copiá las `NEXT_PUBLIC_*` del bloque Fuji de `.env.example` a tu `.env.local`.

### Escritura en Fuji — pendiente de coordinación

El modo escritura funciona hoy sólo contra Anvil. Para Fuji falta (issue #11, respuestas de Nano):

- **Clave operador**: Nano no comparte privadas. Le pasamos una **dirección pública** y ellos la fondean con AVAX testnet + le transfieren la ownership del `MockArbitrator`. Configurarla como `DEMO_FUNDER_KEY` (gas de cuentas efímeras vía `ensureGas`).
- **Mint de tARGt**: `MockARGt.mint` es `onlyOwner` y `owner()` es la cuenta de Nano. El escrow tiene `token` inmutable (`0x380E…`), así que o Nano transfiere también la ownership del token a nuestro operador, o mintea para las cuentas demo. Alternativa de Nano: redeploy propio de la instancia completa.
- **Árbitro por acuerdo**: nuestro `create` fija `arbiter` a la cuenta efímera del árbitro demo — funciona en Fuji sin más. El `MockArbitrator` (`0xC5bf…`) sólo hace falta si se quiere el forwarder ERC-792 (sus fallos los firma su owner).
- **Timeouts con enforce onchain** (confirmado en #11): `acceptDeadline`→`cancelExpired` (creator/depositor, en `Created` vencido), `reviewDeadline`→`refundAfterTimeout` (depositor, en `Funded`/`OutcomeProposed` vencido). Sin cambios pendientes en contrato.

## Verificación

```bash
pnpm typecheck          # tipos
pnpm --filter @contractar/web lint
pnpm --filter @contractar/web build
pnpm --filter @contractar/web test      # vitest (capa simulada)
pnpm contracts:test                     # forge test (unit + fuzz + invariantes)
pnpm test:e2e                           # playwright
```

## Variables de entorno

Ver `.env.example`. Nunca commitear `.env` ni claves reales. El operador de demo guarda claves efímeras de testnet en `apps/web/data/` (gitignored).

## Trabajo del equipo

Board: [Issue #1](https://github.com/JMReader/contractAR/issues/1). Cada entrega enlaza un issue y una PR. Specs y reglas de dinero en `docs/specs/`.
