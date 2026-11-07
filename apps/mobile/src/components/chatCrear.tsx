// Chat guiado de creación: burbujas + parser determinista (lib/chatParse).
// No navega ni promete IA: el padre da onCreated(id) y onIrAForm() de escape.

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, createAgreement, humanize } from "../lib/api";
import { getUserId, rememberAgreement } from "../lib/session";
import {
  inicioConversacion,
  interpretar,
  type ChipSugerido,
  type Draft,
  type EstadoConversacion,
  type Paso,
  type SalidaBot,
} from "../lib/chatParse";
import { C, HIT, R } from "../lib/theme";

interface Msg {
  id: number;
  quien: "bot" | "yo";
  texto: string;
}

const PLACEHOLDER: Record<Paso, string> = {
  tipo: "Ej.: garantía del corsa con Bruno por 600 mil",
  titulo: "Una frase corta…",
  contraparte: "Nombre de la otra parte…",
  monto: "Ej.: 600.000 o 600 mil",
  plazos: "Ej.: 3 y 14",
  condiciones: "Las reglas del trato…",
  confirmar: "«crear» o tocá un campo para cambiarlo",
};

const dormir = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export default function ChatCrear({
  onCreated,
  onIrAForm,
}: {
  onCreated: (agreementId: string) => void;
  onIrAForm: () => void;
}): JSX.Element {
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [chips, setChips] = useState<ChipSugerido[]>([]);
  const [estado, setEstado] = useState<EstadoConversacion>(() => inicioConversacion().estado);
  const [input, setInput] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [creando, setCreando] = useState(false);

  const scroll = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const idRef = useRef(0);
  const estadoRef = useRef(estado);
  const ocupado = useRef(false);
  const vivo = useRef(true);
  const arranco = useRef(false);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const pushMsg = useCallback((quien: Msg["quien"], texto: string) => {
    setMensajes((ms) => [...ms, { id: ++idRef.current, quien, texto }]);
  }, []);

  // Encola la salida del asistente: puntos animados cortos entre mensajes.
  const hablar = useCallback(
    async (salida: SalidaBot) => {
      if (salida.irAForm) {
        onIrAForm();
        return;
      }
      if (salida.mensajes.length) setEscribiendo(true);
      for (const m of salida.mensajes) {
        await dormir(420 + Math.random() * 260);
        if (!vivo.current) return;
        setEscribiendo(false);
        pushMsg("bot", m);
        if (m !== salida.mensajes[salida.mensajes.length - 1]) setEscribiendo(true);
      }
      setEscribiendo(false);
      if (vivo.current) setChips(salida.chips);
    },
    [onIrAForm, pushMsg],
  );

  const crear = useCallback(
    async (d: Draft) => {
      ocupado.current = true;
      setCreando(true);
      setEscribiendo(true);
      try {
        const uid = await getUserId();
        if (!uid) {
          await hablar({
            mensajes: ["No encuentro tu sesión. Entrá de nuevo o usá el formulario."],
            chips: [{ label: "Completar en el formulario", enviar: "cmd:form" }],
          });
          return;
        }
        const res = await createAgreement({
          userId: uid,
          template: d.template ?? "guarantee",
          title: d.titulo ?? "Acuerdo",
          terms: d.condiciones ?? "",
          creatorLabel: "Vos",
          counterpartyLabel: d.contraparte ?? "La otra parte",
          amountCents: d.amountCents ?? 0,
          acceptDeadlineSec: (d.acceptDays ?? 3) * 86400,
          reviewDeadlineSec: (d.reviewDays ?? 14) * 86400,
        });
        if (res.id) {
          await rememberAgreement(uid, res.id);
          onCreated(res.id);
          return;
        }
        throw new Error("sin_id");
      } catch (e) {
        const msg = e instanceof ApiError ? e.human : humanize(String(e));
        await hablar({
          mensajes: [`No pude crearlo: ${msg}`],
          chips: [
            { label: "Reintentar", enviar: "crear" },
            { label: "Completar en el formulario", enviar: "cmd:form" },
          ],
        });
      } finally {
        ocupado.current = false;
        setCreando(false);
        setEscribiendo(false);
      }
    },
    [hablar, onCreated],
  );

  const enviar = useCallback(
    (texto: string, label?: string) => {
      const limpio = texto.trim();
      if (!limpio || ocupado.current) return;
      ocupado.current = true;
      pushMsg("yo", label ?? limpio);
      setInput("");
      setChips([]);
      const r = interpretar(limpio, estadoRef.current);
      estadoRef.current = r.estado;
      setEstado(r.estado);
      void (async () => {
        await hablar(r.salida);
        ocupado.current = false;
        if (r.confirmado && vivo.current) await crear(r.estado.draft);
      })();
    },
    [crear, hablar, pushMsg],
  );

  // Saludo inicial una sola vez (StrictMode monta dos veces en dev).
  useEffect(() => {
    if (arranco.current) return;
    arranco.current = true;
    void hablar(inicioConversacion().salida);
  }, [hablar]);

  const bloqueado = escribiendo || creando;

  return (
    <KeyboardAvoidingView
      style={st.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={st.head}>
        <Text style={st.h1}>Nuevo acuerdo por chat</Text>
        <Text style={st.honesto}>
          Asistente guiado — entiendo frases comunes; si trabo, pasás al formulario.
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        style={st.flex}
        contentContainerStyle={st.lista}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.map((m) =>
          m.quien === "yo" ? (
            <View key={m.id} style={st.filaYo}>
              <View style={st.burbujaYo}>
                <Text style={st.txtYo}>{m.texto}</Text>
              </View>
            </View>
          ) : (
            <View key={m.id} style={st.filaBot}>
              <View style={st.ca}>
                <Text style={st.caTxt}>CA</Text>
              </View>
              <View style={st.burbujaBot}>
                <Text style={st.txtBot}>{m.texto}</Text>
              </View>
            </View>
          ),
        )}
        {escribiendo ? (
          <View style={st.filaBot}>
            <View style={st.ca}>
              <Text style={st.caTxt}>CA</Text>
            </View>
            <View style={[st.burbujaBot, st.burbujaPuntos]}>
              <Puntos />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {chips.length > 0 ? (
        <View style={st.chipsWrap}>
          {chips.map((c, i) => (
            <Pressable
              key={`${c.enviar}-${i}`}
              disabled={bloqueado}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              onPress={() => enviar(c.enviar, c.label)}
              style={({ pressed }) => [
                st.chip,
                c.primario && st.chipPrim,
                pressed && { opacity: 0.75 },
                bloqueado && { opacity: 0.45 },
              ]}
            >
              <Text style={[st.chipTxt, c.primario && st.chipTxtPrim]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={st.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={PLACEHOLDER[estado.paso]}
          placeholderTextColor={C.muted + "80"}
          style={st.input}
          onSubmitEditing={() => enviar(input)}
          returnKeyType="send"
          blurOnSubmit={false}
          autoCapitalize="sentences"
          autoCorrect={false}
          editable={!creando}
          accessibilityLabel="Mensaje para el asistente"
        />
        <Pressable
          onPress={() => enviar(input)}
          disabled={!input.trim() || bloqueado}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          style={({ pressed }) => [
            st.send,
            (!input.trim() || bloqueado) && st.sendOff,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={st.sendTxt}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// Tres puntos de "escribiendo…": animación corta, sin teatro.
function Puntos() {
  const [v1] = useState(() => new Animated.Value(0.25));
  const [v2] = useState(() => new Animated.Value(0.25));
  const [v3] = useState(() => new Animated.Value(0.25));
  useEffect(() => {
    const ciclo = (v: Animated.Value, demora: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(demora),
          Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        ]),
      );
    const a1 = ciclo(v1, 0);
    const a2 = ciclo(v2, 160);
    const a3 = ciclo(v3, 320);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [v1, v2, v3]);
  return (
    <View style={st.puntos}>
      {[v1, v2, v3].map((v, i) => (
        <Animated.View key={i} style={[st.punto, { opacity: v }]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10, gap: 3 },
  h1: { color: C.ink, fontSize: 20, fontWeight: "800" },
  honesto: { color: C.muted, fontSize: 12.5, lineHeight: 17 },
  lista: { paddingHorizontal: 18, paddingBottom: 14, gap: 10 },
  filaYo: { flexDirection: "row", justifyContent: "flex-end" },
  filaBot: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  ca: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  caTxt: { color: C.ice, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  burbujaYo: {
    maxWidth: "82%",
    backgroundColor: C.blue,
    borderRadius: R.card,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  burbujaBot: {
    maxWidth: "82%",
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    paddingVertical: 10,
    paddingHorizontal: 13,
    flexShrink: 1,
  },
  burbujaPuntos: { paddingVertical: 14 },
  txtYo: { color: "#FFFFFF", fontSize: 15, lineHeight: 20 },
  txtBot: { color: C.ink, fontSize: 15, lineHeight: 21 },
  puntos: { flexDirection: "row", gap: 5, alignItems: "center" },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  chip: {
    minHeight: 44,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  chipPrim: { backgroundColor: C.blue, borderColor: C.blue },
  chipTxt: { color: C.ink, fontSize: 13.5, fontWeight: "600" },
  chipTxtPrim: { color: "#FFFFFF" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    minHeight: HIT,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.control,
    backgroundColor: C.surface,
    color: C.ink,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  send: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { opacity: 0.4 },
  sendTxt: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: -2 },
});
