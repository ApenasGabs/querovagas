export const TRUST_TOKEN_KEY = "qv_dev_trust_token";
export const USER_PROFILE_KEY = "qv_dev_user_profile";

export interface UserProfile {
  username: string;
  name?: string;
  avatarUrl?: string;
}

export type AuthStatus = "loading" | "unauthenticated" | "verified";

export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  message?: string;
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
 * Valida o usuário informado contra a API de verificação comunitária
 */
export async function verifyUsernameWithBackend(
  username: string,
): Promise<{ isVerified: boolean; trustToken?: string; user?: UserProfile; message?: string }> {
  try {
    const cleanUsername = username.trim().replace(/^@+/, "");
    if (!cleanUsername) {
      return { isVerified: false, message: "Informe um usuário do GitHub válido." };
    }

    const res = await fetch("/api/auth/verify-trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        isVerified: false,
        message: errData.error || "Falha na comunicação com o validador.",
      };
    }

    const data = await res.json();
    if (data.isVerified && data.trustToken) {
      setStoredTrustToken(data.trustToken);
      const profile: UserProfile = data.user || { username: cleanUsername };
      setStoredUserProfile(profile);
      return {
        isVerified: true,
        trustToken: data.trustToken,
        user: profile,
      };
    }

    return {
      isVerified: false,
      message: data.message || "Perfil não atende aos requisitos de conexão da comunidade.",
      user: data.user,
    };
  } catch (err) {
    console.warn("[TrustAuth] Erro ao validar reputação com o backend:", err);
    return { isVerified: false, message: "Erro de rede ao validar perfil." };
  }
}

/**
 * Encerra a sessão local
 */
export function signOut(): void {
  setStoredTrustToken(null);
  setStoredUserProfile(null);
}
