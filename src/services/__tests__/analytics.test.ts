import { beforeEach, describe, expect, it, vi } from "vitest";
import posthog from "posthog-js";
import {
  initAnalytics,
  trackCompanyRadarOpened,
  trackCompanyUpvoted,
  trackJobApplyClicked,
  trackJobCardClicked,
  trackJobFilterApplied,
  trackJobShared,
  trackLoginCompleted,
  trackLoginInitiated,
  trackLogout,
  trackPageView,
} from "../analytics";

vi.mock("posthog-js", () => {
  return {
    default: {
      init: vi.fn(),
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    },
  };
});

describe("Analytics Service (PostHog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não deve disparar eventos se não estiver inicializado com chave válida", () => {
    trackPageView({ test: true });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("deve inicializar o PostHog quando VITE_POSTHOG_KEY estiver configurada", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_12345");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com");

    initAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test_12345",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        person_profiles: "identified_only",
        autocapture: true,
      }),
    );

    // Simula inicialização bem-sucedida chamando loaded ou inicializado
    trackPageView({ is_verified: false });
    expect(posthog.capture).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({
        is_verified: false,
      }),
    );
  });

  it("deve rastrear início de login com source", () => {
    trackLoginInitiated("navbar");
    expect(posthog.capture).toHaveBeenCalledWith(
      "login_initiated",
      expect.objectContaining({
        source: "navbar",
      }),
    );
  });

  it("deve identificar usuário e rastrear login_completed", () => {
    trackLoginCompleted({ username: "octocat" });
    expect(posthog.identify).toHaveBeenCalledWith(
      "octocat",
      expect.objectContaining({
        username: "octocat",
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      "login_completed",
      expect.objectContaining({
        username: "octocat",
      }),
    );
  });

  it("deve rastrear logout e resetar sessão", () => {
    trackLogout();
    expect(posthog.capture).toHaveBeenCalledWith("logout");
    expect(posthog.reset).toHaveBeenCalled();
  });

  it("deve rastrear filtros aplicados", () => {
    trackJobFilterApplied("seniority", "JUNIOR");
    expect(posthog.capture).toHaveBeenCalledWith(
      "job_filter_applied",
      expect.objectContaining({
        filter_type: "seniority",
        value: "JUNIOR",
      }),
    );
  });

  it("deve rastrear clique no card da vaga", () => {
    trackJobCardClicked({
      id: "job-1",
      title: "Desenvolvedor React",
      company: "Acme",
      seniority: "PLENO",
      workModel: "REMOTO",
      source: "GUPY",
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "job_card_clicked",
      expect.objectContaining({
        job_id: "job-1",
        job_title: "Desenvolvedor React",
        company: "Acme",
        source: "GUPY",
      }),
    );
  });

  it("deve rastrear clique para candidatar-se na ATS", () => {
    trackJobApplyClicked({
      id: "job-1",
      title: "Desenvolvedor React",
      company: "Acme",
      source: "GUPY",
      url: "https://acme.gupy.io/job/1",
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "job_apply_clicked",
      expect.objectContaining({
        job_id: "job-1",
        company: "Acme",
        ats_source: "GUPY",
        ats_url: "https://acme.gupy.io/job/1",
      }),
    );
  });

  it("deve rastrear compartilhamento da vaga", () => {
    trackJobShared(
      { id: "job-1", title: "React Dev", company: "Acme" },
      "whatsapp",
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      "job_shared",
      expect.objectContaining({
        job_id: "job-1",
        method: "whatsapp",
      }),
    );
  });

  it("deve rastrear abertura do Radar de Empresas e votos", () => {
    trackCompanyRadarOpened("search_button");
    expect(posthog.capture).toHaveBeenCalledWith("company_radar_opened", {
      source: "search_button",
    });

    trackCompanyUpvoted("Nubank");
    expect(posthog.capture).toHaveBeenCalledWith("company_upvoted", {
      company_name: "Nubank",
    });
  });
});
