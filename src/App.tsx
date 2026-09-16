import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Navbar } from "./components/Navbar/Navbar";
import { Footer } from "./components/Footer/Footer";
import ThemeSelector from "./components/ThemeSelector/ThemeSelector";
import { Badge } from "./components/Badge/Badge";
import { Button } from "./components/Button/Button";
import { Alert } from "./components/Alert/Alert";
import { useJobs } from "./features/jobs/hooks/useJobs";
import { JobCard } from "./features/jobs/components/JobCard";
import { JobFilters } from "./features/jobs/components/JobFilters";
import { JobModal } from "./features/jobs/components/JobModal";
import { JobStatsBanner } from "./features/jobs/components/JobStatsBanner";
import { JobSkeleton } from "./features/jobs/components/JobSkeleton";

export default function App() {
  const {
    jobs,
    total,
    page,
    totalPages,
    loading,
    error,
    selectedJob,
    stats,
    popularStacks,
    search,
    seniority,
    workModel,
    stack,
    setSearch,
    setSeniority,
    setWorkModel,
    setStack,
    setPage,
    selectJob,
    clearFilters,
    refresh,
  } = useJobs(12);

  // Link opcional para o Canal de transmissão do WhatsApp (Broadcast aberto)
  const whatsappChannelUrl = import.meta.env.VITE_WHATSAPP_CHANNEL_URL || "";

  return (
    <div className="min-h-screen flex flex-col bg-base-200/50 text-base-content selection:bg-primary selection:text-primary-content">
      {/* Topbar / Navbar */}
      <Navbar title="">
        <div className="flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={clearFilters}>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-content shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-base-content">
                Quero<span className="text-primary">Vagas</span>
              </span>
              <Badge variant="accent" size="sm" className="hidden sm:inline-flex font-mono text-[10px]">
                TECH ONLY
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {whatsappChannelUrl && (
              <a
                href={whatsappChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-ghost gap-1.5 text-success hover:bg-success/10 hidden md:inline-flex"
                title="Receba alertas de novas vagas em nosso canal de transmissão oficial"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Canal no WhatsApp</span>
              </a>
            )}

            <ThemeSelector />
          </div>
        </div>
      </Navbar>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto pt-2 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vagas atualizadas e filtradas para desenvolvedores e TI</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-base-content">
            Sua próxima oportunidade em{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Tecnologia
            </span>
          </h1>
          <p className="text-sm md:text-base text-base-content/70">
            Acompanhe oportunidades de estágio, júnior, pleno e sênior coletadas diretamente das principais
            plataformas (Gupy, Ashby, InHire, Lever e mais), 100% filtradas contra ruído.
          </p>
        </div>

        {/* Banner de Estatísticas Resumidas */}
        <JobStatsBanner stats={stats} />

        {/* Barra de Busca & Filtros Dinâmicos */}
        <JobFilters
          search={search}
          onSearchChange={setSearch}
          seniority={seniority}
          onSeniorityChange={setSeniority}
          workModel={workModel}
          onWorkModelChange={setWorkModel}
          stack={stack}
          onStackChange={setStack}
          popularStacks={popularStacks}
          totalResults={total}
          onClear={clearFilters}
        />

        {/* Estado de Erro */}
        {error && (
          <div className="my-6">
            <Alert type="error">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refresh()}>
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          </div>
        )}

        {/* Grid de Vagas ou Skeleton de Carregamento */}
        {loading ? (
          <JobSkeleton />
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center bg-base-100 rounded-2xl border border-base-300 space-y-4 my-8">
            <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/40">
              <Briefcase className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-base-content">
                Nenhuma vaga encontrada
              </h3>
              <p className="text-sm text-base-content/60 max-w-md mx-auto">
                Não encontramos vagas correspondentes aos filtros selecionados. Tente ajustar os termos de busca ou remover alguns filtros.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={clearFilters}>
              Limpar todos os filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onSelect={selectJob} />
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-base-300">
                <span className="text-xs text-base-content/60">
                  Mostrando página <strong className="text-base-content">{page}</strong> de{" "}
                  <strong className="text-base-content">{totalPages}</strong> ({total} vagas no total)
                </span>

                <div className="join">
                  <button
                    className="join-item btn btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button className="join-item btn btn-sm btn-active font-mono">
                    {page}
                  </button>
                  <button
                    className="join-item btn btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Detalhes da Vaga */}
      <JobModal job={selectedJob} onClose={() => selectJob(null)} />

      {/* Rodapé da Aplicação */}
      <Footer />
    </div>
  );
}
