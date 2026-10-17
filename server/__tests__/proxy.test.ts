// @vitest-environment node
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";

describe("Express Reverse Proxy & Parser API", () => {
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

  it("should respond to OPTIONS preflight with status 204 and CORS headers", async () => {
    const res = await fetch(`${baseUrl}/api/v1/rest/v1/jobs`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-expose-headers")).toContain("Content-Range");
  });

  it("should handle raw PostgREST requests and strip vendor headers", async () => {
    const rawQuery =
      "select=*&is_tech=eq.true&or=%28location.ilike.%22*S%C3%A3o+Paulo*%22%2Clocation.ilike.%22*Campinas*%22%29&location=not.ilike.%25Spain%25&order=scraped_at.desc&offset=0&limit=2";
    const res = await fetch(`${baseUrl}/api/v1/rest/v1/jobs?${rawQuery}`, {
      method: "GET",
      headers: {
        accept: "*/*",
        prefer: "count=exact",
      },
    });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    // Verify vendor headers are stripped
    expect(res.headers.get("sb-project-ref")).toBeNull();
    expect(res.headers.get("sb-gateway-version")).toBeNull();
    expect(res.headers.get("sb-jwt-iss")).toBeNull();
    expect(res.headers.get("server")).toBeNull();
    expect(res.headers.get("content-encoding")).toBeNull();

    // Verify content-range is exposed
    expect(res.headers.get("content-range")).toBeTruthy();

    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("should handle simulated Vercel rewrites with path query param", async () => {
    const vercelRewriteUrl = `${baseUrl}/api/index?path=%2Fv1%2Frest%2Fv1%2Fjobs&select=id%2Ctitle&limit=1`;
    const res = await fetch(vercelRewriteUrl, {
      method: "GET",
      headers: {
        accept: "*/*",
        prefer: "count=exact",
      },
    });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const data = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it("should handle Parser POST /api/jobs endpoint with clean payload", async () => {
    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: "SP_REGION",
        page: 1,
        pageSize: 2,
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { jobs: unknown[]; total: number; totalPages: number };
    expect(data).toHaveProperty("jobs");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("totalPages");
    expect(Array.isArray(data.jobs)).toBe(true);
    expect(data.jobs.length).toBe(2);
  });

  it("should handle Parser GET /api/jobs/stats endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/jobs/stats`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      totalJobs: number;
      byModel: Record<string, number>;
      bySeniority: Record<string, number>;
    };
    expect(data).toHaveProperty("totalJobs");
    expect(data).toHaveProperty("byModel");
    expect(data).toHaveProperty("bySeniority");
    expect(data.totalJobs).toBeGreaterThan(0);
  });

  describe("Developer Trust & Community Auth Protection", () => {
    it("should return isVerified: false on GET /api/auth/session without trust token", async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { isVerified: boolean; username: string | null };
      expect(data.isVerified).toBe(false);
      expect(data.username).toBeNull();
    });

    it("should verify anchor seed user and return signed trust token on POST /api/auth/verify-trust", async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ApenasGabs" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        ok: boolean;
        isVerified: boolean;
        trustToken?: string;
        username?: string;
      };
      expect(data.ok).toBe(true);
      expect(data.isVerified).toBe(true);
      expect(data.trustToken).toBeTruthy();
      expect(typeof data.trustToken).toBe("string");
    });

    it("should verify mutual follow user (e.g. leozizz) on POST /api/auth/verify-trust", async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "leozizz" }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        ok: boolean;
        isVerified: boolean;
        trustToken?: string;
        username?: string;
      };
      expect(data.ok).toBe(true);
      expect(data.isVerified).toBe(true);
      expect(data.trustToken).toBeTruthy();
      expect(data.username).toBe("leozizz");
    });

    it("should handle GET /api/auth/github redirect", async () => {
      const res = await fetch(`${baseUrl}/api/auth/github`, { redirect: "manual" });
      expect([301, 302, 307, 308]).toContain(res.status);
    });

    it("should return empty jobs when trust is enforced and token is missing", async () => {
      const res = await fetch(`${baseUrl}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-enforce-trust": "true",
        },
        body: JSON.stringify({ page: 1, pageSize: 2 }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { jobs: unknown[]; total: number };
      expect(data.jobs).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("should allow jobs access when valid trust token is provided", async () => {
      // 1. Gera o token para o anchor user
      const authRes = await fetch(`${baseUrl}/api/auth/verify-trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ApenasGabs" }),
      });
      const { trustToken } = (await authRes.json()) as { trustToken: string };

      // 2. Consulta vagas com o token
      const res = await fetch(`${baseUrl}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trust-token": trustToken,
          "x-enforce-trust": "true",
        },
        body: JSON.stringify({ page: 1, pageSize: 2 }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { jobs: unknown[] };
      expect(data.jobs.length).toBeGreaterThanOrEqual(1);
    });

    it("should return 404 on GET /api/jobs/:id when trust is enforced and token is missing", async () => {
      const res = await fetch(`${baseUrl}/api/jobs/sample-id-123`, {
        headers: {
          "x-enforce-trust": "true",
        },
      });
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Vaga não encontrada");
    });
  });
});
