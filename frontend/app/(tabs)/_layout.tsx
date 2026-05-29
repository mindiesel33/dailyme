import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Text } from "@/src/components/ui";
import { colors, fonts, shadow } from "@/src/theme";

const TABS = [
  { name: "index", label: "Home", icon: "calendar" as const },
  { name: "play", label: "Play", icon: "game-controller" as const },
  { name: "profile", label: "Us", icon: "heart" as const },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || 12 }]}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {TABS.slice(0, 1).map((t) => (
          <TabItem key={t.name} tab={t} state={state} navigation={navigation} />
        ))}

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => router.push("/capture")}
          testID="tab-capture"
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>

        {TABS.slice(1).map((t) => (
          <TabItem key={t.name} tab={t} state={state} navigation={navigation} />
        ))}
      </View>
    </View>
  );
}

function TabItem({ tab, state, navigation }: any) {
  const route = state.routes.find((r: any) => r.name === tab.name);
  const index = state.routes.indexOf(route);
  const focused = state.index === index;
  const onPress = () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
  };
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7} testID={`tab-${tab.label.toLowerCase()}`}>
      <Ionicons name={focused ? tab.icon : (`${tab.icon}-outline` as any)} size={24} color={focused ? colors.primary : colors.textMuted} />
      <Text style={[styles.label, { color: focused ? colors.primary : colors.textMuted, fontFamily: focused ? fonts.bodyBold : fonts.body }]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 12 },
  item: { alignItems: "center", justifyContent: "center", gap: 3, minWidth: 64, minHeight: 48 },
  label: { fontSize: 11 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    ...shadow.soft,
  },
});
