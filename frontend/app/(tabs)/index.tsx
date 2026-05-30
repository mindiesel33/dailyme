import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/i18n";
import { Text } from "@/src/components/ui";
import { colors, fonts, spacing, radius, shadow } from "@/src/theme";

const { width } = Dimensions.get("window");
const CELL = (width - spacing.lg * 2 - 12) / 7;

type Member = { user_id: string; name?: string; picture?: string; points: number };
type Memory = { id: string; date: string; media: string[]; caption: string; voice_note?: string; author_name?: string };

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const [couple, setCouple] = useState<any>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [month, setMonth] = useState(dayjs());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (m = month) => {
    try {
      const [c, mems] = await Promise.all([
        api.get("/couple"),
        api.get(`/memories?month=${m.format("YYYY-MM")}`),
      ]);
      setCouple(c);
      setMemories(mems);
    } catch (e) {
      console.log("home load error", e);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load(month);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(month);
    setRefreshing(false);
  };

  const datesWithMemories = new Set(memories.map((m) => m.date));
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) => dayjs().day(i).format("dd").charAt(0));

  const startOfMonth = month.startOf("month");
  const daysInMonth = month.daysInMonth();
  const firstWeekday = startOfMonth.day();
  const cells: (dayjs.Dayjs | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(month.date(d));

  const members: Member[] = couple?.members || [];
  const me = members.find((m) => m.user_id === user?.user_id);
  const partner = members.find((m) => m.user_id !== user?.user_id);
  const totalPoints = members.reduce((s, m) => s + (m.points || 0), 0);

  const goToDay = (d: dayjs.Dayjs) => router.push(`/day/${d.format("YYYY-MM-DD")}`);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text weight="body" style={styles.hello}>
            {dayjs().format("dddd, MMM D")}
          </Text>
          <Text weight="heading" style={styles.brand}>
            Daily Dose of Me
          </Text>
        </View>
        <View style={styles.pointsPill} testID="total-points">
          <Ionicons name="sparkles" size={14} color={colors.primaryDark} />
          <Text weight="bodyBold" style={styles.pointsText}>
            {t("home.pts", { n: totalPoints })}
          </Text>
        </View>
      </View>

      <View style={styles.coupleBar}>
        <Avatar member={me} fallback={t("common.you")} highlight />
        <View style={styles.daysCenter}>
          <Ionicons name="heart" size={20} color={colors.primary} />
          {couple?.days_together != null ? (
            <>
              <Text weight="heading" style={styles.daysNum}>
                {couple.days_together}
              </Text>
              <Text weight="body" style={styles.daysLabel}>
                {t("home.daysTogether")}
              </Text>
            </>
          ) : (
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} testID="set-anniversary-link">
              <Text weight="bodySemi" style={styles.setAnni}>
                {t("home.setAnniversary")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Avatar member={partner} fallback={t("common.partner")} />
      </View>

      <View style={styles.calCard}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => setMonth(month.subtract(1, "month"))} testID="prev-month" hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text weight="headingSemi" style={styles.calMonth}>
            {month.format("MMMM YYYY")}
          </Text>
          <TouchableOpacity onPress={() => setMonth(month.add(1, "month"))} testID="next-month" hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((w, i) => (
            <View key={i} style={{ width: CELL, alignItems: "center" }}>
              <Text weight="bodySemi" style={styles.weekday}>
                {w.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: CELL, height: CELL }} />;
            const ds = d.format("YYYY-MM-DD");
            const has = datesWithMemories.has(ds);
            const isToday = d.isSame(dayjs(), "day");
            return (
              <TouchableOpacity
                key={i}
                style={[styles.cell, { width: CELL, height: CELL }, isToday && styles.cellToday]}
                onPress={() => goToDay(d)}
                testID={`day-${ds}`}
                activeOpacity={0.6}
              >
                <Text weight={isToday ? "bodyBold" : "body"} style={[styles.cellNum, isToday && { color: colors.primaryDark }]}>
                  {d.date()}
                </Text>
                {has && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.timelineHeader}>
        <Text weight="headingSemi" style={styles.sectionTitle}>
          {t("home.ourMemories")}
        </Text>
        <Text weight="body" style={styles.sectionCount}>
          {t("home.thisMonth", { n: memories.length })}
        </Text>
      </View>

      {memories.length === 0 ? (
        <TouchableOpacity style={styles.empty} onPress={() => router.push("/capture")} testID="empty-add-memory">
          <Ionicons name="camera-outline" size={32} color={colors.primary} />
          <Text weight="bodySemi" style={styles.emptyTitle}>
            {t("home.noMemories")}
          </Text>
          <Text weight="body" style={styles.emptyText}>
            {t("home.noMemoriesSub")}
          </Text>
        </TouchableOpacity>
      ) : (
        memories.map((m) => (
          <TouchableOpacity key={m.id} style={styles.memCard} onPress={() => goToDay(dayjs(m.date))} testID={`memory-${m.id}`} activeOpacity={0.85}>
            {m.media?.length ? (
              <Image source={{ uri: m.media[0] }} style={styles.memThumb} />
            ) : (
              <View style={[styles.memThumb, styles.memThumbEmpty]}>
                <Ionicons name="mic" size={22} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text weight="bodySemi" style={styles.memDate}>
                {dayjs(m.date).format("ddd, MMM D")}
              </Text>
              <Text weight="body" style={styles.memCaption} numberOfLines={2}>
                {m.caption || (m.voice_note ? t("home.voiceNote") : t("home.aMoment"))}
              </Text>
              <View style={styles.memMeta}>
                {m.media?.length > 1 && (
                  <View style={styles.metaTag}>
                    <Ionicons name="images-outline" size={12} color={colors.textMuted} />
                    <Text weight="body" style={styles.metaText}>{m.media.length}</Text>
                  </View>
                )}
                {m.voice_note && <Ionicons name="mic" size={13} color={colors.primary} />}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function Avatar({ member, fallback, highlight }: { member?: Member; fallback: string; highlight?: boolean }) {
  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatarRing, highlight && { borderColor: colors.primary }]}>
        {member?.picture ? (
          <Image source={{ uri: member.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
        )}
      </View>
      <Text weight="bodySemi" style={styles.avatarName} numberOfLines={1}>
        {member?.name?.split(" ")[0] || fallback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg },
  hello: { color: colors.textMuted, fontSize: 13, textTransform: "capitalize" },
  brand: { fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  pointsPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  pointsText: { color: colors.primaryDark, fontSize: 14 },
  coupleBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  avatarWrap: { alignItems: "center", width: 80 },
  avatarRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.secondary, padding: 2 },
  avatar: { width: "100%", height: "100%", borderRadius: 28 },
  avatarEmpty: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarName: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  daysCenter: { alignItems: "center", flex: 1 },
  daysNum: { fontSize: 30, color: colors.text, lineHeight: 34 },
  daysLabel: { fontSize: 12, color: colors.textMuted },
  setAnni: { color: colors.primary, fontSize: 13, marginTop: 4, textAlign: "center" },
  calCard: { backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: spacing.sm },
  calMonth: { fontSize: 17, color: colors.text, textTransform: "capitalize" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  cellToday: { backgroundColor: colors.primaryLight },
  cellNum: { fontSize: 15, color: colors.text },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 },
  timelineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 20, color: colors.text },
  sectionCount: { color: colors.textMuted, fontSize: 13 },
  empty: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  emptyTitle: { color: colors.text, fontSize: 16, marginTop: spacing.sm, textAlign: "center" },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 4 },
  memCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  memThumbEmpty: { alignItems: "center", justifyContent: "center" },
  memDate: { color: colors.text, fontSize: 15, textTransform: "capitalize" },
  memCaption: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  memMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  metaTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { color: colors.textMuted, fontSize: 12 },
});
