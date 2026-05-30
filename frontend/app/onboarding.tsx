import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Share } from "react-native";
import { TextInput } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { Text, Button, Card } from "@/src/components/ui";
import { colors, fonts, spacing, radius } from "@/src/theme";

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh, signOut } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "create") return;
    const tmr = setInterval(async () => {
      try {
        const c = await api.get("/couple");
        if (c.is_linked) {
          clearInterval(tmr);
          await refresh();
          router.replace("/(tabs)");
        }
      } catch {}
    }, 4000);
    return () => clearInterval(tmr);
  }, [mode, refresh, router]);

  const createCouple = async () => {
    setBusy(true);
    setError("");
    try {
      const c = await api.post("/couple/create");
      setInviteCode(c.invite_code);
      setMode("create");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const joinCouple = async () => {
    if (codeInput.trim().length < 4) {
      setError(t("onb.errCode"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/couple/join", { invite_code: codeInput.trim() });
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareCode = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({ message: t("onb.shareMsg", { code: inviteCode }) });
    } catch {}
  };

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 40 }]}
      bottomOffset={20}
    >
      <TouchableOpacity style={styles.logout} onPress={signOut} testID="onboarding-signout">
        <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.iconCircle}>
        <Ionicons name="heart-circle" size={56} color={colors.primary} />
      </View>
      <Text weight="heading" style={styles.title}>
        {t("onb.title")}
      </Text>
      <Text weight="body" style={styles.subtitle}>
        {t("onb.subtitle")}
      </Text>

      {error ? (
        <Text weight="bodySemi" style={styles.error} testID="onboarding-error">
          {error}
        </Text>
      ) : null}

      {mode === "create" && inviteCode ? (
        <Card style={{ marginTop: spacing.xl, alignItems: "center" }}>
          <Text weight="caption" style={styles.codeLabel}>
            {t("onb.yourCode")}
          </Text>
          <Text weight="heading" style={styles.code} testID="invite-code">
            {inviteCode}
          </Text>
          <Button title={t("onb.share")} onPress={shareCode} testID="share-code-btn" icon={<Ionicons name="share-social" size={18} color="#fff" />} style={{ marginTop: spacing.md, alignSelf: "stretch" }} />
          <View style={styles.waiting}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text weight="body" style={styles.waitingText}>
              {t("onb.waiting")}
            </Text>
          </View>
          <Button title={t("onb.enterApp")} variant="ghost" onPress={() => router.replace("/(tabs)")} testID="enter-app-btn" />
        </Card>
      ) : mode === "join" ? (
        <Card style={{ marginTop: spacing.xl }}>
          <Text weight="caption" style={styles.codeLabel}>
            {t("onb.enterCode")}
          </Text>
          <TextInput
            value={codeInput}
            onChangeText={(tx) => setCodeInput(tx.toUpperCase())}
            placeholder={t("onb.codePlaceholder")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={6}
            style={styles.input}
            testID="join-code-input"
          />
          <Button title={t("onb.linkUs")} onPress={joinCouple} loading={busy} testID="join-couple-btn" style={{ marginTop: spacing.md }} />
          <Button title={t("common.back")} variant="ghost" onPress={() => { setMode("choose"); setError(""); }} />
        </Card>
      ) : (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Button title={t("onb.createCode")} onPress={createCouple} loading={busy} testID="create-couple-btn" icon={<Ionicons name="add-circle" size={20} color="#fff" />} />
          <Button title={t("onb.haveCode")} variant="outline" onPress={() => { setMode("join"); setError(""); }} testID="goto-join-btn" />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  logout: { alignSelf: "flex-end", padding: 8 },
  iconCircle: { alignSelf: "flex-start", marginTop: spacing.md, marginBottom: spacing.md },
  title: { fontSize: 36, lineHeight: 40, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: spacing.sm },
  error: { color: colors.primaryDark, marginTop: spacing.md, backgroundColor: colors.primaryLight, padding: 12, borderRadius: radius.sm },
  codeLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1.5 },
  code: { fontSize: 44, letterSpacing: 8, color: colors.primary, marginTop: 8 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  waitingText: { color: colors.textMuted, fontSize: 14 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 24,
    letterSpacing: 6,
    fontFamily: fonts.headingSemi,
    color: colors.text,
    textAlign: "center",
    marginTop: 8,
  },
});
