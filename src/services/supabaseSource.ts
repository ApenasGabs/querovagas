import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type {
  ContractType,
  Job,
  JobFilterParams,
  JobStats,
  PaginatedJobs,
  SeniorityLevel,
  WorkModel,
} from "../types/job";
import type { IJobDataSource } from "./dataSource.interface";
import { CITY_QUERY_MAP, UF_QUERY_MAP } from "./locationConstants";
import { getStoredTrustToken } from "./trustAuthService";

interface RawJobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  work_model?: WorkModel;
  workModel?: WorkModel;
  salary?: string;
  contract_type?: ContractType;
  contractType?: ContractType;
  seniority_level?: SeniorityLevel;
  seniorityLevel?: SeniorityLevel;
  url: string;
  source: string;
  stack?: string[];
  scraped_at?: string;
  scrapedAt?: string;
  description?: string;
  is_tech?: boolean;
}

export class SupabaseJobDataSource implements IJobDataSource {
  private client: SupabaseClient | null = null;
  private tableName = "jobs";
  private isProxy = false;
  private baseUrl = "/api";

  constructor(url?: string, anonKey?: string) {
    // When no URL is provided, or a relative path is given, route through the Express Parser API
    if (url && url.startsWith("http") && !url.includes("/api")) {
      this.client = createClient(url, anonKey || "public-client-token");
    } else {
      this.isProxy = true;
      if (url) {
        this.baseUrl = url.replace(/\/$/, "");
      }
    }
  }

  private getFallbackClient(): SupabaseClient {
    if (!this.client) {
      const targetBase =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
        "https://gglsmwtyrwadwxyvevmr.supabase.co";
      const anonKey =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbHNtd3R5cndhZHd4eXZldm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTI1MDIsImV4cCI6MjEwNTA4ODUwMn0.jSRnLVyzCse-Q1xiQ3--BwU4knRDvDSiaZpLEcY38bY";
      this.client = createClient(targetBase, anonKey);
    }
    return this.client;
  }

  public isConfigured(): boolean {
    return true;
  }

  public getJobs = async (params: JobFilterParams = {}): Promise<PaginatedJobs> => {
    if (this.isProxy) {
      try {
        const trustToken = getStoredTrustToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (trustToken) {
          headers["x-trust-token"] = trustToken;
        }

        const res = await fetch(`${this.baseUrl}/jobs`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (res.ok) {
          const data = (await res.json()) as PaginatedJobs;
          return data;
        }

        if (res.status === 401 || res.status === 403) {
          return {
            jobs: [],
            total: 0,
            page: params.page || 1,
            pageSize: params.pageSize || 12,
            totalPages: 0,
          };
        }

        console.warn(
          `[SupabaseJobDataSource] Proxy retornou HTTP ${res.status}. Ativando fallback resiliente direto.`,
        );
      } catch (err) {
        console.warn(
          "[SupabaseJobDataSource] Falha na chamada proxy. Ativando fallback resiliente direto:",
          err,
        );
      }
    }

    // Se não há token de autorização, bloqueia fallback direto para manter a blindagem
    const trustToken = getStoredTrustToken();
    if (!trustToken) {
      return {
        jobs: [],
        total: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 12,
        totalPages: 0,
      };
    }

    const client = this.getFallbackClient();

    const {
      search = "",
      seniority = "ALL",
      workModel = "ALL",
      location = "ALL",
      source = "ALL",
      page = 1,
      pageSize = 12,
    } = params;

    let query = client
      .from(this.tableName)
      .select("*", { count: "exact" })
      .eq("is_tech", true);

    if (search.trim()) {
      const q = search.trim().replace(/[,()"]/g, " ").trim();
      if (q) {
        query = query.or(
          `title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`,
        );
      }
    }

    if (seniority && seniority !== "ALL") {
      query = query.eq("seniority_level", seniority);
    }

    if (workModel && workModel !== "ALL") {
      query = query.eq("work_model", workModel);
    }

    if (location === "SP_REGION") {
      query = query
        .or(
          'location.ilike."*São Paulo*",location.ilike."*Sao Paulo*",location.ilike."*Campinas*",location.ilike."*, SP*",location.ilike."*- SP*",location.ilike."*/SP*",location.ilike."*Barueri*",location.ilike."*Osasco*",location.ilike."*Santo André*",location.ilike."*São Bernardo*",location.ilike."*São Caetano*",location.ilike."*Sorocaba*",location.ilike."*Jundiaí*",location.ilike."*Ribeirão Preto*",location.ilike."*São Carlos*",location.ilike."*Indaiatuba*",location.ilike."*Hortolândia*",location.ilike."*Valinhos*",location.ilike."*Vinhedo*",location.ilike."*Alphaville*",location.ilike."*Guarulhos*",location.ilike."*Santos*"',
        )
        .not("location", "ilike", "%Spain%");
    } else if (location === "BRASIL") {
      query = query
        .or(
          'location.ilike."*Brasil*",location.ilike."*Brazil*",location.ilike."*, BR*",location.ilike."*São Paulo*",location.ilike."*Campinas*"',
        )
        .not("location", "ilike", "%Spain%");
    } else if (location === "INTERNACIONAL") {
      query = query
        .not("location", "ilike", "%Brasil%")
        .not("location", "ilike", "%Brazil%")
        .not("location", "ilike", "%, BR%")
        .not("location", "ilike", "%São Paulo%")
        .not("location", "ilike", "%Campinas%");
    } else if (location.startsWith("CITY_") && CITY_QUERY_MAP[location]) {
      const patterns = CITY_QUERY_MAP[location]
        .map((p) => `location.ilike."${p}"`)
        .join(",");
      query = query.or(patterns);
    } else if (location.startsWith("UF_") && UF_QUERY_MAP[location]) {
      const { uf, names } = UF_QUERY_MAP[location];
      const patterns = [
        `location.ilike."*, ${uf}*"`,
        `location.ilike."*- ${uf}*"`,
        `location.ilike."*/${uf}*"`,
        `location.ilike."*${uf},*"`,
        ...names.map((n) => `location.ilike."${n}"`),
      ].join(",");
      query = query.or(patterns);
      if (uf === "SP") {
        query = query.not("location", "ilike", "%Spain%");
      }
    } else if (location && location !== "ALL") {
      query = query.ilike("location", `%${location}%`);
    }

    if (source && source !== "ALL") {
      query = query.eq("source", source);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("scraped_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("[SupabaseJobDataSource] Erro ao buscar vagas:", error);
      throw error;
    }

    const rawJobs = (data as unknown as RawJobRow[]) || [];
    const jobs: Job[] = rawJobs.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      workModel: (row.work_model || row.workModel || "NAO_INFORMADO") as WorkModel,
      salary: row.salary || undefined,
      contractType: (row.contract_type || row.contractType || "CLT") as ContractType,
      seniorityLevel: (row.seniority_level || row.seniorityLevel || "NAO_INFORMADO") as SeniorityLevel,
      url: row.url,
      source: row.source,
      stack: Array.isArray(row.stack) ? row.stack : [],
      scrapedAt: row.scraped_at || row.scrapedAt || new Date().toISOString(),
      description: row.description || undefined,
      isTech: row.is_tech ?? true,
    }));

    const total = count || jobs.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      jobs,
      total,
      page,
      pageSize,
      totalPages,
    };
  };

  public getJobById = async (id: string): Promise<Job | null> => {
    if (this.isProxy) {
      try {
        const trustToken = getStoredTrustToken();
        const headers: Record<string, string> = {};
        if (trustToken) {
          headers["x-trust-token"] = trustToken;
        }

        const res = await fetch(`${this.baseUrl}/jobs/${id}`, { headers });
        if (res.ok) {
          return (await res.json()) as Job;
        }

        if (res.status === 401 || res.status === 403) {
          return null;
        }
      } catch (err) {
        console.warn("[SupabaseJobDataSource] Falha proxy getJobById. Usando fallback direto:", err);
      }
    }

    const trustToken = getStoredTrustToken();
    if (!trustToken) {
      return null;
    }

    const client = this.getFallbackClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const raw = data as unknown as RawJobRow;
    return {
      id: raw.id,
      title: raw.title,
      company: raw.company,
      location: raw.location,
      workModel: (raw.work_model || raw.workModel || "NAO_INFORMADO") as WorkModel,
      salary: raw.salary || undefined,
      contractType: (raw.contract_type || raw.contractType || "CLT") as ContractType,
      seniorityLevel: (raw.seniority_level || raw.seniorityLevel || "NAO_INFORMADO") as SeniorityLevel,
      url: raw.url,
      source: raw.source,
      stack: Array.isArray(raw.stack) ? raw.stack : [],
      scrapedAt: raw.scraped_at || raw.scrapedAt || new Date().toISOString(),
      description: raw.description || undefined,
      isTech: raw.is_tech ?? true,
    };
  };

  public getStats = async (): Promise<JobStats> => {
    if (this.isProxy) {
      try {
        const res = await fetch(`${this.baseUrl}/jobs/stats`);
        if (res.ok) {
          return (await res.json()) as JobStats;
        }
      } catch (err) {
        console.warn("[SupabaseJobDataSource] Falha proxy getStats. Usando fallback direto:", err);
      }
    }

    const client = this.getFallbackClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("work_model, seniority_level, source")
      .eq("is_tech", true);

    if (error || !data) {
      return { totalJobs: 0, byModel: {}, bySeniority: {}, bySource: {} };
    }

    const byModel: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    const rows = data as unknown as Record<string, unknown>[];
    for (const row of rows) {
      const model = typeof row.work_model === "string" ? row.work_model : "NAO_INFORMADO";
      const seniority =
        typeof row.seniority_level === "string" ? row.seniority_level : "NAO_INFORMADO";
      const src = typeof row.source === "string" ? row.source : "OUTRO";

      byModel[model] = (byModel[model] || 0) + 1;
      bySeniority[seniority] = (bySeniority[seniority] || 0) + 1;
      bySource[src] = (bySource[src] || 0) + 1;
    }

    return {
      totalJobs: data.length,
      byModel,
      bySeniority,
      bySource,
    };
  };
}
