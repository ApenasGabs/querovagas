import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactElement } from "react";
import { Eye, EyeOff, FileText, KeyRound, Loader2, RotateCcw, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import type { Job } from "../../../types/job";
import { trackCvMatchCompleted, trackCvMatchFailed, trackCvMatchStarted } from "../../../services/analytics";
import { useLlmSettings } from "../hooks/useLlmSettings";
import { analyzeCvMatch, CvMatchRequestError, loadResumeDraft, saveResumeDraft } from "../services/cvMatchService";
import { getProviderOption, isLlmProviderId, LLM_PROVIDER_OPTIONS, type CvMatchResponse } from "../types";
import {
  extractPdfText,
  MAX_RESUME_CHARS,
  MIN_RESUME_CHARS,
  RESUME_FILE_ERROR_MESSAGES,
  validateResumeFile,
} from "../utils/extractPdfText";
import { CvMatchResult } from "./CvMatchResult";

interface CvMatchModalProps {
  job: Job;
  onClose: () => void;
}

type InputMethod = "pdf" | "text";
type Phase = "form" | "loading" | "result";

export const CvMatchModal = ({ job, onClose }: CvMatchModalProps): ReactElement => {
  const titleId = useId();
  const fileInputId = useId();
  const textAreaId = useId();
  const providerId = useId();
  const modelId = useId();
  const apiKeyId = useId();

  const { settings, setProvider, setModel, setApiKey, setRememberKey, forgetKey } = useLlmSettings();
  const providerOption = getProviderOption(settings.provider);

  const [initialDraft] = useState(loadResumeDraft);
  const [inputMethod, setInputMethod] = useState<InputMethod>(initialDraft?.fileName ? "pdf" : initialDraft ? "text" : "pdf");
  const [resumeText, setResumeText] = useState(initialDraft?.text ?? "");
  const [fileName, setFileName] = useState<string | undefined>(initialDraft?.fileName);
  const [extracting, setExtracting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CvMatchResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      abortRef.current?.abort();
    };
  }, [onClose]);

  const trimmedResume = resumeText.trim();
  const resumeTooShort = trimmedResume.length > 0 && trimmedResume.length < MIN_RESUME_CHARS;
  const canSubmit =
    phase === "form" && !extracting && trimmedResume.length >= MIN_RESUME_CHARS && settings.apiKey.trim().length >= 8;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    const validationError = validateResumeFile(file);
    if (validationError) {
      setError(RESUME_FILE_ERROR_MESSAGES[validationError]);
      trackCvMatchFailed({ jobId: job.id, reason: validationError });
      return;
    }

    setExtracting(true);
    try {
      const text = (await extractPdfText(file)).slice(0, MAX_RESUME_CHARS);
      if (text.length < MIN_RESUME_CHARS) {
        setError(
          "Não conseguimos ler texto suficiente desse PDF (ele pode ser uma imagem/escaneado). Cole o conteúdo na aba \"Colar texto\".",
        );
        trackCvMatchFailed({ jobId: job.id, reason: "pdf_no_text" });
        return;
      }
      setResumeText(text);
      setFileName(file.name);
      saveResumeDraft({ fileName: file.name, text });
    } catch {
      setError("Não foi possível ler o PDF. Tente outro arquivo ou cole o texto manualmente.");
      trackCvMatchFailed({ jobId: job.id, reason: "pdf_parse_error" });
    } finally {
      setExtracting(false);
    }
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value.slice(0, MAX_RESUME_CHARS);
    setResumeText(text);
    setFileName(undefined);
    saveResumeDraft({ text });
  };

  const handleClearResume = () => {
    setResumeText("");
    setFileName(undefined);
    saveResumeDraft(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setPhase("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    const model = settings.model.trim() || providerOption.defaultModel;

    trackCvMatchStarted({ jobId: job.id, provider: settings.provider, model, inputMethod });

    try {
      const data = await analyzeCvMatch({
        provider: settings.provider,
        model,
        apiKey: settings.apiKey,
        resumeText: trimmedResume,
        job,
        signal: controller.signal,
      });
      setResponse(data);
      setPhase("result");
      trackCvMatchCompleted({
        jobId: job.id,
        provider: settings.provider,
        score: data.result.score,
        tier: data.result.tier,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPhase("form");
        return;
      }
      const message = err instanceof Error ? err.message : "Falha ao analisar o currículo.";
      setError(message);
      setPhase("form");
      trackCvMatchFailed({
        jobId: job.id,
        provider: settings.provider,
        reason: err instanceof CvMatchRequestError ? err.code : "unknown",
      });
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleNewAnalysis = () => {
    setResponse(null);
    setPhase("form");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-base-100 border border-base-300 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-base-200 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compatibilidade Currículo × Vaga</span>
            </div>
            <h2 id={titleId} className="text-lg md:text-xl font-bold leading-tight truncate">
              {job.title}
            </h2>
            <p className="text-sm text-base-content/60 truncate">{job.company}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
            aria-label="Fechar análise de currículo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {phase === "result" && response ? (
            <CvMatchResult
              result={response.result}
              providerLabel={getProviderOption(response.provider).label}
              model={response.model}
            />
          ) : phase === "loading" ? (
            <div className="py-16 flex flex-col items-center gap-4 text-center" aria-live="polite">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="font-semibold">Analisando seu currículo com {providerOption.label}...</p>
                <p className="text-xs text-base-content/60">Isso pode levar de 10 a 60 segundos, dependendo do modelo.</p>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>
                Cancelar
              </button>
            </div>
          ) : (
            <form id="cv-match-form" className="space-y-5" onSubmit={handleSubmit}>
              {/* Currículo */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-2">
                  1. Seu currículo
                </legend>
                <div role="tablist" className="tabs tabs-box tabs-sm w-fit">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMethod === "pdf"}
                    className={`tab gap-1.5 ${inputMethod === "pdf" ? "tab-active" : ""}`}
                    onClick={() => setInputMethod("pdf")}
                  >
                    <Upload className="w-3.5 h-3.5" /> Enviar PDF
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMethod === "text"}
                    className={`tab gap-1.5 ${inputMethod === "text" ? "tab-active" : ""}`}
                    onClick={() => setInputMethod("text")}
                  >
                    <FileText className="w-3.5 h-3.5" /> Colar texto
                  </button>
                </div>

                {inputMethod === "pdf" ? (
                  <div className="space-y-2">
                    <label htmlFor={fileInputId} className="text-sm font-medium block">
                      Arquivo PDF (até 5 MB)
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="file-input file-input-bordered file-input-sm w-full"
                      onChange={handleFileChange}
                      disabled={extracting}
                    />
                    {extracting && (
                      <p className="text-xs text-base-content/60 flex items-center gap-1.5" aria-live="polite">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo o PDF no seu navegador...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor={textAreaId} className="text-sm font-medium block">
                      Cole o texto do currículo
                    </label>
                    <textarea
                      id={textAreaId}
                      className="textarea textarea-bordered w-full min-h-40 text-sm"
                      placeholder="Resumo, experiências, stack, formação..."
                      value={resumeText}
                      onChange={handleTextChange}
                    />
                    <p className={`text-xs ${resumeTooShort ? "text-warning" : "text-base-content/50"}`}>
                      {trimmedResume.length.toLocaleString("pt-BR")} / {MAX_RESUME_CHARS.toLocaleString("pt-BR")} caracteres
                      {resumeTooShort ? ` — mínimo de ${MIN_RESUME_CHARS}` : ""}
                    </p>
                  </div>
                )}

                {trimmedResume.length >= MIN_RESUME_CHARS && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-success/10 text-sm">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-4 h-4 text-success shrink-0" />
                      <span className="truncate">
                        {fileName ? `${fileName} carregado` : "Currículo em texto carregado"} (
                        {trimmedResume.length.toLocaleString("pt-BR")} caracteres)
                      </span>
                    </span>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={handleClearResume}>
                      Remover
                    </button>
                  </div>
                )}
              </fieldset>

              {/* Provedor de IA */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-2">
                  2. Sua IA (traga sua própria chave)
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor={providerId} className="text-sm font-medium block">
                      Provedor
                    </label>
                    <select
                      id={providerId}
                      className="select select-bordered select-sm w-full"
                      value={settings.provider}
                      onChange={(e) => {
                        if (isLlmProviderId(e.target.value)) setProvider(e.target.value);
                      }}
                    >
                      {LLM_PROVIDER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={modelId} className="text-sm font-medium block">
                      Modelo
                    </label>
                    <input
                      id={modelId}
                      type="text"
                      className="input input-bordered input-sm w-full font-mono"
                      value={settings.model}
                      placeholder={providerOption.defaultModel}
                      onChange={(e) => setModel(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={apiKeyId} className="text-sm font-medium flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" /> Chave de API ({providerOption.label})
                    </label>
                    <a
                      href={providerOption.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-xs"
                    >
                      Gerar chave
                    </a>
                  </div>
                  <div className="join w-full">
                    <input
                      id={apiKeyId}
                      type={showKey ? "text" : "password"}
                      className="input input-bordered input-sm join-item w-full font-mono"
                      value={settings.apiKey}
                      placeholder={providerOption.keyHint}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="btn btn-sm join-item"
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className="label cursor-pointer gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={settings.rememberKey}
                        onChange={(e) => setRememberKey(e.target.checked)}
                      />
                      Lembrar chave neste navegador
                    </label>
                    {settings.apiKey && (
                      <button type="button" className="btn btn-xs btn-ghost text-error" onClick={forgetKey}>
                        Esquecer chave
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 p-3 rounded-lg bg-base-200/60 text-xs text-base-content/70">
                  <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <p>
                    O PDF é lido no seu navegador. O QueroVagas só repassa o texto do currículo e a vaga ao provedor
                    escolhido, usando a sua chave, e não armazena nem registra nenhum dos dois. O custo da chamada é
                    cobrado na sua conta do provedor.
                  </p>
                </div>
              </fieldset>

              {error && (
                <div role="alert" className="alert alert-error alert-soft text-sm">
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-base-200 bg-base-200/30 flex items-center justify-end gap-2">
          {phase === "result" ? (
            <>
              <button type="button" className="btn btn-sm btn-ghost gap-1.5" onClick={handleNewAnalysis}>
                <RotateCcw className="w-4 h-4" /> Nova análise
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
                Concluir
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
                Fechar
              </button>
              <button
                type="submit"
                form="cv-match-form"
                className="btn btn-sm btn-primary gap-1.5"
                disabled={!canSubmit}
              >
                <Sparkles className="w-4 h-4" /> Analisar compatibilidade
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
