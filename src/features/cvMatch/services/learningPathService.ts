import type { Job } from "../../../types/job";
import {
  GAP_PRIORITY_LABELS,
  isLlmProviderId,
  SKILL_LEVEL_LABELS,
  type CvMatchGap,
  type LearningPath,
  type LearningPathResponse,
  type LearningPathStep,
  type LlmProviderId,
  type SavedLearningPath,
} from "../types";
import { CvMatchRequestError, postCvMatchApi, toJobPayload } from "./cvMatchService";

export const LEARNING_PATHS_STORAGE_KEY = "qv_learning_paths";
const MAX_SAVED_PATHS = 20;
export const HOURS_PER_WEEK_MIN = 1;
export const HOURS_PER_WEEK_MAX = 60;
/** Espelho do backend: descrição curta = trilha menos precisa. */
export const LIMITED_DESCRIPTION_CHARS = 300;

export const isLimitedJobDescription = (job: Pick<Job, "description">): boolean =>
  (job.description?.trim().length ?? 0) < LIMITED_DESCRIPTION_CHARS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidLearningPath = (value: unknown): value is LearningPath =>
  isRecord(value) && Array.isArray(value.steps) && Array.isArray(value.experienceGaps);

const isValidLearningPathResponse = (payload: unknown): payload is LearningPathResponse =>
  isRecord(payload) &&
  isLlmProviderId(payload.provider) &&
  typeof payload.model === "string" &&
  isValidLearningPath(payload.learningPath);

export interface GenerateLearningPathParams {
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  resumeText: string;
  job: Job;
  gaps: CvMatchGap[];
  knownSkills: string[];
  hoursPerWeek: number;
  signal?: AbortSignal;
}

export const generateLearningPath = async ({
  provider,
  model,
  apiKey,
  resumeText,
  job,
  gaps,
  knownSkills,
  hoursPerWeek,
  signal,
}: GenerateLearningPathParams): Promise<LearningPathResponse> => {
  const payload = await postCvMatchApi(
    "/api/cv-match/learning-path",
    apiKey,
    { provider, model: model.trim(), resumeText, job: toJobPayload(job), gaps, knownSkills, hoursPerWeek },
    "Erro ao gerar a trilha de estudos",
    signal,
  );

  if (!isValidLearningPathResponse(payload)) {
    throw new CvMatchRequestError(502, "invalid_response", "Resposta inesperada do servidor. Tente novamente.");
  }
  return payload;
};

// ---------------------------------------------------------------------------
// Persistência somente no navegador (localStorage), por vaga.
// ---------------------------------------------------------------------------

const readAll = (): Record<string, SavedLearningPath> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEARNING_PATHS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, SavedLearningPath] =>
        isRecord(entry[1]) &&
        entry[1].version === 1 &&
        typeof entry[1].jobId === "string" &&
        Array.isArray(entry[1].completedSteps) &&
        isValidLearningPath(entry[1].path),
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const writeAll = (paths: Record<string, SavedLearningPath>): void => {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(paths)
      .sort(([, a], [, b]) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_SAVED_PATHS);
    if (entries.length === 0) {
      localStorage.removeItem(LEARNING_PATHS_STORAGE_KEY);
    } else {
      localStorage.setItem(LEARNING_PATHS_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {
    // storage indisponível/cheio — a trilha segue apenas em memória
  }
};

export const loadLearningPath = (jobId: string): SavedLearningPath | null => readAll()[jobId] ?? null;

export const saveLearningPath = (saved: SavedLearningPath): void => {
  writeAll({ ...readAll(), [saved.jobId]: saved });
};

export const deleteLearningPath = (jobId: string): void => {
  const all = readAll();
  delete all[jobId];
  writeAll(all);
};

export const stepKey = (step: Pick<LearningPathStep, "skill">): string => step.skill.trim().toLowerCase();

export const toggleLearningPathStep = (saved: SavedLearningPath, step: LearningPathStep): SavedLearningPath => {
  const key = stepKey(step);
  const completed = saved.completedSteps.includes(key)
    ? saved.completedSteps.filter((k) => k !== key)
    : [...saved.completedSteps, key];
  const next = { ...saved, completedSteps: completed };
  saveLearningPath(next);
  return next;
};

export const countCompletedSteps = (saved: SavedLearningPath): number =>
  saved.path.steps.filter((s) => saved.completedSteps.includes(stepKey(s))).length;

// ---------------------------------------------------------------------------
// Faixas de tempo e exportação em Markdown
// ---------------------------------------------------------------------------

export const formatHoursRange = (min: number, max: number): string => (min === max ? `${min} h` : `${min}–${max} h`);

export const formatWeeksRange = (min: number, max: number, hoursPerWeek: number): string => {
  const safeHours = Math.max(1, hoursPerWeek);
  const from = Math.max(1, Math.ceil(min / safeHours));
  const to = Math.max(from, Math.ceil(max / safeHours));
  const unit = to === 1 ? "semana" : "semanas";
  return from === to ? `≈ ${from} ${unit}` : `≈ ${from}–${to} ${unit}`;
};

export const totalHours = (path: LearningPath): { min: number; max: number } =>
  path.steps.reduce((acc, s) => ({ min: acc.min + s.hoursMin, max: acc.max + s.hoursMax }), { min: 0, max: 0 });

export const resumeSuggestionFor = (skill: string): string =>
  `Inclua "${skill}" no currículo (Skills e, se possível, uma experiência ou projeto em que você usou).`;

const list = (items: string[]): string => items.join(", ");

export const learningPathToMarkdown = (saved: SavedLearningPath): string => {
  const { path } = saved;
  const total = totalHours(path);
  const createdAt = new Date(saved.createdAt);
  const dateLabel = Number.isNaN(createdAt.getTime()) ? saved.createdAt : createdAt.toLocaleDateString("pt-BR");
  const lines: string[] = [
    `# Trilha de estudos — ${saved.jobTitle} (${saved.company})`,
    "",
    `Gerada em ${dateLabel} · ${saved.hoursPerWeek} h/semana` +
      (path.steps.length > 0
        ? ` · ${formatHoursRange(total.min, total.max)} no total (${formatWeeksRange(total.min, total.max, saved.hoursPerWeek)})`
        : ""),
    "",
  ];

  if (path.limitedDescription) {
    lines.push("> Aviso: a vaga tem pouca descrição, então esta trilha pode ser menos precisa.", "");
  }
  if (path.summary) lines.push(path.summary, "");

  if (path.steps.length > 0) {
    lines.push("## Etapas", "");
    path.steps.forEach((step, index) => {
      const done = saved.completedSteps.includes(stepKey(step));
      lines.push(`### ${index + 1}. ${step.skill} (${GAP_PRIORITY_LABELS[step.priority]})`, "");
      lines.push(`- [${done ? "x" : " "}] Etapa concluída`);
      lines.push(`- Nível: ${SKILL_LEVEL_LABELS[step.currentLevel]} → ${SKILL_LEVEL_LABELS[step.targetLevel]}`);
      if (step.reason) lines.push(`- Por que para esta vaga: ${step.reason}`);
      if (step.prerequisites.length > 0) lines.push(`- Pré-requisitos: ${list(step.prerequisites)}`);
      if (step.topics.length > 0) lines.push(`- Tópicos: ${list(step.topics)}`);
      lines.push(
        `- Tempo estimado: ${formatHoursRange(step.hoursMin, step.hoursMax)} (${formatWeeksRange(step.hoursMin, step.hoursMax, saved.hoursPerWeek)})`,
      );
      if (step.practiceProject) lines.push(`- Projeto prático: ${step.practiceProject}`);
      if (step.doneCriteria.length > 0) lines.push(`- Como saber que aprendi: ${list(step.doneCriteria)}`);
      if (step.searchTerms.length > 0) lines.push(`- Termos de busca: ${list(step.searchTerms)}`);
      lines.push("");
    });
  }

  if (path.experienceGaps.length > 0) {
    lines.push("## Lacunas de vivência (sem prazo de estudo)", "");
    path.experienceGaps.forEach((gap) => {
      lines.push(`- **${gap.gap}**${gap.reason ? ` — ${gap.reason}` : ""}`);
      gap.evidenceIdeas.forEach((idea) => lines.push(`  - Como gerar evidência: ${idea}`));
    });
    lines.push("");
  }

  if (saved.knownSkills.length > 0) {
    lines.push("## Inclua no currículo", "");
    saved.knownSkills.forEach((skill) => lines.push(`- ${resumeSuggestionFor(skill)}`));
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
};

export const learningPathFileName = (saved: Pick<SavedLearningPath, "jobTitle" | "company">): string => {
  const slug = `${saved.jobTitle}-${saved.company}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `trilha-${slug || "vaga"}.md`;
};
