import { describe, expect, it } from "vitest";
import { MockJobDataSource } from "../../../services/mockSource";

describe("MockJobDataSource", () => {
  const dataSource = new MockJobDataSource();

  it("should return paginated jobs with default settings", async () => {
    const result = await dataSource.getJobs();
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(12);
  });

  it("should filter jobs by search query in title, company or stack", async () => {
    const result = await dataSource.getJobs({ search: "Nubank" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(1);
    expect(result.jobs.every((j) => j.company.includes("Nubank"))).toBe(true);
  });

  it("should filter jobs by seniority level", async () => {
    const result = await dataSource.getJobs({ seniority: "ESTAGIO" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(1);
    expect(result.jobs.every((j) => j.seniorityLevel === "ESTAGIO")).toBe(true);
  });

  it("should filter jobs by work model", async () => {
    const result = await dataSource.getJobs({ workModel: "REMOTO" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(1);
    expect(result.jobs.every((j) => j.workModel === "REMOTO")).toBe(true);
  });

  it("should filter jobs by location (SP_REGION)", async () => {
    const result = await dataSource.getJobs({ location: "SP_REGION" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(1);
    expect(
      result.jobs.every((j) =>
        /(são paulo|campinas|sp)/i.test(j.location)
      )
    ).toBe(true);
  });

  it("should return job by ID correctly", async () => {
    const job = await dataSource.getJobById("mock-1");
    expect(job).not.toBeNull();
    expect(job?.id).toBe("mock-1");
    expect(job?.company).toBe("Nubank");
  });

  it("should calculate accurate stats summary", async () => {
    const stats = await dataSource.getStats();
    expect(stats.totalJobs).toBeGreaterThan(0);
    expect(stats.byModel["REMOTO"]).toBeGreaterThan(0);
    expect(stats.bySeniority["JUNIOR"]).toBeGreaterThan(0);
  });

  it("should extract popular tech stacks", async () => {
    const stacks = await dataSource.getPopularStacks();
    expect(stacks.length).toBeGreaterThan(0);
    expect(stacks).toContain("React");
  });
});

