import type { IJobDataSource } from "./dataSource.interface";
import { MockJobDataSource } from "./mockSource";
import { SupabaseJobDataSource } from "./supabaseSource";

let cachedDataSource: IJobDataSource | null = null;

export function getJobDataSource(): IJobDataSource {
  if (cachedDataSource) {
    return cachedDataSource;
  }

  const provider = import.meta.env.VITE_DATA_PROVIDER;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (provider === "mock") {
    cachedDataSource = new MockJobDataSource();
    return cachedDataSource;
  }

  if (supabaseUrl && supabaseKey) {
    const supabaseSource = new SupabaseJobDataSource(supabaseUrl, supabaseKey);
    if (supabaseSource.isConfigured()) {
      cachedDataSource = supabaseSource;
      return cachedDataSource;
    }
  }

  // Fallback padrão: dados locais realistas e ricos
  cachedDataSource = new MockJobDataSource();
  return cachedDataSource;
}

export type { IJobDataSource } from "./dataSource.interface";
export { MockJobDataSource } from "./mockSource";
export { SupabaseJobDataSource } from "./supabaseSource";
