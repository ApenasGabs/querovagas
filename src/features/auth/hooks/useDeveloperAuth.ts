import { useEffect, useState, useCallback } from "react";
import {
  getStoredTrustToken,
  getStoredUserProfile,
  getSupabaseAuthClient,
  setStoredTrustToken,
  setStoredUserProfile,
  signInWithGithub,
  signOut as signOutService,
  verifyTrustWithBackend,
  type AuthStatus,
  type UserProfile,
} from "../../../services/trustAuthService";

export interface UseDeveloperAuthReturn {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  message?: string;
  isVerified: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reverify: () => Promise<void>;
}

export function useDeveloperAuth(): UseDeveloperAuthReturn {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUserProfile());
  const [trustToken, setTrustToken] = useState<string | null>(() => getStoredTrustToken());
  const [message, setMessage] = useState<string | undefined>();

  const checkInitialSession = useCallback(async () => {
    try {
      const client = getSupabaseAuthClient();
      const { data: { session } } = await client.auth.getSession();

      if (session) {
        const meta = session.user.user_metadata || {};
        const profile: UserProfile = {
          username:
            meta.user_name ||
            meta.preferred_username ||
            meta.user_name_github ||
            meta.name ||
            "dev",
          name: meta.full_name || meta.name,
          avatarUrl: meta.avatar_url,
        };
        setUser(profile);
        setStoredUserProfile(profile);

        const check = await verifyTrustWithBackend(session);
        if (check.isVerified && check.trustToken) {
          setTrustToken(check.trustToken);
          setStatus("verified");
          setMessage(undefined);
        } else {
          setTrustToken(null);
          setStatus("pending");
          setMessage(check.message);
        }
        return;
      }

      // Se não há sessão do Supabase ativa, mas tínhamos um token local previamente salvo
      const localToken = getStoredTrustToken();
      if (localToken) {
        try {
          const res = await fetch("/api/auth/session", {
            headers: { "x-trust-token": localToken },
          });
          const sessionData = await res.json();
          if (sessionData.isVerified) {
            setTrustToken(localToken);
            setStatus("verified");
            return;
          }
        } catch {
          // Token inválido ou expirado
        }
      }

      // Sem sessão ativa
      setTrustToken(null);
      setStatus("unauthenticated");
    } catch (err) {
      console.warn("[useDeveloperAuth] Erro ao checar sessão:", err);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkInitialSession();

    const client = getSupabaseAuthClient();
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const meta = session.user.user_metadata || {};
        const profile: UserProfile = {
          username:
            meta.user_name ||
            meta.preferred_username ||
            meta.user_name_github ||
            meta.name ||
            "dev",
          name: meta.full_name || meta.name,
          avatarUrl: meta.avatar_url,
        };
        setUser(profile);
        setStoredUserProfile(profile);

        const check = await verifyTrustWithBackend(session);
        if (check.isVerified && check.trustToken) {
          setTrustToken(check.trustToken);
          setStatus("verified");
          setMessage(undefined);
        } else {
          setTrustToken(null);
          setStatus("pending");
          setMessage(check.message);
        }
      } else if (event === "SIGNED_OUT") {
        setStoredTrustToken(null);
        setStoredUserProfile(null);
        setUser(null);
        setTrustToken(null);
        setStatus("unauthenticated");
        setMessage(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkInitialSession]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGithub();
    } catch (err) {
      console.error("[useDeveloperAuth] Erro ao iniciar login:", err);
      throw err;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutService();
      setUser(null);
      setTrustToken(null);
      setStatus("unauthenticated");
    } catch (err) {
      console.error("[useDeveloperAuth] Erro ao sair:", err);
    }
  }, []);

  return {
    status,
    user,
    trustToken,
    message,
    isVerified: status === "verified",
    isLoading: status === "loading",
    signIn: handleSignIn,
    signOut: handleSignOut,
    reverify: checkInitialSession,
  };
}
