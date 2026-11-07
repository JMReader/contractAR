#!/usr/bin/env bash
# Smoke READ-ONLY contra Fuji: sólo eth_call, no firma ni gasta gas.
# Lee las direcciones de shared/addresses.json (autoridad: deploy de Nano).
set -euo pipefail

export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC="${NEXT_PUBLIC_FUJI_RPC:-https://api.avax-test.network/ext/bc/C/rpc}"
ESCROW="$(node -p "require('./shared/addresses.json').escrow")"
TOKEN="$(node -p "require('./shared/addresses.json').token")"
ARBITRATOR="$(node -p "require('./shared/addresses.json').arbitrator")"
TREASURY="$(node -p "require('./shared/addresses.json').treasury")"

echo "RPC:        $RPC"
echo "Escrow:     $ESCROW"
echo "Token:      $TOKEN"
echo "Arbitrator: $ARBITRATOR"
echo "Treasury:   $TREASURY"

echo; echo "== Escrow =="
echo -n "token()          = "; cast call "$ESCROW" "token()(address)" --rpc-url "$RPC"
echo -n "treasury()       = "; cast call "$ESCROW" "treasury()(address)" --rpc-url "$RPC"
echo -n "FEE_BPS()        = "; cast call "$ESCROW" "FEE_BPS()(uint256)" --rpc-url "$RPC"
echo -n "RULING_SPLIT()   = "; cast call "$ESCROW" "RULING_SPLIT()(uint8)" --rpc-url "$RPC"
echo -n "agreementCount() = "; cast call "$ESCROW" "agreementCount()(uint256)" --rpc-url "$RPC"
echo -n "disputeCount()   = "; cast call "$ESCROW" "disputeCount()(uint256)" --rpc-url "$RPC"

echo; echo "== MockARGt =="
echo -n "name()     = "; cast call "$TOKEN" "name()(string)" --rpc-url "$RPC"
echo -n "symbol()   = "; cast call "$TOKEN" "symbol()(string)" --rpc-url "$RPC"
echo -n "decimals() = "; cast call "$TOKEN" "decimals()(uint8)" --rpc-url "$RPC"
echo -n "owner()    = "; cast call "$TOKEN" "owner()(address)" --rpc-url "$RPC"

echo; echo "== MockArbitrator =="
echo -n "owner() = "; cast call "$ARBITRATOR" "owner()(address)" --rpc-url "$RPC"

# Acuerdos: agreements(id) devuelve el struct completo (state es el campo 2:
# 0=None 1=Created 2=Accepted 3=Funded 4=OutcomeProposed 5=Disputed 6=Settled
# 7=Cancelled 8=Resolved).
echo; echo "== Acuerdos =="
COUNT="$(cast call "$ESCROW" "agreementCount()(uint256)" --rpc-url "$RPC")"
if [ "${COUNT:-0}" -eq 0 ]; then
  echo "(sin acuerdos onchain todavía)"
else
  for id in $(seq 1 "$COUNT"); do
    echo "-- agreements($id):"
    cast call "$ESCROW" "agreements(uint256)(uint8,uint8,address,address,address,address,uint256,uint256,bytes32,uint40,uint40,address,uint256,uint256)" "$id" --rpc-url "$RPC"
  done
fi
