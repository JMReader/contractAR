// SplitSlider: arrastrar para repartir un total entre dos partes.
// Equivalente nativo conceptual de "Budget slider" (bencho.dev): el drag llena
// la barra bajo el dedo — acá el lleno ES el reparto (A recibe, B recupera el
// resto). Pesos enteros; la suma siempre cierra en el total.

import { useState } from "react";
import { PanResponder, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { C, R } from "../lib/theme";
import { hTick } from "../lib/haptics";
import { formatARS } from "../lib/domain";

export function SplitSlider({
  total,
  value,
  onChange,
  labelA,
  labelB,
  colorA = C.ice,
  colorB = C.line,
}: {
  total: number;
  /** Centavos que recibe la parte A. */
  value: number;
  onChange: (centavos: number) => void;
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
}) {
  const [ancho, setAncho] = useState(0);
  // Tick háptico al cruzar cada cuarto del reparto (feedback del dedo).
  const [lastBucket, setLastBucket] = useState(-1);

  const valorDesdeX = (e: GestureResponderEvent) => {
    if (ancho <= 0) return value;
    const fraccion = Math.min(1, Math.max(0, e.nativeEvent.locationX / ancho));
    const bucket = Math.round(fraccion * 4);
    if (bucket !== lastBucket) {
      setLastBucket(bucket);
      hTick();
    }
    return Math.round((fraccion * total) / 100) * 100;
  };

  const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(valorDesdeX(e)),
      onPanResponderMove: (e) => onChange(valorDesdeX(e)),
    });

  const frac = total > 0 ? value / total : 0;

  return (
    <View>
      <View
        style={st.zona}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Reparto: ${formatARS(value)} para ${labelA} y ${formatARS(total - value)} para ${labelB}`}
        accessibilityValue={{ text: `${Math.round(frac * 100)} por ciento para ${labelA}` }}
      >
        <View style={st.track}>
          <View style={[st.fill, { width: `${frac * 100}%`, backgroundColor: colorA }]} />
          <View style={[st.fillB, { backgroundColor: colorB }]} />
        </View>
        <View style={[st.knob, { left: `${frac * 100}%`, borderColor: colorA }]} />
      </View>
      <View style={st.etiquetas}>
        <Text style={[st.etA, { color: colorA }]} numberOfLines={1}>
          {formatARS(value)} · {labelA}
        </Text>
        <Text style={st.etB} numberOfLines={1}>
          {formatARS(total - value)} · {labelB}
        </Text>
      </View>
    </View>
  );
}

const KNOB = 26;

const st = StyleSheet.create({
  zona: { height: 44, justifyContent: "center" },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: C.elevated,
    overflow: "hidden",
    flexDirection: "row",
  },
  fill: { height: "100%" },
  fillB: { flex: 1, height: "100%" },
  knob: {
    position: "absolute",
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: C.surface,
    borderWidth: 3,
    marginLeft: -KNOB / 2,
  },
  etiquetas: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  etA: { fontSize: 13.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  etB: { color: C.muted, fontSize: 13.5, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
