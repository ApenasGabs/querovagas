import type { Job, JobFilterParams, JobStats, PaginatedJobs } from "../types/job";
import type { IJobDataSource } from "./dataSource.interface";
import { CITY_QUERY_MAP, UF_QUERY_MAP } from "./locationConstants";
import { MOCK_JOBS } from "./mockJobs";

export class MockJobDataSource implements IJobDataSource {
  private jobs: Job[] = [...MOCK_JOBS];

  public async getJobs(params: JobFilterParams = {}): Promise<PaginatedJobs> {
    const {
      search = "",
      seniority = "ALL",
      workModel = "ALL",
      location = "ALL",
      source = "ALL",
      stack = "",
      page = 1,
      pageSize = 12,
    } = params;

    let filtered = this.jobs.filter((j) => j.isTech !== false);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.stack.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (seniority && seniority !== "ALL") {
      filtered = filtered.filter((j) => j.seniorityLevel === seniority);
    }

    if (workModel && workModel !== "ALL") {
      filtered = filtered.filter((j) => j.workModel === workModel);
    }

    // Filtro por localidade
    const SP_REGION_REGEX =
      /\b(s[aã]o paulo|sp|campinas|barueri|osasco|santo andr[eé]|s[aã]o bernardo|s[aã]o caetano|sorocaba|s[aã]o jos[eé] dos campos|jundia[ií]|piracicaba|indaiatuba|hortol[aâ]ndia|valinhos|vinhedo|s[aã]o carlos|ribeir[aã]o preto|alphaville|guarulhos|santos)\b/i;

    if (location === "SP_REGION") {
      filtered = filtered.filter((j) => {
        const locLower = (j.location || "").toLowerCase();
        if (
          locLower.includes("spain") ||
          locLower.includes("madrid") ||
          locLower.includes("barcelona")
        ) {
          return false;
        }
        return SP_REGION_REGEX.test(j.location);
      });
    } else if (location === "BRASIL") {
      filtered = filtered.filter((j) => {
        const locLower = (j.location || "").toLowerCase();
        return (
          locLower.includes("brasil") ||
          locLower.includes("brazil") ||
          locLower.includes(", br") ||
          locLower.endsWith(" br") ||
          SP_REGION_REGEX.test(j.location)
        );
      });
    } else if (location === "INTERNACIONAL") {
      filtered = filtered.filter((j) => {
        const locLower = (j.location || "").toLowerCase();
        return (
          !locLower.includes("brasil") &&
          !locLower.includes("brazil") &&
          !locLower.includes(", br") &&
          !SP_REGION_REGEX.test(j.location)
        );
      });
    } else if (location.startsWith("CITY_") && CITY_QUERY_MAP[location]) {
      const cleanTerms = CITY_QUERY_MAP[location].map((t) =>
        t.replace(/\*/g, "").toLowerCase()
      );
      filtered = filtered.filter((j) => {
        const loc = (j.location || "").toLowerCase();
        return cleanTerms.some((term) => loc.includes(term));
      });
    } else if (location.startsWith("UF_") && UF_QUERY_MAP[location]) {
      const { uf, names } = UF_QUERY_MAP[location];
      const cleanNames = names.map((n) => n.replace(/\*/g, "").toLowerCase());
      const ufLower = uf.toLowerCase();
      filtered = filtered.filter((j) => {
        const loc = (j.location || "").toLowerCase();
        if (uf === "SP" && (loc.includes("spain") || loc.includes("madrid"))) {
          return false;
        }
        if (
          loc.includes(`, ${ufLower}`) ||
          loc.includes(`- ${ufLower}`) ||
          loc.includes(`/${ufLower}`)
        ) {
          return true;
        }
        return cleanNames.some((n) => loc.includes(n));
      });
    } else if (location && location !== "ALL") {
      const locQ = location.toLowerCase();
      filtered = filtered.filter((j) =>
        (j.location || "").toLowerCase().includes(locQ)
      );
    }

    if (source && source !== "ALL") {
      filtered = filtered.filter((j) => j.source === source);
    }

    if (stack && stack.trim()) {
      const st = stack.toLowerCase().trim();
      filtered = filtered.filter((j) => j.stack.some((s) => s.toLowerCase().includes(st)));
    }

    // Ordenar por data mais recente
    filtered.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      jobs: paginated,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getJobById(id: string): Promise<Job | null> {
    const found = this.jobs.find((j) => j.id === id);
    return found || null;
  }

  public async getStats(): Promise<JobStats> {
    const byModel: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const j of this.jobs) {
      byModel[j.workModel] = (byModel[j.workModel] || 0) + 1;
      bySeniority[j.seniorityLevel] = (bySeniority[j.seniorityLevel] || 0) + 1;
      bySource[j.source] = (bySource[j.source] || 0) + 1;
    }

    return {
      totalJobs: this.jobs.length,
      byModel,
      bySeniority,
      bySource,
    };
  }

  public async getPopularStacks(): Promise<string[]> {
    const map = new Map<string, number>();
    for (const j of this.jobs) {
      for (const s of j.stack) {
        map.set(s, (map.get(s) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 15);
  }
}
