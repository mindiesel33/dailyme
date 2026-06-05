import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
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

  const redirectUrl = Linking.createURL("oauthredirect");

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

  const signIn = useCallback(async () => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      console.error("Google Web Client ID not set");
      return;
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(webClientId)}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=token&scope=${encodeURIComponent(GOOGLE_SCOPES.join(" "))}`;
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success") {
        const url = result.url;
        const match = url.match(/access_token=([^&]+)/);
        if (match) {
          const accessToken = decodeURIComponent(match[1]);
          await processGoogleToken(accessToken);
        }
      } else if (result.type === "error") {
        console.log("Auth cancelled or error");
      }
    } catch (e) {
      console.log("signIn error", e);
    }
  }, [processGoogleToken, redirectUrl]);

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
