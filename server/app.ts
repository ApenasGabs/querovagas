import express, { type Request, type Response } from "express";

const app = express();

// Disable Express fingerprint header
app.disable("x-powered-by");

// CORS & Preflight handling
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, apikey, Prefer, Range, x-client-info",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Preference-Applied, Content-Type",
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

const proxyHandler = async (req: Request, res: Response): Promise<void> => {
  const targetBase = process.env.VITE_SUPABASE_URL || "https://gglsmwtyrwadwxyvevmr.supabase.co";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

  // Normalize path removing /api/v1 prefix
  const originalUrl = req.originalUrl || req.url;
  const upstreamPath = originalUrl.replace(/^\/api\/v1/, "");
  const targetUrl = `${targetBase.replace(/\/$/, "")}${upstreamPath}`;

  const forwardHeaders: Record<string, string> = {};

  // Copy safe headers from incoming request
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== "host" &&
      lowerKey !== "connection" &&
      lowerKey !== "content-length" &&
      typeof value === "string"
    ) {
      forwardHeaders[key] = value;
    }
  }

  // Inject authentication credentials server-side to hide vendor keys from client
  if (anonKey) {
    forwardHeaders["apikey"] = anonKey;
    forwardHeaders["authorization"] = `Bearer ${anonKey}`;
  }

  try {
    let bodyData: Buffer | undefined;
    if (!["GET", "HEAD"].includes(req.method)) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        bodyData = Buffer.concat(chunks);
      }
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyData,
    });

    res.status(upstreamResponse.status);

    // Forward safe headers, stripping vendor & infrastructure identifiers
    upstreamResponse.headers.forEach((value, headerKey) => {
      const lower = headerKey.toLowerCase();
      // Block any vendor or internal headers
      if (
        !lower.startsWith("sb-") &&
        !lower.startsWith("x-envoy-") &&
        lower !== "server" &&
        lower !== "content-location" &&
        lower !== "set-cookie" &&
        lower !== "alt-svc"
      ) {
        res.setHeader(headerKey, value);
      }
    });

    // Ensure pagination and CORS headers are always exposed
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Preference-Applied, Content-Type",
    );

    const responseBuffer = await upstreamResponse.arrayBuffer();
    res.send(Buffer.from(responseBuffer));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Proxy request failed";
    res.status(502).json({ error: errorMessage });
  }
};

// Route matching for /api/v1 and subpaths
app.use("/api/v1", proxyHandler);

// Fallback for root mount if used directly in Vercel
app.use("/rest/v1", proxyHandler);

export default app;
