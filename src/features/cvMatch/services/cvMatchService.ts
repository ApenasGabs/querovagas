import type { Job } from "../../../types/job";
import { getStoredTrustToken } from "../../../services/trustAuthService";
import type { CvMatchResponse, LlmProviderId, ResumeDraft } from "../types";

export class CvMatchRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CvMatchRequestError";
    this.status = status;
    this.code = code;
  }
}

export interface AnalyzeCvMatchParams {
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  resumeText: string;
  job: Job;
  signal?: AbortSignal;
}

export const analyzeCvMatch = async ({
  provider,
  model,
  apiKey,
  resumeText,
  job,
  signal,
}: AnalyzeCvMatchParams): Promise<CvMatchResponse> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-llm-api-key": apiKey.trim(),
  };
  const trustToken = getStoredTrustToken();
  if (trustToken) headers["x-trust-token"] = trustToken;

  let res: Response;
  try {
    res = await fetch("/api/cv-match/analyze", {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        provider,
        model: model.trim(),
        resumeText,
        job: {
          title: job.title,
          company: job.company,
          seniorityLevel: job.seniorityLevel,
          workModel: job.workModel,
          contractType: job.contractType,
          location: job.location,
          stack: job.stack,
          description: job.description,
        },
      }),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new CvMatchRequestError(0, "network_error", "Falha de conexão com o QueroVagas. Verifique sua internet.");
  }

  const payload: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const body = (payload ?? {}) as { error?: unknown; code?: unknown };
    throw new CvMatchRequestError(
      res.status,
      typeof body.code === "string" ? body.code : "http_error",
      typeof body.error === "string" ? body.error : `Erro ao analisar o currículo (HTTP ${res.status}).`,
    );
  }

  return payload as CvMatchResponse;
};

const RESUME_DRAFT_KEY = "qv_cv_resume_draft";

/** Mantém o currículo apenas nesta aba (sessionStorage) para analisar várias vagas sem reenviar o PDF. */
export const loadResumeDraft = (): ResumeDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESUME_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ResumeDraft>;
    return typeof parsed.text === "string"
      ? { text: parsed.text, fileName: typeof parsed.fileName === "string" ? parsed.fileName : undefined }
      : null;
  } catch {
    return null;
  }
};

export const saveResumeDraft = (draft: ResumeDraft | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (draft && draft.text.trim()) {
      sessionStorage.setItem(RESUME_DRAFT_KEY, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(RESUME_DRAFT_KEY);
    }
  } catch {
    // storage indisponível (modo privado) — segue sem cache
  }
};
