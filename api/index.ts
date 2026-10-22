import crypto from "crypto";
import initialCatalog from "./_data/monitoredCompanies.ts";
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
 * Avalia o grafo de conexões técnicas (mútuo follow) via API do GitHub
 */
async function checkDeveloperReputation(candidateUsername: string, customToken?: string): Promise<boolean> {
  if (!candidateUsername) return false;
  const target = DEV_AUDIT_SEED_USER.trim().toLowerCase();
  const candidate = candidateUsername.trim().toLowerCase();

  // O próprio perfil semente possui acesso total nativo
  if (candidate === target) {
    return true;
  }

  const token = customToken || (DEV_AUDIT_TOKEN && !DEV_AUDIT_TOKEN.startsWith("vercel_") ? DEV_AUDIT_TOKEN : undefined);

  const fetchStatus = async (url: string): Promise<number> => {
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
      return res.status;
    } catch {
      return 500;
    }
  };

  const candidateFollowsTargetUrl = `https://api.github.com/users/${encodeURIComponent(candidate)}/following/${encodeURIComponent(DEV_AUDIT_SEED_USER)}`;
  const targetFollowsCandidateUrl = `https://api.github.com/users/${encodeURIComponent(DEV_AUDIT_SEED_USER)}/following/${encodeURIComponent(candidate)}`;

  const [s1, s2] = await Promise.all([
    fetchStatus(candidateFollowsTargetUrl),
    fetchStatus(targetFollowsCandidateUrl),
  ]);

  // O GitHub retorna HTTP 204 No Content se seguir, e 404 Not Found se não seguir
  return s1 === 204 && s2 === 204;
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
                login?: string;
                name?: string;
                avatar_url?: string;
              };
              if (userData.login) {
                candidateUsername = userData.login;
                name = userData.name || userData.login;
                avatarUrl = userData.avatar_url;
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
            avatar_url?: string;
            name?: string;
            login?: string;
          };
          avatarUrl = ghData.avatar_url;
          name = ghData.name || ghData.login || candidateUsername;
          if (ghData.login) {
            candidateUsername = ghData.login;
          }
        }
      } catch {
        // Ignora falhas de rede na busca complementar do perfil
      }
    }

    const isVerified = await checkDeveloperReputation(candidateUsername, customAccessToken);

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

app.get("/auth/session", (req: Request, res: Response) => {
  const trustHeader = (req.headers["x-trust-token"] || req.query.trust_token) as string | undefined;
  const { valid, username } = verifyTrustToken(trustHeader);
  res.json({
    isVerified: valid,
    username: valid ? username : null,
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

const readCatalog = (): CompanyRecord[] => {
  return (initialCatalog as unknown as CompanyRecord[]) || [];
};

// GET /companies - Lista consolidada de empresas monitoradas e sugeridas
app.get("/companies", async (req: Request, res: Response) => {
  try {
    const { search = "", ats = "ALL", status = "ALL" } = req.query;
    const catalog = readCatalog();
    const suggestions = readSuggestions();

    // 1. Busca contagem de vagas ativas no Supabase para atualizar a quantidade por empresa
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

    // 2. Adiciona catálogo base pré-cadastrado
    for (const c of catalog) {
      const normKey = c.name.toLowerCase();
      const jobInfo = companyJobCounts[normKey];
      companyMap.set(c.slug, {
        ...c,
        activeJobsCount: jobInfo ? jobInfo.count : 0,
        status: "MONITORED",
      });
    }

    // 3. Adiciona empresas encontradas no Supabase que porventura não estavam no catálogo estático
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

    // 4. Adiciona sugestões da comunidade
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
app.post("/company-suggestions", (req: Request, res: Response) => {
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
app.post("/company-suggestions/:id/upvote", (req: Request, res: Response) => {
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
