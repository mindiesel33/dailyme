// API client for Daily Dose of Me. Injects the Bearer session token.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;
export const TOKEN_KEY = "ddom_session_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handle(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || `Request failed (${res.status})`;
    const err: any = new Error(typeof detail === "string" ? detail : "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  async get(path: string) {
    const res = await fetch(`${API}${path}`, { headers: await authHeaders() });
    return handle(res);
  },
  async post(path: string, body?: any) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: await authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handle(res);
  },
  async put(path: string, body?: any) {
    const res = await fetch(`${API}${path}`, {
      method: "PUT",
      headers: await authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handle(res);
  },
  async del(path: string) {
    const res = await fetch(`${API}${path}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    return handle(res);
  },
};
