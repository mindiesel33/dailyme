import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Text, Button } from "@/src/components/ui";
import { colors, fonts, spacing, radius, shadow } from "@/src/theme";
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

interface MediaItem {
  id: string;
  baseUrl: string;
  filename: string;
}

const STORAGE_TOKEN_KEY = "google_photos_access_token";

// Helper to convert remote image URL to base64 Data URI
const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
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
  const [token, setToken] = useState<string>("");
  const [manualToken, setManualToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);

  // Load saved token on mount
  useEffect(() => {
    if (visible) {
      storage.secureGet<string>(STORAGE_TOKEN_KEY, "").then((savedToken) => {
        if (savedToken) {
          setToken(savedToken);
          fetchPhotos(savedToken);
        }
      });
    }
  }, [visible]);

  const fetchPhotos = async (accessToken: string, loadMoreToken: string | null = null) => {
    setLoading(true);
    try {
      let url = "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=60";
      if (loadMoreToken) {
        url += `&pageToken=${loadMoreToken}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          await storage.secureRemove(STORAGE_TOKEN_KEY);
          setToken("");
          Alert.alert("Session Expired", "Please reconnect your Google account.");
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Failed to fetch photos");
        }
        return;
      }

      const data = await res.json();
      const items = (data.mediaItems || []).map((item: any) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        filename: item.filename,
      }));

      if (loadMoreToken) {
        setMediaItems((prev) => [...prev, ...items]);
      } else {
        setMediaItems(items);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      Alert.alert("Google Photos Error", err.message || "Could not retrieve photos");
    } finally {
      setLoading(false);
    }
  };

  const { signOut } = useAuth();

  const handleSignOutAndReconnect = async () => {
    try {
      await signOut();
      onClose();
    } catch (err: any) {
      Alert.alert("Sign Out Error", err.message || "Failed to sign out");
    }
  };

  const handleManualTokenSubmit = async () => {
    const trimmed = manualToken.trim();
    if (!trimmed) return;
    await storage.secureSet(STORAGE_TOKEN_KEY, trimmed);
    setToken(trimmed);
    setManualToken("");
    fetchPhotos(trimmed);
  };

  const handleDisconnect = async () => {
    await storage.secureRemove(STORAGE_TOKEN_KEY);
    setToken("");
    setMediaItems([]);
    setSelectedIds([]);
    setNextPageToken(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxSelection) {
        Alert.alert("Limit Reached", `You can only select up to ${maxSelection} photos.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleImportSelected = async () => {
    if (selectedIds.length === 0) return;
    setImporting(true);
    try {
      const selectedItems = mediaItems.filter((item) => selectedIds.includes(item.id));
      const base64s: string[] = [];

      for (const item of selectedItems) {
        // Fetch the photo with =w1024-h1024 constraint to download a reasonably sized file
        const photoUrl = `${item.baseUrl}=w1024-h1024`;
        const b64 = await urlToBase64(photoUrl);
        base64s.push(b64);
      }

      onImport(base64s);
      setSelectedIds([]);
      onClose();
    } catch (err: any) {
      Alert.alert("Import Failed", "Could not convert Google Photos. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const renderPhotoItem = ({ item }: { item: MediaItem }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Header bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text weight="headingSemi" style={styles.headerTitle}>
            Google Photos
          </Text>
          {token ? (
            <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
              <Text weight="bodySemi" style={styles.disconnectText}>
                Disconnect
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Content */}
        {!token ? (
          <View style={styles.authContainer}>
            <Ionicons name="logo-google" size={60} color={colors.primary} style={{ marginBottom: spacing.md }} />
            <Text weight="headingMedium" style={styles.authTitle}>
              Google Photos Disconnected
            </Text>
            <Text weight="body" style={styles.authDesc}>
              Permission to access your Google Photos library is missing or has expired. Please sign out and sign back in to grant permission.
            </Text>

            <Button
              title="Sign Out to Reconnect"
              onPress={handleSignOutAndReconnect}
              icon={<Ionicons name="logo-google" size={20} color="#fff" />}
              style={{ width: "100%", marginTop: spacing.lg }}
            />

            <TouchableOpacity
              onPress={() => setShowTokenInput(!showTokenInput)}
              style={styles.toggleTokenBtn}
            >
              <Text weight="bodySemi" style={styles.toggleTokenText}>
                {showTokenInput ? "Hide manual token option" : "Use manual Google Access Token"}
              </Text>
            </TouchableOpacity>

            {showTokenInput && (
              <View style={styles.tokenInputContainer}>
                <TextInput
                  value={manualToken}
                  onChangeText={setManualToken}
                  placeholder="Paste OAuth Access Token"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.tokenInput}
                />
                <Button
                  title="Load Photos"
                  onPress={handleManualTokenSubmit}
                  disabled={!manualToken.trim()}
                  style={{ marginTop: spacing.sm }}
                />
                <Text weight="body" style={styles.tokenHint}>
                  Generate temporary tokens at developers.google.com/oauthplayground (select Photos Library API readonly scope).
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {loading && mediaItems.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text weight="body" style={{ marginTop: spacing.sm, color: colors.textSecondary }}>
                  Loading Google Photos...
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <FlatList
                  data={mediaItems}
                  renderItem={renderPhotoItem}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.gridContainer}
                  columnWrapperStyle={styles.gridRow}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="images-outline" size={48} color={colors.textMuted} />
                      <Text weight="body" style={styles.emptyText}>
                        No photos found in your Google Photos library.
                      </Text>
                    </View>
                  }
                  onEndReached={() => {
                    if (nextPageToken && !loading) {
                      fetchPhotos(token, nextPageToken);
                    }
                  }}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={
                    loading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={{ marginVertical: spacing.md }}
                      />
                    ) : null
                  }
                />

                {/* Import floating bar */}
                {selectedIds.length > 0 && (
                  <View style={styles.importFooter}>
                    <Button
                      title={importing ? "Importing..." : `Import Selected (${selectedIds.length})`}
                      onPress={handleImportSelected}
                      loading={importing}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
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
  disconnectBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primaryLight },
  disconnectText: { color: colors.primaryDark, fontSize: 13 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  toggleTokenBtn: { marginTop: spacing.lg, paddingVertical: 10 },
  toggleTokenText: { color: colors.primaryDark, fontSize: 14 },
  tokenInputContainer: { width: "100%", marginTop: spacing.md, paddingHorizontal: spacing.xs },
  tokenInput: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
  },
  tokenHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 16, textAlign: "center" },
  gridContainer: { padding: spacing.lg, paddingBottom: 100 },
  gridRow: { gap: 10, marginBottom: 10 },
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
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: "center", paddingHorizontal: spacing.xl },
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
