import React, { useEffect, useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet, Platform, Alert, Linking } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/src/components/ui";
import { useI18n } from "@/src/i18n";
import { colors, radius, spacing } from "@/src/theme";

const MAX_SECONDS = 60;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// -------------------- Recorder --------------------
export function VoiceRecorder({
  onChange,
}: {
  onChange: (dataUri: string | null, durationSec: number) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const { t } = useI18n();
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDataUri, setRecordedDataUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const seconds = Math.floor((state.durationMillis || 0) / 1000);

  // auto-stop at max
  useEffect(() => {
    if (state.isRecording && seconds >= MAX_SECONDS) {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, state.isRecording]);

  const ensurePermission = async (): Promise<boolean> => {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const req = await requestRecordingPermissionsAsync();
      if (req.granted) return true;
      if (!req.canAskAgain) promptSettings();
      return false;
    }
    promptSettings();
    return false;
  };

  const promptSettings = () => {
    Alert.alert(
      t("voice.micTitle"),
      t("voice.micMsg"),
      [
        { text: t("common.notNow"), style: "cancel" },
        { text: t("common.openSettings"), onPress: () => Linking.openSettings() },
      ]
    );
  };

  const start = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert(t("voice.couldntStart"), t("common.tryAgain"));
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri || state.url;
      if (uri) {
        const dur = Math.min(Math.floor((state.durationMillis || 0) / 1000), MAX_SECONDS);
        const b64 = await new File(uri).base64();
        const dataUri = `data:audio/m4a;base64,${b64}`;
        setRecordedUri(uri);
        setRecordedDataUri(dataUri);
        setDuration(dur || 1);
        onChange(dataUri, dur || 1);
      }
    } catch (e) {
      Alert.alert(t("voice.couldntSave"), t("common.tryAgain"));
    }
  };

  const reset = () => {
    setRecordedUri(null);
    setRecordedDataUri(null);
    setDuration(0);
    onChange(null, 0);
  };

  if (recordedDataUri) {
    return (
      <View style={styles.recordedRow}>
        <VoicePlayer dataUri={recordedDataUri} durationSec={duration} compact />
        <TouchableOpacity onPress={reset} style={styles.trash} testID="voice-delete-btn">
          <Ionicons name="trash-outline" size={20} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.webNote}>
        <Ionicons name="mic-off-outline" size={18} color={colors.textMuted} />
        <Text weight="body" style={styles.webNoteText}>
          {t("voice.web")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.recorderWrap}>
      <TouchableOpacity
        style={[styles.recBtn, state.isRecording && styles.recBtnActive]}
        onPress={state.isRecording ? stop : start}
        activeOpacity={0.85}
        testID="voice-record-btn"
      >
        <Ionicons name={state.isRecording ? "stop" : "mic"} size={26} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text weight="bodySemi" style={{ color: colors.text }}>
          {state.isRecording ? t("voice.recording") : t("voice.tapToRecord")}
        </Text>
        <Text weight="body" style={{ color: colors.textMuted, fontSize: 13 }}>
          {state.isRecording ? `${fmt(seconds)} / 1:00` : t("voice.upTo")}
        </Text>
      </View>
    </View>
  );
}

// -------------------- Player --------------------
export function VoicePlayer({
  dataUri,
  durationSec,
  compact,
}: {
  dataUri: string;
  durationSec?: number;
  compact?: boolean;
}) {
  // On native, write base64 to a cache file. On web, play the data URI directly.
  const source = useMemo(() => {
    if (Platform.OS === "web") return { uri: dataUri };
    try {
      const b64 = dataUri.split(",")[1] || "";
      const file = new File(Paths.cache, `vn_${Math.abs(hashStr(dataUri))}.m4a`);
      if (!file.exists) file.write(b64, { encoding: "base64" });
      return { uri: file.uri };
    } catch {
      return { uri: dataUri };
    }
  }, [dataUri]);

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= (status.duration || 0)) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const total = durationSec || Math.floor(status.duration || 0);
  const cur = Math.floor(status.currentTime || 0);

  return (
    <View style={[styles.player, compact && { flex: 1 }]}>
      <TouchableOpacity style={styles.playBtn} onPress={toggle} testID="voice-play-btn">
        <Ionicons name={status.playing ? "pause" : "play"} size={20} color="#fff" />
      </TouchableOpacity>
      <View style={styles.waveWrap}>
        {Array.from({ length: 18 }).map((_, i) => {
          const active = total > 0 && cur / total > i / 18;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { height: 6 + ((i * 7) % 18), backgroundColor: active ? colors.primary : colors.primaryLight },
              ]}
            />
          );
        })}
      </View>
      <Text weight="bodySemi" style={styles.time}>
        {fmt(status.playing ? cur : total)}
      </Text>
    </View>
  );
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 200); i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

const styles = StyleSheet.create({
  recorderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  recBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recBtnActive: { backgroundColor: colors.primaryDark },
  recordedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trash: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.full,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  waveWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 28 },
  bar: { width: 3, borderRadius: 2 },
  time: { color: colors.primaryDark, fontSize: 13, minWidth: 34, textAlign: "right" },
  webNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  webNoteText: { color: colors.textMuted, fontSize: 13, flex: 1 },
});
