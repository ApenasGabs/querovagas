import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../../../types/job";
import { CvMatchModal } from "../components/CvMatchModal";
import { CvMatchResult } from "../components/CvMatchResult";
import {
  deleteLearningPath,
  formatWeeksRange,
  LEARNING_PATHS_STORAGE_KEY,
  learningPathFileName,
  learningPathToMarkdown,
  loadLearningPath,
  saveLearningPath,
  toggleLearningPathStep,
} from "../services/learningPathService";
import type { CvMatchResult as CvMatchResultData, LearningPath, SavedLearningPath } from "../types";

const LONG_DESCRIPTION = "Atuação com React, TypeScript e GraphQL em produto de pagamentos com foco em qualidade. ".repeat(5);

const SAMPLE_JOB: Job = {
  id: "job-lp-1",
  title: "Frontend Engineer Pleno",
  company: "QueroVagas",
  location: "Remoto",
  workModel: "REMOTO",
  seniorityLevel: "PLENO",
  contractType: "CLT",
  stack: ["React", "TypeScript", "GraphQL"],
  url: "https://example.com/vaga/lp",
  source: "GUPY",
  scrapedAt: "2026-11-20T12:00:00Z",
  description: LONG_DESCRIPTION,
};

const VALID_RESUME = "Desenvolvedora Vue.js e JavaScript com experiência em aplicações acessíveis, testes e APIs REST. ".repeat(3);

const baseResult = (overrides: Partial<CvMatchResultData> = {}): CvMatchResultData => ({
  score: 62,
  tier: "partial",
  tierLabel: "Compatibilidade parcial",
  criteria: [
    { key: "technicalRequirements", label: "Requisitos técnicos e stack", weight: 0.35, score: 60, justification: "" },
  ],
  matchedSkills: ["JavaScript"],
  missingSkills: ["React", "GraphQL", "TypeScript", "5 anos de experiência"],
  gapDetails: [
    { skill: "React", status: "partial", priority: "required", kind: "learnable" },
    { skill: "GraphQL", status: "missing", priority: "nice_to_have", kind: "learnable" },
    { skill: "TypeScript", status: "missing", priority: "required", kind: "learnable" },
    { skill: "5 anos de experiência", status: "missing", priority: "required", kind: "experience" },
  ],
  strengths: [],
  gaps: [],
  suggestions: [],
  rewrittenBullets: [],
  summary: "Base sólida em Vue.",
  verdict: "Ajustar antes de aplicar.",
  ...overrides,
});

const SAMPLE_PATH: LearningPath = {
  summary: "Comece por React aproveitando Vue.",
  limitedDescription: false,
  steps: [
    {
      skill: "React",
      priority: "required",
      currentLevel: "basic",
      targetLevel: "intermediate",
      reason: "A vaga exige React.",
      prerequisites: [],
      topics: ["Hooks", "Componentização"],
      hoursMin: 10,
      hoursMax: 20,
      practiceProject: "Refazer um projeto Vue em React.",
      doneCriteria: ["Criar hooks customizados"],
      searchTerms: ["react hooks guia"],
    },
    {
      skill: "GraphQL",
      priority: "nice_to_have",
      currentLevel: "none",
      targetLevel: "basic",
      reason: "Diferencial da vaga.",
      prerequisites: ["React"],
      topics: ["Queries"],
      hoursMin: 6,
      hoursMax: 8,
      practiceProject: "Consumir uma API GraphQL pública.",
      doneCriteria: ["Escrever queries com variáveis"],
      searchTerms: ["graphql apollo client"],
    },
  ],
  experienceGaps: [{ gap: "5 anos de experiência", reason: "Tempo de mercado.", evidenceIdeas: ["Contribuir em open source"] }],
};

const makeSaved = (overrides: Partial<SavedLearningPath> = {}): SavedLearningPath => ({
  version: 1,
  jobId: SAMPLE_JOB.id,
  jobTitle: SAMPLE_JOB.title,
  company: SAMPLE_JOB.company,
  createdAt: "2026-11-24T12:00:00.000Z",
  hoursPerWeek: 5,
  knownSkills: ["TypeScript"],
  completedSteps: [],
  provider: "xai",
  model: "grok-4",
  path: SAMPLE_PATH,
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const runAnalysis = async (result: CvMatchResultData) => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ provider: "xai", model: "grok-4", result }));
  render(<CvMatchModal job={SAMPLE_JOB} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: /Colar texto/i }));
  fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
  fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-key-12345" } });
  fireEvent.click(screen.getByRole("button", { name: /Analisar compatibilidade/i }));
  await screen.findByTestId("cv-match-result");
  return fetchSpy;
};

describe("Trilha de estudos — serviço e armazenamento local", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("salva, alterna progresso e exclui a trilha por vaga no localStorage", () => {
    const saved = makeSaved();
    saveLearningPath(saved);
    expect(loadLearningPath(SAMPLE_JOB.id)?.path.steps).toHaveLength(2);
    expect(loadLearningPath("outra-vaga")).toBeNull();

    const toggled = toggleLearningPathStep(saved, SAMPLE_PATH.steps[0]);
    expect(loadLearningPath(SAMPLE_JOB.id)?.completedSteps).toEqual(["react"]);
    toggleLearningPathStep(toggled, SAMPLE_PATH.steps[0]);
    expect(loadLearningPath(SAMPLE_JOB.id)?.completedSteps).toEqual([]);

    deleteLearningPath(SAMPLE_JOB.id);
    expect(loadLearningPath(SAMPLE_JOB.id)).toBeNull();
    expect(localStorage.getItem(LEARNING_PATHS_STORAGE_KEY)).toBeNull();
  });

  it("ignora conteúdo corrompido no localStorage", () => {
    localStorage.setItem(LEARNING_PATHS_STORAGE_KEY, "{nao-json");
    expect(loadLearningPath(SAMPLE_JOB.id)).toBeNull();
    localStorage.setItem(LEARNING_PATHS_STORAGE_KEY, JSON.stringify({ [SAMPLE_JOB.id]: { version: 2 } }));
    expect(loadLearningPath(SAMPLE_JOB.id)).toBeNull();
  });

  it("exporta Markdown com checklist, faixas de tempo, vivência e sugestões de currículo, sem links", () => {
    const md = learningPathToMarkdown(makeSaved({ completedSteps: ["react"] }));
    expect(md).toContain("# Trilha de estudos — Frontend Engineer Pleno (QueroVagas)");
    expect(md).toContain("### 1. React (Obrigatória)");
    expect(md).toContain("- [x] Etapa concluída");
    expect(md).toContain("- [ ] Etapa concluída");
    expect(md).toContain("Tempo estimado: 10–20 h (≈ 2–4 semanas)");
    expect(md).toContain("## Lacunas de vivência (sem prazo de estudo)");
    expect(md).toContain('Inclua "TypeScript" no currículo');
    expect(md).not.toMatch(/https?:\/\//);
    expect(formatWeeksRange(3, 4, 5)).toBe("≈ 1 semana");
    expect(learningPathFileName({ jobTitle: "Dev Sênior / React", company: "Ação & Cia" })).toBe(
      "trilha-dev-senior-react-acao-cia.md",
    );
  });
});

describe("Trilha de estudos — UI", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("classifica as lacunas no resultado da análise", () => {
    render(<CvMatchResult result={baseResult()} providerLabel="xAI" model="grok-4" />);
    const gaps = screen.getByTestId("cv-match-gaps");
    expect(within(gaps).getAllByText("Parcial")).toHaveLength(1);
    expect(within(gaps).getAllByText("Diferencial")).toHaveLength(1);
    expect(within(gaps).getAllByText("Vivência")).toHaveLength(1);
  });

  it("não mostra o botão de trilha quando a análise não tem lacunas", async () => {
    await runAnalysis(baseResult({ missingSkills: [], gapDetails: [] }));
    expect(screen.queryByRole("button", { name: /Gerar trilha de estudos/i })).not.toBeInTheDocument();
  });

  it("gera a trilha com 'já sei' e horas por semana, salva no navegador e permite marcar progresso", async () => {
    const fetchSpy = await runAnalysis(baseResult());
    fetchSpy.mockResolvedValueOnce(jsonResponse({ provider: "xai", model: "grok-4", learningPath: SAMPLE_PATH }));

    fireEvent.click(screen.getByRole("button", { name: /Gerar trilha de estudos/i }));
    fireEvent.click(screen.getByLabelText(/Já sei TypeScript, só não está no currículo/i));
    expect(screen.getByText(/Inclua "TypeScript" no currículo/i)).toBeInTheDocument();
    expect(screen.getByText(/ficam salvos apenas neste navegador/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Horas de estudo por semana/i), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /^Gerar trilha$/i }));

    await screen.findByTestId("learning-path");

    const [url, init] = fetchSpy.mock.calls[1];
    expect(url).toBe("/api/cv-match/learning-path");
    const sent = JSON.parse(String((init as RequestInit).body)) as {
      gaps: { skill: string }[];
      knownSkills: string[];
      hoursPerWeek: number;
    };
    expect(sent.gaps.map((g) => g.skill)).toEqual(["React", "GraphQL", "5 anos de experiência"]);
    expect(sent.knownSkills).toEqual(["TypeScript"]);
    expect(sent.hoursPerWeek).toBe(8);
    expect((init as RequestInit).headers).toMatchObject({ "x-llm-api-key": "xai-key-12345" });

    const view = screen.getByTestId("learning-path");
    expect(within(view).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByTestId("learning-path-experience")).toHaveTextContent("5 anos de experiência");
    expect(screen.getByTestId("learning-path-resume-suggestions")).toHaveTextContent("TypeScript");

    fireEvent.click(screen.getByLabelText(/Concluí a etapa 1: React/i));
    expect(screen.getByText("1 de 2 etapas")).toBeInTheDocument();
    expect(loadLearningPath(SAMPLE_JOB.id)?.completedSteps).toEqual(["react"]);
    expect(loadLearningPath(SAMPLE_JOB.id)?.hoursPerWeek).toBe(8);
  });

  it("mantém a análise quando a trilha falha e permite tentar de novo", async () => {
    const fetchSpy = await runAnalysis(baseResult());
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ error: "Erro no provedor xAI (HTTP 500).", code: "llm_upstream_error" }, 502))
      .mockResolvedValueOnce(jsonResponse({ provider: "xai", model: "grok-4", learningPath: SAMPLE_PATH }));

    fireEvent.click(screen.getByRole("button", { name: /Gerar trilha de estudos/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Gerar trilha$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Erro no provedor/i);
    });
    expect(screen.getByTestId("cv-match-result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    await screen.findByTestId("learning-path");
    expect(screen.getByTestId("cv-match-result")).toBeInTheDocument();
  });

  it("avisa menor precisão quando a vaga tem pouca descrição", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ provider: "xai", model: "grok-4", result: baseResult() }),
    );
    render(<CvMatchModal job={{ ...SAMPLE_JOB, description: "Vaga React." }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Colar texto/i }));
    fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
    fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-key-12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar compatibilidade/i }));
    await screen.findByTestId("cv-match-result");

    fireEvent.click(screen.getByRole("button", { name: /Gerar trilha de estudos/i }));
    expect(screen.getByText(/pouca descrição/i)).toBeInTheDocument();
  });

  it("abre a trilha salva sem refazer a análise, copia/baixa em Markdown e permite excluir", async () => {
    saveLearningPath(makeSaved({ completedSteps: ["react"] }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const createObjectURL = vi.fn().mockReturnValue("blob:trilha");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<CvMatchModal job={SAMPLE_JOB} onClose={vi.fn()} />);
    expect(screen.getByTestId("saved-learning-path-banner")).toHaveTextContent("1 de 2 etapas concluídas");
    fireEvent.click(screen.getByRole("button", { name: /Abrir trilha/i }));

    expect(screen.getByTestId("learning-path")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Copiar trilha/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Trilha de estudos"));
    });

    fireEvent.click(screen.getByRole("button", { name: /Baixar Markdown/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:trilha");

    fireEvent.click(screen.getByRole("button", { name: /Excluir trilha/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));
    expect(loadLearningPath(SAMPLE_JOB.id)).toBeNull();
    expect(screen.queryByTestId("learning-path")).not.toBeInTheDocument();
    expect(screen.queryByTestId("saved-learning-path-banner")).not.toBeInTheDocument();
  });
});
