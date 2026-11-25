import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { AlertTriangle, GraduationCap, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import type { Job } from "../../../types/job";
import {
  trackLearningPathCompleted,
  trackLearningPathFailed,
  trackLearningPathOpened,
  trackLearningPathStarted,
} from "../../../services/analytics";
import { CvMatchRequestError } from "../services/cvMatchService";
import {
  generateLearningPath,
  HOURS_PER_WEEK_MAX,
  HOURS_PER_WEEK_MIN,
  isLimitedJobDescription,
  resumeSuggestionFor,
  saveLearningPath,
} from "../services/learningPathService";
import {
  GAP_KIND_LABELS,
  GAP_PRIORITY_LABELS,
  GAP_STATUS_LABELS,
  type CvMatchGap,
  type LlmProviderId,
  type SavedLearningPath,
} from "../types";
import { LearningPathView } from "./LearningPathView";

type GapChoice = "study" | "known" | "skip";
type Mode = "idle" | "setup" | "loading" | "view";

interface LearningPathPanelProps {
  job: Job;
  gaps: CvMatchGap[];
  resumeText: string;
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  saved: SavedLearningPath | null;
  onSavedChange: (next: SavedLearningPath | null) => void;
}

const DEFAULT_HOURS_PER_WEEK = 5;

export const LearningPathPanel = ({
  job,
  gaps,
  resumeText,
  provider,
  model,
  apiKey,
  saved,
  onSavedChange,
}: LearningPathPanelProps): ReactElement | null => {
  const hoursId = useId();
  const [mode, setMode] = useState<Mode>(saved ? "view" : "idle");
  const [choices, setChoices] = useState<Record<string, GapChoice>>(() =>
    Object.fromEntries(gaps.map((g) => [g.skill, "study" as GapChoice])),
  );
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(String(saved?.hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK));
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (gaps.length === 0 && !saved) return null;

  const limited = isLimitedJobDescription(job);
  const hours = Number(hoursPerWeek);
  const hoursValid = Number.isInteger(hours) && hours >= HOURS_PER_WEEK_MIN && hours <= HOURS_PER_WEEK_MAX;
  const selectedGaps = gaps.filter((g) => choices[g.skill] === "study");
  const knownSkills = gaps.filter((g) => choices[g.skill] === "known").map((g) => g.skill);
  const canGenerate = hoursValid && selectedGaps.length > 0;

  const setChoice = (skill: string, choice: GapChoice) => setChoices((prev) => ({ ...prev, [skill]: choice }));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setMode("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();

    trackLearningPathStarted({
      jobId: job.id,
      provider,
      gapCount: selectedGaps.length,
      knownCount: knownSkills.length,
      experienceCount: selectedGaps.filter((g) => g.kind === "experience").length,
      hoursPerWeek: hours,
    });

    try {
      const data = await generateLearningPath({
        provider,
        model,
        apiKey,
        resumeText,
        job,
        gaps: selectedGaps,
        knownSkills,
        hoursPerWeek: hours,
        signal: controller.signal,
      });
      const next: SavedLearningPath = {
        version: 1,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        createdAt: new Date().toISOString(),
        hoursPerWeek: hours,
        knownSkills,
        completedSteps: [],
        provider: data.provider,
        model: data.model,
        path: data.learningPath,
      };
      saveLearningPath(next);
      onSavedChange(next);
      setMode("view");
      trackLearningPathCompleted({
        jobId: job.id,
        provider,
        stepCount: data.learningPath.steps.length,
        experienceGapCount: data.learningPath.experienceGaps.length,
        limitedDescription: data.learningPath.limitedDescription,
        durationMs: Math.round(performance.now() - startedAt),
      });
      trackLearningPathOpened({ jobId: job.id, source: "generated" });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMode("setup");
        return;
      }
      // Erro na trilha não apaga a análise: volta para a configuração com opção de tentar de novo.
      setError(err instanceof Error ? err.message : "Falha ao gerar a trilha de estudos.");
      setMode("setup");
      trackLearningPathFailed({
        jobId: job.id,
        provider,
        reason: err instanceof CvMatchRequestError ? err.code : "unknown",
      });
    } finally {
      abortRef.current = null;
    }
  };

  const handleSavedChange = (next: SavedLearningPath | null) => {
    onSavedChange(next);
    if (!next) setMode("idle");
  };

  return (
    <section
      className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 min-w-0"
      aria-label="Trilha de estudos"
      data-testid="learning-path-panel"
    >
      {mode === "idle" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-sm">
              <GraduationCap className="w-5 h-5 text-primary shrink-0" /> Ainda não tem essas skills?
            </p>
            <p className="text-xs text-base-content/70">
              Transforme as lacunas desta vaga em um plano de estudos priorizado, com progresso salvo no seu navegador.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-primary gap-1.5 shrink-0" onClick={() => setMode("setup")}>
            <GraduationCap className="w-4 h-4" /> Gerar trilha de estudos
          </button>
        </div>
      )}

      {mode === "setup" && (
        <div className="space-y-4 min-w-0">
          <div className="space-y-1">
            <h3 className="flex items-center gap-1.5 font-bold text-sm">
              <GraduationCap className="w-5 h-5 text-primary shrink-0" /> Revise as lacunas antes de gerar
            </h3>
            <p className="text-xs text-base-content/70">
              Desmarque o que não quer estudar agora e indique o que você já sabe, mas não colocou no currículo.
            </p>
          </div>

          {limited && (
            <div role="note" className="alert alert-warning alert-soft text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Esta vaga tem pouca descrição: a trilha pode ser menos precisa.</span>
            </div>
          )}

          <ul className="space-y-2" aria-label="Lacunas da vaga">
            {gaps.map((gap) => {
              const choice = choices[gap.skill] ?? "study";
              return (
                <li key={gap.skill} className="p-3 rounded-xl bg-base-100 border border-base-300/60 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm break-words mr-1">{gap.skill}</span>
                    <span className="badge badge-xs badge-ghost">{GAP_STATUS_LABELS[gap.status]}</span>
                    <span className={`badge badge-xs badge-soft ${gap.priority === "required" ? "badge-error" : "badge-info"}`}>
                      {GAP_PRIORITY_LABELS[gap.priority]}
                    </span>
                    {gap.kind === "experience" && (
                      <span className="badge badge-xs badge-warning badge-soft">{GAP_KIND_LABELS.experience}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <label className="label cursor-pointer gap-2 text-xs p-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={choice === "study"}
                        onChange={(e) => setChoice(gap.skill, e.target.checked ? "study" : "skip")}
                        aria-label={`Incluir ${gap.skill} na trilha`}
                      />
                      Incluir na trilha
                    </label>
                    {gap.kind === "learnable" && (
                      <label className="label cursor-pointer gap-2 text-xs p-0">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-success"
                          checked={choice === "known"}
                          onChange={(e) => setChoice(gap.skill, e.target.checked ? "known" : "study")}
                          aria-label={`Já sei ${gap.skill}, só não está no currículo`}
                        />
                        Já sei, só não está no currículo
                      </label>
                    )}
                  </div>
                  {choice === "known" && <p className="text-xs text-success">{resumeSuggestionFor(gap.skill)}</p>}
                </li>
              );
            })}
          </ul>

          <div className="space-y-1 max-w-xs">
            <label htmlFor={hoursId} className="text-sm font-medium block">
              Horas de estudo por semana
            </label>
            <input
              id={hoursId}
              type="number"
              inputMode="numeric"
              min={HOURS_PER_WEEK_MIN}
              max={HOURS_PER_WEEK_MAX}
              step={1}
              className={`input input-bordered input-sm w-28 ${hoursValid ? "" : "input-error"}`}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
            />
            {!hoursValid && (
              <p className="text-xs text-error">
                Informe um número inteiro entre {HOURS_PER_WEEK_MIN} e {HOURS_PER_WEEK_MAX}.
              </p>
            )}
          </div>

          <div className="flex gap-2 p-3 rounded-lg bg-base-200/60 text-xs text-base-content/70">
            <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <p>
              A trilha é gerada com a sua chave e o mesmo currículo da análise, sem armazenamento no QueroVagas. A
              trilha e o seu progresso ficam salvos apenas neste navegador e podem ser excluídos a qualquer momento.
            </p>
          </div>

          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              <span>{error}</span>
            </div>
          )}

          {selectedGaps.length === 0 && (
            <p className="text-xs text-base-content/60">Selecione ao menos uma lacuna para estudar.</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setError(null);
                setMode(saved ? "view" : "idle");
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-sm btn-primary gap-1.5" disabled={!canGenerate} onClick={handleGenerate}>
              {error ? <RotateCcw className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
              {error ? "Tentar novamente" : "Gerar trilha"}
            </button>
          </div>
        </div>
      )}

      {mode === "loading" && (
        <div className="py-8 flex flex-col items-center gap-3 text-center" aria-live="polite">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-semibold text-sm">Montando sua trilha de estudos...</p>
          <button type="button" className="btn btn-xs btn-ghost" onClick={() => abortRef.current?.abort()}>
            Cancelar
          </button>
        </div>
      )}

      {mode === "view" && saved && (
        <div className="space-y-3">
          <LearningPathView saved={saved} onChange={handleSavedChange} />
          {gaps.length > 0 && (
            <button type="button" className="btn btn-xs btn-ghost gap-1" onClick={() => setMode("setup")}>
              <RotateCcw className="w-3.5 h-3.5" /> Gerar nova trilha
            </button>
          )}
        </div>
      )}
    </section>
  );
};
