export type CompanyStatus = "MONITORED" | "PENDING_CRAWLER" | "SUGGESTED";

export type ATSPlatform =
  | "GUPY"
  | "ASHBY"
  | "LEVER"
  | "GREENHOUSE"
  | "WORKABLE"
  | "INHIRE"
  | "PROGRAMATHOR"
  | "GEEKHUNTER"
  | "OUTRO";

export interface Company {
  id: string;
  name: string;
  slug: string;
  ats: ATSPlatform | string;
  careerUrl: string;
  status: CompanyStatus;
  activeJobsCount?: number;
  hasTechJobs?: boolean;
  lastScrapedAt?: string;
  suggestedBy?: string;
  votesCount?: number;
  notes?: string;
  createdAt?: string;
}

export interface CompanySuggestionInput {
  name: string;
  careerUrl: string;
  ats?: ATSPlatform | string;
  notes?: string;
  suggestedBy?: string;
}

export interface CompanyFilterParams {
  search?: string;
  ats?: string;
  status?: string;
}
