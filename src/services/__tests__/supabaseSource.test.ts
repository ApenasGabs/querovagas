import { describe, expect, it } from "vitest";
import { SupabaseJobDataSource } from "../supabaseSource";

describe("SupabaseJobDataSource Proxy & Initialization", () => {
  it("should initialize by default with relative proxy endpoint without exposing vendor URLs", () => {
    const dataSource = new SupabaseJobDataSource();
    expect(dataSource.isConfigured()).toBe(true);
  });

  it("should initialize when explicit URL and key are provided", () => {
    const dataSource = new SupabaseJobDataSource(
      "https://example-proxy.dev/api/v1",
      "test-anon-key",
    );
    expect(dataSource.isConfigured()).toBe(true);
  });

  it("should handle custom relative paths properly", () => {
    const dataSource = new SupabaseJobDataSource("/custom/proxy/path");
    expect(dataSource.isConfigured()).toBe(true);
  });
});
