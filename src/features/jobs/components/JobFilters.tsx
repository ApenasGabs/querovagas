import { Filter, MapPin, RotateCcw, Search, Sparkles } from "lucide-react";
import type { SeniorityLevel, WorkModel } from "../../../types/job";
import { Button } from "../../../components/Button/Button";

interface JobFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  seniority: SeniorityLevel | "ALL";
  onSeniorityChange: (val: SeniorityLevel | "ALL") => void;
  workModel: WorkModel | "ALL";
  onWorkModelChange: (val: WorkModel | "ALL") => void;
  location: string;
  onLocationChange: (val: string) => void;
  stack: string;
  onStackChange: (val: string) => void;
  popularStacks: string[];
  totalResults: number;
  onClear: () => void;
}

const LOCATION_OPTIONS: { label: string; value: string }[] = [
  { label: "📍 São Paulo e Região (inclui Campinas)", value: "SP_REGION" },
  { label: "🌐 Todas as localidades", value: "ALL" },
  { label: "🇧🇷 Brasil (Geral)", value: "BRASIL" },
];

const SENIORITY_OPTIONS: { label: string; value: SeniorityLevel | "ALL" }[] = [
  { label: "Todos os níveis", value: "ALL" },
  { label: "🎓 Estágio", value: "ESTAGIO" },
  { label: "🌱 Júnior", value: "JUNIOR" },
  { label: "🚀 Pleno", value: "PLENO" },
  { label: "💎 Sênior", value: "SENIOR" },
  { label: "👑 Especialista", value: "ESPECIALISTA" },
];

const WORK_MODEL_OPTIONS: { label: string; value: WorkModel | "ALL" }[] = [
  { label: "Todas modalidades", value: "ALL" },
  { label: "🌐 100% Remoto", value: "REMOTO" },
  { label: "🏢 Híbrido", value: "HIBRIDO" },
  { label: "📍 Presencial", value: "PRESENCIAL" },
];

export const JobFilters = ({
  search,
  onSearchChange,
  seniority,
  onSeniorityChange,
  workModel,
  onWorkModelChange,
  location,
  onLocationChange,
  stack,
  onStackChange,
  popularStacks,
  totalResults,
  onClear,
}: JobFiltersProps) => {
  const hasActiveFilters =
    search.trim().length > 0 ||
    seniority !== "ALL" ||
    workModel !== "ALL" ||
    location !== "SP_REGION" ||
    stack.trim().length > 0;

  return (
    <div className="space-y-4 p-5 md:p-6 rounded-2xl bg-base-100 border border-base-300 shadow-sm">
      {/* Barra de Busca Principal */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por cargo, empresa, tecnologia (ex: React, Node, Python)..."
            className="input input-bordered w-full pl-11 pr-4 py-2.5 text-sm rounded-xl focus:outline-primary"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1.5 text-base-content/60 hover:text-error shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Limpar filtros</span>
          </Button>
        )}
      </div>

      {/* Pílulas de Filtro de Senioridade */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-base-content/70">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Nível de Experiência
          </span>
          <span className="text-base-content/50 font-normal font-mono">
            {totalResults} {totalResults === 1 ? "vaga encontrada" : "vagas encontradas"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SENIORITY_OPTIONS.map((opt) => {
            const active = seniority === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSeniorityChange(opt.value)}
                className={`btn btn-xs md:btn-sm rounded-lg transition-all ${
                  active
                    ? "btn-primary shadow-xs"
                    : "btn-ghost bg-base-200/80 hover:bg-base-200 text-base-content/80"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pílulas de Filtro de Localidade */}
      <div className="space-y-2 pt-1 border-t border-base-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70">
          <MapPin className="w-3.5 h-3.5" />
          <span>Localidade</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCATION_OPTIONS.map((opt) => {
            const active = location === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onLocationChange(opt.value)}
                className={`btn btn-xs md:btn-sm rounded-lg transition-all ${
                  active
                    ? "btn-primary shadow-xs"
                    : "btn-ghost bg-base-200/80 hover:bg-base-200 text-base-content/80"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pílulas de Filtro de Modalidade */}
      <div className="space-y-2 pt-1 border-t border-base-200">
        <div className="text-xs font-semibold text-base-content/70">
          Modalidade de Trabalho
        </div>
        <div className="flex flex-wrap gap-2">
          {WORK_MODEL_OPTIONS.map((opt) => {
            const active = workModel === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onWorkModelChange(opt.value)}
                className={`btn btn-xs md:btn-sm rounded-lg transition-all ${
                  active
                    ? "btn-primary shadow-xs"
                    : "btn-ghost bg-base-200/80 hover:bg-base-200 text-base-content/80"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stacks Populares em Destaque */}
      {popularStacks.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-base-200">
          <div className="flex items-center gap-1 text-xs font-semibold text-base-content/70">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Tecnologias Populares</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {popularStacks.map((st) => {
              const active = stack.toLowerCase() === st.toLowerCase();
              return (
                <button
                  key={st}
                  onClick={() => onStackChange(active ? "" : st)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all font-medium ${
                    active
                      ? "bg-accent text-accent-content font-bold shadow-xs"
                      : "bg-base-200 hover:bg-base-300 text-base-content/70"
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
