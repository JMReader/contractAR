import { CONDICIONES, VERIFICACIONES } from "../../lib/options";
// Tab Nuevo: plantilla con íconos propios, título, contraparte, monto $ en
// formato AR, plazos en días y condiciones. Crea y va a la ficha, donde está el
// enlace para compartir con la otra parte (que acepta por web, no por la app).

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, createAgreement, humanize, type Template } from "../../lib/api";
import { getUserId, rememberAgreement } from "../../lib/session";
import { formatARS, parseARStoCents, PLANTILLAS } from "../../lib/domain";
import { C, R } from "../../lib/theme";
import { Banner, Btn, DemoTag, Field, Screen } from "../../components/ui";
import { IconCar, IconTicket } from "../../components/icons";
import ChatCrear from "../../components/chatCrear";

type Campo = "titulo" | "contraparte" | "monto" | "plazos" | "condiciones";
type Errores = Partial<Record<Campo, string>>;
type Modo = "form" | "chat";

const ICONOS = { auto: IconCar, entrada: IconTicket } as const;
const MODOS: { id: Modo; label: string }[] = [
  { id: "form", label: "Formulario" },
  { id: "chat", label: "Chat guiado" },
];

export default function Nuevo() {
  const router = useRouter();
  const [template, setTemplate] = useState<Template>("guarantee");
  const [titulo, setTitulo] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [monto, setMonto] = useState("");
  const [diasAceptar, setDiasAceptar] = useState("3");
  const [diasCompletar, setDiasCompletar] = useState("14");
  const [selected, setSelected] = useState<number[]>([0, 1, 2, 3, 4]);
  const [verification, setVerification] = useState("ia");
  const condiciones = selected.map((i) => CONDICIONES[template][i]).filter(Boolean).map((t) => `• ${t}`).join("\n") + `\n\nVerificación: ${VERIFICACIONES.find((v) => v.id === verification)?.nombre}. En modo presentación, la decisión se simula manualmente.`;
  const [errores, setErrores] = useState<Errores>({});
  const [busy, setBusy] = useState(false);
  const [errorApi, setErrorApi] = useState("");
  const [modo, setModo] = useState<Modo>("form");

  const segModo = (
    <View style={st.seg} accessibilityRole="tablist">
      {MODOS.map((m) => {
        const sel = modo === m.id;
        return (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`Crear por ${m.label.toLowerCase()}`}
            onPress={() => setModo(m.id)}
            style={({ pressed }) => [
              st.segItem,
              sel && st.segItemSel,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[st.segTxt, sel && st.segTxtSel]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  // Chat guiado: misma API de creación; el parser vive en lib/chatParse y la
  // salida al formulario es el escape honesto si el chat no entiende algo.
  if (modo === "chat") {
    return (
      <SafeAreaView style={st.chatScreen} edges={["top", "left", "right"]}>
        <View style={st.segWrap}>{segModo}</View>
        <ChatCrear
          onCreated={(id) => router.push(`/acuerdo/${id}`)}
          onIrAForm={() => setModo("form")}
        />
      </SafeAreaView>
    );
  }

  const p = PLANTILLAS[template];
  const montoCents = parseARStoCents(monto);

  function validar(): Errores {
    const e: Errores = {};
    if (titulo.trim().length < 3) e.titulo = "Ponele un título de al menos 3 letras.";
    if (!contraparte.trim()) e.contraparte = `Indicá quién es ${p.rol.depositor.toLowerCase()}.`;
    if (montoCents === null) e.monto = "Ingresá un monto en pesos, mayor a $ 0.";
    const a = Number(diasAceptar);
    const r = Number(diasCompletar);
    if (!Number.isInteger(a) || a < 1 || a > 60 || !Number.isInteger(r) || r < 1 || r > 365 || r <= a)
      e.plazos = "Días enteros: aceptar entre 1 y 60, completar entre 1 y 365 y mayor al de aceptar.";
    if (!selected.length)
      e.condiciones = "Elegí al menos una condición.";
    return e;
  }

  async function crear() {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const uid = await getUserId();
    if (!uid) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    setErrorApi("");
    try {
      const res = await createAgreement({
        userId: uid,
        template,
        title: titulo.trim(),
        terms: condiciones.trim(),
        creatorLabel: "Vos",
        counterpartyLabel: contraparte.trim(),
        amountCents: montoCents!,
        acceptDeadlineSec: Number(diasAceptar) * 86400,
        reviewDeadlineSec: Number(diasCompletar) * 86400,
      });
      if (res.id) {
        await rememberAgreement(uid, res.id);
        router.push(`/acuerdo/${res.id}`);
      }
    } catch (err) {
      setErrorApi(err instanceof ApiError ? err.human : humanize(String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={st.headRow}>
        <Text style={st.h1}>Nuevo acuerdo</Text>
        <DemoTag texto="Simulación" />
      </View>
      <Text style={st.sub}>
        Definí las condiciones; la otra parte las revisa antes de aceptar.
      </Text>

      {segModo}

      <View style={st.plantillas}>
        {(Object.keys(PLANTILLAS) as Template[]).map((t) => {
          const info = PLANTILLAS[t];
          const Icono = ICONOS[info.icono];
          const sel = template === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              onPress={() => { setTemplate(t); setSelected(CONDICIONES[t].map((_, i) => i)); }}
              style={({ pressed }) => [
                st.plantilla,
                sel && st.plantillaSel,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={st.plantillaHead}>
                <Icono size={22} color={sel ? C.ice : C.muted} />
                <Text style={[st.plantillaNombre, sel && { color: C.ice }]}>{info.nombre}</Text>
              </View>
              <Text style={st.plantillaDesc}>{info.descripcion}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Título del acuerdo"
        value={titulo}
        onChangeText={setTitulo}
        placeholder={
          template === "guarantee"
            ? "Ej.: Garantía por el Corsa del fin de semana"
            : "Ej.: Entrada para el recital del sábado"
        }
        maxLength={70}
        error={errores.titulo}
      />
      <Field
        label={
          template === "guarantee"
            ? "¿Quién es el cliente? (deposita la garantía)"
            : "¿Quién es el comprador? (deposita el pago)"
        }
        value={contraparte}
        onChangeText={setContraparte}
        placeholder="Nombre o contacto"
        maxLength={70}
        error={errores.contraparte}
        ayuda="Dato de la demo: la otra parte entra por el enlace que le compartas."
      />
      <Field
        label="Monto en pesos"
        value={monto}
        onChangeText={setMonto}
        placeholder="Ej.: 600.000"
        keyboardType="decimal-pad"
        error={errores.monto}
        ayuda={montoCents !== null ? `Se registra como ${formatARS(montoCents)}.` : undefined}
      />

      <View style={st.plazos}>
        <View style={{ flex: 1 }}>
          <Field
            label="Días para aceptar"
            value={diasAceptar}
            onChangeText={setDiasAceptar}
            keyboardType="number-pad"
            error={errores.plazos}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Días para completar"
            value={diasCompletar}
            onChangeText={setDiasCompletar}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={st.plantillaNombre}>Condiciones del contrato</Text>
        {CONDICIONES[template].map((text, i) => <Pressable key={text} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(i) }} onPress={() => setSelected(selected.includes(i) ? selected.filter((n) => n !== i) : [...selected, i].sort())} style={[st.plantilla, { flexDirection: "row", gap: 12 }, selected.includes(i) && st.plantillaSel]}><Text style={{ color: C.ice, fontSize: 21 }}>{selected.includes(i) ? "☑" : "☐"}</Text><Text style={[st.plantillaDesc, { flex: 1 }]}>{text}</Text></Pressable>)}
        {errores.condiciones ? <Text style={{ color: C.coral }}>{errores.condiciones}</Text> : null}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={st.plantillaNombre}>Tipo de verificación</Text>
        {VERIFICACIONES.map((v) => <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ checked: verification === v.id }} onPress={() => setVerification(v.id)} style={[st.plantilla, verification === v.id && st.plantillaSel]}><Text style={st.plantillaNombre}>{verification === v.id ? "◉ " : "○ "}{v.nombre}</Text><Text style={st.plantillaDesc}>{v.detalle}</Text></Pressable>)}
      </View>

      <Text style={st.comoTexto}>
        {`Vos sos ${p.rol.creator.toLowerCase()}; deposita ${p.quienDeposita}. El servicio cobra 1% sobre lo liberado a quien cobra.`}
      </Text>

      {errorApi ? <Banner texto={errorApi} /> : null}

      <Btn titulo="Crear acuerdo" onPress={crear} busy={busy} />
    </Screen>
  );
}

const st = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { color: C.ink, fontSize: 24, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 14, marginTop: -6 },
  plantillas: { gap: 10 },
  plantilla: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.lineSoft,
    padding: 14,
    gap: 6,
  },
  plantillaSel: { borderColor: C.ice, backgroundColor: C.elevated },
  plantillaHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  plantillaNombre: { color: C.ink, fontSize: 15, fontWeight: "700" },
  plantillaDesc: { color: C.muted, fontSize: 13, lineHeight: 18 },
  plazos: { flexDirection: "row", gap: 12 },
  comoTexto: { color: C.muted, fontSize: 13, lineHeight: 19 },
  seg: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: R.control,
    borderWidth: 1,
    borderColor: C.lineSoft,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: R.control - 3,
    alignItems: "center",
    justifyContent: "center",
  },
  segItemSel: { backgroundColor: C.elevated },
  segTxt: { color: C.muted, fontSize: 14, fontWeight: "700" },
  segTxtSel: { color: C.ice },
  chatScreen: { flex: 1, backgroundColor: C.bg },
  segWrap: { paddingHorizontal: 18, paddingTop: 8 },
});
