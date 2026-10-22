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
    "id": "comp-techne",
    "name": "Techne",
    "slug": "techne",
    "ats": "GUPY",
    "careerUrl": "https://techne.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cielo",
    "name": "Cielo",
    "slug": "cielo",
    "ats": "GUPY",
    "careerUrl": "https://cielo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-grupoboticario",
    "name": "Grupo Boticário",
    "slug": "grupoboticario",
    "ats": "GUPY",
    "careerUrl": "https://grupoboticario.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sicredi",
    "name": "Sicredi",
    "slug": "sicredi",
    "ats": "GUPY",
    "careerUrl": "https://sicredi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pagseguro",
    "name": "PagBank",
    "slug": "pagseguro",
    "ats": "GUPY",
    "careerUrl": "https://pagseguro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vivara",
    "name": "Vivara",
    "slug": "vivara",
    "ats": "GUPY",
    "careerUrl": "https://vivara.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gruposc",
    "name": "GrupoSC",
    "slug": "gruposc",
    "ats": "GUPY",
    "careerUrl": "https://gruposc.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sidi",
    "name": "SiDi",
    "slug": "sidi",
    "ats": "GUPY",
    "careerUrl": "https://sidi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-positivotecnologia",
    "name": "Positivo Tecnologia",
    "slug": "positivotecnologia",
    "ats": "GUPY",
    "careerUrl": "https://positivotecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tecnologiamartins",
    "name": "Tecnologia Martins",
    "slug": "tecnologiamartins",
    "ats": "GUPY",
    "careerUrl": "https://tecnologiamartins.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-programasambev",
    "name": "Ambev",
    "slug": "programasambev",
    "ats": "GUPY",
    "careerUrl": "https://programasambev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-icarotech",
    "name": "Icaro Tech",
    "slug": "icarotech",
    "ats": "GUPY",
    "careerUrl": "https://icarotech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-programasembraer",
    "name": "Programas Embraer",
    "slug": "programasembraer",
    "ats": "GUPY",
    "careerUrl": "https://programasembraer.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-hilab",
    "name": "Hilab",
    "slug": "hilab",
    "ats": "GUPY",
    "careerUrl": "https://hilab.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-openlabs",
    "name": "Open Labs",
    "slug": "openlabs",
    "ats": "GUPY",
    "careerUrl": "https://openlabs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vemproitau",
    "name": "Itaú Unibanco",
    "slug": "vemproitau",
    "ats": "GUPY",
    "careerUrl": "https://vemproitau.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-maisaedu-tech",
    "name": "+A Educação Tech",
    "slug": "maisaedu-tech",
    "ats": "GUPY",
    "careerUrl": "https://maisaedu-tech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-thebridgesocial",
    "name": "The Bridge",
    "slug": "thebridgesocial",
    "ats": "GUPY",
    "careerUrl": "https://thebridgesocial.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alliage",
    "name": "Alliage",
    "slug": "alliage",
    "ats": "GUPY",
    "careerUrl": "https://alliage.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-compass",
    "name": "Compass.UOL",
    "slug": "compass",
    "ats": "GUPY",
    "careerUrl": "https://compass.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-govbr",
    "name": "#vemserGOVBR",
    "slug": "govbr",
    "ats": "GUPY",
    "careerUrl": "https://govbr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-girotech",
    "name": "Giro.Tech",
    "slug": "girotech",
    "ats": "GUPY",
    "careerUrl": "https://girotech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tiny",
    "name": "Tiny",
    "slug": "tiny",
    "ats": "GUPY",
    "careerUrl": "https://tiny.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-corporativopanvel",
    "name": "Corporativo Grupo Panvel",
    "slug": "corporativopanvel",
    "ats": "GUPY",
    "careerUrl": "https://corporativopanvel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-nscreen",
    "name": "Carreiras nScreen",
    "slug": "nscreen",
    "ats": "GUPY",
    "careerUrl": "https://nscreen.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pontotel",
    "name": "Pontotel",
    "slug": "pontotel",
    "ats": "GUPY",
    "careerUrl": "https://pontotel.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-minsait",
    "name": "Minsait an Indra Company",
    "slug": "minsait",
    "ats": "GUPY",
    "careerUrl": "https://minsait.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-spcbrasil",
    "name": "SPC Brasil",
    "slug": "spcbrasil",
    "ats": "GUPY",
    "careerUrl": "https://spcbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-evoluservices",
    "name": "Evoluservices",
    "slug": "evoluservices",
    "ats": "GUPY",
    "careerUrl": "https://evoluservices.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-autbank",
    "name": "Autbank",
    "slug": "autbank",
    "ats": "GUPY",
    "careerUrl": "https://autbank.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-t-systems",
    "name": "T-Systems do Brasil",
    "slug": "t-systems",
    "ats": "GUPY",
    "careerUrl": "https://t-systems.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vempraelo",
    "name": "Elo",
    "slug": "vempraelo",
    "ats": "GUPY",
    "careerUrl": "https://vempraelo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-escoladomecanico",
    "name": "Escola do Mecânico",
    "slug": "escoladomecanico",
    "ats": "GUPY",
    "careerUrl": "https://escoladomecanico.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-stefanini",
    "name": "Stefanini Group",
    "slug": "stefanini",
    "ats": "GUPY",
    "careerUrl": "https://stefanini.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aurum",
    "name": "Aurum",
    "slug": "aurum",
    "ats": "GUPY",
    "careerUrl": "https://aurum.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-institutoeldorado",
    "name": "Instituto Eldorado",
    "slug": "institutoeldorado",
    "ats": "GUPY",
    "careerUrl": "https://institutoeldorado.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mercadaodosoculos",
    "name": "Mercadão dos Óculos",
    "slug": "mercadaodosoculos",
    "ats": "GUPY",
    "careerUrl": "https://mercadaodosoculos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eisatecnologia",
    "name": "EISA",
    "slug": "eisatecnologia",
    "ats": "GUPY",
    "careerUrl": "https://eisatecnologia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-nelogica",
    "name": "Nelogica",
    "slug": "nelogica",
    "ats": "GUPY",
    "careerUrl": "https://nelogica.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-bethasistemas",
    "name": "Betha Sistemas",
    "slug": "bethasistemas",
    "ats": "GUPY",
    "careerUrl": "https://bethasistemas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-class-solutions",
    "name": "Class Solutions",
    "slug": "class-solutions",
    "ats": "GUPY",
    "careerUrl": "https://class-solutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-domo",
    "name": "Domo Inovação",
    "slug": "domo",
    "ats": "GUPY",
    "careerUrl": "https://domo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-unimednacional",
    "name": "Unimed Nacional",
    "slug": "unimednacional",
    "ats": "GUPY",
    "careerUrl": "https://unimednacional.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-estagiotempest",
    "name": "Estágio Tempest",
    "slug": "estagiotempest",
    "ats": "GUPY",
    "careerUrl": "https://estagiotempest.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-honda",
    "name": "Honda",
    "slug": "honda",
    "ats": "GUPY",
    "careerUrl": "https://honda.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sinqia",
    "name": "Sinqia",
    "slug": "sinqia",
    "ats": "GUPY",
    "careerUrl": "https://sinqia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-bydbrasil",
    "name": "BYD Brasil",
    "slug": "bydbrasil",
    "ats": "GUPY",
    "careerUrl": "https://bydbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-fcamara",
    "name": "FCamara",
    "slug": "fcamara",
    "ats": "GUPY",
    "careerUrl": "https://fcamara.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ahgora",
    "name": "Ahgora",
    "slug": "ahgora",
    "ats": "GUPY",
    "careerUrl": "https://ahgora.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-radixeng",
    "name": "Radix Engenharia",
    "slug": "radixeng",
    "ats": "GUPY",
    "careerUrl": "https://radixeng.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-adatech",
    "name": "Ada Tech",
    "slug": "adatech",
    "ats": "GUPY",
    "careerUrl": "https://adatech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cacaushow",
    "name": "Cacau Show",
    "slug": "cacaushow",
    "ats": "GUPY",
    "careerUrl": "https://cacaushow.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-neogridcarreiras",
    "name": "Neogrid Carreiras",
    "slug": "neogridcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://neogridcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-nomos",
    "name": "Nomos",
    "slug": "nomos",
    "ats": "GUPY",
    "careerUrl": "https://nomos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-nomus",
    "name": "Nomus",
    "slug": "nomus",
    "ats": "GUPY",
    "careerUrl": "https://nomus.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aliare",
    "name": "Aliare",
    "slug": "aliare",
    "ats": "GUPY",
    "careerUrl": "https://aliare.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-agibank",
    "name": "Agibank",
    "slug": "agibank",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/agibank",
    "status": "MONITORED",
    "activeJobsCount": 94,
    "hasTechJobs": true
  },
  {
    "id": "comp-vericode",
    "name": "Vericode",
    "slug": "vericode",
    "ats": "GUPY",
    "careerUrl": "https://vericode.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vemserolxbrasil",
    "name": "Grupo OLX",
    "slug": "vemserolxbrasil",
    "ats": "GUPY",
    "careerUrl": "https://vemserolxbrasil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tecnologiagrupocasasbahia",
    "name": "Grupo Casas Bahia",
    "slug": "tecnologiagrupocasasbahia",
    "ats": "GUPY",
    "careerUrl": "https://tecnologiagrupocasasbahia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-jornadabemobi",
    "name": "Jornada Bemobi",
    "slug": "jornadabemobi",
    "ats": "GUPY",
    "careerUrl": "https://jornadabemobi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vdev",
    "name": "v(dev)",
    "slug": "vdev",
    "ats": "GUPY",
    "careerUrl": "https://vdev.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-solutis",
    "name": "Solutis",
    "slug": "solutis",
    "ats": "GUPY",
    "careerUrl": "https://solutis.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cadastra",
    "name": "Cadastra",
    "slug": "cadastra",
    "ats": "GUPY",
    "careerUrl": "https://cadastra.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-petlove",
    "name": "Grupo Petlove",
    "slug": "petlove",
    "ats": "GUPY",
    "careerUrl": "https://petlove.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aiqfome",
    "name": "aiqfome",
    "slug": "aiqfome",
    "ats": "GUPY",
    "careerUrl": "https://aiqfome.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ploomes",
    "name": "Ploomes",
    "slug": "ploomes",
    "ats": "GUPY",
    "careerUrl": "https://ploomes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-shopper",
    "name": "Shopper",
    "slug": "shopper",
    "ats": "GUPY",
    "careerUrl": "https://shopper.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-confitec",
    "name": "Confitec",
    "slug": "confitec",
    "ats": "GUPY",
    "careerUrl": "https://confitec.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-synvia",
    "name": "Synvia",
    "slug": "synvia",
    "ats": "GUPY",
    "careerUrl": "https://synvia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-viaflow",
    "name": "Viaflow",
    "slug": "viaflow",
    "ats": "GUPY",
    "careerUrl": "https://viaflow.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-seedz",
    "name": "SEEDZ",
    "slug": "seedz",
    "ats": "GUPY",
    "careerUrl": "https://seedz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-localiza",
    "name": "Localiza&Co",
    "slug": "localiza",
    "ats": "GUPY",
    "careerUrl": "https://localiza.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ioasys",
    "name": "ioasys",
    "slug": "ioasys",
    "ats": "GUPY",
    "careerUrl": "https://ioasys.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tech-career",
    "name": "Gupy Tech",
    "slug": "tech-career",
    "ats": "GUPY",
    "careerUrl": "https://tech-career.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mutantbrvagas",
    "name": "Mutant",
    "slug": "mutantbrvagas",
    "ats": "GUPY",
    "careerUrl": "https://mutantbrvagas.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-enjoei",
    "name": "enjoei",
    "slug": "enjoei",
    "ats": "GUPY",
    "careerUrl": "https://enjoei.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-bandeirantes",
    "name": "Rede Bandeirantes",
    "slug": "bandeirantes",
    "ats": "GUPY",
    "careerUrl": "https://bandeirantes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-semantix",
    "name": "Semantix",
    "slug": "semantix",
    "ats": "GUPY",
    "careerUrl": "https://semantix.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pageoutsourcingbr",
    "name": "Page Outsourcing",
    "slug": "pageoutsourcingbr",
    "ats": "GUPY",
    "careerUrl": "https://pageoutsourcingbr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-t10",
    "name": "T10",
    "slug": "t10",
    "ats": "GUPY",
    "careerUrl": "https://t10.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cuponomia",
    "name": "Cuponomia",
    "slug": "cuponomia",
    "ats": "GUPY",
    "careerUrl": "https://cuponomia.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-modalgr",
    "name": "ModalGR",
    "slug": "modalgr",
    "ats": "GUPY",
    "careerUrl": "https://modalgr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-yampi",
    "name": "Yampi",
    "slug": "yampi",
    "ats": "GUPY",
    "careerUrl": "https://yampi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-riachuelo",
    "name": "Riachuelo",
    "slug": "riachuelo",
    "ats": "GUPY",
    "careerUrl": "https://riachuelo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-globo",
    "name": "Globo",
    "slug": "globo",
    "ats": "GUPY",
    "careerUrl": "https://globo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-oto",
    "name": "Oto",
    "slug": "oto",
    "ats": "GUPY",
    "careerUrl": "https://oto.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-octadesk",
    "name": "Octadesk",
    "slug": "octadesk",
    "ats": "GUPY",
    "careerUrl": "https://octadesk.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vr",
    "name": "VR",
    "slug": "vr",
    "ats": "GUPY",
    "careerUrl": "https://vr.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-vemprabip",
    "name": "Bip Brasil",
    "slug": "vemprabip",
    "ats": "GUPY",
    "careerUrl": "https://vemprabip.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-bhs",
    "name": "Somos BHS",
    "slug": "bhs",
    "ats": "GUPY",
    "careerUrl": "https://bhs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gruposbftalentos",
    "name": "Grupo SBF",
    "slug": "gruposbftalentos",
    "ats": "GUPY",
    "careerUrl": "https://gruposbftalentos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-portalsolar",
    "name": "Portal Solar",
    "slug": "portalsolar",
    "ats": "GUPY",
    "careerUrl": "https://portalsolar.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-corebiz",
    "name": "Corebiz",
    "slug": "corebiz",
    "ats": "GUPY",
    "careerUrl": "https://corebiz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-praxio",
    "name": "Praxio",
    "slug": "praxio",
    "ats": "GUPY",
    "careerUrl": "https://praxio.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-stefaninilatam",
    "name": "STEFANINI LATAM",
    "slug": "stefaninilatam",
    "ats": "GUPY",
    "careerUrl": "https://stefaninilatam.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-voltz",
    "name": "Voltz",
    "slug": "voltz",
    "ats": "GUPY",
    "careerUrl": "https://voltz.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-centralit",
    "name": "Central IT",
    "slug": "centralit",
    "ats": "GUPY",
    "careerUrl": "https://centralit.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ciahering",
    "name": "Cia Hering",
    "slug": "ciahering",
    "ats": "GUPY",
    "careerUrl": "https://ciahering.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cogna",
    "name": "Cogna",
    "slug": "cogna",
    "ats": "GUPY",
    "careerUrl": "https://cogna.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-claro",
    "name": "Claro",
    "slug": "claro",
    "ats": "GUPY",
    "careerUrl": "https://claro.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mjvcarreiras",
    "name": "MJV Technology",
    "slug": "mjvcarreiras",
    "ats": "GUPY",
    "careerUrl": "https://mjvcarreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-strada",
    "name": "Strada",
    "slug": "strada",
    "ats": "GUPY",
    "careerUrl": "https://strada.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sejaefi",
    "name": "Efí by Gerencianet",
    "slug": "sejaefi",
    "ats": "GUPY",
    "careerUrl": "https://sejaefi.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-globalhitss",
    "name": "Global Hitss",
    "slug": "globalhitss",
    "ats": "GUPY",
    "careerUrl": "https://globalhitss.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-futurai",
    "name": "Futurai",
    "slug": "futurai",
    "ats": "GUPY",
    "careerUrl": "https://futurai.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-transfeera",
    "name": "Transfeera",
    "slug": "transfeera",
    "ats": "GUPY",
    "careerUrl": "https://transfeera.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-teckeysolutions",
    "name": "Teckey Solutions",
    "slug": "teckeysolutions",
    "ats": "GUPY",
    "careerUrl": "https://teckeysolutions.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-qsd",
    "name": "Quero Ser Dev",
    "slug": "qsd",
    "ats": "GUPY",
    "careerUrl": "https://qsd.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-elo7",
    "name": "Elo7",
    "slug": "elo7",
    "ats": "GUPY",
    "careerUrl": "https://elo7.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gruporbs",
    "name": "Grupo RBS",
    "slug": "gruporbs",
    "ats": "GUPY",
    "careerUrl": "https://gruporbs.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-dwsbrazil",
    "name": "DWS Brazil",
    "slug": "dwsbrazil",
    "ats": "GUPY",
    "careerUrl": "https://dwsbrazil.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-minervatech",
    "name": "Minerva Foods Tecnologia",
    "slug": "minervatech",
    "ats": "GUPY",
    "careerUrl": "https://minervatech.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-carreirasomie",
    "name": "Omie",
    "slug": "carreirasomie",
    "ats": "GUPY",
    "careerUrl": "https://carreirasomie.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-codenapp",
    "name": "Code n' App",
    "slug": "codenapp",
    "ats": "GUPY",
    "careerUrl": "https://codenapp.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-inmetrics",
    "name": "Inmetrics S/A",
    "slug": "inmetrics",
    "ats": "GUPY",
    "careerUrl": "https://inmetrics.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-onfly",
    "name": "Onfly",
    "slug": "onfly",
    "ats": "GUPY",
    "careerUrl": "https://onfly.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aprovadigital",
    "name": "Aprova",
    "slug": "aprovadigital",
    "ats": "GUPY",
    "careerUrl": "https://aprovadigital.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-db",
    "name": "DB | CRESCER com propósito!",
    "slug": "db",
    "ats": "GUPY",
    "careerUrl": "https://db.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-keeggo",
    "name": "keeggo",
    "slug": "keeggo",
    "ats": "GUPY",
    "careerUrl": "https://keeggo.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-afya",
    "name": "Afya",
    "slug": "afya",
    "ats": "GUPY",
    "careerUrl": "https://afya.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-carreiras",
    "name": "Página de EuroChem",
    "slug": "carreiras",
    "ats": "GUPY",
    "careerUrl": "https://carreiras.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-2comconsulting",
    "name": "2Com Consulting",
    "slug": "2comconsulting",
    "ats": "GUPY",
    "careerUrl": "https://2comconsulting.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3coracoes",
    "name": "Grupo 3corações",
    "slug": "3coracoes",
    "ats": "GUPY",
    "careerUrl": "https://3coracoes.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3corptechnology",
    "name": "3CORP Technology",
    "slug": "3corptechnology",
    "ats": "GUPY",
    "careerUrl": "https://3corptechnology.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3cservices",
    "name": "3C Services",
    "slug": "3cservices",
    "ats": "GUPY",
    "careerUrl": "https://3cservices.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3rpetroleum",
    "name": "3R PETROLEUM",
    "slug": "3rpetroleum",
    "ats": "GUPY",
    "careerUrl": "https://3rpetroleum.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3tentos",
    "name": "3tentos - Faça parte do nosso time!",
    "slug": "3tentos",
    "ats": "GUPY",
    "careerUrl": "https://3tentos.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-4mk",
    "name": "4MK Solutions",
    "slug": "4mk",
    "ats": "GUPY",
    "careerUrl": "https://4mk.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-77sol",
    "name": "77Sol",
    "slug": "77sol",
    "ats": "GUPY",
    "careerUrl": "https://77sol.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-a3consultoria",
    "name": "A3 Consultoria",
    "slug": "a3consultoria",
    "ats": "GUPY",
    "careerUrl": "https://a3consultoria.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aacd",
    "name": "AACD",
    "slug": "aacd",
    "ats": "GUPY",
    "careerUrl": "https://aacd.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abaco",
    "name": "Colégio Ábaco",
    "slug": "abaco",
    "ats": "GUPY",
    "careerUrl": "https://abaco.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abakids",
    "name": "Abakids",
    "slug": "abakids",
    "ats": "GUPY",
    "careerUrl": "https://abakids.gupy.io",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-venturus",
    "name": "Venturus",
    "slug": "venturus",
    "ats": "INHIRE",
    "careerUrl": "https://venturus.inhire.app/vagas/",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-db1",
    "name": "DB1",
    "slug": "db1",
    "ats": "INHIRE",
    "careerUrl": "https://db1.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-rentbrella",
    "name": "Rentbrella",
    "slug": "rentbrella",
    "ats": "INHIRE",
    "careerUrl": "https://rentbrella.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-grupotaking",
    "name": "Grupo Taking",
    "slug": "grupotaking",
    "ats": "INHIRE",
    "careerUrl": "https://grupotaking.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ihunters",
    "name": "iHunters",
    "slug": "ihunters",
    "ats": "INHIRE",
    "careerUrl": "https://ihunters.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-v4company",
    "name": "V4 Company",
    "slug": "v4company",
    "ats": "INHIRE",
    "careerUrl": "https://v4company.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-bipa",
    "name": "Bipa",
    "slug": "bipa",
    "ats": "INHIRE",
    "careerUrl": "https://bipa.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-spun",
    "name": "Spun Mídia",
    "slug": "spun",
    "ats": "INHIRE",
    "careerUrl": "https://spun.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-rpo-xpinc",
    "name": "Rpo Xpinc",
    "slug": "rpo-xpinc",
    "ats": "INHIRE",
    "careerUrl": "https://rpo-xpinc.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-rhitmotech",
    "name": "Rhitmotech",
    "slug": "rhitmotech",
    "ats": "INHIRE",
    "careerUrl": "https://rhitmotech.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-caffeinearmy",
    "name": "GRUPO Caffeine Army",
    "slug": "caffeinearmy",
    "ats": "INHIRE",
    "careerUrl": "https://caffeinearmy.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-contaazul",
    "name": "https://contaazul.inhire.app/",
    "slug": "contaazul",
    "ats": "INHIRE",
    "careerUrl": "https://contaazul.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-mottu",
    "name": "Mottu",
    "slug": "mottu",
    "ats": "INHIRE",
    "careerUrl": "https://mottu.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-iconit",
    "name": "Iconit",
    "slug": "iconit",
    "ats": "INHIRE",
    "careerUrl": "https://iconit.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-180seguros",
    "name": "180 Seguros",
    "slug": "180seguros",
    "ats": "INHIRE",
    "careerUrl": "https://180seguros.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-2future",
    "name": "2Future",
    "slug": "2future",
    "ats": "INHIRE",
    "careerUrl": "https://2future.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3amining",
    "name": "3amining",
    "slug": "3amining",
    "ats": "INHIRE",
    "careerUrl": "https://3amining.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3cplusnow",
    "name": "3cplusnow",
    "slug": "3cplusnow",
    "ats": "INHIRE",
    "careerUrl": "https://3cplusnow.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-3dcriar",
    "name": "3DCRIAR",
    "slug": "3dcriar",
    "ats": "INHIRE",
    "careerUrl": "https://3dcriar.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-5ccompany",
    "name": "5C Company LLC",
    "slug": "5ccompany",
    "ats": "INHIRE",
    "careerUrl": "https://5ccompany.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-a-players",
    "name": "A Players",
    "slug": "a-players",
    "ats": "INHIRE",
    "careerUrl": "https://a-players.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-a2fbr",
    "name": "A2FBR",
    "slug": "a2fbr",
    "ats": "INHIRE",
    "careerUrl": "https://a2fbr.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abtatividades",
    "name": "Abtatividades",
    "slug": "abtatividades",
    "ats": "INHIRE",
    "careerUrl": "https://abtatividades.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-abzservicos",
    "name": "ABZ Serviços LTDA",
    "slug": "abzservicos",
    "ats": "INHIRE",
    "careerUrl": "https://abzservicos.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-acerto",
    "name": "Acerto",
    "slug": "acerto",
    "ats": "INHIRE",
    "careerUrl": "https://acerto.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-adias",
    "name": "Adias Sol.Ar.",
    "slug": "adias",
    "ats": "INHIRE",
    "careerUrl": "https://adias.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-adsplay",
    "name": "Adsplay",
    "slug": "adsplay",
    "ats": "INHIRE",
    "careerUrl": "https://adsplay.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-advbox",
    "name": "Advbox Software Jurídico",
    "slug": "advbox",
    "ats": "INHIRE",
    "careerUrl": "https://advbox.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-agrosearch",
    "name": "AGROSearch",
    "slug": "agrosearch",
    "ats": "INHIRE",
    "careerUrl": "https://agrosearch.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-agrotools",
    "name": "Agrotools",
    "slug": "agrotools",
    "ats": "INHIRE",
    "careerUrl": "https://agrotools.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aiko",
    "name": "Aiko",
    "slug": "aiko",
    "ats": "INHIRE",
    "careerUrl": "https://aiko.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-akadseguros",
    "name": "Akad Seguros",
    "slug": "akadseguros",
    "ats": "INHIRE",
    "careerUrl": "https://akadseguros.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alana",
    "name": "Alana",
    "slug": "alana",
    "ats": "INHIRE",
    "careerUrl": "https://alana.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alconkofre",
    "name": "KOFRE TECNOLOGIA",
    "slug": "alconkofre",
    "ats": "INHIRE",
    "careerUrl": "https://alconkofre.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alea",
    "name": "Alea",
    "slug": "alea",
    "ats": "INHIRE",
    "careerUrl": "https://alea.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alelo",
    "name": "Alelo Brasil",
    "slug": "alelo",
    "ats": "INHIRE",
    "careerUrl": "https://alelo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alianca",
    "name": "Aliança Condomínios",
    "slug": "alianca",
    "ats": "INHIRE",
    "careerUrl": "https://alianca.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alice",
    "name": "https://alice.inhire.app/vagas",
    "slug": "alice",
    "ats": "INHIRE",
    "careerUrl": "https://alice.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alicerce",
    "name": "Alicerce",
    "slug": "alicerce",
    "ats": "INHIRE",
    "careerUrl": "https://alicerce.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aliseo",
    "name": "Aliseo S.A.",
    "slug": "aliseo",
    "ats": "INHIRE",
    "careerUrl": "https://aliseo.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-allintra",
    "name": "Allintra",
    "slug": "allintra",
    "ats": "INHIRE",
    "careerUrl": "https://allintra.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alloyal",
    "name": "Alloyal",
    "slug": "alloyal",
    "ats": "INHIRE",
    "careerUrl": "https://alloyal.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-allset",
    "name": "All Set Comunicação",
    "slug": "allset",
    "ats": "INHIRE",
    "careerUrl": "https://allset.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-allu",
    "name": "Allu",
    "slug": "allu",
    "ats": "INHIRE",
    "careerUrl": "https://allu.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-almeidajunior",
    "name": "Almeida Junior Shopping Centers",
    "slug": "almeidajunior",
    "ats": "INHIRE",
    "careerUrl": "https://almeidajunior.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aloiaaerospace",
    "name": "ALOIA AEROSPACE INC",
    "slug": "aloiaaerospace",
    "ats": "INHIRE",
    "careerUrl": "https://aloiaaerospace.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-altervision",
    "name": "AlterVision",
    "slug": "altervision",
    "ats": "INHIRE",
    "careerUrl": "https://altervision.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-altoqi",
    "name": "AltoQi",
    "slug": "altoqi",
    "ats": "INHIRE",
    "careerUrl": "https://altoqi.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alume",
    "name": "Alume",
    "slug": "alume",
    "ats": "INHIRE",
    "careerUrl": "https://alume.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alun",
    "name": "Alun",
    "slug": "alun",
    "ats": "INHIRE",
    "careerUrl": "https://alun.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-alura-fiap-pm3",
    "name": "Alura Fiap Pm3",
    "slug": "alura-fiap-pm3",
    "ats": "INHIRE",
    "careerUrl": "https://alura-fiap-pm3.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-amcom",
    "name": "amcom.inhire.app",
    "slug": "amcom",
    "ats": "INHIRE",
    "careerUrl": "https://amcom.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-amicci",
    "name": "Amicci",
    "slug": "amicci",
    "ats": "INHIRE",
    "careerUrl": "https://amicci.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-anacouto",
    "name": "Ana Couto",
    "slug": "anacouto",
    "ats": "INHIRE",
    "careerUrl": "https://anacouto.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-anagaming",
    "name": "Ana Gaming",
    "slug": "anagaming",
    "ats": "INHIRE",
    "careerUrl": "https://anagaming.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-andrademaia",
    "name": "Andrademaia",
    "slug": "andrademaia",
    "ats": "INHIRE",
    "careerUrl": "https://andrademaia.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ap-digital-services",
    "name": "Ap Digital Services",
    "slug": "ap-digital-services",
    "ats": "INHIRE",
    "careerUrl": "https://ap-digital-services.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-appfacilita",
    "name": "Appfacilita",
    "slug": "appfacilita",
    "ats": "INHIRE",
    "careerUrl": "https://appfacilita.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-appmax",
    "name": "Appmax",
    "slug": "appmax",
    "ats": "INHIRE",
    "careerUrl": "https://appmax.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aprix",
    "name": "Aprix",
    "slug": "aprix",
    "ats": "INHIRE",
    "careerUrl": "https://aprix.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aprova",
    "name": "Aprova",
    "slug": "aprova",
    "ats": "INHIRE",
    "careerUrl": "https://aprova.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-arcosscale",
    "name": "Arcos Scale",
    "slug": "arcosscale",
    "ats": "INHIRE",
    "careerUrl": "https://arcosscale.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-asa",
    "name": "ASA Indústria",
    "slug": "asa",
    "ats": "INHIRE",
    "careerUrl": "https://asa.inhire.app",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tryalma",
    "name": "Alma",
    "slug": "tryalma",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/tryalma",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-crusoe",
    "name": "Crusoe",
    "slug": "crusoe",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/crusoe",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-openai",
    "name": "OpenAI",
    "slug": "openai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/openai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ramp",
    "name": "Ramp",
    "slug": "ramp",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ramp",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-etched",
    "name": "Etched",
    "slug": "etched",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/etched",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cursor",
    "name": "Cursor",
    "slug": "cursor",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cursor",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-decagon",
    "name": "Decagon",
    "slug": "decagon",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/decagon",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-notion",
    "name": "Notion",
    "slug": "notion",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/notion",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-harvey",
    "name": "Harvey",
    "slug": "harvey",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/harvey",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-baseten",
    "name": "Baseten",
    "slug": "baseten",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/baseten",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lambda",
    "name": "Lambda",
    "slug": "lambda",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lambda",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-acme",
    "name": "Acme",
    "slug": "acme",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/acme",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-applied",
    "name": "Applied Intuition",
    "slug": "applied",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/applied",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-basis-ai",
    "name": "Basis AI",
    "slug": "basis-ai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/basis-ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-rogo",
    "name": "Rogo",
    "slug": "rogo",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/rogo",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lindy",
    "name": "Lindy",
    "slug": "lindy",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lindy",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-elevenlabs",
    "name": "ElevenLabs",
    "slug": "elevenlabs",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/elevenlabs",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cohere",
    "name": "Cohere",
    "slug": "cohere",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cohere",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sierra",
    "name": "Sierra",
    "slug": "sierra",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/sierra",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-synthesia",
    "name": "Synthesia",
    "slug": "synthesia",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/synthesia",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-lovable",
    "name": "Lovable",
    "slug": "lovable",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/lovable",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-legora",
    "name": "Legora",
    "slug": "legora",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/legora",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-perplexity",
    "name": "Perplexity",
    "slug": "perplexity",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/perplexity",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-qdrant",
    "name": "Qdrant",
    "slug": "qdrant",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/qdrant",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-exa",
    "name": "Exa",
    "slug": "exa",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/exa",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tempo",
    "name": "Tempo",
    "slug": "tempo",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/Tempo",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-primer",
    "name": "Primer",
    "slug": "primer",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/primer",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-metal",
    "name": "Metal",
    "slug": "metal",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/metal",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-claylabs",
    "name": "Clay Labs",
    "slug": "claylabs",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/claylabs",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-eliseai",
    "name": "EliseAI",
    "slug": "eliseai",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/eliseai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ironcladhq",
    "name": "Ironclad",
    "slug": "ironcladhq",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ironcladhq",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-airapps",
    "name": "Air Apps",
    "slug": "airapps",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/airapps",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-deepgram",
    "name": "Deepgram",
    "slug": "deepgram",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/deepgram",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-depot",
    "name": "Depot",
    "slug": "depot",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/depot",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-camunda",
    "name": "Camunda",
    "slug": "camunda",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/camunda",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-blockstream",
    "name": "Blockstream",
    "slug": "blockstream",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/blockstream",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cosuno",
    "name": "Cosuno",
    "slug": "cosuno",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/cosuno",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-deepl",
    "name": "DeepL",
    "slug": "deepl",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/deepl",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ridealso",
    "name": "ALSO",
    "slug": "ridealso",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/ridealso",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-anima",
    "name": "Anima",
    "slug": "anima",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/anima",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-regent",
    "name": "REGENT",
    "slug": "regent",
    "ats": "ASHBY",
    "careerUrl": "https://jobs.ashbyhq.com/regent",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-wealthfront",
    "name": "Wealthfront",
    "slug": "wealthfront",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/wealthfront",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-jobgether",
    "name": "Jobgether",
    "slug": "jobgether",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/jobgether",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-paytmpayments",
    "name": "Paytm Payments Services",
    "slug": "paytmpayments",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/paytmpayments",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aogarciaagency",
    "name": "AO Garcia Agency",
    "slug": "aogarciaagency",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/aogarciaagency",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-spotify",
    "name": "Spotify",
    "slug": "spotify",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/spotify",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-shieldai",
    "name": "Shield AI",
    "slug": "shieldai",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/shieldai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-zoox",
    "name": "Zoox",
    "slug": "zoox",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/zoox",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ifm-us",
    "name": "Institute of Foundation Models",
    "slug": "ifm-us",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/ifm-us",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-hcvt",
    "name": "HCVT",
    "slug": "hcvt",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/hcvt",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-palantir",
    "name": "Palantir Technologies",
    "slug": "palantir",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/palantir",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-levelai",
    "name": "Level AI",
    "slug": "levelai",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/levelai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-datalabusa",
    "name": "Datalab USA",
    "slug": "datalabusa",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/datalabusa",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tractian",
    "name": "Tractian",
    "slug": "tractian",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/tractian",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sila",
    "name": "Sila Services",
    "slug": "sila",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/sila",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pigment",
    "name": "Pigment",
    "slug": "pigment",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/pigment",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-netomi",
    "name": "Netomi",
    "slug": "netomi",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/netomi",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-emburse",
    "name": "Emburse",
    "slug": "emburse",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/emburse",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-aleph",
    "name": "Aleph",
    "slug": "aleph",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/aleph",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-captivateiq",
    "name": "CaptivateIQ",
    "slug": "captivateiq",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/captivateiq",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-hive",
    "name": "Hive",
    "slug": "hive",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/hive",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-tryjeeves",
    "name": "Jeeves",
    "slug": "tryjeeves",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/tryjeeves",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-neon",
    "name": "Neon Pagamentos",
    "slug": "neon",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/neon",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-sophos",
    "name": "Sophos",
    "slug": "sophos",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/sophos",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-jumpcloud",
    "name": "JumpCloud",
    "slug": "jumpcloud",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/jumpcloud",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-gettyimages",
    "name": "Getty Images",
    "slug": "gettyimages",
    "ats": "LEVER",
    "careerUrl": "https://jobs.lever.co/gettyimages",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-robinhood",
    "name": "Robinhood",
    "slug": "robinhood",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/robinhood",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-nubank",
    "name": "Nubank",
    "slug": "nubank",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/nubank",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-quintoandar",
    "name": "QuintoAndar",
    "slug": "quintoandar",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/quintoandar",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-loggi",
    "name": "Loggi",
    "slug": "loggi",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/loggi",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-brex",
    "name": "Brex",
    "slug": "brex",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/brex",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-picpay",
    "name": "PicPay",
    "slug": "picpay",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/picpay",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-kavak",
    "name": "Kavak",
    "slug": "kavak",
    "ats": "GREENHOUSE",
    "careerUrl": "https://boards.greenhouse.io/kavak",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-futureplc",
    "name": "Future Publishing",
    "slug": "futureplc",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/futureplc",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pronexus-1",
    "name": "ProNexus",
    "slug": "pronexus-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/pronexus-1",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-ninetwothree-ai-studio",
    "name": "NineTwoThree AI Studio",
    "slug": "ninetwothree-ai-studio",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/ninetwothree-ai-studio",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-dcthomson",
    "name": "DC Thomson",
    "slug": "dcthomson",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/dcthomson",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-weekday-1",
    "name": "Weekday AI",
    "slug": "weekday-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/weekday-1",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-simply-tv",
    "name": "Simply TV",
    "slug": "simply-tv",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/simply-tv",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-covergo",
    "name": "CoverGo",
    "slug": "covergo",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/covergo",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-rokt",
    "name": "Rokt",
    "slug": "rokt",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/rokt",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-pony-dot-ai",
    "name": "pony.ai",
    "slug": "pony-dot-ai",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/pony-dot-ai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-cvector",
    "name": "CVector - Industrial AI",
    "slug": "cvector",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/cvector",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-twgai",
    "name": "TWG Global AI",
    "slug": "twgai",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/twgai",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-greenlife-healthcare-staffing-1",
    "name": "Greenlife Healthcare Staffing",
    "slug": "greenlife-healthcare-staffing-1",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/greenlife-healthcare-staffing-1",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-dable",
    "name": "Dable",
    "slug": "dable",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/dable",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-altom-transport",
    "name": "Altom Transport",
    "slug": "altom-transport",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/altom-transport",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-papier",
    "name": "Papier",
    "slug": "papier",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/papier",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-falcomm",
    "name": "Falcomm",
    "slug": "falcomm",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/falcomm",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-arondite",
    "name": "Arondite",
    "slug": "arondite",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/arondite",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-homey",
    "name": "Homey",
    "slug": "homey",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/homey",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-wallstreetquants",
    "name": "WallStreetQuants",
    "slug": "wallstreetquants",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/wallstreetquants",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-fuse-integration",
    "name": "Fuse Integration",
    "slug": "fuse-integration",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/fuse-integration",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-junglee-games",
    "name": "Junglee Games",
    "slug": "junglee-games",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/junglee-games",
    "status": "MONITORED",
    "activeJobsCount": 0,
    "hasTechJobs": true
  },
  {
    "id": "comp-talent-trader-group",
    "name": "Talent Trader Group",
    "slug": "talent-trader-group",
    "ats": "WORKABLE",
    "careerUrl": "https://apply.workable.com/talent-trader-group",
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
      const { data: compRows, error: compErr } = await supabase
        .from("companies")
        .select("id, name, slug, ats, career_url, status, active_jobs_count, has_tech_jobs")
        .order("name", { ascending: true });

      if (!compErr && Array.isArray(compRows) && compRows.length > 0) {
        dbCompanies = compRows.map((row: any) => ({
          id: row.id || `comp-${String(row.ats || "outro").toLowerCase()}-${row.slug}`,
          name: row.name,
          slug: row.slug,
          ats: row.ats,
          careerUrl: row.career_url,
          status: (row.status as "MONITORED" | "SUGGESTED") || "MONITORED",
          activeJobsCount: row.active_jobs_count || 0,
          hasTechJobs: row.has_tech_jobs ?? true,
        }));
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
        communityList = sugRows.map((s: any) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          ats: s.ats,
          careerUrl: s.career_url,
          status: "SUGGESTED" as const,
          activeJobsCount: 0,
          suggestedBy: s.suggested_by || "Comunidade",
          votesCount: s.votes_count || 1,
          notes: s.notes,
          createdAt: s.created_at,
        }));
      }
    } catch {
      // Ignora erro e continua com fallback local
    }

    const suggestions = communityList.length > 0 ? communityList : readSuggestions();

    // 3. Busca contagem de vagas ativas no Supabase para atualizar a quantidade por empresa
    const companyJobCounts: Record<string, { count: number; source: string; sampleUrl: string }> = {};
    try {
      const { data } = await supabase.from("jobs").select("company, source, url").limit(2000);
      if (data && Array.isArray(data)) {
        for (const row of data) {
          const compName = (row.company || "").trim();
          if (!compName) continue;
          const key = compName.toLowerCase();
          if (!companyJobCounts[key]) {
            companyJobCounts[key] = { count: 0, source: row.source || "OUTRO", sampleUrl: row.url || "" };
          }
          companyJobCounts[key].count++;
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

// POST /company-suggestions - Cria nova sugestão comunitária
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

    const suggestions = readSuggestions();
    const existing = suggestions.find(
      (s) => s.slug === slug || (s.careerUrl && s.careerUrl.toLowerCase() === trimmedUrl.toLowerCase()),
    );

    if (existing) {
      existing.votesCount = (existing.votesCount || 1) + 1;
      writeSuggestions(suggestions);
      res.status(200).json(existing);
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

    suggestions.unshift(newSuggestion);
    writeSuggestions(suggestions);

    // Persiste também no Supabase de forma resiliente
    try {
      await supabase.from("company_suggestions").insert({
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
      });
    } catch {
      // Ignora erro em caso de offline
    }

    res.status(201).json(newSuggestion);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao registrar sugestão";
    res.status(500).json({ error: msg });
  }
});

// GET /company-suggestions - Lista apenas sugestões comunitárias
app.get("/company-suggestions", (_req: Request, res: Response) => {
  try {
    const suggestions = readSuggestions();
    suggestions.sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));
    res.json(suggestions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar sugestões";
    res.status(500).json({ error: msg });
  }
});

// POST /company-suggestions/:id/upvote - Apoiar sugestão com voto comunitário
app.post("/company-suggestions/:id/upvote", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const suggestions = readSuggestions();
    const target = suggestions.find((s) => s.id === id);

    if (!target) {
      res.status(404).json({ error: "Sugestão não encontrada" });
      return;
    }

    target.votesCount = (target.votesCount || 1) + 1;
    writeSuggestions(suggestions);

    // Sincroniza upvote no Supabase
    try {
      await supabase
        .from("company_suggestions")
        .update({ votes_count: target.votesCount })
        .eq("id", id);
    } catch {
      // Ignora erro
    }

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
