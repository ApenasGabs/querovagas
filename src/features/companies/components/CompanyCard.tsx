import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Search,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import type { ReactElement } from "react";
import type { Company } from "../../../types/company";

interface CompanyCardProps {
  company: Company;
  hasVoted?: boolean;
  onUpvote?: (companyId: string) => void;
  onViewJobs?: (companyName: string) => void;
}

export function CompanyCard({
  company,
  hasVoted = false,
  onUpvote,
  onViewJobs,
}: CompanyCardProps): ReactElement {
  const getATSBadgeClass = (ats: string): string => {
    switch (ats?.toUpperCase()) {
      case "GUPY":
        return "badge-primary";
      case "ASHBY":
        return "badge-info";
      case "GREENHOUSE":
        return "badge-success";
      case "LEVER":
        return "badge-warning";
      case "WORKABLE":
        return "badge-accent";
      case "INHIRE":
        return "badge-secondary";
      default:
        return "badge-neutral";
    }
  };

  const isMonitored = company.status === "MONITORED";
  const isSuggested = company.status === "SUGGESTED";
  const activeCount = company.activeJobsCount || 0;

  return (
    <div className="card bg-base-100 border border-base-300 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-4">
      {/* Topo do Card: Identificação e Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
            {company.name ? company.name.charAt(0).toUpperCase() : <Building2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4
              className="text-base font-bold text-base-content truncate"
              title={company.name}
            >
              {company.name}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className={`badge badge-xs font-semibold ${getATSBadgeClass(company.ats)}`}>
                {company.ats || "OUTRO"}
              </span>

              {isMonitored ? (
                <span className="badge badge-xs badge-success/20 text-success gap-1 border-0 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Monitorada
                </span>
              ) : isSuggested ? (
                <span className="badge badge-xs badge-warning/20 text-warning gap-1 border-0 font-medium">
                  <Clock className="w-3 h-3" />
                  Sugerida
                </span>
              ) : (
                <span className="badge badge-xs badge-ghost text-base-content/60">
                  Na fila
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quantidade de vagas ou Votos da comunidade */}
        {activeCount > 0 ? (
          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-primary flex items-center gap-1 justify-end">
              <Flame className="w-3.5 h-3.5 text-warning fill-warning" />
              {activeCount} {activeCount === 1 ? "vaga" : "vagas"}
            </span>
            <span className="text-[10px] text-base-content/50">no portal</span>
          </div>
        ) : isSuggested ? (
          <div className="text-right shrink-0">
            <span className="badge badge-sm badge-outline gap-1 font-mono">
              <ThumbsUp className="w-3 h-3 text-primary" />
              {company.votesCount || 1}
            </span>
          </div>
        ) : null}
      </div>

      {/* Notas ou detalhes caso existam */}
      {company.notes && (
        <p className="text-xs text-base-content/70 italic line-clamp-2 bg-base-200/50 p-2 rounded-lg">
          &ldquo;{company.notes}&rdquo;
        </p>
      )}

      {company.suggestedBy && isSuggested && (
        <div className="text-[11px] text-base-content/50 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-warning" />
          Sugerido por: <strong className="text-base-content/80">{company.suggestedBy}</strong>
        </div>
      )}

      {/* Rodapé do Card: Ações */}
      <div className="pt-2 border-t border-base-200 flex items-center justify-between gap-2">
        {/* Link Oficial de Carreiras */}
        {company.careerUrl ? (
          <a
            href={company.careerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-xs gap-1 text-base-content/70 hover:text-primary"
            title="Abrir página oficial de vagas da empresa"
          >
            <span>Carreiras</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1.5">
          {/* Botão de Apoiar Sugestão */}
          {isSuggested && onUpvote && (
            <button
              onClick={() => onUpvote(company.id)}
              disabled={hasVoted}
              className={`btn btn-xs gap-1.5 ${
                hasVoted ? "btn-disabled" : "btn-outline btn-primary"
              }`}
              title={hasVoted ? "Você já apoiou esta empresa" : "Apoiar inclusão desta empresa no crawler"}
            >
              <ThumbsUp className="w-3 h-3" />
              <span>{hasVoted ? "Apoiado" : "+1 Apoiar"}</span>
            </button>
          )}

          {/* Botão para ver vagas no portal */}
          {onViewJobs && (
            <button
              onClick={() => onViewJobs(company.name)}
              className="btn btn-primary btn-xs gap-1"
              title={`Buscar vagas de ${company.name} no QueroVagas`}
            >
              <Search className="w-3 h-3" />
              <span>Ver Vagas</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
