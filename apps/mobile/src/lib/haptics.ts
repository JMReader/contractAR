// Haptics chicos y consistentes: ticks de selección, confirmación y alerta.
// Nunca en animaciones decorativas continuas — sólo en gestos del usuario.
// En web (export estático de la demo) no hay motor háptico: no-op.

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const nativo = Platform.OS !== "web";
const safe = (fn: () => Promise<unknown>) => {
  if (nativo) void fn().catch(() => {});
};

/** Tick leve: cambio de selección, marca de checklist, cruce de umbral. */
export const hTick = () => safe(() => Haptics.selectionAsync());

/** Gesto comprometido: knob pasó el umbral, slider llegó a un borde. */
export const hCommit = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Acción confirmada y aceptada. */
export const hDone = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Acción destructiva o error visible. */
export const hWarn = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
