import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Lightbulb, PenLine, Target, XCircle } from "lucide-react";
import {
  GAP_KIND_LABELS,
  GAP_PRIORITY_LABELS,
  GAP_STATUS_LABELS,
  getResultGaps,
  type CvMatchResult as CvMatchResultData,
  type CvMatchTier,
} from "../types";

const TIER_STYLES: Record<CvMatchTier, { text: string; badge: string; progress: string }> = {
  high: { text: "text-success", badge: "badge-success", progress: "progress-success" },
  good: { text: "text-info", badge: "badge-info", progress: "progress-info" },
  partial: { text: "text-warning", badge: "badge-warning", progress: "progress-warning" },
  low: { text: "text-error", badge: "badge-error", progress: "progress-error" },
};

const scoreTier = (score: number): CvMatchTier => {
  if (score >= 80) return "high";
  if (score >= 65) return "good";
  if (score >= 50) return "partial";
  return "low";
};

interface CvMatchResultProps {
  result: CvMatchResultData;
  providerLabel: string;
  model: string;
}

const CopyButton = ({ text }: { text: string }): ReactElement => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 2000);
    } catch {
      // clipboard indisponível
    }
  };

  return (
    <button
      type="button"
      className="btn btn-xs btn-ghost gap-1"
      onClick={handleCopy}
      aria-label="Copiar texto reescrito"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
};

export const CvMatchResult = ({ result, providerLabel, model }: CvMatchResultProps): ReactElement => {
  const tierStyle = TIER_STYLES[result.tier];
  const gaps = getResultGaps(result);
  const radialStyle = { "--value": result.score, "--size": "7rem", "--thickness": "0.6rem" } as CSSProperties;

  return (
    <div className="space-y-6" data-testid="cv-match-result">
      {/* Score geral */}
      <section className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl bg-base-200/50 border border-base-300/60">
        <div
          className={`radial-progress ${tierStyle.text} font-black text-2xl shrink-0`}
          style={radialStyle}
          role="progressbar"
          aria-valuenow={result.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Compatibilidade geral: ${result.score} de 100`}
        >
          {result.score}
        </div>
        <div className="space-y-2 text-center sm:text-left">
          <span className={`badge ${tierStyle.badge} font-semibold`}>{result.tierLabel}</span>
          {result.summary && <p className="text-sm leading-relaxed text-base-content/90">{result.summary}</p>}
          <p className="text-[11px] text-base-content/50">
            Análise gerada por {providerLabel} · {model}. Use como orientação — a IA pode errar.
          </p>
        </div>
      </section>

      {/* Critérios */}
      <section className="space-y-3" aria-labelledby="cv-match-criteria-title">
        <h3 id="cv-match-criteria-title" className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          Notas por critério
        </h3>
        <ul className="space-y-3">
          {result.criteria.map((criterion) => (
            <li key={criterion.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">
                  {criterion.label}{" "}
                  <span className="text-xs font-normal text-base-content/50">
                    (peso {Math.round(criterion.weight * 100)}%)
                  </span>
                </span>
                <span className="font-mono font-bold">{criterion.score}</span>
              </div>
              <progress
                className={`progress ${TIER_STYLES[scoreTier(criterion.score)].progress} w-full`}
                value={criterion.score}
                max={100}
                aria-label={`${criterion.label}: ${criterion.score} de 100`}
              />
              {criterion.justification && (
                <p className="text-xs text-base-content/70">{criterion.justification}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Skills */}
      {(result.matchedSkills.length > 0 || gaps.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-success">
              <CheckCircle2 className="w-4 h-4" /> Requisitos atendidos
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {result.matchedSkills.length > 0 ? (
                result.matchedSkills.map((skill, index) => (
                  <span key={`${skill}-${index}`} className="badge badge-success badge-soft badge-sm">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-base-content/50">Nenhum identificado.</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-error">
              <XCircle className="w-4 h-4" /> Requisitos ausentes ou fracos
            </h3>
            {gaps.length > 0 ? (
              <ul className="space-y-1.5" data-testid="cv-match-gaps">
                {gaps.map((gap, index) => (
                  <li key={`${gap.skill}-${index}`} className="flex flex-wrap items-center gap-1 text-sm min-w-0">
                    <span className="font-medium break-words mr-1">{gap.skill}</span>
                    <span className="badge badge-xs badge-ghost">{GAP_STATUS_LABELS[gap.status]}</span>
                    <span
                      className={`badge badge-xs badge-soft ${gap.priority === "required" ? "badge-error" : "badge-info"}`}
                    >
                      {GAP_PRIORITY_LABELS[gap.priority]}
                    </span>
                    <span
                      className={`badge badge-xs badge-soft ${gap.kind === "experience" ? "badge-warning" : "badge-primary"}`}
                    >
                      {GAP_KIND_LABELS[gap.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-base-content/50">Nenhum — ótimo sinal!</span>
            )}
          </div>
        </section>
      )}

      {/* Pontos fortes e lacunas */}
      {(result.strengths.length > 0 || result.gaps.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {result.strengths.length > 0 && (
            <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <Target className="w-4 h-4 text-success" /> Pontos fortes para esta vaga
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-base-content/85">
                {result.strengths.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {result.gaps.length > 0 && (
            <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <AlertTriangle className="w-4 h-4 text-warning" /> Lacunas que podem eliminar na triagem
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-base-content/85">
                {result.gaps.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Sugestões */}
      {result.suggestions.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-base-content/60">
            <Lightbulb className="w-4 h-4 text-primary" /> Ajustes sugeridos no currículo
          </h3>
          <ul className="space-y-2">
            {result.suggestions.map((s, index) => (
              <li key={`${s.section}-${index}`} className="flex gap-2 text-sm">
                <span className="badge badge-outline badge-sm shrink-0 mt-0.5">{s.section}</span>
                <span className="text-base-content/85">{s.suggestion}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bullets reescritos */}
      {result.rewrittenBullets.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-base-content/60">
            <PenLine className="w-4 h-4 text-primary" /> Reescritas prontas (revise antes de usar)
          </h3>
          <ul className="space-y-3">
            {result.rewrittenBullets.map((bullet, index) => (
              <li key={index} className="p-3 rounded-xl bg-base-200/60 border border-base-300/60 space-y-1.5">
                {bullet.original && (
                  <p className="text-xs text-base-content/50 line-through decoration-base-content/30">
                    {bullet.original}
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{bullet.rewritten}</p>
                  <CopyButton text={bullet.rewritten} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Veredito */}
      {result.verdict && (
        <div role="note" className={`alert alert-soft ${result.tier === "low" ? "alert-warning" : "alert-info"}`}>
          <span className="text-sm">
            <strong>Veredito: </strong>
            {result.verdict}
          </span>
        </div>
      )}
    </div>
  );
};
