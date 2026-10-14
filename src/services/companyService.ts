import initialMonitoredCompanies from "../data/monitoredCompanies.json";
import type { Company, CompanyFilterParams, CompanySuggestionInput } from "../types/company";
import { detectATS } from "../utils/atsDetector";

const LOCAL_STORAGE_SUGGESTIONS_KEY = "querovagas_company_suggestions";
const LOCAL_STORAGE_VOTES_KEY = "querovagas_company_votes";

function getLocalSuggestions(): Company[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUGGESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSuggestions(items: Company[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SUGGESTIONS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Falha ao salvar sugestões no localStorage:", err);
  }
}

function getLocalVotes(): Record<string, boolean> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordLocalVote(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const votes = getLocalVotes();
    votes[id] = true;
    localStorage.setItem(LOCAL_STORAGE_VOTES_KEY, JSON.stringify(votes));
  } catch (err) {
    console.warn("Falha ao salvar voto no localStorage:", err);
  }
}

export class CompanyService {
  private baseUrl = "/api";

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
    }
  }

  /**
   * Retorna a lista consolidada de empresas monitoradas e sugeridas
   */
  public async getCompanies(params: CompanyFilterParams = {}): Promise<Company[]> {
    let apiCompanies: Company[] | null = null;

    try {
      const q = new URLSearchParams();
      if (params.search) q.append("search", params.search);
      if (params.ats && params.ats !== "ALL") q.append("ats", params.ats);
      if (params.status && params.status !== "ALL") q.append("status", params.status);

      const res = await fetch(`${this.baseUrl}/companies?${q.toString()}`);
      if (res.ok) {
        apiCompanies = (await res.json()) as Company[];
      }
    } catch {
      // Fallback para catálogo local caso a API não esteja acessível
    }

    if (apiCompanies && Array.isArray(apiCompanies) && apiCompanies.length > 0) {
      return this.enrichWithLocalVotes(apiCompanies);
    }

    return this.getLocalFilteredCompanies(params);
  }

  /**
   * Busca empresas por termo de busca (nome, slug ou URL)
   */
  public async searchCompanies(query: string, atsFilter?: string): Promise<{
    exactMatch: Company | null;
    matches: Company[];
    isMonitored: boolean;
  }> {
    const cleanQuery = (query || "").trim().toLowerCase();
    if (!cleanQuery) {
      const all = await this.getCompanies({ ats: atsFilter });
      return { exactMatch: null, matches: all.slice(0, 30), isMonitored: false };
    }

    const all = await this.getCompanies({ search: cleanQuery, ats: atsFilter });

    const normalizedQuerySlug = cleanQuery.replace(/[^a-z0-9]/g, "");
    const exactMatch =
      all.find(
        (c) =>
          c.name.toLowerCase() === cleanQuery ||
          c.slug.replace(/[^a-z0-9]/g, "") === normalizedQuerySlug ||
          (c.careerUrl && c.careerUrl.toLowerCase().includes(cleanQuery)),
      ) || null;

    return {
      exactMatch,
      matches: all,
      isMonitored: exactMatch !== null && exactMatch.status !== "SUGGESTED",
    };
  }

  /**
   * Envia uma nova sugestão de empresa para ser monitorada pela comunidade
   */
  public async suggestCompany(input: CompanySuggestionInput): Promise<Company> {
    const trimmedName = (input.name || "").trim();
    if (!trimmedName) {
      throw new Error("O nome da empresa é obrigatório.");
    }

    const { ats: detectedAts, cleanUrl } = detectATS(input.careerUrl);
    const finalUrl = cleanUrl || (input.careerUrl || "").trim();
    if (!finalUrl) {
      throw new Error("O link de carreiras da empresa é obrigatório.");
    }

    const finalAts = input.ats && input.ats !== "OUTRO" ? input.ats : detectedAts;
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const payload: CompanySuggestionInput = {
      name: trimmedName,
      careerUrl: finalUrl,
      ats: finalAts,
      notes: input.notes?.trim() || undefined,
      suggestedBy: input.suggestedBy?.trim() || "Membro da Comunidade",
    };

    let created: Company | null = null;

    try {
      const res = await fetch(`${this.baseUrl}/company-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        created = (await res.json()) as Company;
      }
    } catch {
      // Criação local de fallback
    }

    if (!created) {
      created = {
        id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        slug,
        ats: finalAts,
        careerUrl: finalUrl,
        status: "SUGGESTED",
        activeJobsCount: 0,
        suggestedBy: payload.suggestedBy,
        votesCount: 1,
        notes: payload.notes,
        createdAt: new Date().toISOString(),
      };
    }

    // Salva no localStorage para persistência imediata do cliente
    const currentLocal = getLocalSuggestions();
    const existingIndex = currentLocal.findIndex(
      (c) => c.slug === created.slug || c.careerUrl === created.careerUrl,
    );
    if (existingIndex >= 0) {
      currentLocal[existingIndex] = created;
    } else {
      currentLocal.unshift(created);
    }
    saveLocalSuggestions(currentLocal);

    return created;
  }

  /**
   * Vota/apoia uma empresa sugerida para que ela seja monitorada prioritariamente
   */
  public async upvoteSuggestion(companyId: string): Promise<number> {
    const hasVoted = getLocalVotes()[companyId];
    if (hasVoted) {
      // Já votou localmente
      return -1;
    }

    recordLocalVote(companyId);

    try {
      const res = await fetch(`${this.baseUrl}/company-suggestions/${companyId}/upvote`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { votesCount: number };
        return data.votesCount;
      }
    } catch {
      // Atualização no localStorage
    }

    const localList = getLocalSuggestions();
    const target = localList.find((c) => c.id === companyId);
    if (target) {
      target.votesCount = (target.votesCount || 0) + 1;
      saveLocalSuggestions(localList);
      return target.votesCount;
    }

    return 1;
  }

  /**
   * Verifica se o usuário atual já votou em uma sugestão
   */
  public hasUserVoted(companyId: string): boolean {
    return Boolean(getLocalVotes()[companyId]);
  }

  private enrichWithLocalVotes(companies: Company[]): Company[] {
    const localSuggestions = getLocalSuggestions();
    const map = new Map<string, Company>();

    for (const c of companies) {
      map.set(c.id, { ...c });
    }

    // Mescla sugestões locais que ainda possam não ter subido para a API
    for (const sug of localSuggestions) {
      if (!map.has(sug.id)) {
        map.set(sug.id, sug);
      }
    }

    return Array.from(map.values());
  }

  private getLocalFilteredCompanies(params: CompanyFilterParams): Company[] {
    const baseList: Company[] = (initialMonitoredCompanies as Company[]).map((c) => ({
      ...c,
      status: "MONITORED" as const,
    }));

    const suggestions = getLocalSuggestions();
    let combined = [...baseList, ...suggestions];

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q) ||
          (c.careerUrl && c.careerUrl.toLowerCase().includes(q)) ||
          c.ats.toLowerCase().includes(q),
      );
    }

    if (params.ats && params.ats !== "ALL") {
      combined = combined.filter((c) => c.ats.toUpperCase() === params.ats?.toUpperCase());
    }

    if (params.status && params.status !== "ALL") {
      combined = combined.filter((c) => c.status === params.status);
    }

    return combined;
  }
}

export const companyService = new CompanyService();
