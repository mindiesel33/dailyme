import React, { useState } from "react";
import { View, StyleSheet, ImageBackground, Dimensions } from "react-native";
import { Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth";
import { Text, Button } from "@/src/components/ui";
import { colors, fonts, spacing } from "@/src/theme";

const { height } = Dimensions.get("window");

export default function Login() {
  const { user, signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/" />;

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200&auto=format&fit=crop" }}
        style={styles.hero}
        imageStyle={{ opacity: 0.9 }}
      >
        <LinearGradient
          colors={["rgba(252,250,248,0)", "rgba(252,250,248,0.6)", colors.background]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <Content busy={busy} onSignIn={handleSignIn} />
    </View>
  );
}

function Content({ busy, onSignIn }: { busy: boolean; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.badge}>
        <Ionicons name="heart" size={16} color={colors.primary} />
        <Text weight="bodySemi" style={styles.badgeText}>
          just the two of us
        </Text>
      </View>

      <Text weight="heading" style={styles.title}>
        Daily Dose{"\n"}of Me
      </Text>
      <Text weight="body" style={styles.subtitle}>
        Your private little world — date nights, voice notes, playful challenges, and
        the small moments that make us, us.
      </Text>

      <Button
        title="Continue with Google"
        onPress={onSignIn}
        loading={busy}
        testID="google-signin-btn"
        icon={<Ionicons name="logo-google" size={20} color="#fff" />}
        style={{ marginTop: spacing.lg }}
      />
      <Text weight="body" style={styles.terms}>
        Sign in to link with your partner using an invite code.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { height: height * 0.55, width: "100%" },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-end",
    marginTop: -spacing.xxl,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.primaryDark, fontSize: 13 },
  title: { fontSize: 46, lineHeight: 50, color: colors.text, letterSpacing: -1 },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  terms: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
