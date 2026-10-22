import type { ReactElement } from "react";
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
  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-base-300 animate-pulse" />
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

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-full pl-1.5 pr-2.5 py-1 text-xs shadow-xs">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-[10px]">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="font-semibold text-base-content max-w-[90px] sm:max-w-[120px] truncate">
          @{user.username}
        </span>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="btn btn-xs btn-ghost text-base-content/60 hover:text-error"
        title="Encerrar sessão"
      >
        Sair
      </button>
    </div>
  );
}
