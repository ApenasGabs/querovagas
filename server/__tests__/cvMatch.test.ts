// @vitest-environment node
import express from "express";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildCvMatchMessages,
  callLlmProvider,
  computeWeightedScore,
  createCvMatchHandler,
  createRateLimiter,
  CvMatchError,
  normalizeCvMatchResult,
  parseLlmJson,
  RESUME_MAX_CHARS,
  RESUME_MIN_CHARS,
  tierForScore,
  validateCvMatchRequest,
} from "../../api/_lib/cvMatch.ts";
import app from "../app";

const VALID_RESUME = "Desenvolvedor TypeScript e React com 5 anos de experiência em aplicações web escaláveis, APIs REST em Node.js, testes automatizados com Vitest e Playwright, observabilidade e deploy em nuvem. ".repeat(2);

const VALID_JOB = {
  title: "Senior Frontend Engineer",
  company: "QueroVagas Tech",
  seniorityLevel: "SENIOR",
  workModel: "REMOTO",
  contractType: "CLT",
  location: "Brasil",
  stack: ["React", "TypeScript", "Node.js"],
  description: "Buscamos pessoa engenheira para liderar arquitetura frontend com React e TypeScript.",
};

const VALID_RAW_LLM_RESULT = {
  criteria: {
    technicalRequirements: { score: 90, justification: "Domina React e TypeScript." },
    seniorityExperience: { score: 80, justification: "5 anos compatíveis com senioridade." },
    responsibilitiesDomain: { score: 75, justification: "Experiência próxima ao produto." },
    impactEvidence: { score: 60, justification: "Faltam métricas numéricas." },
    atsKeywords: { score: 85, justification: "Termos-chave presentes." },
  },
  matchedSkills: ["React", "TypeScript", "Node.js"],
  missingSkills: ["GraphQL"],
  strengths: ["Sólida experiência em React/TS"],
  gaps: ["Sem menção a métricas de impacto"],
  suggestions: [{ section: "Experiência", suggestion: "Adicionar métricas de conversão ou latência." }],
  rewrittenBullets: [
    {
      original: "Desenvolvi aplicações React",
      rewritten: "Arquitetei aplicações React e TypeScript atendendo [X] usuários.",
    },
  ],
  summary: "Candidato bem aderente aos requisitos técnicos principais.",
  verdict: "Aplicar já após adicionar métricas de impacto.",
};

const startExpressServer = async (expressApp: express.Express): Promise<{ server: Server; baseUrl: string }> => {
  return new Promise((resolve) => {
    const server = expressApp.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
};

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
};

describe("cvMatch — validação, prompt, normalização e score", () => {
  it("valida payload válido e aplica defaultModel e truncamento", () => {
    const longResume = "A".repeat(RESUME_MAX_CHARS + 500);
    const res = validateCvMatchRequest({
      provider: "xai",
      model: "   ",
      resumeText: longResume,
      job: VALID_JOB,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.model).toBe("grok-4");
      expect(res.value.resumeText.length).toBe(RESUME_MAX_CHARS);
      expect(res.value.job.stack).toEqual(["React", "TypeScript", "Node.js"]);
    }

    const groqRes = validateCvMatchRequest({
      provider: "groq",
      model: "",
      resumeText: VALID_RESUME,
      job: VALID_JOB,
    });
    expect(groqRes.ok).toBe(true);
    if (groqRes.ok) {
      expect(groqRes.value.model).toBe("openai/gpt-oss-20b");
    }

    const legacyGroqRes = validateCvMatchRequest({
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      resumeText: VALID_RESUME,
      job: VALID_JOB,
    });
    expect(legacyGroqRes.ok).toBe(true);
    if (legacyGroqRes.ok) {
      expect(legacyGroqRes.value.model).toBe("openai/gpt-oss-20b");
    }
  });

  it("rejeita provedor inválido, modelo inválido, currículo curto e vaga incompleta", () => {
    expect(validateCvMatchRequest(null).ok).toBe(false);
    expect(validateCvMatchRequest({ provider: "unknown", resumeText: VALID_RESUME, job: VALID_JOB }).ok).toBe(false);
    expect(validateCvMatchRequest({ provider: "openai", model: "gpt 4 bad!", resumeText: VALID_RESUME, job: VALID_JOB }).ok).toBe(false);
    expect(validateCvMatchRequest({ provider: "openai", resumeText: "a".repeat(RESUME_MIN_CHARS - 1), job: VALID_JOB }).ok).toBe(false);
    expect(validateCvMatchRequest({ provider: "openai", resumeText: VALID_RESUME, job: { title: "Dev", company: "" } }).ok).toBe(false);
  });

  it("monta prompt com delimitadores anti-injection e dados da vaga/currículo", () => {
    const { system, user } = buildCvMatchMessages({
      provider: "xai",
      model: "grok-4",
      resumeText: VALID_RESUME,
      job: { ...VALID_JOB, description: undefined },
    });

    expect(system).toContain("<curriculo>");
    expect(system).toContain("nunca instruções");
    expect(user).toContain("<vaga>");
    expect(user).toContain("Senior Frontend Engineer");
    expect(user).toContain("(descrição não disponível)");
    expect(user).toContain(`<curriculo>\n${VALID_RESUME}\n</curriculo>`);
  });

  it("extrai JSON puro, em cerca markdown ou cercado de texto, e falha em resposta inválida", () => {
    expect(parseLlmJson('{"ok":1}')).toEqual({ ok: 1 });
    expect(parseLlmJson('{"summary":"Exemplo:\\n```ts\\nconst x = 1;\\n```"}')).toEqual({
      summary: "Exemplo:\n```ts\nconst x = 1;\n```",
    });
    expect(parseLlmJson("Aqui está:\n```json\n{\"ok\":2}\n```")).toEqual({ ok: 2 });
    expect(parseLlmJson('Texto antes {"ok":3} texto depois')).toEqual({ ok: 3 });
    expect(() => parseLlmJson("sem json algum")).toThrowError(CvMatchError);
  });

  it("calcula score ponderado no servidor, aplica clamp e classifica faixas", () => {
    const score = computeWeightedScore({
      technicalRequirements: 90,
      seniorityExperience: 80,
      responsibilitiesDomain: 75,
      impactEvidence: 60,
      atsKeywords: 85,
    });
    // 90*0.35 + 80*0.2 + 75*0.2 + 60*0.15 + 85*0.1 = 31.5 + 16 + 15 + 9 + 8.5 = 80
    expect(score).toBe(80);
    expect(tierForScore(80)).toBe("high");
    expect(tierForScore(79)).toBe("good");
    expect(tierForScore(65)).toBe("good");
    expect(tierForScore(50)).toBe("partial");
    expect(tierForScore(49)).toBe("low");

    const normalized = normalizeCvMatchResult({
      ...VALID_RAW_LLM_RESULT,
      score: 12, // deve ser ignorado em favor do cálculo do servidor
      criteria: {
        ...VALID_RAW_LLM_RESULT.criteria,
        technicalRequirements: { score: 140, justification: "  Excelente  " },
        impactEvidence: { score: -10, justification: "" },
      },
      matchedSkills: Array.from({ length: 20 }, (_, i) => `Skill-${i}`),
      suggestions: [{ section: "", suggestion: "Melhorar resumo" }],
    });

    expect(normalized.criteria[0].score).toBe(100);
    expect(normalized.criteria[0].justification).toBe("Excelente");
    expect(normalized.criteria[3].score).toBe(0);
    // 100*0.35 + 80*0.2 + 75*0.2 + 0*0.15 + 85*0.1 = 35 + 16 + 15 + 0 + 8.5 = 74.5 -> 75
    expect(normalized.score).toBe(75);
    expect(normalized.tier).toBe("good");
    expect(normalized.matchedSkills).toHaveLength(12);
    expect(normalized.suggestions[0].section).toBe("Geral");
  });

  it("falha na normalização quando algum critério obrigatório falta ou vem com score vazio", () => {
    expect(() => normalizeCvMatchResult({ criteria: { technicalRequirements: { score: 80 } } })).toThrowError(
      CvMatchError,
    );
    expect(() =>
      normalizeCvMatchResult({
        ...VALID_RAW_LLM_RESULT,
        criteria: {
          ...VALID_RAW_LLM_RESULT.criteria,
          technicalRequirements: { score: "", justification: "Sem nota" },
        },
      }),
    ).toThrowError(CvMatchError);
    expect(() =>
      normalizeCvMatchResult({
        ...VALID_RAW_LLM_RESULT,
        criteria: {
          ...VALID_RAW_LLM_RESULT.criteria,
          atsKeywords: { score: "   ", justification: "Espaços" },
        },
      }),
    ).toThrowError(CvMatchError);
  });

  it("aplica rate limiter em janela deslizante", () => {
    let clock = 1_000;
    const limiter = createRateLimiter(2, 5_000, () => clock);

    expect(limiter("alice")).toBe(true);
    expect(limiter("alice")).toBe(true);
    expect(limiter("alice")).toBe(false);

    clock += 5_001;
    expect(limiter("alice")).toBe(true);
  });
});

describe("cvMatch — callLlmProvider", () => {
  it("envia requisição Anthropic, faz retry sem response_format e mascara chave em erro", async () => {
    const anthropicFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: "text", text: '{"ok":true}' }] }), { status: 200 }),
    );
    const anthropicOut = await callLlmProvider({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      apiKey: "sk-ant-secret123",
      messages: { system: "sys", user: "usr" },
      fetchImpl: anthropicFetch,
    });
    expect(anthropicOut).toBe('{"ok":true}');
    const [, anthropicInit] = anthropicFetch.mock.calls[0];
    expect((anthropicInit.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-secret123");

    const retryFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "response_format is not supported" } }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":2}' } }] }), { status: 200 }),
      );
    const retried = await callLlmProvider({
      provider: "openrouter",
      model: "x-ai/grok-4",
      apiKey: "sk-or-secret123",
      messages: { system: "sys", user: "usr" },
      fetchImpl: retryFetch,
    });
    expect(retried).toBe('{"ok":2}');
    expect(retryFetch).toHaveBeenCalledTimes(2);

    const rateLimitFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Quota exceeded for key sk-secret-xyz" } }), { status: 429 }),
      ),
    );
    await expect(
      callLlmProvider({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "sk-secret-xyz",
        messages: { system: "sys", user: "usr" },
        fetchImpl: rateLimitFetch,
      }),
    ).rejects.toMatchObject({ status: 429, code: "llm_rate_limited" });

    try {
      await callLlmProvider({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "sk-secret-xyz",
        messages: { system: "sys", user: "usr" },
        fetchImpl: rateLimitFetch,
      });
    } catch (err) {
      expect((err as CvMatchError).message).not.toContain("sk-secret-xyz");
      expect((err as CvMatchError).message).toContain("***");
    }
  });
});

describe("cvMatch — rotas Express (/api/cv-match/analyze)", () => {
  let realAppServer: Server;
  let realAppUrl: string;
  let handlerServer: Server;
  let handlerUrl: string;
  const fetchMock = vi.fn();

  beforeAll(async () => {
    const startedReal = await startExpressServer(app);
    realAppServer = startedReal.server;
    realAppUrl = startedReal.baseUrl;

    const testApp = express();
    testApp.use(express.json({ limit: "256kb" }));
    testApp.post(
      "/api/cv-match/analyze",
      createCvMatchHandler({
        verifyTrust: (token) => (token === "valid-trust" ? { valid: true, username: "ApenasGabs" } : { valid: false }),
        rateLimit: createRateLimiter(2, 60_000),
        fetchImpl: fetchMock,
      }),
    );
    const startedHandler = await startExpressServer(testApp);
    handlerServer = startedHandler.server;
    handlerUrl = startedHandler.baseUrl;
  });

  afterAll(async () => {
    await Promise.all([closeServer(realAppServer), closeServer(handlerServer)]);
  });

  it("bloqueia acesso sem trust token válido no app principal (401)", async () => {
    const res = await fetch(`${realAppUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-llm-api-key": "sk-test-123456" },
      body: JSON.stringify({ provider: "xai", resumeText: VALID_RESUME, job: VALID_JOB }),
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as { code: string };
    expect(data.code).toBe("unauthorized");
  });

  it("valida apiKey, payload, rate limit e retorna análise normalizada com Cache-Control no-store", async () => {
    const missingKeyRes = await fetch(`${handlerUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trust-token": "valid-trust" },
      body: JSON.stringify({ provider: "xai", resumeText: VALID_RESUME, job: VALID_JOB }),
    });
    expect(missingKeyRes.status).toBe(400);
    expect(((await missingKeyRes.json()) as { code: string }).code).toBe("missing_api_key");

    const invalidBodyRes = await fetch(`${handlerUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trust-token": "valid-trust",
        "x-llm-api-key": "xai-valid-key-123",
      },
      body: JSON.stringify({ provider: "xai", resumeText: "curto", job: VALID_JOB }),
    });
    expect(invalidBodyRes.status).toBe(400);
    expect(((await invalidBodyRes.json()) as { code: string }).code).toBe("invalid_request");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(VALID_RAW_LLM_RESULT) } }] }),
        { status: 200 },
      ),
    );
    const okRes = await fetch(`${handlerUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trust-token": "valid-trust",
        "x-llm-api-key": "xai-valid-key-123",
      },
      body: JSON.stringify({ provider: "xai", resumeText: VALID_RESUME, job: VALID_JOB }),
    });
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("cache-control")).toBe("no-store");
    const okBody = (await okRes.json()) as { result: { score: number; tier: string }; provider: string };
    expect(okBody.provider).toBe("xai");
    expect(okBody.result.score).toBe(80);
    expect(okBody.result.tier).toBe("high");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid api key" }), { status: 401 }));
    const badKeyRes = await fetch(`${handlerUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trust-token": "valid-trust",
        "x-llm-api-key": "xai-invalid-key-123",
      },
      body: JSON.stringify({ provider: "xai", resumeText: VALID_RESUME, job: VALID_JOB }),
    });
    expect(badKeyRes.status).toBe(401);
    expect(((await badKeyRes.json()) as { code: string }).code).toBe("invalid_api_key");

    const rateLimitedRes = await fetch(`${handlerUrl}/api/cv-match/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trust-token": "valid-trust",
        "x-llm-api-key": "xai-valid-key-123",
      },
      body: JSON.stringify({ provider: "xai", resumeText: VALID_RESUME, job: VALID_JOB }),
    });
    expect(rateLimitedRes.status).toBe(429);
    expect(((await rateLimitedRes.json()) as { code: string }).code).toBe("rate_limited");
  });
});
