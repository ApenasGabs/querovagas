import { useCallback, useState } from "react";
import {
  DEFAULT_LLM_PROVIDER,
  getProviderOption,
  isLlmProviderId,
  type LlmProviderId,
  type LlmSettings,
} from "../types";

export const LLM_PREFS_KEY = "qv_llm_prefs";
export const LLM_KEY_STORAGE_KEY = "qv_llm_api_key";

interface StoredPrefs {
  provider: LlmProviderId;
  models: Partial<Record<LlmProviderId, string>>;
  rememberKey: boolean;
}

const safeGet = (storage: Storage | undefined, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage | undefined, key: string, value: string | null): void => {
  try {
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // storage indisponível
  }
};

const getStorages = (): { local?: Storage; session?: Storage } =>
  typeof window === "undefined" ? {} : { local: window.localStorage, session: window.sessionStorage };

const readPrefs = (): StoredPrefs => {
  const fallback: StoredPrefs = { provider: DEFAULT_LLM_PROVIDER, models: {}, rememberKey: false };
  const raw = safeGet(getStorages().local, LLM_PREFS_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      provider: isLlmProviderId(parsed.provider) ? parsed.provider : DEFAULT_LLM_PROVIDER,
      models: parsed.models && typeof parsed.models === "object" ? parsed.models : {},
      rememberKey: parsed.rememberKey === true,
    };
  } catch {
    return fallback;
  }
};

/** Chaves são guardadas por provedor: `qv_llm_api_key:<provider>`. */
const keyStorageName = (provider: LlmProviderId): string => `${LLM_KEY_STORAGE_KEY}:${provider}`;

const readKey = (provider: LlmProviderId): string => {
  const { local, session } = getStorages();
  return safeGet(session, keyStorageName(provider)) ?? safeGet(local, keyStorageName(provider)) ?? "";
};

const buildSettings = (prefs: StoredPrefs): LlmSettings => ({
  provider: prefs.provider,
  model: prefs.models[prefs.provider] ?? getProviderOption(prefs.provider).defaultModel,
  apiKey: readKey(prefs.provider),
  rememberKey: prefs.rememberKey,
});

/**
 * Configurações BYOK do provedor de IA.
 * - Provedor/modelo: localStorage.
 * - Chave: sessionStorage (padrão, some ao fechar a aba) ou localStorage se "lembrar" estiver ativo.
 * A chave nunca é enviada ao QueroVagas para armazenamento; só trafega no header da análise.
 */
export const useLlmSettings = () => {
  const [prefs, setPrefs] = useState<StoredPrefs>(readPrefs);
  const [settings, setSettings] = useState<LlmSettings>(() => buildSettings(prefs));

  const persistPrefs = useCallback((next: StoredPrefs) => {
    setPrefs(next);
    safeSet(getStorages().local, LLM_PREFS_KEY, JSON.stringify(next));
  }, []);

  const persistKey = useCallback((provider: LlmProviderId, apiKey: string, remember: boolean) => {
    const { local, session } = getStorages();
    const name = keyStorageName(provider);
    const value = apiKey.trim() ? apiKey.trim() : null;
    if (remember) {
      safeSet(local, name, value);
      safeSet(session, name, null);
    } else {
      safeSet(session, name, value);
      safeSet(local, name, null);
    }
  }, []);

  const setProvider = useCallback(
    (provider: LlmProviderId) => {
      const next = { ...prefs, provider };
      persistPrefs(next);
      setSettings(buildSettings(next));
    },
    [prefs, persistPrefs],
  );

  const setModel = useCallback(
    (model: string) => {
      persistPrefs({ ...prefs, models: { ...prefs.models, [prefs.provider]: model } });
      setSettings((s) => ({ ...s, model }));
    },
    [prefs, persistPrefs],
  );

  const setApiKey = useCallback(
    (apiKey: string) => {
      persistKey(prefs.provider, apiKey, prefs.rememberKey);
      setSettings((s) => ({ ...s, apiKey }));
    },
    [prefs.provider, prefs.rememberKey, persistKey],
  );

  const setRememberKey = useCallback(
    (rememberKey: boolean) => {
      persistPrefs({ ...prefs, rememberKey });
      persistKey(prefs.provider, settings.apiKey, rememberKey);
      setSettings((s) => ({ ...s, rememberKey }));
    },
    [prefs, settings.apiKey, persistPrefs, persistKey],
  );

  const forgetKey = useCallback(() => {
    const { local, session } = getStorages();
    safeSet(local, keyStorageName(prefs.provider), null);
    safeSet(session, keyStorageName(prefs.provider), null);
    setSettings((s) => ({ ...s, apiKey: "" }));
  }, [prefs.provider]);

  return { settings, setProvider, setModel, setApiKey, setRememberKey, forgetKey };
};
