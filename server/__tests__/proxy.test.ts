import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";

describe("Express Reverse Proxy", () => {
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

  it("should strip vendor headers and return safe responses", async () => {
    if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
      const res = await fetch(`${baseUrl}/api/v1/rest/v1/jobs?select=id&limit=1`, {
        method: "GET",
      });
      // Should be successful
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      // Verify vendor headers are stripped
      expect(res.headers.get("sb-project-ref")).toBeNull();
      expect(res.headers.get("sb-gateway-version")).toBeNull();
      expect(res.headers.get("sb-jwt-iss")).toBeNull();
      expect(res.headers.get("server")).toBeNull();

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});
