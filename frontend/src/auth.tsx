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

const AUTH_URL = "https://auth.emergentagent.com/";

function parseSessionId(url: string): string | null {
  if (!url) return null;
  const hashMatch = url.match(/[#&]session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const queryMatch = url.match(/[?&]session_id=([^&]+)/);
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

  const processSessionId = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/session", { session_id: sessionId });
      await storage.secureSet(TOKEN_KEY, res.session_token);
      setUser(res.user);
      // fetch couple status
      const me = await api.get("/auth/me");
      setHasCouple(me.has_couple);
    } catch (e) {
      console.log("processSessionId error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Web: detect session_id in URL on mount
  useEffect(() => {
    if (Platform.OS === "web") {
      const href = window.location.hash || window.location.search;
      const sid = parseSessionId(href);
      if (sid) {
        window.history.replaceState(null, "", window.location.pathname);
        processSessionId(sid);
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
        const sid = parseSessionId(url);
        if (sid) processSessionId(sid);
      }
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = parseSessionId(url);
      if (sid) processSessionId(sid);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async () => {
    if (Platform.OS === "web") {
      const redirectUrl = window.location.origin + "/";
      window.location.href = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }
    const redirectUrl = Linking.createURL("auth");
    const authUrl = `${AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = parseSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  }, [processSessionId]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
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
