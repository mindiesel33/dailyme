import React, { useCallback, useState } from "react";
import { View, StyleSheet, Image, TouchableOpacity, TextInput, Alert, Share } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n, Lang } from "@/src/i18n";
import { Text, Button, Card } from "@/src/components/ui";
import { colors, fonts, spacing, radius } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [couple, setCouple] = useState<any>(null);
  const [editAnni, setEditAnni] = useState(false);
  const [anniInput, setAnniInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await api.get("/couple");
      setCouple(c);
      setAnniInput(c.anniversary_date || "");
    } catch (e) {
      console.log(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const members = couple?.members || [];
  const me = members.find((m: any) => m.user_id === user?.user_id);
  const partner = members.find((m: any) => m.user_id !== user?.user_id);
  const leader = [...members].sort((a, b) => (b.points || 0) - (a.points || 0))[0];

  const saveAnni = async () => {
    if (!dayjs(anniInput, "YYYY-MM-DD", true).isValid()) {
      Alert.alert(t("prof.invalidDate"), t("prof.invalidDateMsg"));
      return;
    }
    setBusy(true);
    try {
      await api.put("/couple/settings", { anniversary_date: anniInput });
      setEditAnni(false);
      load();
    } catch (e: any) {
      Alert.alert(t("prof.couldntSave"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareCode = async () => {
    if (!couple?.invite_code) return;
    await Share.share({ message: t("onb.shareMsg", { code: couple.invite_code }) });
  };

  const LANGS: { key: Lang; label: string }[] = [
    { key: "en", label: "English" },
    { key: "es", label: "Español (México)" },
  ];

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 140 }}
      bottomOffset={20}
      showsVerticalScrollIndicator={false}
    >
      <Text weight="heading" style={styles.title}>
        {t("prof.us")}
      </Text>

      <Card style={[styles.card, { alignItems: "center" }]}>
        <View style={styles.avatarsRow}>
          <Avatar member={me} fallback={t("common.you")} />
          <View style={styles.heartBetween}>
            <Ionicons name="heart" size={24} color={colors.primary} />
          </View>
          <Avatar member={partner} fallback={t("common.partner")} />
        </View>
        {couple?.days_together != null ? (
          <Text weight="body" style={styles.togetherText}>
            {t("prof.togetherFor", { n: couple.days_together })}
          </Text>
        ) : (
          <Text weight="body" style={styles.togetherText}>
            {t("prof.setAnniBelow")}
          </Text>
        )}
      </Card>

      {couple && !couple.is_linked && (
        <Card style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: colors.secondary }]}>
          <Text weight="bodyBold" style={{ color: colors.primaryDark, fontSize: 16 }}>
            {t("prof.waitingPartner")}
          </Text>
          <Text weight="body" style={{ color: colors.primaryDark, marginTop: 4 }}>
            {t("prof.shareCodeSub")}
          </Text>
          <Text weight="heading" style={styles.inviteCode} testID="profile-invite-code">
            {couple.invite_code}
          </Text>
          <Button title={t("onb.share")} onPress={shareCode} testID="profile-share-btn" icon={<Ionicons name="share-social" size={18} color="#fff" />} />
        </Card>
      )}

      <Text weight="headingSemi" style={styles.section}>
        {t("prof.leaderboard")}
      </Text>
      <Card style={styles.card}>
        {members.map((m: any) => {
          const isLeader = leader && m.user_id === leader.user_id && (m.points || 0) > 0;
          return (
            <View key={m.user_id} style={styles.lbRow}>
              {m.picture ? (
                <Image source={{ uri: m.picture }} style={styles.lbAvatar} />
              ) : (
                <View style={[styles.lbAvatar, styles.avatarEmpty]}>
                  <Ionicons name="person" size={16} color={colors.primary} />
                </View>
              )}
              <Text weight="bodySemi" style={styles.lbName}>
                {m.name?.split(" ")[0] || t("common.partner")}
                {m.user_id === user?.user_id ? t("prof.youSuffix") : ""}
              </Text>
              {isLeader && <Ionicons name="trophy" size={16} color={colors.sunshine} />}
              <Text weight="bodyBold" style={styles.lbPoints}>
                {m.points || 0}
              </Text>
            </View>
          );
        })}
        {members.length < 2 && (
          <Text weight="body" style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
            {t("prof.scoresAfterJoin")}
          </Text>
        )}
      </Card>

      <Text weight="headingSemi" style={styles.section}>
        {t("prof.anniversary")}
      </Text>
      <Card style={styles.card}>
        {editAnni ? (
          <View>
            <TextInput
              value={anniInput}
              onChangeText={setAnniInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={styles.dateInput}
              testID="anniversary-input"
            />
            <View style={styles.rowGap}>
              <Button title={t("prof.save")} onPress={saveAnni} loading={busy} testID="save-anniversary-btn" style={{ flex: 1 }} />
              <Button title={t("common.cancel")} variant="outline" onPress={() => setEditAnni(false)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.settingRow} onPress={() => setEditAnni(true)} testID="edit-anniversary-btn">
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text weight="body" style={styles.settingText}>
              {couple?.anniversary_date ? dayjs(couple.anniversary_date).format("MMMM D, YYYY") : t("prof.whenBegin")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </Card>

      <Text weight="headingSemi" style={styles.section}>
        {t("prof.language")}
      </Text>
      <Card style={styles.card}>
        <View style={styles.segment}>
          {LANGS.map((l) => {
            const active = lang === l.key;
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.segmentBtn, active && styles.segmentActive]}
                onPress={() => setLang(l.key)}
                testID={`lang-${l.key}`}
                activeOpacity={0.8}
              >
                <Text weight={active ? "bodyBold" : "body"} style={[styles.segmentText, active && { color: "#fff" }]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Text weight="headingSemi" style={styles.section}>
        {t("prof.account")}
      </Text>
      <Card style={styles.card}>
        <View style={styles.settingRow}>
          <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
          <Text weight="body" style={styles.settingText} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.settingRow} onPress={signOut} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color={colors.primaryDark} />
          <Text weight="bodySemi" style={[styles.settingText, { color: colors.primaryDark }]}>
            {t("prof.signOut")}
          </Text>
        </TouchableOpacity>
      </Card>
    </KeyboardAwareScrollView>
  );
}

function Avatar({ member, fallback }: any) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.avatarRing}>
        {member?.picture ? (
          <Image source={{ uri: member.picture }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarImg, styles.avatarEmpty]}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
        )}
      </View>
      <Text weight="bodySemi" style={styles.avatarName}>
        {member?.name?.split(" ")[0] || fallback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 30, color: colors.text, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  avatarsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  avatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.secondary, padding: 3 },
  avatarImg: { width: "100%", height: "100%", borderRadius: 36 },
  avatarEmpty: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarName: { fontSize: 14, color: colors.text, marginTop: 6 },
  heartBetween: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  togetherText: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.md },
  inviteCode: { fontSize: 36, letterSpacing: 6, color: colors.primary, marginVertical: spacing.md },
  section: { fontSize: 18, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  lbAvatar: { width: 36, height: 36, borderRadius: 18 },
  lbName: { flex: 1, fontSize: 15, color: colors.text },
  lbPoints: { fontSize: 18, color: colors.primary, minWidth: 28, textAlign: "right" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  settingText: { flex: 1, fontSize: 15, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  dateInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: fonts.body, color: colors.text, marginBottom: spacing.sm, textAlign: "center", letterSpacing: 1 },
  rowGap: { flexDirection: "row", gap: 8 },
  segment: { flexDirection: "row", backgroundColor: colors.background, borderRadius: radius.md, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, color: colors.textSecondary },
});
