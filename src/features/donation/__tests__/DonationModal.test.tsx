import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DonationModal } from "../components/DonationModal";

describe("DonationModal", () => {
  const onClose = vi.fn();
  const onDonationInitiated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não deve renderizar nada quando isOpen for false", () => {
    const { container } = render(
      <DonationModal
        isOpen={false}
        onClose={onClose}
        onDonationInitiated={onDonationInitiated}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar o modal com título e valores predefinidos quando isOpen for true", () => {
    render(
      <DonationModal
        isOpen={true}
        onClose={onClose}
        onDonationInitiated={onDonationInitiated}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Apoie o QueroVagas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 5")).toBeInTheDocument();
    expect(screen.getByText("R$ 10")).toBeInTheDocument();
    expect(screen.getByText("R$ 25")).toBeInTheDocument();
    expect(screen.getByText("R$ 50")).toBeInTheDocument();
    expect(screen.getByText("R$ 100")).toBeInTheDocument();
  });

  it("deve chamar onClose ao clicar no botão de fechar (X)", async () => {
    const user = userEvent.setup();
    render(<DonationModal isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /fechar modal/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deve fechar ao pressionar a tecla Escape", () => {
    render(<DonationModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deve permitir selecionar outro valor pré-definido", async () => {
    const user = userEvent.setup();
    render(<DonationModal isOpen={true} onClose={onClose} />);

    const btn50 = screen.getByRole("button", { name: "R$ 50" });
    await user.click(btn50);

    // O valor selecionado no rodapé deve ser atualizado
    expect(screen.getByText("R$ 50.00")).toBeInTheDocument();
  });

  it("deve permitir digitar um valor customizado", async () => {
    const user = userEvent.setup();
    render(<DonationModal isOpen={true} onClose={onClose} />);

    const input = screen.getByLabelText(/outro valor para doação/i);
    await user.type(input, "35");

    expect(screen.getByText("R$ 35.00")).toBeInTheDocument();
  });

  it("deve disparar window.open com a URL do LivePix e notificar onDonationInitiated", async () => {
    const user = userEvent.setup();
    render(
      <DonationModal
        isOpen={true}
        onClose={onClose}
        onDonationInitiated={onDonationInitiated}
      />,
    );

    const donateButton = screen.getByRole("button", {
      name: /Apoiar via LivePix/i,
    });
    await user.click(donateButton);

    expect(onDonationInitiated).toHaveBeenCalledWith(10);
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://livepix.gg/apenasgabs?amount=10"),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("deve suportar responsividade com classes adaptativas para as 3 viewports (Mobile 375px, Tablet 768px e Desktop 1440px)", () => {
    const { container } = render(
      <DonationModal
        isOpen={true}
        onClose={onClose}
        onDonationInitiated={onDonationInitiated}
      />,
    );

    const dialogCard = container.querySelector(".max-w-lg");
    expect(dialogCard).toBeInTheDocument();
    // Valida adaptação responsiva com Tailwind
    expect(dialogCard?.className).toContain("w-full");
    expect(dialogCard?.className).toContain("max-w-lg");
    expect(dialogCard?.className).toContain("max-h-[92vh]");

    // Grade de botões com grid responsivo para telas pequenas e maiores
    const grid = container.querySelector(".grid-cols-3");
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain("sm:grid-cols-5");
  });
});
