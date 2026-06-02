import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";
import { api, API, TOKEN_KEY } from "@/src/api";

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

function parseAccessToken(url: string): string | null {
  if (!url) return null;
  const hashMatch = url.match(/[#&]access_token=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const queryMatch = url.match(/[?&]access_token=([^&]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [hasCouple, setHasCouple] = useState(false);

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
      const res = await api.post("/auth/session", { access_token: accessToken });
      await storage.secureSet(TOKEN_KEY, res.session_token);
      setUser(res.user);
      // fetch couple status
      const me = await api.get("/auth/me");
      setHasCouple(me.has_couple);
    } catch (e) {
      console.log("processGoogleToken error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Web: detect access_token in URL on mount
  useEffect(() => {
    if (Platform.OS === "web") {
      const href = window.location.hash || window.location.search;
      const token = parseAccessToken(href);
      if (token) {
        window.history.replaceState(null, "", window.location.pathname);
        storage.secureSet("google_photos_access_token", token).then(() => {
          processGoogleToken(token);
        });
        return;
      }
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile: cold start + hot link listener
  useEffect(() => {
    if (Platform.OS === "web") return;
    Linking.getInitialURL().then((url) => {
      if (url) {
        const token = parseAccessToken(url);
        if (token) {
          storage.secureSet("google_photos_access_token", token).then(() => {
            processGoogleToken(token);
          });
        }
      }
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      const token = parseAccessToken(url);
      if (token) {
        storage.secureSet("google_photos_access_token", token).then(() => {
          processGoogleToken(token);
        });
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("Missing Client ID. Please configure EXPO_PUBLIC_GOOGLE_CLIENT_ID in your env file.");
      return;
    }
    const redirectUrl = Platform.OS === "web"
      ? window.location.origin + "/"
      : Linking.createURL("auth");

    const scope = "openid email profile https://www.googleapis.com/auth/photoslibrary.readonly";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?response_type=token` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const token = parseAccessToken(result.url);
      if (token) {
        await storage.secureSet("google_photos_access_token", token);
        await processGoogleToken(token);
      }
    }
  }, [processGoogleToken]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove("google_photos_access_token");
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
