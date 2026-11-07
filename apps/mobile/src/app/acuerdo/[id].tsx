import { PRESENTATION, presentationLink, presentationRole } from "../../lib/presentation";
// Ficha del acuerdo: monto, estado, quién debe actuar, acciones según rol y
// estado, reclamo parcial con montos editables, disputa, cronología y
// "Ver comprobante" colapsable (ahí sí va lo técnico: hash, red, contrato).

import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  agreementAction,
  API_URL,
  ApiError,
  getAgreement,
  getLedger,
  humanize,
  type Action,
  type AgreementDetail,
} from "../../lib/api";
import { getUserId, rememberAgreement } from "../../lib/session";
import {
  accionesPara,
  cronologia,
  esTerminal,
  estadoInfo,
  formatARS,
  formatFecha,
  habilitada,
  parseARStoCents,
  PLANTILLAS,
  proximoPaso,
  rolTexto,
  vencio,
  type AccionUI,
} from "../../lib/domain";
import { C, R } from "../../lib/theme";
import {
  Banner,
  Btn,
  Card,
  CopyLink,
  ErrorVista,
  KV,
  SkeletonRows,
  StatePill,
  StageTrack,
} from "../../components/ui";
import { ConfirmSheet, InlineConfirm, type LineaConfirm } from "../../components/confirm";
import { SplitSlider } from "../../components/splitSlider";
import { IconWarn } from "../../components/icons";

const feeDe = (toBenef: number) => Math.floor(toBenef / 100);
// Explorador canónico de Fuji C-Chain (testnet). Snowtrace-test quedó detrás
// de Cloudflare; este devuelve 200 para tx/address.
const EXPLORER = "https://explorer-test.avax.network/c-chain";

export default function AcuerdoDetalle() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [demoLink, setDemoLink] = useState("");
  const [userId, setUserId] = useState("");
  const [d, setD] = useState<AgreementDetail | null>(null);
  const [disponible, setDisponible] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [verComprobante, setVerComprobante] = useState(false);
  const [confirm, setConfirm] = useState<{
    titulo: string;
    lineas: LineaConfirm[];
    efecto: string;
    cta: string;
    peligrosa?: boolean;
    consent?: string;
    run: () => Promise<void>;
  } | null>(null);

  // Reclamo parcial: reparto con slider (equivalente budget-slider bencho)
  const [reparto, setReparto] = useState<"devolver" | "liberar" | "parcial">("devolver");
  const [splitCents, setSplitCents] = useState(0);
  const [errorParcial, setErrorParcial] = useState("");
  const [ruleBenef, setRuleBenef] = useState("");
  const [ruleDepos, setRuleDepos] = useState("");
  const [errorRule, setErrorRule] = useState("");

  const cargar = useCallback(async (uid?: string) => {
    const u = uid || userId || (await getUserId());
    if (!u) {
      router.replace("/login");
      return;
    }
    if (!id) return;
    setUserId(u);
    const det = await getAgreement(id, u);
    setD(det);
    if (PRESENTATION && Platform.OS === "web") setDemoLink(await presentationLink(id));
    setError("");
    void rememberAgreement(u, det.id);
    const l = await getLedger(u).catch(() => null);
    setDisponible(l ? l.available : null);
  }, [id, userId, router]);

  useEffect(() => {
    void (async () => {
      try {
        await cargar();
      } catch (e) {
        setError(e instanceof ApiError ? e.human : humanize(String(e)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function ejecutar(fn: () => Promise<void>) {
    setBusy(true);
    setAviso("");
    try {
      await fn();
      setConfirm(null);
      await cargar();
    } catch (e) {
      setConfirm(null);
      setAviso(e instanceof ApiError ? e.human : humanize(String(e)));
    } finally {
      setBusy(false);
    }
  }

  const run = useCallback(
    (action: Action, extra?: { toBeneficiaryCents?: number; toDepositorCents?: number }) =>
      () => ejecutar(async () => {
        await agreementAction(id!, { action, userId, ...extra });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, userId],
  );

  if (error && !d) {
    return (
      <View style={st.centro}>
        <ErrorVista titulo="No pudimos abrir el acuerdo" mensaje={error} onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={st.centro}>
        <SkeletonRows filas={3} />
      </View>
    );
  }

  const p = PLANTILLAS[d.template];
  const e = estadoInfo(d.state);
  const paso = proximoPaso(d);
  const acciones = accionesPara(d);
  const enlace = demoLink || `${API_URL}/acuerdos/${d.id}/aceptar`;
  const remaining = d.remainingCents;
  const propuestaVigente =
    d.state === "OutcomeProposed" && d.proposedToBeneficiaryCents !== undefined;

  const lineasReparto = (toBenef: number): LineaConfirm[] => [
    { label: `Recibe ${p.rol.beneficiary.toLowerCase()}`, valor: formatARS(toBenef) },
    { label: `Recupera ${p.rol.depositor.toLowerCase()}`, valor: formatARS(remaining - toBenef) },
    { label: "Cargo del servicio (1%)", valor: formatARS(feeDe(toBenef)) },
  ];

  function revisarPropuesta() {
    const toBenef =
      reparto === "devolver" ? 0 : reparto === "liberar" ? remaining : splitCents;
    if (toBenef < 0 || toBenef > remaining) {
      setErrorParcial(`Ingresá un monto entre $ 0 y ${formatARS(remaining)}.`);
      return;
    }
    setErrorParcial("");
    setConfirm({
      titulo: "Revisá la propuesta de cierre",
      lineas: lineasReparto(toBenef),
      efecto:
        "La otra parte ve este reparto y decide si lo acepta. Si lo acepta, el dinero se reparte solo y no se puede volver atrás.",
      cta: "Enviar propuesta",
      consent: "Revisé los montos del reparto.",
      run: run("proposeOutcome", { toBeneficiaryCents: toBenef }),
    });
  }

  function confirmarAccion(a: AccionUI) {
    switch (a.action) {
      case "accept":
        setConfirm({
          titulo: "Aceptar las condiciones",
          lineas: [
            { label: "Acuerdo", valor: d!.title },
            { label: "Monto a proteger", valor: formatARS(remaining) },
          ],
          efecto:
            "Aceptás las condiciones tal como están escritas. Después depositás el monto para dejarlo protegido.",
          cta: "Aceptar condiciones",
          consent: "Revisé y acepto las condiciones del acuerdo.",
          run: run("accept"),
        });
        break;
      case "fund":
        setConfirm({
          titulo: "Depositar el monto",
          lineas: [
            { label: "Depositás", valor: formatARS(remaining) },
            { label: "Queda protegido para", valor: d!.title },
          ],
          efecto:
            "La plata sale de tu saldo y queda protegida: ninguna parte puede moverla sola. Se libera cuando ambos acuerden, la resuelva un reclamo o venza el plazo.",
          cta: `Depositar ${formatARS(remaining)}`,
          consent: "Revisé el monto y las condiciones del acuerdo.",
          run: run("fund"),
        });
        break;
      case "acceptOutcome":
        setConfirm({
          titulo: "Revisá la propuesta antes de aceptarla",
          lineas: lineasReparto(d!.proposedToBeneficiaryCents!),
          efecto:
            "Al aceptarla el dinero se reparte como se muestra y el acuerdo cierra. No se puede volver atrás.",
          cta: "Aceptar reparto",
          consent: "Revisé cómo queda el reparto.",
          run: run("acceptOutcome"),
        });
        break;
      case "refundAfterTimeout":
        setConfirm({
          titulo: "Reclamar la devolución",
          lineas: [
            { label: "Recuperás", valor: formatARS(remaining) },
            { label: "Motivo", valor: "Plazo vencido sin cierre" },
          ],
          efecto: "El depósito vuelve entero a tu saldo, sin cargo.",
          cta: "Reclamar devolución",
          consent: "Entiendo que el acuerdo cierra y la plata vuelve.",
          run: run("refundAfterTimeout"),
        });
        break;
      case "rule": {
        const toB = parseARStoCents(ruleBenef) ?? -1;
        const toD = parseARStoCents(ruleDepos) ?? -1;
        if (toB < 0 || toD < 0 || toB + toD !== remaining) {
          setErrorRule(`Los dos montos tienen que sumar exactamente ${formatARS(remaining)}.`);
          return;
        }
        setErrorRule("");
        setConfirm({
          titulo: "Resolver la disputa",
          lineas: [
            { label: `Recibe ${p.rol.beneficiary.toLowerCase()}`, valor: formatARS(toB) },
            { label: `Recupera ${p.rol.depositor.toLowerCase()}`, valor: formatARS(toD) },
            { label: "Cargo del servicio", valor: formatARS(feeDe(toB)) },
          ],
          efecto: "Tu decisión reparte el dinero protegido y cierra el acuerdo.",
          cta: "Resolver y repartir",
          peligrosa: true,
          consent: "Revisé el reparto final.",
          run: run("rule", { toBeneficiaryCents: toB, toDepositorCents: toD }),
        });
        break;
      }
      default:
        break;
    }
  }

  return (
    <ScrollView
      style={st.scroll}
      contentContainerStyle={st.content}
      refreshControl={
        Platform.OS === "web" ? undefined : (
          <RefreshControl
            refreshing={refrescando}
            onRefresh={async () => {
              setRefrescando(true);
              try {
                await cargar();
              } finally {
                setRefrescando(false);
              }
            }}
            tintColor={C.ice}
            colors={[C.ice]}
          />
        )
      }
    >
      <View style={st.headRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={st.tagRow}>
            <StatePill label={e.label} tono={e.tono} />
          </View>
          <Text style={st.h1}>{d.title}</Text>
        </View>
      </View>

      <Card>
        <View style={st.montoRow}>
          <Text style={st.montoLabel}>{esTerminal(d.state) ? "Monto pactado" : "Protegido"}</Text>
          <Text style={st.monto}>{formatARS(remaining)}</Text>
        </View>
        {remaining !== d.amountCents ? (
          <KV k="Monto original" v={formatARS(d.amountCents)} />
        ) : null}
        <KV k="Tu rol" v={rolTexto(d.yourRole, d.template)} />
        {paso ? <Text style={st.paso}>{paso}</Text> : null}
      </Card>

      {d.state === "Created" ? (
        <Card>
          <Text style={st.seccion}>Compartí el enlace con {p.rol.depositor.toLowerCase()}</Text>
          <View style={st.partyRow}>
            <View style={st.partyPill}>
              <Text style={st.partyRol}>{p.rol.creator}</Text>
              <Text style={st.partyNombre} numberOfLines={1}>
                {d.parties.creatorLabel}
              </Text>
            </View>
            <View style={st.partyPill}>
              <Text style={st.partyRol}>{p.rol.depositor}</Text>
              <Text style={st.partyNombre} numberOfLines={1}>
                {d.parties.counterpartyLabel}
              </Text>
            </View>
          </View>
          <Text style={st.ayuda}>
            La otra parte revisa las condiciones y acepta desde el navegador. No
            hace falta que use la app.
          </Text>
          <CopyLink url={enlace} label="Enlace de aceptación" />
        </Card>
      ) : null}

      {PRESENTATION ? <Card>
        <Text style={st.seccion}>Recorrer la demo</Text>
        <Text style={st.ayuda}>Cambiá de parte para presentar el flujo completo. Login y operaciones simulados.</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{[{ role: "beneficiary", label: "Quien crea" }, { role: "depositor", label: "Quien paga" }, { role: "arbiter", label: "Árbitro" }].map((r) => <Pressable key={r.role} accessibilityRole="button" onPress={() => ejecutar(async () => { await presentationRole(id!, userId, r.role); })} style={{ minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: d.yourRole === r.role ? C.elevated : C.bg }}><Text style={{ color: C.ice, fontWeight: "700" }}>{r.label}</Text></Pressable>)}</View>
        {d.state === "Accepted" && d.yourRole === "depositor" ? <Btn titulo="Cargar saldo para este acuerdo" onPress={() => router.push("/saldo")} /> : null}
        <Text style={st.ayuda}>El enlace comparte una copia de la demo. Compartí el enlace actualizado después de avanzar; no sincroniza entre teléfonos.</Text>
        {d.state !== "Created" ? <CopyLink url={enlace} label="Compartir estado actualizado" /> : null}
      </Card> : null}
      {aviso ? <Banner texto={aviso} /> : null}

      {/* ── Acciones ─────────────────────────────────────────────────── */}
      {acciones.length > 0 ||
      ((d.state === "Funded" || d.state === "Delivered" || d.state === "OutcomeProposed") &&
        (d.yourRole === "depositor" || d.yourRole === "beneficiary") &&
        habilitada(d, "proposeOutcome")) ||
      (d.state === "Disputed" && d.yourRole === "arbiter" && habilitada(d, "rule")) ? (
        <Card>
          <Text style={st.seccion}>Acciones</Text>

          {d.state === "Accepted" && d.yourRole === "depositor" && disponible !== null && disponible < remaining ? (
            <View style={st.alertaBox}>
              <IconWarn size={18} color={C.coral} />
              <Text style={st.alertaTexto}>
                Te falta saldo: tenés {formatARS(disponible)} disponibles y el depósito es {formatARS(remaining)}. Cargá desde la pestaña Saldo.
              </Text>
            </View>
          ) : null}

          {propuestaVigente ? (
            <View style={st.propuesta}>
              <Text style={st.propuestaTitulo}>
                Propuesta vigente{d.proposerUserId === userId ? " (la enviaste vos)" : ""}
              </Text>
              {lineasReparto(d.proposedToBeneficiaryCents!).map((l) => (
                <KV key={l.label} k={l.label} v={l.valor} />
              ))}
              {d.proposerUserId === userId ? (
                <Text style={st.ayuda}>Esperando que la otra parte responda.</Text>
              ) : null}
            </View>
          ) : null}

          {(d.state === "Funded" || d.state === "Delivered" || d.state === "OutcomeProposed") &&
          (d.yourRole === "depositor" || d.yourRole === "beneficiary") &&
          habilitada(d, "proposeOutcome") ? (
            <View style={st.repartoBox}>
              <Text style={st.subSeccion}>Proponer cierre</Text>
              {(
                [
                  ["devolver", `Devolver todo a ${p.rol.depositor.toLowerCase()}`],
                  ["liberar", `Liberar todo a ${p.rol.beneficiary.toLowerCase()}`],
                  ["parcial", "Otro reparto"],
                ] as const
              ).map(([valor, label]) => (
                <Pressable
                  key={valor}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reparto === valor }}
                  onPress={() => setReparto(valor)}
                  style={st.radio}
                >
                  <View style={[st.radioDot, reparto === valor && st.radioDotOn]}>
                    {reparto === valor ? <View style={st.radioDotIn} /> : null}
                  </View>
                  <Text style={st.radioLabel}>{label}</Text>
                </Pressable>
              ))}
              {reparto === "parcial" ? (
                <View style={{ gap: 4 }}>
                  <Text style={st.radioLabel}>Arrastrá para definir el reparto</Text>
                  <SplitSlider
                    total={remaining}
                    value={splitCents}
                    onChange={setSplitCents}
                    labelA={p.rol.beneficiary.toLowerCase()}
                    labelB={p.rol.depositor.toLowerCase()}
                  />
                  {errorParcial ? <Text style={st.errorTexto}>{errorParcial}</Text> : null}
                </View>
              ) : null}
              <Btn titulo="Revisar propuesta" variant="secondary" onPress={revisarPropuesta} />
            </View>
          ) : null}

          {acciones
            .filter((a) => a.action !== "proposeOutcome" && a.action !== "rule")
            .map((a) =>
              a.kind === "peligro" ? (
                <InlineConfirm
                  key={a.action}
                  titulo={a.titulo}
                  confirmar={
                    a.action === "cancel" ? "Confirmar cancelación" : "Confirmar reclamo"
                  }
                  busy={busy}
                  onConfirm={run(a.action)}
                />
              ) : (
                <Btn
                  key={a.action}
                  titulo={a.titulo}
                  busy={busy}
                  onPress={() => confirmarAccion(a)}
                />
              ),
            )}

          {d.state === "Disputed" && d.yourRole === "arbiter" && habilitada(d, "rule") ? (
            <View style={st.repartoBox}>
              <Text style={st.subSeccion}>Resolver la disputa (árbitro de demostración)</Text>
              <Text style={st.ayuda}>
                Repartí {formatARS(remaining)} entre las partes. La suma tiene que ser exacta.
              </Text>
              {(
                [
                  [`Para ${p.rol.beneficiary.toLowerCase()}`, ruleBenef, setRuleBenef],
                  [`Para ${p.rol.depositor.toLowerCase()}`, ruleDepos, setRuleDepos],
                ] as const
              ).map(([label, valor, set]) => (
                <View key={label} style={{ gap: 6 }}>
                  <Text style={st.radioLabel}>{label} (en pesos)</Text>
                  <TextInput
                    value={valor}
                    onChangeText={set}
                    placeholder="Ej.: 300.000"
                    placeholderTextColor={C.muted + "80"}
                    keyboardType="decimal-pad"
                    accessibilityLabel={label}
                    style={[st.input, errorRule ? { borderColor: C.coral } : null]}
                  />
                </View>
              ))}
              {errorRule ? <Text style={st.errorTexto}>{errorRule}</Text> : null}
              <Btn titulo="Resolver disputa" variant="danger" busy={busy} onPress={() => confirmarAccion({ action: "rule", titulo: "", kind: "money" })} />
            </View>
          ) : null}

          {d.state === "Disputed" && d.yourRole !== "arbiter" ? (
            <Text style={st.ayuda}>
              No hay acciones disponibles mientras el árbitro revisa. Los fondos siguen protegidos.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {d.settlement && esTerminal(d.state) ? (
        <Card style={{ borderColor: C.green + "55" }}>
          <Text style={st.seccion}>Cómo quedó el reparto</Text>
          <KV k={`Recibió ${p.rol.beneficiary.toLowerCase()}`} v={formatARS(d.settlement.toBeneficiary)} accent={C.green} />
          <KV k={`Recuperó ${p.rol.depositor.toLowerCase()}`} v={formatARS(d.settlement.toDepositor)} />
          <KV k="Cargo del servicio" v={formatARS(d.settlement.fee)} />
        </Card>
      ) : null}

      {/* ── Datos del acuerdo ────────────────────────────────────────── */}
      <Card>
        <Text style={st.seccion}>Condiciones</Text>
        <Text style={st.condiciones}>{d.terms || "Sin condiciones registradas."}</Text>
        <View style={st.separador} />
        <KV k="Quien propone" v={d.parties.creatorLabel} />
        <KV k={`${p.rol.depositor}`} v={d.parties.counterpartyLabel} />
        {d.deadlines.acceptAt ? <KV k="Aceptar antes de" v={formatFecha(d.deadlines.acceptAt)} accent={vencio(d.deadlines.acceptAt) && d.state === "Created" ? C.coral : undefined} /> : null}
        {d.deadlines.reviewAt ? <KV k="Completar antes de" v={formatFecha(d.deadlines.reviewAt)} accent={vencio(d.deadlines.reviewAt) && !esTerminal(d.state) ? C.coral : undefined} /> : null}
      </Card>

      <Card>
        <Text style={st.seccion}>Cronología</Text>
        {d.timeline && d.timeline.length > 0 ? (
          <View style={{ gap: 2 }}>
            {d.timeline.map((ev, i) => (
              <KV key={`${ev.label}-${i}`} k={ev.label} v={formatFecha(ev.at)} />
            ))}
          </View>
        ) : (
          <StageTrack pasos={cronologia(d)} />
        )}
      </Card>

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: verComprobante }}
          onPress={() => setVerComprobante((v) => !v)}
          style={st.comprobanteHead}
        >
          <Text style={st.seccion}>Ver comprobante</Text>
          <Text style={st.comprobanteMas}>{verComprobante ? "Ocultar" : "Mostrar"}</Text>
        </Pressable>
        {verComprobante ? (
          <View style={{ gap: 8 }}>
            <Text style={st.ayuda}>
              Registro técnico de la demostración: el acuerdo se asienta en una
              red de pruebas; los montos de la app son siempre en pesos.
            </Text>
            {d.termsHash ? <KV k="Hash de condiciones" v={d.termsHash} mono /> : null}
            {d.onchain.chainId ? <KV k="Red" v={`Avalanche Fuji (${d.onchain.chainId})`} /> : null}
            {d.onchain.escrow ? (
              <KV
                k="Contrato escrow"
                v={d.onchain.escrow}
                mono
                href={`${EXPLORER}/address/${d.onchain.escrow}`}
              />
            ) : null}
            {d.onchain.contractAgreementId !== undefined ? (
              <KV k="Acuerdo en contrato" v={`#${d.onchain.contractAgreementId}`} />
            ) : null}
            {Object.entries(d.onchain.txHashes).flatMap(([k, v]) => {
              // El server puede mandar varios hashes por acción separados por
              // coma (ej. fundPrep = approve + depósito). Una fila por hash.
              const hashes = v.split(",").map((h) => h.trim()).filter(Boolean);
              return hashes.map((h, i) => (
                <KV
                  key={`${k}-${i}`}
                  k={`Tx ${k}${hashes.length > 1 ? ` (${i + 1})` : ""}`}
                  v={h}
                  mono
                  href={`${EXPLORER}/tx/${h}`}
                />
              ));
            })}
            {(["creator", "depositor", "beneficiary", "arbiter"] as const).map((rol) =>
              d.roles[rol].address ? (
                <KV key={rol} k={`Cuenta ${rol}`} v={d.roles[rol].address!} mono />
              ) : null,
            )}
            {d.onchain.pending ? (
              <Text style={st.ayuda}>Registro en la red todavía pendiente de confirmar.</Text>
            ) : null}
          </View>
        ) : null}
      </Card>
      <ConfirmSheet data={confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) void confirm.run(); }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  centro: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 18 },
  headRow: { flexDirection: "row", gap: 10 },
  tagRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  h1: { color: C.ink, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  montoRow: { gap: 2 },
  montoLabel: { color: C.muted, fontSize: 13 },
  monto: { color: C.ink, fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  paso: { color: C.ice, fontSize: 13.5, fontWeight: "600", lineHeight: 19 },
  seccion: { color: C.ink, fontSize: 15, fontWeight: "700" },
  subSeccion: { color: C.ink, fontSize: 14, fontWeight: "700" },
  ayuda: { color: C.muted, fontSize: 13, lineHeight: 18 },
  condiciones: { color: C.ink, fontSize: 14, lineHeight: 21 },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: C.lineSoft },
  alertaBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.coral + "88",
    borderRadius: R.control,
    padding: 12,
  },
  alertaTexto: { color: C.ink, fontSize: 13, flex: 1, lineHeight: 18 },
  propuesta: {
    borderWidth: 1,
    borderColor: C.ice + "66",
    borderRadius: R.control,
    padding: 12,
    gap: 6,
    backgroundColor: C.bg,
  },
  propuestaTitulo: { color: C.ink, fontSize: 14, fontWeight: "700" },
  repartoBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    borderRadius: R.control,
    padding: 12,
    gap: 10,
  },
  radio: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotOn: { borderColor: C.ice },
  radioDotIn: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ice },
  radioLabel: { color: C.ink, fontSize: 14, flex: 1 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.control,
    backgroundColor: C.bg,
    color: C.ink,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  errorTexto: { color: C.coral, fontSize: 13, fontWeight: "600" },
  partyRow: { flexDirection: "row", gap: 8 },
  partyPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.lineSoft,
    borderRadius: R.control,
    padding: 10,
    gap: 2,
    backgroundColor: C.bg,
  },
  partyRol: { color: C.muted, fontSize: 11.5, fontWeight: "600" },
  partyNombre: { color: C.ink, fontSize: 14, fontWeight: "700" },
  comprobanteHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  comprobanteMas: { color: C.ice, fontSize: 13.5, fontWeight: "600" },
});
