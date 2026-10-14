import { AlertCircle, CheckCircle, Link2, Send, Sparkles } from "lucide-react";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import type { ATSPlatform, Company } from "../../../types/company";
import { detectATS } from "../../../utils/atsDetector";
import { companyService } from "../../../services/companyService";

interface CompanySuggestionFormProps {
  initialName?: string;
  onSuccess: (newCompany: Company) => void;
  onCancel?: () => void;
}

export function CompanySuggestionForm({
  initialName = "",
  onSuccess,
  onCancel,
}: CompanySuggestionFormProps): ReactElement {
  const [name, setName] = useState(initialName);
  const [careerUrl, setCareerUrl] = useState("");
  const [ats, setAts] = useState<ATSPlatform | "OUTRO">("OUTRO");
  const [notes, setNotes] = useState("");
  const [suggestedBy, setSuggestedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sincroniza initialName quando recebido via props
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName);
    setName(initialName);
  }

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

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

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
        suggestedBy: suggestedBy.trim() || undefined,
      });

      setSuccessMessage(
        `🎉 A empresa "${created.name}" foi indicada com sucesso e adicionada ao mural da comunidade!`,
      );
      setName("");
      setCareerUrl("");
      setNotes("");
      setSuggestedBy("");

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

          {/* Nome ou Contato do Colaborador (Opcional) */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-semibold text-xs text-base-content">
                Seu Nome ou @GitHub (Opcional)
              </span>
            </label>
            <input
              type="text"
              className="input input-sm input-bordered w-full"
              placeholder="Ex: @seunome ou DevComunidade"
              value={suggestedBy}
              onChange={(e) => setSuggestedBy(e.target.value)}
              disabled={loading}
            />
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

          <button
            type="submit"
            className="btn btn-sm btn-primary gap-1.5"
            disabled={loading || !name.trim() || !careerUrl.trim()}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Enviar para a Comunidade</span>
          </button>
        </div>
      </form>
    </div>
  );
}
