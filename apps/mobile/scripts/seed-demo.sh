#!/usr/bin/env bash
# Seed de datos para la demo de ContractAR.
# Deja al usuario `juan` (login con ese nombre) con saldo cargado y acuerdos
# en todos los estados clave: Created, Funded, OutcomeProposed, Settled,
# Disputed. Todo por HTTP contra el server real — el contrato Nano en Fuji
# asienta cada paso y los txHashes quedan en el comprobante.
#
# Uso:  API_URL=http://192.168.23.84:3000 ./scripts/seed-demo.sh
set -euo pipefail

API="${API_URL:-http://192.168.23.84:3000}"
JUAN=juan
BRUNO=cp-bruno   # counterpartyUserId("Bruno")
CARLA=cp-carla   # counterpartyUserId("Carla")
SEED=${SEED:-$(date +%s)}   # títulos únicos por corrida

req() { # req METHOD PATH JSON -> body
  curl -sf -X "$1" "$API$2" -H 'content-type: application/json' -d "$3"
}
get() { curl -sf "$API$1"; }
jqd() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }
idem() { echo "seed-$SEED-$1"; }

echo "== API: $API (seed $SEED)"

load() { # load USER CENTS — carga aprobada al instante
  local pid
  pid=$(req POST /api/payments/load "{\"userId\":\"$1\",\"amountARS\":$2,\"idempotencyKey\":\"$(idem "$1")\"}" | jqd "['paymentId']")
  req POST "/api/payments/$pid/resolve" '{"status":"approved"}' >/dev/null
  echo "   saldo +$(($2/100)) ARS -> $1"
}

create() { # create CREATOR BENEF DEPOSITOR CP_LABEL TEMPLATE TITLE TERMS CENTS -> id
  req POST /api/agreements "{
    \"userId\":\"$1\",\"creatorUserId\":\"$1\",
    \"beneficiaryUserId\":\"$2\",\"depositorUserId\":\"$3\",
    \"template\":$5,\"title\":\"$6\",\"terms\":\"$7\",
    \"counterpartyLabel\":\"$4\",
    \"parties\":{\"creatorLabel\":\"$1\",\"counterpartyLabel\":\"$4\"},
    \"amountARS\":$8,\"acceptDeadlineSec\":259200,\"reviewDeadlineSec\":604800,
    \"arbiterUserId\":\"arbiter-demo\"}" | jqd ".get('agreementId') or d.get('id')"
}

act() { # act AGREEMENT USER ACTION [EXTRA_JSON]
  local extra="${4:-}"
  req POST "/api/agreements/$1/action" "{\"action\":\"$3\",\"userId\":\"$2\"$extra}" >/dev/null
  echo "   $3 ($2) -> $1"
}

echo "== Saldos"
load "$JUAN"  100000000
load "$BRUNO" 100000000
load "$CARLA" 100000000

echo "== 1) Created — esperando aceptación (muestra compartir)"
A1=$(create "$JUAN" "$JUAN" "$BRUNO" "Bruno" 0 "Garantía moto — Twister 2020 ($SEED)" "Garantía por alquiler de la moto. Se devuelve si se entrega sin daños." 45000000)
echo "   $A1"

echo "== 2) Funded — fondos protegidos, listo para proponer cierre"
A2=$(create "$JUAN" "$JUAN" "$BRUNO" "Bruno" 1 "Entrada recital — platea baja ($SEED)" "Entrada numerada transferida al retirar el QR. Reintegro si no se valida en puerta." 9500000)
act "$A2" "$BRUNO" accept
act "$A2" "$BRUNO" fund
echo "   $A2"

echo "== 3) OutcomeProposed — Carla ya propuso; juan sólo acepta"
A3=$(create "$CARLA" "$CARLA" "$JUAN" "Juan" 0 "Garantía depto — Palermo ($SEED)" "Garantía mensual. Se libera contra entrega de llaves y lectura de medidores." 32000000)
act "$A3" "$JUAN" accept
act "$A3" "$JUAN" fund
act "$A3" "$CARLA" proposeOutcome ',"toBeneficiaryARS":25600000,"toDepositorARS":6400000'
echo "   $A3  (propone: 80% Carla / 20% juan — queda el reparto por aceptar)"

echo "== 4) Settled — ciclo completo con recibo y comprobante on-chain"
A4=$(create "$JUAN" "$JUAN" "$BRUNO" "Bruno" 0 "Garantía auto — Focus 2019 ($SEED)" "Garantía por uso del auto el finde. Revisión de 3 días ante rayones o multas." 60000000)
act "$A4" "$BRUNO" accept
act "$A4" "$BRUNO" fund
act "$A4" "$JUAN"  proposeOutcome ',"toBeneficiaryARS":18000000,"toDepositorARS":42000000'
act "$A4" "$BRUNO" acceptOutcome
echo "   $A4"

echo "== 5) Disputed — reclamo abierto, espera al árbitro"
A5=$(create "$JUAN" "$JUAN" "$CARLA" "Carla" 1 "Entrada festival — campo VIP ($SEED)" "Dos pulseras VIP, entrega en mano el día del evento." 14000000)
act "$A5" "$CARLA" accept
act "$A5" "$CARLA" fund
act "$A5" "$JUAN"  dispute
echo "   $A5"

echo
echo "== Listo. Login como 'juan' muestra:"
get "/api/agreements?userId=$JUAN" | python3 -c "
import json,sys
for a in json.load(sys.stdin)['agreements']:
    print(f'   {a[\"state\"]:<16} {a[\"title\"][:44]}')"
