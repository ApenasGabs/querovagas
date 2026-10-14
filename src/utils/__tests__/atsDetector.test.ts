import { describe, expect, it } from "vitest";
import { detectATS } from "../atsDetector";

describe("detectATS", () => {
  it("deve detectar plataforma Gupy a partir de subdomínio", () => {
    const result = detectATS("https://nubank.gupy.io");
    expect(result.ats).toBe("GUPY");
    expect(result.isKnownATS).toBe(true);
    expect(result.platformName).toBe("Gupy");
    expect(result.cleanUrl).toBe("https://nubank.gupy.io");
  });

  it("deve adicionar https caso falte protocolo", () => {
    const result = detectATS("jobs.ashbyhq.com/decagon");
    expect(result.ats).toBe("ASHBY");
    expect(result.cleanUrl).toBe("https://jobs.ashbyhq.com/decagon");
    expect(result.isKnownATS).toBe(true);
  });

  it("deve detectar Greenhouse", () => {
    const result = detectATS("https://boards.greenhouse.io/robinhood");
    expect(result.ats).toBe("GREENHOUSE");
    expect(result.isKnownATS).toBe(true);
  });

  it("deve detectar Lever", () => {
    const result = detectATS("https://jobs.lever.co/shieldai");
    expect(result.ats).toBe("LEVER");
    expect(result.isKnownATS).toBe(true);
  });

  it("deve detectar Workable", () => {
    const result = detectATS("https://apply.workable.com/weekday-1");
    expect(result.ats).toBe("WORKABLE");
    expect(result.isKnownATS).toBe(true);
  });

  it("deve detectar InHire", () => {
    const result = detectATS("https://app.inhire.app/vagas");
    expect(result.ats).toBe("INHIRE");
    expect(result.isKnownATS).toBe(true);
  });

  it("deve retornar OUTRO para plataformas genéricas ou domínios próprios", () => {
    const result = detectATS("https://empresa.com.br/carreiras");
    expect(result.ats).toBe("OUTRO");
    expect(result.isKnownATS).toBe(false);
  });

  it("deve tratar string vazia adequadamente", () => {
    const result = detectATS("");
    expect(result.ats).toBe("OUTRO");
    expect(result.cleanUrl).toBe("");
    expect(result.isKnownATS).toBe(false);
  });
});
