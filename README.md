# contractAR

Pagos protegidos para acuerdos cotidianos: las partes aceptan reglas, bloquean un token ERC-20 de prueba y liberan, devuelven o disputan los fondos según el estado del acuerdo.

**Demo pesos-a-pesos:** el cliente opera en pesos sin ver wallets ni tokens. La carga y el retiro son **simulados** (Mock MP); el escrow registra operaciones reales en una red de pruebas (Avalanche Fuji o Anvil local). Nada de esto es dinero real.

## Estructura

- `apps/web/`: app Next.js 16 (mobile first). Incluye la capa de demo (`app/api/`: Mock MP, ledger ARS en SQLite, operador de testnet).
- `contracts/`: `MockARGt.sol` (ERC-20 18 dec), `Escrow.sol` (máquina de estados), tests Foundry.
- `shared/`: tipos de dominio, mapa de errores, ABI y `addresses.json` generado por deploy.
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

El script levanta Anvil (chain-id 43113), despliega `MockARGt` + `Escrow` con la cuenta por defecto de Anvil, escribe `shared/addresses.json` y arranca Next con las direcciones configuradas.

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
