import type { Job, JobFilterParams, JobStats, PaginatedJobs } from "../types/job";

export interface IJobDataSource {
  getJobs(params?: JobFilterParams): Promise<PaginatedJobs>;
  getJobById(id: string): Promise<Job | null>;
  getStats(): Promise<JobStats>;
  getPopularStacks?(): Promise<string[]>;
}
