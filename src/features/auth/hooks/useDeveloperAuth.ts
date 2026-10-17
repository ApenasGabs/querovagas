import { useEffect, useState, useCallback } from "react";
import {
  getStoredTrustToken,
  getStoredUserProfile,
  setStoredTrustToken,
  setStoredUserProfile,
  signOut as signOutService,
  verifyUsernameWithBackend,
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
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  signIn: (username: string) => Promise<boolean>;
  signOut: () => void;
  reverify: () => Promise<void>;
}

export function useDeveloperAuth(): UseDeveloperAuthReturn {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUserProfile());
  const [trustToken, setTrustToken] = useState<string | null>(() => getStoredTrustToken());
  const [message, setMessage] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const checkInitialSession = useCallback(async () => {
    try {
      const localToken = getStoredTrustToken();
      if (localToken) {
        const res = await fetch("/api/auth/session", {
          headers: { "x-trust-token": localToken },
        });
        if (res.ok) {
          const sessionData = await res.json();
          if (sessionData.isVerified) {
            setTrustToken(localToken);
            setStatus("verified");
            return;
          }
        }
      }

      // Se não há token válido salvo
      setStoredTrustToken(null);
      setStoredUserProfile(null);
      setUser(null);
      setTrustToken(null);
      setStatus("unauthenticated");
    } catch (err) {
      console.warn("[useDeveloperAuth] Erro ao checar sessão:", err);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkInitialSession();
  }, [checkInitialSession]);

  const handleSignIn = useCallback(async (username: string): Promise<boolean> => {
    const res = await verifyUsernameWithBackend(username);
    if (res.isVerified && res.trustToken) {
      setTrustToken(res.trustToken);
      setUser(res.user || { username });
      setStatus("verified");
      setMessage(undefined);
      return true;
    } else {
      setMessage(res.message);
      return false;
    }
  }, []);

  const handleSignOut = useCallback(() => {
    signOutService();
    setUser(null);
    setTrustToken(null);
    setStatus("unauthenticated");
    setMessage(undefined);
  }, []);

  return {
    status,
    user,
    trustToken,
    message,
    isVerified: status === "verified",
    isLoading: status === "loading",
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    signIn: handleSignIn,
    signOut: handleSignOut,
    reverify: checkInitialSession,
  };
}
