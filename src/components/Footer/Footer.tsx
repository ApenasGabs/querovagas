import type { ReactElement } from "react";
import { ExternalLink } from "../ExternalLink/ExternalLink";

interface FooterProps {
  onOpenDonation?: () => void;
}

/**
 * Componente de rodapé da aplicação
 */
export const Footer = ({ onOpenDonation }: FooterProps = {}): ReactElement => {
  return (
    <footer className="footer bg-base-300 text-base-content py-6 px-4 border-t border-base-300">
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center text-center space-y-2">
        <p className="text-sm font-semibold">
          QueroVagas · Plataforma de Oportunidades em Tecnologia
        </p>
        <p className="text-xs text-base-content/60">
          Feito com muito ❤️ e tecnologia por{" "}
          <ExternalLink href="https://github.com/apenasgabs">
            ApenasGabs
          </ExternalLink>
        </p>
        {onOpenDonation && (
          <button
            type="button"
            onClick={onOpenDonation}
            className="text-xs text-primary hover:underline font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors mt-1"
            title="Apoie a infraestrutura do QueroVagas com Pix"
          >
            <span>💖 Apoie o projeto com Pix</span>
          </button>
        )}
      </div>
    </footer>
  );
};
