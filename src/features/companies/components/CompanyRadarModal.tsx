import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Flame,
  MessageSquare,
  PlusCircle,
  Radar,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Company } from "../../../types/company";
import { companyService } from "../../../services/companyService";
import { CommunityDiscussions } from "./CommunityDiscussions";
import { CompanyCard } from "./CompanyCard";
import { CompanySuggestionForm, RETURN_TAB_KEY } from "./CompanySuggestionForm";
import type { UserProfile } from "../../../services/trustAuthService";

type TabType = "search" | "suggest" | "community" | "devpedia";

interface CompanyRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCompanyForSearch?: (companyName: string) => void;
  initialSearchQuery?: string;
  inline?: boolean;
  defaultTab?: TabType;
  defaultSuggestedBy?: string;
  user?: UserProfile | null;
  onLogin?: () => void;
}

export function CompanyRadarModal({
  isOpen,
  onClose,
  onSelectCompanyForSearch,
  initialSearchQuery = "",
  inline = false,
  defaultTab,
  defaultSuggestedBy = "",
  user,
  onLogin,
}: CompanyRadarModalProps): ReactElement | null {
  const getInitialTab = (): TabType => {
    if (defaultTab) return defaultTab;
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (sessionStorage.getItem(RETURN_TAB_KEY) === "suggest") {
        return "suggest";
      }
    }
    return "search";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchTerm, setSearchTerm] = useState(initialSearchQuery);
  const [selectedATS, setSelectedATS] = useState<string>("ALL");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefilledName, setPrefilledName] = useState("");
  const [votedCompanies, setVotedCompanies] = useState<Record<string, boolean>>({});

  // Sincroniza busca inicial se fornecida via props sem cascading renders
  const [prevQuery, setPrevQuery] = useState(initialSearchQuery);
  if (initialSearchQuery !== prevQuery) {
    setPrevQuery(initialSearchQuery);
    setSearchTerm(initialSearchQuery);
  }

  // Carrega empresas ao abrir ou montar inline
  useEffect(() => {
    if (!isOpen && !inline) return;

    let isMounted = true;

    const loadCompanies = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await companyService.getCompanies();
        if (isMounted) {
          setCompanies(data);
          const votesMap: Record<string, boolean> = {};
          for (const c of data) {
            if (companyService.hasUserVoted(c.id)) {
              votesMap[c.id] = true;
            }
          }
          setVotedCompanies(votesMap);
        }
      } catch (err) {
        console.error("Falha ao carregar empresas:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadCompanies();

    return () => {
      isMounted = false;
    };
  }, [isOpen, inline]);

  // Filtra as empresas na aba de busca
  const filteredCompanies = useMemo(() => {
    let result = companies;

    if (selectedATS !== "ALL") {
      result = result.filter((c) => c.ats?.toUpperCase() === selectedATS.toUpperCase());
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q) ||
          (c.careerUrl && c.careerUrl.toLowerCase().includes(q)) ||
          c.ats?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [companies, searchTerm, selectedATS]);

  // Identifica se há correspondência exata de empresa monitorada
  const exactMatch = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const clean = searchTerm.trim().toLowerCase();
    const cleanSlug = clean.replace(/[^a-z0-9]/g, "");
    return (
      companies.find(
        (c) =>
          c.name.toLowerCase() === clean ||
          c.slug.replace(/[^a-z0-9]/g, "") === cleanSlug,
      ) || null
    );
  }, [companies, searchTerm]);

  // Lista de empresas sugeridas pela comunidade
  const communitySuggestions = useMemo(() => {
    return companies
      .filter((c) => c.status === "SUGGESTED")
      .sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));
  }, [companies]);

  // Total de empresas monitoradas ativas
  const monitoredTotalCount = useMemo(() => {
    return companies.filter((c) => c.status === "MONITORED").length;
  }, [companies]);

  const handleUpvote = async (companyId: string): Promise<void> => {
    const updatedCount = await companyService.upvoteSuggestion(companyId);
    if (updatedCount >= 0) {
      setVotedCompanies((prev) => ({ ...prev, [companyId]: true }));
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, votesCount: updatedCount } : c)),
      );
    }
  };

  const handleSuggestSuccess = (newCompany: Company): void => {
    setCompanies((prev) => [newCompany, ...prev]);
    setActiveTab("community");
  };

  const handleStartSuggestionForQuery = (): void => {
    setPrefilledName(searchTerm.trim());
    setActiveTab("suggest");
  };

  const handleViewJobs = (companyName: string): void => {
    onClose();
    if (onSelectCompanyForSearch) {
      onSelectCompanyForSearch(companyName);
    }
  };

  if (!isOpen && !inline) return null;

  const content = (
      <div
        className={
          inline
            ? "bg-base-200 text-base-content rounded-3xl border border-base-300 shadow-xs w-full flex flex-col overflow-hidden"
            : "bg-base-200 text-base-content rounded-3xl border border-base-300 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        }
      >
        {/* Topo do Painel */}
        <div className="p-4 sm:p-6 bg-base-100 border-b border-base-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Radar className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-base-content">
                  Radar de Empresas & Comunidade
                </h2>
                <span className="badge badge-primary badge-sm font-semibold">
                  {monitoredTotalCount} monitoradas
                </span>
              </div>
              <p className="text-xs text-base-content/60 truncate">
                Pesquise empresas catalogadas, veja status do crawler ou sugira novas fontes.
              </p>
            </div>
          </div>

          {!inline && (
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Abas de Navegação */}
        <div className="bg-base-100 px-4 sm:px-6 border-b border-base-300">
          <div className="tabs tabs-bordered -mb-px flex-nowrap overflow-x-auto text-xs sm:text-sm">
            <button
              className={`tab tab-bordered gap-2 font-bold shrink-0 ${
                activeTab === "search" ? "tab-active !border-primary text-primary" : ""
              }`}
              onClick={() => setActiveTab("search")}
            >
              <Search className="w-4 h-4" />
              <span>Pesquisar Empresas</span>
            </button>

            <button
              className={`tab tab-bordered gap-2 font-bold shrink-0 ${
                activeTab === "suggest" ? "tab-active !border-primary text-primary" : ""
              }`}
              onClick={() => {
                setPrefilledName("");
                setActiveTab("suggest");
              }}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sugerir Empresa</span>
            </button>

            <button
              className={`tab tab-bordered gap-2 font-bold shrink-0 ${
                activeTab === "community" ? "tab-active !border-primary text-primary" : ""
              }`}
              onClick={() => setActiveTab("community")}
            >
              <Users className="w-4 h-4" />
              <span>Mural Comunitário</span>
              {communitySuggestions.length > 0 && (
                <span className="badge badge-xs badge-neutral">
                  {communitySuggestions.length}
                </span>
              )}
            </button>

            <button
              className={`tab tab-bordered gap-2 font-bold shrink-0 ${
                activeTab === "devpedia" ? "tab-active !border-primary text-primary" : ""
              }`}
              onClick={() => setActiveTab("devpedia")}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Discussões (DevPedia)</span>
            </button>
          </div>
        </div>

        {/* Corpo do Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ABA 1: PESQUISAR EMPRESAS */}
          {activeTab === "search" && (
            <div className="space-y-6">
              {/* Barra de Busca & Filtros Rápidos de ATS */}
              <div className="bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-300 space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-base-content/40">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full pl-11 pr-10 text-sm"
                    placeholder="Digite o nome de uma empresa (ex: Nubank, Sicredi, Cielo, Boticário)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/40 hover:text-base-content"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filtro por ATS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-base-content/60 font-semibold mr-1 shrink-0">ATS:</span>
                  {[
                    { id: "ALL", label: "Todas" },
                    { id: "GUPY", label: "Gupy" },
                    { id: "ASHBY", label: "Ashby" },
                    { id: "GREENHOUSE", label: "Greenhouse" },
                    { id: "LEVER", label: "Lever" },
                    { id: "WORKABLE", label: "Workable" },
                    { id: "INHIRE", label: "InHire" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedATS(filter.id)}
                      className={`btn btn-xs rounded-lg ${
                        selectedATS === filter.id ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status da Busca em Destaque: Encontrada vs Não Encontrada */}
              {searchTerm.trim() && (
                <div>
                  {exactMatch ? (
                    <div className="alert alert-success/15 border border-success/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-success/20 text-success flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-base-content">
                            &ldquo;{exactMatch.name}&rdquo; já está sendo monitorada!
                          </h4>
                          <p className="text-xs text-base-content/70">
                            Plataforma: <strong>{exactMatch.ats}</strong>
                            {onSelectCompanyForSearch && exactMatch.activeJobsCount
                              ? ` • ${exactMatch.activeJobsCount} vagas abertas no momento`
                              : " • Ciclo de varredura automático ativo"}
                          </p>
                        </div>
                      </div>

                      {onSelectCompanyForSearch && (
                        <button
                          onClick={() => handleViewJobs(exactMatch.name)}
                          className="btn btn-sm btn-success text-success-content gap-1.5 shrink-0"
                        >
                          <Flame className="w-4 h-4" />
                          <span>Ver Vagas Abertas</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-warning/15 border border-warning/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-warning/20 text-warning flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-base-content">
                            A empresa &ldquo;{searchTerm.trim()}&rdquo; ainda não está sendo monitorada
                          </h4>
                          <p className="text-xs text-base-content/70">
                            Você tem o link de carreiras ou vagas dela? Indique para a comunidade e
                            ajude a trazê-la para o robô!
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleStartSuggestionForQuery}
                        className="btn btn-sm btn-warning text-warning-content gap-1.5 shrink-0"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Sugerir &ldquo;{searchTerm.trim()}&rdquo;</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Grid de Resultados */}
              {loading ? (
                <div className="p-12 text-center space-y-3">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <p className="text-xs text-base-content/60">Carregando catálogo de empresas...</p>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="p-10 text-center bg-base-100 rounded-2xl border border-base-300 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mx-auto text-base-content/40">
                    <Search className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-base-content">
                      Nenhuma empresa correspondente encontrada
                    </h4>
                    <p className="text-xs text-base-content/60 max-w-md mx-auto">
                      Não encontramos nenhuma empresa com esses termos. Seja o primeiro a indicá-la
                      para que nosso crawler comece o monitoramento!
                    </p>
                  </div>
                  <button
                    onClick={handleStartSuggestionForQuery}
                    className="btn btn-sm btn-primary gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Cadastrar Sugestão Agora</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-base-content/60 px-1">
                    <span>
                      Mostrando <strong>{filteredCompanies.length}</strong> empresas
                    </span>
                    {selectedATS !== "ALL" && (
                      <button
                        onClick={() => setSelectedATS("ALL")}
                        className="link link-primary text-xs"
                      >
                        Limpar filtro de ATS
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCompanies.map((c) => (
                      <CompanyCard
                        key={c.id || c.slug}
                        company={c}
                        hasVoted={Boolean(votedCompanies[c.id])}
                        onUpvote={handleUpvote}
                        onViewJobs={onSelectCompanyForSearch ? handleViewJobs : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: SUGERIR EMPRESA */}
          {activeTab === "suggest" && (
            <CompanySuggestionForm
              initialName={prefilledName}
              defaultSuggestedBy={user?.username ? `@${user.username}` : defaultSuggestedBy}
              user={user}
              onLogin={onLogin}
              onSuccess={handleSuggestSuccess}
              onCancel={() => setActiveTab("search")}
            />
          )}

          {/* ABA 3: MURAL DA COMUNIDADE */}
          {activeTab === "community" && (
            <div className="space-y-6">
              <div className="bg-base-100 p-5 sm:p-6 rounded-2xl border border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Users className="w-4 h-4" />
                    <span>Mural Colaborativo</span>
                  </div>
                  <h3 className="text-lg font-bold text-base-content">
                    Empresas Indicadas pela Comunidade
                  </h3>
                  <p className="text-xs text-base-content/60">
                    Vote nas empresas que você mais quer ver no crawler do QueroVagas. As mais
                    votadas recebem prioridade de indexação!
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab("suggest")}
                  className="btn btn-sm btn-primary gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Indicar Outra Empresa</span>
                </button>
              </div>

              {communitySuggestions.length === 0 ? (
                <div className="p-10 text-center bg-base-100 rounded-2xl border border-base-300 space-y-3">
                  <Sparkles className="w-8 h-8 text-warning mx-auto" />
                  <h4 className="text-base font-bold text-base-content">
                    Nenhuma empresa sugerida no momento
                  </h4>
                  <p className="text-xs text-base-content/60 max-w-md mx-auto">
                    Conhece alguma empresa que ainda não monitoramos? Seja o primeiro a sugerir!
                  </p>
                  <button
                    onClick={() => setActiveTab("suggest")}
                    className="btn btn-sm btn-primary"
                  >
                    Fazer Primeira Indicação
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {communitySuggestions.map((c) => (
                    <CompanyCard
                      key={c.id}
                      company={c}
                      hasVoted={Boolean(votedCompanies[c.id])}
                      onUpvote={handleUpvote}
                      onViewJobs={onSelectCompanyForSearch ? handleViewJobs : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 4: DISCUSSÕES (DEVPEDIA) */}
          {activeTab === "devpedia" && <CommunityDiscussions />}
        </div>
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {content}
    </div>
  );
}
