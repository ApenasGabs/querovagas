import type { LucideIcon } from "lucide-react";
import { Briefcase, Building2, Globe, GraduationCap } from "lucide-react";
import type { ReactElement } from "react";
import type { JobStats } from "../../../types/job";

interface JobStatsBannerProps {
  stats: JobStats | null;
}

interface StatItem {
  id: string;
  title: string;
  value: number;
  description: string;
  colorClass: string;
  Icon: LucideIcon;
}

export const JobStatsBanner = ({ stats }: JobStatsBannerProps): ReactElement | null => {
  if (!stats) return null;

  const remoteCount = stats.byModel["REMOTO"] || 0;
  const juniorAndInternCount =
    (stats.bySeniority["JUNIOR"] || 0) + (stats.bySeniority["ESTAGIO"] || 0);
  const totalSources = Object.keys(stats.bySource || {}).length || 10;

  const statItems: StatItem[] = [
    {
      id: "active-jobs",
      title: "Vagas de TI Ativas",
      value: stats.totalJobs,
      description: "100% filtradas por IA",
      colorClass: "text-primary",
      Icon: Briefcase,
    },
    {
      id: "remote-jobs",
      title: "100% Remotas",
      value: remoteCount,
      description: "Trabalhe de qualquer lugar",
      colorClass: "text-success",
      Icon: Globe,
    },
    {
      id: "junior-intern-jobs",
      title: "Estágio & Júnior",
      value: juniorAndInternCount,
      description: "Início e aceleração de carreira",
      colorClass: "text-secondary",
      Icon: GraduationCap,
    },
    {
      id: "ats-sources",
      title: "Plataformas ATS",
      value: totalSources,
      description: "Gupy, Ashby, InHire, Lever...",
      colorClass: "text-accent",
      Icon: Building2,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 my-6"
      data-testid="job-stats-banner"
    >
      {statItems.map(({ id, title, value, description, colorClass, Icon }) => (
        <div
          key={id}
          className="stat bg-base-100 border border-base-300 rounded-2xl p-3 sm:p-4 shadow-xs min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 sm:gap-x-4"
          data-testid={`job-stat-${id}`}
        >
          <div className={`stat-figure ${colorClass}`}>
            <Icon className="w-5 h-5 sm:w-7 sm:h-7" aria-hidden="true" />
          </div>
          <div className="stat-title whitespace-normal leading-tight text-xs font-medium text-base-content/60">
            {title}
          </div>
          <div className={`stat-value text-xl sm:text-2xl md:text-3xl ${colorClass} font-bold`}>
            {value}
          </div>
          <div className="stat-desc whitespace-normal leading-snug text-[11px] text-base-content/50">
            {description}
          </div>
        </div>
      ))}
    </div>
  );
};
