import { useCallback, useEffect, useState } from "react";
import {
  captureUtterancesSessionFromUrl,
  getStoredTrustToken,
  getStoredUserProfile,
  getStoredUtterancesSession,
  setStoredTrustToken,
  setStoredUserProfile,
  signOut as signOutService,
  verifyUtterancesSessionWithBackend,
  type AuthStatus,
  type UserProfile,
} from "../../../services/trustAuthService";

export interface UseDeveloperAuthReturn {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  isVerified: boolean;
  isLoading: boolean;
  returnedFromUtterances: boolean;
  signOut: () => void;
  syncUtterancesSession: () => Promise<void>;
}

interface InitialAuthState {
  status: AuthStatus;
  user: UserProfile | null;
  trustToken: string | null;
  utterancesSessionToResolve: string | null;
  needsSessionValidation: boolean;
  returnedFromUtterances: boolean;
}

function getInitialAuthState(): InitialAuthState {
  const { session: utterancesSession, fromRedirect } = captureUtterancesSessionFromUrl();
  const localToken = getStoredTrustToken();
  const localUser = getStoredUserProfile();

  // 1. Se acabou de voltar do login do Utterances (?utterances=...), resolve a nova sessão imediatamente
  if (fromRedirect && utterancesSession) {
    return {
      status: "loading",
      user: localUser,
      trustToken: localToken,
      utterancesSessionToResolve: utterancesSession,
      needsSessionValidation: false,
      returnedFromUtterances: true,
    };
  }

  // 2. Se já possui trustToken local salvo, valida a sessão existente
  if (localToken) {
    return {
      status: "loading",
      user: localUser,
      trustToken: localToken,
      utterancesSessionToResolve: null,
      needsSessionValidation: true,
      returnedFromUtterances: false,
    };
  }

  // 3. Se existe utterances-session no localStorage mas ainda não temos o perfil do usuário resolvido
  if (utterancesSession && !localUser) {
    return {
      status: "loading",
      user: null,
      trustToken: null,
      utterancesSessionToResolve: utterancesSession,
      needsSessionValidation: false,
      returnedFromUtterances: false,
    };
  }

  return {
    status: "unauthenticated",
    user: localUser,
    trustToken: null,
    utterancesSessionToResolve: null,
    needsSessionValidation: false,
    returnedFromUtterances: false,
  };
}

export function useDeveloperAuth(): UseDeveloperAuthReturn {
  const [initialState] = useState(getInitialAuthState);
  const [status, setStatus] = useState<AuthStatus>(initialState.status);
  const [user, setUser] = useState<UserProfile | null>(initialState.user);
  const [trustToken, setTrustToken] = useState<string | null>(initialState.trustToken);

  // Resolve sessão do Utterances quando capturada da URL ou do localStorage
  useEffect(() => {
    const sessionToResolve = initialState.utterancesSessionToResolve;
    if (!sessionToResolve) return;

    let isMounted = true;

    verifyUtterancesSessionWithBackend(sessionToResolve)
      .then((res) => {
        if (!isMounted) return;
        if (res.user) {
          setUser(res.user);
        }
        if (res.isVerified && res.trustToken) {
          setTrustToken(res.trustToken);
          setStatus("verified");
        } else {
          setTrustToken(null);
          setStatus("unauthenticated");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus("unauthenticated");
      });

    return () => {
      isMounted = false;
    };
  }, [initialState.utterancesSessionToResolve]);

  // Valida trustToken existente caso já estivesse autenticado antes
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

  const syncUtterancesSession = useCallback(async () => {
    const { session } = captureUtterancesSessionFromUrl();
    const activeSession = session || getStoredUtterancesSession();
    if (!activeSession) return;

    const res = await verifyUtterancesSessionWithBackend(activeSession);
    if (res.user) {
      setUser(res.user);
    }
    if (res.isVerified && res.trustToken) {
      setTrustToken(res.trustToken);
      setStatus("verified");
    } else {
      setTrustToken(null);
      setStatus("unauthenticated");
    }
  }, []);

  const handleSignOut = useCallback(() => {
    signOutService();
    setUser(null);
    setTrustToken(null);
    setStatus("unauthenticated");
  }, []);

  return {
    status,
    user,
    trustToken,
    isVerified: status === "verified",
    isLoading: status === "loading",
    returnedFromUtterances: initialState.returnedFromUtterances,
    signOut: handleSignOut,
    syncUtterancesSession,
  };
}
