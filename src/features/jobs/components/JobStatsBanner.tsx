import { Briefcase, Building2, Globe, GraduationCap } from "lucide-react";
import type { JobStats } from "../../../types/job";

interface JobStatsBannerProps {
  stats: JobStats | null;
}

export const JobStatsBanner = ({ stats }: JobStatsBannerProps) => {
  if (!stats) return null;

  const remoteCount = stats.byModel["REMOTO"] || 0;
  const juniorAndInternCount =
    (stats.bySeniority["JUNIOR"] || 0) + (stats.bySeniority["ESTAGIO"] || 0);
  const totalSources = Object.keys(stats.bySource || {}).length || 10;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 my-6">
      <div className="stat bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs">
        <div className="stat-figure text-primary">
          <Briefcase className="w-7 h-7" />
        </div>
        <div className="stat-title text-xs font-medium text-base-content/60">Vagas de TI Ativas</div>
        <div className="stat-value text-2xl md:text-3xl text-primary font-bold">{stats.totalJobs}</div>
        <div className="stat-desc text-[11px] text-base-content/50">100% filtradas por IA</div>
      </div>

      <div className="stat bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs">
        <div className="stat-figure text-success">
          <Globe className="w-7 h-7" />
        </div>
        <div className="stat-title text-xs font-medium text-base-content/60">100% Remotas</div>
        <div className="stat-value text-2xl md:text-3xl text-success font-bold">{remoteCount}</div>
        <div className="stat-desc text-[11px] text-base-content/50">Trabalhe de qualquer lugar</div>
      </div>

      <div className="stat bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs">
        <div className="stat-figure text-secondary">
          <GraduationCap className="w-7 h-7" />
        </div>
        <div className="stat-title text-xs font-medium text-base-content/60">Estágio & Júnior</div>
        <div className="stat-value text-2xl md:text-3xl text-secondary font-bold">{juniorAndInternCount}</div>
        <div className="stat-desc text-[11px] text-base-content/50">Início e aceleração de carreira</div>
      </div>

      <div className="stat bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs">
        <div className="stat-figure text-accent">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="stat-title text-xs font-medium text-base-content/60">Plataformas ATS</div>
        <div className="stat-value text-2xl md:text-3xl text-accent font-bold">{totalSources}</div>
        <div className="stat-desc text-[11px] text-base-content/50">Gupy, Ashby, InHire, Lever...</div>
      </div>
    </div>
  );
};
