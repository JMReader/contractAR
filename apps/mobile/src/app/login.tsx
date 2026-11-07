// Login hero: ilustración lapicera anclada arriba (el apretón queda visible),
// fade corto al navy, marca oficial debajo de la imagen y formulario de la
// demo en card. La imagen real la generó GPT; assets/hero-login.png ya es la
// versión recoloreada a la paleta.

import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { setUserId, userIdFromLogin } from "../lib/session";
import { C, R } from "../lib/theme";
import { Btn, DemoTag, Field } from "../components/ui";

// hero-login.png: 1103×1426 — aspectRatio para que el ancho mande y el
// contenedor recorte por abajo (se ve la escena completa: sello + apretón).
const HERO_AR = 1103 / 1426;

export default function Login() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("demo");
  const [error, setError] = useState<string>();
  // El apretón vive al ~62% del alto de la imagen: el recorte tiene que
  // mostrar ≥~82% de la escena para que quede por encima del fade.
  const heroH = Math.min(height * 0.30, 270);

  const entrar = async () => {
    if (usuario.trim().length < 2) {
      setError("Ingresá un usuario para identificarte en la demo.");
      return;
    }
    if (clave.length < 4) {
      setError("Usá al menos 4 caracteres para entrar a la demo.");
      return;
    }
    await setUserId(userIdFromLogin(usuario));
    const next = Platform.OS === "web" ? sessionStorage.getItem("contractar.return") : null;
    if (Platform.OS === "web") sessionStorage.removeItem("contractar.return");
    router.replace((next || "/") as "/");
  };

  return (
    <SafeAreaView style={st.raiz} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={st.flex}
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Arte: ancho completo, clip por abajo, fade sólo en el borde */}
          <View style={[st.heroWrap, { height: heroH }]}>
            <Image
              source={require("../../assets/hero-login.png")}
              style={{ width: "100%", aspectRatio: HERO_AR }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={["transparent", "rgba(15,23,41,0.45)", C.bg]}
              locations={[0.82, 0.94, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Marca en la banda navy — no pisa la ilustración */}
          <View style={st.marca}>
            <Image
              source={require("../../assets/logo-dark.png")}
              style={st.logo}
              resizeMode="contain"
              accessibilityLabel="ContractAR"
            />
            <Text style={st.sub}>
              Tus acuerdos con plata protegida, en pesos.
            </Text>
            <DemoTag texto="Demo" />
          </View>

          {/* Formulario de la demo */}
          <View style={st.card}>
            <Field
              label="Usuario o email"
              value={usuario}
              onChangeText={setUsuario}
              placeholder="Ej.: ana.renta"
              autoCapitalize="none"
              error={error}
            />
            <Field
              label="Contraseña"
              value={clave}
              onChangeText={setClave}
              placeholder="Clave de demostración"
              autoCapitalize="none"
              secureTextEntry
            />
            <Btn titulo="Ingresar a la demo" onPress={entrar} />
            <Text style={st.nota}>
              Pantalla de demostración: no hay autenticación real ni datos
              verdaderos. El usuario que elijas se usa como identidad de la
              demo.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  heroWrap: { width: "100%", overflow: "hidden" },
  marca: { alignItems: "center", gap: 10, paddingTop: 4, paddingBottom: 16 },
  // logo-dark.png: 1123×635 (isotipo + wordmark, versión dark del logo oficial)
  logo: { width: 132, height: 74 },
  sub: { color: C.muted, fontSize: 14, textAlign: "center" },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    padding: 18,
    gap: 14,
    marginHorizontal: 18,
  },
  nota: { color: C.muted, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
});
