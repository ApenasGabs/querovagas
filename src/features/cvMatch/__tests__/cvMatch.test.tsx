import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../../../types/job";
import { JobModal } from "../../jobs/components/JobModal";
import { CvMatchModal } from "../components/CvMatchModal";
import { LLM_KEY_STORAGE_KEY, useLlmSettings } from "../hooks/useLlmSettings";
import { normalizeResumeText, validateResumeFile } from "../utils/extractPdfText";

const SAMPLE_JOB: Job = {
  id: "job-1",
  title: "Engenheiro de Software Pleno",
  company: "QueroVagas",
  location: "São Paulo, SP",
  workModel: "REMOTO",
  seniorityLevel: "PLENO",
  contractType: "CLT",
  stack: ["React", "TypeScript"],
  url: "https://example.com/vaga/1",
  source: "GUPY",
  scrapedAt: "2026-11-20T12:00:00Z",
  description: "Experiência sólida com React, TypeScript e testes.",
};

const VALID_RESUME = "Desenvolvedora React e TypeScript com experiência em aplicações acessíveis, Vite, Tailwind, Vitest e integração com APIs REST. ".repeat(3);

describe("cvMatch frontend — utilitários, BYOK storage e modal", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("valida tipo, vazio e tamanho máximo do PDF e normaliza texto", () => {
    const txt = new File(["hello"], "cv.txt", { type: "text/plain" });
    expect(validateResumeFile(txt)).toBe("invalid_type");

    const emptyPdf = new File([], "cv.pdf", { type: "application/pdf" });
    expect(validateResumeFile(emptyPdf)).toBe("empty_file");

    const bigPdf = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" });
    expect(validateResumeFile(bigPdf)).toBe("file_too_large");

    const validPdf = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    expect(validateResumeFile(validPdf)).toBeNull();

    expect(normalizeResumeText("Linha 1 \u00a0\t  aqui\r\n\r\n\r\nLinha 2  ")).toBe("Linha 1 aqui\n\nLinha 2");
  });

  it("gerencia chave BYOK em sessionStorage por padrão e localStorage apenas com opt-in", () => {
    const { result } = renderHook(() => useLlmSettings());

    expect(result.current.settings.provider).toBe("xai");
    expect(result.current.settings.rememberKey).toBe(false);

    act(() => {
      result.current.setApiKey("xai-session-key-123");
    });
    expect(sessionStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBe("xai-session-key-123");
    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBeNull();

    act(() => {
      result.current.setRememberKey(true);
    });
    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBe("xai-session-key-123");
    expect(sessionStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBeNull();

    act(() => {
      result.current.forgetKey();
    });
    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBeNull();
    expect(result.current.settings.apiKey).toBe("");
  });

  it("limpa chaves de todos os provedores do localStorage ao desativar rememberKey", () => {
    const { result } = renderHook(() => useLlmSettings());

    act(() => {
      result.current.setRememberKey(true);
    });
    act(() => {
      result.current.setApiKey("xai-remembered-123");
    });
    act(() => {
      result.current.setProvider("openai");
    });
    act(() => {
      result.current.setApiKey("sk-openai-remembered-456");
    });

    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBe("xai-remembered-123");
    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:openai`)).toBe("sk-openai-remembered-456");

    act(() => {
      result.current.setRememberKey(false);
    });

    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBeNull();
    expect(localStorage.getItem(`${LLM_KEY_STORAGE_KEY}:openai`)).toBeNull();
    expect(sessionStorage.getItem(`${LLM_KEY_STORAGE_KEY}:xai`)).toBe("xai-remembered-123");
    expect(sessionStorage.getItem(`${LLM_KEY_STORAGE_KEY}:openai`)).toBe("sk-openai-remembered-456");
  });

  it("envia análise pelo modal e renderiza resultado completo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: "xai",
          model: "grok-4",
          result: {
            score: 84,
            tier: "high",
            tierLabel: "Alta compatibilidade",
            criteria: [
              {
                key: "technicalRequirements",
                label: "Requisitos técnicos e stack",
                weight: 0.35,
                score: 90,
                justification: "Atende React e TypeScript.",
              },
            ],
            matchedSkills: ["React", "TypeScript"],
            missingSkills: ["GraphQL"],
            strengths: ["Experiência direta em React"],
            gaps: ["Poucos números de impacto"],
            suggestions: [{ section: "Resumo", suggestion: "Destacar projetos em React." }],
            rewrittenBullets: [{ original: "Fiz frontend", rewritten: "Desenvolvi UIs em React." }],
            summary: "Perfil muito aderente.",
            verdict: "Pode aplicar imediatamente.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<CvMatchModal job={SAMPLE_JOB} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: /Colar texto/i }));
    fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
    fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-key-12345" } });

    const submitButton = screen.getByRole("button", { name: /Analisar compatibilidade/i });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId("cv-match-result")).toBeInTheDocument();
    });
    expect(screen.getByText("Alta compatibilidade")).toBeInTheDocument();
    expect(screen.getByText("Perfil muito aderente.")).toBeInTheDocument();
    expect(screen.getByText("Pode aplicar imediatamente.")).toBeInTheDocument();
  });

  it("exibe erro claro quando o provedor recusa a chave (401) e abre via JobModal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Chave de API recusada pelo provedor xAI (Grok). Verifique a chave.",
          code: "invalid_api_key",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<JobModal job={SAMPLE_JOB} onClose={vi.fn()} />);

    const openBtn = screen.getByRole("button", { name: /Analisar meu currículo/i });
    fireEvent.click(openBtn);

    const textTab = await screen.findByRole("tab", { name: /Colar texto/i });
    fireEvent.click(textTab);
    fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
    fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-invalid-123" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar compatibilidade/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Chave de API recusada/i);
    });
  });

  it("não aborta requisição em andamento quando o componente pai re-renderiza com novo onClose", async () => {
    let resolveFetch!: (res: Response) => void;
    let capturedSignal: AbortSignal | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementationOnce((_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    const Wrapper = () => {
      const [ticks, setTicks] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setTicks((t) => t + 1)}>
            Rerender {ticks}
          </button>
          <CvMatchModal job={SAMPLE_JOB} onClose={() => {}} />
        </div>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole("tab", { name: /Colar texto/i }));
    fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
    fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-key-12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar compatibilidade/i }));

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    // Força re-render do pai com nova identidade de função onClose
    fireEvent.click(screen.getByRole("button", { name: /Rerender 0/i }));
    expect(capturedSignal?.aborted).toBe(false);

    resolveFetch(
      new Response(
        JSON.stringify({
          provider: "xai",
          model: "grok-4",
          result: {
            score: 82,
            tier: "high",
            tierLabel: "Alta compatibilidade",
            criteria: [
              {
                key: "technicalRequirements",
                label: "Requisitos técnicos e stack",
                weight: 0.35,
                score: 85,
                justification: "Bom alinhamento.",
              },
            ],
            matchedSkills: ["React"],
            missingSkills: [],
            strengths: ["React"],
            gaps: [],
            suggestions: [],
            rewrittenBullets: [],
            summary: "Ótima aderência.",
            verdict: "Aplicar.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId("cv-match-result")).toBeInTheDocument();
    });
  });

  it("rejeita resposta HTTP 200 com payload malformado no frontend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    render(<CvMatchModal job={SAMPLE_JOB} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: /Colar texto/i }));
    fireEvent.change(screen.getByLabelText(/Cole o texto do currículo/i), { target: { value: VALID_RESUME } });
    fireEvent.change(screen.getByLabelText(/Chave de API/i), { target: { value: "xai-key-12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar compatibilidade/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Resposta inesperada do servidor/i);
    });
  });
});
