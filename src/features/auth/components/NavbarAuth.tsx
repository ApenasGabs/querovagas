import { CheckCircle2, ChevronDown, ExternalLink, LogOut, ShieldCheck, User } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { AuthStatus, UserProfile } from "../../../services/trustAuthService";

interface NavbarAuthProps {
  status: AuthStatus;
  user: UserProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function NavbarAuth({
  status,
  user,
  onSignIn,
  onSignOut,
}: NavbarAuthProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-base-200 border border-base-300 animate-pulse">
        <div className="w-6 h-6 rounded-full bg-base-300" />
        <div className="w-16 h-3 rounded bg-base-300 hidden sm:block" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="btn btn-sm btn-ghost gap-1.5 border border-base-300 hover:border-primary text-base-content shadow-xs"
        title="Entrar com GitHub via Utterances"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span className="text-xs font-semibold hidden sm:inline">Entrar com GitHub</span>
      </button>
    );
  }

  const avatarSrc = user.avatarUrl || `https://github.com/${user.username}.png`;
  const displayName = user.name || user.username;
  const isVerified = status === "verified";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-base-100 hover:bg-base-200 border border-base-300 hover:border-primary/40 rounded-full pl-1.5 pr-2.5 py-1 text-xs shadow-xs transition-all cursor-pointer"
        title={`Logado como @${user.username} — Clique para abrir o menu de perfil`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="relative shrink-0">
          <img
            src={avatarSrc}
            alt={user.username}
            className="w-6 h-6 rounded-full object-cover border border-base-300"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-base-100"
            title="Sessão ativa"
          />
        </div>

        <span className="font-semibold text-base-content max-w-[95px] sm:max-w-[130px] truncate">
          @{user.username}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-base-content/60 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-base-100 border border-base-300 shadow-xl p-3 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Cabeçalho da Conta Logada */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-base-200/60 border border-base-300/60">
            <img
              src={avatarSrc}
              alt={user.username}
              className="w-10 h-10 rounded-full object-cover border border-base-300 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-base-content truncate">{displayName}</p>
              <p className="text-[11px] font-mono text-base-content/70 truncate">
                @{user.username}
              </p>
              <div className="mt-1">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-md">
                    <ShieldCheck className="w-3 h-3" />
                    Membro Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    Conectado via GitHub
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Links do Perfil */}
          <div className="space-y-1">
            <a
              href={`https://github.com/${encodeURIComponent(user.username)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-base-content/80 hover:text-base-content hover:bg-base-200 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-base-content/60" />
                Meu perfil no GitHub
              </span>
              <ExternalLink className="w-3 h-3 text-base-content/40" />
            </a>
          </div>

          <div className="border-t border-base-200 pt-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-error hover:bg-error/10 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
