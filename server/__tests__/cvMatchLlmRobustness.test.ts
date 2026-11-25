// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { callLlmProvider, normalizeGapDetails, type LlmProviderId } from "../../api/_lib/cvMatch.ts";
import { stripUrls } from "../../api/_lib/learningPath.ts";

const messages = { system: "s", user: "u" };
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const openAiBody = (finishReason: string) => ({
  choices: [{ finish_reason: finishReason, message: { content: '{"ok":true}' } }],
});

const sentBody = async (provider: LlmProviderId, model: string): Promise<Record<string, unknown>> => {
  const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => jsonResponse(openAiBody("stop")));
  await callLlmProvider({ provider, model, apiKey: "test-key", messages, fetchImpl });
  return JSON.parse(String(fetchImpl.mock.calls[0][1].body));
};

describe("cvMatch — robustez com provedores reais", () => {
  it("usa reasoning_effort low somente no gpt-oss da Groq", async () => {
    expect((await sentBody("groq", "openai/gpt-oss-20b")).reasoning_effort).toBe("low");
    expect(await sentBody("groq", "llama-3.1-8b-instant")).not.toHaveProperty("reasoning_effort");
    expect(await sentBody("openai", "gpt-5-mini")).not.toHaveProperty("reasoning_effort");
  });

  it("rejeita resposta cortada mesmo quando o JSON é válido", async () => {
    await expect(
      callLlmProvider({
        provider: "groq",
        model: "openai/gpt-oss-20b",
        apiKey: "test-key",
        messages,
        fetchImpl: async () => jsonResponse(openAiBody("length")),
      }),
    ).rejects.toMatchObject({ status: 502, code: "llm_truncated" });

    await expect(
      callLlmProvider({
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        apiKey: "test-key",
        messages,
        fetchImpl: async () => jsonResponse({ stop_reason: "max_tokens", content: [{ type: "text", text: "{}" }] }),
      }),
    ).rejects.toMatchObject({ status: 502, code: "llm_truncated" });
  });

  it("explica quando a requisição excede o limite do provedor (413)", async () => {
    await expect(
      callLlmProvider({
        provider: "groq",
        model: "openai/gpt-oss-20b",
        apiKey: "test-key",
        messages,
        fetchImpl: async () => jsonResponse({ error: { message: "Request too large" } }, 413),
      }),
    ).rejects.toMatchObject({ status: 413, code: "llm_request_too_large" });
  });

  it("preserva nomes iniciados por ponto ao limpar URLs", () => {
    expect(stripUrls("API com .NET e arquivos .tsx")).toBe("API com .NET e arquivos .tsx");
    expect(stripUrls("Veja https://site.com/x , depois pratique")).toBe("Veja, depois pratique");
  });

  it("trata itens da stack como aprendíveis e preserva vivência real", () => {
    const gaps = normalizeGapDetails(
      [
        { skill: "Kubernetes", kind: "experience" },
        { skill: "5 anos de experiência", kind: "experience" },
      ],
      [],
      [" kubernetes "],
    );
    expect(gaps.map((g) => g.kind)).toEqual(["learnable", "experience"]);
  });
});
