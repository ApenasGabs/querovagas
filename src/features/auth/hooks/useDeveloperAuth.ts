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
  loginWithGithubOAuth: () => void;
  signOut: () => void;
  reverify: () => Promise<void>;
}

interface InitialAuthState {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  message?: string;
  isModalOpen: boolean;
  needsSessionValidation: boolean;
}

function getInitialAuthState(): InitialAuthState {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const authParam = urlParams.get("auth");

    if (authParam === "success") {
      const token = urlParams.get("token");
      const username = urlParams.get("username") || "dev";
      const name = urlParams.get("name") || username;
      const avatarUrl = urlParams.get("avatar") || undefined;

      if (token) {
        const profile: UserProfile = { username, name, avatarUrl };
        setStoredTrustToken(token);
        setStoredUserProfile(profile);
        window.history.replaceState({}, document.title, window.location.pathname);
        return {
          status: "verified",
          user: profile,
          trustToken: token,
          message: undefined,
          isModalOpen: false,
          needsSessionValidation: false,
        };
      }
    } else if (authParam === "denied") {
      const deniedUser = urlParams.get("username");
      window.history.replaceState({}, document.title, window.location.pathname);
      return {
        status: "unauthenticated",
        user: null,
        trustToken: null,
        message: deniedUser
          ? `O perfil @${deniedUser} não atende aos requisitos de conexão da comunidade.`
          : "Perfil não atende aos requisitos de conexão da comunidade.",
        isModalOpen: false,
        needsSessionValidation: false,
      };
    } else if (authParam === "no_client_id") {
      window.history.replaceState({}, document.title, window.location.pathname);
      return {
        status: "unauthenticated",
        user: null,
        trustToken: null,
        message: undefined,
        isModalOpen: true,
        needsSessionValidation: false,
      };
    }
  }

  const localToken = getStoredTrustToken();
  const localUser = getStoredUserProfile();
  if (localToken) {
    return {
      status: "loading",
      user: localUser,
      trustToken: localToken,
      message: undefined,
      isModalOpen: false,
      needsSessionValidation: true,
    };
  }

  return {
    status: "unauthenticated",
    user: null,
    trustToken: null,
    message: undefined,
    isModalOpen: false,
    needsSessionValidation: false,
  };
}

export function useDeveloperAuth(): UseDeveloperAuthReturn {
  const [initialState] = useState(getInitialAuthState);
  const [status, setStatus] = useState<AuthStatus>(initialState.status);
  const [user, setUser] = useState<UserProfile | null>(initialState.user);
  const [trustToken, setTrustToken] = useState<string | null>(initialState.trustToken);
  const [message, setMessage] = useState<string | undefined>(initialState.message);
  const [isModalOpen, setIsModalOpen] = useState(initialState.isModalOpen);

  useEffect(() => {
    if (!initialState.needsSessionValidation || !initialState.trustToken) return;

    let isMounted = true;
    const token = initialState.trustToken;

    fetch("/api/auth/session", {
      headers: { "x-trust-token": token },
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          return res.json().then((sessionData) => {
            if (!isMounted) return;
            if (sessionData.isVerified) {
              setTrustToken(token);
              setStatus("verified");
            } else {
              setStoredTrustToken(null);
              setStoredUserProfile(null);
              setUser(null);
              setTrustToken(null);
              setStatus("unauthenticated");
            }
          });
        } else {
          setStoredTrustToken(null);
          setStoredUserProfile(null);
          setUser(null);
          setTrustToken(null);
          setStatus("unauthenticated");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[useDeveloperAuth] Erro ao checar sessão:", err);
        setStatus("unauthenticated");
      });

    return () => {
      isMounted = false;
    };
  }, [initialState.needsSessionValidation, initialState.trustToken]);

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

  const loginWithGithubOAuth = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/github";
    }
  }, []);

  const reverify = useCallback(async () => {
    const localToken = getStoredTrustToken();
    if (!localToken) {
      setUser(null);
      setTrustToken(null);
      setStatus("unauthenticated");
      return;
    }
    try {
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
      setStoredTrustToken(null);
      setStoredUserProfile(null);
      setUser(null);
      setTrustToken(null);
      setStatus("unauthenticated");
    } catch {
      setStatus("unauthenticated");
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
    loginWithGithubOAuth,
    signOut: handleSignOut,
    reverify,
  };
}
