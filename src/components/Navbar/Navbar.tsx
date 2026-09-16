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
    <header className="navbar bg-base-100 border-b border-base-200 shadow-xs px-4 sm:px-6 lg:px-8 py-3 sticky top-0 z-30 backdrop-blur-md bg-base-100/90">
      <div className="flex-1 flex items-center justify-start">
        {typeof title === "string" ? (
          <a
            className="text-xl font-bold text-base-content hover:text-primary transition-colors cursor-pointer"
            data-testid="navbar-title"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
};
