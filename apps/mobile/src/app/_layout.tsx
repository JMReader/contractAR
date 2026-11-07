import { importPresentationSnapshot } from "../lib/presentation";
// Layout raíz: Stack + guardia de sesión. Sin userId guardado → /login.
// La sesión se relee en cada cambio de ruta: si quedara cacheada del mount,
// el login "recarga" y vuelve — el replace("/") llega con el estado viejo.

import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getUserId } from "../lib/session";
import { C } from "../lib/theme";

export default function RootLayout() {
  const [listo, setListo] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let vivo = true;
    importPresentationSnapshot().then(() => getUserId()).then((id) => {
      if (!vivo) return;
      const enLogin = segments[0] === "login";
      if (!id && !enLogin) router.replace("/login");
      else if (id && enLogin) router.replace("/");
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, [segments, router]);

  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {/* En web/desktop la app corre como "phone shell": fondo navy a ventana
          completa y columna de 480px con filetes laterales. En nativo es
          transparente (width 100%). */}
      <View style={webShell.outer}>
        <View style={webShell.columna}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.ink,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: C.bg },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="acuerdo/[id]" options={{ title: "Acuerdo" }} />
          </Stack>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const ANCHO_APP = 480;

const webShell = {
  // #root ya es height:100% (reset de expo): con flex:1 el navy llena la
  // ventana sin position:fixed (que no es un valor válido en los tipos RN).
  outer:
    Platform.OS === "web"
      ? ({ flex: 1, backgroundColor: C.bg } as const)
      : ({ flex: 1 } as const),
  columna:
    Platform.OS === "web"
      ? ({
          flex: 1,
          width: "100%",
          maxWidth: ANCHO_APP,
          alignSelf: "center",
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: C.lineSoft,
        } as const)
      : ({ flex: 1 } as const),
};
