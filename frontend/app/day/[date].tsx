import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Alert } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { api } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { Text, Button } from "@/src/components/ui";
import { VoicePlayer } from "@/src/components/voice";
import { colors, spacing, radius } from "@/src/theme";

const { width } = Dimensions.get("window");

type Memory = {
  id: string;
  date: string;
  media: string[];
  caption: string;
  voice_note?: string;
  voice_duration?: number;
  author_name?: string;
  author_picture?: string;
};

export default function DayDetail() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const d = dayjs(date);

  const load = useCallback(async () => {
    try {
      const mems = await api.get(`/memories/by-date/${date}`);
      setMemories(mems);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = (id: string) => {
    Alert.alert(t("day.deleteTitle"), t("day.deleteMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("day.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/memories/${id}`);
            load();
          } catch (e: any) {
            Alert.alert(t("day.couldntDelete"), e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="day-detail-screen">
      <View style={styles.handle} />
      <View style={styles.topBar}>
        <View>
          <Text weight="caption" style={styles.dow}>
            {d.format("dddd").toUpperCase()}
          </Text>
          <Text weight="heading" style={styles.dateBig}>
            {d.format("MMMM D")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} testID="day-close" style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {!loading && memories.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={40} color={colors.primary} />
            <Text weight="bodySemi" style={styles.emptyTitle}>
              {t("day.nothing")}
            </Text>
            <Text weight="body" style={styles.emptyText}>
              {t("day.nothingSub")}
            </Text>
          </View>
        ) : (
          memories.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.authorRow}>
                {m.author_picture ? (
                  <Image source={{ uri: m.author_picture }} style={styles.authorPic} />
                ) : (
                  <View style={[styles.authorPic, styles.authorPicEmpty]}>
                    <Ionicons name="person" size={14} color={colors.primary} />
                  </View>
                )}
                <Text weight="bodySemi" style={styles.authorName}>
                  {m.author_name?.split(" ")[0] || t("day.someone")}
                </Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => onDelete(m.id)} testID={`delete-${m.id}`} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {m.media?.length > 0 && (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carousel}>
                  {m.media.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.carouselImg} />
                  ))}
                </ScrollView>
              )}

              {m.voice_note ? (
                <View style={{ marginTop: spacing.md }}>
                  <VoicePlayer dataUri={m.voice_note} durationSec={m.voice_duration} />
                </View>
              ) : null}

              {m.caption ? (
                <Text weight="body" style={styles.caption}>
                  {m.caption}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Button
            title={t("day.add")}
            variant={memories.length ? "outline" : "primary"}
            onPress={() => router.push(`/capture?date=${date}`)}
            testID="add-to-day-btn"
            icon={memories.length ? undefined : <Ionicons name="add" size={20} color="#fff" />}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: 8 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dow: { color: colors.primary, fontSize: 12, letterSpacing: 1.5 },
  dateBig: { fontSize: 28, color: colors.text, textTransform: "capitalize" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  empty: { alignItems: "center", padding: spacing.xl, marginTop: spacing.xl },
  emptyTitle: { fontSize: 17, color: colors.text, marginTop: spacing.sm, textAlign: "center" },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 4 },
  card: { backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  authorPic: { width: 26, height: 26, borderRadius: 13 },
  authorPicEmpty: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  authorName: { color: colors.text, fontSize: 14 },
  carousel: { borderRadius: radius.lg },
  carouselImg: { width: width - spacing.lg * 2 - spacing.md * 2, height: 260, borderRadius: radius.lg, marginRight: 8, backgroundColor: colors.primaryLight },
  caption: { fontSize: 16, lineHeight: 24, color: colors.text, marginTop: spacing.md },
});
