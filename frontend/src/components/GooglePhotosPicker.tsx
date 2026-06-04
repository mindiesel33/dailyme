import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Text, Button } from "@/src/components/ui";
import { colors, fonts, spacing, radius } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/auth";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - spacing.lg * 2 - 20) / 3;

interface GooglePhotosPickerProps {
  visible: boolean;
  onClose: () => void;
  onImport: (base64Images: string[]) => void;
  maxSelection: number;
}

interface PickedItem {
  id: string;
  baseUrl: string;
  filename: string;
}

const STORAGE_TOKEN_KEY = "google_photos_access_token";
const PICKER_BASE = "https://photospicker.googleapis.com/v1";

// Convert a remote image URL to a base64 Data URI.
const urlToBase64 = async (url: string, accessToken: string): Promise<string> => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export function GooglePhotosPicker({
  visible,
  onClose,
  onImport,
  maxSelection,
}: GooglePhotosPickerProps) {
  const { signIn } = useAuth();
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<
    "idle" | "creating" | "awaiting" | "fetching" | "importing"
  >("idle");
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // Load saved token whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    cancelledRef.current = false;
    storage.secureGet<string>(STORAGE_TOKEN_KEY, "").then((saved) => {
      if (saved) setToken(saved);
    });
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      sessionIdRef.current = null;
    };
  }, [visible]);

  const reset = useCallback(() => {
    setPickedItems([]);
    setSelectedIds([]);
    setStatus("idle");
    sessionIdRef.current = null;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSignOutAndReconnect = useCallback(async () => {
    onClose();
    await signIn();
  }, [onClose, signIn]);

  // Fetch the list of items the user picked in the Google-hosted UI.
  const fetchPickedItems = useCallback(
    async (sessionId: string, accessToken: string) => {
      setStatus("fetching");
      try {
        const res = await fetch(
          `${PICKER_BASE}/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=${maxSelection}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) {
          if (res.status === 401) {
            await storage.secureRemove(STORAGE_TOKEN_KEY);
            setToken("");
            Alert.alert("Session Expired", "Please sign in again to reconnect Google Photos.");
            setStatus("idle");
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Failed to fetch picked items");
        }
        const data = await res.json();
        const items: PickedItem[] = (data.mediaItems || []).map((item: any) => ({
          id: item.id,
          baseUrl: item.mediaFile?.baseUrl ?? "",
          filename: item.mediaFile?.filename ?? "",
        }));
        setPickedItems(items);
        setSelectedIds(items.map((i) => i.id)); // pre-select everything the user picked
        setStatus("idle");
      } catch (err: any) {
        Alert.alert("Google Photos Error", err.message || "Could not retrieve picked items");
        setStatus("idle");
      }
    },
    [maxSelection]
  );

  // Poll session status until the user finishes picking in Google's UI.
  const pollSession = useCallback(
    (sessionId: string, accessToken: string, intervalMs: number) => {
      const tick = async () => {
        if (cancelledRef.current || sessionIdRef.current !== sessionId) return;
        try {
          const res = await fetch(`${PICKER_BASE}/sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) {
            if (res.status === 401) {
              await storage.secureRemove(STORAGE_TOKEN_KEY);
              setToken("");
              Alert.alert("Session Expired", "Please sign in again.");
              setStatus("idle");
              return;
            }
            throw new Error("Session polling failed");
          }
          const data = await res.json();
          if (data.mediaItemsSet) {
            await fetchPickedItems(sessionId, accessToken);
            return;
          }
          const nextInterval =
            parsePollIntervalMs(data?.pollingConfig?.pollInterval) || intervalMs;
          pollTimerRef.current = setTimeout(tick, nextInterval);
        } catch (err: any) {
          // transient errors → keep polling at the same cadence
          pollTimerRef.current = setTimeout(tick, intervalMs);
        }
      };
      pollTimerRef.current = setTimeout(tick, intervalMs);
    },
    [fetchPickedItems]
  );

  const openPicker = useCallback(async () => {
    if (!token) return;
    setStatus("creating");
    try {
      // 1. Create a picker session.
      const createRes = await fetch(`${PICKER_BASE}/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!createRes.ok) {
        if (createRes.status === 401) {
          await storage.secureRemove(STORAGE_TOKEN_KEY);
          setToken("");
          Alert.alert("Session Expired", "Please sign in again.");
          setStatus("idle");
          return;
        }
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to start picker session");
      }
      const session = await createRes.json();
      sessionIdRef.current = session.id;
      const pickerUri: string = session.pickerUri;
      const pollMs = parsePollIntervalMs(session?.pollingConfig?.pollInterval) || 3000;

      // 2. Open Google-hosted picker UI.
      setStatus("awaiting");
      if (Platform.OS === "web") {
        window.open(pickerUri, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(pickerUri);
      }

      // 3. Poll until the user finishes picking.
      pollSession(session.id, token, pollMs);
    } catch (err: any) {
      Alert.alert("Picker Error", err.message || "Could not open Google Photos picker");
      setStatus("idle");
    }
  }, [token, pollSession]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= maxSelection) {
          Alert.alert("Limit Reached", `You can only import up to ${maxSelection} photos.`);
          return prev;
        }
        return [...prev, id];
      });
    },
    [maxSelection]
  );

  const handleImportSelected = useCallback(async () => {
    if (selectedIds.length === 0 || !token) return;
    setStatus("importing");
    try {
      const chosen = pickedItems.filter((it) => selectedIds.includes(it.id));
      const base64s: string[] = [];
      for (const it of chosen) {
        const url = `${it.baseUrl}=w1024-h1024`;
        const b64 = await urlToBase64(url, token);
        base64s.push(b64);
      }
      onImport(base64s);
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert("Import Failed", err.message || "Could not import selected photos.");
      setStatus("idle");
    }
  }, [selectedIds, pickedItems, token, onImport, onClose, reset]);

  const renderPhoto = (item: PickedItem) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.photoContainer}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: `${item.baseUrl}=w200-h200` }} style={styles.photo} />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkWrap}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text weight="headingSemi" style={styles.headerTitle}>
            Google Photos
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Content */}
        {!token ? (
          <View style={styles.authContainer}>
            <Ionicons
              name="logo-google"
              size={60}
              color={colors.primary}
              style={{ marginBottom: spacing.md }}
            />
            <Text weight="headingMedium" style={styles.authTitle}>
              Google Photos Disconnected
            </Text>
            <Text weight="body" style={styles.authDesc}>
              Permission to access Google Photos is missing or has expired. Sign in again to grant
              access.
            </Text>
            <Button
              title="Sign In to Reconnect"
              onPress={handleSignOutAndReconnect}
              icon={<Ionicons name="logo-google" size={20} color="#fff" />}
              style={{ width: "100%", marginTop: spacing.lg }}
            />
          </View>
        ) : pickedItems.length === 0 ? (
          <View style={styles.authContainer}>
            <Ionicons
              name="images-outline"
              size={60}
              color={colors.primary}
              style={{ marginBottom: spacing.md }}
            />
            <Text weight="headingMedium" style={styles.authTitle}>
              Pick from Google Photos
            </Text>
            <Text weight="body" style={styles.authDesc}>
              You'll be taken to Google to choose photos. Come back here when you're done — we'll
              pick up automatically.
            </Text>

            {status === "idle" && (
              <Button
                title={`Open Google Photos Picker`}
                onPress={openPicker}
                icon={<Ionicons name="open-outline" size={20} color="#fff" />}
                style={{ width: "100%", marginTop: spacing.lg }}
              />
            )}

            {(status === "creating" ||
              status === "awaiting" ||
              status === "fetching") && (
              <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  weight="body"
                  style={{ marginTop: spacing.sm, color: colors.textSecondary, textAlign: "center" }}
                >
                  {status === "creating" && "Starting picker session..."}
                  {status === "awaiting" && "Waiting for you to finish picking in Google Photos..."}
                  {status === "fetching" && "Loading your selections..."}
                </Text>
                {status === "awaiting" && (
                  <TouchableOpacity onPress={reset} style={{ marginTop: spacing.md }}>
                    <Text weight="bodySemi" style={{ color: colors.primaryDark }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.gridContainer}>
              <View style={styles.gridWrap}>{pickedItems.map(renderPhoto)}</View>
            </ScrollView>
            <View style={styles.importFooter}>
              <Button
                title={
                  status === "importing"
                    ? "Importing..."
                    : `Import Selected (${selectedIds.length})`
                }
                onPress={handleImportSelected}
                loading={status === "importing"}
                disabled={selectedIds.length === 0 || status === "importing"}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// Google returns pollInterval as a duration string like "3s" or "0.500s".
function parsePollIntervalMs(value: string | undefined): number | null {
  if (!value) return null;
  const m = value.match(/^([0-9]*\.?[0-9]+)s$/);
  if (!m) return null;
  const seconds = parseFloat(m[1]);
  if (Number.isNaN(seconds)) return null;
  return Math.max(1000, Math.round(seconds * 1000));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, color: colors.text },
  authContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  authTitle: { fontSize: 22, color: colors.text, marginBottom: spacing.xs },
  authDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  gridContainer: { padding: spacing.lg, paddingBottom: 100 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoContainer: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: radius.sm,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.border,
  },
  photo: { width: "100%", height: "100%" },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 130, 146, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  importFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "ios" ? spacing.xl : spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
