import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";

describe("Express Companies & Community Radar API", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === "object" && address) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should return a list of monitored companies on GET /api/companies", async () => {
    const res = await fetch(`${baseUrl}/api/companies`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const first = data[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("ats");
    expect(first).toHaveProperty("status");
  });

  it("should filter companies by search query", async () => {
    const res = await fetch(`${baseUrl}/api/companies?search=cielo`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Array<{ name: string }>;
    expect(Array.isArray(data)).toBe(true);
    const cielo = data.find((c: { name: string }) => c.name.toLowerCase().includes("cielo"));
    expect(cielo).toBeDefined();
  });

  it("should reject suggestion without name or url with 400", async () => {
    const res = await fetch(`${baseUrl}/api/company-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", careerUrl: "" }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });

  it("should create a valid community suggestion with 201", async () => {
    const res = await fetch(`${baseUrl}/api/company-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Empresa Teste Vitest",
        careerUrl: "https://empresateste.gupy.io",
        ats: "GUPY",
        suggestedBy: "Tester",
        notes: "Startup promissora",
      }),
    });
    expect([200, 201]).toContain(res.status);
    const data = (await res.json()) as {
      id: string;
      name: string;
      status: string;
      votesCount: number;
    };
    expect(data.name).toBe("Empresa Teste Vitest");
    expect(data.status).toBe("SUGGESTED");
    expect(data.votesCount).toBeGreaterThanOrEqual(1);

    // Upvote test
    const upvoteRes = await fetch(`${baseUrl}/api/company-suggestions/${data.id}/upvote`, {
      method: "POST",
    });
    expect(upvoteRes.status).toBe(200);
    const upvoteData = (await upvoteRes.json()) as { votesCount: number };
    expect(upvoteData.votesCount).toBeGreaterThanOrEqual(2);
  });

  it("should list community suggestions on GET /api/company-suggestions", async () => {
    const res = await fetch(`${baseUrl}/api/company-suggestions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
