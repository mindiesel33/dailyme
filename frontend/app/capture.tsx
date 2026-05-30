import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Platform, Linking, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import dayjs from "dayjs";
import { api } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { Text, Button } from "@/src/components/ui";
import { VoiceRecorder } from "@/src/components/voice";
import { colors, fonts, spacing, radius } from "@/src/theme";

const MAX_PHOTOS = 5;
const MAX_CAPTION = 1500;

export default function Capture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = params.date && dayjs(params.date).isValid() ? dayjs(params.date) : dayjs();

  const [date, setDate] = useState(initialDate);
  const [media, setMedia] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [voice, setVoice] = useState<{ uri: string | null; dur: number }>({ uri: null, dur: 0 });
  const [saving, setSaving] = useState(false);

  const pickImages = async () => {
    if (media.length >= MAX_PHOTOS) {
      Alert.alert(t("cap.limitTitle"), t("cap.limitMsg"));
      return;
    }
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) {
          if (!req.canAskAgain) openSettings();
          return;
        }
      } else {
        openSettings();
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - media.length,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => `data:image/jpeg;base64,${a.base64}`);
      setMedia((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (media.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.getCameraPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        const req = await ImagePicker.requestCameraPermissionsAsync();
        if (!req.granted) {
          if (!req.canAskAgain) openSettings();
          return;
        }
      } else {
        openSettings();
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (!result.canceled) {
      const a = result.assets[0];
      setMedia((prev) => [...prev, `data:image/jpeg;base64,${a.base64}`].slice(0, MAX_PHOTOS));
    }
  };

  const openSettings = () => {
    Alert.alert(t("cap.permTitle"), t("cap.permMsg"), [
      { text: t("common.notNow"), style: "cancel" },
      { text: t("common.openSettings"), onPress: () => Linking.openSettings() },
    ]);
  };

  const removePhoto = (i: number) => setMedia((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (media.length === 0 && !caption.trim() && !voice.uri) {
      Alert.alert(t("cap.addSomething"), t("cap.addSomethingMsg"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/memories", {
        date: date.format("YYYY-MM-DD"),
        media,
        caption: caption.trim(),
        voice_note: voice.uri,
        voice_duration: voice.dur,
      });
      router.back();
    } catch (e: any) {
      Alert.alert(t("cap.couldntSave"), e.message || t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="capture-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} testID="capture-close" hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text weight="headingSemi" style={styles.topTitle}>
          {t("cap.title")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} bottomOffset={20}>
        <Text weight="caption" style={styles.label}>
          {t("cap.when")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: 14 }).map((_, i) => {
              const d = dayjs().subtract(i, "day");
              const active = d.isSame(date, "day");
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setDate(d)}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  testID={`date-chip-${d.format("YYYY-MM-DD")}`}
                >
                  <Text weight="body" style={[styles.dateChipDay, active && { color: "#fff" }]}>
                    {i === 0 ? t("cap.today") : d.format("ddd")}
                  </Text>
                  <Text weight="bodyBold" style={[styles.dateChipNum, active && { color: "#fff" }]}>
                    {d.format("D")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text weight="caption" style={styles.label}>
          {t("cap.photos", { n: media.length, max: MAX_PHOTOS })}
        </Text>
        <View style={styles.photoGrid}>
          {media.map((uri, i) => (
            <View key={i} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)} testID={`remove-photo-${i}`}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {media.length < MAX_PHOTOS && (
            <>
              <TouchableOpacity style={styles.addPhoto} onPress={pickImages} testID="pick-photos-btn">
                <Ionicons name="images-outline" size={24} color={colors.primary} />
                <Text weight="body" style={styles.addPhotoText}>
                  {t("cap.library")}
                </Text>
              </TouchableOpacity>
              {Platform.OS !== "web" && (
                <TouchableOpacity style={styles.addPhoto} onPress={takePhoto} testID="take-photo-btn">
                  <Ionicons name="camera-outline" size={24} color={colors.primary} />
                  <Text weight="body" style={styles.addPhotoText}>
                    {t("cap.camera")}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <Text weight="caption" style={[styles.label, { marginTop: spacing.lg }]}>
          {t("cap.caption", { n: caption.length, max: MAX_CAPTION })}
        </Text>
        <TextInput
          value={caption}
          onChangeText={(t2) => setCaption(t2.slice(0, MAX_CAPTION))}
          placeholder={t("cap.captionPlaceholder")}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.caption}
          testID="caption-input"
        />

        <Text weight="caption" style={[styles.label, { marginTop: spacing.lg }]}>
          {t("cap.voiceNote")}
        </Text>
        <VoiceRecorder onChange={(uri, dur) => setVoice({ uri, dur })} />

        <Button title={t("cap.save")} onPress={save} loading={saving} testID="save-memory-btn" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topTitle: { fontSize: 18, color: colors.text },
  label: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, marginBottom: spacing.sm },
  dateChip: { width: 60, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipDay: { fontSize: 12, color: colors.textMuted, textTransform: "capitalize" },
  dateChipNum: { fontSize: 18, color: colors.text },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { position: "relative" },
  photo: { width: 84, height: 84, borderRadius: radius.md },
  photoRemove: { position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 84, height: 84, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  addPhotoText: { color: colors.primary, fontSize: 12 },
  caption: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, minHeight: 110, fontSize: 16, fontFamily: fonts.body, color: colors.text, textAlignVertical: "top" },
});
