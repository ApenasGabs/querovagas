import { useCallback, useEffect, useRef, useState } from "react";
import { getJobDataSource } from "../../../services";
import type { Job, JobFilterParams, JobStats, SeniorityLevel, WorkModel } from "../../../types/job";

export interface UseJobsReturn {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  selectedJob: Job | null;
  stats: JobStats | null;
  popularStacks: string[];
  search: string;
  seniority: SeniorityLevel | "ALL";
  workModel: WorkModel | "ALL";
  location: string | "ALL";
  stack: string;
  setSearch: (search: string) => void;
  setSeniority: (seniority: SeniorityLevel | "ALL") => void;
  setWorkModel: (model: WorkModel | "ALL") => void;
  setLocation: (location: string) => void;
  setStack: (stack: string) => void;
  setPage: (page: number) => void;
  selectJob: (job: Job | null) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

export function useJobs(pageSize = 12): UseJobsReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [popularStacks, setPopularStacks] = useState<string[]>([]);

  // Filtros (default: São Paulo e Região)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [seniority, setSeniority] = useState<SeniorityLevel | "ALL">("ALL");
  const [workModel, setWorkModel] = useState<WorkModel | "ALL">("ALL");
  const [location, setLocation] = useState<string>("SP_REGION");
  const [stack, setStack] = useState("");

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce na busca textual
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Volta para página 1 ao pesquisar
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  // Reset de página ao alterar filtros
  const handleSeniorityChange = useCallback((s: SeniorityLevel | "ALL") => {
    setSeniority(s);
    setPage(1);
  }, []);

  const handleWorkModelChange = useCallback((m: WorkModel | "ALL") => {
    setWorkModel(m);
    setPage(1);
  }, []);

  const handleLocationChange = useCallback((loc: string) => {
    setLocation(loc);
    setPage(1);
  }, []);

  const handleStackChange = useCallback((st: string) => {
    setStack(st);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setSeniority("ALL");
    setWorkModel("ALL");
    setLocation("SP_REGION");
    setStack("");
    setPage(1);
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dataSource = getJobDataSource();
      const params: JobFilterParams = {
        search: debouncedSearch,
        seniority,
        workModel,
        location,
        stack,
        page,
        pageSize,
      };

      const result = await dataSource.getJobs(params);
      setJobs(result.jobs);
      setTotal(result.total);
      setTotalPages(result.totalPages);

      // Carrega stats e stacks populares na primeira carga
      if (!stats) {
        const statsData = await dataSource.getStats();
        setStats(statsData);
      }

      if (popularStacks.length === 0 && dataSource.getPopularStacks) {
        const stacks = await dataSource.getPopularStacks();
        setPopularStacks(stacks);
      }
    } catch (err: any) {
      console.error("[useJobs] Erro ao carregar vagas:", err);
      setError(err?.message || "Não foi possível carregar as vagas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, seniority, workModel, location, stack, page, pageSize, stats, popularStacks.length]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    selectedJob,
    stats,
    popularStacks,
    search,
    seniority,
    workModel,
    location,
    stack,
    setSearch,
    setSeniority: handleSeniorityChange,
    setWorkModel: handleWorkModelChange,
    setLocation: handleLocationChange,
    setStack: handleStackChange,
    setPage,
    selectJob: setSelectedJob,
    clearFilters,
    refresh: fetchJobs,
  };
}
