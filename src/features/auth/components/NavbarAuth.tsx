import type { ReactElement } from "react";
import type { AuthStatus, UserProfile } from "../../../services/trustAuthService";

interface NavbarAuthProps {
  status: AuthStatus;
  user: UserProfile | null;
  onSignOut: () => void;
}

export function NavbarAuth({
  status,
  user,
  onSignOut,
}: NavbarAuthProps): ReactElement | null {
  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-base-300 animate-pulse" />
    );
  }

  // Sem segundo botão de login na plataforma: o login ocorre exclusivamente via Utterances
  if (!user) {
    return null;
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
