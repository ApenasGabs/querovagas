export type LlmProviderId = "xai" | "openai" | "gemini" | "groq" | "openrouter" | "anthropic";

export interface LlmProviderOption {
  id: LlmProviderId;
  label: string;
  defaultModel: string;
  keyUrl: string;
  keyHint: string;
}

/** Espelho do catálogo do backend (api/_lib/cvMatch.ts). O usuário traz a própria chave (BYOK). */
export const LLM_PROVIDER_OPTIONS: readonly LlmProviderOption[] = [
  {
    id: "xai",
    label: "xAI (Grok)",
    defaultModel: "grok-4",
    keyUrl: "https://console.x.ai",
    keyHint: "xai-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza...",
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "openai/gpt-oss-20b",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "x-ai/grok-4",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-...",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
  },
];

export const DEFAULT_LLM_PROVIDER: LlmProviderId = "xai";

export const getProviderOption = (id: LlmProviderId): LlmProviderOption =>
  LLM_PROVIDER_OPTIONS.find((p) => p.id === id) ?? LLM_PROVIDER_OPTIONS[0];

export const isLlmProviderId = (value: unknown): value is LlmProviderId =>
  typeof value === "string" && LLM_PROVIDER_OPTIONS.some((p) => p.id === value);

export interface LlmSettings {
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  rememberKey: boolean;
}

export type CvMatchTier = "high" | "good" | "partial" | "low";

export type CriterionKey =
  | "technicalRequirements"
  | "seniorityExperience"
  | "responsibilitiesDomain"
  | "impactEvidence"
  | "atsKeywords";

export interface CvMatchCriterionResult {
  key: CriterionKey;
  label: string;
  weight: number;
  score: number;
  justification: string;
}

export type GapStatus = "missing" | "partial";
export type GapPriority = "required" | "nice_to_have";
export type GapKind = "learnable" | "experience";

/** Lacuna classificada pela análise: ausente/parcial, obrigatória/diferencial e aprendível/vivência. */
export interface CvMatchGap {
  skill: string;
  status: GapStatus;
  priority: GapPriority;
  kind: GapKind;
}

export interface CvMatchResult {
  score: number;
  tier: CvMatchTier;
  tierLabel: string;
  criteria: CvMatchCriterionResult[];
  matchedSkills: string[];
  missingSkills: string[];
  /** Opcional para tolerar respostas antigas; use `getResultGaps` para ler. */
  gapDetails?: CvMatchGap[];
  strengths: string[];
  gaps: string[];
  suggestions: { section: string; suggestion: string }[];
  rewrittenBullets: { original: string; rewritten: string }[];
  summary: string;
  verdict: string;
}

export interface CvMatchResponse {
  result: CvMatchResult;
  provider: LlmProviderId;
  model: string;
}

export interface ResumeDraft {
  fileName?: string;
  text: string;
}

/** Lacunas classificadas da análise (com fallback para `missingSkills` de respostas antigas). */
export const getResultGaps = (result: Pick<CvMatchResult, "gapDetails" | "missingSkills">): CvMatchGap[] =>
  result.gapDetails && result.gapDetails.length > 0
    ? result.gapDetails
    : result.missingSkills.map((skill) => ({ skill, status: "missing", priority: "required", kind: "learnable" }));

export type SkillLevel = "none" | "basic" | "intermediate" | "advanced";

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  none: "Nenhum",
  basic: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export const GAP_PRIORITY_LABELS: Record<GapPriority, string> = {
  required: "Obrigatória",
  nice_to_have: "Diferencial",
};

export const GAP_STATUS_LABELS: Record<GapStatus, string> = {
  missing: "Ausente",
  partial: "Parcial",
};

export const GAP_KIND_LABELS: Record<GapKind, string> = {
  learnable: "Aprendível",
  experience: "Vivência",
};

export interface LearningPathStep {
  skill: string;
  priority: GapPriority;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  reason: string;
  prerequisites: string[];
  topics: string[];
  hoursMin: number;
  hoursMax: number;
  practiceProject: string;
  doneCriteria: string[];
  searchTerms: string[];
}

export interface LearningPathExperienceGap {
  gap: string;
  reason: string;
  evidenceIdeas: string[];
}

export interface LearningPath {
  summary: string;
  steps: LearningPathStep[];
  experienceGaps: LearningPathExperienceGap[];
  limitedDescription: boolean;
}

export interface LearningPathResponse {
  learningPath: LearningPath;
  provider: LlmProviderId;
  model: string;
}

/** Trilha salva apenas no navegador (localStorage), por vaga. */
export interface SavedLearningPath {
  version: 1;
  jobId: string;
  jobTitle: string;
  company: string;
  createdAt: string;
  hoursPerWeek: number;
  knownSkills: string[];
  completedSteps: string[];
  provider: LlmProviderId;
  model: string;
  path: LearningPath;
}
