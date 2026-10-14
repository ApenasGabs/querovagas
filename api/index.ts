import { createClient } from "@supabase/supabase-js";
import express, { type NextFunction, type Request, type Response } from "express";

const app = express();
app.disable("x-powered-by");

const targetBase =
  process.env.VITE_SUPABASE_URL ||
  "https://gglsmwtyrwadwxyvevmr.supabase.co";

const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbHNtd3R5cndhZHd4eXZldm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTI1MDIsImV4cCI6MjEwNTA4ODUwMn0.jSRnLVyzCse-Q1xiQ3--BwU4knRDvDSiaZpLEcY38bY";

const supabase = createClient(targetBase, anonKey);

// Parse JSON request bodies for clean API calls
app.use(express.json());

// CORS & Preflight handling
app.use((req: Request, res: Response, next: NextFunction) => {
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

// URL & Path Normalizer (handles Vercel rewrite ?path=... and direct calls without double-encoding)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const qIndex = req.url.indexOf("?");
  let pathPart = qIndex !== -1 ? req.url.slice(0, qIndex) : req.url;
  let queryString = qIndex !== -1 ? req.url.slice(qIndex) : "";

  if (qIndex !== -1) {
    const rawQs = req.url.slice(qIndex + 1);
    const pathMatch = rawQs.match(/(?:^|&)path=([^&]+)/);
    if (pathMatch) {
      pathPart = decodeURIComponent(pathMatch[1]);
      const remaining = rawQs
        .split("&")
        .filter((p) => !p.startsWith("path=") && !p.startsWith("path%3D"));
      queryString = remaining.length > 0 ? `?${remaining.join("&")}` : "";
    }
  }

  if (pathPart === "/api" || pathPart.startsWith("/api/")) {
    pathPart = pathPart.replace(/^\/api\/?/, "/");
  }

  if (pathPart === "" || pathPart === "/index") {
    pathPart = "/";
  }

  req.url = `${pathPart}${queryString}`;
  next();
});

const CITY_QUERY_MAP: Record<string, string[]> = {
  CITY_SAO_PAULO: ["*São Paulo*", "*Sao Paulo*"],
  CITY_CAMPINAS: ["*Campinas*"],
  CITY_BARUERI: ["*Barueri*", "*Alphaville*"],
  CITY_RIBEIRAO_PRETO: ["*Ribeirão Preto*", "*Ribeirao Preto*"],
  CITY_SAO_CARLOS: ["*São Carlos*", "*Sao Carlos*"],
  CITY_SOROCABA: ["*Sorocaba*"],
  CITY_JUNDIAI: ["*Jundiaí*", "*Jundiai*"],
  CITY_HORTOLANDIA: ["*Hortolândia*", "*Hortolandia*"],
  CITY_SANTOS: ["*Santos*"],
  CITY_CURITIBA: ["*Curitiba*"],
  CITY_PORTO_ALEGRE: ["*Porto Alegre*"],
  CITY_BELO_HORIZONTE: ["*Belo Horizonte*"],
  CITY_RIO_DE_JANEIRO: ["*Rio de Janeiro*"],
  CITY_BRASILIA: ["*Brasília*", "*Brasilia*"],
  CITY_MANAUS: ["*Manaus*"],
  CITY_FLORIANOPOLIS: ["*Florianópolis*", "*Florianopolis*"],
  CITY_JOINVILLE: ["*Joinville*"],
  CITY_BLUMENAU: ["*Blumenau*"],
  CITY_SALVADOR: ["*Salvador*"],
  CITY_RECIFE: ["*Recife*"],
  CITY_FORTALEZA: ["*Fortaleza*"],
};

const UF_QUERY_MAP: Record<string, { uf: string; names: string[] }> = {
  UF_SP: { uf: "SP", names: ["*São Paulo*", "*Sao Paulo*"] },
  UF_RJ: { uf: "RJ", names: ["*Rio de Janeiro*"] },
  UF_MG: { uf: "MG", names: ["*Minas Gerais*", "*Belo Horizonte*"] },
  UF_PR: { uf: "PR", names: ["*Paraná*", "*Parana*", "*Curitiba*"] },
  UF_RS: { uf: "RS", names: ["*Rio Grande do Sul*", "*Porto Alegre*"] },
  UF_SC: {
    uf: "SC",
    names: ["*Santa Catarina*", "*Florianópolis*", "*Blumenau*", "*Joinville*"],
  },
  UF_DF: { uf: "DF", names: ["*Distrito Federal*", "*Brasília*", "*Brasilia*"] },
  UF_AM: { uf: "AM", names: ["*Amazonas*", "*Manaus*"] },
  UF_BA: { uf: "BA", names: ["*Bahia*", "*Salvador*"] },
  UF_PE: { uf: "PE", names: ["*Pernambuco*", "*Recife*"] },
  UF_CE: { uf: "CE", names: ["*Ceará*", "*Ceara*", "*Fortaleza*"] },
};

// -------------------------------------------------------------
// 1. PARSER ENDPOINT: POST /jobs (e GET /jobs)
// Recebe payload limpo do frontend e monta a query para o backend escondido
// -------------------------------------------------------------
const handleJobsParser = async (req: Request, res: Response): Promise<void> => {
  const params = req.method === "POST" ? req.body || {} : req.query || {};
  const {
    search = "",
    seniority = "ALL",
    workModel = "ALL",
    location = "ALL",
    source = "ALL",
    page = 1,
    pageSize = 12,
  } = params;

  const numPage = Number(page) || 1;
  const numPageSize = Number(pageSize) || 12;

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("is_tech", true);

  if (typeof search === "string" && search.trim()) {
    const q = search.trim();
    query = query.or(
      `title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`,
    );
  }

  if (seniority && seniority !== "ALL") {
    query = query.eq("seniority_level", String(seniority));
  }

  if (workModel && workModel !== "ALL") {
    query = query.eq("work_model", String(workModel));
  }

  const loc = String(location);
  if (loc === "SP_REGION") {
    query = query
      .or(
        'location.ilike."*São Paulo*",location.ilike."*Sao Paulo*",location.ilike."*Campinas*",location.ilike."*, SP*",location.ilike."*- SP*",location.ilike."*/SP*",location.ilike."*Barueri*",location.ilike."*Osasco*",location.ilike."*Santo André*",location.ilike."*São Bernardo*",location.ilike."*São Caetano*",location.ilike."*Sorocaba*",location.ilike."*Jundiaí*",location.ilike."*Ribeirão Preto*",location.ilike."*São Carlos*",location.ilike."*Indaiatuba*",location.ilike."*Hortolândia*",location.ilike."*Valinhos*",location.ilike."*Vinhedo*",location.ilike."*Alphaville*",location.ilike."*Guarulhos*",location.ilike."*Santos*"',
      )
      .not("location", "ilike", "%Spain%");
  } else if (loc === "BRASIL") {
    query = query
      .or(
        'location.ilike."*Brasil*",location.ilike."*Brazil*",location.ilike."*, BR*",location.ilike."*São Paulo*",location.ilike."*Campinas*"',
      )
      .not("location", "ilike", "%Spain%");
  } else if (loc === "INTERNACIONAL") {
    query = query
      .not("location", "ilike", "%Brasil%")
      .not("location", "ilike", "%Brazil%")
      .not("location", "ilike", "%, BR%")
      .not("location", "ilike", "%São Paulo%")
      .not("location", "ilike", "%Campinas%");
  } else if (loc.startsWith("CITY_") && CITY_QUERY_MAP[loc]) {
    const patterns = CITY_QUERY_MAP[loc]
      .map((p) => `location.ilike."${p}"`)
      .join(",");
    query = query.or(patterns);
  } else if (loc.startsWith("UF_") && UF_QUERY_MAP[loc]) {
    const { uf, names } = UF_QUERY_MAP[loc];
    const patterns = [
      `location.ilike."*, ${uf}*"`,
      `location.ilike."*- ${uf}*"`,
      `location.ilike."*/${uf}*"`,
      `location.ilike."*${uf},*"`,
      ...names.map((n) => `location.ilike."${n}"`),
    ].join(",");
    query = query.or(patterns);
    if (uf === "SP") {
      query = query.not("location", "ilike", "%Spain%");
    }
  } else if (loc && loc !== "ALL") {
    query = query.ilike("location", `%${loc}%`);
  }

  if (source && source !== "ALL") {
    query = query.eq("source", String(source));
  }

  const from = (numPage - 1) * numPageSize;
  const to = from + numPageSize - 1;

  try {
    const { data, count, error } = await query
      .order("scraped_at", { ascending: false })
      .range(from, to);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rawJobs = data || [];
    const jobs = rawJobs.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      workModel: row.work_model || row.workModel || "NAO_INFORMADO",
      salary: row.salary || undefined,
      contractType: row.contract_type || row.contractType || "CLT",
      seniorityLevel: row.seniority_level || row.seniorityLevel || "NAO_INFORMADO",
      url: row.url,
      source: row.source,
      stack: Array.isArray(row.stack) ? row.stack : [],
      scrapedAt: row.scraped_at || row.scrapedAt || new Date().toISOString(),
      description: row.description || undefined,
      isTech: row.is_tech ?? true,
    }));

    const total = count || jobs.length;
    const totalPages = Math.ceil(total / numPageSize) || 1;

    res.json({
      jobs,
      total,
      page: numPage,
      pageSize: numPageSize,
      totalPages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar vagas";
    res.status(500).json({ error: msg });
  }
};

app.post("/jobs", handleJobsParser);
app.get("/jobs", handleJobsParser);

app.get("/jobs/stats", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("work_model, seniority_level, source")
      .eq("is_tech", true);

    if (error || !data) {
      res.json({ totalJobs: 0, byModel: {}, bySeniority: {}, bySource: {} });
      return;
    }

    const byModel: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const row of data as Record<string, unknown>[]) {
      const model = typeof row.work_model === "string" ? row.work_model : "NAO_INFORMADO";
      const seniority =
        typeof row.seniority_level === "string" ? row.seniority_level : "NAO_INFORMADO";
      const src = typeof row.source === "string" ? row.source : "OUTRO";

      byModel[model] = (byModel[model] || 0) + 1;
      bySeniority[seniority] = (bySeniority[seniority] || 0) + 1;
      bySource[src] = (bySource[src] || 0) + 1;
    }

    res.json({
      totalJobs: data.length,
      byModel,
      bySeniority,
      bySource,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar estatísticas";
    res.status(500).json({ error: msg });
  }
});

app.get("/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Vaga não encontrada" });
      return;
    }

    const row = data as Record<string, unknown>;
    res.json({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      workModel: row.work_model || row.workModel || "NAO_INFORMADO",
      salary: row.salary || undefined,
      contractType: row.contract_type || row.contractType || "CLT",
      seniorityLevel: row.seniority_level || row.seniorityLevel || "NAO_INFORMADO",
      url: row.url,
      source: row.source,
      stack: Array.isArray(row.stack) ? row.stack : [],
      scrapedAt: row.scraped_at || row.scrapedAt || new Date().toISOString(),
      description: row.description || undefined,
      isTech: row.is_tech ?? true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar vaga";
    res.status(500).json({ error: msg });
  }
});

// -------------------------------------------------------------
// 2. RAW PROXY ENDPOINT: ALL /v1/{*path} e /rest/v1/{*path}
// Redireciona chamadas diretas como /api/v1/rest/v1/... sem expor headers
// -------------------------------------------------------------
const rawProxyHandler = async (req: Request, res: Response): Promise<void> => {
  const qIndex = req.url.indexOf("?");
  const queryString = qIndex !== -1 ? req.url.slice(qIndex) : "";
  const pathWithoutQuery = qIndex !== -1 ? req.url.slice(0, qIndex) : req.url;
  const upstreamPath = pathWithoutQuery.replace(/^\/v1/, "");
  const targetUrl = `${targetBase.replace(/\/$/, "")}${upstreamPath}${queryString}`;

  const forwardHeaders: Record<string, string> = {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
  };

  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    if (
      lower !== "host" &&
      lower !== "connection" &&
      lower !== "content-length" &&
      lower !== "apikey" &&
      lower !== "authorization" &&
      typeof v === "string"
    ) {
      forwardHeaders[k] = v;
    }
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

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyData,
    });

    res.status(upstreamRes.status);

    upstreamRes.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      // Não repassar cabeçalhos de vendor, nem de compressão/comprimento desatualizados
      if (
        !lower.startsWith("sb-") &&
        !lower.startsWith("x-envoy-") &&
        lower !== "server" &&
        lower !== "set-cookie" &&
        lower !== "content-encoding" &&
        lower !== "content-length" &&
        lower !== "alt-svc" &&
        lower !== "content-location"
      ) {
        res.setHeader(k, v);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Preference-Applied, Content-Type",
    );

    const buf = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy request failed";
    res.status(502).json({ error: msg });
  }
};

app.all("/v1/{*path}", rawProxyHandler);
app.all("/rest/v1/{*path}", rawProxyHandler);

export default app;
