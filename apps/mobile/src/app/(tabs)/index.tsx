// Tab Acuerdos: lista con estado en texto, monto en $, tu rol y próximo paso.
// Pull-to-refresh. El listado del server se intenta primero; si no existe aún,
// se hidratan los ids que este usuario creó desde el teléfono (AsyncStorage).

import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ApiError,
  getAgreement,
  listAgreements,
  humanize,
  type AgreementSummary,
} from "../../lib/api";
import { getKnownIds, getUserId } from "../../lib/session";
import { estadoInfo, formatARS, pasoCorto, rolCorto } from "../../lib/domain";
import { C, R } from "../../lib/theme";
import {
  Banner,
  DemoTag,
  ErrorVista,
  Screen,
  SkeletonRows,
  StatePill,
  Vacio,
} from "../../components/ui";

export default function Acuerdos() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>();
  const [items, setItems] = useState<AgreementSummary[]>([]);
  const [fase, setFase] = useState<"cargando" | "error" | "listo">("cargando");
  const [error, setError] = useState("");
  const [refrescando, setRefrescando] = useState(false);
  const [parcial, setParcial] = useState(false);

  const cargar = useCallback(async (uid: string) => {
    const servidor = await listAgreements(uid);
    if (servidor !== null) {
      setItems(servidor);
      setParcial(false);
      return;
    }
    // Fallback: hidratar ids conocidos localmente mientras no hay endpoint.
    const ids = await getKnownIds(uid);
    const detalles = await Promise.all(
      ids.map((id) => getAgreement(id, uid).catch(() => null)),
    );
    setItems(
      detalles
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => ({
          id: d.id,
          title: d.title,
          template: d.template,
          state: d.state,
          amountCents: d.amountCents,
          yourRole: d.yourRole,
          counterpartyLabel: d.parties.counterpartyLabel,
          createdAt: d.createdAt,
        })),
    );
    setParcial(true);
  }, []);

  const recargar = useCallback(async () => {
    const uid = userId ?? (await getUserId());
    if (!uid) {
      router.replace("/login");
      return;
    }
    setUserId(uid);
    try {
      await cargar(uid);
      setFase("listo");
      setError("");
    } catch (e) {
      setFase("error");
      setError(e instanceof ApiError ? e.human : humanize(String(e)));
    }
  }, [cargar, userId, router]);

  useFocusEffect(
    useCallback(() => {
      void recargar();
    }, [recargar]),
  );

  return (
    <Screen scroll={false}>
      <View style={st.headRow}>
        <Text style={st.h1}>Tus acuerdos</Text>
        <DemoTag texto="Simulación" />
      </View>

      <View style={{ backgroundColor: C.elevated, borderRadius: 18, padding: 20, gap: 8, marginBottom: 6 }}><Text style={{ color: C.ice, fontSize: 11, letterSpacing: 2, fontWeight: "700" }}>TU ESPACIO DE ACUERDOS</Text><Text style={{ color: C.ink, fontSize: 27, lineHeight: 33, fontWeight: "800" }}>Lo que acordaste, a la vista.</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>Creá, compartí y seguí cada paso hasta liberar o recuperar tu plata.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/nuevo")} style={{ minHeight: 48, backgroundColor: C.blue, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }}><Text style={{ color: C.bg, fontWeight: "800" }}>+ Crear acuerdo</Text></Pressable></View>
      {fase === "cargando" && items.length === 0 ? (
        <SkeletonRows filas={4} />
      ) : fase === "error" && items.length === 0 ? (
        <ErrorVista
          titulo="No pudimos traer los acuerdos"
          mensaje={error}
          onReintentar={recargar}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={items.length === 0 ? st.listaVacia : st.lista}
          refreshControl={
            Platform.OS === "web" ? undefined : (
              <RefreshControl
                refreshing={refrescando}
                tintColor={C.ice}
                onRefresh={async () => {
                  setRefrescando(true);
                  await recargar();
                  setRefrescando(false);
                }}
              />
            )
          }
          ListHeaderComponent={
            parcial ? (
              <Banner texto="Lista armada desde este teléfono: el listado del server todavía no está disponible." />
            ) : undefined
          }
          ListEmptyComponent={
            <Vacio
              titulo="Todavía no tenés acuerdos"
              texto="Creá el primero desde la pestaña Nuevo: la otra parte revisa y acepta por enlace."
              accion={
                <View style={{ minWidth: 220 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/nuevo")}
                    style={({ pressed }) => [st.ctaVacio, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={st.ctaVacioTexto}>Crear un acuerdo</Text>
                  </Pressable>
                </View>
              }
            />
          }
          renderItem={({ item }) => <FilaAcuerdo a={item} onPress={() => router.push(`/acuerdo/${item.id}`)} />}
        />
      )}
      {fase === "error" && items.length > 0 ? (
        <Banner texto={`No pudimos actualizar: ${error}`} />
      ) : null}
    </Screen>
  );
}

function FilaAcuerdo({ a, onPress }: { a: AgreementSummary; onPress: () => void }) {
  const e = estadoInfo(a.state);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Acuerdo ${a.title}, ${e.label}, ${formatARS(a.amountCents)}`}
      onPress={onPress}
      style={({ pressed }) => [st.fila, pressed && { opacity: 0.75 }]}
    >
      <View style={st.filaTop}>
        <Text style={st.filaTitulo} numberOfLines={1}>
          {a.title}
        </Text>
        <StatePill label={e.label} tono={e.tono} />
      </View>
      <View style={st.filaBottom}>
        <Text style={st.filaMonto}>{formatARS(a.amountCents)}</Text>
        <Text style={st.filaMeta} numberOfLines={1}>
          {a.counterpartyLabel ? `Con ${a.counterpartyLabel} · ` : ""}
          {rolCorto(a.yourRole, a.template)}
        </Text>
      </View>
      {pasoCorto(a.state) ? (
        <Text style={st.filaPaso} numberOfLines={1}>
          {pasoCorto(a.state)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  h1: { color: C.ink, fontSize: 24, fontWeight: "800" },
  lista: { gap: 10, paddingBottom: 24 },
  listaVacia: { flexGrow: 1, justifyContent: "center" },
  fila: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSoft,
    padding: 14,
    gap: 10,
  },
  filaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  filaTitulo: { color: C.ink, fontSize: 15.5, fontWeight: "700", flex: 1 },
  filaBottom: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  filaMonto: { color: C.ink, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  filaMeta: { color: C.muted, fontSize: 12.5, flex: 1 },
  filaPaso: { color: C.ice, fontSize: 12.5, fontWeight: "600" },
  ctaVacio: {
    backgroundColor: C.blue,
    minHeight: 48,
    borderRadius: R.control,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaVacioTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
