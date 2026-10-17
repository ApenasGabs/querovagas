import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

export const TRUST_TOKEN_KEY = "qv_dev_trust_token";
export const USER_PROFILE_KEY = "qv_dev_user_profile";

export interface UserProfile {
  username: string;
  name?: string;
  avatarUrl?: string;
}

export type AuthStatus = "loading" | "unauthenticated" | "pending" | "verified";

export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  message?: string;
}

let supabaseAuthClient: SupabaseClient | null = null;

export function getSupabaseAuthClient(): SupabaseClient {
  if (!supabaseAuthClient) {
    const targetBase =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
      "https://gglsmwtyrwadwxyvevmr.supabase.co";
    const anonKey =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbHNtd3R5cndhZHd4eXZldm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTI1MDIsImV4cCI6MjEwNTA4ODUwMn0.jSRnLVyzCse-Q1xiQ3--BwU4knRDvDSiaZpLEcY38bY";
    supabaseAuthClient = createClient(targetBase, anonKey);
  }
  return supabaseAuthClient;
}

export function getStoredTrustToken(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return localStorage.getItem(TRUST_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredTrustToken(token: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (token) {
      localStorage.setItem(TRUST_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TRUST_TOKEN_KEY);
    }
  } catch (err) {
    console.warn("[TrustAuth] Falha ao persistir trust token:", err);
  }
}

export function getStoredUserProfile(): UserProfile | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUserProfile(profile: UserProfile | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (profile) {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(USER_PROFILE_KEY);
    }
  } catch (err) {
    console.warn("[TrustAuth] Falha ao persistir perfil:", err);
  }
}

/**
 * Dispara o fluxo oficial de login via OAuth com GitHub
 */
export async function signInWithGithub(): Promise<void> {
  const client = getSupabaseAuthClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
  if (error) {
    throw error;
  }
}

/**
 * Realiza logout da sessão e limpa credenciais de acesso
 */
export async function signOut(): Promise<void> {
  const client = getSupabaseAuthClient();
  await client.auth.signOut();
  setStoredTrustToken(null);
  setStoredUserProfile(null);
}

/**
 * Valida a sessão contra o gateway camuflado no backend
 */
export async function verifyTrustWithBackend(
  session?: Session | null,
  overrideUsername?: string,
): Promise<{ isVerified: boolean; trustToken?: string; message?: string; username?: string }> {
  try {
    const token = session?.access_token;
    const meta = session?.user?.user_metadata || {};
    const username =
      overrideUsername ||
      meta.user_name ||
      meta.preferred_username ||
      meta.user_name_github ||
      meta.name;

    if (!token && !username) {
      return { isVerified: false, message: "Sessão não identificada" };
    }

    const res = await fetch("/api/auth/verify-trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, username }),
    });

    if (!res.ok) {
      return { isVerified: false, message: "Falha na comunicação com o validador" };
    }

    const data = await res.json();
    if (data.isVerified && data.trustToken) {
      setStoredTrustToken(data.trustToken);
      return {
        isVerified: true,
        trustToken: data.trustToken,
        username: data.username || username,
      };
    }

    setStoredTrustToken(null);
    return {
      isVerified: false,
      message: data.message || "Perfil em fila de análise da moderação técnica.",
      username: data.username || username,
    };
  } catch (err) {
    console.warn("[TrustAuth] Erro ao validar reputação com o backend:", err);
    return { isVerified: false, message: "Erro de rede ao validar perfil." };
  }
}
