import crypto from "crypto";
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
    "Content-Type, Authorization, apikey, Prefer, Range, x-client-info, x-trust-token",
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
// 0. DEVELOPER TRUST & COMMUNITY REPUTATION ENGINE (CAMOUFLAGED GATEWAY)
// -------------------------------------------------------------
const DEV_AUDIT_SEED_USER =
  process.env.DEV_AUDIT_SEED_USER ||
  process.env.GITHUB_TRUST_ANCHOR ||
  "ApenasGabs";

const DEV_AUDIT_TOKEN =
  process.env.DEV_AUDIT_TOKEN ||
  process.env.GITHUB_PAT ||
  process.env.GITHUB_TRUST_TOKEN ||
  "";

const DEV_TRUST_SECRET =
  process.env.DEV_TRUST_SECRET ||
  "querovagas-community-auth-secret-key-2026";

/**
 * Emite token assinado com HMAC-SHA256 para perfis com reputação comprovada
 */
function generateTrustToken(username: string): string {
  const timestamp = Date.now();
  const payload = `${username.trim().toLowerCase()}:${timestamp}`;
  const hmac = crypto
    .createHmac("sha256", DEV_TRUST_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Valida a integridade e expiração do trust token
 */
function verifyTrustToken(token: string | undefined): { valid: boolean; username?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) {
      return { valid: false };
    }
    const [username, timestampStr, hmac] = parts;
    const timestamp = Number(timestampStr);
    if (!timestamp || isNaN(timestamp)) {
      return { valid: false };
    }

    // Token com validade de 30 dias
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAgeMs || timestamp > Date.now() + 60000) {
      return { valid: false };
    }

    const expectedHmac = crypto
      .createHmac("sha256", DEV_TRUST_SECRET)
      .update(`${username}:${timestamp}`)
      .digest("hex");

    const match = crypto.timingSafeEqual(
      Buffer.from(hmac, "utf-8"),
      Buffer.from(expectedHmac, "utf-8"),
    );

    return { valid: match, username: match ? username : undefined };
  } catch {
    return { valid: false };
  }
}

/**
 * Avalia o grafo de conexões técnicas e validações de integridade do desenvolvedor
 */
async function checkDeveloperReputation(
  candidateUsername: string,
  customToken?: string,
  candidateId?: number | string,
): Promise<boolean> {
  if (!candidateUsername) return false;
  const candidate = candidateUsername.trim().toLowerCase();
  const seedTarget = (DEV_AUDIT_SEED_USER || "ApenasGabs").trim().toLowerCase();

  // 1. Identificadores conhecidos de mantenedores e âncoras técnicas do projeto
  const KNOWN_ANCHORS = new Set([
    seedTarget,
    "apenasgabs",
    "gabers357",
  ]);

  if (KNOWN_ANCHORS.has(candidate)) {
    return true;
  }

  if (candidateId && String(candidateId) === "52265978") {
    return true;
  }

  const token = customToken || (DEV_AUDIT_TOKEN && !DEV_AUDIT_TOKEN.startsWith("vercel_") ? DEV_AUDIT_TOKEN : undefined);

  const fetchStatus = async (url: string): Promise<{ status: number; data?: unknown }> => {
    const headers: Record<string, string> = {
      "User-Agent": "QueroVagas-DevTrustEngine/1.0",
      Accept: "application/vnd.github+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      let res = await fetch(url, { headers });
      // Se receber 401 ou 403 (token de build da Vercel sem permissão), tenta novamente sem o header Authorization
      if ((res.status === 401 || res.status === 403) && token) {
        delete headers["Authorization"];
        res = await fetch(url, { headers });
      }
      let json: unknown = undefined;
      try {
        json = await res.json();
      } catch {
        // Ignora falha de parse
      }
      return { status: res.status, data: json };
    } catch {
      return { status: 500 };
    }
  };

  // 2. Validação por histórico de autoria/contribuição no repositório oficial
  try {
    const commitCheck = await fetchStatus(
      `https://api.github.com/repos/ApenasGabs/querovagas/commits?author=${encodeURIComponent(candidate)}&per_page=1`,
    );
    if (commitCheck.status === 200 && Array.isArray(commitCheck.data) && commitCheck.data.length > 0) {
      return true;
    }
  } catch {
    // Continua para as próximas checagens
  }

  // 3. Validação por permissões de colaboração do token OAuth (se disponível)
  if (customToken) {
    try {
      const repoCheck = await fetchStatus("https://api.github.com/repos/ApenasGabs/querovagas");
      if (repoCheck.status === 200 && repoCheck.data && typeof repoCheck.data === "object") {
        const permissions = (repoCheck.data as { permissions?: { admin?: boolean; push?: boolean } }).permissions;
        if (permissions?.push || permissions?.admin) {
          return true;
        }
      }
    } catch {
      // Ignora
    }
  }

  // 4. Avalia grafo de conexões técnicas (mútuo follow) via API do GitHub
  const candidateFollowsTargetUrl = `https://api.github.com/users/${encodeURIComponent(candidate)}/following/${encodeURIComponent(seedTarget)}`;
  const targetFollowsCandidateUrl = `https://api.github.com/users/${encodeURIComponent(seedTarget)}/following/${encodeURIComponent(candidate)}`;

  const [s1, s2] = await Promise.all([
    fetchStatus(candidateFollowsTargetUrl),
    fetchStatus(targetFollowsCandidateUrl),
  ]);

  // O GitHub retorna HTTP 204 No Content se seguir, e 404 Not Found se não seguir
  return s1.status === 204 && s2.status === 204;
}

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
    stack = "",
    page = 1,
    pageSize = 12,
  } = params;

  const numPage = Number(page) || 1;
  const numPageSize = Number(pageSize) || 12;

  // Interceptador de Proteção: Validação de Membro Verificado
  const trustHeader = (req.headers["x-trust-token"] || req.query.trust_token || params.trustToken) as string | undefined;
  const trustCheck = verifyTrustToken(trustHeader);
  const isTestBypass = process.env.NODE_ENV === "test" && !req.headers["x-enforce-trust"];

  if (!trustCheck.valid && !isTestBypass) {
    res.json({
      jobs: [],
      total: 0,
      page: numPage,
      pageSize: numPageSize,
      totalPages: 0,
    });
    return;
  }

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("is_tech", true);

  if (typeof search === "string" && search.trim()) {
    const q = search.trim().replace(/[,()"]/g, " ").trim();
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`,
      );
    }
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

  if (typeof stack === "string" && stack.trim() && stack !== "ALL") {
    query = query.contains("stack", [stack.trim()]);
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
    // 1. Tenta carregar as métricas agregadas completas via RPC no banco
    const { data: rpcStats, error: rpcError } = await supabase.rpc("get_job_stats");
    if (
      !rpcError &&
      rpcStats &&
      typeof rpcStats === "object" &&
      typeof (rpcStats as Record<string, unknown>).totalJobs === "number"
    ) {
      res.json(rpcStats);
      return;
    }

    // 2. Fallback paginado para superar o limite padrão de 1.000 linhas do PostgREST
    const allRows: Record<string, unknown>[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("jobs")
        .select("work_model, seniority_level, source")
        .eq("is_tech", true)
        .range(from, from + step - 1);

      if (error || !data || data.length === 0) break;
      allRows.push(...(data as Record<string, unknown>[]));
      if (data.length < step) break;
      from += step;
    }

    const byModel: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const row of allRows) {
      const model = typeof row.work_model === "string" ? row.work_model : "NAO_INFORMADO";
      const seniority =
        typeof row.seniority_level === "string" ? row.seniority_level : "NAO_INFORMADO";
      const src = typeof row.source === "string" ? row.source : "OUTRO";

      byModel[model] = (byModel[model] || 0) + 1;
      bySeniority[seniority] = (bySeniority[seniority] || 0) + 1;
      bySource[src] = (bySource[src] || 0) + 1;
    }

    res.json({
      totalJobs: allRows.length,
      byModel,
      bySeniority,
      bySource,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar estatísticas";
    res.status(500).json({ error: msg });
  }
});

app.get("/jobs/popular-stacks", async (_req: Request, res: Response) => {
  try {
    const { data: rpcStacks, error: rpcError } = await supabase.rpc("get_popular_stacks", {
      limit_count: 15,
    });
    if (!rpcError && Array.isArray(rpcStacks) && rpcStacks.length > 0) {
      res.json(
        rpcStacks.filter((s): s is string => typeof s === "string" && s.trim().length > 0),
      );
      return;
    }

    const { data, error } = await supabase
      .from("jobs")
      .select("stack")
      .eq("is_tech", true)
      .limit(1000);

    if (error || !data) {
      res.json([]);
      return;
    }

    const counts = new Map<string, number>();
    for (const row of data as Array<{ stack?: unknown }>) {
      if (Array.isArray(row.stack)) {
        for (const item of row.stack) {
          if (typeof item === "string" && item.trim()) {
            const normalized = item.trim();
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
          }
        }
      }
    }

    const topStacks = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 15);

    res.json(topStacks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar stacks populares";
    res.status(500).json({ error: msg });
  }
});

app.get("/jobs/:id", async (req: Request, res: Response) => {
  const trustHeader = (req.headers["x-trust-token"] || req.query.trust_token) as string | undefined;
  const trustCheck = verifyTrustToken(trustHeader);
  const isTestBypass = process.env.NODE_ENV === "test" && !req.headers["x-enforce-trust"];

  if (!trustCheck.valid && !isTestBypass) {
    res.status(404).json({ error: "Vaga não encontrada" });
    return;
  }

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
// 1.05 AUTENTICAÇÃO VIA SESSÃO DO UTTERANCES E REPUTAÇÃO TÉCNICA
// -------------------------------------------------------------
app.post("/auth/verify-trust", async (req: Request, res: Response) => {
  try {
    const { username: rawUsername, utterancesSession } = req.body || {};
    let candidateUsername =
      typeof rawUsername === "string" ? rawUsername.trim().replace(/^@+/, "") : "";
    let customAccessToken: string | undefined;
    let avatarUrl: string | undefined;
    let name: string | undefined;
    let candidateId: number | string | undefined;

    // Se recebeu a sessão do Utterances, troca pelo token OAuth do GitHub e obtém o usuário logado
    if (typeof utterancesSession === "string" && utterancesSession.trim()) {
      try {
        const tokenRes = await fetch("https://api.utteranc.es/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://utteranc.es",
            Referer: "https://utteranc.es/",
          },
          body: JSON.stringify(utterancesSession.trim()),
        });

        if (tokenRes.ok) {
          const tokenData = (await tokenRes.json()) as unknown;
          if (typeof tokenData === "string" && tokenData.trim()) {
            customAccessToken = tokenData.trim();
            const userRes = await fetch("https://api.github.com/user", {
              headers: {
                "User-Agent": "QueroVagas-DevTrustEngine/1.0",
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${customAccessToken}`,
              },
            });

            if (userRes.ok) {
              const userData = (await userRes.json()) as {
                id?: number;
                login?: string;
                name?: string;
                avatar_url?: string;
              };
              if (userData.login) {
                candidateUsername = userData.login;
                name = userData.name || userData.login;
                avatarUrl = userData.avatar_url;
                candidateId = userData.id;
              }
            }
          }
        }
      } catch (err) {
        console.warn("[UtterancesAuth] Falha ao validar sessão do Utterances:", err);
      }
    }

    if (!candidateUsername) {
      res.status(400).json({ error: "Sessão do Utterances inválida ou usuário não identificado" });
      return;
    }

    // Se ainda não temos os metadados do perfil (ex: chamada direta por username), busca na API pública do GitHub
    if (!name && !avatarUrl) {
      try {
        const headers: Record<string, string> = {
          "User-Agent": "QueroVagas-DevTrustEngine/1.0",
          Accept: "application/vnd.github+json",
        };
        if (DEV_AUDIT_TOKEN) {
          headers["Authorization"] = `Bearer ${DEV_AUDIT_TOKEN}`;
        }
        const ghRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(candidateUsername)}`,
          { headers },
        );
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as {
            id?: number;
            avatar_url?: string;
            name?: string;
            login?: string;
          };
          avatarUrl = ghData.avatar_url;
          name = ghData.name || ghData.login || candidateUsername;
          candidateId = candidateId || ghData.id;
          if (ghData.login) {
            candidateUsername = ghData.login;
          }
        }
      } catch {
        // Ignora falhas de rede na busca complementar do perfil
      }
    }

    const isVerified = await checkDeveloperReputation(candidateUsername, customAccessToken, candidateId);

    if (isVerified) {
      const trustToken = generateTrustToken(candidateUsername);
      res.json({
        ok: true,
        isVerified: true,
        trustToken,
        username: candidateUsername,
        user: {
          username: candidateUsername,
          name: name || candidateUsername,
          avatarUrl,
        },
      });
      return;
    }

    res.json({
      ok: true,
      isVerified: false,
      username: candidateUsername,
      user: {
        username: candidateUsername,
        name: name || candidateUsername,
        avatarUrl,
      },
      message: "Perfil identificado via Utterances.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao validar perfil";
    res.status(500).json({ error: msg });
  }
});

app.get("/auth/session", async (req: Request, res: Response) => {
  const trustHeader = (req.headers["x-trust-token"] || req.query.trust_token) as string | undefined;
  const { valid, username } = verifyTrustToken(trustHeader);

  if (!valid || !username) {
    res.json({
      isVerified: false,
      username: null,
      user: null,
    });
    return;
  }

  let resolvedUsername = username;
  let name = username;
  let avatarUrl: string | undefined;

  try {
    const headers: Record<string, string> = {
      "User-Agent": "QueroVagas-DevTrustEngine/1.0",
      Accept: "application/vnd.github+json",
    };
    if (DEV_AUDIT_TOKEN && !DEV_AUDIT_TOKEN.startsWith("vercel_")) {
      headers["Authorization"] = `Bearer ${DEV_AUDIT_TOKEN}`;
    }
    const ghRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      { headers },
    );
    if (ghRes.ok) {
      const ghData = (await ghRes.json()) as {
        login?: string;
        name?: string;
        avatar_url?: string;
      };
      resolvedUsername = ghData.login || username;
      name = ghData.name || resolvedUsername;
      avatarUrl = ghData.avatar_url;
    }
  } catch {
    // Fallback para username extraído do token assinado
  }

  res.json({
    isVerified: true,
    username: resolvedUsername,
    user: {
      username: resolvedUsername,
      name,
      avatarUrl,
    },
  });
});

// -------------------------------------------------------------
// 1.1 EMPRESAS & SUGESTÕES COMUNITÁRIAS (RADAR DE EMPRESAS)
// -------------------------------------------------------------
interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  ats: string;
  careerUrl: string;
  status: "MONITORED" | "PENDING_CRAWLER" | "SUGGESTED";
  activeJobsCount?: number;
  hasTechJobs?: boolean;
  lastScrapedAt?: string;
  suggestedBy?: string;
  votesCount?: number;
  notes?: string;
  createdAt?: string;
}

// Armazenamento em memória com catálogo consolidado (funciona em Node, Edge, Serverless e JSDOM)
const communitySuggestions: CompanyRecord[] = [];

const readSuggestions = (): CompanyRecord[] => {
  return [...communitySuggestions];
};

const writeSuggestions = (list: CompanyRecord[]): void => {
  communitySuggestions.length = 0;
  communitySuggestions.push(...list);
};

const initialCatalog: CompanyRecord[] = [
  {
    "id": "comp-gupy-govbr",
    "name": "#vemserGOVBR",
    "slug": "govbr",
    "ats": "GUPY",
    "careerUrl": "https://govbr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-maisaedu",
    "name": "+A Educação",
    "slug": "maisaedu",
    "ats": "GUPY",
    "careerUrl": "https://maisaedu.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-maisaedu-tech",
    "name": "+A Educação Tech",
    "slug": "maisaedu-tech",
    "ats": "GUPY",
    "careerUrl": "https://maisaedu-tech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-180seguros",
    "name": "180 Seguros",
    "slug": "180seguros",
    "ats": "INHIRE",
    "careerUrl": "https://180seguros.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-1doc",
    "name": "1Doc",
    "slug": "1doc",
    "ats": "GUPY",
    "careerUrl": "https://1doc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-2comconsulting",
    "name": "2Com Consulting",
    "slug": "2comconsulting",
    "ats": "GUPY",
    "careerUrl": "https://2comconsulting.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-2future",
    "name": "2Future",
    "slug": "2future",
    "ats": "INHIRE",
    "careerUrl": "https://2future.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-3amining",
    "name": "3amining",
    "slug": "3amining",
    "ats": "INHIRE",
    "careerUrl": "https://3amining.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-3cservices",
    "name": "3C Services",
    "slug": "3cservices",
    "ats": "GUPY",
    "careerUrl": "https://3cservices.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-3corptechnology",
    "name": "3CORP Technology",
    "slug": "3corptechnology",
    "ats": "GUPY",
    "careerUrl": "https://3corptechnology.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-3cplusnow",
    "name": "3cplusnow",
    "slug": "3cplusnow",
    "ats": "INHIRE",
    "careerUrl": "https://3cplusnow.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-3dcriar",
    "name": "3DCRIAR",
    "slug": "3dcriar",
    "ats": "INHIRE",
    "careerUrl": "https://3dcriar.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-3rpetroleum",
    "name": "3R PETROLEUM",
    "slug": "3rpetroleum",
    "ats": "GUPY",
    "careerUrl": "https://3rpetroleum.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-talentos3stecnologia",
    "name": "3S Tecnologia",
    "slug": "talentos3stecnologia",
    "ats": "GUPY",
    "careerUrl": "https://talentos3stecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-3tentos",
    "name": "3tentos - Faça parte do nosso time!",
    "slug": "3tentos",
    "ats": "GUPY",
    "careerUrl": "https://3tentos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-4mk",
    "name": "4MK Solutions",
    "slug": "4mk",
    "ats": "GUPY",
    "careerUrl": "https://4mk.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-5ccompany",
    "name": "5C Company LLC",
    "slug": "5ccompany",
    "ats": "INHIRE",
    "careerUrl": "https://5ccompany.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-77sol",
    "name": "77Sol",
    "slug": "77sol",
    "ats": "GUPY",
    "careerUrl": "https://77sol.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-a-players",
    "name": "A Players",
    "slug": "a-players",
    "ats": "INHIRE",
    "careerUrl": "https://a-players.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-maersk",
    "name": "A.P. Moller - Maersk",
    "slug": "maersk",
    "ats": "WORKDAY",
    "careerUrl": "https://maersk.wd3.myworkdayjobs.com/pt-BR/Maersk_Careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-a2fbr",
    "name": "A2FBR",
    "slug": "a2fbr",
    "ats": "INHIRE",
    "careerUrl": "https://a2fbr.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-a3consultoria",
    "name": "A3 Consultoria",
    "slug": "a3consultoria",
    "ats": "GUPY",
    "careerUrl": "https://a3consultoria.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-a3data",
    "name": "A3Data",
    "slug": "a3data",
    "ats": "GUPY",
    "careerUrl": "https://a3data.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aacd",
    "name": "AACD",
    "slug": "aacd",
    "ats": "GUPY",
    "careerUrl": "https://aacd.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-aawzpartners",
    "name": "AAWZ Partners",
    "slug": "aawzpartners",
    "ats": "SOLIDES",
    "careerUrl": "https://aawzpartners.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-abakids",
    "name": "Abakids",
    "slug": "abakids",
    "ats": "GUPY",
    "careerUrl": "https://abakids.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aberttasaude",
    "name": "Abertta Saúde",
    "slug": "aberttasaude",
    "ats": "GUPY",
    "careerUrl": "https://aberttasaude.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-abtatividades",
    "name": "Abtatividades",
    "slug": "abtatividades",
    "ats": "INHIRE",
    "careerUrl": "https://abtatividades.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-abzservicos",
    "name": "ABZ Serviços LTDA",
    "slug": "abzservicos",
    "ats": "INHIRE",
    "careerUrl": "https://abzservicos.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-accenture",
    "name": "Accenture",
    "slug": "accenture",
    "ats": "WORKDAY",
    "careerUrl": "https://accenture.wd103.myworkdayjobs.com/pt-BR/AccentureCareers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vempraaccesstage",
    "name": "Accesstage",
    "slug": "vempraaccesstage",
    "ats": "INHIRE",
    "careerUrl": "https://vempraaccesstage.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-bluefieldsdev",
    "name": "Aceleradora Bluefields",
    "slug": "bluefieldsdev",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/bluefieldsdev",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-acerto",
    "name": "Acerto",
    "slug": "acerto",
    "ats": "INHIRE",
    "careerUrl": "https://acerto.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-acme",
    "name": "Acme",
    "slug": "acme",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/acme",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-acomsistemas",
    "name": "ACOM Sistemas",
    "slug": "acomsistemas",
    "ats": "SOLIDES",
    "careerUrl": "https://acomsistemas.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-activecampaign",
    "name": "ActiveCampaign",
    "slug": "activecampaign",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/activecampaign",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-adatech",
    "name": "Ada Tech",
    "slug": "adatech",
    "ats": "GUPY",
    "careerUrl": "https://adatech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-adias",
    "name": "Adias Sol.Ar.",
    "slug": "adias",
    "ats": "INHIRE",
    "careerUrl": "https://adias.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-adsplay",
    "name": "Adsplay",
    "slug": "adsplay",
    "ats": "INHIRE",
    "careerUrl": "https://adsplay.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-adtail",
    "name": "Adtail",
    "slug": "adtail",
    "ats": "GUPY",
    "careerUrl": "https://adtail.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-advbox",
    "name": "Advbox Software Jurídico",
    "slug": "advbox",
    "ats": "INHIRE",
    "careerUrl": "https://advbox.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-aec",
    "name": "AeC",
    "slug": "aec",
    "ats": "PANDAPE",
    "careerUrl": "https://aec.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aegea",
    "name": "Aegea Saneamento",
    "slug": "aegea",
    "ats": "GUPY",
    "careerUrl": "https://aegea.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aegro",
    "name": "Aegro",
    "slug": "aegro",
    "ats": "GUPY",
    "careerUrl": "https://aegro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aevo",
    "name": "Aevo",
    "slug": "aevo",
    "ats": "GUPY",
    "careerUrl": "https://aevo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-afinz",
    "name": "Afinz",
    "slug": "afinz",
    "ats": "GUPY",
    "careerUrl": "https://afinz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-afya",
    "name": "Afya",
    "slug": "afya",
    "ats": "GUPY",
    "careerUrl": "https://afya.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasagendalovers",
    "name": "Agenda Edu",
    "slug": "vagasagendalovers",
    "ats": "GUPY",
    "careerUrl": "https://vagasagendalovers.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-agendor",
    "name": "Agendor",
    "slug": "agendor",
    "ats": "GUPY",
    "careerUrl": "https://agendor.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-agibank",
    "name": "Agibank",
    "slug": "agibank",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/agibank",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-agilize",
    "name": "Agilize",
    "slug": "agilize",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/agilize",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-agrosearch",
    "name": "AGROSearch",
    "slug": "agrosearch",
    "ats": "INHIRE",
    "careerUrl": "https://agrosearch.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-agrosys",
    "name": "Agrosys Tecnologia | Tecnologia em Agronegócio",
    "slug": "agrosys",
    "ats": "GUPY",
    "careerUrl": "https://agrosys.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-agrotools",
    "name": "Agrotools",
    "slug": "agrotools",
    "ats": "INHIRE",
    "careerUrl": "https://agrotools.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-agrotools",
    "name": "Agrotools",
    "slug": "agrotools",
    "ats": "GUPY",
    "careerUrl": "https://agrotools.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ahgora",
    "name": "Ahgora",
    "slug": "ahgora",
    "ats": "GUPY",
    "careerUrl": "https://ahgora.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-aiko",
    "name": "Aiko",
    "slug": "aiko",
    "ats": "INHIRE",
    "careerUrl": "https://aiko.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ailu",
    "name": "Ailu",
    "slug": "ailu",
    "ats": "INHIRE",
    "careerUrl": "https://cidadaniaja.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aiqfome",
    "name": "aiqfome",
    "slug": "aiqfome",
    "ats": "GUPY",
    "careerUrl": "https://aiqfome.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-airapps",
    "name": "Air Apps",
    "slug": "airapps",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/airapps",
    "status": "MONITORED",
    "activeJobsCount": 195,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-akadseguros",
    "name": "Akad Seguros",
    "slug": "akadseguros",
    "ats": "INHIRE",
    "careerUrl": "https://akadseguros.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alana",
    "name": "Alana",
    "slug": "alana",
    "ats": "INHIRE",
    "careerUrl": "https://alana.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-alcans",
    "name": "ALCANS",
    "slug": "alcans",
    "ats": "SOLIDES",
    "careerUrl": "https://alcans.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alea",
    "name": "Alea",
    "slug": "alea",
    "ats": "INHIRE",
    "careerUrl": "https://alea.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alelo",
    "name": "Alelo Brasil",
    "slug": "alelo",
    "ats": "INHIRE",
    "careerUrl": "https://alelo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-aleph",
    "name": "Aleph",
    "slug": "aleph",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/aleph",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-seja-alest",
    "name": "Alest Consultoria",
    "slug": "seja-alest",
    "ats": "GUPY",
    "careerUrl": "https://seja-alest.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-algar",
    "name": "Algar Tech",
    "slug": "algar",
    "ats": "GUPY",
    "careerUrl": "https://algar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alianca",
    "name": "Aliança Condomínios",
    "slug": "alianca",
    "ats": "INHIRE",
    "careerUrl": "https://alianca.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aliare",
    "name": "Aliare",
    "slug": "aliare",
    "ats": "GUPY",
    "careerUrl": "https://aliare.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alicerce",
    "name": "Alicerce",
    "slug": "alicerce",
    "ats": "INHIRE",
    "careerUrl": "https://alicerce.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-aliseo",
    "name": "Aliseo S.A.",
    "slug": "aliseo",
    "ats": "INHIRE",
    "careerUrl": "https://aliseo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-allset",
    "name": "All Set Comunicação",
    "slug": "allset",
    "ats": "INHIRE",
    "careerUrl": "https://allset.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-alliage",
    "name": "Alliage",
    "slug": "alliage",
    "ats": "GUPY",
    "careerUrl": "https://alliage.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alliage",
    "name": "Alliage",
    "slug": "alliage",
    "ats": "INHIRE",
    "careerUrl": "https://alliage.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-allintra",
    "name": "Allintra",
    "slug": "allintra",
    "ats": "INHIRE",
    "careerUrl": "https://allintra.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-allohafibra",
    "name": "Alloha Fibra",
    "slug": "allohafibra",
    "ats": "GUPY",
    "careerUrl": "https://allohafibra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-carreirasallos",
    "name": "ALLOS",
    "slug": "carreirasallos",
    "ats": "GUPY",
    "careerUrl": "https://carreirasallos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alloyal",
    "name": "Alloyal",
    "slug": "alloyal",
    "ats": "INHIRE",
    "careerUrl": "https://alloyal.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-allu",
    "name": "Allu",
    "slug": "allu",
    "ats": "INHIRE",
    "careerUrl": "https://allu.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-tryalma",
    "name": "Alma",
    "slug": "tryalma",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/tryalma",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-portergroup",
    "name": "Almah",
    "slug": "portergroup",
    "ats": "INHIRE",
    "careerUrl": "https://portergroup.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-almavivaexperience",
    "name": "AlmavivA Experience",
    "slug": "almavivaexperience",
    "ats": "PANDAPE",
    "careerUrl": "https://almavivaexperience.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-almavivasolutions",
    "name": "Almaviva Solutions",
    "slug": "almavivasolutions",
    "ats": "GUPY",
    "careerUrl": "https://almavivasolutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-almeidajunior",
    "name": "Almeida Junior Shopping Centers",
    "slug": "almeidajunior",
    "ats": "INHIRE",
    "careerUrl": "https://almeidajunior.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-aloiaaerospace",
    "name": "ALOIA AEROSPACE INC",
    "slug": "aloiaaerospace",
    "ats": "INHIRE",
    "careerUrl": "https://aloiaaerospace.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-alpargatas",
    "name": "Alpargatas",
    "slug": "alpargatas",
    "ats": "GUPY",
    "careerUrl": "https://alpargatas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-alpercarreiras",
    "name": "Alper",
    "slug": "alpercarreiras",
    "ats": "GUPY",
    "careerUrl": "https://alpercarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-alslifesciences",
    "name": "ALS",
    "slug": "alslifesciences",
    "ats": "GUPY",
    "careerUrl": "https://alslifesciences.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-ridealso",
    "name": "ALSO",
    "slug": "ridealso",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ridealso",
    "status": "MONITORED",
    "activeJobsCount": 15,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-altbank",
    "name": "alt.bank",
    "slug": "altbank",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/altbank",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-carreirasaltave",
    "name": "ALTAVE",
    "slug": "carreirasaltave",
    "ats": "SOLIDES",
    "careerUrl": "https://carreirasaltave.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-alterdata",
    "name": "Alterdata",
    "slug": "alterdata",
    "ats": "GUPY",
    "careerUrl": "https://alterdata.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-altervision",
    "name": "AlterVision",
    "slug": "altervision",
    "ats": "INHIRE",
    "careerUrl": "https://altervision.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-altom-transport",
    "name": "Altom Transport",
    "slug": "altom-transport",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/altom-transport",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-altoqi",
    "name": "AltoQi",
    "slug": "altoqi",
    "ats": "INHIRE",
    "careerUrl": "https://altoqi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alume",
    "name": "Alume",
    "slug": "alume",
    "ats": "INHIRE",
    "careerUrl": "https://alume.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alun",
    "name": "Alun",
    "slug": "alun",
    "ats": "INHIRE",
    "careerUrl": "https://alun.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alura",
    "name": "Alura",
    "slug": "alura",
    "ats": "INHIRE",
    "careerUrl": "https://alun.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alura-fiap-pm3",
    "name": "Alura Fiap Pm3",
    "slug": "alura-fiap-pm3",
    "ats": "INHIRE",
    "careerUrl": "https://alura-fiap-pm3.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-programasambev",
    "name": "Ambev",
    "slug": "programasambev",
    "ats": "GUPY",
    "careerUrl": "https://programasambev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ambev",
    "name": "AMBEV",
    "slug": "ambev",
    "ats": "GUPY",
    "careerUrl": "https://ambev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-amchamcarreiras",
    "name": "Amcham-Brasil",
    "slug": "amchamcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://amchamcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-amcom",
    "name": "amcom.inhire.app",
    "slug": "amcom",
    "ats": "INHIRE",
    "careerUrl": "https://amcom.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 33,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ame",
    "name": "AME",
    "slug": "ame",
    "ats": "GUPY",
    "careerUrl": "https://ame.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-amicci",
    "name": "Amicci",
    "slug": "amicci",
    "ats": "INHIRE",
    "careerUrl": "https://amicci.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-amorimglobal",
    "name": "Amorim Global",
    "slug": "amorimglobal",
    "ats": "SOLIDES",
    "careerUrl": "https://amorimglobal.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-amorsaude1",
    "name": "AmorSaúde",
    "slug": "amorsaude1",
    "ats": "PANDAPE",
    "careerUrl": "https://amorsaude1.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-selecty-amplimed",
    "name": "Amplimed",
    "slug": "amplimed",
    "ats": "SELECTY",
    "careerUrl": "https://amplimed.selecty.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-anacouto",
    "name": "Ana Couto",
    "slug": "anacouto",
    "ats": "INHIRE",
    "careerUrl": "https://anacouto.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-anagaming",
    "name": "Ana Gaming",
    "slug": "anagaming",
    "ats": "INHIRE",
    "careerUrl": "https://anagaming.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-anbima",
    "name": "ANBIMA",
    "slug": "anbima",
    "ats": "GUPY",
    "careerUrl": "https://anbima.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-andrademaia",
    "name": "Andrademaia",
    "slug": "andrademaia",
    "ats": "INHIRE",
    "careerUrl": "https://andrademaia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-anima",
    "name": "Anima",
    "slug": "anima",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/anima",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-anotaai",
    "name": "Anota AI",
    "slug": "anotaai",
    "ats": "GUPY",
    "careerUrl": "https://anotaai.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-aogarciaagency",
    "name": "AO Garcia Agency",
    "slug": "aogarciaagency",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/aogarciaagency",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-eloca",
    "name": "AOGE SISTEMAS S.A.",
    "slug": "eloca",
    "ats": "SOLIDES",
    "careerUrl": "https://eloca.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aoop",
    "name": "Aoop Cloud Solutions",
    "slug": "aoop",
    "ats": "GUPY",
    "careerUrl": "https://aoop.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ap-digital-services",
    "name": "Ap Digital Services",
    "slug": "ap-digital-services",
    "ats": "INHIRE",
    "careerUrl": "https://ap-digital-services.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 5,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-trabalhenaapas",
    "name": "APAS - Associação Paulista de Supermercados",
    "slug": "trabalhenaapas",
    "ats": "GUPY",
    "careerUrl": "https://trabalhenaapas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-apdata",
    "name": "Apdata",
    "slug": "apdata",
    "ats": "RECRUTAI",
    "careerUrl": "https://apdata.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-betbr",
    "name": "Apostou.Bet",
    "slug": "betbr",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/betbr",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-appfacilita",
    "name": "Appfacilita",
    "slug": "appfacilita",
    "ats": "INHIRE",
    "careerUrl": "https://appfacilita.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-applied",
    "name": "Applied Intuition",
    "slug": "applied",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/applied",
    "status": "MONITORED",
    "activeJobsCount": 175,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-appmax",
    "name": "Appmax",
    "slug": "appmax",
    "ats": "INHIRE",
    "careerUrl": "https://appmax.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-aprix",
    "name": "Aprix",
    "slug": "aprix",
    "ats": "INHIRE",
    "careerUrl": "https://aprix.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aprovadigital",
    "name": "Aprova",
    "slug": "aprovadigital",
    "ats": "GUPY",
    "careerUrl": "https://aprovadigital.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-aprova",
    "name": "Aprova",
    "slug": "aprova",
    "ats": "INHIRE",
    "careerUrl": "https://aprova.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aramis",
    "name": "Aramis",
    "slug": "aramis",
    "ats": "GUPY",
    "careerUrl": "https://aramis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-arcca",
    "name": "arcca",
    "slug": "arcca",
    "ats": "GUPY",
    "careerUrl": "https://arcca.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-arcoeducacao",
    "name": "Arco Educação",
    "slug": "arcoeducacao",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/arcoeducacao",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-corporativomc",
    "name": "Arcos Dorados",
    "slug": "corporativomc",
    "ats": "GUPY",
    "careerUrl": "https://corporativomc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-arcosscale",
    "name": "Arcos Scale",
    "slug": "arcosscale",
    "ats": "INHIRE",
    "careerUrl": "https://arcosscale.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-azzasshoesbags",
    "name": "Arezzo&Co",
    "slug": "azzasshoesbags",
    "ats": "GUPY",
    "careerUrl": "https://azzasshoesbags.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-arondite",
    "name": "Arondite",
    "slug": "arondite",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/arondite",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-arttha",
    "name": "Arttha (Empresa Recrutadora)",
    "slug": "arttha",
    "ats": "GUPY",
    "careerUrl": "https://arttha.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-asa",
    "name": "ASA Indústria",
    "slug": "asa",
    "ats": "INHIRE",
    "careerUrl": "https://asa.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-asaas",
    "name": "Asaas",
    "slug": "asaas",
    "ats": "GUPY",
    "careerUrl": "https://asaas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-asiashipping",
    "name": "Asia Shipping",
    "slug": "asiashipping",
    "ats": "GUPY",
    "careerUrl": "https://asiashipping.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-sankhya",
    "name": "Asis",
    "slug": "sankhya",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/sankhya",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recruitee-asksuite",
    "name": "Asksuite",
    "slug": "asksuite",
    "ats": "RECRUITEE",
    "careerUrl": "https://asksuite.recruitee.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-aspentech",
    "name": "Aspen Technology",
    "slug": "aspentech",
    "ats": "WORKDAY",
    "careerUrl": "https://aspentech.wd5.myworkdayjobs.com/aspentech/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-assai",
    "name": "Assaí Atacadista",
    "slug": "assai",
    "ats": "GUPY",
    "careerUrl": "https://assai.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-assertiva",
    "name": "Assertiva",
    "slug": "assertiva",
    "ats": "GUPY",
    "careerUrl": "https://assertiva.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-assessoriavip",
    "name": "Assessoria VIP",
    "slug": "assessoriavip",
    "ats": "GUPY",
    "careerUrl": "https://assessoriavip.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-begrowth",
    "name": "Assiny",
    "slug": "begrowth",
    "ats": "INHIRE",
    "careerUrl": "https://begrowth.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-anerd",
    "name": "Associated Nerd Global",
    "slug": "anerd",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/anerd",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupocarrefourbrasil",
    "name": "Atacadão",
    "slug": "grupocarrefourbrasil",
    "ats": "GUPY",
    "careerUrl": "https://grupocarrefourbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-atento",
    "name": "Atento",
    "slug": "atento",
    "ats": "GUPY",
    "careerUrl": "https://atento.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-atlastechnol",
    "name": "Atlas",
    "slug": "atlastechnol",
    "ats": "INHIRE",
    "careerUrl": "https://atlastechnol.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-atlas-governance",
    "name": "Atlas Governance",
    "slug": "atlas-governance",
    "ats": "GUPY",
    "careerUrl": "https://atlas-governance.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-atlasxhm",
    "name": "Atlas HXM",
    "slug": "atlasxhm",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/atlasxhm",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-atslog",
    "name": "ATS Jornada by nstech",
    "slug": "atslog",
    "ats": "GUPY",
    "careerUrl": "https://atslog.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-attus",
    "name": "Attus Procuradoria Digital",
    "slug": "attus",
    "ats": "GUPY",
    "careerUrl": "https://attus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-atua",
    "name": "Atua by nstech",
    "slug": "atua",
    "ats": "GUPY",
    "careerUrl": "https://atua.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-audaces",
    "name": "Audaces",
    "slug": "audaces",
    "ats": "INHIRE",
    "careerUrl": "https://audaces.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aurenenergia",
    "name": "Auren Energia",
    "slug": "aurenenergia",
    "ats": "GUPY",
    "careerUrl": "https://aurenenergia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-aurum",
    "name": "Aurum",
    "slug": "aurum",
    "ats": "GUPY",
    "careerUrl": "https://aurum.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-autbank",
    "name": "Autbank",
    "slug": "autbank",
    "ats": "GUPY",
    "careerUrl": "https://autbank.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-autoconf",
    "name": "Autoconf",
    "slug": "autoconf",
    "ats": "SOLIDES",
    "careerUrl": "https://autoconf.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-autoforce",
    "name": "AutoForce",
    "slug": "autoforce",
    "ats": "GUPY",
    "careerUrl": "https://autoforce.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-automob",
    "name": "AUTOMOB",
    "slug": "automob",
    "ats": "GUPY",
    "careerUrl": "https://automob.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-autopark",
    "name": "Autopark Estacionamentos",
    "slug": "autopark",
    "ats": "PANDAPE",
    "careerUrl": "https://autopark.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-autopass",
    "name": "Autopass",
    "slug": "autopass",
    "ats": "INHIRE",
    "careerUrl": "https://autopass.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-auvotecnologia",
    "name": "Auvo Tecnologia",
    "slug": "auvotecnologia",
    "ats": "INHIRE",
    "careerUrl": "https://auvotecnologia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-auvpcapital",
    "name": "AUVP",
    "slug": "auvpcapital",
    "ats": "GUPY",
    "careerUrl": "https://auvpcapital.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-azos",
    "name": "Azos",
    "slug": "azos",
    "ats": "INHIRE",
    "careerUrl": "https://azos.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruposoma",
    "name": "AZZAS 2154 / GRUPO SOMA",
    "slug": "gruposoma",
    "ats": "GUPY",
    "careerUrl": "https://gruposoma.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-blab",
    "name": "B Lab",
    "slug": "blab",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/blab",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-vemserbairru",
    "name": "BairrU",
    "slug": "vemserbairru",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/vemserbairru",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bbc_digital",
    "name": "Banco BBC Digital",
    "slug": "bbc_digital",
    "ats": "GUPY",
    "careerUrl": "https://bbc_digital.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bradesco",
    "name": "Banco Bradesco",
    "slug": "bradesco",
    "ats": "INHIRE",
    "careerUrl": "https://bradesco.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bancobs2",
    "name": "Banco BS2",
    "slug": "bancobs2",
    "ats": "INHIRE",
    "careerUrl": "https://bancobs2.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-bv",
    "name": "banco BV",
    "slug": "bv",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/bv",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bancodaycoval",
    "name": "Banco Daycoval",
    "slug": "bancodaycoval",
    "ats": "GUPY",
    "careerUrl": "https://bancodaycoval.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bancofibra",
    "name": "Banco Fibra",
    "slug": "bancofibra",
    "ats": "GUPY",
    "careerUrl": "https://bancofibra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-inter",
    "name": "Banco Inter",
    "slug": "inter",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/inter",
    "status": "MONITORED",
    "activeJobsCount": 15,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mercantil",
    "name": "Banco Mercantil",
    "slug": "mercantil",
    "ats": "GUPY",
    "careerUrl": "https://mercantil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-bancopan",
    "name": "Banco Pan",
    "slug": "bancopan",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/bancopan",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bancopine",
    "name": "Banco Pine",
    "slug": "bancopine",
    "ats": "INHIRE",
    "careerUrl": "https://bancopine.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-venhasersafra",
    "name": "Banco Safra",
    "slug": "venhasersafra",
    "ats": "GUPY",
    "careerUrl": "https://venhasersafra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-santander",
    "name": "Banco Santander",
    "slug": "santander",
    "ats": "WORKDAY",
    "careerUrl": "https://santander.wd3.myworkdayjobs.com/pt-BR/SantanderCareers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bancotoyota",
    "name": "Banco Toyota do Brasil",
    "slug": "bancotoyota",
    "ats": "INHIRE",
    "careerUrl": "https://bancotoyota.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bankme",
    "name": "Bankme",
    "slug": "bankme",
    "ats": "INHIRE",
    "careerUrl": "https://bankme.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-baseten",
    "name": "Baseten",
    "slug": "baseten",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/baseten",
    "status": "MONITORED",
    "activeJobsCount": 35,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-basis-ai",
    "name": "Basis AI",
    "slug": "basis-ai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/basis-ai",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bauducco",
    "name": "Bauducco",
    "slug": "bauducco",
    "ats": "GUPY",
    "careerUrl": "https://bauducco.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-be",
    "name": "Be - Currículo Bilíngue",
    "slug": "be",
    "ats": "SOLIDES",
    "careerUrl": "https://be.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bealiant",
    "name": "Be.Aliant",
    "slug": "bealiant",
    "ats": "GUPY",
    "careerUrl": "https://bealiant.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-beerorcoffee",
    "name": "BeerOrCoffee | Woba",
    "slug": "beerorcoffee",
    "ats": "GUPY",
    "careerUrl": "https://beerorcoffee.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-abinbev",
    "name": "BEES",
    "slug": "abinbev",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/abinbev",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-bees",
    "name": "BEES",
    "slug": "bees",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/bees",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bemobi",
    "name": "Bemobi",
    "slug": "bemobi",
    "ats": "GUPY",
    "careerUrl": "https://bemobi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserbenner",
    "name": "Benner",
    "slug": "vemserbenner",
    "ats": "GUPY",
    "careerUrl": "https://vemserbenner.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-benvistaoftalmologia",
    "name": "Benvista Oftalmologia",
    "slug": "benvistaoftalmologia",
    "ats": "SOLIDES",
    "careerUrl": "https://benvistaoftalmologia.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserbern-grt",
    "name": "Bernhöft",
    "slug": "vemserbern-grt",
    "ats": "GUPY",
    "careerUrl": "https://vemserbern-grt.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bernoullieducacao",
    "name": "Bernoulli Educação",
    "slug": "bernoullieducacao",
    "ats": "GUPY",
    "careerUrl": "https://bernoullieducacao.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-besserhome",
    "name": "Besser Home",
    "slug": "besserhome",
    "ats": "SOLIDES",
    "careerUrl": "https://besserhome.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bethasistemas",
    "name": "Betha Sistemas",
    "slug": "bethasistemas",
    "ats": "GUPY",
    "careerUrl": "https://bethasistemas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-beyond",
    "name": "Beyond Co.",
    "slug": "beyond",
    "ats": "INHIRE",
    "careerUrl": "https://extremegroup.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-imaginebeyond",
    "name": "Beyond Soluções",
    "slug": "imaginebeyond",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/imaginebeyond",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bionexo",
    "name": "Bionexo",
    "slug": "bionexo",
    "ats": "INHIRE",
    "careerUrl": "https://bionexo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprabip",
    "name": "Bip Brasil",
    "slug": "vemprabip",
    "ats": "GUPY",
    "careerUrl": "https://vemprabip.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bipa",
    "name": "Bipa",
    "slug": "bipa",
    "ats": "INHIRE",
    "careerUrl": "https://bipa.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-blip-global",
    "name": "Blip",
    "slug": "blip-global",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/blip-global",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-blip",
    "name": "Blip",
    "slug": "blip",
    "ats": "GUPY",
    "careerUrl": "https://blip.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-blockstream",
    "name": "Blockstream",
    "slug": "blockstream",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/blockstream",
    "status": "MONITORED",
    "activeJobsCount": 10,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-bmp",
    "name": "BMP",
    "slug": "bmp",
    "ats": "SOLIDES",
    "careerUrl": "https://bmp.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-board",
    "name": "Board Academy",
    "slug": "board",
    "ats": "INHIRE",
    "careerUrl": "https://board.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bom-controle",
    "name": "Bom Controle",
    "slug": "bom-controle",
    "ats": "INHIRE",
    "careerUrl": "https://milvus.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-bookfair",
    "name": "Book Fair",
    "slug": "bookfair",
    "ats": "SOLIDES",
    "careerUrl": "https://bookfair.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-boschgroup",
    "name": "Bosch Group",
    "slug": "boschgroup",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/BoschGroup",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-botcity",
    "name": "BotCity",
    "slug": "botcity",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/botcity",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-averis",
    "name": "Bracell",
    "slug": "averis",
    "ats": "WORKDAY",
    "careerUrl": "https://averis.wd3.myworkdayjobs.com/pt-BR/RGE",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-brandmonitor",
    "name": "Branddi",
    "slug": "brandmonitor",
    "ats": "GUPY",
    "careerUrl": "https://brandmonitor.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasbrasiltecpar",
    "name": "Brasil TecPar",
    "slug": "vagasbrasiltecpar",
    "ats": "GUPY",
    "careerUrl": "https://vagasbrasiltecpar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-brasilseg",
    "name": "Brasilseg",
    "slug": "brasilseg",
    "ats": "GUPY",
    "careerUrl": "https://brasilseg.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-brex",
    "name": "Brex",
    "slug": "brex",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/brex",
    "status": "MONITORED",
    "activeJobsCount": 91,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-brinks",
    "name": "Brink’s Inc",
    "slug": "brinks",
    "ats": "WORKDAY",
    "careerUrl": "https://brinks.wd5.myworkdayjobs.com/pt-BR/Carreiras_Brinks",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-britania",
    "name": "Britânia Eletrodomésticos",
    "slug": "britania",
    "ats": "PANDAPE",
    "careerUrl": "https://britania.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-brivia",
    "name": "Brivia",
    "slug": "brivia",
    "ats": "INHIRE",
    "careerUrl": "https://brivia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-brktecnologia",
    "name": "BRK Tecnologia",
    "slug": "brktecnologia",
    "ats": "GUPY",
    "careerUrl": "https://brktecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-brq",
    "name": "BRQ Digital Solutions",
    "slug": "brq",
    "ats": "INHIRE",
    "careerUrl": "https://brq.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-totvs-vempratotvs",
    "name": "Brudam",
    "slug": "vempratotvs",
    "ats": "TOTVS",
    "careerUrl": "https://atracaodetalentos.totvs.app/vempratotvs",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-bulbe",
    "name": "Bulbe Energia",
    "slug": "bulbe",
    "ats": "SOLIDES",
    "careerUrl": "https://bulbe.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-buonny",
    "name": "Buonny",
    "slug": "buonny",
    "ats": "GUPY",
    "careerUrl": "https://buonny.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-bussola",
    "name": "Bússola Social",
    "slug": "bussola",
    "ats": "INHIRE",
    "careerUrl": "https://bussola.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bydbrasil",
    "name": "BYD Brasil",
    "slug": "bydbrasil",
    "ats": "GUPY",
    "careerUrl": "https://bydbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-byx",
    "name": "byx",
    "slug": "byx",
    "ats": "INHIRE",
    "careerUrl": "https://byx.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cea",
    "name": "C&A Brasil",
    "slug": "cea",
    "ats": "GUPY",
    "careerUrl": "https://cea.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-c6bank",
    "name": "C6 BANK",
    "slug": "c6bank",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/c6bank",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cabonnet",
    "name": "Cabonnet",
    "slug": "cabonnet",
    "ats": "GUPY",
    "careerUrl": "https://cabonnet.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cacaushow",
    "name": "Cacau Show",
    "slug": "cacaushow",
    "ats": "GUPY",
    "careerUrl": "https://cacaushow.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cadastra",
    "name": "Cadastra",
    "slug": "cadastra",
    "ats": "GUPY",
    "careerUrl": "https://cadastra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-caf",
    "name": "Caf",
    "slug": "caf",
    "ats": "INHIRE",
    "careerUrl": "https://caf.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-caixavidaeprevidencia",
    "name": "Caixa Vida e Previdência",
    "slug": "caixavidaeprevidencia",
    "ats": "GUPY",
    "careerUrl": "https://caixavidaeprevidencia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-caju",
    "name": "Caju",
    "slug": "caju",
    "ats": "GUPY",
    "careerUrl": "https://caju.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-caloi",
    "name": "Caloi",
    "slug": "caloi",
    "ats": "GUPY",
    "careerUrl": "https://caloi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-camunda",
    "name": "Camunda",
    "slug": "camunda",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/camunda",
    "status": "MONITORED",
    "activeJobsCount": 16,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-canalverdeenergia",
    "name": "Canal Verde - Cooperativa de Energias Renováveis",
    "slug": "canalverdeenergia",
    "ats": "SOLIDES",
    "careerUrl": "https://canalverdeenergia.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-canonical",
    "name": "Canonical",
    "slug": "canonical",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/canonical",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-canva",
    "name": "Canva",
    "slug": "canva",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/Canva",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-capco",
    "name": "Capco",
    "slug": "capco",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/capco",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-capemisa",
    "name": "Capemisa",
    "slug": "capemisa",
    "ats": "GUPY",
    "careerUrl": "https://capemisa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-capitalupgrade",
    "name": "Capital Upgrade - CAUP",
    "slug": "capitalupgrade",
    "ats": "GUPY",
    "careerUrl": "https://capitalupgrade.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cappta",
    "name": "Cappta",
    "slug": "cappta",
    "ats": "INHIRE",
    "careerUrl": "https://cappta.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagascappta",
    "name": "CAPPTA",
    "slug": "vagascappta",
    "ats": "GUPY",
    "careerUrl": "https://vagascappta.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-capteii",
    "name": "Captei - Inteligência em Negócios Imobiliários",
    "slug": "capteii",
    "ats": "SOLIDES",
    "careerUrl": "https://capteii.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-captivateiq",
    "name": "CaptivateIQ",
    "slug": "captivateiq",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/captivateiq",
    "status": "MONITORED",
    "activeJobsCount": 9,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupocarbel",
    "name": "Carbel Auto Group",
    "slug": "grupocarbel",
    "ats": "GUPY",
    "careerUrl": "https://grupocarbel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-carbigdata",
    "name": "Carbigdata",
    "slug": "carbigdata",
    "ats": "INHIRE",
    "careerUrl": "https://carbigdata.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cardapioweb",
    "name": "Cardápio Web",
    "slug": "cardapioweb",
    "ats": "INHIRE",
    "careerUrl": "https://cardapioweb.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-carglass",
    "name": "CARGLASS",
    "slug": "carglass",
    "ats": "PANDAPE",
    "careerUrl": "https://carglass.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cargosapiens",
    "name": "Cargo Sapiens",
    "slug": "cargosapiens",
    "ats": "INHIRE",
    "careerUrl": "https://cargosapiens.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-carneirostemporada",
    "name": "Carneiros Temporada",
    "slug": "carneirostemporada",
    "ats": "SOLIDES",
    "careerUrl": "https://carneirostemporada.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-icatu",
    "name": "Carrefour Icatu brasil",
    "slug": "icatu",
    "ats": "INHIRE",
    "careerUrl": "https://icatu.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nscreen",
    "name": "Carreiras nScreen",
    "slug": "nscreen",
    "ats": "GUPY",
    "careerUrl": "https://nscreen.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-caveo",
    "name": "Caveo",
    "slug": "caveo",
    "ats": "INHIRE",
    "careerUrl": "https://caveo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-caylent",
    "name": "Caylent",
    "slug": "caylent",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/caylent",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-cellepensinodeidiomas",
    "name": "Cel.Lep Idiomas",
    "slug": "cellepensinodeidiomas",
    "ats": "PANDAPE",
    "careerUrl": "https://cellepensinodeidiomas.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-celcoin",
    "name": "Celcoin",
    "slug": "celcoin",
    "ats": "GUPY",
    "careerUrl": "https://celcoin.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-celcoin",
    "name": "Celcoin",
    "slug": "celcoin",
    "ats": "INHIRE",
    "careerUrl": "https://celcoin.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-celksistemas",
    "name": "CELK Sistemas",
    "slug": "celksistemas",
    "ats": "GUPY",
    "careerUrl": "https://celksistemas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-centaurotalentos",
    "name": "CENTAURO",
    "slug": "centaurotalentos",
    "ats": "GUPY",
    "careerUrl": "https://centaurotalentos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-centraldosbeneficiosnl",
    "name": "Central dos Benefícios",
    "slug": "centraldosbeneficiosnl",
    "ats": "SOLIDES",
    "careerUrl": "https://centraldosbeneficiosnl.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-centralit",
    "name": "Central IT",
    "slug": "centralit",
    "ats": "GUPY",
    "careerUrl": "https://centralit.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-faminasbh",
    "name": "Centro Universitário FAMINAS BH",
    "slug": "faminasbh",
    "ats": "SOLIDES",
    "careerUrl": "https://faminasbh.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cerc",
    "name": "CERC",
    "slug": "cerc",
    "ats": "INHIRE",
    "careerUrl": "https://cerc.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-certisign",
    "name": "Certisign",
    "slug": "certisign",
    "ats": "GUPY",
    "careerUrl": "https://certisign.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-certta",
    "name": "Certta",
    "slug": "certta",
    "ats": "INHIRE",
    "careerUrl": "https://certta.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-chaintech",
    "name": "Chaintech",
    "slug": "chaintech",
    "ats": "SOLIDES",
    "careerUrl": "https://chaintech.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-chatguru",
    "name": "ChatGuru",
    "slug": "chatguru",
    "ats": "INHIRE",
    "careerUrl": "https://chatguru.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-checkcommerce",
    "name": "Check Commerce",
    "slug": "checkcommerce",
    "ats": "SOLIDES",
    "careerUrl": "https://checkcommerce.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-ciandt",
    "name": "CI&T",
    "slug": "ciandt",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/CIAndT",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-cit",
    "name": "CI&T (Portal CIT)",
    "slug": "cit",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/CIT",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ciahering",
    "name": "Cia Hering",
    "slug": "ciahering",
    "ats": "GUPY",
    "careerUrl": "https://ciahering.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cidadaniaja",
    "name": "Cidadania Já",
    "slug": "cidadaniaja",
    "ats": "INHIRE",
    "careerUrl": "https://cidadaniaja.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cidadania4u",
    "name": "Cidadania4u",
    "slug": "cidadania4u",
    "ats": "GUPY",
    "careerUrl": "https://cidadania4u.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cidadecenternorte",
    "name": "Cidade Center Norte",
    "slug": "cidadecenternorte",
    "ats": "GUPY",
    "careerUrl": "https://cidadecenternorte.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cielo",
    "name": "Cielo",
    "slug": "cielo",
    "ats": "INHIRE",
    "careerUrl": "https://cielo.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cielo",
    "name": "Cielo",
    "slug": "cielo",
    "ats": "GUPY",
    "careerUrl": "https://cielo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-ciena",
    "name": "Ciena",
    "slug": "ciena",
    "ats": "WORKDAY",
    "careerUrl": "https://ciena.wd5.myworkdayjobs.com/en-US/Careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempracigam",
    "name": "CIGAM",
    "slug": "vempracigam",
    "ats": "GUPY",
    "careerUrl": "https://vempracigam.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cinemark",
    "name": "Cinemark Brasil",
    "slug": "cinemark",
    "ats": "GUPY",
    "careerUrl": "https://cinemark.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cinpal",
    "name": "Cinpal",
    "slug": "cinpal",
    "ats": "GUPY",
    "careerUrl": "https://cinpal.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cixcitizenexperience",
    "name": "CiX Citizen Experience",
    "slug": "cixcitizenexperience",
    "ats": "GUPY",
    "careerUrl": "https://cixcitizenexperience.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-clara",
    "name": "Clara",
    "slug": "clara",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/clara",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-claretianocolegio",
    "name": "Claretiano - Rede de Educação",
    "slug": "claretianocolegio",
    "ats": "GUPY",
    "careerUrl": "https://claretianocolegio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-clarke",
    "name": "Clarke Energia",
    "slug": "clarke",
    "ats": "GUPY",
    "careerUrl": "https://clarke.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-claro",
    "name": "Claro",
    "slug": "claro",
    "ats": "GUPY",
    "careerUrl": "https://claro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempraclaro",
    "name": "Claro Brasil",
    "slug": "vempraclaro",
    "ats": "GUPY",
    "careerUrl": "https://vempraclaro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-class-solutions",
    "name": "Class Solutions",
    "slug": "class-solutions",
    "ats": "GUPY",
    "careerUrl": "https://class-solutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-claylabs",
    "name": "Clay Labs",
    "slug": "claylabs",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/claylabs",
    "status": "MONITORED",
    "activeJobsCount": 15,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-clearsale",
    "name": "ClearSale",
    "slug": "clearsale",
    "ats": "GUPY",
    "careerUrl": "https://clearsale.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-clickcannabis",
    "name": "ClickCannabis",
    "slug": "clickcannabis",
    "ats": "SOLIDES",
    "careerUrl": "https://clickcannabis.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-clicksign",
    "name": "Clicksign",
    "slug": "clicksign",
    "ats": "GUPY",
    "careerUrl": "https://clicksign.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-clinicaexperts",
    "name": "Clínica Experts",
    "slug": "clinicaexperts",
    "ats": "INHIRE",
    "careerUrl": "https://clinicaexperts.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-clinicorp",
    "name": "Clinicorp",
    "slug": "clinicorp",
    "ats": "GUPY",
    "careerUrl": "https://clinicorp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-css",
    "name": "CloudKitchens",
    "slug": "css",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/css",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-coaktion",
    "name": "Coaktion",
    "slug": "coaktion",
    "ats": "INHIRE",
    "careerUrl": "https://coaktion.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cobli",
    "name": "Cobli",
    "slug": "cobli",
    "ats": "INHIRE",
    "careerUrl": "https://cobli.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemsermax",
    "name": "Cobmax",
    "slug": "vemsermax",
    "ats": "GUPY",
    "careerUrl": "https://vemsermax.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eightfold-coca-colafemsa",
    "name": "Coca-Cola FEMSA",
    "slug": "coca-colafemsa",
    "ats": "EIGHTFOLD",
    "careerUrl": "https://coca-colafemsa.eightfold.ai/careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-codenapp",
    "name": "Code n' App",
    "slug": "codenapp",
    "ats": "GUPY",
    "careerUrl": "https://codenapp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-codeart",
    "name": "Codeart",
    "slug": "codeart",
    "ats": "INHIRE",
    "careerUrl": "https://codeart.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cogna",
    "name": "Cogna",
    "slug": "cogna",
    "ats": "GUPY",
    "careerUrl": "https://cogna.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-cohere",
    "name": "Cohere",
    "slug": "cohere",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cohere",
    "status": "MONITORED",
    "activeJobsCount": 38,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-abaco",
    "name": "Colégio Ábaco",
    "slug": "abaco",
    "ats": "GUPY",
    "careerUrl": "https://abaco.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-colliers",
    "name": "Colliers",
    "slug": "colliers",
    "ats": "GUPY",
    "careerUrl": "https://colliers.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-comerc",
    "name": "Comerc Energia",
    "slug": "comerc",
    "ats": "GUPY",
    "careerUrl": "https://comerc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagascompanyhero",
    "name": "Company Hero",
    "slug": "vagascompanyhero",
    "ats": "GUPY",
    "careerUrl": "https://vagascompanyhero.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-compass",
    "name": "Compass.UOL",
    "slug": "compass",
    "ats": "GUPY",
    "careerUrl": "https://compass.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 10,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-concentrixbrasil",
    "name": "Concentrix",
    "slug": "concentrixbrasil",
    "ats": "PANDAPE",
    "careerUrl": "https://concentrixbrasil.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nova381",
    "name": "Concessionária de Rodovia Nova 381 S.A.",
    "slug": "nova381",
    "ats": "GUPY",
    "careerUrl": "https://nova381.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-5371",
    "name": "Conecta Consultoria Contábil",
    "slug": "5371",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/5371",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-conectcar",
    "name": "ConectCar",
    "slug": "conectcar",
    "ats": "GUPY",
    "careerUrl": "https://conectcar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-conexasaude",
    "name": "Conexa",
    "slug": "conexasaude",
    "ats": "GUPY",
    "careerUrl": "https://conexasaude.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-confiancemedical",
    "name": "Confiance Medical",
    "slug": "confiancemedical",
    "ats": "GUPY",
    "careerUrl": "https://confiancemedical.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-confitec",
    "name": "Confitec",
    "slug": "confitec",
    "ats": "GUPY",
    "careerUrl": "https://confitec.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-confluent",
    "name": "Confluent",
    "slug": "confluent",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/confluent",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-conquer",
    "name": "Conquer",
    "slug": "conquer",
    "ats": "GUPY",
    "careerUrl": "https://conquer.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mycon",
    "name": "Consórcio Mycon",
    "slug": "mycon",
    "ats": "GUPY",
    "careerUrl": "https://mycon.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-constructin",
    "name": "Construct IN",
    "slug": "constructin",
    "ats": "GUPY",
    "careerUrl": "https://constructin.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-construmarket",
    "name": "Construmarket",
    "slug": "construmarket",
    "ats": "GUPY",
    "careerUrl": "https://construmarket.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-contasimples",
    "name": "Conta Simples",
    "slug": "contasimples",
    "ats": "GUPY",
    "careerUrl": "https://contasimples.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-contabilizei",
    "name": "Contabilizei",
    "slug": "contabilizei",
    "ats": "INHIRE",
    "careerUrl": "https://contabilizei.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-trabalhenacontaja",
    "name": "Contajá",
    "slug": "trabalhenacontaja",
    "ats": "GUPY",
    "careerUrl": "https://trabalhenacontaja.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-trabalhecomacontmatic",
    "name": "Contmatic",
    "slug": "trabalhecomacontmatic",
    "ats": "SOLIDES",
    "careerUrl": "https://trabalhecomacontmatic.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutei-singularis-rh",
    "name": "Contratação Acelerada",
    "slug": "singularis-rh",
    "ats": "RECRUTEI",
    "careerUrl": "https://jobs.recrutei.com.br/singularis-rh",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-convenia",
    "name": "Convenia",
    "slug": "convenia",
    "ats": "GUPY",
    "careerUrl": "https://convenia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-rmeducacaoonline",
    "name": "Conversão Jurídica",
    "slug": "rmeducacaoonline",
    "ats": "PANDAPE",
    "careerUrl": "https://rmeducacaoonline.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-convisoappsec",
    "name": "Conviso",
    "slug": "convisoappsec",
    "ats": "GUPY",
    "careerUrl": "https://convisoappsec.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-copag",
    "name": "COPAG - Cartamundi Entertainment",
    "slug": "copag",
    "ats": "INHIRE",
    "careerUrl": "https://copag.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-copastur",
    "name": "COPASTUR VIAGENS E TURISMO",
    "slug": "copastur",
    "ats": "GUPY",
    "careerUrl": "https://copastur.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cora",
    "name": "Cora",
    "slug": "cora",
    "ats": "INHIRE",
    "careerUrl": "https://cora.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-corebiz",
    "name": "Corebiz",
    "slug": "corebiz",
    "ats": "GUPY",
    "careerUrl": "https://corebiz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-corporativopanvel",
    "name": "Corporativo Grupo Panvel",
    "slug": "corporativopanvel",
    "ats": "GUPY",
    "careerUrl": "https://corporativopanvel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cortex",
    "name": "Cortex",
    "slug": "cortex",
    "ats": "GUPY",
    "careerUrl": "https://cortex.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-cosuno",
    "name": "Cosuno",
    "slug": "cosuno",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cosuno",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-covergo",
    "name": "CoverGo",
    "slug": "covergo",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/covergo",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-recruitee-cpqd",
    "name": "CPQD",
    "slug": "cpqd",
    "ats": "RECRUITEE",
    "careerUrl": "https://cpqd.recruitee.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-credaluga",
    "name": "CredAluga",
    "slug": "credaluga",
    "ats": "INHIRE",
    "careerUrl": "https://credaluga.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-creditas",
    "name": "Creditas",
    "slug": "creditas",
    "ats": "GUPY",
    "careerUrl": "https://creditas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-creditsbrasil",
    "name": "Credits Brasil",
    "slug": "creditsbrasil",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/creditsbrasil",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-credsystem",
    "name": "credsystem",
    "slug": "credsystem",
    "ats": "GUPY",
    "careerUrl": "https://credsystem.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-crmbonus",
    "name": "CRMBonus",
    "slug": "crmbonus",
    "ats": "INHIRE",
    "careerUrl": "https://crmbonus.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-crowdstrike",
    "name": "CrowdStrike",
    "slug": "crowdstrike",
    "ats": "WORKDAY",
    "careerUrl": "https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-crusoe",
    "name": "Crusoe",
    "slug": "crusoe",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/crusoe",
    "status": "MONITORED",
    "activeJobsCount": 99,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-carreirascsacademy",
    "name": "CS Academy",
    "slug": "carreirascsacademy",
    "ats": "GUPY",
    "careerUrl": "https://carreirascsacademy.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-csgi",
    "name": "CSG",
    "slug": "csgi",
    "ats": "WORKDAY",
    "careerUrl": "https://csgi.wd5.myworkdayjobs.com/CSGCareers/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rpo-csudigital",
    "name": "CSU Digital",
    "slug": "rpo-csudigital",
    "ats": "INHIRE",
    "careerUrl": "https://rpo-csudigital.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-link2pump",
    "name": "ctasmart",
    "slug": "link2pump",
    "ats": "INHIRE",
    "careerUrl": "https://link2pump.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cuattro",
    "name": "Cuattro Live & Digital",
    "slug": "cuattro",
    "ats": "GUPY",
    "careerUrl": "https://cuattro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-cubos",
    "name": "Cubos Tecnologia",
    "slug": "cubos",
    "ats": "INHIRE",
    "careerUrl": "https://cubos.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cuponomia",
    "name": "Cuponomia",
    "slug": "cuponomia",
    "ats": "GUPY",
    "careerUrl": "https://cuponomia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-cursor",
    "name": "Cursor",
    "slug": "cursor",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cursor",
    "status": "MONITORED",
    "activeJobsCount": 42,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cury",
    "name": "Cury Construtora",
    "slug": "cury",
    "ats": "GUPY",
    "careerUrl": "https://cury.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cvcrm",
    "name": "CV CRM",
    "slug": "cvcrm",
    "ats": "GUPY",
    "careerUrl": "https://cvcrm.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cvccorp",
    "name": "CVC Corp",
    "slug": "cvccorp",
    "ats": "GUPY",
    "careerUrl": "https://cvccorp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-cvector",
    "name": "CVector - Industrial AI",
    "slug": "cvector",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/cvector",
    "status": "MONITORED",
    "activeJobsCount": 5,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cyrela",
    "name": "Cyrela",
    "slug": "cyrela",
    "ats": "GUPY",
    "careerUrl": "https://cyrela.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-dable",
    "name": "Dable",
    "slug": "dable",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/dable",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-daikinbrasil",
    "name": "Daikin Brasil",
    "slug": "daikinbrasil",
    "ats": "GUPY",
    "careerUrl": "https://daikinbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-darede",
    "name": "Darede",
    "slug": "darede",
    "ats": "GUPY",
    "careerUrl": "https://darede.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-dasacorp",
    "name": "Dasa",
    "slug": "dasacorp",
    "ats": "GUPY",
    "careerUrl": "https://dasacorp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-datahub",
    "name": "Datahub Big Data & Analytics",
    "slug": "datahub",
    "ats": "GUPY",
    "careerUrl": "https://datahub.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-datalabusa",
    "name": "Datalab USA",
    "slug": "datalabusa",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/datalabusa",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-dattos",
    "name": "Dattos",
    "slug": "dattos",
    "ats": "INHIRE",
    "careerUrl": "https://dattos.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-db",
    "name": "DB | CRESCER com propósito!",
    "slug": "db",
    "ats": "GUPY",
    "careerUrl": "https://db.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 24,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-db1",
    "name": "DB1",
    "slug": "db1",
    "ats": "INHIRE",
    "careerUrl": "https://db1.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-dbmcontactcenter",
    "name": "dbm contact center",
    "slug": "dbmcontactcenter",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/dbmcontactcenter",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-dcthomson",
    "name": "DC Thomson",
    "slug": "dcthomson",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/dcthomson",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-decagon",
    "name": "Decagon",
    "slug": "decagon",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/decagon",
    "status": "MONITORED",
    "activeJobsCount": 46,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-despegar",
    "name": "Decolar",
    "slug": "despegar",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/despegar",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-deel",
    "name": "Deel",
    "slug": "deel",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/Deel",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-deepgram",
    "name": "Deepgram",
    "slug": "deepgram",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/deepgram",
    "status": "MONITORED",
    "activeJobsCount": 33,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-deepl",
    "name": "DeepL",
    "slug": "deepl",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/deepl",
    "status": "MONITORED",
    "activeJobsCount": 21,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-delfosim",
    "name": "Delfos",
    "slug": "delfosim",
    "ats": "SOLIDES",
    "careerUrl": "https://delfosim.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-deliverit",
    "name": "Deliver IT",
    "slug": "deliverit",
    "ats": "GUPY",
    "careerUrl": "https://deliverit.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-deloitte",
    "name": "Deloitte",
    "slug": "deloitte",
    "ats": "INHIRE",
    "careerUrl": "https://deloitte.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-depot",
    "name": "Depot",
    "slug": "depot",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/depot",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempradescomplica",
    "name": "Descomplica",
    "slug": "vempradescomplica",
    "ats": "GUPY",
    "careerUrl": "https://vempradescomplica.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-develcode",
    "name": "Develcode",
    "slug": "develcode",
    "ats": "SOLIDES",
    "careerUrl": "https://develcode.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-dexco",
    "name": "Dexco",
    "slug": "dexco",
    "ats": "GUPY",
    "careerUrl": "https://dexco.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sejadiagonal",
    "name": "Diagonal",
    "slug": "sejadiagonal",
    "ats": "GUPY",
    "careerUrl": "https://sejadiagonal.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-dialog",
    "name": "Dialog",
    "slug": "dialog",
    "ats": "SOLIDES",
    "careerUrl": "https://vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-digital-influencers",
    "name": "Digital Influencers",
    "slug": "digital-influencers",
    "ats": "INHIRE",
    "careerUrl": "https://rankmyapp.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-digitalwork",
    "name": "Digital Work Computer Services",
    "slug": "digitalwork",
    "ats": "SOLIDES",
    "careerUrl": "https://digitalwork.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-direcaomarcasepatentes",
    "name": "Direção Marcas & Patentes",
    "slug": "direcaomarcasepatentes",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/direcaomarcasepatentes",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-doc9",
    "name": "doc9",
    "slug": "doc9",
    "ats": "INHIRE",
    "careerUrl": "https://doc9.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-doc9",
    "name": "Doc9",
    "slug": "doc9",
    "ats": "GUPY",
    "careerUrl": "https://doc9.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-dock",
    "name": "Dock",
    "slug": "dock",
    "ats": "GUPY",
    "careerUrl": "https://dock.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-dock",
    "name": "Dock",
    "slug": "dock",
    "ats": "INHIRE",
    "careerUrl": "https://dock.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-docket",
    "name": "Docket Brasil",
    "slug": "docket",
    "ats": "GUPY",
    "careerUrl": "https://docket.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-doctoralia-brasil",
    "name": "Doctoralia Brasil",
    "slug": "doctoralia-brasil",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/doctoralia-brasil",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-domo",
    "name": "Domo Inovação",
    "slug": "domo",
    "ats": "GUPY",
    "careerUrl": "https://domo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-dotgroup",
    "name": "DOT Digital Group",
    "slug": "dotgroup",
    "ats": "INHIRE",
    "careerUrl": "https://dotgroup.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-dunnhumby",
    "name": "dunnhumby",
    "slug": "dunnhumby",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/dunnhumby",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-dwsbrazil",
    "name": "DWS Brazil",
    "slug": "dwsbrazil",
    "ats": "GUPY",
    "careerUrl": "https://dwsbrazil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-dynamox",
    "name": "Dynamox",
    "slug": "dynamox",
    "ats": "SOLIDES",
    "careerUrl": "https://dynamox.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ipiranga",
    "name": "E aí Ipiranga",
    "slug": "ipiranga",
    "ats": "GUPY",
    "careerUrl": "https://ipiranga.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-eag",
    "name": "EAG Educação",
    "slug": "eag",
    "ats": "SOLIDES",
    "careerUrl": "https://eag.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-ebanx",
    "name": "EBANX",
    "slug": "ebanx",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/ebanx",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ebm",
    "name": "EBM Desenvolvimento Imobiliário",
    "slug": "ebm",
    "ats": "GUPY",
    "careerUrl": "https://ebm.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ecglobalcarreiras",
    "name": "Ecglobal",
    "slug": "ecglobalcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://ecglobalcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-echo",
    "name": "Echoenergia",
    "slug": "echo",
    "ats": "GUPY",
    "careerUrl": "https://echo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-econodata-trial",
    "name": "Econodata",
    "slug": "econodata-trial",
    "ats": "INHIRE",
    "careerUrl": "https://econodata-trial.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-edifyeducation",
    "name": "Edify",
    "slug": "edifyeducation",
    "ats": "GUPY",
    "careerUrl": "https://edifyeducation.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-teamtailor-edrone",
    "name": "edrone",
    "slug": "edrone",
    "ats": "TEAMTAILOR",
    "careerUrl": "https://edrone.teamtailor.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-educbank",
    "name": "Educbank",
    "slug": "educbank",
    "ats": "INHIRE",
    "careerUrl": "https://educbank.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-effecti",
    "name": "Effecti",
    "slug": "effecti",
    "ats": "GUPY",
    "careerUrl": "https://effecti.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sejaefi",
    "name": "Efí by Gerencianet",
    "slug": "sejaefi",
    "ats": "GUPY",
    "careerUrl": "https://sejaefi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eisatecnologia",
    "name": "EISA",
    "slug": "eisatecnologia",
    "ats": "GUPY",
    "careerUrl": "https://eisatecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-eixodigital",
    "name": "Eixo.Digital",
    "slug": "eixodigital",
    "ats": "SOLIDES",
    "careerUrl": "https://eixodigital.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-elaw",
    "name": "eLaw",
    "slug": "elaw",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/elaw",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eletrobidu",
    "name": "EletroBidu Energia Solar",
    "slug": "eletrobidu",
    "ats": "GUPY",
    "careerUrl": "https://eletrobidu.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eletromidia",
    "name": "Eletromidia",
    "slug": "eletromidia",
    "ats": "GUPY",
    "careerUrl": "https://eletromidia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eletronet",
    "name": "Eletronet",
    "slug": "eletronet",
    "ats": "GUPY",
    "careerUrl": "https://eletronet.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-elevenlabs",
    "name": "ElevenLabs",
    "slug": "elevenlabs",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/elevenlabs",
    "status": "MONITORED",
    "activeJobsCount": 62,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-elevor",
    "name": "Elevor",
    "slug": "elevor",
    "ats": "INHIRE",
    "careerUrl": "https://elevor.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-eliseai",
    "name": "EliseAI",
    "slug": "eliseai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/eliseai",
    "status": "MONITORED",
    "activeJobsCount": 18,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempraelo",
    "name": "Elo",
    "slug": "vempraelo",
    "ats": "GUPY",
    "careerUrl": "https://vempraelo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-elo7",
    "name": "Elo7",
    "slug": "elo7",
    "ats": "GUPY",
    "careerUrl": "https://elo7.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-embraer",
    "name": "Embraer",
    "slug": "embraer",
    "ats": "GUPY",
    "careerUrl": "https://embraer.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-emburse",
    "name": "Emburse",
    "slug": "emburse",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/emburse",
    "status": "MONITORED",
    "activeJobsCount": 17,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-enjoei",
    "name": "enjoei",
    "slug": "enjoei",
    "ats": "GUPY",
    "careerUrl": "https://enjoei.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-eqi",
    "name": "EQI INVESTIMENTOS",
    "slug": "eqi",
    "ats": "INHIRE",
    "careerUrl": "https://eqi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-equatorialenergia",
    "name": "Equatorial Energia Goiás",
    "slug": "equatorialenergia",
    "ats": "GUPY",
    "careerUrl": "https://equatorialenergia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-esales",
    "name": "eSales",
    "slug": "esales",
    "ats": "GUPY",
    "careerUrl": "https://esales.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserescale",
    "name": "Escale",
    "slug": "vemserescale",
    "ats": "GUPY",
    "careerUrl": "https://vemserescale.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-escoladomecanico",
    "name": "Escola do Mecânico",
    "slug": "escoladomecanico",
    "ats": "GUPY",
    "careerUrl": "https://escoladomecanico.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-escriba",
    "name": "Escriba",
    "slug": "escriba",
    "ats": "SOLIDES",
    "careerUrl": "https://escriba.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-esferaenergia",
    "name": "Esfera Energia",
    "slug": "esferaenergia",
    "ats": "INHIRE",
    "careerUrl": "https://esferaenergia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-corporativo-espacolaser",
    "name": "Espaço Laser",
    "slug": "corporativo-espacolaser",
    "ats": "GUPY",
    "careerUrl": "https://corporativo-espacolaser.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-estadao",
    "name": "ESTADÃO",
    "slug": "estadao",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/estadao",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-estagiotempest",
    "name": "Estágio Tempest",
    "slug": "estagiotempest",
    "ats": "GUPY",
    "careerUrl": "https://estagiotempest.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-estante-magica",
    "name": "Estante Mágica",
    "slug": "estante-magica",
    "ats": "GUPY",
    "careerUrl": "https://estante-magica.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-estoca",
    "name": "Estoca",
    "slug": "estoca",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/estoca",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-estrelasinternet",
    "name": "Estrelas Internet",
    "slug": "estrelasinternet",
    "ats": "SOLIDES",
    "careerUrl": "https://estrelasinternet.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-etched",
    "name": "Etched",
    "slug": "etched",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/etched",
    "status": "MONITORED",
    "activeJobsCount": 36,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-eveo",
    "name": "EVEO S.A.",
    "slug": "eveo",
    "ats": "INHIRE",
    "careerUrl": "https://eveo.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-evoluservices",
    "name": "Evoluservices",
    "slug": "evoluservices",
    "ats": "GUPY",
    "careerUrl": "https://evoluservices.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-evolux",
    "name": "Evolux",
    "slug": "evolux",
    "ats": "GUPY",
    "careerUrl": "https://evolux.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-exa",
    "name": "Exa",
    "slug": "exa",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/exa",
    "status": "MONITORED",
    "activeJobsCount": 14,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-exati",
    "name": "Exati",
    "slug": "exati",
    "ats": "INHIRE",
    "careerUrl": "https://exati.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-expertintegrado",
    "name": "Expert Integrado",
    "slug": "expertintegrado",
    "ats": "INHIRE",
    "careerUrl": "https://expertintegrado.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-eyecarehealth",
    "name": "Eyecare Health",
    "slug": "eyecarehealth",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/eyecarehealth",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eztec",
    "name": "Eztec",
    "slug": "eztec",
    "ats": "GUPY",
    "careerUrl": "https://eztec.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-f360",
    "name": "F360",
    "slug": "f360",
    "ats": "GUPY",
    "careerUrl": "https://f360.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-faculdadeunimed",
    "name": "Faculdade Unimed",
    "slug": "faculdadeunimed",
    "ats": "GUPY",
    "careerUrl": "https://faculdadeunimed.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-falcomm",
    "name": "Falcomm",
    "slug": "falcomm",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/falcomm",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-falconicarreiras",
    "name": "Falconi",
    "slug": "falconicarreiras",
    "ats": "INHIRE",
    "careerUrl": "https://falconicarreiras.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-famaempresarial",
    "name": "Fama Empresarial",
    "slug": "famaempresarial",
    "ats": "SOLIDES",
    "careerUrl": "https://famaempresarial.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-familhao",
    "name": "Familhão",
    "slug": "familhao",
    "ats": "INHIRE",
    "careerUrl": "https://familhao.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-vagasfarmaciaartesanal",
    "name": "Farmácia Artesanal",
    "slug": "vagasfarmaciaartesanal",
    "ats": "SOLIDES",
    "careerUrl": "https://vagasfarmaciaartesanal.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-paguemenosextrafarma",
    "name": "Farmácias Pague Menos",
    "slug": "paguemenosextrafarma",
    "ats": "GUPY",
    "careerUrl": "https://paguemenosextrafarma.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-fcamara",
    "name": "FCamara",
    "slug": "fcamara",
    "ats": "GUPY",
    "careerUrl": "https://fcamara.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 89,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-febracis",
    "name": "Febracis - Escola de Negócios",
    "slug": "febracis",
    "ats": "GUPY",
    "careerUrl": "https://febracis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprotimefebrafar",
    "name": "Febrafar",
    "slug": "vemprotimefebrafar",
    "ats": "GUPY",
    "careerUrl": "https://vemprotimefebrafar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-feng",
    "name": "Feng",
    "slug": "feng",
    "ats": "GUPY",
    "careerUrl": "https://feng.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-fgr",
    "name": "FGR Incorporações SA",
    "slug": "fgr",
    "ats": "SOLIDES",
    "careerUrl": "https://fgr.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-figma",
    "name": "Figma",
    "slug": "figma",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/figma",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-financy",
    "name": "Financy",
    "slug": "financy",
    "ats": "SOLIDES",
    "careerUrl": "https://financy.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-findup",
    "name": "FindUP",
    "slug": "findup",
    "ats": "INHIRE",
    "careerUrl": "https://findup.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-finnet",
    "name": "finnet",
    "slug": "finnet",
    "ats": "GUPY",
    "careerUrl": "https://finnet.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-firedev",
    "name": "Firedev IT",
    "slug": "firedev",
    "ats": "GUPY",
    "careerUrl": "https://firedev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-fiscaltech",
    "name": "Fiscaltech",
    "slug": "fiscaltech",
    "ats": "GUPY",
    "careerUrl": "https://fiscaltech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-fitenergia",
    "name": "FIT Economia de Energia",
    "slug": "fitenergia",
    "ats": "SOLIDES",
    "careerUrl": "https://fitenergia.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-flashapp",
    "name": "Flash",
    "slug": "flashapp",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/flashapp",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-flora",
    "name": "Flora Cosméticos e Limpeza",
    "slug": "flora",
    "ats": "GUPY",
    "careerUrl": "https://flora.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-flowbiz",
    "name": "Flowbiz",
    "slug": "flowbiz",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/flowbiz",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-fluencyacademy",
    "name": "Fluency",
    "slug": "fluencyacademy",
    "ats": "GUPY",
    "careerUrl": "https://fluencyacademy.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-fluencypass",
    "name": "Fluencypass",
    "slug": "fluencypass",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/fluencypass",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-fluke",
    "name": "fluke",
    "slug": "fluke",
    "ats": "INHIRE",
    "careerUrl": "https://fluke.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eightfold-fortive",
    "name": "Fluke Corporation",
    "slug": "fortive",
    "ats": "EIGHTFOLD",
    "careerUrl": "https://fortive.eightfold.ai/careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-forcepoint",
    "name": "Forcepoint",
    "slug": "forcepoint",
    "ats": "WORKDAY",
    "careerUrl": "https://forcepoint.wd1.myworkdayjobs.com/pt-BR/external-careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-fours",
    "name": "Fours (formerly Suger)",
    "slug": "fours",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/fours",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-skydropx",
    "name": "Frenet",
    "slug": "skydropx",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/skydropx",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-fretadao",
    "name": "Fretadão",
    "slug": "fretadao",
    "ats": "INHIRE",
    "careerUrl": "https://fretadao.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-freterapido",
    "name": "Frete Rápido",
    "slug": "freterapido",
    "ats": "GUPY",
    "careerUrl": "https://freterapido.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-frete",
    "name": "Frete.com",
    "slug": "frete",
    "ats": "INHIRE",
    "careerUrl": "https://frete.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 5,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutei-full-sales-system",
    "name": "Full Sales System",
    "slug": "full-sales-system",
    "ats": "RECRUTEI",
    "careerUrl": "https://jobs.recrutei.com.br/full-sales-system",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-funcionalhealthtech",
    "name": "Funcional Health Tech",
    "slug": "funcionalhealthtech",
    "ats": "GUPY",
    "careerUrl": "https://funcionalhealthtech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-fundasp",
    "name": "Fundação São Paulo",
    "slug": "fundasp",
    "ats": "GUPY",
    "careerUrl": "https://fundasp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-fundacred",
    "name": "Fundacred",
    "slug": "fundacred",
    "ats": "PANDAPE",
    "careerUrl": "https://fundacred.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-fuse-integration",
    "name": "Fuse Integration",
    "slug": "fuse-integration",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/fuse-integration",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-futurai",
    "name": "Futurai",
    "slug": "futurai",
    "ats": "GUPY",
    "careerUrl": "https://futurai.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ace",
    "name": "Future Dojo",
    "slug": "ace",
    "ats": "GUPY",
    "careerUrl": "https://ace.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-futureplc",
    "name": "Future Publishing",
    "slug": "futureplc",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/futureplc",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-futuromarketingdigital",
    "name": "FUTURO MARKETING DIGITAL",
    "slug": "futuromarketingdigital",
    "ats": "SOLIDES",
    "careerUrl": "https://futuromarketingdigital.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-gabriel",
    "name": "Gabriel",
    "slug": "gabriel",
    "ats": "INHIRE",
    "careerUrl": "https://gabriel.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gamewiz",
    "name": "Gamewiz",
    "slug": "gamewiz",
    "ats": "GUPY",
    "careerUrl": "https://gamewiz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gaudium",
    "name": "Gaudium",
    "slug": "gaudium",
    "ats": "GUPY",
    "careerUrl": "https://gaudium.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gedanken",
    "name": "Gedanken",
    "slug": "gedanken",
    "ats": "GUPY",
    "careerUrl": "https://gedanken.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gelita",
    "name": "Gelita",
    "slug": "gelita",
    "ats": "GUPY",
    "careerUrl": "https://gelita.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-generalmotors",
    "name": "General Motors South America",
    "slug": "generalmotors",
    "ats": "WORKDAY",
    "careerUrl": "https://generalmotors.wd5.myworkdayjobs.com/pt-BR/Careers_GM",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-genesys",
    "name": "Genesys",
    "slug": "genesys",
    "ats": "WORKDAY",
    "careerUrl": "https://genesys.wd1.myworkdayjobs.com/Genesys/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-genial",
    "name": "Genial Investimentos",
    "slug": "genial",
    "ats": "GUPY",
    "careerUrl": "https://genial.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gera",
    "name": "Gera",
    "slug": "gera",
    "ats": "GUPY",
    "careerUrl": "https://gera.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-gestaoinovada",
    "name": "Gestão Inovada",
    "slug": "gestaoinovada",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/gestaoinovada",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-getnet",
    "name": "Getnet",
    "slug": "getnet",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/getnet",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-gettyimages",
    "name": "Getty Images",
    "slug": "gettyimages",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/gettyimages",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-gex",
    "name": "GEX",
    "slug": "gex",
    "ats": "INHIRE",
    "careerUrl": "https://gex.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gfpneus",
    "name": "GF Pneus",
    "slug": "gfpneus",
    "ats": "GUPY",
    "careerUrl": "https://gfpneus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-girotech",
    "name": "Giro.Tech",
    "slug": "girotech",
    "ats": "GUPY",
    "careerUrl": "https://girotech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-globalhitss",
    "name": "Global Hitss",
    "slug": "globalhitss",
    "ats": "GUPY",
    "careerUrl": "https://globalhitss.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 16,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-somosglobal",
    "name": "Global Hub",
    "slug": "somosglobal",
    "ats": "GUPY",
    "careerUrl": "https://somosglobal.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-globant",
    "name": "Globant",
    "slug": "globant",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/Globant",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-globo",
    "name": "Globo",
    "slug": "globo",
    "ats": "GUPY",
    "careerUrl": "https://globo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-gmprecursoshumanosltda",
    "name": "GM Promo",
    "slug": "gmprecursoshumanosltda",
    "ats": "PANDAPE",
    "careerUrl": "https://gmprecursoshumanosltda.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gobrax",
    "name": "Gobrax",
    "slug": "gobrax",
    "ats": "GUPY",
    "careerUrl": "https://gobrax.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-gogroup",
    "name": "Gogroup Brasil",
    "slug": "gogroup",
    "ats": "INHIRE",
    "careerUrl": "https://gogroup.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-golcarreiras",
    "name": "GOL Linhas Aéreas",
    "slug": "golcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://golcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-goomer",
    "name": "Goomer",
    "slug": "goomer",
    "ats": "GUPY",
    "careerUrl": "https://goomer.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-governancabrasil",
    "name": "Governança Brasil",
    "slug": "governancabrasil",
    "ats": "GUPY",
    "careerUrl": "https://governancabrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gpa",
    "name": "GPA",
    "slug": "gpa",
    "ats": "GUPY",
    "careerUrl": "https://gpa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gradus",
    "name": "Gradus",
    "slug": "gradus",
    "ats": "GUPY",
    "careerUrl": "https://gradus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grafeno",
    "name": "Grafeno",
    "slug": "grafeno",
    "ats": "GUPY",
    "careerUrl": "https://grafeno.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-granado",
    "name": "Granado Pharmácias | Perfumaria Phebo",
    "slug": "granado",
    "ats": "GUPY",
    "careerUrl": "https://granado.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-greatpeople",
    "name": "Great Place To Work",
    "slug": "greatpeople",
    "ats": "RECRUTAI",
    "careerUrl": "https://greatpeople.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sejagreat",
    "name": "Great Schools",
    "slug": "sejagreat",
    "ats": "GUPY",
    "careerUrl": "https://sejagreat.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-greenrh",
    "name": "Green RH",
    "slug": "greenrh",
    "ats": "SOLIDES",
    "careerUrl": "https://vagas.solides.com.br#greenrh",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-greenlife-healthcare-staffing-1",
    "name": "Greenlife Healthcare Staffing",
    "slug": "greenlife-healthcare-staffing-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/greenlife-healthcare-staffing-1",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-facapartegrendene",
    "name": "Grendene",
    "slug": "facapartegrendene",
    "ats": "GUPY",
    "careerUrl": "https://facapartegrendene.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-3coracoes",
    "name": "Grupo 3corações",
    "slug": "3coracoes",
    "ats": "GUPY",
    "careerUrl": "https://3coracoes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-aceleradorempresarial",
    "name": "Grupo Acelerador",
    "slug": "aceleradorempresarial",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/aceleradorempresarial",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-grupoadrianocobuccio",
    "name": "Grupo Adriano Cobuccio",
    "slug": "grupoadrianocobuccio",
    "ats": "SOLIDES",
    "careerUrl": "https://grupoadrianocobuccio.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-avel",
    "name": "Grupo Ável",
    "slug": "avel",
    "ats": "INHIRE",
    "careerUrl": "https://avel.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-grupobamaq",
    "name": "Grupo Bamaq",
    "slug": "grupobamaq",
    "ats": "RECRUTAI",
    "careerUrl": "https://grupobamaq.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-grupobarigui",
    "name": "Grupo Barigui",
    "slug": "grupobarigui",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/grupobarigui",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupoboticario",
    "name": "Grupo Boticário",
    "slug": "grupoboticario",
    "ats": "GUPY",
    "careerUrl": "https://grupoboticario.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 39,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-caffeinearmy",
    "name": "GRUPO Caffeine Army",
    "slug": "caffeinearmy",
    "ats": "INHIRE",
    "careerUrl": "https://caffeinearmy.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-corporativogrupocasasbahia",
    "name": "Grupo Casas Bahia",
    "slug": "corporativogrupocasasbahia",
    "ats": "GUPY",
    "careerUrl": "https://corporativogrupocasasbahia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tecnologiagrupocasasbahia",
    "name": "Grupo Casas Bahia",
    "slug": "tecnologiagrupocasasbahia",
    "ats": "GUPY",
    "careerUrl": "https://tecnologiagrupocasasbahia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-motiva",
    "name": "Grupo CCR",
    "slug": "motiva",
    "ats": "GUPY",
    "careerUrl": "https://motiva.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-grupocliged",
    "name": "Grupo CLIGED",
    "slug": "grupocliged",
    "ats": "SOLIDES",
    "careerUrl": "https://grupocliged.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-vagasgrupoconstancy",
    "name": "Grupo Constancy",
    "slug": "vagasgrupoconstancy",
    "ats": "SOLIDES",
    "careerUrl": "https://vagasgrupoconstancy.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-davo",
    "name": "Grupo D'avó",
    "slug": "davo",
    "ats": "RECRUTAI",
    "careerUrl": "https://davo.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sejadigna",
    "name": "Grupo Digna",
    "slug": "sejadigna",
    "ats": "GUPY",
    "careerUrl": "https://sejadigna.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-elettromec",
    "name": "Grupo Elettromec",
    "slug": "elettromec",
    "ats": "GUPY",
    "careerUrl": "https://elettromec.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-esportesdasorte",
    "name": "Grupo Esportes Gaming Brasil",
    "slug": "esportesdasorte",
    "ats": "GUPY",
    "careerUrl": "https://esportesdasorte.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasfarmax",
    "name": "Grupo Farmax",
    "slug": "vagasfarmax",
    "ats": "GUPY",
    "careerUrl": "https://vagasfarmax.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-grupogadens",
    "name": "Grupo Gadens",
    "slug": "grupogadens",
    "ats": "INHIRE",
    "careerUrl": "https://grupogadens.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemsergr",
    "name": "GRUPO GR",
    "slug": "vemsergr",
    "ats": "GUPY",
    "careerUrl": "https://vemsergr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-hinova",
    "name": "Grupo Hinova",
    "slug": "hinova",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/hinova",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-omnibees",
    "name": "Grupo HIVE",
    "slug": "omnibees",
    "ats": "INHIRE",
    "careerUrl": "https://omnibees.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-hof360",
    "name": "Grupo HOF 360",
    "slug": "hof360",
    "ats": "SOLIDES",
    "careerUrl": "https://hof360.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-embarquejca",
    "name": "Grupo JCA",
    "slug": "embarquejca",
    "ats": "GUPY",
    "careerUrl": "https://embarquejca.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-leveros",
    "name": "Grupo Leveros",
    "slug": "leveros",
    "ats": "GUPY",
    "careerUrl": "https://leveros.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupomassa",
    "name": "Grupo Massa",
    "slug": "grupomassa",
    "ats": "GUPY",
    "careerUrl": "https://grupomassa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-medmais",
    "name": "Grupo Med+",
    "slug": "medmais",
    "ats": "GUPY",
    "careerUrl": "https://medmais.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruponexxees",
    "name": "Grupo Nexxees",
    "slug": "gruponexxees",
    "ats": "GUPY",
    "careerUrl": "https://gruponexxees.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruponortis",
    "name": "Grupo Nortis",
    "slug": "gruponortis",
    "ats": "GUPY",
    "careerUrl": "https://gruponortis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserolxbrasil",
    "name": "Grupo OLX",
    "slug": "vemserolxbrasil",
    "ats": "GUPY",
    "careerUrl": "https://vemserolxbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemsergrupoolx",
    "name": "Grupo OLX",
    "slug": "vemsergrupoolx",
    "ats": "GUPY",
    "careerUrl": "https://vemsergrupoolx.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-grupopermaneo",
    "name": "Grupo Permaneo",
    "slug": "grupopermaneo",
    "ats": "INHIRE",
    "careerUrl": "https://grupopermaneo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-petlove",
    "name": "Grupo Petlove",
    "slug": "petlove",
    "ats": "GUPY",
    "careerUrl": "https://petlove.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-planning",
    "name": "Grupo Planning",
    "slug": "planning",
    "ats": "PANDAPE",
    "careerUrl": "https://planning.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-raymundodafonte",
    "name": "Grupo Raymundo da Fonte",
    "slug": "raymundodafonte",
    "ats": "GUPY",
    "careerUrl": "https://raymundodafonte.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruporbs",
    "name": "Grupo RBS",
    "slug": "gruporbs",
    "ats": "GUPY",
    "careerUrl": "https://gruporbs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-gruporevise",
    "name": "Grupo Revise",
    "slug": "gruporevise",
    "ats": "SOLIDES",
    "careerUrl": "https://gruporevise.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruposabin",
    "name": "Grupo Sabin",
    "slug": "gruposabin",
    "ats": "GUPY",
    "careerUrl": "https://gruposabin.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruposbftalentos",
    "name": "Grupo SBF",
    "slug": "gruposbftalentos",
    "ats": "GUPY",
    "careerUrl": "https://gruposbftalentos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-azzasfashion",
    "name": "Grupo SOMA",
    "slug": "azzasfashion",
    "ats": "GUPY",
    "careerUrl": "https://azzasfashion.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-grupotaking",
    "name": "Grupo Taking",
    "slug": "grupotaking",
    "ats": "INHIRE",
    "careerUrl": "https://grupotaking.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupotecnospeed",
    "name": "Grupo TecnoSpeed",
    "slug": "grupotecnospeed",
    "ats": "GUPY",
    "careerUrl": "https://grupotecnospeed.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-grupozelo",
    "name": "Grupo Zelo",
    "slug": "grupozelo",
    "ats": "PANDAPE",
    "careerUrl": "https://grupozelo.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruposc",
    "name": "GrupoSC",
    "slug": "gruposc",
    "ats": "GUPY",
    "careerUrl": "https://gruposc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempra",
    "name": "Gupy",
    "slug": "vempra",
    "ats": "GUPY",
    "careerUrl": "https://vempra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tech-career",
    "name": "Gupy Tech",
    "slug": "tech-career",
    "ats": "GUPY",
    "careerUrl": "https://tech-career.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-h2club",
    "name": "H2 Club",
    "slug": "h2club",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/h2club",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-handtalk",
    "name": "Hand Talk",
    "slug": "handtalk",
    "ats": "GUPY",
    "careerUrl": "https://handtalk.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-hapvidandi",
    "name": "Hapvida",
    "slug": "hapvidandi",
    "ats": "GUPY",
    "careerUrl": "https://hapvidandi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-harvey",
    "name": "Harvey",
    "slug": "harvey",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/harvey",
    "status": "MONITORED",
    "activeJobsCount": 95,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-hcvt",
    "name": "HCVT",
    "slug": "hcvt",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/hcvt",
    "status": "MONITORED",
    "activeJobsCount": 10,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-helppi",
    "name": "Helppi",
    "slug": "helppi",
    "ats": "GUPY",
    "careerUrl": "https://helppi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-heroseguros",
    "name": "Hero Seguros",
    "slug": "heroseguros",
    "ats": "INHIRE",
    "careerUrl": "https://heroseguros.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-hilab",
    "name": "Hilab",
    "slug": "hilab",
    "ats": "GUPY",
    "careerUrl": "https://hilab.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-grupohipersaude",
    "name": "Hiper Saúde",
    "slug": "grupohipersaude",
    "ats": "SOLIDES",
    "careerUrl": "https://grupohipersaude.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-hive",
    "name": "Hive",
    "slug": "hive",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/hive",
    "status": "MONITORED",
    "activeJobsCount": 34,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-homey",
    "name": "Homey",
    "slug": "homey",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/homey",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-honda",
    "name": "Honda",
    "slug": "honda",
    "ats": "GUPY",
    "careerUrl": "https://honda.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-hospcom",
    "name": "Hospcom Hospitalar",
    "slug": "hospcom",
    "ats": "SOLIDES",
    "careerUrl": "https://hospcom.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-hospitaloswaldocruz",
    "name": "Hospital Alemão Oswaldo Cruz",
    "slug": "hospitaloswaldocruz",
    "ats": "GUPY",
    "careerUrl": "https://hospitaloswaldocruz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-selecty-gruposanta",
    "name": "Hospital Santa Lúcia",
    "slug": "gruposanta",
    "ats": "SELECTY",
    "careerUrl": "https://gruposanta.selecty.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-hotmartcareersbr",
    "name": "Hotmart",
    "slug": "hotmartcareersbr",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/hotmartcareersbr",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-housi",
    "name": "Housi",
    "slug": "housi",
    "ats": "INHIRE",
    "careerUrl": "https://housi.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alice",
    "name": "https://alice.inhire.app/vagas",
    "slug": "alice",
    "ats": "INHIRE",
    "careerUrl": "https://alice.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-contaazul",
    "name": "https://contaazul.inhire.app/",
    "slug": "contaazul",
    "ats": "INHIRE",
    "careerUrl": "https://contaazul.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-hublocal",
    "name": "HubLocal",
    "slug": "hublocal",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/hublocal",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-hudl",
    "name": "Hudl",
    "slug": "hudl",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/hudl",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-huggy",
    "name": "Huggy",
    "slug": "huggy",
    "ats": "INHIRE",
    "careerUrl": "https://grupogopwr.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-hyperapharma",
    "name": "Hypera",
    "slug": "hyperapharma",
    "ats": "GUPY",
    "careerUrl": "https://hyperapharma.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-i4pro",
    "name": "i4pro",
    "slug": "i4pro",
    "ats": "GUPY",
    "careerUrl": "https://i4pro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ibeu",
    "name": "Ibeu",
    "slug": "ibeu",
    "ats": "GUPY",
    "careerUrl": "https://ibeu.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-icarotech",
    "name": "Icaro Tech",
    "slug": "icarotech",
    "ats": "GUPY",
    "careerUrl": "https://icarotech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-iceye",
    "name": "ICEYE",
    "slug": "iceye",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/iceye",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-iconit",
    "name": "Iconit",
    "slug": "iconit",
    "ats": "INHIRE",
    "careerUrl": "https://iconit.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ideen",
    "name": "Ideen",
    "slug": "ideen",
    "ats": "INHIRE",
    "careerUrl": "https://ideen.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-idwall",
    "name": "idwall",
    "slug": "idwall",
    "ats": "INHIRE",
    "careerUrl": "https://idwall.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-iestro",
    "name": "iestro",
    "slug": "iestro",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/iestro",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-ifoodcarreiras",
    "name": "iFood",
    "slug": "ifoodcarreiras",
    "ats": "GREENHOUSE",
    "careerUrl": "https://carreiras.ifood.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserigua",
    "name": "Iguá Saneamento",
    "slug": "vemserigua",
    "ats": "GUPY",
    "careerUrl": "https://vemserigua.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ihunters",
    "name": "iHunters",
    "slug": "ihunters",
    "ats": "INHIRE",
    "careerUrl": "https://ihunters.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ilegra",
    "name": "Ilegra",
    "slug": "ilegra",
    "ats": "GUPY",
    "careerUrl": "https://ilegra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-ilia",
    "name": "ília",
    "slug": "ilia",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/ilia",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-imagemgeosistemas",
    "name": "Imagem Geosistemas",
    "slug": "imagemgeosistemas",
    "ats": "INHIRE",
    "careerUrl": "https://atmisgestao.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-atmisgestao",
    "name": "Imagem Geosistemas",
    "slug": "atmisgestao",
    "ats": "INHIRE",
    "careerUrl": "https://atmisgestao.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-imile",
    "name": "iMile",
    "slug": "imile",
    "ats": "INHIRE",
    "careerUrl": "https://imile.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-importemelhor",
    "name": "Importe Melhor",
    "slug": "importemelhor",
    "ats": "INHIRE",
    "careerUrl": "https://importemelhor.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-impulseup",
    "name": "impulseup",
    "slug": "impulseup",
    "ats": "INHIRE",
    "careerUrl": "https://impulseup.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-incentivar",
    "name": "Incentivar",
    "slug": "incentivar",
    "ats": "GUPY",
    "careerUrl": "https://incentivar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-inchurch",
    "name": "inChurch",
    "slug": "inchurch",
    "ats": "SOLIDES",
    "careerUrl": "https://inchurch.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutei-incicle-sistemas",
    "name": "InCicle",
    "slug": "incicle-sistemas",
    "ats": "RECRUTEI",
    "careerUrl": "https://jobs.recrutei.com.br/incicle-sistemas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-indecx",
    "name": "INDECX",
    "slug": "indecx",
    "ats": "SOLIDES",
    "careerUrl": "https://indecx.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-infleet",
    "name": "Infleet",
    "slug": "infleet",
    "ats": "INHIRE",
    "careerUrl": "https://infleet.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-infobip",
    "name": "Infobip",
    "slug": "infobip",
    "ats": "WORKDAY",
    "careerUrl": "https://infobip.wd3.myworkdayjobs.com/en-US/InfobipCareers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-infojobs",
    "name": "Infojobs",
    "slug": "infojobs",
    "ats": "PANDAPE",
    "careerUrl": "https://infojobs.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-confidential",
    "name": "Inhire",
    "slug": "confidential",
    "ats": "INHIRE",
    "careerUrl": "https://confidential.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-carreiras",
    "name": "InHire",
    "slug": "carreiras",
    "ats": "INHIRE",
    "careerUrl": "https://carreiras.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-inmetrics",
    "name": "Inmetrics S/A",
    "slug": "inmetrics",
    "ats": "GUPY",
    "careerUrl": "https://inmetrics.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 19,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-innerai-trial",
    "name": "Inner AI",
    "slug": "innerai-trial",
    "ats": "INHIRE",
    "careerUrl": "https://innerai-trial.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-innuvem",
    "name": "Innuvem Consultoria",
    "slug": "innuvem",
    "ats": "GUPY",
    "careerUrl": "https://innuvem.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-inoveideiasesolucoes",
    "name": "Inove Ideias e Soluções",
    "slug": "inoveideiasesolucoes",
    "ats": "SOLIDES",
    "careerUrl": "https://inoveideiasesolucoes.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-teamtailor-insense",
    "name": "Insense | TikTok & Meta Partner",
    "slug": "insense",
    "ats": "TEAMTAILOR",
    "careerUrl": "https://insense.na.teamtailor.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-insiderstore",
    "name": "Insider",
    "slug": "insiderstore",
    "ats": "INHIRE",
    "careerUrl": "https://insiderstore.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-insiderone",
    "name": "Insider One",
    "slug": "insiderone",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/insiderone",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-teamtailor-instaleap",
    "name": "Instaleap",
    "slug": "instaleap",
    "ats": "TEAMTAILOR",
    "careerUrl": "https://instaleap.na.teamtailor.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-ifm-us",
    "name": "Institute of Foundation Models",
    "slug": "ifm-us",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/ifm-us",
    "status": "MONITORED",
    "activeJobsCount": 18,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-institutoeldorado",
    "name": "Instituto Eldorado",
    "slug": "institutoeldorado",
    "ats": "GUPY",
    "careerUrl": "https://institutoeldorado.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 85,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-institutogli-medicinaltda",
    "name": "Instituto GL",
    "slug": "institutogli-medicinaltda",
    "ats": "PANDAPE",
    "careerUrl": "https://institutogli-medicinaltda.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagas-infnet",
    "name": "Instituto Infnet",
    "slug": "vagas-infnet",
    "ats": "GUPY",
    "careerUrl": "https://vagas-infnet.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-instructure",
    "name": "Instructure",
    "slug": "instructure",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/instructure",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-integrativa",
    "name": "Integrativa",
    "slug": "integrativa",
    "ats": "SOLIDES",
    "careerUrl": "https://integrativa.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-intel",
    "name": "Intel Brasil",
    "slug": "intel",
    "ats": "WORKDAY",
    "careerUrl": "https://intel.wd1.myworkdayjobs.com/External",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-inteli",
    "name": "Inteli - Instituto de Tecnologia e Liderança",
    "slug": "inteli",
    "ats": "INHIRE",
    "careerUrl": "https://inteli.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-intelia",
    "name": "Intelia",
    "slug": "intelia",
    "ats": "GUPY",
    "careerUrl": "https://intelia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-intelipost",
    "name": "Intelipost",
    "slug": "intelipost",
    "ats": "GUPY",
    "careerUrl": "https://intelipost.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-intera",
    "name": "INTERA",
    "slug": "intera",
    "ats": "INHIRE",
    "careerUrl": "https://intera.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vagasconfidenciais18",
    "name": "INTERA",
    "slug": "vagasconfidenciais18",
    "ats": "INHIRE",
    "careerUrl": "https://vagasconfidenciais18.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-inventsoftware",
    "name": "Invent Software",
    "slug": "inventsoftware",
    "ats": "GUPY",
    "careerUrl": "https://inventsoftware.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-invenzi",
    "name": "Invenzi",
    "slug": "invenzi",
    "ats": "SOLIDES",
    "careerUrl": "https://invenzi.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-involves",
    "name": "Involves",
    "slug": "involves",
    "ats": "INHIRE",
    "careerUrl": "https://involves.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ioasys",
    "name": "ioasys",
    "slug": "ioasys",
    "ats": "GUPY",
    "careerUrl": "https://ioasys.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-ipm",
    "name": "IPM",
    "slug": "ipm",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/ipm",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ipnet",
    "name": "IPNET by Vivo",
    "slug": "ipnet",
    "ats": "INHIRE",
    "careerUrl": "https://ipnet.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ipsosbrasil",
    "name": "Ipsos in Latin America",
    "slug": "ipsosbrasil",
    "ats": "GUPY",
    "careerUrl": "https://ipsosbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-iqnus",
    "name": "Iqnus Tecnologia",
    "slug": "iqnus",
    "ats": "SOLIDES",
    "careerUrl": "https://iqnus.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-ironcladhq",
    "name": "Ironclad",
    "slug": "ironcladhq",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ironcladhq",
    "status": "MONITORED",
    "activeJobsCount": 17,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasisasaude",
    "name": "ISA SAÚDE",
    "slug": "vagasisasaude",
    "ats": "GUPY",
    "careerUrl": "https://vagasisasaude.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-isaac",
    "name": "Isaac",
    "slug": "isaac",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/isaac",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprait4us",
    "name": "It4us Cyber Security",
    "slug": "vemprait4us",
    "ats": "GUPY",
    "careerUrl": "https://vemprait4us.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-itaseguros",
    "name": "Ita Corretora de Seguros",
    "slug": "itaseguros",
    "ats": "GUPY",
    "careerUrl": "https://itaseguros.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-italac",
    "name": "Italac",
    "slug": "italac",
    "ats": "GUPY",
    "careerUrl": "https://italac.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-itaucultural",
    "name": "Itaú Cultural",
    "slug": "itaucultural",
    "ats": "GUPY",
    "careerUrl": "https://itaucultural.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemproitau",
    "name": "Itaú Unibanco",
    "slug": "vemproitau",
    "ats": "GUPY",
    "careerUrl": "https://vemproitau.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 27,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasituran",
    "name": "Ituran",
    "slug": "vagasituran",
    "ats": "GUPY",
    "careerUrl": "https://vagasituran.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempraiugu",
    "name": "iugu",
    "slug": "vempraiugu",
    "ats": "GUPY",
    "careerUrl": "https://vempraiugu.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-ivienergia",
    "name": "IVI Energia",
    "slug": "ivienergia",
    "ats": "PANDAPE",
    "careerUrl": "https://ivienergia.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemserixcsoft",
    "name": "IXC Soft",
    "slug": "vemserixcsoft",
    "ats": "GUPY",
    "careerUrl": "https://vemserixcsoft.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-jampp",
    "name": "Jampp",
    "slug": "jampp",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/jampp",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-grupojbs",
    "name": "JBS",
    "slug": "grupojbs",
    "ats": "GUPY",
    "careerUrl": "https://grupojbs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-jcdecor",
    "name": "JC Decor",
    "slug": "jcdecor",
    "ats": "PANDAPE",
    "careerUrl": "https://jcdecor.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-jdrel",
    "name": "JDREL",
    "slug": "jdrel",
    "ats": "GUPY",
    "careerUrl": "https://jdrel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-jectixtelecomunicacoeseservicosltda",
    "name": "JECTIX TELECOM",
    "slug": "jectixtelecomunicacoeseservicosltda",
    "ats": "PANDAPE",
    "careerUrl": "https://jectixtelecomunicacoeseservicosltda.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-tryjeeves",
    "name": "Jeeves",
    "slug": "tryjeeves",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/tryjeeves",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-jeitto",
    "name": "Jeitto",
    "slug": "jeitto",
    "ats": "INHIRE",
    "careerUrl": "https://jeitto.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-jetimob",
    "name": "Jetimob",
    "slug": "jetimob",
    "ats": "SOLIDES",
    "careerUrl": "https://jetimob.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-jhsf",
    "name": "JHSF",
    "slug": "jhsf",
    "ats": "GUPY",
    "careerUrl": "https://jhsf.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-jobgether",
    "name": "Jobgether",
    "slug": "jobgether",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/jobgether",
    "status": "MONITORED",
    "activeJobsCount": 3679,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-jointecnologia",
    "name": "Join Creative Tech",
    "slug": "jointecnologia",
    "ats": "GUPY",
    "careerUrl": "https://jointecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-jornadabemobi",
    "name": "Jornada Bemobi",
    "slug": "jornadabemobi",
    "ats": "GUPY",
    "careerUrl": "https://jornadabemobi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-joynrh",
    "name": "JOYn Group",
    "slug": "joynrh",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/joynrh",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-jumpcloud",
    "name": "JumpCloud",
    "slug": "jumpcloud",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/jumpcloud",
    "status": "MONITORED",
    "activeJobsCount": 15,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-junction",
    "name": "Junction",
    "slug": "junction",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/junction",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-junglee-games",
    "name": "Junglee Games",
    "slug": "junglee-games",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/junglee-games",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-jusbrasil",
    "name": "Jusbrasil",
    "slug": "jusbrasil",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/jusbrasil",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-juscash",
    "name": "JusCash",
    "slug": "juscash",
    "ats": "GUPY",
    "careerUrl": "https://juscash.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recruitee-kaizo",
    "name": "Kaizo",
    "slug": "kaizo",
    "ats": "RECRUITEE",
    "careerUrl": "https://kaizo.recruitee.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-kamino",
    "name": "Kamino",
    "slug": "kamino",
    "ats": "GUPY",
    "careerUrl": "https://kamino.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-karizoda",
    "name": "Karizoda Growth & IA",
    "slug": "karizoda",
    "ats": "SOLIDES",
    "careerUrl": "https://karizoda.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-kavak",
    "name": "Kavak",
    "slug": "kavak",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/kavak",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-kayak",
    "name": "KAYAK",
    "slug": "kayak",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/kayak",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-kedu",
    "name": "kedu",
    "slug": "kedu",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/kedu",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-keeggo",
    "name": "keeggo",
    "slug": "keeggo",
    "ats": "GUPY",
    "careerUrl": "https://keeggo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-keepsimple",
    "name": "Keep Simple",
    "slug": "keepsimple",
    "ats": "GUPY",
    "careerUrl": "https://keepsimple.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-kenlo",
    "name": "Kenlo",
    "slug": "kenlo",
    "ats": "GUPY",
    "careerUrl": "https://kenlo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-kiwify",
    "name": "Kiwify",
    "slug": "kiwify",
    "ats": "INHIRE",
    "careerUrl": "https://kiwify.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-knewin",
    "name": "Knewin",
    "slug": "knewin",
    "ats": "INHIRE",
    "careerUrl": "https://knewin.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-knewin",
    "name": "Knewin",
    "slug": "knewin",
    "ats": "GUPY",
    "careerUrl": "https://knewin.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-knowbe4",
    "name": "KnowBe4",
    "slug": "knowbe4",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/knowbe4",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-kobe",
    "name": "KOBE",
    "slug": "kobe",
    "ats": "INHIRE",
    "careerUrl": "https://kobe.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-alconkofre",
    "name": "KOFRE TECNOLOGIA",
    "slug": "alconkofre",
    "ats": "INHIRE",
    "careerUrl": "https://alconkofre.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-konecta",
    "name": "Konecta",
    "slug": "konecta",
    "ats": "PANDAPE",
    "careerUrl": "https://konecta.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-kong",
    "name": "Kong",
    "slug": "kong",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/kong",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-konsi",
    "name": "Konsi",
    "slug": "konsi",
    "ats": "INHIRE",
    "careerUrl": "https://konsi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-korp",
    "name": "Korp",
    "slug": "korp",
    "ats": "GUPY",
    "careerUrl": "https://korp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-kovi",
    "name": "Kovi",
    "slug": "kovi",
    "ats": "GUPY",
    "careerUrl": "https://kovi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-kpmg",
    "name": "KPMG",
    "slug": "kpmg",
    "ats": "INHIRE",
    "careerUrl": "https://kpmg.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-kraken.com",
    "name": "Kraken",
    "slug": "kraken.com",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/kraken.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-lalamove",
    "name": "Lalamove",
    "slug": "lalamove",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/lalamove",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-lambda",
    "name": "Lambda",
    "slug": "lambda",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lambda",
    "status": "MONITORED",
    "activeJobsCount": 35,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-laqus",
    "name": "Laqus",
    "slug": "laqus",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/laqus",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-lastlink",
    "name": "Lastlink",
    "slug": "lastlink",
    "ats": "INHIRE",
    "careerUrl": "https://lastlink.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-lcr",
    "name": "LCR Contadores Associados",
    "slug": "lcr",
    "ats": "SOLIDES",
    "careerUrl": "https://lcr.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-leads2b",
    "name": "Leads2b",
    "slug": "leads2b",
    "ats": "GUPY",
    "careerUrl": "https://leads2b.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-leapfone",
    "name": "Leapfone",
    "slug": "leapfone",
    "ats": "GUPY",
    "careerUrl": "https://leapfone.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-legora",
    "name": "Legora",
    "slug": "legora",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/legora",
    "status": "MONITORED",
    "activeJobsCount": 38,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-leomadeiras",
    "name": "Leo Madeiras",
    "slug": "leomadeiras",
    "ats": "GUPY",
    "careerUrl": "https://leomadeiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-levesaude",
    "name": "Leve Saúde",
    "slug": "levesaude",
    "ats": "GUPY",
    "careerUrl": "https://levesaude.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-levelai",
    "name": "Level AI",
    "slug": "levelai",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/levelai",
    "status": "MONITORED",
    "activeJobsCount": 12,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-relx",
    "name": "LexisNexis Risk Solutions",
    "slug": "relx",
    "ats": "WORKDAY",
    "careerUrl": "https://relx.wd3.myworkdayjobs.com/pt-BR/RiskSolutions",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-liber",
    "name": "Líber",
    "slug": "liber",
    "ats": "INHIRE",
    "careerUrl": "https://liber.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-limaconsulting",
    "name": "Lima Consulting Group Brasil",
    "slug": "limaconsulting",
    "ats": "INHIRE",
    "careerUrl": "https://limaconsulting.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-lindy",
    "name": "Lindy",
    "slug": "lindy",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lindy",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-linea",
    "name": "Linea Alimentos",
    "slug": "linea",
    "ats": "GUPY",
    "careerUrl": "https://linea.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-linkschool",
    "name": "Link School",
    "slug": "linkschool",
    "ats": "SOLIDES",
    "careerUrl": "https://linkschool.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-linkedin3",
    "name": "LinkedIn",
    "slug": "linkedin3",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/LinkedIn3",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-linx",
    "name": "Linx",
    "slug": "linx",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/linx",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-lioraenergia",
    "name": "Liora",
    "slug": "lioraenergia",
    "ats": "INHIRE",
    "careerUrl": "https://lioraenergia.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-liquidz",
    "name": "LIQUIDZ",
    "slug": "liquidz",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/liquidz",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-litroz",
    "name": "Litroz | Gestão Inteligente de Combustível",
    "slug": "litroz",
    "ats": "SOLIDES",
    "careerUrl": "https://litroz.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-livelo",
    "name": "Livelo",
    "slug": "livelo",
    "ats": "INHIRE",
    "careerUrl": "https://livelo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-lmvagas",
    "name": "LM Mobilidade",
    "slug": "lmvagas",
    "ats": "GUPY",
    "careerUrl": "https://lmvagas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-localiza",
    "name": "Localiza&Co",
    "slug": "localiza",
    "ats": "GUPY",
    "careerUrl": "https://localiza.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 9,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-lwsa",
    "name": "Locaweb",
    "slug": "lwsa",
    "ats": "INHIRE",
    "careerUrl": "https://lwsa.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-teamtailor-loft",
    "name": "Loft",
    "slug": "loft",
    "ats": "TEAMTAILOR",
    "careerUrl": "https://loft.teamtailor.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-lofytstyle",
    "name": "LOFTY STYLE",
    "slug": "lofytstyle",
    "ats": "GUPY",
    "careerUrl": "https://lofytstyle.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-loginlogistica",
    "name": "Log-In Logística Integrada",
    "slug": "loginlogistica",
    "ats": "GUPY",
    "careerUrl": "https://loginlogistica.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-loggi",
    "name": "Loggi",
    "slug": "loggi",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/loggi",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-logicalit",
    "name": "Logical IT",
    "slug": "logicalit",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/logicalit",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagaslogicalisbrasil",
    "name": "Logicalis Brasil",
    "slug": "vagaslogicalisbrasil",
    "ats": "GUPY",
    "careerUrl": "https://vagaslogicalisbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-logothink",
    "name": "Logithink",
    "slug": "logothink",
    "ats": "GUPY",
    "careerUrl": "https://logothink.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-lojasmarisa",
    "name": "Lojas Marisa",
    "slug": "lojasmarisa",
    "ats": "PANDAPE",
    "careerUrl": "https://lojasmarisa.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-renner",
    "name": "Lojas Renner S.A.",
    "slug": "renner",
    "ats": "GUPY",
    "careerUrl": "https://renner.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-lojastorra",
    "name": "Lojas Torra",
    "slug": "lojastorra",
    "ats": "GUPY",
    "careerUrl": "https://lojastorra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-loovi",
    "name": "Loovi",
    "slug": "loovi",
    "ats": "SOLIDES",
    "careerUrl": "https://loovi.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-lovable",
    "name": "Lovable",
    "slug": "lovable",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lovable",
    "status": "MONITORED",
    "activeJobsCount": 29,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-lseg",
    "name": "LSEG",
    "slug": "lseg",
    "ats": "WORKDAY",
    "careerUrl": "https://lseg.wd3.myworkdayjobs.com/Careers/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-luby",
    "name": "Luby",
    "slug": "luby",
    "ats": "INHIRE",
    "careerUrl": "https://luby.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-magalu",
    "name": "luiza labs",
    "slug": "magalu",
    "ats": "INHIRE",
    "careerUrl": "https://magalu.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-lumimeds",
    "name": "LumiMeds",
    "slug": "lumimeds",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/lumimeds",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sualuz",
    "name": "LUZ",
    "slug": "sualuz",
    "ats": "GUPY",
    "careerUrl": "https://sualuz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-lwsa",
    "name": "LWSA + Melhor Envio",
    "slug": "lwsa",
    "ats": "GUPY",
    "careerUrl": "https://lwsa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-lyncas",
    "name": "Lyncas",
    "slug": "lyncas",
    "ats": "INHIRE",
    "careerUrl": "https://lyncas.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 14,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-makasi",
    "name": "Makasí",
    "slug": "makasi",
    "ats": "INHIRE",
    "careerUrl": "https://makasi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-makeone",
    "name": "MakeOne",
    "slug": "makeone",
    "ats": "SOLIDES",
    "careerUrl": "https://makeone.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mambape",
    "name": "Mamba Digital",
    "slug": "mambape",
    "ats": "INHIRE",
    "careerUrl": "https://mambape.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mapfrepoc",
    "name": "Mapfre",
    "slug": "mapfrepoc",
    "ats": "INHIRE",
    "careerUrl": "https://mapfrepoc.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-markup",
    "name": "Mark Up",
    "slug": "markup",
    "ats": "GUPY",
    "careerUrl": "https://markup.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-market4u",
    "name": "market4u",
    "slug": "market4u",
    "ats": "GUPY",
    "careerUrl": "https://market4u.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-marketdata",
    "name": "Marketdata",
    "slug": "marketdata",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/marketdata",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-mmc",
    "name": "Marsh",
    "slug": "mmc",
    "ats": "WORKDAY",
    "careerUrl": "https://mmc.wd1.myworkdayjobs.com/pt-BR/MMC",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-martminasedom",
    "name": "Mart Minas Atacado e Varejo",
    "slug": "martminasedom",
    "ats": "RECRUTAI",
    "careerUrl": "https://martminasedom.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-martinbrowerbrasil",
    "name": "Martin Brower Brasil",
    "slug": "martinbrowerbrasil",
    "ats": "GUPY",
    "careerUrl": "https://martinbrowerbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-masterintelligencetax",
    "name": "MasterTax",
    "slug": "masterintelligencetax",
    "ats": "PANDAPE",
    "careerUrl": "https://masterintelligencetax.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-mathgroup",
    "name": "MATH Group",
    "slug": "mathgroup",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/mathgroup",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-matrixenergia",
    "name": "Matrix Energia",
    "slug": "matrixenergia",
    "ats": "GUPY",
    "careerUrl": "https://matrixenergia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-maxtrack",
    "name": "Maxtrack",
    "slug": "maxtrack",
    "ats": "SOLIDES",
    "careerUrl": "https://maxtrack.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mcassabdistribuicao",
    "name": "MCassab Distribuição",
    "slug": "mcassabdistribuicao",
    "ats": "GUPY",
    "careerUrl": "https://mcassabdistribuicao.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-medreview",
    "name": "MED Review",
    "slug": "medreview",
    "ats": "SOLIDES",
    "careerUrl": "https://vagas.solides.com.br#medreview",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-medicicor",
    "name": "Medicicor Comercial LTDA",
    "slug": "medicicor",
    "ats": "GUPY",
    "careerUrl": "https://medicicor.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-medsenior",
    "name": "MedSênior",
    "slug": "medsenior",
    "ats": "GUPY",
    "careerUrl": "https://medsenior.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-medway",
    "name": "Medway",
    "slug": "medway",
    "ats": "INHIRE",
    "careerUrl": "https://medway.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-meep",
    "name": "Meep",
    "slug": "meep",
    "ats": "SOLIDES",
    "careerUrl": "https://meep.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-meetime",
    "name": "Meetime",
    "slug": "meetime",
    "ats": "GUPY",
    "careerUrl": "https://meetime.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-meetrox",
    "name": "MeetRox",
    "slug": "meetrox",
    "ats": "INHIRE",
    "careerUrl": "https://meetrox.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-melhorenvio",
    "name": "Melhor Envio",
    "slug": "melhorenvio",
    "ats": "GUPY",
    "careerUrl": "https://melhorenvio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-meliuz",
    "name": "Méliuz",
    "slug": "meliuz",
    "ats": "GUPY",
    "careerUrl": "https://meliuz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-memed",
    "name": "Memed",
    "slug": "memed",
    "ats": "GUPY",
    "careerUrl": "https://memed.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mercadaodosoculos",
    "name": "Mercadão dos Óculos",
    "slug": "mercadaodosoculos",
    "ats": "GUPY",
    "careerUrl": "https://mercadaodosoculos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mb",
    "name": "Mercado Bitcoin",
    "slug": "mb",
    "ats": "GUPY",
    "careerUrl": "https://mb.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eightfold-mercadolibre",
    "name": "Mercado Livre",
    "slug": "mercadolibre",
    "ats": "EIGHTFOLD",
    "careerUrl": "https://mercadolibre.eightfold.ai/careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-mercadocar",
    "name": "Mercadocar",
    "slug": "mercadocar",
    "ats": "PANDAPE",
    "careerUrl": "https://mercadocar.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mercafacil",
    "name": "Mercafacil",
    "slug": "mercafacil",
    "ats": "GUPY",
    "careerUrl": "https://mercafacil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mercos",
    "name": "Mercos",
    "slug": "mercos",
    "ats": "GUPY",
    "careerUrl": "https://mercos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mereo",
    "name": "Mereo",
    "slug": "mereo",
    "ats": "INHIRE",
    "careerUrl": "https://mereo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-metal",
    "name": "Metal",
    "slug": "metal",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/metal",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-grupometodo",
    "name": "Método Telecom",
    "slug": "grupometodo",
    "ats": "INHIRE",
    "careerUrl": "https://grupometodo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-metrobh",
    "name": "Metrô BH",
    "slug": "metrobh",
    "ats": "GUPY",
    "careerUrl": "https://metrobh.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mevo",
    "name": "mevo",
    "slug": "mevo",
    "ats": "INHIRE",
    "careerUrl": "https://mevo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-michelinconnectedfleet",
    "name": "Michelin",
    "slug": "michelinconnectedfleet",
    "ats": "GUPY",
    "careerUrl": "https://michelinconnectedfleet.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-milvus",
    "name": "Milvus",
    "slug": "milvus",
    "ats": "INHIRE",
    "careerUrl": "https://milvus.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mindminers",
    "name": "MindMiners",
    "slug": "mindminers",
    "ats": "GUPY",
    "careerUrl": "https://mindminers.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-mindsight",
    "name": "Mindsight",
    "slug": "mindsight",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/mindsight",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-minervatech",
    "name": "Minerva Foods Tecnologia",
    "slug": "minervatech",
    "ats": "GUPY",
    "careerUrl": "https://minervatech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-minsait",
    "name": "Minsait an Indra Company",
    "slug": "minsait",
    "ats": "GUPY",
    "careerUrl": "https://minsait.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 5,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mjvcarreiras",
    "name": "MJV Technology",
    "slug": "mjvcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://mjvcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mlabs",
    "name": "mLabs",
    "slug": "mlabs",
    "ats": "GUPY",
    "careerUrl": "https://mlabs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-modalgr",
    "name": "ModalGR",
    "slug": "modalgr",
    "ats": "GUPY",
    "careerUrl": "https://modalgr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-mollicait",
    "name": "Mollica IT",
    "slug": "mollicait",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/mollicait",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-mondelez",
    "name": "Mondelēz International",
    "slug": "mondelez",
    "ats": "WORKDAY",
    "careerUrl": "https://mondelez.wd3.myworkdayjobs.com/pt-BR/External",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-brmonks",
    "name": "Monks",
    "slug": "brmonks",
    "ats": "GUPY",
    "careerUrl": "https://brmonks.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-montecarlo",
    "name": "Monte Carlo Joias",
    "slug": "montecarlo",
    "ats": "GUPY",
    "careerUrl": "https://montecarlo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-motoristapx",
    "name": "Motorista PX",
    "slug": "motoristapx",
    "ats": "SOLIDES",
    "careerUrl": "https://motoristapx.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mottu",
    "name": "Mottu",
    "slug": "mottu",
    "ats": "INHIRE",
    "careerUrl": "https://mottu.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 12,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-motz",
    "name": "Motz",
    "slug": "motz",
    "ats": "GUPY",
    "careerUrl": "https://motz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-mourasrh",
    "name": "MOURA'S RH",
    "slug": "mourasrh",
    "ats": "SOLIDES",
    "careerUrl": "https://vagas.solides.com.br#mourasrh",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-movecta",
    "name": "Movecta",
    "slug": "movecta",
    "ats": "INHIRE",
    "careerUrl": "https://movecta.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-movida",
    "name": "Movida",
    "slug": "movida",
    "ats": "GUPY",
    "careerUrl": "https://movida.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagas-mrveco",
    "name": "MRV&CO",
    "slug": "vagas-mrveco",
    "ats": "GUPY",
    "careerUrl": "https://vagas-mrveco.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-msxinternational",
    "name": "MSX International",
    "slug": "msxinternational",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/MSXInternational",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-multipedidos",
    "name": "MULTIPEDIDOS",
    "slug": "multipedidos",
    "ats": "SOLIDES",
    "careerUrl": "https://multipedidos.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mundiale",
    "name": "Mundiale",
    "slug": "mundiale",
    "ats": "GUPY",
    "careerUrl": "https://mundiale.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-mundomaker",
    "name": "MundoMaker",
    "slug": "mundomaker",
    "ats": "SOLIDES",
    "careerUrl": "https://mundomaker.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-muskinha",
    "name": "Muskinha Design que cuida",
    "slug": "muskinha",
    "ats": "SOLIDES",
    "careerUrl": "https://muskinha.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-mutantbrvagas",
    "name": "Mutant",
    "slug": "mutantbrvagas",
    "ats": "GUPY",
    "careerUrl": "https://mutantbrvagas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nasajon",
    "name": "Nasajon",
    "slug": "nasajon",
    "ats": "GUPY",
    "careerUrl": "https://nasajon.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-natura",
    "name": "Natura",
    "slug": "natura",
    "ats": "WORKDAY",
    "careerUrl": "https://natura.wd501.myworkdayjobs.com/pt-BR/NaturaCarreiras",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-nddtech",
    "name": "NDD Tech | Brasil",
    "slug": "nddtech",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/nddtech",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-necxt",
    "name": "Necxt",
    "slug": "necxt",
    "ats": "GUPY",
    "careerUrl": "https://necxt.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nefex",
    "name": "Nefex",
    "slug": "nefex",
    "ats": "GUPY",
    "careerUrl": "https://nefex.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nelogica",
    "name": "Nelogica",
    "slug": "nelogica",
    "ats": "GUPY",
    "careerUrl": "https://nelogica.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-neoassist",
    "name": "NeoAssist",
    "slug": "neoassist",
    "ats": "GUPY",
    "careerUrl": "https://neoassist.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-neohype",
    "name": "Neobpo",
    "slug": "neohype",
    "ats": "PANDAPE",
    "careerUrl": "https://neohype.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-iberdrola",
    "name": "NeoEnergia",
    "slug": "iberdrola",
    "ats": "WORKDAY",
    "careerUrl": "https://iberdrola.wd3.myworkdayjobs.com/pt-BR/Iberdrola",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-neogridcarreiras",
    "name": "Neogrid Carreiras",
    "slug": "neogridcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://neogridcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-neon",
    "name": "Neon Pagamentos",
    "slug": "neon",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/neon",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-eightfold-netflix",
    "name": "Netflix",
    "slug": "netflix",
    "ats": "EIGHTFOLD",
    "careerUrl": "https://explore.jobs.netflix.net/careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-netomi",
    "name": "Netomi",
    "slug": "netomi",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/netomi",
    "status": "MONITORED",
    "activeJobsCount": 9,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-netrin",
    "name": "Netrin",
    "slug": "netrin",
    "ats": "INHIRE",
    "careerUrl": "https://netrin.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-netshowme",
    "name": "Netshow.me",
    "slug": "netshowme",
    "ats": "GUPY",
    "careerUrl": "https://netshowme.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nexatecnologia",
    "name": "Nexa Tecnologia",
    "slug": "nexatecnologia",
    "ats": "GUPY",
    "careerUrl": "https://nexatecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-nexforce",
    "name": "Nexforce",
    "slug": "nexforce",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/nexforce",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-nextfit",
    "name": "Next Fit",
    "slug": "nextfit",
    "ats": "PANDAPE",
    "careerUrl": "https://nextfit.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-nibo",
    "name": "nibo",
    "slug": "nibo",
    "ats": "INHIRE",
    "careerUrl": "https://nibo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-ninetwothree-ai-studio",
    "name": "NineTwoThree AI Studio",
    "slug": "ninetwothree-ai-studio",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/ninetwothree-ai-studio",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nola",
    "name": "Nola",
    "slug": "nola",
    "ats": "GUPY",
    "careerUrl": "https://nola.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-nomadglobal",
    "name": "Nomad",
    "slug": "nomadglobal",
    "ats": "INHIRE",
    "careerUrl": "https://nomadglobal.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nomos",
    "name": "Nomos",
    "slug": "nomos",
    "ats": "GUPY",
    "careerUrl": "https://nomos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nomus",
    "name": "Nomus",
    "slug": "nomus",
    "ats": "GUPY",
    "careerUrl": "https://nomus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-notion",
    "name": "Notion",
    "slug": "notion",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/notion",
    "status": "MONITORED",
    "activeJobsCount": 34,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-nstech",
    "name": "nstech",
    "slug": "nstech",
    "ats": "INHIRE",
    "careerUrl": "https://nstech.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 7,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-nubank",
    "name": "Nubank",
    "slug": "nubank",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/nubank",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-nubank",
    "name": "Nubank",
    "slug": "nubank",
    "ats": "ASHBY",
    "careerUrl": "https://nu.com/pt/carreiras/open-roles",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-nuclea",
    "name": "Núclea",
    "slug": "nuclea",
    "ats": "GUPY",
    "careerUrl": "https://nuclea.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-nutricaosemfronteiras",
    "name": "Nutrição Sem Fronteiras",
    "slug": "nutricaosemfronteiras",
    "ats": "SOLIDES",
    "careerUrl": "https://nutricaosemfronteiras.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-nuvemshop-tiendanube",
    "name": "Nuvemshop",
    "slug": "nuvemshop-tiendanube",
    "ats": "INHIRE",
    "careerUrl": "https://nuvemshop-tiendanube.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-nuvidio",
    "name": "Nuvidio",
    "slug": "nuvidio",
    "ats": "INHIRE",
    "careerUrl": "https://nuvidio.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-octadesk",
    "name": "Octadesk",
    "slug": "octadesk",
    "ats": "GUPY",
    "careerUrl": "https://octadesk.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-octafy",
    "name": "Octafy",
    "slug": "octafy",
    "ats": "INHIRE",
    "careerUrl": "https://octafy.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagasodontoprev",
    "name": "Odontoprev",
    "slug": "vagasodontoprev",
    "ats": "GUPY",
    "careerUrl": "https://vagasodontoprev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-oincfilmes",
    "name": "Oinc Filmes",
    "slug": "oincfilmes",
    "ats": "GUPY",
    "careerUrl": "https://oincfilmes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-okendo",
    "name": "Okendo",
    "slug": "okendo",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/okendo",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-olist",
    "name": "Olist",
    "slug": "olist",
    "ats": "INHIRE",
    "careerUrl": "https://olist.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-ollie",
    "name": "Ollie",
    "slug": "ollie",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/ollie",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-carreirasomie",
    "name": "Omie",
    "slug": "carreirasomie",
    "ats": "GUPY",
    "careerUrl": "https://carreirasomie.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-omnibeesmx",
    "name": "Omnibees",
    "slug": "omnibeesmx",
    "ats": "GUPY",
    "careerUrl": "https://omnibeesmx.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-omnilink",
    "name": "Omnilink",
    "slug": "omnilink",
    "ats": "PANDAPE",
    "careerUrl": "https://omnilink.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-mbsbrands",
    "name": "Omniteca",
    "slug": "mbsbrands",
    "ats": "INHIRE",
    "careerUrl": "https://mbsbrands.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-onfly",
    "name": "Onfly",
    "slug": "onfly",
    "ats": "GUPY",
    "careerUrl": "https://onfly.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-onisys",
    "name": "Onisys by nstech",
    "slug": "onisys",
    "ats": "GUPY",
    "careerUrl": "https://onisys.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ontex",
    "name": "Ontex",
    "slug": "ontex",
    "ats": "GUPY",
    "careerUrl": "https://ontex.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-openlabs",
    "name": "Open Labs",
    "slug": "openlabs",
    "ats": "GUPY",
    "careerUrl": "https://openlabs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-openai",
    "name": "OpenAI",
    "slug": "openai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/openai",
    "status": "MONITORED",
    "activeJobsCount": 315,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-editoraopet",
    "name": "Opet",
    "slug": "editoraopet",
    "ats": "SOLIDES",
    "careerUrl": "https://editoraopet.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-ordergroove-referrals",
    "name": "Ordergroove",
    "slug": "ordergroove-referrals",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/ordergroove-referrals",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-orizon",
    "name": "Orizon",
    "slug": "orizon",
    "ats": "INHIRE",
    "careerUrl": "https://orizon.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-orsegups",
    "name": "Orsegups Participações S/A",
    "slug": "orsegups",
    "ats": "PANDAPE",
    "careerUrl": "https://orsegups.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-otis",
    "name": "Otis Elevator Co.",
    "slug": "otis",
    "ats": "WORKDAY",
    "careerUrl": "https://otis.wd5.myworkdayjobs.com/pt-BR/REC_Ext_Gateway",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-oto",
    "name": "Oto",
    "slug": "oto",
    "ats": "GUPY",
    "careerUrl": "https://oto.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-ottimizza",
    "name": "OTTIMIZZA",
    "slug": "ottimizza",
    "ats": "SOLIDES",
    "careerUrl": "https://ottimizza.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruponos",
    "name": "OXXO Brasil",
    "slug": "gruponos",
    "ats": "GUPY",
    "careerUrl": "https://gruponos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-oyster",
    "name": "Oyster",
    "slug": "oyster",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/oyster",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-ozmap",
    "name": "OZmap",
    "slug": "ozmap",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/ozmap",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-pgprocterandgamble",
    "name": "P&G Procter and Gamble",
    "slug": "pgprocterandgamble",
    "ats": "WORKDAY",
    "careerUrl": "https://www.pgcareers.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-pabum",
    "name": "Pabum RH",
    "slug": "pabum",
    "ats": "PANDAPE",
    "careerUrl": "https://pabum.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pagaleve",
    "name": "Pagaleve",
    "slug": "pagaleve",
    "ats": "GUPY",
    "careerUrl": "https://pagaleve.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pagseguro",
    "name": "PagBank",
    "slug": "pagseguro",
    "ats": "GUPY",
    "careerUrl": "https://pagseguro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 42,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pageoutsourcingbr",
    "name": "Page Outsourcing",
    "slug": "pageoutsourcingbr",
    "ats": "GUPY",
    "careerUrl": "https://pageoutsourcingbr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-carreiras",
    "name": "Página de EuroChem",
    "slug": "carreiras",
    "ats": "GUPY",
    "careerUrl": "https://carreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-paketa",
    "name": "Paketá",
    "slug": "paketa",
    "ats": "SOLIDES",
    "careerUrl": "https://paketa.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-palantir",
    "name": "Palantir Technologies",
    "slug": "palantir",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/palantir",
    "status": "MONITORED",
    "activeJobsCount": 198,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-empregos",
    "name": "Pandapé",
    "slug": "empregos",
    "ats": "PANDAPE",
    "careerUrl": "https://empregos.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-panoptyc",
    "name": "Panoptyc",
    "slug": "panoptyc",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/Panoptyc",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-papier",
    "name": "Papier",
    "slug": "papier",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/papier",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-paschoalotto",
    "name": "Paschoalotto",
    "slug": "paschoalotto",
    "ats": "GUPY",
    "careerUrl": "https://paschoalotto.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-paytmpayments",
    "name": "Paytm Payments Services",
    "slug": "paytmpayments",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/paytmpayments",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-paytrack",
    "name": "Paytrack",
    "slug": "paytrack",
    "ats": "INHIRE",
    "careerUrl": "https://paytrack.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-pencil",
    "name": "Pencil",
    "slug": "pencil",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/pencil",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-peopletalent",
    "name": "People Talent",
    "slug": "peopletalent",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/peopletalent",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-perplexity",
    "name": "Perplexity",
    "slug": "perplexity",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/perplexity",
    "status": "MONITORED",
    "activeJobsCount": 49,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-petlove",
    "name": "Petlove",
    "slug": "petlove",
    "ats": "RECRUTAI",
    "careerUrl": "https://petlove.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-petz",
    "name": "Petz",
    "slug": "petz",
    "ats": "GUPY",
    "careerUrl": "https://petz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-philips",
    "name": "Philips",
    "slug": "philips",
    "ats": "WORKDAY",
    "careerUrl": "https://philips.wd3.myworkdayjobs.com/pt-BR/jobs-and-careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-phiz",
    "name": "PhizChat",
    "slug": "phiz",
    "ats": "GUPY",
    "careerUrl": "https://phiz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-picpay",
    "name": "PicPay",
    "slug": "picpay",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/picpay",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-pier",
    "name": "Pier Seguradora",
    "slug": "pier",
    "ats": "INHIRE",
    "careerUrl": "https://pier.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-pigment",
    "name": "Pigment",
    "slug": "pigment",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/pigment",
    "status": "MONITORED",
    "activeJobsCount": 25,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-pilar",
    "name": "Pilar",
    "slug": "pilar",
    "ats": "INHIRE",
    "careerUrl": "https://pilar.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-vemserpinbank",
    "name": "Pinbank",
    "slug": "vemserpinbank",
    "ats": "SOLIDES",
    "careerUrl": "https://vemserpinbank.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-pinterest",
    "name": "Pinterest",
    "slug": "pinterest",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/pinterest",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-piperz",
    "name": "Piperz",
    "slug": "piperz",
    "ats": "GUPY",
    "careerUrl": "https://piperz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-piposaude",
    "name": "Pipo Saúde",
    "slug": "piposaude",
    "ats": "INHIRE",
    "careerUrl": "https://piposaude.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-visa",
    "name": "Pismo",
    "slug": "visa",
    "ats": "WORKDAY",
    "careerUrl": "https://visa.wd5.myworkdayjobs.com/Visa/page/3b371539a3c810015ae4164c71d70000",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-pitneybowes",
    "name": "Pitney Bowes",
    "slug": "pitneybowes",
    "ats": "WORKDAY",
    "careerUrl": "https://pitneybowes.wd1.myworkdayjobs.com/PBCareers/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pitzi",
    "name": "Pitzi",
    "slug": "pitzi",
    "ats": "GUPY",
    "careerUrl": "https://pitzi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprapixeon",
    "name": "Pixeon",
    "slug": "vemprapixeon",
    "ats": "GUPY",
    "careerUrl": "https://vemprapixeon.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-planetlabs",
    "name": "Planet",
    "slug": "planetlabs",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/planetlabs",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-platformscience",
    "name": "Platform Science",
    "slug": "platformscience",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/platformscience",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ploomes",
    "name": "Ploomes",
    "slug": "ploomes",
    "ats": "GUPY",
    "careerUrl": "https://ploomes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pluxee-br",
    "name": "Pluxee Brasil",
    "slug": "pluxee-br",
    "ats": "GUPY",
    "careerUrl": "https://pluxee-br.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-cursospm3",
    "name": "PM3",
    "slug": "cursospm3",
    "ats": "GUPY",
    "careerUrl": "https://cursospm3.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pmweb",
    "name": "Pmweb",
    "slug": "pmweb",
    "ats": "GUPY",
    "careerUrl": "https://pmweb.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-poliedroeducacao",
    "name": "Poliedro Educação",
    "slug": "poliedroeducacao",
    "ats": "INHIRE",
    "careerUrl": "https://poliedroeducacao.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pontotel",
    "name": "Pontotel",
    "slug": "pontotel",
    "ats": "GUPY",
    "careerUrl": "https://pontotel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-pontotel",
    "name": "Pontotel",
    "slug": "pontotel",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/pontotel",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-pony-dot-ai",
    "name": "pony.ai",
    "slug": "pony-dot-ai",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/pony-dot-ai",
    "status": "MONITORED",
    "activeJobsCount": 9,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-portabilis",
    "name": "Portábilis",
    "slug": "portabilis",
    "ats": "GUPY",
    "careerUrl": "https://portabilis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-portalsolar",
    "name": "Portal Solar",
    "slug": "portalsolar",
    "ats": "GUPY",
    "careerUrl": "https://portalsolar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-portaltelemedicina",
    "name": "PORTAL TELEMEDICINA",
    "slug": "portaltelemedicina",
    "ats": "SOLIDES",
    "careerUrl": "https://portaltelemedicina.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-porto",
    "name": "Porto",
    "slug": "porto",
    "ats": "GUPY",
    "careerUrl": "https://porto.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-positivotecnologia",
    "name": "Positivo Tecnologia",
    "slug": "positivotecnologia",
    "ats": "GUPY",
    "careerUrl": "https://positivotecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-pottencial",
    "name": "Pottencial",
    "slug": "pottencial",
    "ats": "INHIRE",
    "careerUrl": "https://pottencial.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-pravaler",
    "name": "Pravaler",
    "slug": "pravaler",
    "ats": "INHIRE",
    "careerUrl": "https://pravaler.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-praxianbusiness",
    "name": "Praxian",
    "slug": "praxianbusiness",
    "ats": "GUPY",
    "careerUrl": "https://praxianbusiness.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-praxio",
    "name": "Praxio",
    "slug": "praxio",
    "ats": "GUPY",
    "careerUrl": "https://praxio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-primer",
    "name": "Primer",
    "slug": "primer",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/primer",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-prismafivetech",
    "name": "Prismafive",
    "slug": "prismafivetech",
    "ats": "SOLIDES",
    "careerUrl": "https://prismafivetech.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-prizmamidia",
    "name": "Prizma Mídia",
    "slug": "prizmamidia",
    "ats": "INHIRE",
    "careerUrl": "https://prizmamidia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-proauto",
    "name": "PROAUTO",
    "slug": "proauto",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/proauto",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-processstreet",
    "name": "Process Street",
    "slug": "processstreet",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/processstreet",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-produttivo",
    "name": "Produttivo",
    "slug": "produttivo",
    "ats": "GUPY",
    "careerUrl": "https://produttivo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-programasembraer",
    "name": "Programas Embraer",
    "slug": "programasembraer",
    "ats": "GUPY",
    "careerUrl": "https://programasembraer.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-selecty-projeto22",
    "name": "projeto22",
    "slug": "projeto22",
    "ats": "SELECTY",
    "careerUrl": "https://projeto22.selecty.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-pronexus-1",
    "name": "ProNexus",
    "slug": "pronexus-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/pronexus-1",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-dhg",
    "name": "PRORADIS",
    "slug": "dhg",
    "ats": "INHIRE",
    "careerUrl": "https://dhg.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-psicomanager",
    "name": "PsicoManager",
    "slug": "psicomanager",
    "ats": "SOLIDES",
    "careerUrl": "https://psicomanager.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-ptc",
    "name": "PTC",
    "slug": "ptc",
    "ats": "WORKDAY",
    "careerUrl": "https://ptc.wd1.myworkdayjobs.com/pt-BR/PTC",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-pulse",
    "name": "Pulse Client Experts",
    "slug": "pulse",
    "ats": "PANDAPE",
    "careerUrl": "https://pulse.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-pulsus",
    "name": "Pulsus",
    "slug": "pulsus",
    "ats": "GUPY",
    "careerUrl": "https://pulsus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-pwc",
    "name": "PwC",
    "slug": "pwc",
    "ats": "WORKDAY",
    "careerUrl": "https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-qdrant",
    "name": "Qdrant",
    "slug": "qdrant",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/qdrant",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-qive",
    "name": "Qive",
    "slug": "qive",
    "ats": "INHIRE",
    "careerUrl": "https://qive.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-carreirasquali",
    "name": "Qualicorp",
    "slug": "carreirasquali",
    "ats": "GUPY",
    "careerUrl": "https://carreirasquali.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eightfold-ralliant",
    "name": "Qualitrol",
    "slug": "ralliant",
    "ats": "EIGHTFOLD",
    "careerUrl": "https://ralliant.eightfold.ai/careers",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-queropassagem",
    "name": "Quero Passagem",
    "slug": "queropassagem",
    "ats": "INHIRE",
    "careerUrl": "https://queropassagem.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-qsd",
    "name": "Quero Ser Dev",
    "slug": "qsd",
    "ats": "GUPY",
    "careerUrl": "https://qsd.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-quickin",
    "name": "Quickin",
    "slug": "quickin",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/quickin",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-quintoandar",
    "name": "QuintoAndar",
    "slug": "quintoandar",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/quintoandar",
    "status": "MONITORED",
    "activeJobsCount": 16,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vempraquod",
    "name": "Quod",
    "slug": "vempraquod",
    "ats": "GUPY",
    "careerUrl": "https://vempraquod.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-radix",
    "name": "Radix",
    "slug": "radix",
    "ats": "INHIRE",
    "careerUrl": "https://radix.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-radixeng",
    "name": "Radix Engenharia",
    "slug": "radixeng",
    "ats": "GUPY",
    "careerUrl": "https://radixeng.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-genteraizen",
    "name": "Raizen",
    "slug": "genteraizen",
    "ats": "GUPY",
    "careerUrl": "https://genteraizen.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-ramp",
    "name": "Ramp",
    "slug": "ramp",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ramp",
    "status": "MONITORED",
    "activeJobsCount": 40,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rankmyapp",
    "name": "RankMyApp",
    "slug": "rankmyapp",
    "ats": "INHIRE",
    "careerUrl": "https://rankmyapp.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-rappi",
    "name": "Rappi",
    "slug": "rappi",
    "ats": "WORKDAY",
    "careerUrl": "https://rappi.wd12.myworkdayjobs.com/es/Rappi_jobs",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-rdsaude-corporativo",
    "name": "RD Saúde",
    "slug": "rdsaude-corporativo",
    "ats": "GUPY",
    "careerUrl": "https://rdsaude-corporativo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-rdstation",
    "name": "RD Station",
    "slug": "rdstation",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/rdstation",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-reaqtwater",
    "name": "Reaqt Water Technologies",
    "slug": "reaqtwater",
    "ats": "SOLIDES",
    "careerUrl": "https://reaqtwater.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-reclameaqui",
    "name": "Reclame AQUI",
    "slug": "reclameaqui",
    "ats": "INHIRE",
    "careerUrl": "https://reclameaqui.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-redhat",
    "name": "Red Hat",
    "slug": "redhat",
    "ats": "WORKDAY",
    "careerUrl": "https://redhat.wd5.myworkdayjobs.com/jobs/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-redeamericas",
    "name": "Rede Américas",
    "slug": "redeamericas",
    "ats": "GUPY",
    "careerUrl": "https://redeamericas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bandeirantes",
    "name": "Rede Bandeirantes",
    "slug": "bandeirantes",
    "ats": "GUPY",
    "careerUrl": "https://bandeirantes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-rededor",
    "name": "Rede DOr",
    "slug": "rededor",
    "ats": "GUPY",
    "careerUrl": "https://rededor.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-regent",
    "name": "REGENT",
    "slug": "regent",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/regent",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-remofirst",
    "name": "RemoFirst",
    "slug": "remofirst",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/remofirst",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-remotecom",
    "name": "Remote",
    "slug": "remotecom",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/remotecom",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rentbrella",
    "name": "Rentbrella",
    "slug": "rentbrella",
    "ats": "INHIRE",
    "careerUrl": "https://rentbrella.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-reprotel",
    "name": "Reprotel",
    "slug": "reprotel",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/reprotel",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-befly",
    "name": "Reservia",
    "slug": "befly",
    "ats": "GUPY",
    "careerUrl": "https://befly.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-revizia",
    "name": "Revizia",
    "slug": "revizia",
    "ats": "GUPY",
    "careerUrl": "https://revizia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-eccotalent",
    "name": "rhello RH",
    "slug": "eccotalent",
    "ats": "GUPY",
    "careerUrl": "https://eccotalent.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rhitmotech",
    "name": "Rhitmotech",
    "slug": "rhitmotech",
    "ats": "INHIRE",
    "careerUrl": "https://rhitmotech.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-riachuelo",
    "name": "Riachuelo",
    "slug": "riachuelo",
    "ats": "GUPY",
    "careerUrl": "https://riachuelo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-riachuelo",
    "name": "Riachuelo",
    "slug": "riachuelo",
    "ats": "INHIRE",
    "careerUrl": "https://riachuelo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-ribeira",
    "name": "Ribeira Empreendimentos Imobiliários",
    "slug": "ribeira",
    "ats": "GUPY",
    "careerUrl": "https://ribeira.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-robinhood",
    "name": "Robinhood",
    "slug": "robinhood",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/robinhood",
    "status": "MONITORED",
    "activeJobsCount": 104,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rockencantech",
    "name": "Rock Encantech",
    "slug": "rockencantech",
    "ats": "INHIRE",
    "careerUrl": "https://rockencantech.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-rogo",
    "name": "Rogo",
    "slug": "rogo",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/rogo",
    "status": "MONITORED",
    "activeJobsCount": 15,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-rokt",
    "name": "Rokt",
    "slug": "rokt",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/rokt",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-rootsgestao",
    "name": "Roots Gestão de Pessoas",
    "slug": "rootsgestao",
    "ats": "SOLIDES",
    "careerUrl": "https://rootsgestao.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rotik",
    "name": "Rotik",
    "slug": "rotik",
    "ats": "INHIRE",
    "careerUrl": "https://grupogopwr.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-rpe",
    "name": "RPE",
    "slug": "rpe",
    "ats": "GUPY",
    "careerUrl": "https://rpe.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-rposolutions",
    "name": "RPO Solutions",
    "slug": "rposolutions",
    "ats": "GUPY",
    "careerUrl": "https://rposolutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-rpo-xpinc",
    "name": "Rpo Xpinc",
    "slug": "rpo-xpinc",
    "ats": "INHIRE",
    "careerUrl": "https://rpo-xpinc.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-rvops",
    "name": "Rvops",
    "slug": "rvops",
    "ats": "SOLIDES",
    "careerUrl": "https://rvops.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprasin",
    "name": "S.I.N. Implant System",
    "slug": "vemprasin",
    "ats": "GUPY",
    "careerUrl": "https://vemprasin.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-safeweb",
    "name": "Safeweb Segurança da Informação",
    "slug": "safeweb",
    "ats": "INHIRE",
    "careerUrl": "https://safeweb.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-sailpoint",
    "name": "SailPoint",
    "slug": "sailpoint",
    "ats": "WORKDAY",
    "careerUrl": "https://sailpoint.wd1.myworkdayjobs.com/SailPoint/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-saipos",
    "name": "Saipos",
    "slug": "saipos",
    "ats": "GUPY",
    "careerUrl": "https://saipos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-salesleadersgroup",
    "name": "Sales Leaders Group",
    "slug": "salesleadersgroup",
    "ats": "GUPY",
    "careerUrl": "https://salesleadersgroup.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-salesforce",
    "name": "Salesforce",
    "slug": "salesforce",
    "ats": "WORKDAY",
    "careerUrl": "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-sallve",
    "name": "Sallve",
    "slug": "sallve",
    "ats": "INHIRE",
    "careerUrl": "https://sallve.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-oisami",
    "name": "Sami",
    "slug": "oisami",
    "ats": "GUPY",
    "careerUrl": "https://oisami.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-samsung",
    "name": "Samsung",
    "slug": "samsung",
    "ats": "INHIRE",
    "careerUrl": "https://samsung.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-sanar",
    "name": "Sanar",
    "slug": "sanar",
    "ats": "INHIRE",
    "careerUrl": "https://sanar.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-santillanabrasil",
    "name": "Santillana Brasil",
    "slug": "santillanabrasil",
    "ats": "GUPY",
    "careerUrl": "https://santillanabrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-savicosmeticosltda",
    "name": "SAVI COSMETICOS",
    "slug": "savicosmeticosltda",
    "ats": "PANDAPE",
    "careerUrl": "https://savicosmeticosltda.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-scanntechbrasil",
    "name": "Scanntech Brasil",
    "slug": "scanntechbrasil",
    "ats": "GUPY",
    "careerUrl": "https://scanntechbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-scansource",
    "name": "ScanSource",
    "slug": "scansource",
    "ats": "GUPY",
    "careerUrl": "https://scansource.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-seazone",
    "name": "Seazone",
    "slug": "seazone",
    "ats": "INHIRE",
    "careerUrl": "https://seazone.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-seconds",
    "name": "SECONDS",
    "slug": "seconds",
    "ats": "INHIRE",
    "careerUrl": "https://seconds.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-seedz",
    "name": "SEEDZ",
    "slug": "seedz",
    "ats": "GUPY",
    "careerUrl": "https://seedz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-seguracorretech-trial",
    "name": "Segura",
    "slug": "seguracorretech-trial",
    "ats": "INHIRE",
    "careerUrl": "https://seguracorretech-trial.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-seidor",
    "name": "SEIDOR",
    "slug": "seidor",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/seidor",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-semparar",
    "name": "Sem Parar",
    "slug": "semparar",
    "ats": "GUPY",
    "careerUrl": "https://semparar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-semantix",
    "name": "Semantix",
    "slug": "semantix",
    "ats": "GUPY",
    "careerUrl": "https://semantix.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-senhorcontabil",
    "name": "Senhor Contábil",
    "slug": "senhorcontabil",
    "ats": "SOLIDES",
    "careerUrl": "https://senhorcontabil.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-experian",
    "name": "Serasa Experian",
    "slug": "experian",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/Experian",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-shieldai",
    "name": "Shield AI",
    "slug": "shieldai",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/shieldai",
    "status": "MONITORED",
    "activeJobsCount": 146,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-shift",
    "name": "Shift",
    "slug": "shift",
    "ats": "GUPY",
    "careerUrl": "https://shift.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-shopper",
    "name": "Shopper",
    "slug": "shopper",
    "ats": "GUPY",
    "careerUrl": "https://shopper.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-shoulder",
    "name": "Shoulder",
    "slug": "shoulder",
    "ats": "GUPY",
    "careerUrl": "https://shoulder.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-credicitrus",
    "name": "Sicoob Credicitrus",
    "slug": "credicitrus",
    "ats": "SOLIDES",
    "careerUrl": "https://credicitrus.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sicoobcredicom",
    "name": "Sicoob Credicom",
    "slug": "sicoobcredicom",
    "ats": "GUPY",
    "careerUrl": "https://sicoobcredicom.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sicredi",
    "name": "Sicredi",
    "slug": "sicredi",
    "ats": "GUPY",
    "careerUrl": "https://sicredi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 18,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sidi",
    "name": "SiDi",
    "slug": "sidi",
    "ats": "GUPY",
    "careerUrl": "https://sidi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 19,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-carreirasieg",
    "name": "SIEG",
    "slug": "carreirasieg",
    "ats": "SOLIDES",
    "careerUrl": "https://carreirasieg.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-sierra",
    "name": "Sierra",
    "slug": "sierra",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/sierra",
    "status": "MONITORED",
    "activeJobsCount": 78,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-sierra-studio",
    "name": "Sierra Studio",
    "slug": "sierra-studio",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/sierra-studio",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-onesigga",
    "name": "Sigga Technologies",
    "slug": "onesigga",
    "ats": "GUPY",
    "careerUrl": "https://onesigga.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-sighratecnologiasistemainovadores",
    "name": "SIGhRA Sistemas Inovadores",
    "slug": "sighratecnologiasistemainovadores",
    "ats": "PANDAPE",
    "careerUrl": "https://sighratecnologiasistemainovadores.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-sila",
    "name": "Sila Services",
    "slug": "sila",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/sila",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-recursoshumanos",
    "name": "Simples Dental",
    "slug": "recursoshumanos",
    "ats": "GUPY",
    "careerUrl": "https://recursoshumanos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-simply-tv",
    "name": "Simply TV",
    "slug": "simply-tv",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/simply-tv",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-sinqia",
    "name": "Sinqia",
    "slug": "sinqia",
    "ats": "GUPY",
    "careerUrl": "https://sinqia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-sioux",
    "name": "Sioux digital 1:1",
    "slug": "sioux",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/sioux",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-siteware",
    "name": "Siteware",
    "slug": "siteware",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/siteware",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-skillconsultoria",
    "name": "Skill Consultoria",
    "slug": "skillconsultoria",
    "ats": "GUPY",
    "careerUrl": "https://skillconsultoria.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-skopiadigital",
    "name": "Skopia",
    "slug": "skopiadigital",
    "ats": "INHIRE",
    "careerUrl": "https://skopiadigital.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-skyone",
    "name": "Skyone",
    "slug": "skyone",
    "ats": "INHIRE",
    "careerUrl": "https://skyone.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-smartnx",
    "name": "Smart NX",
    "slug": "smartnx",
    "ats": "GUPY",
    "careerUrl": "https://smartnx.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-smarthis",
    "name": "Smarthis",
    "slug": "smarthis",
    "ats": "GUPY",
    "careerUrl": "https://smarthis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-smartlyio",
    "name": "Smartly",
    "slug": "smartlyio",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/smartlyio",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-smileuniversity",
    "name": "Smile University",
    "slug": "smileuniversity",
    "ats": "INHIRE",
    "careerUrl": "https://smileuniversity.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-snackcontent",
    "name": "Snack Content",
    "slug": "snackcontent",
    "ats": "GUPY",
    "careerUrl": "https://snackcontent.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-softexpert",
    "name": "SoftExpert",
    "slug": "softexpert",
    "ats": "GUPY",
    "careerUrl": "https://softexpert.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-softplan",
    "name": "Softplan",
    "slug": "softplan",
    "ats": "GUPY",
    "careerUrl": "https://softplan.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-softys",
    "name": "Softys",
    "slug": "softys",
    "ats": "PANDAPE",
    "careerUrl": "https://softys.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-solenis",
    "name": "Solenis",
    "slug": "solenis",
    "ats": "WORKDAY",
    "careerUrl": "https://solenis.wd1.myworkdayjobs.com/pt-BR/Solenis",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-solfacil",
    "name": "Solfácil",
    "slug": "solfacil",
    "ats": "INHIRE",
    "careerUrl": "https://solfacil.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-solucionare",
    "name": "Solucionare",
    "slug": "solucionare",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/solucionare",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-rhsolumedi",
    "name": "Solumedi Franquias",
    "slug": "rhsolumedi",
    "ats": "SOLIDES",
    "careerUrl": "https://rhsolumedi.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-soluparts",
    "name": "Soluparts",
    "slug": "soluparts",
    "ats": "GUPY",
    "careerUrl": "https://soluparts.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-solutis",
    "name": "Solutis",
    "slug": "solutis",
    "ats": "GUPY",
    "careerUrl": "https://solutis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-grupopomin",
    "name": "Solutta Consultoria",
    "slug": "grupopomin",
    "ats": "INHIRE",
    "careerUrl": "https://grupopomin.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-healthcare",
    "name": "Solventum",
    "slug": "healthcare",
    "ats": "WORKDAY",
    "careerUrl": "https://healthcare.wd1.myworkdayjobs.com/pt-BR/Search",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-solveplan",
    "name": "SolvePlan",
    "slug": "solveplan",
    "ats": "GUPY",
    "careerUrl": "https://solveplan.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-bhs",
    "name": "Somos BHS",
    "slug": "bhs",
    "ats": "GUPY",
    "careerUrl": "https://bhs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 12,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-sophos",
    "name": "Sophos",
    "slug": "sophos",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/sophos",
    "status": "MONITORED",
    "activeJobsCount": 12,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemsersparker",
    "name": "Spark",
    "slug": "vemsersparker",
    "ats": "GUPY",
    "careerUrl": "https://vemsersparker.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-spcbrasil",
    "name": "SPC Brasil",
    "slug": "spcbrasil",
    "ats": "GUPY",
    "careerUrl": "https://spcbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-sportradar",
    "name": "Sportradar",
    "slug": "sportradar",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/Sportradar",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-sportygroup",
    "name": "Sporty Group",
    "slug": "sportygroup",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/sportygroup",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-spotify",
    "name": "Spotify",
    "slug": "spotify",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/spotify",
    "status": "MONITORED",
    "activeJobsCount": 37,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-spread",
    "name": "Spread Tecnologia",
    "slug": "spread",
    "ats": "GUPY",
    "careerUrl": "https://spread.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-sprinklr",
    "name": "Sprinklr",
    "slug": "sprinklr",
    "ats": "WORKDAY",
    "careerUrl": "https://sprinklr.wd1.myworkdayjobs.com/careers/job",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-spun",
    "name": "Spun Mídia",
    "slug": "spun",
    "ats": "INHIRE",
    "careerUrl": "https://spun.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-square",
    "name": "Square / Block",
    "slug": "square",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/Square",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-stmarche",
    "name": "St. Marche Supermercados",
    "slug": "stmarche",
    "ats": "GUPY",
    "careerUrl": "https://stmarche.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-starian",
    "name": "Starian",
    "slug": "starian",
    "ats": "GUPY",
    "careerUrl": "https://starian.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-stefanini",
    "name": "Stefanini Group",
    "slug": "stefanini",
    "ats": "GUPY",
    "careerUrl": "https://stefanini.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 57,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-stefaninilatam",
    "name": "STEFANINI LATAM",
    "slug": "stefaninilatam",
    "ats": "GUPY",
    "careerUrl": "https://stefaninilatam.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 76,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-stone",
    "name": "Stone",
    "slug": "stone",
    "ats": "INHIRE",
    "careerUrl": "https://stone.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-strada",
    "name": "Strada",
    "slug": "strada",
    "ats": "GUPY",
    "careerUrl": "https://strada.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-suaquadra",
    "name": "SuaQuadra",
    "slug": "suaquadra",
    "ats": "INHIRE",
    "careerUrl": "https://suaquadra.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-suflex",
    "name": "Suflex",
    "slug": "suflex",
    "ats": "INHIRE",
    "careerUrl": "https://suflex.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-suhaiseguradora",
    "name": "Suhai",
    "slug": "suhaiseguradora",
    "ats": "GUPY",
    "careerUrl": "https://suhaiseguradora.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-sulamerica",
    "name": "SulAmérica",
    "slug": "sulamerica",
    "ats": "INHIRE",
    "careerUrl": "https://sulamerica.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-gruposunojobs",
    "name": "Suno",
    "slug": "gruposunojobs",
    "ats": "GUPY",
    "careerUrl": "https://gruposunojobs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-superlogica",
    "name": "Superlógica",
    "slug": "superlogica",
    "ats": "INHIRE",
    "careerUrl": "https://superlogica.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recruitee-supersummary",
    "name": "SuperSummary",
    "slug": "supersummary",
    "ats": "RECRUITEE",
    "careerUrl": "https://supersummary.recruitee.com",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vagassurftelecom",
    "name": "SURF TELECOM",
    "slug": "vagassurftelecom",
    "ats": "GUPY",
    "careerUrl": "https://vagassurftelecom.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-sweetsecrets",
    "name": "Sweet Secrets",
    "slug": "sweetsecrets",
    "ats": "SOLIDES",
    "careerUrl": "https://sweetsecrets.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-swile",
    "name": "Swile",
    "slug": "swile",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/swile",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-sympla",
    "name": "Sympla",
    "slug": "sympla",
    "ats": "INHIRE",
    "careerUrl": "https://sympla.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-syngentagroup",
    "name": "Syngenta Group",
    "slug": "syngentagroup",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/SyngentaGroup",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-synthesia",
    "name": "Synthesia",
    "slug": "synthesia",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/synthesia",
    "status": "MONITORED",
    "activeJobsCount": 17,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-synvia",
    "name": "Synvia",
    "slug": "synvia",
    "ats": "GUPY",
    "careerUrl": "https://synvia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-t-systems",
    "name": "T-Systems do Brasil",
    "slug": "t-systems",
    "ats": "GUPY",
    "careerUrl": "https://t-systems.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-t10",
    "name": "T10",
    "slug": "t10",
    "ats": "GUPY",
    "careerUrl": "https://t10.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tahto",
    "name": "Tahto",
    "slug": "tahto",
    "ats": "GUPY",
    "careerUrl": "https://tahto.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-takeat",
    "name": "Takeat",
    "slug": "takeat",
    "ats": "INHIRE",
    "careerUrl": "https://takeat.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-tako",
    "name": "Tako",
    "slug": "tako",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/tako",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-talent-trader-group",
    "name": "Talent Trader Group",
    "slug": "talent-trader-group",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/talent-trader-group",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-talentflix",
    "name": "Talentflix",
    "slug": "talentflix",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/talentflix",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-talentumrh",
    "name": "Talentum RH Desenvolvimento Humano",
    "slug": "talentumrh",
    "ats": "PANDAPE",
    "careerUrl": "https://talentumrh.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tania-bulhoes",
    "name": "Tania Bulhões",
    "slug": "tania-bulhoes",
    "ats": "GUPY",
    "careerUrl": "https://tania-bulhoes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-targetsistemas",
    "name": "Target Sistemas",
    "slug": "targetsistemas",
    "ats": "GUPY",
    "careerUrl": "https://targetsistemas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-tech6group",
    "name": "Tech6",
    "slug": "tech6group",
    "ats": "INHIRE",
    "careerUrl": "https://tech6group.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-techne",
    "name": "Techne",
    "slug": "techne",
    "ats": "GUPY",
    "careerUrl": "https://techne.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-teckeysolutions",
    "name": "Teckey Solutions",
    "slug": "teckeysolutions",
    "ats": "GUPY",
    "careerUrl": "https://teckeysolutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tecnofit",
    "name": "Tecnofit",
    "slug": "tecnofit",
    "ats": "GUPY",
    "careerUrl": "https://tecnofit.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tecnologiamartins",
    "name": "Tecnologia Martins",
    "slug": "tecnologiamartins",
    "ats": "GUPY",
    "careerUrl": "https://tecnologiamartins.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-teddydigital",
    "name": "Teddy Open Finance",
    "slug": "teddydigital",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/teddydigital",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-teknisa",
    "name": "Teknisa",
    "slug": "teknisa",
    "ats": "GUPY",
    "careerUrl": "https://teknisa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-tel",
    "name": "Tel Contact Center",
    "slug": "tel",
    "ats": "PANDAPE",
    "careerUrl": "https://tel.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-telehelp",
    "name": "Telehelp",
    "slug": "telehelp",
    "ats": "PANDAPE",
    "careerUrl": "https://telehelp.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-icatel",
    "name": "Telemática Sistemas Inteligentes",
    "slug": "icatel",
    "ats": "PANDAPE",
    "careerUrl": "https://icatel.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-teletex",
    "name": "Teletex",
    "slug": "teletex",
    "ats": "GUPY",
    "careerUrl": "https://teletex.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-telus-digital",
    "name": "TELUS Digital",
    "slug": "telus-digital",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/telus-digital",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-temsaude",
    "name": "TEM Saúde",
    "slug": "temsaude",
    "ats": "GUPY",
    "careerUrl": "https://temsaude.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tempo",
    "name": "Tempo",
    "slug": "tempo",
    "ats": "GUPY",
    "careerUrl": "https://tempo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 5,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-tempo",
    "name": "Tempo",
    "slug": "tempo",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/Tempo",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-tera",
    "name": "Tera",
    "slug": "tera",
    "ats": "INHIRE",
    "careerUrl": "https://tera.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tesa",
    "name": "tesa",
    "slug": "tesa",
    "ats": "GUPY",
    "careerUrl": "https://tesa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-thebridgesocial",
    "name": "The Bridge",
    "slug": "thebridgesocial",
    "ats": "GUPY",
    "careerUrl": "https://thebridgesocial.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-thecloudbootcamp",
    "name": "The Cloud Bootcamp",
    "slug": "thecloudbootcamp",
    "ats": "GUPY",
    "careerUrl": "https://thecloudbootcamp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-thomsonreuters",
    "name": "Thomson Reuters Brasil",
    "slug": "thomsonreuters",
    "ats": "WORKDAY",
    "careerUrl": "https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-thoughtworks",
    "name": "ThoughtWorks",
    "slug": "thoughtworks",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/thoughtworks",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vemprotime",
    "name": "TIM",
    "slug": "vemprotime",
    "ats": "GUPY",
    "careerUrl": "https://vemprotime.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tiny",
    "name": "Tiny",
    "slug": "tiny",
    "ats": "GUPY",
    "careerUrl": "https://tiny.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-tivit-poc",
    "name": "TIVIT",
    "slug": "tivit-poc",
    "ats": "INHIRE",
    "careerUrl": "https://tivit-poc.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-tivita",
    "name": "tivita",
    "slug": "tivita",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/tivita",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-contact-tokio",
    "name": "Tokio Marine Seguradora",
    "slug": "contact-tokio",
    "ats": "GUPY",
    "careerUrl": "https://contact-tokio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-toku",
    "name": "Toku",
    "slug": "toku",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/Toku",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-tooseguros",
    "name": "Too Seguros",
    "slug": "tooseguros",
    "ats": "INHIRE",
    "careerUrl": "https://tooseguros.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-topazbrasil",
    "name": "Topaz",
    "slug": "topazbrasil",
    "ats": "GUPY",
    "careerUrl": "https://topazbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-topmed",
    "name": "TopMed Saúde Digital",
    "slug": "topmed",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/topmed",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-totalexpress",
    "name": "Total Express",
    "slug": "totalexpress",
    "ats": "GUPY",
    "careerUrl": "https://totalexpress.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-vempratotalpass",
    "name": "TotalPass",
    "slug": "vempratotalpass",
    "ats": "PANDAPE",
    "careerUrl": "https://vempratotalpass.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-townsq",
    "name": "TownSq",
    "slug": "townsq",
    "ats": "INHIRE",
    "careerUrl": "https://townsq.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 2,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tpc",
    "name": "TPC Logística Inteligente",
    "slug": "tpc",
    "ats": "GUPY",
    "careerUrl": "https://tpc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-trackindecx",
    "name": "Track.co",
    "slug": "trackindecx",
    "ats": "SOLIDES",
    "careerUrl": "https://trackindecx.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-tfcarreira",
    "name": "TRACK&FIELD",
    "slug": "tfcarreira",
    "ats": "GUPY",
    "careerUrl": "https://tfcarreira.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-trackfy",
    "name": "Trackfy",
    "slug": "trackfy",
    "ats": "INHIRE",
    "careerUrl": "https://trackfy.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abler-venhaparaatrack",
    "name": "Trackmob",
    "slug": "venhaparaatrack",
    "ats": "ABLER",
    "careerUrl": "https://ats.abler.com.br/jobs/venhaparaatrack",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-tractian",
    "name": "Tractian",
    "slug": "tractian",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/tractian",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-trampay",
    "name": "Trampay",
    "slug": "trampay",
    "ats": "INHIRE",
    "careerUrl": "https://trampay.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-transfeera",
    "name": "Transfeera",
    "slug": "transfeera",
    "ats": "GUPY",
    "careerUrl": "https://transfeera.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-transunion",
    "name": "TransUnion",
    "slug": "transunion",
    "ats": "WORKDAY",
    "careerUrl": "https://transunion.wd5.myworkdayjobs.com/pt-BR/TransUnion",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-trendmicro",
    "name": "TrendAI",
    "slug": "trendmicro",
    "ats": "WORKDAY",
    "careerUrl": "https://trendmicro.wd3.myworkdayjobs.com/en-US/External",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-trentini",
    "name": "Trentini",
    "slug": "trentini",
    "ats": "SOLIDES",
    "careerUrl": "https://trentini.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-centraldevagas",
    "name": "Trinus",
    "slug": "centraldevagas",
    "ats": "INHIRE",
    "careerUrl": "https://centraldevagas.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-tripla",
    "name": "Tripla",
    "slug": "tripla",
    "ats": "INHIRE",
    "careerUrl": "https://tripla.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-recrutai-gruposfa",
    "name": "Trivento Educação",
    "slug": "gruposfa",
    "ats": "RECRUTAI",
    "careerUrl": "https://gruposfa.jobs.recrut.ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-true",
    "name": "True",
    "slug": "true",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/true",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-truechange",
    "name": "TrueChange",
    "slug": "truechange",
    "ats": "GUPY",
    "careerUrl": "https://truechange.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-trustly",
    "name": "Trustly",
    "slug": "trustly",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/trustly",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-turbi",
    "name": "Turbi",
    "slug": "turbi",
    "ats": "INHIRE",
    "careerUrl": "https://turbi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-turbo",
    "name": "Turbo Partners",
    "slug": "turbo",
    "ats": "INHIRE",
    "careerUrl": "https://turbo.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-twgai",
    "name": "TWG Global AI",
    "slug": "twgai",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/twgai",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-ubots",
    "name": "Ubots",
    "slug": "ubots",
    "ats": "INHIRE",
    "careerUrl": "https://ubots.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-uncover",
    "name": "Uncover",
    "slug": "uncover",
    "ats": "SOLIDES",
    "careerUrl": "https://vagas.solides.com.br#uncover",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vitru",
    "name": "Unicesumar - Maringá",
    "slug": "vitru",
    "ats": "INHIRE",
    "careerUrl": "https://vitru.inhire.app/vagas",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-unicoskill",
    "name": "Unico Skill",
    "slug": "unicoskill",
    "ats": "INHIRE",
    "careerUrl": "https://unicoskill.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unicredbr",
    "name": "UNICRED",
    "slug": "unicredbr",
    "ats": "GUPY",
    "careerUrl": "https://unicredbr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unidas",
    "name": "Unidas",
    "slug": "unidas",
    "ats": "GUPY",
    "careerUrl": "https://unidas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-unifisa",
    "name": "Unifisa",
    "slug": "unifisa",
    "ats": "PANDAPE",
    "careerUrl": "https://unifisa.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unimedfortaleza",
    "name": "Unimed Fortaleza",
    "slug": "unimedfortaleza",
    "ats": "GUPY",
    "careerUrl": "https://unimedfortaleza.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unimedmaceio",
    "name": "Unimed Maceió",
    "slug": "unimedmaceio",
    "ats": "GUPY",
    "careerUrl": "https://unimedmaceio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unimednacional",
    "name": "Unimed Nacional",
    "slug": "unimednacional",
    "ats": "GUPY",
    "careerUrl": "https://unimednacional.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-unimedpoa",
    "name": "Unimed Porto Alegre",
    "slug": "unimedpoa",
    "ats": "GUPY",
    "careerUrl": "https://unimedpoa.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-somosunit",
    "name": "Unit",
    "slug": "somosunit",
    "ats": "SOLIDES",
    "careerUrl": "https://somosunit.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-uoledtech",
    "name": "UOL EdTech",
    "slug": "uoledtech",
    "ats": "GUPY",
    "careerUrl": "https://uoledtech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-upbrasilservicos",
    "name": "Up Brasil",
    "slug": "upbrasilservicos",
    "ats": "PANDAPE",
    "careerUrl": "https://upbrasilservicos.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-upflux",
    "name": "UpFlux",
    "slug": "upflux",
    "ats": "INHIRE",
    "careerUrl": "https://upflux.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-talentosurbia",
    "name": "Urbia Parques",
    "slug": "talentosurbia",
    "ats": "GUPY",
    "careerUrl": "https://talentosurbia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vdev",
    "name": "v(dev)",
    "slug": "vdev",
    "ats": "GUPY",
    "careerUrl": "https://vdev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-v360",
    "name": "V360",
    "slug": "v360",
    "ats": "INHIRE",
    "careerUrl": "https://v360.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-v4company",
    "name": "V4 Company",
    "slug": "v4company",
    "ats": "INHIRE",
    "careerUrl": "https://v4company.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 8,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-valecard",
    "name": "ValeCard",
    "slug": "valecard",
    "ats": "INHIRE",
    "careerUrl": "https://valecard.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-validcarreiras-comercial",
    "name": "Valid",
    "slug": "validcarreiras-comercial",
    "ats": "GUPY",
    "careerUrl": "https://validcarreiras-comercial.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-valid",
    "name": "Valid",
    "slug": "valid",
    "ats": "GUPY",
    "careerUrl": "https://valid.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ashby-vanilla",
    "name": "Vanilla",
    "slug": "vanilla",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/vanilla",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-vascodagamasaf",
    "name": "VASCO DA GAMA SAF",
    "slug": "vascodagamasaf",
    "ats": "SOLIDES",
    "careerUrl": "https://vascodagamasaf.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vatto",
    "name": "Vatto Aceleradora Comercial",
    "slug": "vatto",
    "ats": "INHIRE",
    "careerUrl": "https://vatto.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vcxsolutions",
    "name": "VC-X Solutions",
    "slug": "vcxsolutions",
    "ats": "GUPY",
    "careerUrl": "https://vcxsolutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-veloxcontactcenter",
    "name": "Velox Contact Center",
    "slug": "veloxcontactcenter",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/veloxcontactcenter",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-venturus",
    "name": "Venturus",
    "slug": "venturus",
    "ats": "INHIRE",
    "careerUrl": "https://venturus.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 21,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-veri",
    "name": "Veri Soluções Tecnológicas",
    "slug": "veri",
    "ats": "GUPY",
    "careerUrl": "https://veri.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vericode",
    "name": "Vericode",
    "slug": "vericode",
    "ats": "GUPY",
    "careerUrl": "https://vericode.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vero",
    "name": "VERO",
    "slug": "vero",
    "ats": "GUPY",
    "careerUrl": "https://vero.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-queroservertem",
    "name": "Vertem",
    "slug": "queroservertem",
    "ats": "GUPY",
    "careerUrl": "https://queroservertem.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-verytecnologia",
    "name": "Very Tecnologia",
    "slug": "verytecnologia",
    "ats": "SOLIDES",
    "careerUrl": "https://verytecnologia.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vetta",
    "name": "Vetta",
    "slug": "vetta",
    "ats": "GUPY",
    "careerUrl": "https://vetta.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vexpenses",
    "name": "VExpenses",
    "slug": "vexpenses",
    "ats": "GUPY",
    "careerUrl": "https://vexpenses.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vhita",
    "name": "Vhita",
    "slug": "vhita",
    "ats": "INHIRE",
    "careerUrl": "https://vhita.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vhsys",
    "name": "vhsys",
    "slug": "vhsys",
    "ats": "INHIRE",
    "careerUrl": "https://vhsys.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-viaflow",
    "name": "Viaflow",
    "slug": "viaflow",
    "ats": "GUPY",
    "careerUrl": "https://viaflow.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-visa",
    "name": "Visa",
    "slug": "visa",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://careers.smartrecruiters.com/visa",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vissimo",
    "name": "Víssimo Group",
    "slug": "vissimo",
    "ats": "GUPY",
    "careerUrl": "https://vissimo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vitascience",
    "name": "Vitascience",
    "slug": "vitascience",
    "ats": "GUPY",
    "careerUrl": "https://vitascience.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vivara",
    "name": "Vivara",
    "slug": "vivara",
    "ats": "GUPY",
    "careerUrl": "https://vivara.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-viveo",
    "name": "Viveo",
    "slug": "viveo",
    "ats": "GUPY",
    "careerUrl": "https://viveo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vivo",
    "name": "Vivo (Telefônica Brasil)",
    "slug": "vivo",
    "ats": "GUPY",
    "careerUrl": "https://vivo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vivovita",
    "name": "Vivo Vita",
    "slug": "vivovita",
    "ats": "GUPY",
    "careerUrl": "https://vivovita.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mindsight-vixting",
    "name": "Vixting",
    "slug": "vixting",
    "ats": "MINDSIGHT",
    "careerUrl": "https://oportunidades.mindsight.com.br/vixting",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vwbrasil",
    "name": "Volkswagen do Brasil",
    "slug": "vwbrasil",
    "ats": "GUPY",
    "careerUrl": "https://vwbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-voll",
    "name": "VOLL",
    "slug": "voll",
    "ats": "GUPY",
    "careerUrl": "https://voll.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-voltz",
    "name": "Voltz",
    "slug": "voltz",
    "ats": "GUPY",
    "careerUrl": "https://voltz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 1,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vortx",
    "name": "Vórtx",
    "slug": "vortx",
    "ats": "INHIRE",
    "careerUrl": "https://vortx.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vr",
    "name": "VR",
    "slug": "vr",
    "ats": "GUPY",
    "careerUrl": "https://vr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-vrental",
    "name": "VRental",
    "slug": "vrental",
    "ats": "INHIRE",
    "careerUrl": "https://vrental.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-vtex",
    "name": "VTEX",
    "slug": "vtex",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/vtex",
    "status": "MONITORED",
    "activeJobsCount": 3,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vulcabras",
    "name": "Vulcabras",
    "slug": "vulcabras",
    "ats": "GUPY",
    "careerUrl": "https://vulcabras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-vyttra",
    "name": "Vyttra",
    "slug": "vyttra",
    "ats": "GUPY",
    "careerUrl": "https://vyttra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-w3hauscarreiras",
    "name": "W3haus",
    "slug": "w3hauscarreiras",
    "ats": "GUPY",
    "careerUrl": "https://w3hauscarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-wallstreetquants",
    "name": "WallStreetQuants",
    "slug": "wallstreetquants",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/wallstreetquants",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-wati-dot-i-o",
    "name": "Wati",
    "slug": "wati-dot-i-o",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/wati-dot-i-o",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-way2",
    "name": "Way2",
    "slug": "way2",
    "ats": "INHIRE",
    "careerUrl": "https://way2.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-waycarbon",
    "name": "WayCarbon",
    "slug": "waycarbon",
    "ats": "GUPY",
    "careerUrl": "https://waycarbon.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-wealthfront",
    "name": "Wealthfront",
    "slug": "wealthfront",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/wealthfront",
    "status": "MONITORED",
    "activeJobsCount": 6,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-webservice",
    "name": "Web Automação Industrial",
    "slug": "webservice",
    "ats": "PANDAPE",
    "careerUrl": "https://webservice.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solides-webcontinental",
    "name": "WEBCONTINENTAL",
    "slug": "webcontinental",
    "ats": "SOLIDES",
    "careerUrl": "https://webcontinental.vagas.solides.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-webershandwick",
    "name": "Weber Shandwick",
    "slug": "webershandwick",
    "ats": "GUPY",
    "careerUrl": "https://webershandwick.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workable-weekday-1",
    "name": "Weekday AI",
    "slug": "weekday-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/weekday-1",
    "status": "MONITORED",
    "activeJobsCount": 33,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-gympass",
    "name": "Wellhub",
    "slug": "gympass",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/gympass",
    "status": "MONITORED",
    "activeJobsCount": 4,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-welucci",
    "name": "Welucci",
    "slug": "welucci",
    "ats": "INHIRE",
    "careerUrl": "https://welucci.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quickin-weon",
    "name": "WeOn",
    "slug": "weon",
    "ats": "QUICKIN",
    "careerUrl": "https://jobs.quickin.io/weon",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-werecruiter",
    "name": "Werecruiter  (Empresa Recrutadora)",
    "slug": "werecruiter",
    "ats": "GUPY",
    "careerUrl": "https://werecruiter.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-wildlifestudios",
    "name": "Wildlife Studios",
    "slug": "wildlifestudios",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/wildlifestudios",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-winnin",
    "name": "Winnin",
    "slug": "winnin",
    "ats": "INHIRE",
    "careerUrl": "https://winnin.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-smartrecruiters-wise",
    "name": "Wise",
    "slug": "wise",
    "ats": "SMARTRECRUITERS",
    "careerUrl": "https://jobs.smartrecruiters.com/Wise",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-woba",
    "name": "Woba",
    "slug": "woba",
    "ats": "INHIRE",
    "careerUrl": "https://woba.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-xpinc",
    "name": "XP Inc.",
    "slug": "xpinc",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/xpinc",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-yampi",
    "name": "Yampi",
    "slug": "yampi",
    "ats": "INHIRE",
    "careerUrl": "https://yampi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-yampi",
    "name": "Yampi",
    "slug": "yampi",
    "ats": "GUPY",
    "careerUrl": "https://yampi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-yduqs",
    "name": "YDUQS",
    "slug": "yduqs",
    "ats": "GUPY",
    "careerUrl": "https://yduqs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pandape-yhbrasil",
    "name": "YH Brasil",
    "slug": "yhbrasil",
    "ats": "PANDAPE",
    "careerUrl": "https://yhbrasil.pandape.infojobs.com.br",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-yooga",
    "name": "Yooga",
    "slug": "yooga",
    "ats": "GUPY",
    "careerUrl": "https://yooga.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-zeev",
    "name": "Zeev",
    "slug": "zeev",
    "ats": "GUPY",
    "careerUrl": "https://zeev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-zendesk",
    "name": "Zendesk",
    "slug": "zendesk",
    "ats": "WORKDAY",
    "careerUrl": "https://zendesk.wd1.myworkdayjobs.com/en-US/zendesk",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-zenvia",
    "name": "Zenvia",
    "slug": "zenvia",
    "ats": "GUPY",
    "careerUrl": "https://zenvia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-zerezes",
    "name": "Zerezes",
    "slug": "zerezes",
    "ats": "INHIRE",
    "careerUrl": "https://zerezes.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gupy-zgteam",
    "name": "ZG Soluções",
    "slug": "zgteam",
    "ats": "GUPY",
    "careerUrl": "https://zgteam.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inhire-zig",
    "name": "Zig. The Global Funtech",
    "slug": "zig",
    "ats": "INHIRE",
    "careerUrl": "https://zig.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-zimperium",
    "name": "Zimperium",
    "slug": "zimperium",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/zimperium",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lever-zoox",
    "name": "Zoox",
    "slug": "zoox",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/zoox",
    "status": "MONITORED",
    "activeJobsCount": 134,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenhouse-zupinnovation",
    "name": "Zup Innovation",
    "slug": "zupinnovation",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/zupinnovation",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-workday-zurich",
    "name": "zurich",
    "slug": "zurich",
    "ats": "WORKDAY",
    "careerUrl": "https://zurich.wd3.myworkdayjobs.com/pt-BR/External",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  }
];

const readCatalog = (): CompanyRecord[] => {
  return initialCatalog;
};

// GET /companies - Lista consolidada de empresas monitoradas e sugeridas
app.get("/companies", async (req: Request, res: Response) => {
  try {
    const { search = "", ats = "ALL", status = "ALL" } = req.query;

    // 1. Busca empresas cadastradas diretamente na tabela public.companies no Supabase
    let dbCompanies: CompanyRecord[] = [];
    try {
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: compRows, error: compErr } = await supabase
          .from("companies")
          .select("id, name, slug, ats, career_url, status, active_jobs_count, has_tech_jobs")
          .order("name", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (compErr || !Array.isArray(compRows) || compRows.length === 0) {
          break;
        }

        const mapped: CompanyRecord[] = compRows.map((row: Record<string, unknown>) => ({
          id: (row.id as string) || `comp-${String(row.ats || "outro").toLowerCase()}-${row.slug}`,
          name: row.name as string,
          slug: row.slug as string,
          ats: row.ats as string,
          careerUrl: row.career_url as string,
          status: (row.status as "MONITORED" | "SUGGESTED") || "MONITORED",
          activeJobsCount: (row.active_jobs_count as number) || 0,
          hasTechJobs: (row.has_tech_jobs as boolean) ?? true,
        }));

        dbCompanies.push(...mapped);
        if (compRows.length < pageSize) {
          break;
        }
        offset += pageSize;
      }
    } catch (e) {
      console.warn("[API] Falha ao consultar tabela companies no Supabase:", e);
    }

    // Fallback gracioso para catálogo embutido se a tabela estiver inacessível
    const catalog = dbCompanies.length > 0 ? dbCompanies : readCatalog();

    // 2. Busca sugestões comunitárias cadastradas no Supabase
    let communityList: CompanyRecord[] = [];
    try {
      const { data: sugRows, error: sugErr } = await supabase
        .from("company_suggestions")
        .select("*")
        .order("votes_count", { ascending: false });

      if (!sugErr && Array.isArray(sugRows) && sugRows.length > 0) {
        communityList = sugRows.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          slug: s.slug as string,
          ats: s.ats as string,
          careerUrl: s.career_url as string,
          status: "SUGGESTED" as const,
          activeJobsCount: 0,
          suggestedBy: (s.suggested_by as string) || "Comunidade",
          votesCount: (s.votes_count as number) || 1,
          notes: s.notes as string | undefined,
          createdAt: s.created_at as string,
        }));
      }
    } catch {
      // Ignora erro e continua com fallback local
    }

    const suggestions = communityList.length > 0 ? communityList : readSuggestions();

    // 3. Busca contagem de vagas ativas no Supabase para atualizar a quantidade por empresa
    const companyJobCounts: Record<string, { count: number; source: string; sampleUrl: string }> = {};
    try {
      const { data: rpcCounts, error: rpcErr } = await supabase.rpc("get_company_active_counts");
      if (!rpcErr && Array.isArray(rpcCounts) && rpcCounts.length > 0) {
        for (const row of rpcCounts as Array<Record<string, unknown>>) {
          const compName = String(row.company || "").trim();
          if (!compName) continue;
          const key = compName.toLowerCase();
          companyJobCounts[key] = {
            count: Number(row.active_count || row.count || 0),
            source: String(row.source || "OUTRO"),
            sampleUrl: String(row.sample_url || row.sampleUrl || ""),
          };
        }
      } else {
        const { data } = await supabase
          .from("jobs")
          .select("company, source, url")
          .eq("is_tech", true)
          .limit(2000);
        if (data && Array.isArray(data)) {
          for (const row of data) {
            const compName = (row.company || "").trim();
            if (!compName) continue;
            const key = compName.toLowerCase();
            if (!companyJobCounts[key]) {
              companyJobCounts[key] = {
                count: 0,
                source: row.source || "OUTRO",
                sampleUrl: row.url || "",
              };
            }
            companyJobCounts[key].count++;
          }
        }
      }
    } catch {
      // Continua sem contagem atualizada do Supabase em caso de erro
    }

    const companyMap = new Map<string, CompanyRecord>();

    // 4. Adiciona catálogo base (do Supabase ou fallback)
    for (const c of catalog) {
      const normKey = c.name.toLowerCase();
      const jobInfo = companyJobCounts[normKey];
      companyMap.set(c.slug, {
        ...c,
        activeJobsCount: jobInfo ? jobInfo.count : (c.activeJobsCount || 0),
        status: "MONITORED",
      });
    }

    // 5. Adiciona empresas encontradas no Supabase que porventura não estavam no catálogo estático
    for (const [normKey, info] of Object.entries(companyJobCounts)) {
      const matching = Array.from(companyMap.values()).find(
        (c) => c.name.toLowerCase() === normKey,
      );
      if (!matching) {
        const slug = normKey.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        // Extrai URL limpa a partir do sampleUrl
        let careerUrl = info.sampleUrl;
        try {
          const parsed = new URL(info.sampleUrl);
          careerUrl = `${parsed.protocol}//${parsed.hostname}`;
        } catch {
          // Mantém URL original
        }

        const properName = normKey
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        companyMap.set(slug, {
          id: `supabase-${slug}`,
          name: properName,
          slug,
          ats: info.source,
          careerUrl,
          status: "MONITORED",
          activeJobsCount: info.count,
        });
      }
    }

    // 6. Adiciona sugestões da comunidade
    for (const sug of suggestions) {
      companyMap.set(sug.id, sug);
    }

    let result = Array.from(companyMap.values());

    // 5. Aplica filtros
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q) ||
          c.ats.toLowerCase().includes(q) ||
          (c.careerUrl && c.careerUrl.toLowerCase().includes(q)),
      );
    }

    if (ats && ats !== "ALL") {
      result = result.filter((c) => c.ats.toUpperCase() === String(ats).toUpperCase());
    }

    if (status && status !== "ALL") {
      result = result.filter((c) => c.status === status);
    }

    // Ordenação: primeiro empresas com vagas ativas, depois por número de vagas ou votos
    result.sort((a, b) => {
      const countA = a.activeJobsCount || 0;
      const countB = b.activeJobsCount || 0;
      if (countA !== countB) return countB - countA;
      const votesA = a.votesCount || 0;
      const votesB = b.votesCount || 0;
      if (votesA !== votesB) return votesB - votesA;
      return a.name.localeCompare(b.name);
    });

    // Sanitiza activeJobsCount caso não possua token de desenvolvedor verificado (Stealth)
    const trustHeader = (req.headers["x-trust-token"] || req.query.trust_token) as string | undefined;
    const isTestBypass = process.env.NODE_ENV === "test" && !req.headers["x-enforce-trust"];
    const isAuthorized = verifyTrustToken(trustHeader).valid || isTestBypass;
    if (!isAuthorized) {
      result = result.map((c) => ({
        ...c,
        activeJobsCount: 0,
      }));
    }

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar radar de empresas";
    res.status(500).json({ error: msg });
  }
});

const mapDbSuggestionRow = (s: Record<string, unknown>): CompanyRecord => ({
  id: s.id as string,
  name: s.name as string,
  slug: s.slug as string,
  ats: (s.ats as string) || "OUTRO",
  careerUrl: s.career_url as string,
  status: ((s.status as CompanyRecord["status"]) || "SUGGESTED"),
  activeJobsCount: 0,
  suggestedBy: (s.suggested_by as string) || "Membro da Comunidade",
  votesCount: Number(s.votes_count) || 1,
  notes: (s.notes as string) || undefined,
  createdAt: (s.created_at as string) || new Date().toISOString(),
});

// POST /company-suggestions - Cria nova sugestão comunitária diretamente no Supabase
app.post("/company-suggestions", async (req: Request, res: Response) => {
  try {
    const { name, careerUrl, ats = "OUTRO", notes, suggestedBy } = req.body || {};
    const trimmedName = String(name || "").trim();
    const trimmedUrl = String(careerUrl || "").trim();

    if (!trimmedName) {
      res.status(400).json({ error: "O nome da empresa é obrigatório." });
      return;
    }
    if (!trimmedUrl) {
      res.status(400).json({ error: "O link de carreiras da empresa é obrigatório." });
      return;
    }

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    // 1. Verifica se já existe no Supabase (public.company_suggestions)
    try {
      const { data: existingRows, error: findErr } = await supabase
        .from("company_suggestions")
        .select("*")
        .or(`slug.eq.${slug},career_url.ilike.${trimmedUrl}`)
        .limit(1);

      if (!findErr && Array.isArray(existingRows) && existingRows.length > 0) {
        const existingRow = existingRows[0] as Record<string, unknown>;
        const nextVotes = (Number(existingRow.votes_count) || 1) + 1;
        const { data: updatedRow, error: updateErr } = await supabase
          .from("company_suggestions")
          .update({ votes_count: nextVotes })
          .eq("id", existingRow.id as string)
          .select("*")
          .single();

        const mapped = mapDbSuggestionRow(
          (!updateErr && updatedRow ? (updatedRow as Record<string, unknown>) : {
            ...existingRow,
            votes_count: nextVotes,
          }),
        );

        const fallbackList = readSuggestions();
        const idx = fallbackList.findIndex((s) => s.id === mapped.id || s.slug === mapped.slug);
        if (idx >= 0) fallbackList[idx] = mapped;
        else fallbackList.unshift(mapped);
        writeSuggestions(fallbackList);

        res.status(200).json(mapped);
        return;
      }
    } catch {
      // Continua para verificação em fallback caso offline
    }

    // 2. Fallback para cache local caso a tabela ainda não esteja disponível no Supabase
    const suggestions = readSuggestions();
    const existingLocal = suggestions.find(
      (s) => s.slug === slug || (s.careerUrl && s.careerUrl.toLowerCase() === trimmedUrl.toLowerCase()),
    );

    if (existingLocal) {
      existingLocal.votesCount = (existingLocal.votesCount || 1) + 1;
      writeSuggestions(suggestions);
      res.status(200).json(existingLocal);
      return;
    }

    const newSuggestion: CompanyRecord = {
      id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      slug,
      ats: String(ats).toUpperCase(),
      careerUrl: trimmedUrl,
      status: "SUGGESTED",
      activeJobsCount: 0,
      suggestedBy: suggestedBy ? String(suggestedBy).trim() : "Membro da Comunidade",
      votesCount: 1,
      notes: notes ? String(notes).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    // 3. Persiste diretamente na tabela public.company_suggestions do Supabase
    try {
      const { data: insertedRow, error: insertErr } = await supabase
        .from("company_suggestions")
        .insert({
          id: newSuggestion.id,
          name: newSuggestion.name,
          slug: newSuggestion.slug,
          ats: newSuggestion.ats,
          career_url: newSuggestion.careerUrl,
          status: newSuggestion.status,
          votes_count: newSuggestion.votesCount || 1,
          suggested_by: newSuggestion.suggestedBy,
          notes: newSuggestion.notes || null,
          created_at: newSuggestion.createdAt,
        })
        .select("*")
        .single();

      if (!insertErr && insertedRow) {
        const persisted = mapDbSuggestionRow(insertedRow as Record<string, unknown>);
        suggestions.unshift(persisted);
        writeSuggestions(suggestions);
        res.status(201).json(persisted);
        return;
      }
    } catch {
      // Ignora erro em caso de offline e mantém fallback resiliente
    }

    suggestions.unshift(newSuggestion);
    writeSuggestions(suggestions);
    res.status(201).json(newSuggestion);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao registrar sugestão";
    res.status(500).json({ error: msg });
  }
});

// GET /company-suggestions - Lista sugestões comunitárias diretamente do Supabase com fallback
app.get("/company-suggestions", async (_req: Request, res: Response) => {
  try {
    let dbSuggestions: CompanyRecord[] = [];
    try {
      const { data: sugRows, error: sugErr } = await supabase
        .from("company_suggestions")
        .select("*")
        .order("votes_count", { ascending: false });

      if (!sugErr && Array.isArray(sugRows)) {
        dbSuggestions = sugRows.map((row) => mapDbSuggestionRow(row as Record<string, unknown>));
      }
    } catch {
      // Fallback para cache local caso offline
    }

    const mergedMap = new Map<string, CompanyRecord>();
    for (const item of dbSuggestions) {
      mergedMap.set(item.id, item);
    }
    for (const localItem of readSuggestions()) {
      if (!mergedMap.has(localItem.id)) {
        mergedMap.set(localItem.id, localItem);
      }
    }

    const suggestions = Array.from(mergedMap.values());
    suggestions.sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));
    res.json(suggestions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar sugestões";
    res.status(500).json({ error: msg });
  }
});

// POST /company-suggestions/:id/upvote - Apoiar sugestão com voto comunitário persistido no Supabase
app.post("/company-suggestions/:id/upvote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Tenta localizar e atualizar diretamente no Supabase
    try {
      const { data: existingRow, error: findErr } = await supabase
        .from("company_suggestions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!findErr && existingRow) {
        const rowObj = existingRow as Record<string, unknown>;
        const nextVotes = (Number(rowObj.votes_count) || 1) + 1;
        await supabase
          .from("company_suggestions")
          .update({ votes_count: nextVotes })
          .eq("id", id);

        const suggestions = readSuggestions();
        const localTarget = suggestions.find((s) => s.id === id);
        if (localTarget) {
          localTarget.votesCount = nextVotes;
          writeSuggestions(suggestions);
        }

        res.json({ id, votesCount: nextVotes });
        return;
      }
    } catch {
      // Continua para fallback se Supabase estiver inacessível
    }

    // 2. Fallback para cache em memória
    const suggestions = readSuggestions();
    const target = suggestions.find((s) => s.id === id);

    if (!target) {
      res.status(404).json({ error: "Sugestão não encontrada" });
      return;
    }

    target.votesCount = (target.votesCount || 1) + 1;
    writeSuggestions(suggestions);

    res.json({ id: target.id, votesCount: target.votesCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao apoiar sugestão";
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

  // Stealth: se for consulta direta a vagas via proxy upstream sem autorização, sanitiza a resposta
  const proxyTrustHeader = (req.headers["x-trust-token"] || req.query.trust_token) as string | undefined;
  const isProxyTestBypass = process.env.NODE_ENV === "test" && !req.headers["x-enforce-trust"];
  const isProxyAuthorized = verifyTrustToken(proxyTrustHeader).valid || isProxyTestBypass;

  if (upstreamPath.includes("/jobs") && !isProxyAuthorized) {
    if (req.method === "GET") {
      res.json([]);
      return;
    }
    res.status(404).json({ error: "Recurso não encontrado" });
    return;
  }

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
      body: bodyData ? new Uint8Array(bodyData) : undefined,
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
