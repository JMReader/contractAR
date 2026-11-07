# Contratos — ContractAR

Escrow de pagos protegidos con un ERC-20 de prueba (`tARGt`) en Avalanche Fuji.

## Requisitos

- [Foundry](https://getfoundry.sh) (`forge`, `cast`).
- Una wallet de demo con AVAX de testnet para el deploy.

## Tests

```bash
forge test -vv
```

Casos cubiertos: fondeo, release con fee, refund, settle parcial 30/70, doble release,
permisos, disputa + resolución, cancelación, reentrancy y suma inválida en settle.
También se prueba un token de 6 decimales para verificar que no se asume 18.

## Variables de entorno

Crear `.env` (ignorado por git) a partir de `.env.example`:

| Variable | Obligatoria | Uso |
|---|---|---|
| `PRIVATE_KEY` | sí | Wallet de demo que firma el deploy. Nunca commitear. |
| `TREASURY_ADDRESS` | no | Tesorería; por defecto el deployer. |
| `ARBITER_ADDRESS` | no | Árbitro mock; por defecto el deployer. |
| `TOKEN_ADDRESS` | sí (fondeo) | MockARGt desplegado. |
| `ESCROW_ADDRESS` | sí (fondeo) | Escrow desplegado. |
| `DEMO_RECIPIENT` | no | Wallet que recibe el mint; por defecto el deployer. |
| `DEMO_MINT_AMOUNT` | no | Unidades mínimas; por defecto `1000000e18`. |

Cargar las variables en la shell:

```bash
set -a && source .env && set +a
```

## Deploy en Fuji

```bash
forge script contracts/script/Deploy.s.sol:Deploy \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast
```

Luego publicar ABI y direcciones:

```bash
contracts/script/publish.sh
```

Genera `shared/abi/Escrow.json`, `shared/abi/MockARGt.json` y `shared/addresses.json`.

## Verificación

Con una API key de Etherscan/Snowtrace en `ETHERSCAN_API_KEY`:

```bash
forge verify-contract <ESCROW_ADDRESS> contracts/Escrow.sol:Escrow \
  --chain 43113 \
  --verifier etherscan \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

forge verify-contract <TOKEN_ADDRESS> contracts/MockARGt.sol:MockARGt \
  --chain 43113 \
  --verifier etherscan \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Si el verificador rechaza la chain 43113, usar la URL multichain de Etherscan V2:
`--verifier-url "https://api.etherscan.io/v2/api?chainid=43113"`.

## Fondeo de wallets de demo

```bash
TOKEN_ADDRESS=<token> ESCROW_ADDRESS=<escrow> \
  forge script contracts/script/FundDemo.s.sol:FundDemo \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast
```

Mintea `tARGt` y aprueba el escrow para la wallet indicada.

## Reglas de negocio

- Fee de 1% (`feeBps = 100`) sólo sobre la porción que recibe el beneficiario.
- Devoluciones sin fee.
- `settle(toPayee, toPayer)` permite reclamo parcial; el remanente no asignado vuelve al pagador.
- El `deadline` es informativo: no dispara liberaciones automáticas.
- El árbitro del MVP es una dirección mock; ERC-792/Kleros real queda fuera de alcance.
