import { useState } from "react";
import {
  Building,
  Check,
  ExternalLink,
  MapPin,
  Share2,
  X,
} from "lucide-react";
import type { Job } from "../../../types/job";
import { Badge } from "../../../components/Badge/Badge";
import { Button } from "../../../components/Button/Button";

interface JobModalProps {
  job: Job | null;
  onClose: () => void;
}

export const JobModal = ({ job, onClose }: JobModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!job) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(job.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🔥 Vaga de Tecnologia: *${job.title}* na *${job.company}*\n📍 Local: ${job.location}\n💼 Modelo: ${job.workModel} | ${job.contractType}\n🔗 Candidate-se aqui: ${job.url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-base-100 border border-base-300 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="p-6 border-b border-base-200 flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" size="sm" className="font-mono text-xs uppercase opacity-75">
                {job.source}
              </Badge>
              {job.workModel === "REMOTO" ? (
                <Badge variant="success" size="sm">Remoto</Badge>
              ) : job.workModel === "HIBRIDO" ? (
                <Badge variant="warning" size="sm">Híbrido</Badge>
              ) : (
                <Badge variant="info" size="sm">Presencial</Badge>
              )}
              <Badge variant="primary" size="sm">
                {job.seniorityLevel}
              </Badge>
              {job.contractType && (
                <Badge variant="default" size="sm">
                  {job.contractType}
                </Badge>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-base-content leading-tight">
              {job.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-sm text-base-content/70">
              <div className="flex items-center gap-1 font-medium text-base-content">
                <Building className="w-4 h-4 text-primary" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-base-content/40" />
                <span>{job.location}</span>
              </div>
              {job.salary && (
                <div className="text-success font-semibold">
                  {job.salary}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Stack & Descrição Completa */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-base-content/90">
          {/* Stack de Tecnologias */}
          {job.stack && job.stack.length > 0 && (
            <div className="space-y-2 p-4 rounded-xl bg-base-200/50 border border-base-300/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Tecnologias & Competências Requeridas
              </h4>
              <div className="flex flex-wrap gap-2">
                {job.stack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-base-300/60 text-base-content"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Descrição Formatada */}
          <div className="space-y-4 text-sm leading-relaxed whitespace-pre-line">
            {job.description ? (
              job.description
            ) : (
              <p className="italic text-base-content/50">
                A descrição completa desta vaga está disponível diretamente no portal oficial da empresa.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="p-5 border-t border-base-200 bg-base-200/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShareWhatsApp}
              className="gap-1.5 text-success hover:bg-success/10"
            >
              <span>WhatsApp</span>
            </Button>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm gap-2"
            >
              <span>Candidatar-se na {job.source}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
