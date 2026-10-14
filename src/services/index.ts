import type { IJobDataSource } from "./dataSource.interface";
import { MockJobDataSource } from "./mockSource";
import { SupabaseJobDataSource } from "./supabaseSource";

let cachedDataSource: IJobDataSource | null = null;

export const getJobDataSource = (): IJobDataSource => {
  if (cachedDataSource) {
    return cachedDataSource;
  }

  const provider = import.meta.env.VITE_DATA_PROVIDER;

  if (provider === "mock") {
    cachedDataSource = new MockJobDataSource();
    return cachedDataSource;
  }

  // Uses the local reverse proxy endpoint, keeping backend credentials and vendor URLs out of the client bundle
  const supabaseSource = new SupabaseJobDataSource();
  if (supabaseSource.isConfigured()) {
    cachedDataSource = supabaseSource;
    return cachedDataSource;
  }

  // Fallback padrão: dados locais realistas e ricos
  cachedDataSource = new MockJobDataSource();
  return cachedDataSource;
};

export type { IJobDataSource } from "./dataSource.interface";
export { MockJobDataSource } from "./mockSource";
export { SupabaseJobDataSource } from "./supabaseSource";
