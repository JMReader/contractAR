#!/usr/bin/env bash
# Publica ABI y direcciones para el frontend a partir del ultimo broadcast de Fuji.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CHAIN_ID="${CHAIN_ID:-43113}"
RUN_JSON="contracts/broadcast/Deploy.s.sol/${CHAIN_ID}/run-latest.json"

if [[ ! -f "$RUN_JSON" ]]; then
  echo "No existe $RUN_JSON. Corré el deploy primero." >&2
  exit 1
fi

mkdir -p shared/abi

python3 - "$RUN_JSON" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    data = json.load(fh)

addresses = {}
for tx in data.get("transactions", []):
    name = tx.get("contractName")
    address = tx.get("contractAddress")
    if name and address:
        addresses[name] = address

print(json.dumps(addresses))
PY

export PATH="$PATH:$HOME/.foundry/bin"

forge inspect contracts/Escrow.sol:Escrow abi --json > shared/abi/Escrow.json
forge inspect contracts/MockARGt.sol:MockARGt abi --json > shared/abi/MockARGt.json

python3 - "$RUN_JSON" <<'PY'
import json
import sys
from datetime import datetime, timezone

with open(sys.argv[1], encoding="utf-8") as fh:
    data = json.load(fh)

addresses = {}
for tx in data.get("transactions", []):
    name = tx.get("contractName")
    address = tx.get("contractAddress")
    if name and address:
        addresses[name] = address

token = addresses.get("MockARGt")
escrow = addresses.get("Escrow")
if not token or not escrow:
    raise SystemExit("No se encontraron MockARGt/Escrow en el broadcast")

payload = {
    "chainId": 43113,
    "network": "avalanche-fuji",
    "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
    "explorer": "https://testnet.snowtrace.io",
    "escrow": escrow,
    "token": token,
    "tokenDecimals": 18,
    "deployedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source": "contracts/script/Deploy.s.sol",
}

with open("shared/addresses.json", "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")

print(json.dumps(payload, indent=2))
PY
