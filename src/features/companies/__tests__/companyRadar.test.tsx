import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyCard } from "../components/CompanyCard";
import { CompanyRadarModal } from "../components/CompanyRadarModal";
import { CompanySuggestionForm } from "../components/CompanySuggestionForm";
import type { Company } from "../../../types/company";

const mockCompany: Company = {
  id: "comp-cielo",
  name: "Cielo",
  slug: "cielo",
  ats: "GUPY",
  careerUrl: "https://cielo.gupy.io",
  status: "MONITORED",
  activeJobsCount: 15,
};

const mockSuggestedCompany: Company = {
  id: "sug-123",
  name: "Startup XYZ",
  slug: "startup-xyz",
  ats: "ASHBY",
  careerUrl: "https://jobs.ashbyhq.com/startup-xyz",
  status: "SUGGESTED",
  votesCount: 3,
  suggestedBy: "Comunidade",
  notes: "Ótimas vagas remotas",
};

describe("CompanyCard", () => {
  it("deve renderizar dados de empresa monitorada corretamente", () => {
    const handleViewJobs = vi.fn();
    render(
      <CompanyCard company={mockCompany} onViewJobs={handleViewJobs} />,
    );

    expect(screen.getByText("Cielo")).toBeInTheDocument();
    expect(screen.getByText("GUPY")).toBeInTheDocument();
    expect(screen.getByText("Monitorada")).toBeInTheDocument();
    expect(screen.getByText("15 vagas")).toBeInTheDocument();

    const viewButton = screen.getByRole("button", { name: /Ver Vagas/i });
    fireEvent.click(viewButton);
    expect(handleViewJobs).toHaveBeenCalledWith("Cielo");
  });

  it("deve renderizar empresa sugerida com botão de apoio (+1 Apoiar)", () => {
    const handleUpvote = vi.fn();
    render(
      <CompanyCard
        company={mockSuggestedCompany}
        hasVoted={false}
        onUpvote={handleUpvote}
      />,
    );

    expect(screen.getByText("Startup XYZ")).toBeInTheDocument();
    expect(screen.getByText("Sugerida")).toBeInTheDocument();
    expect(screen.getByText(/Ótimas vagas remotas/i)).toBeInTheDocument();

    const upvoteButton = screen.getByRole("button", { name: /\+1 Apoiar/i });
    fireEvent.click(upvoteButton);
    expect(handleUpvote).toHaveBeenCalledWith("sug-123");
  });
});

describe("CompanySuggestionForm", () => {
  it("deve detectar plataforma ATS automaticamente ao digitar a URL", async () => {
    const handleSuccess = vi.fn();
    render(<CompanySuggestionForm onSuccess={handleSuccess} />);

    const urlInput = screen.getByPlaceholderText(/empresa\.gupy\.io/i);
    fireEvent.change(urlInput, { target: { value: "https://nubank.gupy.io" } });

    await waitFor(() => {
      expect(screen.getByText(/Plataforma detectada: Gupy/i)).toBeInTheDocument();
    });
  });

  it("deve exigir preenchimento de campos obrigatórios", async () => {
    const handleSuccess = vi.fn();
    render(<CompanySuggestionForm onSuccess={handleSuccess} />);

    const submitBtn = screen.getByRole("button", { name: /Enviar para a Comunidade/i });
    expect(submitBtn).toBeDisabled();
  });
});

describe("CompanyRadarModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("não deve renderizar nada quando isOpen é false", () => {
    const { container } = render(
      <CompanyRadarModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar modal com abas quando isOpen é true", () => {
    render(<CompanyRadarModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Radar de Empresas & Comunidade/i)).toBeInTheDocument();
    expect(screen.getByText("Pesquisar Empresas")).toBeInTheDocument();
    expect(screen.getByText("Sugerir Empresa")).toBeInTheDocument();
    expect(screen.getByText("Mural Comunitário")).toBeInTheDocument();
    expect(screen.getByText("Discussões (DevPedia)")).toBeInTheDocument();
  });

  it("deve navegar entre abas ao clicar", () => {
    render(<CompanyRadarModal isOpen={true} onClose={vi.fn()} />);

    const suggestTab = screen.getByRole("button", { name: /Sugerir Empresa/i });
    fireEvent.click(suggestTab);

    expect(screen.getByText(/Sugerir Nova Empresa para o Crawler/i)).toBeInTheDocument();
  });

  it("deve priorizar a aba de busca por padrão mesmo quando inline é true", () => {
    render(<CompanyRadarModal isOpen={true} inline={true} onClose={vi.fn()} />);

    // Campo de busca deve estar visível e ativo por padrão
    expect(
      screen.getByPlaceholderText(/Digite o nome de uma empresa/i),
    ).toBeInTheDocument();
  });

  it("deve conter Agibank cadastrado com ATS Greenhouse no catálogo monitorado", async () => {
    const { initialMonitoredCompanies } = await import("../../../data/monitoredCompanies");
    const agibank = initialMonitoredCompanies.find((c) => c.slug === "agibank");

    expect(agibank).toBeDefined();
    expect(agibank?.ats).toBe("GREENHOUSE");
    expect(agibank?.careerUrl).toContain("greenhouse.io");
    expect(agibank?.status).toBe("MONITORED");
  });
});
