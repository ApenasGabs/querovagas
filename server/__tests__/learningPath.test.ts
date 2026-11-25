// @vitest-environment node
import express from "express";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildCvMatchMessages,
  createRateLimiter,
  CvMatchError,
  normalizeCvMatchResult,
  normalizeGapDetails,
  validateCvMatchRequest,
} from "../../api/_lib/cvMatch.ts";
import {
  buildLearningPathMessages,
  createLearningPathHandler,
  LEARNING_PATH_MAX_STEPS,
  gapNameScore,
  normalizeLearningPath,
  orderSteps,
  stripUrls,
  validateLearningPathRequest,
  type LearningPathStep,
} from "../../api/_lib/learningPath.ts";
import app from "../app";

const VALID_RESUME =
  "Desenvolvedora frontend com 3 anos de experiência em Vue.js, JavaScript, HTML, CSS, testes com Jest e integração com APIs REST em produtos SaaS. ".repeat(2);

const LONG_DESCRIPTION = "Buscamos pessoa desenvolvedora para atuar com React, TypeScript e GraphQL em produto de pagamentos. ".repeat(5);

const VALID_JOB = {
  title: "Frontend Engineer Pleno",
  company: "QueroVagas Tech",
  seniorityLevel: "PLENO",
  stack: ["React", "TypeScript", "GraphQL"],
  description: LONG_DESCRIPTION,
};

const VALID_GAPS = [
  { skill: "React", status: "partial", priority: "required", kind: "learnable" },
  { skill: "GraphQL", status: "missing", priority: "nice_to_have", kind: "learnable" },
  { skill: "TypeScript", status: "missing", priority: "required", kind: "learnable" },
  { skill: "5 anos de experiência", status: "missing", priority: "required", kind: "experience" },
];

const baseBody = {
  provider: "xai",
  resumeText: VALID_RESUME,
  job: VALID_JOB,
  gaps: VALID_GAPS,
  knownSkills: ["TypeScript"],
  hoursPerWeek: 6,
};

const rawStep = (skill: string, extra: Partial<Record<string, unknown>> = {}) => ({
  skill,
  priority: "required",
  currentLevel: "basic",
  targetLevel: "intermediate",
  reason: `A vaga pede ${skill}.`,
  prerequisites: [],
  topics: ["Fundamentos"],
  hoursMin: 10,
  hoursMax: 20,
  practiceProject: "Construir um app pequeno.",
  doneCriteria: ["Consigo explicar os conceitos."],
  searchTerms: [`${skill} tutorial`],
  ...extra,
});

const VALID_RAW_PATH = {
  summary: "Comece por React aproveitando sua base em Vue.",
  steps: [
    rawStep("GraphQL", { priority: "nice_to_have", prerequisites: ["React"] }),
    rawStep("React", { currentLevel: "basic" }),
  ],
  experienceGaps: [
    { gap: "5 anos de experiência", reason: "A vaga pede tempo de mercado.", evidenceIdeas: ["Projetos open source"] },
  ],
};

const startExpressServer = async (expressApp: express.Express): Promise<{ server: Server; baseUrl: string }> =>
  new Promise((resolve) => {
    const server = expressApp.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });

const closeServer = async (server: Server): Promise<void> =>
  new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

describe("cvMatch — classificação das lacunas na análise", () => {
  it("normaliza gapDetails com enums válidos, deduplica e cai em padrões seguros", () => {
    const gaps = normalizeGapDetails(
      [
        { skill: "Kubernetes", status: "partial", priority: "nice_to_have", kind: "learnable" },
        { skill: "kubernetes", status: "missing" },
        { skill: "Senioridade sênior", status: "weird", priority: "x", kind: "experience" },
        "lixo",
      ],
      ["Kubernetes", "AWS"],
    );
    expect(gaps).toEqual([
      { skill: "Kubernetes", status: "partial", priority: "nice_to_have", kind: "learnable" },
      { skill: "Senioridade sênior", status: "missing", priority: "required", kind: "experience" },
      { skill: "AWS", status: "missing", priority: "required", kind: "learnable" },
    ]);
  });

  it("pede vivência como lacuna e nomes de lacunas em português, exceto tecnologias (#39)", () => {
    const res = validateCvMatchRequest(baseBody);
    if (!res.ok) throw new Error("payload deveria ser válido");
    const { system } = buildCvMatchMessages(res.value);
    expect(system).toContain("tempo mínimo de experiência");
    expect(system).toContain("Escreva os nomes das lacunas em português do Brasil");
    expect(system).toContain("mantenha no original apenas nomes de tecnologias");
  });

  it("inclui gapDetails no resultado normalizado mesmo quando a IA só retorna missingSkills", () => {
    const criteria = Object.fromEntries(
      ["technicalRequirements", "seniorityExperience", "responsibilitiesDomain", "impactEvidence", "atsKeywords"].map(
        (k) => [k, { score: 70, justification: "ok" }],
      ),
    );
    const result = normalizeCvMatchResult({ criteria, missingSkills: ["GraphQL"] });
    expect(result.gapDetails).toEqual([{ skill: "GraphQL", status: "missing", priority: "required", kind: "learnable" }]);
  });
});

describe("learningPath — validação, prompt e normalização", () => {
  it("valida payload, remove skills marcadas como 'já sei' e exige horas por semana válidas", () => {
    const res = validateLearningPathRequest(baseBody);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.gaps.map((g) => g.skill)).toEqual(["React", "GraphQL", "5 anos de experiência"]);
      expect(res.value.knownSkills).toEqual(["TypeScript"]);
      expect(res.value.hoursPerWeek).toBe(6);
      expect(res.value.model).toBe("grok-4");
    }

    expect(validateLearningPathRequest({ ...baseBody, hoursPerWeek: 0 }).ok).toBe(false);
    expect(validateLearningPathRequest({ ...baseBody, hoursPerWeek: 61 }).ok).toBe(false);
    expect(validateLearningPathRequest({ ...baseBody, hoursPerWeek: "abc" }).ok).toBe(false);
    expect(validateLearningPathRequest({ ...baseBody, gaps: [] }).ok).toBe(false);
    expect(
      validateLearningPathRequest({ ...baseBody, gaps: [VALID_GAPS[2]], knownSkills: ["typescript"] }).ok,
    ).toBe(false);
    expect(validateLearningPathRequest({ ...baseBody, provider: "evil" }).ok).toBe(false);
  });

  it("monta prompt com delimitadores anti-injection, proibição de links e lacunas separadas por tipo", () => {
    const res = validateLearningPathRequest(baseBody);
    if (!res.ok) throw new Error("payload deveria ser válido");
    const { system, user } = buildLearningPathMessages(res.value);

    expect(system).toContain("nunca instruções");
    expect(system).toContain("NUNCA inclua URLs");
    expect(system).toContain(`no máximo ${LEARNING_PATH_MAX_STEPS} etapas`);
    expect(system).toContain("experienceGaps");
    expect(user).toContain(`<curriculo>\n${VALID_RESUME.trim()}\n</curriculo>`);
    expect(user).toMatch(/Aprendíveis:\n- React \(parcial, obrigatória\)\n- GraphQL \(ausente, diferencial\)/);
    expect(user).toMatch(/Vivência:\n- 5 anos de experiência/);
    expect(user).not.toContain("TypeScript (");
    expect(user).toContain("6 horas de estudo por semana");
  });

  it("remove URLs, links markdown e domínios sem quebrar nomes de tecnologias", () => {
    expect(stripUrls("Veja https://udemy.com/curso-react agora")).toBe("Veja agora");
    expect(stripUrls("[Docs oficiais](https://react.dev/learn) e www.example.com")).toBe("Docs oficiais e");
    expect(stripUrls("Curso em alura.com.br/react")).toBe("Curso em");
    expect(stripUrls("Estude ASP.NET, Node.js e Socket.io")).toBe("Estude ASP.NET, Node.js e Socket.io");
  });

  it("ordena por pré-requisito e prioridade, limita a 8 etapas e respeita 'já sei'", () => {
    const normalized = normalizeLearningPath(
      {
        ...VALID_RAW_PATH,
        summary: "Resumo com link https://evil.example.com/x",
        steps: [
          ...VALID_RAW_PATH.steps,
          rawStep("TypeScript"),
          rawStep("Testes", { hoursMin: 30, hoursMax: 5, searchTerms: ["https://youtube.com/watch?v=1", "testes react"] }),
          ...Array.from({ length: 8 }, (_, i) => rawStep(`Extra ${i}`, { priority: "nice_to_have" })),
        ],
      },
      { knownSkills: ["TypeScript"], job: VALID_JOB },
    );

    expect(normalized.steps).toHaveLength(LEARNING_PATH_MAX_STEPS);
    const skills = normalized.steps.map((s) => s.skill);
    expect(skills).not.toContain("TypeScript");
    expect(skills.indexOf("React")).toBeLessThan(skills.indexOf("GraphQL"));
    expect(skills[0]).toBe("React");
    const testes = normalized.steps.find((s) => s.skill === "Testes");
    expect(testes).toMatchObject({ hoursMin: 5, hoursMax: 30, searchTerms: ["testes react"] });
    expect(normalized.summary).not.toMatch(/https?:|example\.com/);
    expect(JSON.stringify(normalized)).not.toMatch(/https?:\/\//);
    expect(normalized.experienceGaps[0].gap).toBe("5 anos de experiência");
    expect(normalized.limitedDescription).toBe(false);
  });

  it("sinaliza vaga com pouca descrição e falha quando não há etapas nem lacunas de vivência", () => {
    const limited = normalizeLearningPath(VALID_RAW_PATH, { knownSkills: [], job: { description: "Curta." } });
    expect(limited.limitedDescription).toBe(true);
    expect(() => normalizeLearningPath({ steps: [], experienceGaps: [] }, { knownSkills: [], job: VALID_JOB })).toThrowError(
      CvMatchError,
    );
    expect(() => normalizeLearningPath("nada", { knownSkills: [], job: VALID_JOB })).toThrowError(CvMatchError);
  });

  it("ignora ciclos de pré-requisito sem perder etapas", () => {
    const a = rawStep("A", { prerequisites: ["B"] }) as unknown as LearningPathStep;
    const b = rawStep("B", { prerequisites: ["A"] }) as unknown as LearningPathStep;
    expect(orderSteps([a, b]).map((s) => s.skill).sort()).toEqual(["A", "B"]);
  });
});

describe("learningPath — cobertura das lacunas enviadas (#39)", () => {
  const gap = (skill: string, priority: "required" | "nice_to_have" = "required", kind: "learnable" | "experience" = "learnable") =>
    ({ skill, status: "missing", priority, kind }) as const;
  const ctx = (gaps: ReturnType<typeof gap>[], knownSkills: string[] = []) => ({ knownSkills, job: VALID_JOB, gaps: [...gaps] });

  it("compara nomes divergentes: acentos, caixa, siglas entre parênteses, abreviações e sem relação", () => {
    expect(gapNameScore("kubernetes", "Kubernetes (K8s)")).toBe(2);
    expect(gapNameScore("Provisionamento de infra", "Provisionamento de infraestrutura")).toBe(2);
    expect(gapNameScore("Comunicacao", "Comunicação")).toBe(3);
    expect(gapNameScore("Testes automatizados com Jest", "Testes automatizados")).toBe(2);
    expect(gapNameScore("Node.js", "node.js")).toBe(3);
    expect(gapNameScore("Java", "JavaScript")).toBe(0);
    expect(gapNameScore("C#", "C++")).toBe(0);
    expect(gapNameScore("Go", "Google Cloud")).toBe(0);
    expect(gapNameScore("Terraform", "Provisionamento de infraestrutura")).toBe(0);
  });

  it("diferenciais omitidos pela IA (6 etapas para 9 lacunas) vão para 'Para depois' com a prioridade original", () => {
    const sent = [
      gap("React"),
      gap("TypeScript"),
      gap("Testes automatizados"),
      gap("Docker", "nice_to_have"),
      gap("Kubernetes (K8s)", "nice_to_have"),
      gap("Terraform", "nice_to_have"),
      gap("GraphQL", "nice_to_have"),
      gap("Observabilidade", "nice_to_have"),
      gap("Mensageria", "nice_to_have"),
    ];
    const path = normalizeLearningPath(
      {
        summary: "Trilha.",
        steps: [
          // IA inverte prioridades e devolve nomes diferentes dos enviados
          rawStep("react", { priority: "nice_to_have" }),
          rawStep("Typescript"),
          rawStep("Testes automatizados com Jest"),
          rawStep("Docker", { priority: "required" }),
          rawStep("Kubernetes", { priority: "required", prerequisites: ["docker"] }),
          rawStep("GraphQL"),
        ],
        experienceGaps: [],
      },
      ctx(sent),
    );

    expect(path.steps.map((s) => s.skill)).toEqual([
      "React",
      "TypeScript",
      "Testes automatizados",
      "Docker",
      "Kubernetes (K8s)",
      "GraphQL",
    ]);
    expect(path.steps.find((s) => s.skill === "React")?.priority).toBe("required");
    expect(path.steps.find((s) => s.skill === "Docker")?.priority).toBe("nice_to_have");
    expect(path.steps.find((s) => s.skill === "GraphQL")?.priority).toBe("nice_to_have");
    expect(path.steps.find((s) => s.skill === "Kubernetes (K8s)")?.prerequisites).toEqual(["Docker"]);
    expect(path.deferredGaps).toEqual([
      { skill: "Terraform", status: "missing", priority: "nice_to_have", reason: "omitted" },
      { skill: "Observabilidade", status: "missing", priority: "nice_to_have", reason: "omitted" },
      { skill: "Mensageria", status: "missing", priority: "nice_to_have", reason: "omitted" },
    ]);
  });

  it("lacunas além do limite de etapas também vão para 'Para depois', obrigatórias primeiro", () => {
    const sent = Array.from({ length: 10 }, (_, i) => gap(`Tecnologia ${String.fromCharCode(65 + i)}`, i < 9 ? "nice_to_have" : "required"));
    const path = normalizeLearningPath(
      { summary: "", steps: sent.map((g) => rawStep(g.skill)), experienceGaps: [] },
      ctx(sent),
    );
    expect(path.steps).toHaveLength(LEARNING_PATH_MAX_STEPS);
    expect(path.steps[0].skill).toBe("Tecnologia J");
    expect(path.deferredGaps?.map((g) => [g.skill, g.reason])).toEqual([
      ["Tecnologia H", "step_limit"],
      ["Tecnologia I", "step_limit"],
    ]);
  });

  it("vivência omitida é incluída sem inventar motivo nem ideias; nome da IA é trocado pelo enviado", () => {
    const sent = [gap("React"), gap("5 anos de experiência", "required", "experience"), gap("Liderança técnica", "nice_to_have", "experience")];
    const path = normalizeLearningPath(
      {
        summary: "",
        steps: [rawStep("React")],
        experienceGaps: [
          { gap: "5 anos de experiencia", reason: "A vaga pede tempo de mercado.", evidenceIdeas: ["Open source"] },
          { gap: "Inglês fluente", reason: "Inventado pela IA.", evidenceIdeas: ["Curso"] },
        ],
      },
      ctx(sent),
    );
    expect(path.experienceGaps).toEqual([
      { gap: "5 anos de experiência", reason: "A vaga pede tempo de mercado.", evidenceIdeas: ["Open source"], detailed: true },
      { gap: "Liderança técnica", reason: "", evidenceIdeas: [], detailed: false },
    ]);
  });

  it("etapas sobrepostas para a mesma lacuna viram uma só, e etapas fora da lista são descartadas", () => {
    const sent = [gap("Provisionamento de infraestrutura"), gap("Terraform", "nice_to_have")];
    const path = normalizeLearningPath(
      {
        summary: "",
        steps: [
          rawStep("Provisionamento de infra", { topics: ["IaC"], hoursMin: 10, hoursMax: 20 }),
          rawStep("Terraform", { topics: ["Módulos"], prerequisites: ["Provisionamento de infra"] }),
          rawStep("Provisionamento de infraestrutura na nuvem", { topics: ["IaC", "Redes"], hoursMin: 30, hoursMax: 40 }),
          rawStep("Rust", { topics: ["Ownership"] }),
        ],
        experienceGaps: [],
      },
      ctx(sent),
    );
    expect(path.steps.map((s) => s.skill)).toEqual(["Provisionamento de infraestrutura", "Terraform"]);
    expect(path.steps[0]).toMatchObject({ topics: ["IaC", "Redes"], hoursMin: 10, hoursMax: 20 });
    expect(path.steps[1].prerequisites).toEqual(["Provisionamento de infraestrutura"]);
    expect(path.deferredGaps).toEqual([]);
  });

  it("resposta cortada no meio (só parte das etapas) mantém as demais lacunas visíveis", () => {
    const sent = [gap("React"), gap("TypeScript"), gap("GraphQL", "nice_to_have"), gap("3 anos de experiência", "required", "experience")];
    const path = normalizeLearningPath({ summary: "Trilha", steps: [rawStep("React")] }, ctx(sent));
    expect(path.steps.map((s) => s.skill)).toEqual(["React"]);
    expect(path.deferredGaps?.map((g) => g.skill)).toEqual(["TypeScript", "GraphQL"]);
    expect(path.experienceGaps).toEqual([{ gap: "3 anos de experiência", reason: "", evidenceIdeas: [], detailed: false }]);
  });

  it("falha quando a IA não devolve nenhuma etapa nem vivência detalhada, mesmo com lacunas enviadas", () => {
    expect(() =>
      normalizeLearningPath({ summary: "x", steps: [rawStep("Rust")], experienceGaps: [] }, ctx([gap("React"), gap("1 ano", "required", "experience")])),
    ).toThrowError(CvMatchError);
  });

  it("pede no prompt nomes exatos das lacunas e nomes em português, exceto tecnologias", () => {
    const res = validateLearningPathRequest(baseBody);
    if (!res.ok) throw new Error("payload deveria ser válido");
    const { system } = buildLearningPathMessages(res.value);
    expect(system).toContain("exatamente o nome da lacuna como foi enviado");
    expect(system).toContain('usando em "gap" exatamente o nome enviado');
    expect(system).toContain("Nomes de tecnologias, linguagens, ferramentas e plataformas ficam no original");
  });
});

describe("learningPath — rota Express (/api/cv-match/learning-path)", () => {
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
      "/api/cv-match/learning-path",
      createLearningPathHandler({
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

  const post = (url: string, headers: Record<string, string>, body: unknown) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

  it("exige login no app principal (401)", async () => {
    const res = await post(`${realAppUrl}/api/cv-match/learning-path`, { "x-llm-api-key": "xai-key-123456" }, baseBody);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("unauthorized");
  });

  it("valida chave e payload, retorna trilha normalizada sem links, trata erro do provedor e aplica rate limit", async () => {
    const trust = { "x-trust-token": "valid-trust" };

    const missingKey = await post(`${handlerUrl}/api/cv-match/learning-path`, trust, baseBody);
    expect(missingKey.status).toBe(400);
    expect(((await missingKey.json()) as { code: string }).code).toBe("missing_api_key");

    const auth = { ...trust, "x-llm-api-key": "xai-valid-key-123" };
    const invalid = await post(`${handlerUrl}/api/cv-match/learning-path`, auth, { ...baseBody, hoursPerWeek: 0 });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { code: string }).code).toBe("invalid_request");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ...VALID_RAW_PATH,
                  steps: [rawStep("React", { topics: ["Hooks — veja https://react.dev"] })],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const ok = await post(`${handlerUrl}/api/cv-match/learning-path`, auth, baseBody);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const okBody = (await ok.json()) as { learningPath: { steps: { topics: string[] }[] }; provider: string };
    expect(okBody.provider).toBe("xai");
    expect(okBody.learningPath.steps[0].topics[0]).toBe("Hooks — veja");

    const upstreamCall = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(String((upstreamCall[1] as RequestInit).body)) as { messages: { content: string }[] };
    expect(sentBody.messages[1].content).toContain("<lacunas>");

    const okPath = okBody.learningPath as unknown as {
      deferredGaps: { skill: string }[];
      experienceGaps: { gap: string; detailed: boolean }[];
    };
    // TypeScript foi marcado como "já sei"; GraphQL foi omitido pela IA e vai para "Para depois".
    expect(okPath.deferredGaps.map((g) => g.skill)).toEqual(["GraphQL"]);
    expect(okPath.experienceGaps).toEqual([expect.objectContaining({ gap: "5 anos de experiência", detailed: true })]);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid api key" }), { status: 401 }));
    const badKey = await post(`${handlerUrl}/api/cv-match/learning-path`, auth, baseBody);
    expect(badKey.status).toBe(401);
    expect(((await badKey.json()) as { code: string }).code).toBe("invalid_api_key");

    const limited = await post(`${handlerUrl}/api/cv-match/learning-path`, auth, baseBody);
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as { code: string }).code).toBe("rate_limited");
  });

  it("recusa resposta cortada pelo limite de tokens (finish_reason: length) em vez de exibir trilha incompleta", async () => {
    const truncatedApp = express();
    truncatedApp.use(express.json({ limit: "256kb" }));
    const truncatedFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "length", message: { content: JSON.stringify({ summary: "x", steps: [rawStep("React")] }) } }],
        }),
        { status: 200 },
      ),
    );
    truncatedApp.post(
      "/api/cv-match/learning-path",
      createLearningPathHandler({
        verifyTrust: () => ({ valid: true, username: "ApenasGabs" }),
        rateLimit: () => true,
        fetchImpl: truncatedFetch,
      }),
    );
    const { server, baseUrl } = await startExpressServer(truncatedApp);
    try {
      const res = await post(`${baseUrl}/api/cv-match/learning-path`, { "x-trust-token": "t", "x-llm-api-key": "xai-valid-key-123" }, baseBody);
      expect(res.status).toBe(502);
      expect(((await res.json()) as { code: string }).code).toBe("llm_truncated");
    } finally {
      await closeServer(server);
    }
  });
});
