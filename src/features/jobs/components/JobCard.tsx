import { Briefcase, Building, Clock, MapPin } from "lucide-react";
import type { Job, SeniorityLevel, WorkModel } from "../../../types/job";
import { Badge } from "../../../components/Badge/Badge";
import { Button } from "../../../components/Button/Button";

interface JobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
}

function getWorkModelBadge(model: WorkModel) {
  switch (model) {
    case "REMOTO":
      return { variant: "success" as const, label: "Remoto" };
    case "HIBRIDO":
      return { variant: "warning" as const, label: "Híbrido" };
    case "PRESENCIAL":
      return { variant: "info" as const, label: "Presencial" };
    default:
      return { variant: "default" as const, label: "Não informado" };
  }
}

function getSeniorityBadge(seniority: SeniorityLevel) {
  switch (seniority) {
    case "ESTAGIO":
      return { variant: "secondary" as const, label: "Estágio" };
    case "JUNIOR":
      return { variant: "primary" as const, label: "Júnior" };
    case "PLENO":
      return { variant: "accent" as const, label: "Pleno" };
    case "SENIOR":
      return { variant: "default" as const, label: "Sênior" };
    case "ESPECIALISTA":
      return { variant: "info" as const, label: "Especialista" };
    default:
      return { variant: "default" as const, label: "Nível aberto" };
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) {
    return minutes <= 1 ? "Agora mesmo" : `há ${minutes} min`;
  }
  if (hours < 24) {
    return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (days === 1) {
    return "Ontem";
  }
  if (days < 30) {
    return `há ${days} dias`;
  }
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export const JobCard = ({ job, onSelect }: JobCardProps) => {
  const modelInfo = getWorkModelBadge(job.workModel);
  const seniorityInfo = getSeniorityBadge(job.seniorityLevel);
  const timeAgo = formatRelativeTime(job.scrapedAt);

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 flex flex-col justify-between group">
      <div className="card-body p-5 space-y-3">
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-base-200 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors duration-200 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-base-content/70 truncate" title={job.company}>
                {job.company}
              </h4>
              <div className="flex items-center gap-1 text-[11px] text-base-content/50">
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
          <Badge variant="default" size="sm" className="text-[10px] uppercase font-mono tracking-wider opacity-70">
            {job.source}
          </Badge>
        </div>

        {/* Título da Vaga */}
        <h3
          className="text-base font-bold text-base-content line-clamp-2 leading-snug group-hover:text-primary transition-colors cursor-pointer"
          title={job.title}
          onClick={() => onSelect(job)}
        >
          {job.title}
        </h3>

        {/* Badges de Senioridade, Modelo e Localização */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={seniorityInfo.variant} size="sm">
            {seniorityInfo.label}
          </Badge>
          <Badge variant={modelInfo.variant} size="sm">
            {modelInfo.label}
          </Badge>
          {job.contractType && job.contractType !== "OUTRO" && (
            <Badge variant="default" size="sm" className="opacity-80">
              {job.contractType}
            </Badge>
          )}
        </div>

        {/* Localização */}
        <div className="flex items-center gap-1.5 text-xs text-base-content/60 truncate" title={job.location}>
          <MapPin className="w-3.5 h-3.5 shrink-0 text-base-content/40" />
          <span className="truncate">{job.location}</span>
        </div>

        {/* Tags de Tecnologias / Stack */}
        {job.stack && job.stack.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {job.stack.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="text-[11px] px-2 py-0.5 rounded-md bg-base-200 text-base-content/80 font-medium"
              >
                {tech}
              </span>
            ))}
            {job.stack.length > 4 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-base-200 text-base-content/50">
                +{job.stack.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Rodapé do Card com Ações */}
      <div className="p-4 pt-0 border-t border-base-200 flex items-center justify-between gap-2 mt-auto">
        {job.salary ? (
          <span className="text-xs font-semibold text-success truncate">{job.salary}</span>
        ) : (
          <span className="text-[11px] text-base-content/40">Salário a combinar</span>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSelect(job)}
          className="gap-1.5 shrink-0"
        >
          <span>Ver Vaga</span>
          <Briefcase className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
