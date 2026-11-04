import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseJobDataSource } from "../supabaseSource";

describe("SupabaseJobDataSource Proxy & Initialization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("should fetch popular stacks via proxy endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(["TypeScript", "React", "Node.js"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const dataSource = new SupabaseJobDataSource("/api");
    const stacks = await dataSource.getPopularStacks();

    expect(fetchSpy).toHaveBeenCalledWith("/api/jobs/popular-stacks");
    expect(stacks).toEqual(["TypeScript", "React", "Node.js"]);
  });

  it("should forward stack filter in getJobs proxy request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jobs: [],
          total: 0,
          page: 1,
          pageSize: 12,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const dataSource = new SupabaseJobDataSource("/api");
    await dataSource.getJobs({ stack: "React", page: 1, pageSize: 12 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      stack: "React",
      page: 1,
      pageSize: 12,
    });
  });
});
