import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyService } from "../companyService";

describe("CompanyService", () => {
  let service: CompanyService;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    service = new CompanyService();
  });

  it("deve buscar e encontrar empresas no catálogo local quando offline", async () => {
    const { matches } = await service.searchCompanies("Cielo");
    expect(matches.length).toBeGreaterThan(0);
    const cielo = matches.find((m) => m.name.toLowerCase().includes("cielo"));
    expect(cielo).toBeDefined();
    expect(cielo?.ats).toBe("GUPY");
  });

  it("deve identificar se a empresa está monitorada com exactMatch", async () => {
    const result = await service.searchCompanies("Cielo");
    expect(result.exactMatch).toBeDefined();
    expect(result.isMonitored).toBe(true);
  });

  it("deve retornar isMonitored false para empresa inexistente", async () => {
    const result = await service.searchCompanies("EmpresaTotalmenteInexistenteXYZ123");
    expect(result.exactMatch).toBeNull();
    expect(result.isMonitored).toBe(false);
  });

  it("deve rejeitar sugestão sem nome ou link", async () => {
    await expect(
      service.suggestCompany({ name: "", careerUrl: "https://empresa.com" }),
    ).rejects.toThrow("O nome da empresa é obrigatório.");

    await expect(
      service.suggestCompany({ name: "Empresa", careerUrl: "" }),
    ).rejects.toThrow("O link de carreiras da empresa é obrigatório.");
  });

  it("deve registrar sugestão comunitária e detectar ATS automaticamente", async () => {
    const created = await service.suggestCompany({
      name: "Empresa Inovadora",
      careerUrl: "https://inovadora.gupy.io",
      suggestedBy: "DevComunidade",
      notes: "Contratando muito em React",
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Empresa Inovadora");
    expect(created.ats).toBe("GUPY");
    expect(created.status).toBe("SUGGESTED");
    expect(created.votesCount).toBe(1);

    // Deve aparecer na busca local
    const { matches } = await service.searchCompanies("Inovadora");
    const found = matches.find((m) => m.name === "Empresa Inovadora");
    expect(found).toBeDefined();
  });

  it("deve permitir apoiar uma sugestão e impedir voto duplicado local", async () => {
    const created = await service.suggestCompany({
      name: "Votada Corp",
      careerUrl: "https://jobs.ashbyhq.com/votada",
    });

    expect(service.hasUserVoted(created.id)).toBe(false);

    const newVotes = await service.upvoteSuggestion(created.id);
    expect(newVotes).toBeGreaterThanOrEqual(1);
    expect(service.hasUserVoted(created.id)).toBe(true);

    // Segundo voto deve ser prevenido
    const secondVote = await service.upvoteSuggestion(created.id);
    expect(secondVote).toBe(-1);
  });
});
