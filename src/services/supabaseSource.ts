import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Job, JobFilterParams, JobStats, PaginatedJobs } from "../types/job";
import type { IJobDataSource } from "./dataSource.interface";
import { CITY_QUERY_MAP, UF_QUERY_MAP } from "./locationConstants";

export class SupabaseJobDataSource implements IJobDataSource {
  private client: SupabaseClient | null = null;
  private tableName = "jobs";

  constructor(url?: string, anonKey?: string) {
    const supabaseUrl = url || import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.client = createClient(supabaseUrl, supabaseKey);
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  public async getJobs(params: JobFilterParams = {}): Promise<PaginatedJobs> {
    if (!this.client) {
      throw new Error(
        "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
      );
    }

    const {
      search = "",
      seniority = "ALL",
      workModel = "ALL",
      location = "ALL",
      source = "ALL",
      page = 1,
      pageSize = 12,
    } = params;

    let query = this.client
      .from(this.tableName)
      .select("*", { count: "exact" })
      .eq("is_tech", true);

    if (search.trim()) {
      const q = search.trim();
      query = query.or(
        `title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`,
      );
    }

    if (seniority && seniority !== "ALL") {
      query = query.eq("seniority_level", seniority);
    }

    if (workModel && workModel !== "ALL") {
      query = query.eq("work_model", workModel);
    }

    // Filtro de localidade (São Paulo e Região, Cidades ou Estados)
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

    const rawJobs = data || [];
    const jobs: Job[] = rawJobs.map((row: any) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      workModel: row.work_model || row.workModel || "NAO_INFORMADO",
      salary: row.salary || undefined,
      contractType: row.contract_type || row.contractType || "CLT",
      seniorityLevel: row.seniority_level || row.seniorityLevel || "NAO_INFORMADO",
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
  }

  public async getJobById(id: string): Promise<Job | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      company: data.company,
      location: data.location,
      workModel: data.work_model || data.workModel || "NAO_INFORMADO",
      salary: data.salary || undefined,
      contractType: data.contract_type || data.contractType || "CLT",
      seniorityLevel: data.seniority_level || data.seniorityLevel || "NAO_INFORMADO",
      url: data.url,
      source: data.source,
      stack: Array.isArray(data.stack) ? data.stack : [],
      scrapedAt: data.scraped_at || data.scrapedAt,
      description: data.description || undefined,
      isTech: data.is_tech ?? true,
    };
  }

  public async getStats(): Promise<JobStats> {
    if (!this.client) {
      return { totalJobs: 0, byModel: {}, bySeniority: {}, bySource: {} };
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .select("work_model, seniority_level, source")
      .eq("is_tech", true);

    if (error || !data) {
      return { totalJobs: 0, byModel: {}, bySeniority: {}, bySource: {} };
    }

    const byModel: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const row of data as any[]) {
      const model = row.work_model || "NAO_INFORMADO";
      const seniority = row.seniority_level || "NAO_INFORMADO";
      const src = row.source || "OUTRO";

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
  }
}
