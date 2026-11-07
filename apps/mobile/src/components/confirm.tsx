// Confirmaciones de la app.
// ConfirmSheet: hoja de revisión para acciones de dinero — monto, efecto y
// consentimiento explícito (equivalente nativo del patrón checklist de
// bencho.dev: el botón no se habilita hasta marcar la lectura).
// InlineConfirm: el botón se convierte en su propia confirmación para acciones
// peligrosas sin monto (equivalente nativo del "Inline confirm" de bencho.dev).

import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { C, HIT, R } from "../lib/theme";
import { hTick, hWarn } from "../lib/haptics";
import { Btn } from "./ui";
import { SlideConfirm } from "./slideConfirm";
import { IconCheck } from "./icons";

export interface LineaConfirm {
  label: string;
  valor: string;
}

export function ConfirmSheet({
  data,
  busy,
  onConfirm,
  onCancel,
}: {
  data: {
    titulo: string;
    lineas: LineaConfirm[];
    efecto: string;
    cta: string;
    peligrosa?: boolean;
    /** Si está, exige marcar el consentimiento antes de confirmar. */
    consent?: string;
  } | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState<typeof data>(null);
  const consentido = data !== null && accepted === data;

  return (
    <Modal
      visible={data !== null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={st.backdrop} onPress={onCancel} accessibilityLabel="Cerrar" />
      <View style={st.sheet}>
        <View style={st.handle} />
        {data ? (
          <>
            <Text style={st.titulo}>{data.titulo}</Text>
            <View style={st.lineas}>
              {data.lineas.map((l) => (
                <View key={l.label} style={st.linea}>
                  <Text style={st.lineaK}>{l.label}</Text>
                  <Text style={st.lineaV}>{l.valor}</Text>
                </View>
              ))}
            </View>
            <Text style={st.efecto}>{data.efecto}</Text>
            {data.consent ? (
              <ConsentCheck
                texto={data.consent}
                marcado={consentido}
                onToggle={() => {
                  hTick();
                  setAccepted(consentido ? null : data);
                }}
              />
            ) : null}
            <View style={st.botones}>
              <Btn titulo="Volver" variant="ghost" onPress={onCancel} />
              <View style={{ flex: 1 }}>
                <SlideConfirm
                  label={data.cta}
                  peligrosa={data.peligrosa}
                  busy={busy}
                  disabled={data.consent !== undefined && !consentido}
                  onConfirm={onConfirm}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

// Checklist (bencho): la caja se llena y el tick entra con pop. El texto se
// mantiene legible — es el consentimiento de una acción de plata.
function ConsentCheck({
  texto,
  marcado,
  onToggle,
}: {
  texto: string;
  marcado: boolean;
  onToggle: () => void;
}) {
  const fill = useSharedValue(marcado ? 1 : 0);
  useEffect(() => {
    fill.value = withSpring(marcado ? 1 : 0, { damping: 13, stiffness: 300 });
  }, [marcado, fill]);
  const stFill = useAnimatedStyle(() => ({
    transform: [{ scale: fill.value }],
    opacity: fill.value,
  }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      onPress={onToggle}
      style={({ pressed }) => [st.consent, pressed && { opacity: 0.75 }]}
    >
      <View style={st.check}>
        <Animated.View style={[st.checkFill, stFill]}>
          <IconCheck size={14} color={C.bg} />
        </Animated.View>
      </View>
      <Text style={[st.consentTexto, marcado && { color: C.muted }]}>{texto}</Text>
    </Pressable>
  );
}

export function InlineConfirm({
  titulo,
  confirmar,
  onConfirm,
  busy = false,
  disabled = false,
}: {
  titulo: string;
  /** Texto del segundo toque, ej. "Confirmar cancelación". */
  confirmar: string;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={armado ? confirmar : titulo}
      disabled={disabled || busy}
      onPress={() => {
        if (armado) {
          hWarn();
          setArmado(false);
          onConfirm();
        } else {
          hTick();
          setArmado(true);
        }
      }}
      style={({ pressed }) => [
        st.inline,
        armado && st.inlineArmed,
        (pressed || disabled || busy) && { opacity: 0.7 },
      ]}
    >
      <Text style={[st.inlineTexto, armado && st.inlineTextoArmed]}>
        {busy ? "Procesando…" : armado ? confirmar : titulo}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,6,9,0.6)" },
  sheet: {
    backgroundColor: C.surface,
    // En web/desktop el Modal cubre la ventana entera: la hoja queda como
    // columna del mismo ancho que el app-shell (480px) en vez de full-bleed.
    ...(Platform.OS === "web"
      ? { width: "100%" as const, maxWidth: 480, alignSelf: "center" as const }
      : null),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.line,
    marginBottom: 4,
  },
  titulo: { color: C.ink, fontSize: 17, fontWeight: "700" },
  lineas: { gap: 6 },
  linea: { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  lineaK: { color: C.muted, fontSize: 14 },
  lineaV: { color: C.ink, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  efecto: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  consent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: HIT,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  checkFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  consentTexto: { color: C.ink, fontSize: 13.5, flex: 1, lineHeight: 18 },
  botones: { flexDirection: "row", alignItems: "center", gap: 10 },
  inline: {
    minHeight: HIT,
    borderRadius: R.control,
    borderWidth: 1,
    borderColor: C.coral,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  inlineArmed: { backgroundColor: C.coral + "1A", borderColor: C.coral },
  inlineTexto: { color: C.coral, fontSize: 15, fontWeight: "700" },
  inlineTextoArmed: { color: C.coral },
});
