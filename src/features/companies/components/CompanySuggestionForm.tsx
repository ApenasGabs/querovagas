import { AlertCircle, CheckCircle, Link2, Send, Sparkles } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import type { ATSPlatform, Company } from "../../../types/company";
import { detectATS } from "../../../utils/atsDetector";
import { companyService } from "../../../services/companyService";
import type { UserProfile } from "../../../services/trustAuthService";

export const DRAFT_SUGGESTION_KEY = "querovagas_company_suggestion_draft";
export const RETURN_TAB_KEY = "querovagas_return_tab";

interface DraftData {
  name?: string;
  careerUrl?: string;
  ats?: ATSPlatform | "OUTRO";
  notes?: string;
}

function loadStoredDraft(): DraftData | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_SUGGESTION_KEY);
    return raw ? (JSON.parse(raw) as DraftData) : null;
  } catch {
    return null;
  }
}

interface CompanySuggestionFormProps {
  initialName?: string;
  defaultSuggestedBy?: string;
  user?: UserProfile | null;
  onLogin?: () => void;
  onSuccess: (newCompany: Company) => void;
  onCancel?: () => void;
}

export function CompanySuggestionForm({
  initialName = "",
  defaultSuggestedBy = "",
  user,
  onLogin,
  onSuccess,
  onCancel,
}: CompanySuggestionFormProps): ReactElement {
  const [draft] = useState<DraftData | null>(loadStoredDraft);
  const [name, setName] = useState(() => initialName || draft?.name || "");
  const [careerUrl, setCareerUrl] = useState(() => draft?.careerUrl || "");
  const [ats, setAts] = useState<ATSPlatform | "OUTRO">(() => draft?.ats || "OUTRO");
  const [notes, setNotes] = useState(() => draft?.notes || "");
  const [suggestedBy, setSuggestedBy] = useState(() =>
    user?.username ? `@${user.username}` : defaultSuggestedBy,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sincroniza initialName quando recebido via props
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName);
    if (initialName) {
      setName(initialName);
    }
  }

  // Sincroniza usuário logado no campo de autor
  useEffect(() => {
    if (user?.username) {
      setSuggestedBy(`@${user.username}`);
    } else if (defaultSuggestedBy) {
      setSuggestedBy((prev) => prev || defaultSuggestedBy);
    }
  }, [user?.username, defaultSuggestedBy]);

  // Detecção em tempo real de plataforma ATS
  const detectedResult = careerUrl.trim() ? detectATS(careerUrl) : null;
  const detectedInfo =
    detectedResult && detectedResult.isKnownATS
      ? `Plataforma detectada: ${detectedResult.platformName}`
      : null;

  const handleCareerUrlChange = (value: string): void => {
    setCareerUrl(value);
    const result = detectATS(value);
    if (result.isKnownATS) {
      setAts(result.ats);
    }
  };

  const handleLoginClick = (): void => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        sessionStorage.setItem(
          DRAFT_SUGGESTION_KEY,
          JSON.stringify({
            name,
            careerUrl,
            ats,
            notes,
          }),
        );
        sessionStorage.setItem(RETURN_TAB_KEY, "suggest");
      } catch (err) {
        console.warn("Falha ao salvar rascunho de sugestão:", err);
      }
    }

    if (onLogin) {
      onLogin();
    } else if (typeof window !== "undefined") {
      const redirectUri = encodeURIComponent(window.location.href);
      window.location.href = `https://api.utteranc.es/authorize?redirect_uri=${redirectUri}`;
    }
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Se o usuário não estiver autenticado, salva rascunho e redireciona para login
    if (!user) {
      handleLoginClick();
      return;
    }

    if (!name.trim()) {
      setError("Por favor, informe o nome da empresa.");
      return;
    }

    if (!careerUrl.trim()) {
      setError("Por favor, informe o link da página de carreiras da empresa.");
      return;
    }

    setLoading(true);
    try {
      const created = await companyService.suggestCompany({
        name: name.trim(),
        careerUrl: careerUrl.trim(),
        ats,
        notes: notes.trim() || undefined,
        suggestedBy: suggestedBy.trim() || `@${user.username}`,
      });

      setSuccessMessage(
        `🎉 A empresa "${created.name}" foi indicada com sucesso e adicionada ao mural da comunidade!`,
      );
      setName("");
      setCareerUrl("");
      setNotes("");

      // Limpa o rascunho temporário do sessionStorage
      if (typeof window !== "undefined" && window.sessionStorage) {
        try {
          sessionStorage.removeItem(DRAFT_SUGGESTION_KEY);
          sessionStorage.removeItem(RETURN_TAB_KEY);
        } catch {
          // Ignora
        }
      }

      // Notifica o callback superior
      setTimeout(() => {
        onSuccess(created);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar sugestão";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-100 rounded-2xl border border-base-300 p-5 sm:p-6 space-y-5">
      {/* Cabeçalho do Formulário */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Indicação Comunitária de Empresas</span>
        </div>
        <h3 className="text-lg font-bold text-base-content">
          Sugerir Nova Empresa para o Crawler do QueroVagas
        </h3>
        <p className="text-xs sm:text-sm text-base-content/70">
          Ajude a comunidade! Se você conhece uma empresa de tecnologia contratando, compartilhe o
          link oficial de carreiras (Gupy, Ashby, Greenhouse, Lever, etc.) para que nosso robô
          comece a monitorá-la.
        </p>
      </div>

      {/* Banner Informativo quando Deslogado */}
      {!user && (
        <div className="alert alert-info/10 border border-info/30 rounded-xl p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base-content/80">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>
              Para indicar empresas e assinar com sua reputação comunitária, faça login com o GitHub.
            </span>
          </div>
          <button
            type="button"
            onClick={handleLoginClick}
            className="btn btn-xs btn-outline btn-primary gap-1 shrink-0"
          >
            <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Entrar com GitHub</span>
          </button>
        </div>
      )}

      {/* Alerta de Sucesso */}
      {successMessage && (
        <div className="alert alert-success text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Alerta de Erro */}
      {error && (
        <div className="alert alert-error text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo: Nome da Empresa */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-semibold text-xs text-base-content">
              Nome da Empresa <span className="text-error">*</span>
            </span>
          </label>
          <input
            type="text"
            className="input input-sm sm:input-md input-bordered w-full"
            placeholder="Ex: Nubank, PicPay, Conta Simples, Loft..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        {/* Campo: Link de Carreiras / ATS */}
        <div className="form-control">
          <label className="label py-1 flex items-center justify-between">
            <span className="label-text font-semibold text-xs text-base-content">
              Link da Página de Vagas / ATS <span className="text-error">*</span>
            </span>
            {detectedInfo && (
              <span className="badge badge-xs badge-success gap-1 font-mono">
                <CheckCircle className="w-3 h-3" />
                {detectedInfo}
              </span>
            )}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
              <Link2 className="w-4 h-4" />
            </div>
            <input
              type="text"
              className="input input-sm sm:input-md input-bordered w-full pl-9"
              placeholder="Ex: https://empresa.gupy.io ou jobs.ashbyhq.com/empresa"
              value={careerUrl}
              onChange={(e) => handleCareerUrlChange(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <label className="label py-0.5">
            <span className="label-text-alt text-[11px] text-base-content/60">
              Aceitamos links do Gupy, Ashby, Greenhouse, Lever, Workable, InHire ou página oficial.
            </span>
          </label>
        </div>

        {/* Seleção de Plataforma ATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold text-xs text-base-content">
                Plataforma ATS
              </span>
            </label>
            <select
              className="select select-sm select-bordered w-full"
              value={ats}
              onChange={(e) => setAts(e.target.value as ATSPlatform)}
              disabled={loading}
            >
              <option value="OUTRO">Detectar Automaticamente / Outro</option>
              <option value="GUPY">Gupy</option>
              <option value="ASHBY">Ashby</option>
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
              <option value="WORKABLE">Workable</option>
              <option value="INHIRE">InHire</option>
              <option value="PROGRAMATHOR">Programathor</option>
              <option value="GEEKHUNTER">GeekHunter</option>
            </select>
          </div>

          {/* Nome ou Contato do Colaborador */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold text-xs text-base-content">
                Autor da Indicação
              </span>
            </label>
            {user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base-200 border border-base-300 text-xs font-semibold text-base-content">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                <span>@{user.username}</span>
                <span className="text-base-content/50 font-normal text-[11px]">
                  (Identificado via GitHub)
                </span>
              </div>
            ) : (
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                placeholder="Conecte-se com GitHub ou informe seu @nome"
                value={suggestedBy}
                onChange={(e) => setSuggestedBy(e.target.value)}
                disabled={loading}
              />
            )}
          </div>
        </div>

        {/* Observações / Stacks Predominantes */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-semibold text-xs text-base-content">
              Observações / Tecnologias principais (Opcional)
            </span>
          </label>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full h-20"
            placeholder="Ex: Empresa contratando para posições remotas de React, Node e Python..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Ações do Formulário */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </button>
          )}

          {!user ? (
            <button
              type="button"
              className="btn btn-sm btn-primary gap-1.5 shadow-xs"
              onClick={handleLoginClick}
              title="Faça login com seu GitHub para assinar e enviar esta indicação"
            >
              <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Entrar com GitHub para Sugerir</span>
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-sm btn-primary gap-1.5 shadow-xs"
              disabled={loading || !name.trim() || !careerUrl.trim()}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Enviar para a Comunidade</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
