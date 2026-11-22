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
    defaultModel: "llama-3.3-70b-versatile",
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

export interface CvMatchResult {
  score: number;
  tier: CvMatchTier;
  tierLabel: string;
  criteria: CvMatchCriterionResult[];
  matchedSkills: string[];
  missingSkills: string[];
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
