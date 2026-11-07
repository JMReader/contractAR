// SlideConfirm: deslizar el handle; pasada la marca el gesto se completa solo.
// Equivalente nativo conceptual de "Slide to confirm" (bencho.dev) — mismo
// comportamiento, implementación propia con Reanimated + Gesture Handler.
// En acciones de plata el gesto deliberado reemplaza al tap; el resultado lo
// decide el API, no la animación. Haptics: tick al cruzar la marca, éxito al
// confirmar.

import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { C, HIT, R } from "../lib/theme";
import { hDone, hTick } from "../lib/haptics";

const KNOB = 44;
const THRESHOLD = 0.72;

export function SlideConfirm({
  label,
  onConfirm,
  busy = false,
  disabled = false,
  peligrosa = false,
}: {
  label: string;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
  peligrosa?: boolean;
}) {
  const [ancho, setAncho] = useState(0);
  const [hecho, setHecho] = useState(false);
  const x = useSharedValue(0);
  const max = Math.max(0, ancho - KNOB - 8);
  const acento = peligrosa ? C.coral : C.blue;
  const off = disabled || busy;

  const disparar = () => {
    hDone();
    setHecho(true);
    onConfirm();
    // Reset suave para un próximo uso (la hoja suele cerrarse antes).
    setTimeout(() => {
      x.value = withTiming(0, { duration: 260 });
      setHecho(false);
    }, 900);
  };

  const cruzo = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!off && !hecho)
    .onUpdate((e) => {
      "worklet";
      x.value = Math.min(Math.max(0, e.translationX), max);
      const paso = x.value >= max * THRESHOLD;
      if (paso && cruzo.value === 0) {
        // Tick al cruzar la marca (una sola vez por cruce).
        cruzo.value = 1;
        runOnJS(hTick)();
      } else if (!paso) {
        cruzo.value = 0;
      }
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationX >= max * THRESHOLD) {
        // Pasada la marca el gesto "takes over": viaja solo hasta el borde.
        x.value = withTiming(max, { duration: 130 });
        runOnJS(disparar)();
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const stKnob = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const stTrail = useAnimatedStyle(() => ({
    width: x.value + KNOB + 8,
  }));
  const stLabel = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, max * THRESHOLD], [1, 0.12]),
  }));
  const stTick = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [max * (THRESHOLD - 0.1), max * THRESHOLD],
      [0.25, 1],
    ),
  }));

  if (Platform.OS === "web") return <Pressable accessibilityRole="button" accessibilityState={{ disabled: off, busy }} disabled={off || hecho} onPress={disparar} style={{ minHeight: HIT, borderRadius: R.control, backgroundColor: acento, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, opacity: off ? 0.5 : 1 }}><Text style={{ color: C.bg, fontWeight: "800", textAlign: "center" }}>{busy ? "Procesando…" : label}</Text></Pressable>;
  return (
    <GestureDetector gesture={pan}>
      <View
        style={[st.track, off && { opacity: 0.45 }]}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: deslizar hacia la derecha para confirmar`}
        accessibilityState={{ disabled: off, busy }}
      >
        {/* Trail de acento que crece bajo el dedo */}
        <Animated.View
          style={[
            st.trail,
            { backgroundColor: acento + "30" },
            stTrail,
          ]}
        />
        <Animated.Text style={[st.label, stLabel]}>
          {hecho ? "Listo" : busy ? "Procesando…" : label}
        </Animated.Text>
        {/* Marca del umbral: se enciende al acercarse */}
        <Animated.View style={[st.marca, stTick]}>
          <View style={[st.marcaBarra, { backgroundColor: acento }]} />
        </Animated.View>
        <Animated.View style={[st.knob, { backgroundColor: acento }, stKnob]}>
          {busy ? (
            <ActivityIndicator color={C.bg} />
          ) : hecho ? (
            <Text style={st.knobTxt}>✓</Text>
          ) : (
            <Text style={st.knobTxt}>→</Text>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const st = StyleSheet.create({
  track: {
    height: HIT + 8,
    borderRadius: R.control + 6,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.elevated,
    justifyContent: "center",
    overflow: "hidden",
  },
  trail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: R.control + 6,
  },
  label: {
    position: "absolute",
    alignSelf: "center",
    color: C.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  marca: {
    position: "absolute",
    right: 10,
    top: 8,
    bottom: 8,
    justifyContent: "center",
  },
  marcaBarra: { width: 3, borderRadius: 2, flex: 1 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  knobTxt: { color: C.bg, fontSize: 20, fontWeight: "800" },
});
