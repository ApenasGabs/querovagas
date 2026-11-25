import { useEffect, useRef, useState, type ReactElement } from "react";
import { AlertTriangle, BookOpen, Check, Copy, Download, FileText, Trash2 } from "lucide-react";
import { trackLearningPathDeleted, trackLearningPathExported, trackLearningPathStepToggled } from "../../../services/analytics";
import {
  countCompletedSteps,
  deleteLearningPath,
  formatHoursRange,
  formatWeeksRange,
  learningPathFileName,
  learningPathToMarkdown,
  resumeSuggestionFor,
  stepKey,
  toggleLearningPathStep,
  totalHours,
  UNDETAILED_EXPERIENCE_NOTE,
} from "../services/learningPathService";
import { DEFERRED_GAP_REASON_LABELS, GAP_PRIORITY_LABELS, SKILL_LEVEL_LABELS, type SavedLearningPath } from "../types";

interface LearningPathViewProps {
  saved: SavedLearningPath;
  onChange: (next: SavedLearningPath | null) => void;
}

export const LearningPathView = ({ saved, onChange }: LearningPathViewProps): ReactElement => {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const { path } = saved;
  const deferredGaps = path.deferredGaps ?? [];
  const total = totalHours(path);
  const completed = countCompletedSteps(saved);
  const progress = path.steps.length > 0 ? Math.round((completed / path.steps.length) * 100) : 0;

  const handleToggle = (index: number) => {
    const step = path.steps[index];
    const next = toggleLearningPathStep(saved, step);
    onChange(next);
    trackLearningPathStepToggled({
      jobId: saved.jobId,
      completed: next.completedSteps.includes(stepKey(step)),
      completedSteps: countCompletedSteps(next),
      totalSteps: path.steps.length,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(learningPathToMarkdown(saved));
      setCopied(true);
      trackLearningPathExported({ jobId: saved.jobId, method: "copy" });
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } catch {
      // clipboard indisponível — o download continua disponível
    }
  };

  const handleDownload = () => {
    const blob = new Blob([learningPathToMarkdown(saved)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = learningPathFileName(saved);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    trackLearningPathExported({ jobId: saved.jobId, method: "download" });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteLearningPath(saved.jobId);
    trackLearningPathDeleted({ jobId: saved.jobId });
    onChange(null);
  };

  return (
    <section className="space-y-5 min-w-0" data-testid="learning-path" aria-labelledby="learning-path-title">
      <div className="space-y-2">
        <h3 id="learning-path-title" className="flex items-center gap-1.5 text-base font-bold">
          <BookOpen className="w-5 h-5 text-primary shrink-0" /> Sua trilha de estudos
        </h3>
        <p className="text-xs text-base-content/60">
          {saved.hoursPerWeek} h/semana
          {path.steps.length > 0 &&
            ` · ${formatHoursRange(total.min, total.max)} no total (${formatWeeksRange(total.min, total.max, saved.hoursPerWeek)})`}
        </p>
        {path.limitedDescription && (
          <div role="note" className="alert alert-warning alert-soft text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>A vaga tem pouca descrição, então esta trilha pode ser menos precisa.</span>
          </div>
        )}
        {path.summary && <p className="text-sm text-base-content/85 leading-relaxed">{path.summary}</p>}
      </div>

      {path.steps.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Progresso</span>
              <span>
                {completed} de {path.steps.length} etapas
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={progress}
              max={100}
              aria-label={`Progresso da trilha: ${completed} de ${path.steps.length} etapas concluídas`}
            />
          </div>

          <ol className="space-y-3">
            {path.steps.map((step, index) => {
              const done = saved.completedSteps.includes(stepKey(step));
              return (
                <li
                  key={stepKey(step)}
                  className={`p-3 rounded-xl border space-y-2 min-w-0 ${done ? "border-success/40 bg-success/5" : "border-base-300/60 bg-base-200/40"}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      id={`learning-step-${index}`}
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary mt-0.5 shrink-0"
                      checked={done}
                      onChange={() => handleToggle(index)}
                      aria-label={`Concluí a etapa ${index + 1}: ${step.skill}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <label htmlFor={`learning-step-${index}`} className={`font-semibold text-sm break-words cursor-pointer ${done ? "line-through text-base-content/60" : ""}`}>
                        {index + 1}. {step.skill}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`badge badge-sm ${step.priority === "required" ? "badge-error" : "badge-info"} badge-soft`}>
                          {GAP_PRIORITY_LABELS[step.priority]}
                        </span>
                        <span className="badge badge-sm badge-ghost">
                          {SKILL_LEVEL_LABELS[step.currentLevel]} → {SKILL_LEVEL_LABELS[step.targetLevel]}
                        </span>
                        <span className="badge badge-sm badge-outline">
                          {formatHoursRange(step.hoursMin, step.hoursMax)} · {formatWeeksRange(step.hoursMin, step.hoursMax, saved.hoursPerWeek)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <details className="text-sm text-base-content/85 pl-7 min-w-0">
                    <summary className="cursor-pointer text-xs font-semibold text-primary">Ver detalhes da etapa</summary>
                    <dl className="mt-2 space-y-2 break-words">
                      {step.reason && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Por que para esta vaga</dt>
                          <dd>{step.reason}</dd>
                        </div>
                      )}
                      {step.prerequisites.length > 0 && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Pré-requisitos</dt>
                          <dd>{step.prerequisites.join(", ")}</dd>
                        </div>
                      )}
                      {step.topics.length > 0 && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Tópicos</dt>
                          <dd>
                            <ul className="list-disc list-inside">
                              {step.topics.map((topic, i) => (
                                <li key={`${topic}-${i}`}>{topic}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      )}
                      {step.practiceProject && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Projeto prático</dt>
                          <dd>{step.practiceProject}</dd>
                        </div>
                      )}
                      {step.doneCriteria.length > 0 && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Como saber que aprendi</dt>
                          <dd>
                            <ul className="list-disc list-inside">
                              {step.doneCriteria.map((item, i) => (
                                <li key={`${item}-${i}`}>{item}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      )}
                      {step.searchTerms.length > 0 && (
                        <div>
                          <dt className="text-xs font-bold text-base-content/60">Termos de busca</dt>
                          <dd className="flex flex-wrap gap-1.5 pt-0.5">
                            {step.searchTerms.map((term, i) => (
                              <code key={`${term}-${i}`} className="px-1.5 py-0.5 rounded bg-base-300/60 text-xs">
                                {term}
                              </code>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {path.experienceGaps.length > 0 && (
        <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 space-y-2" data-testid="learning-path-experience">
          <h4 className="text-sm font-bold">Lacunas de vivência (sem prazo de estudo)</h4>
          <p className="text-xs text-base-content/60">Não se resolvem só estudando: veja como gerar evidência.</p>
          <ul className="space-y-2 text-sm">
            {path.experienceGaps.map((gap, i) => (
              <li key={`${gap.gap}-${i}`} className="break-words">
                <strong>{gap.gap}</strong>
                {gap.reason && <span className="text-base-content/80"> — {gap.reason}</span>}
                {gap.detailed === false && <p className="text-xs text-base-content/60 mt-1">{UNDETAILED_EXPERIENCE_NOTE}</p>}
                {gap.evidenceIdeas.length > 0 && (
                  <ul className="list-disc list-inside text-base-content/80 mt-1">
                    {gap.evidenceIdeas.map((idea, j) => (
                      <li key={`${idea}-${j}`}>{idea}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {deferredGaps.length > 0 && (
        <div className="p-4 rounded-xl border border-base-300/60 bg-base-200/40 space-y-2" data-testid="learning-path-deferred">
          <h4 className="text-sm font-bold">Para depois</h4>
          <p className="text-xs text-base-content/60">Lacunas aprendíveis que ficaram fora desta trilha. Estude depois das etapas acima.</p>
          <ul className="space-y-1 text-sm">
            {deferredGaps.map((gap) => (
              <li key={gap.skill} className="flex flex-wrap items-center gap-1.5 break-words">
                <span className="font-semibold">{gap.skill}</span>
                <span className={`badge badge-sm ${gap.priority === "required" ? "badge-error" : "badge-info"} badge-soft`}>
                  {GAP_PRIORITY_LABELS[gap.priority]}
                </span>
                <span className="text-xs text-base-content/60">{DEFERRED_GAP_REASON_LABELS[gap.reason]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved.knownSkills.length > 0 && (
        <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-2" data-testid="learning-path-resume-suggestions">
          <h4 className="flex items-center gap-1.5 text-sm font-bold">
            <FileText className="w-4 h-4 text-success" /> Inclua no currículo
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-base-content/85">
            {saved.knownSkills.map((skill) => (
              <li key={skill}>{resumeSuggestionFor(skill)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiada" : "Copiar trilha"}
        </button>
        <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={handleDownload}>
          <Download className="w-4 h-4" /> Baixar Markdown
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost text-error gap-1.5 sm:ml-auto"
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
        >
          <Trash2 className="w-4 h-4" /> {confirmDelete ? "Confirmar exclusão" : "Excluir trilha"}
        </button>
      </div>
      <p className="text-[11px] text-base-content/50">
        Trilha e progresso ficam salvos apenas neste navegador. A IA pode errar: use como orientação.
      </p>
    </section>
  );
};
