import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LearningPathView } from "../components/LearningPathView";
import { learningPathToMarkdown, loadLearningPath, saveLearningPath, UNDETAILED_EXPERIENCE_NOTE } from "../services/learningPathService";
import type { LearningPath, SavedLearningPath } from "../types";

const PATH: LearningPath = {
  summary: "Comece por React.",
  limitedDescription: false,
  steps: [
    {
      skill: "React",
      priority: "required",
      currentLevel: "basic",
      targetLevel: "intermediate",
      reason: "A vaga exige React.",
      prerequisites: [],
      topics: ["Hooks"],
      hoursMin: 10,
      hoursMax: 20,
      practiceProject: "Refazer um projeto em React.",
      doneCriteria: ["Criar hooks"],
      searchTerms: ["react hooks"],
    },
  ],
  experienceGaps: [
    { gap: "5 anos de experiência", reason: "Tempo de mercado.", evidenceIdeas: ["Open source"], detailed: true },
    { gap: "Liderança técnica", reason: "", evidenceIdeas: [], detailed: false },
  ],
  deferredGaps: [
    { skill: "Terraform", status: "missing", priority: "required", reason: "omitted" },
    { skill: "Observabilidade", status: "partial", priority: "nice_to_have", reason: "step_limit" },
  ],
};

const makeSaved = (path: LearningPath = PATH): SavedLearningPath => ({
  version: 1,
  jobId: "job-cov-1",
  jobTitle: "DevOps Pleno",
  company: "QueroVagas",
  createdAt: "2026-11-25T12:00:00.000Z",
  hoursPerWeek: 5,
  knownSkills: [],
  completedSteps: [],
  provider: "groq",
  model: "openai/gpt-oss-20b",
  path,
});

describe("Trilha de estudos — cobertura das lacunas (#39)", () => {
  it("mostra 'Para depois' com prioridade original e motivo, e vivência sem detalhes da IA", () => {
    render(<LearningPathView saved={makeSaved()} onChange={vi.fn()} />);

    const deferred = screen.getByTestId("learning-path-deferred");
    expect(within(deferred).getByRole("heading", { name: "Para depois" })).toBeInTheDocument();
    const items = within(deferred).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Terraform");
    expect(items[0]).toHaveTextContent("Obrigatória");
    expect(items[0]).toHaveTextContent("a IA não gerou etapa");
    expect(items[1]).toHaveTextContent("Observabilidade");
    expect(items[1]).toHaveTextContent("Diferencial");
    expect(items[1]).toHaveTextContent("fora do limite de etapas");

    const experience = screen.getByTestId("learning-path-experience");
    expect(within(experience).getByText("Liderança técnica")).toBeInTheDocument();
    expect(within(experience).getAllByText(UNDETAILED_EXPERIENCE_NOTE)).toHaveLength(1);
  });

  it("não quebra trilhas salvas antes da v1.15 (sem deferredGaps nem detailed)", () => {
    const legacy: LearningPath = {
      ...PATH,
      deferredGaps: undefined,
      experienceGaps: [{ gap: "5 anos de experiência", reason: "Tempo de mercado.", evidenceIdeas: [] }],
    };
    saveLearningPath(makeSaved(legacy));
    const loaded = loadLearningPath("job-cov-1");
    expect(loaded).not.toBeNull();
    render(<LearningPathView saved={loaded as SavedLearningPath} onChange={vi.fn()} />);
    expect(screen.queryByTestId("learning-path-deferred")).not.toBeInTheDocument();
    expect(screen.queryByText(UNDETAILED_EXPERIENCE_NOTE)).not.toBeInTheDocument();
    localStorage.clear();
  });

  it("exporta 'Para depois' e o aviso de vivência sem detalhes no Markdown, sem links", () => {
    const md = learningPathToMarkdown(makeSaved());
    expect(md).toContain("## Para depois");
    expect(md).toContain("- Terraform (Obrigatória, a IA não gerou etapa)");
    expect(md).toContain("- Observabilidade (Diferencial, fora do limite de etapas)");
    expect(md).toContain(`- **Liderança técnica**\n  - ${UNDETAILED_EXPERIENCE_NOTE}`);
    expect(md).not.toMatch(/https?:\/\//);
  });
});
