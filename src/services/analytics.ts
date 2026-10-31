import posthog from "posthog-js";

let isInitialized = false;

/**
 * Inicializa o PostHog caso as credenciais estejam disponíveis.
 * Se a chave não for fornecida (ex: desenvolvimento local ou CI), opera em modo fallback silencioso.
 */
export function initAnalytics(): void {
  if (typeof window === "undefined" || isInitialized) {
    return;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost =
    import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.info(
        "[Analytics] PostHog API Key não configurada. Operando em modo de simulação/mock.",
      );
    }
    return;
  }

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      person_profiles: "identified_only",
      capture_pageview: false, // Controlado manualmente para injetar metadados ricos
      capture_pageleave: true,
      autocapture: true, // Captura cliques e heatmaps automáticos
      persistence: "localStorage+cookie",
      loaded: () => {
        isInitialized = true;
      },
    });
    isInitialized = true;
  } catch (error) {
    console.warn("[Analytics] Falha ao inicializar PostHog:", error);
  }
}

/**
 * Detecta tipo de dispositivo simplificado
 */
function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  const isTouch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)")?.matches;
  if (/Android|iPhone|iPod|Mobi/i.test(ua) || isTouch) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Rastreia visualização de página com metadados de autenticação e dispositivo
 */
export function trackPageView(properties?: Record<string, unknown>): void {
  if (!isInitialized) return;
  posthog.capture("$pageview", {
    device_type: getDeviceType(),
    path: window.location.pathname,
    ...properties,
  });
}

/**
 * Rastreia clique de intenção de login
 */
export function trackLoginInitiated(source: "navbar" | "radar" | "inline"): void {
  if (!isInitialized) return;
  posthog.capture("login_initiated", {
    source,
    device_type: getDeviceType(),
  });
}

/**
 * Rastreia login e verificação concluída com sucesso
 */
export function trackLoginCompleted(user: { id?: string; username: string }): void {
  if (!isInitialized) return;
  if (user.username) {
    posthog.identify(user.username, {
      username: user.username,
      verified_at: new Date().toISOString(),
    });
  }
  posthog.capture("login_completed", {
    username: user.username,
    device_type: getDeviceType(),
  });
}

/**
 * Rastreia logout do usuário
 */
export function trackLogout(): void {
  if (!isInitialized) return;
  posthog.capture("logout");
  posthog.reset();
}

/**
 * Rastreia filtros aplicados na listagem de vagas
 */
export function trackJobFilterApplied(
  filterType: "seniority" | "workModel" | "location" | "stack" | "search",
  value: string,
): void {
  if (!isInitialized || !value) return;
  posthog.capture("job_filter_applied", {
    filter_type: filterType,
    value,
  });
}

/**
 * Rastreia clique no card da vaga para abrir o modal de detalhes
 */
export function trackJobCardClicked(job: {
  id: string;
  title: string;
  company: string;
  seniority?: string;
  workModel?: string;
  source: string;
}): void {
  if (!isInitialized) return;
  posthog.capture("job_card_clicked", {
    job_id: job.id,
    job_title: job.title,
    company: job.company,
    seniority: job.seniority || "NAO_INFORMADO",
    work_model: job.workModel || "NAO_INFORMADO",
    source: job.source,
  });
}

/**
 * Rastreia clique final em "Candidatar-se" na ATS da empresa (Gupy, Ashby, Lever, etc.)
 */
export function trackJobApplyClicked(job: {
  id: string;
  title: string;
  company: string;
  source: string;
  url: string;
}): void {
  if (!isInitialized) return;
  posthog.capture("job_apply_clicked", {
    job_id: job.id,
    job_title: job.title,
    company: job.company,
    ats_source: job.source,
    ats_url: job.url,
  });
}

/**
 * Rastreia compartilhamento de vagas (WhatsApp ou Copiar Link)
 */
export function trackJobShared(
  job: { id: string; title: string; company: string },
  method: "whatsapp" | "copy_link",
): void {
  if (!isInitialized) return;
  posthog.capture("job_shared", {
    job_id: job.id,
    job_title: job.title,
    company: job.company,
    method,
  });
}

/**
 * Rastreia abertura do Radar de Empresas
 */
export function trackCompanyRadarOpened(source: string = "navbar"): void {
  if (!isInitialized) return;
  posthog.capture("company_radar_opened", { source });
}

/**
 * Rastreia voto em empresa no Radar de Empresas
 */
export function trackCompanyUpvoted(companyName: string): void {
  if (!isInitialized) return;
  posthog.capture("company_upvoted", { company_name: companyName });
}

export { posthog };
