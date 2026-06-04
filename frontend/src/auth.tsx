import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY } from "@/src/api";

// Required for the web browser auth session to close itself cleanly.
WebBrowser.maybeCompleteAuthSession();

type User = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  hasCouple: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

useEffect(() => {
  if (request) {
    console.log("[auth] redirectUri:", request.redirectUri);
    console.log("[auth] clientId:",    request.clientId);
  }
}, [request]);

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

const GOOGLE_PHOTOS_TOKEN_KEY = "google_photos_access_token";

// Scopes:
//  - openid/email/profile: identify the user (non-sensitive)
//  - photospicker.mediaitems.readonly: Google Photos Picker API (sensitive but
//    NOT restricted — far lighter verification path than photoslibrary.*).
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasCouple, setHasCouple] = useState(false);

  // expo-auth-session routes to the correct OAuth client per platform.
  // Android uses the Android client (package + SHA-1 — no redirect URI needed).
  // iOS uses the iOS client with the reversed-client URL scheme from the plist.
  // Web uses the Web client with window.location.origin as the redirect.
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: GOOGLE_SCOPES,
  });

  const checkSession = useCallback(async () => {
    try {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const me = await api.get("/auth/me");
      setUser(me.user);
      setHasCouple(me.has_couple);
    } catch (e: any) {
      if (e?.status === 401) {
        await storage.secureRemove(TOKEN_KEY);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const processGoogleToken = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      await storage.secureSet(GOOGLE_PHOTOS_TOKEN_KEY, accessToken);
      const res = await api.post("/auth/session", { access_token: accessToken });
      await storage.secureSet(TOKEN_KEY, res.session_token);
      setUser(res.user);
      const me = await api.get("/auth/me");
      setHasCouple(me.has_couple);
    } catch (e) {
      console.log("processGoogleToken error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Handle the auth response from expo-auth-session.
  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        processGoogleToken(accessToken);
      }
    } else if (response?.type === "error") {
      console.log("Google auth error", response.error);
    }
  }, [response, processGoogleToken]);

  const signIn = useCallback(async () => {
    if (!request) return;
    await promptAsync();
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove(GOOGLE_PHOTOS_TOKEN_KEY);
    setUser(null);
    setHasCouple(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me.user);
      setHasCouple(me.has_couple);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, hasCouple, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
