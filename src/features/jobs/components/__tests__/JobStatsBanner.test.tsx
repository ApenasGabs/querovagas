import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JobStats } from "../../../../types/job";
import { JobStatsBanner } from "../JobStatsBanner";

const sampleStats: JobStats = {
  totalJobs: 1500,
  byModel: {
    REMOTO: 900,
    HIBRIDO: 400,
    PRESENCIAL: 200,
  },
  bySeniority: {
    ESTAGIO: 80,
    JUNIOR: 120,
    PLENO: 700,
    SENIOR: 550,
    ESPECIALISTA: 50,
  },
  bySource: {
    Gupy: 500,
    Ashby: 200,
    InHire: 100,
  },
};

describe("JobStatsBanner", () => {
  it("não deve renderizar quando stats for null", () => {
    const { container } = render(<JobStatsBanner stats={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar os 4 cards de estatísticas com valores corretos", () => {
    render(<JobStatsBanner stats={sampleStats} />);

    expect(screen.getByTestId("job-stats-banner")).toBeInTheDocument();
    expect(screen.getByTestId("job-stat-active-jobs")).toHaveTextContent("1500");
    expect(screen.getByTestId("job-stat-remote-jobs")).toHaveTextContent("900");
    expect(screen.getByTestId("job-stat-junior-intern-jobs")).toHaveTextContent("200");
    expect(screen.getByTestId("job-stat-ats-sources")).toHaveTextContent("3");
  });

  it("deve aplicar classes que evitam overflow horizontal em cards de 2 colunas no mobile", () => {
    render(<JobStatsBanner stats={sampleStats} />);

    const cardIds = [
      "job-stat-active-jobs",
      "job-stat-remote-jobs",
      "job-stat-junior-intern-jobs",
      "job-stat-ats-sources",
    ];

    cardIds.forEach((testId) => {
      const card = screen.getByTestId(testId);
      expect(card).toHaveClass("min-w-0");
      expect(card).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");

      const title = card.querySelector(".stat-title");
      const desc = card.querySelector(".stat-desc");
      expect(title).toHaveClass("whitespace-normal");
      expect(desc).toHaveClass("whitespace-normal");
    });
  });
});
