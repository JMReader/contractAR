#!/usr/bin/env bash
# ContractAR — entorno local completo: Anvil + deploy + Next dev.
# Uso: ./scripts/dev-local.sh   (Ctrl+C frena todo)
set -euo pipefail

export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Anvil (Fuji-fork local) en :8545 =="
anvil --port 8545 --chain-id 43113 --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT
sleep 1

echo "== Deploy MockARGt + Escrow =="
(cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast --silent)
cat shared/addresses.local.json

echo "== Next dev en :3000 =="
NEXT_PUBLIC_CHAIN_ID=43113 \
NEXT_PUBLIC_ESCROW_ADDRESS="$(node -p "require('./shared/addresses.local.json').escrow")" \
NEXT_PUBLIC_TOKEN_ADDRESS="$(node -p "require('./shared/addresses.local.json').token")" \
NEXT_PUBLIC_TREASURY_ADDRESS="$(node -p "require('./shared/addresses.local.json').treasury")" \
NEXT_PUBLIC_FUJI_RPC="http://127.0.0.1:8545" \
  pnpm --filter @contractar/web dev
