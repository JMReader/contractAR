// Primitivas de la app: superficies neutras, cobalt sólo en la acción primaria,
// verde para lo protegido/liquidado, coral para alerta y peligro.
// CopyLink y StageTrack son equivalentes nativos de bloques públicos de
// bencho.dev (copy-field y progress-tracker): mismo comportamiento, UI propia
// con los tokens ContractAR. No es código copiado del bloque web.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, HIT, R } from "../lib/theme";
import { hTick } from "../lib/haptics";
import type { Tono } from "../lib/domain";
import { IconCheck, IconCopy, IconShare, IconWarn } from "./icons";

// ── Base ─────────────────────────────────────────────────────────────────────

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={st.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          style={st.flex}
          contentContainerStyle={st.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[st.flex, st.scrollContent]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function DemoTag({ texto = "Demo" }: { texto?: string }) {
  return (
    <View style={st.demoTag} accessibilityLabel={`Etiqueta: ${texto}`}>
      <Text style={st.demoTagText}>{texto}</Text>
    </View>
  );
}

const TONO_COLOR: Record<Tono, string> = {
  neutro: C.muted,
  activo: C.ice,
  exito: C.green,
  alerta: C.coral,
};

export function StatePill({ label, tono }: { label: string; tono: Tono }) {
  const color = TONO_COLOR[tono];
  return (
    <View style={[st.pill, { borderColor: color }]}>
      <Text style={[st.pillText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Botones ──────────────────────────────────────────────────────────────────

export function Btn({
  titulo,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  icono,
}: {
  titulo: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
  disabled?: boolean;
  icono?: React.ReactNode;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        st.btn,
        variant === "primary" && st.btnPrimary,
        variant === "secondary" && st.btnSecondary,
        variant === "danger" && st.btnDanger,
        variant === "ghost" && st.btnGhost,
        pressed && !off && st.pressed,
        off && st.btnOff,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? C.bg : C.ice} />
      ) : (
        <View style={st.btnRow}>
          {icono}
          <Text
            style={[
              st.btnText,
              variant === "primary" && st.btnTextPrimary,
              variant === "secondary" && { color: C.ink },
              variant === "danger" && { color: C.coral },
              variant === "ghost" && { color: C.ice },
            ]}
          >
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Campos ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  ayuda,
  multiline = false,
  keyboardType,
  maxLength,
  autoCapitalize = "sentences",
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  ayuda?: string;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad" | "number-pad" | "email-address";
  maxLength?: number;
  autoCapitalize?: "none" | "sentences";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={st.fieldWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted + "80"}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        style={[
          st.input,
          multiline && st.inputMulti,
          error ? st.inputError : null,
        ]}
      />
      {error ? (
        <Text style={st.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : ayuda ? (
        <Text style={st.fieldAyuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

// ── Estados de vista (vacío / carga / error dicen causa y acción) ────────────

export function Cargando({ texto }: { texto: string }) {
  return (
    <View style={st.estadoWrap}>
      <ActivityIndicator size="large" color={C.ice} />
      <Text style={st.estadoTexto}>{texto}</Text>
    </View>
  );
}

export function ErrorVista({
  titulo,
  mensaje,
  onReintentar,
}: {
  titulo: string;
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <View style={st.estadoWrap}>
      <IconWarn size={30} color={C.coral} />
      <Text style={st.estadoTitulo}>{titulo}</Text>
      <Text style={st.estadoTexto}>{mensaje}</Text>
      <Btn titulo="Reintentar" variant="secondary" onPress={onReintentar} />
    </View>
  );
}

export function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: React.ReactNode;
}) {
  return (
    <View style={st.estadoWrap}>
      <Text style={st.estadoTitulo}>{titulo}</Text>
      <Text style={st.estadoTexto}>{texto}</Text>
      {accion}
    </View>
  );
}

// ── Skeleton: filas fantasma con la forma del contenido ──────────────────────
// Equivalente nativo conceptual de "Skeleton morph" (bencho.dev): barras que
// ocupan el lugar de la card real — menos tiempo percibido que un spinner.

export function SkeletonRows({ filas = 3 }: { filas?: number }) {
  const op = useSharedValue(0.4);
  useEffect(() => {
    op.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true);
  }, [op]);
  const stOp = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: filas }).map((_, i) => (
        <Animated.View key={i} style={[st.skelFila, stOp]}>
          <View style={st.skelTop}>
            <View style={[st.skelBar, { width: "55%" }]} />
            <View style={[st.skelBar, { width: 74, height: 20 }]} />
          </View>
          <View style={[st.skelBar, { width: "35%", height: 18 }]} />
          <View style={[st.skelBar, { width: "70%", height: 12 }]} />
        </Animated.View>
      ))}
    </View>
  );
}

// ── Banner demo persistente ──────────────────────────────────────────────────

export function Banner({ texto }: { texto: string }) {
  return (
    <View style={st.banner}>
      <Text style={st.bannerTexto}>{texto}</Text>
    </View>
  );
}

// ── CopyLink: equivalente nativo de "Copy field" (bencho) ────────────────────
// Campo con el enlace + botón copiar que se convierte en check; además share
// nativo porque la contraparte acepta por link desde otro dispositivo.

export function CopyLink({ url, label, purpose = "accept" }: { url: string; label: string; purpose?: "accept" | "result" }) {
  const [copiado, setCopiado] = useState(false);
  const sheen = useSharedValue(-80);
  const [anchoRow, setAnchoRow] = useState(0);

  const copiar = async () => {
    try {
      await Clipboard.setStringAsync(url);
    } catch {
      // Web sobre http:// LAN no es contexto seguro: puede no haber clipboard.
      // El URL queda seleccionable en el campo para copiar a mano.
    }
    hTick();
    setCopiado(true);
    // Sheen: banda suave que atraviesa el texto una vez (bencho copy-field).
    sheen.value = -80;
    sheen.value = withTiming(anchoRow + 60, { duration: 480 });
    setTimeout(() => setCopiado(false), 1600);
  };

  // Share no existe en react-native-web; en browser se usa la Web Share API
  // (disponible en mobile) y si no, copiar como fallback.
  const compartir = async () => {
    if (Platform.OS === "web") {
      const nav = globalThis.navigator as
        | (Navigator & { share?: (d: { url: string }) => Promise<void> })
        | undefined;
      if (nav?.share) {
        try {
          await nav.share({ url });
          return;
        } catch {
          return; // el usuario canceló el diálogo nativo
        }
      }
      return copiar();
    }
    void Share.share({ message: url });
  };

  const stSheen = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value }],
  }));

  return (
    <View style={st.copyWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View style={st.copyRow} onLayout={(e) => setAnchoRow(e.nativeEvent.layout.width)}>
        <Text numberOfLines={1} style={st.copyUrl} selectable>
          {url}
        </Text>
        <Animated.View pointerEvents="none" style={[st.sheen, stSheen]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copiado ? "Enlace copiado" : "Copiar enlace"}
          onPress={copiar}
          style={({ pressed }) => [st.copyBtn, pressed && st.pressed]}
        >
          {copiado ? (
            <Animated.View entering={FadeIn.duration(120)} key="check">
              <IconCheck size={18} color={C.green} />
            </Animated.View>
          ) : (
            <IconCopy size={18} color={C.ice} />
          )}
        </Pressable>
      </View>
      <Btn titulo="Enviar por WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${purpose === "result" ? "Te comparto el resultado actualizado de nuestro acuerdo" : "Te comparto nuestro acuerdo para revisar y aceptar"} en la demo de ContractAR: ${url}`)}`)} />
      <Btn titulo="Abrir enlace compartido" variant="ghost" onPress={() => void Linking.openURL(url)} />
      <Btn
        titulo={copiado ? "Copiado" : "Más opciones para compartir"}
        variant="secondary"
        icono={<IconShare size={18} color={C.ice} />}
        onPress={() => void compartir()}
      />
    </View>
  );
}

// ── StageTrack: equivalente nativo de "Progress tracker" (bencho) ────────────
// Filas de etapas: hechas con tick, la actual marcada; sin explosiones, la app
// es operativa (dial MOTION bajo).

// Cada tramo/dote entra con un spring escalonado: el progreso "spring on"
// (bencho progress-tracker) sin explosiones — la app es operativa.
function StageDot({ done, actual, delay }: { done: boolean; actual: boolean; delay: number }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withDelay(
      delay,
      withSpring(done ? 1 : 0, { damping: 14, stiffness: 240 }),
    );
  }, [done, delay, fill]);
  const stFill = useAnimatedStyle(() => ({
    transform: [{ scale: fill.value }],
    opacity: fill.value,
  }));
  return (
    <View style={[st.stageDot, actual && st.stageDotActual]}>
      <Animated.View style={[st.stageDotFill, stFill]}>
        <IconCheck size={12} color={C.bg} />
      </Animated.View>
    </View>
  );
}

function StageLine({ done, delay }: { done: boolean; delay: number }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.value = withDelay(delay, withTiming(done ? 1 : 0, { duration: 240 }));
  }, [done, delay, fill]);
  const stFill = useAnimatedStyle(() => ({
    transform: [{ scaleY: fill.value }],
  }));
  return (
    <View style={st.stageLine}>
      <Animated.View style={[st.stageLineFill, stFill]} />
    </View>
  );
}

export function StageTrack({ pasos }: { pasos: { label: string; done: boolean; actual: boolean }[] }) {
  return (
    <View>
      {pasos.map((p, i) => (
        <View key={i} style={st.stageRow}>
          <StageDot done={p.done} actual={p.actual} delay={i * 90} />
          {i < pasos.length - 1 ? <StageLine done={p.done} delay={i * 90 + 45} /> : null}
          <Text
            style={[
              st.stageLabel,
              p.done && st.stageLabelDone,
              p.actual && st.stageLabelActual,
            ]}
          >
            {p.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Fila clave/valor ─────────────────────────────────────────────────────────

export function KV({ k, v, mono = false, accent, href }: { k: string; v: string; mono?: boolean; accent?: string; href?: string }) {
  const cuerpo = (
    <>
      <Text style={st.kvK}>{k}</Text>
      <Text
        style={[st.kvV, mono && st.mono, accent ? { color: accent } : null, href && st.kvLink]}
        selectable={mono && !href}
        numberOfLines={1}
      >
        {v}
        {href ? " ↗" : ""}
      </Text>
    </>
  );
  if (href) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${k}: abrir en el explorador`}
        onPress={() => void Linking.openURL(href)}
        style={({ pressed }) => [st.kvRow, pressed && { opacity: 0.6 }]}
      >
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={st.kvRow}>{cuerpo}</View>;
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 32, gap: 14 },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    padding: 16,
    gap: 12,
  },
  demoTag: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  demoTagText: { color: C.coral, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: "700" },
  btn: {
    minHeight: HIT,
    borderRadius: R.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnPrimary: { backgroundColor: C.blue },
  btnSecondary: { borderWidth: 1, borderColor: C.line },
  btnDanger: { borderWidth: 1, borderColor: C.coral },
  btnGhost: { minHeight: 40 },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  btnText: { fontSize: 15, fontWeight: "700" },
  btnTextPrimary: { color: C.bg },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: C.ink, fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: HIT,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.control,
    backgroundColor: C.bg,
    color: C.ink,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  inputMulti: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  inputError: { borderColor: C.coral },
  fieldError: { color: C.coral, fontSize: 13, fontWeight: "600" },
  fieldAyuda: { color: C.muted, fontSize: 13 },
  estadoWrap: { alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 12 },
  estadoTitulo: { color: C.ink, fontSize: 17, fontWeight: "700", textAlign: "center" },
  estadoTexto: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  banner: {
    backgroundColor: C.elevated,
    borderRadius: R.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerTexto: { color: C.muted, fontSize: 12.5, textAlign: "center" },
  copyWrap: { gap: 8 },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.control,
    backgroundColor: C.bg,
    paddingLeft: 12,
    minHeight: HIT,
    overflow: "hidden",
  },
  sheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: C.ice + "28",
    transform: [{ skewX: "-18deg" }],
  },
  copyUrl: { flex: 1, color: C.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
  copyBtn: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: C.lineSoft,
  },
  skelFila: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    padding: 14,
    gap: 10,
  },
  skelTop: { flexDirection: "row", justifyContent: "space-between" },
  skelBar: { height: 14, borderRadius: 6, backgroundColor: C.elevated },
  stageRow: { flexDirection: "row", alignItems: "center", minHeight: 34, gap: 12 },
  stageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },
  stageDotFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  stageDotActual: { borderColor: C.ice },
  stageLine: {
    position: "absolute",
    left: 9.5,
    top: 30,
    bottom: -6,
    width: 1.6,
    backgroundColor: C.lineSoft,
    overflow: "hidden",
  },
  stageLineFill: {
    flex: 1,
    backgroundColor: C.green + "88",
    transformOrigin: "50% 0%",
  },
  stageLabel: { color: C.muted, fontSize: 14 },
  stageLabelDone: { color: C.ink },
  stageLabelActual: { color: C.ice, fontWeight: "700" },
  kvRow: { flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 4 },
  kvK: { color: C.muted, fontSize: 14 },
  kvV: { color: C.ink, fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  kvLink: { color: C.blue, textDecorationLine: "underline" },
  mono: { fontFamily: "Menlo", fontSize: 12.5, fontWeight: "400" },
});
