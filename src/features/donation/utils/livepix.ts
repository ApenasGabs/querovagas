/**
 * Configurações e utilitários de integração com LivePix
 */

export const DEFAULT_LIVEPIX_USERNAME = "apenasgabs";

export const PRESET_DONATION_AMOUNTS = [5, 10, 25, 50, 100] as const;

export type PresetDonationAmount = (typeof PRESET_DONATION_AMOUNTS)[number];

export interface LivePixDonationOptions {
  username?: string;
  amount?: number;
  message?: string;
}

/**
 * Valida se uma URL é estritamente do domínio oficial do LivePix
 */
export const isSafeLivePixUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (parsed.hostname === "livepix.gg" || parsed.hostname.endsWith(".livepix.gg"))
    );
  } catch {
    return false;
  }
};

/**
 * Garante que a URL seja segura antes de redirecionar ou abrir nova aba
 */
export const assertSafeLivePixUrl = (url: string): string => {
  if (!isSafeLivePixUrl(url)) {
    throw new Error(`URL de doação inválida ou insegura: ${url}`);
  }
  return url;
};

/**
 * Retorna o username efetivo do LivePix configurado no ambiente ou fallback
 */
export const getLivePixUsername = (): string => {
  const envUsername = import.meta.env.VITE_LIVEPIX_USERNAME as string | undefined;
  return (envUsername && envUsername.trim()) || DEFAULT_LIVEPIX_USERNAME;
};

/**
 * Constrói a URL pública de doação do LivePix com parâmetros opcionais de valor e mensagem
 */
export const buildLivePixDonationUrl = (options?: LivePixDonationOptions): string => {
  const username = options?.username?.trim() || getLivePixUsername();
  const cleanUsername = username.replace(/^@/, "");

  const url = new URL(`https://livepix.gg/${encodeURIComponent(cleanUsername)}`);

  if (options?.amount && options.amount > 0) {
    url.searchParams.set("amount", options.amount.toString());
  }

  if (options?.message && options.message.trim()) {
    url.searchParams.set("message", options.message.trim());
  }

  return assertSafeLivePixUrl(url.toString());
};
