export const TRUST_TOKEN_KEY = "qv_dev_trust_token";
export const USER_PROFILE_KEY = "qv_dev_user_profile";
export const UTTERANCES_SESSION_KEY = "utterances-session";

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

export function getStoredUtterancesSession(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return localStorage.getItem(UTTERANCES_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredUtterancesSession(session: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (session) {
      localStorage.setItem(UTTERANCES_SESSION_KEY, session);
    } else {
      localStorage.removeItem(UTTERANCES_SESSION_KEY);
    }
  } catch (err) {
    console.warn("[TrustAuth] Falha ao persistir sessão do Utterances:", err);
  }
}

/**
 * Intercepta o retorno OAuth do Utterances (?utterances=...) na URL da página,
 * persiste no localStorage sob a chave oficial "utterances-session" para que o
 * iframe do Utterances também carregue autenticado e limpa a URL.
 */
export function captureUtterancesSessionFromUrl(): {
  session: string | null;
  fromRedirect: boolean;
} {
  if (typeof window === "undefined") {
    return { session: null, fromRedirect: false };
  }

  try {
    const currentUrl = new URL(window.location.href);
    const utterancesParam = currentUrl.searchParams.get("utterances");
    if (utterancesParam && utterancesParam.trim()) {
      const cleanSession = utterancesParam.trim();
      setStoredUtterancesSession(cleanSession);
      currentUrl.searchParams.delete("utterances");
      window.history.replaceState(undefined, document.title, currentUrl.href);
      return { session: cleanSession, fromRedirect: true };
    }
  } catch {
    // Ignora caso window.location.href seja inválido em ambiente de teste
  }

  return {
    session: getStoredUtterancesSession(),
    fromRedirect: false,
  };
}

/**
 * Resolve a sessão do Utterances no backend para obter os dados do usuário no GitHub
 * e validar a reputação comunitária.
 */
export async function verifyUtterancesSessionWithBackend(
  utterancesSession: string,
): Promise<{
  isVerified: boolean;
  trustToken?: string;
  user?: UserProfile;
  message?: string;
}> {
  try {
    const cleanSession = utterancesSession.trim();
    if (!cleanSession) {
      return { isVerified: false, message: "Sessão do Utterances ausente." };
    }

    const res = await fetch("/api/auth/verify-trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterancesSession: cleanSession }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        isVerified: false,
        message: errData.error || "Falha ao validar sessão do Utterances.",
      };
    }

    const data = await res.json();
    const profile: UserProfile | undefined = data.user?.username
      ? {
          username: data.user.username,
          name: data.user.name || data.user.username,
          avatarUrl: data.user.avatarUrl,
        }
      : undefined;

    if (profile) {
      setStoredUserProfile(profile);
    }

    if (data.isVerified && data.trustToken) {
      setStoredTrustToken(data.trustToken);
      return {
        isVerified: true,
        trustToken: data.trustToken,
        user: profile,
      };
    }

    setStoredTrustToken(null);
    return {
      isVerified: false,
      user: profile,
      message: data.message,
    };
  } catch (err) {
    console.warn("[TrustAuth] Erro ao resolver sessão do Utterances no backend:", err);
    return { isVerified: false, message: "Erro de rede ao validar sessão." };
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
    const profile: UserProfile = data.user || { username: cleanUsername };
    setStoredUserProfile(profile);

    if (data.isVerified && data.trustToken) {
      setStoredTrustToken(data.trustToken);
      return {
        isVerified: true,
        trustToken: data.trustToken,
        user: profile,
      };
    }

    return {
      isVerified: false,
      message: data.message || "Perfil não atende aos requisitos de conexão da comunidade.",
      user: profile,
    };
  } catch (err) {
    console.warn("[TrustAuth] Erro ao validar reputação com o backend:", err);
    return { isVerified: false, message: "Erro de rede ao validar perfil." };
  }
}

/**
 * Encerra a sessão local e limpa também a sessão do Utterances
 */
export function signOut(): void {
  setStoredTrustToken(null);
  setStoredUserProfile(null);
  setStoredUtterancesSession(null);
}
