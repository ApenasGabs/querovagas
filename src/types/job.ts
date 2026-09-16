export type WorkModel = "REMOTO" | "HIBRIDO" | "PRESENCIAL" | "NAO_INFORMADO";

export type ContractType = "CLT" | "PJ" | "FREELANCER" | "ESTAGIO" | "OUTRO";

export type SeniorityLevel =
  | "ESTAGIO"
  | "JUNIOR"
  | "PLENO"
  | "SENIOR"
  | "ESPECIALISTA"
  | "NAO_INFORMADO";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  workModel: WorkModel;
  salary?: string;
  contractType: ContractType;
  seniorityLevel: SeniorityLevel;
  url: string;
  source: string;
  stack: string[];
  scrapedAt: string;
  description?: string;
  isTech?: boolean;
}

export interface JobFilterParams {
  search?: string;
  seniority?: SeniorityLevel | "ALL";
  workModel?: WorkModel | "ALL";
  location?: string | "ALL";
  source?: string | "ALL";
  stack?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedJobs {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobStats {
  totalJobs: number;
  byModel: Record<string, number>;
  bySeniority: Record<string, number>;
  bySource: Record<string, number>;
}

