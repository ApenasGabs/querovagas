import type { ReactElement, ReactNode } from "react";

interface NavbarProps {
  title?: ReactNode;
  children?: ReactNode;
}

/**
 * Componente de barra de navegação
 *
 * @param title - Título ou elemento de marca exibido no lado esquerdo da navbar
 * @param children - Elementos adicionais exibidos no lado direito (ex: seletor de tema)
 */
export const Navbar = ({ title, children }: NavbarProps): ReactElement => {
  return (
    <header className="navbar bg-base-100 border-b border-base-200 shadow-xs px-2.5 sm:px-6 lg:px-8 py-2 sm:py-3 sticky top-0 z-30 backdrop-blur-md bg-base-100/90 min-h-13 sm:min-h-16">
      <div className="flex-1 flex items-center justify-start min-w-0 mr-1.5 sm:mr-3">
        {typeof title === "string" ? (
          <a
            className="text-base sm:text-xl font-bold text-base-content hover:text-primary transition-colors cursor-pointer truncate"
            data-testid="navbar-title"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">{children}</div>
    </header>
  );
};
