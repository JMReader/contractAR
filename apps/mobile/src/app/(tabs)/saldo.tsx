// Tab Saldo: Disponible / En garantía / Retirando + cargar y retirar simulados.
// Mock MP: la carga/retiro quedan pendientes y se resuelven con "simular
// aprobado/rechazado" (es el callback del procesador, explícito en la demo).
// Banner persistente: la simulación se declara siempre.

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ApiError,
  getLedger,
  humanize,
  loadPayment,
  newIdempotencyKey,
  resolvePayment,
  withdrawPayment,
  type Ledger,
  type PaymentRef,
} from "../../lib/api";
import {
  clearPendingPay,
  clearUserId,
  getPendingPay,
  getUserId,
  setPendingPay,
} from "../../lib/session";
import { formatARS, parseARStoCents } from "../../lib/domain";
import { C, R } from "../../lib/theme";
import {
  Banner,
  Btn,
  Card,
  DemoTag,
  ErrorVista,
  Field,
  KV,
  Screen,
  SkeletonRows,
} from "../../components/ui";
import { IconEye, IconEyeOff } from "../../components/icons";
import { ConfirmSheet } from "../../components/confirm";

type MovKind = "load" | "withdraw";

export default function Saldo() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [ledger, setLedger] = useState<Ledger>();
  const [fase, setFase] = useState<"cargando" | "error" | "listo">("cargando");
  const [error, setError] = useState("");
  const [monto, setMonto] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendiente, setPendiente] = useState<(PaymentRef & { kind: MovKind; cents: number }) | null>(null);
  const [confirm, setConfirm] = useState<{ kind: MovKind; cents: number } | null>(null);
  const [oculto, setOculto] = useState(false);

  const montoOculto = "••••••";
  const m = (v: number) => (oculto ? montoOculto : formatARS(v));

  const recargar = useCallback(async (uid?: string) => {
    const id = uid || userId || (await getUserId());
    if (!id) {
      // Sin sesión no hay nada que cargar: al login, no colgar la pantalla.
      router.replace("/login");
      return;
    }
    setUserId(id);
    try {
      setLedger(await getLedger(id));
      setFase("listo");
      setError("");
      // Recupera un pago que haya quedado pendiente al cerrar la app.
      if (!pendiente) {
        const saved = await getPendingPay(id);
        if (saved)
          setPendiente({ paymentId: saved.paymentId, status: "pending", kind: saved.kind, cents: saved.cents });
      }
    } catch (e) {
      setFase("error");
      setError(e instanceof ApiError ? e.human : humanize(String(e)));
    }
  }, [userId, router]);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  const cents = parseARStoCents(monto);
  const retiroValido = cents !== null && ledger !== undefined && cents <= ledger.available;

  function pedir(kind: MovKind) {
    if (cents === null) {
      setAviso("Ingresá un monto en pesos, mayor a $ 0.");
      return;
    }
    if (kind === "withdraw" && !retiroValido) {
      setAviso(
        ledger && ledger.available > 0
          ? `Sólo podés retirar del saldo disponible (${formatARS(ledger.available)}). Lo protegido en acuerdos no se toca.`
          : "No tenés saldo disponible para retirar.",
      );
      return;
    }
    setAviso("");
    setConfirm({ kind, cents });
  }

  async function confirmar() {
    if (!confirm) return;
    setBusy(true);
    setAviso("");
    try {
      const p =
        confirm.kind === "load"
          ? await loadPayment(userId, confirm.cents, newIdempotencyKey())
          : await withdrawPayment(userId, confirm.cents, newIdempotencyKey());
      setConfirm(null);
      if (p.status === "pending") {
        setPendiente({ ...p, kind: confirm.kind, cents: confirm.cents });
        await setPendingPay(userId, { paymentId: p.paymentId, kind: confirm.kind, cents: confirm.cents });
      } else {
        setAviso(`El procesador resolvió la operación de una: ${p.status === "approved" ? "aprobada" : "rechazada"}.`);
      }
      await recargar();
    } catch (e) {
      setConfirm(null);
      setAviso(e instanceof ApiError ? e.human : humanize(String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function resolver(status: "approved" | "rejected") {
    if (!pendiente) return;
    setBusy(true);
    try {
      await resolvePayment(pendiente.paymentId, status);
      await clearPendingPay(userId);
      setPendiente(null);
      setMonto("");
      await recargar();
    } catch (e) {
      setAviso(e instanceof ApiError ? e.human : humanize(String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={st.headRow}>
        <Text style={st.h1}>Saldo</Text>
        <DemoTag texto="Simulación" />
      </View>
      <Banner texto="Demo: la carga y el retiro de pesos están simulados. No es dinero real ni Mercado Pago de verdad." />

      {fase === "cargando" && !ledger ? (
        <SkeletonRows filas={3} />
      ) : fase === "error" && !ledger ? (
        <ErrorVista titulo="No pudimos leer tu saldo" mensaje={error} onReintentar={() => recargar()} />
      ) : ledger ? (
        <>
          <Card style={st.balances}>
            <View style={[st.balanceItem, { flex: 0, justifyContent: "center" }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={oculto ? "Mostrar saldos" : "Ocultar saldos"}
                onPress={() => setOculto((v) => !v)}
                style={st.ojo}
              >
                {oculto ? <IconEyeOff size={22} color={C.muted} /> : <IconEye size={22} color={C.muted} />}
              </Pressable>
            </View>
            <View style={st.balanceItem}>
              <Text style={st.balanceLabel}>Disponible</Text>
              <Text style={st.balanceValor}>{m(ledger.available)}</Text>
            </View>
            <View style={st.balanceItem}>
              <Text style={st.balanceLabel}>En garantía</Text>
              <Text style={[st.balanceValor, { color: C.green }]}>{m(ledger.inEscrow)}</Text>
            </View>
            <View style={st.balanceItem}>
              <Text style={st.balanceLabel}>Retirando</Text>
              <Text style={st.balanceValor}>{m(ledger.withdrawing)}</Text>
            </View>
          </Card>

          {pendiente ? (
            <Card style={{ borderColor: C.ice + "66" }}>
              <Text style={st.seccionTitulo}>
                {pendiente.kind === "load" ? "Carga pendiente" : "Retiro pendiente"}
              </Text>
              <KV k="Monto" v={formatARS(pendiente.cents)} />
              <Text style={st.ayuda}>
                El pago quedó pendiente como en Mercado Pago. Simulá cómo lo
                resuelve el procesador:
              </Text>
              <View style={st.filaBotones}>
                <View style={{ flex: 1 }}>
                  <Btn
                    titulo="Simular aprobado"
                    busy={busy}
                    onPress={() => resolver("approved")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    titulo="Simular rechazado"
                    variant="secondary"
                    busy={busy}
                    onPress={() => resolver("rejected")}
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={st.seccionTitulo}>Cargar o retirar pesos</Text>
              <Field
                label="Monto en pesos"
                value={monto}
                onChangeText={setMonto}
                placeholder="Ej.: 600.000"
                keyboardType="decimal-pad"
                ayuda={cents !== null ? formatARS(cents) : undefined}
              />
              <View style={st.filaBotones}>
                <View style={{ flex: 1 }}>
                  <Btn titulo="Cargar" busy={busy} onPress={() => pedir("load")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    titulo="Retirar"
                    variant="secondary"
                    busy={busy}
                    disabled={!retiroValido}
                    onPress={() => pedir("withdraw")}
                  />
                </View>
              </View>
            </Card>
          )}

          {aviso ? <Banner texto={aviso} /> : null}

          {ledger.entries.filter((e) => e.bucket === "available").length > 0 ? (
            <Card>
              <Text style={st.seccionTitulo}>Últimos movimientos</Text>
              {ledger.entries
                .filter((e) => e.bucket === "available")
                .slice(0, 6)
                .map((e, i) => (
                  <KV
                    key={`${e.id}-${i}`}
                    k={`${KINDS[e.kind] ?? e.kind}${e.createdAt ? ` · ${e.createdAt.slice(0, 10)}` : ""}`}
                    v={`${e.amountARS >= 0 ? "+" : "−"}${formatARS(Math.abs(e.amountARS))}`}
                    accent={e.amountARS >= 0 ? C.green : C.coral}
                  />
                ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Btn
        titulo={`Cambiar de usuario (${userId})`}
        variant="ghost"
        onPress={async () => {
          await clearUserId();
          router.replace("/login");
        }}
      />

      <ConfirmSheet
        data={
          confirm
            ? {
                titulo: confirm.kind === "load" ? "Revisá la carga" : "Revisá el retiro",
                lineas: [
                  {
                    label: confirm.kind === "load" ? "Cargás" : "Retirás",
                    valor: formatARS(confirm.cents),
                  },
                  {
                    label: "Modo",
                    valor: "Pago simulado, queda pendiente",
                  },
                ],
                efecto:
                  confirm.kind === "load"
                    ? "Se crea un pago de demostración pendiente. Después elegís cómo lo resuelve el procesador: aprobado suma el saldo, rechazado no mueve nada."
                    : "La plata se retiene de tu saldo disponible hasta que el procesador resuelva. Aprobado sale del sistema; rechazado vuelve a tu disponible.",
                cta: confirm.kind === "load" ? "Crear carga simulada" : "Crear retiro simulado",
                consent:
                  confirm.kind === "withdraw"
                    ? "Revisé el monto y entiendo que queda retenido hasta la resolución simulada."
                    : undefined,
              }
            : null
        }
        busy={busy}
        onConfirm={confirmar}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

const KINDS: Record<string, string> = {
  load_credit: "Carga acreditada",
  escrow_lock: "Protegido en acuerdo",
  escrow_release: "Liberado del acuerdo",
  settle_credit: "Cobro de acuerdo",
  refund_credit: "Devolución de acuerdo",
  fee_credit: "Cargo del servicio",
  withdraw_hold: "Retiro retenido",
  withdraw_debit: "Retiro enviado",
  withdraw_release: "Retiro devuelto",
};

const st = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { color: C.ink, fontSize: 24, fontWeight: "800" },
  balances: { flexDirection: "row", gap: 8, alignItems: "center" },
  ojo: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  balanceItem: { flex: 1, gap: 4 },
  balanceLabel: { color: C.muted, fontSize: 12.5 },
  balanceValor: { color: C.ink, fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
  seccionTitulo: { color: C.ink, fontSize: 15, fontWeight: "700" },
  filaBotones: { flexDirection: "row", gap: 10 },
  ayuda: { color: C.muted, fontSize: 13, lineHeight: 18 },
});
