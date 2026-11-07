// Tabs inferiores: Acuerdos / Nuevo / Saldo + stack para la ficha.

import { Tabs } from "expo-router";
import { C } from "../../lib/theme";
import { IconDocs, IconPlus, IconWallet } from "../../components/icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.lineSoft,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: C.ice,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Acuerdos",
          tabBarIcon: ({ color, size }) => <IconDocs color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="nuevo"
        options={{
          title: "Nuevo",
          tabBarIcon: ({ color, size }) => <IconPlus color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saldo"
        options={{
          title: "Saldo",
          tabBarIcon: ({ color, size }) => <IconWallet color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
