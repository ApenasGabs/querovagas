import React, { useState, type FormEvent } from "react";

interface GithubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string) => Promise<boolean>;
  onOAuth?: () => void;
  initialUsername?: string;
  initialMessage?: string;
}

export function GithubAuthModal({
  isOpen,
  onClose,
  onSubmit,
  onOAuth,
  initialUsername = "",
  initialMessage,
}: GithubAuthModalProps): React.ReactElement | null {
  const [username, setUsername] = useState(initialUsername);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialMessage || null);

  // Sincroniza estado de abertura sem cascading renders
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setUsername(initialUsername);
      setErrorMessage(initialMessage || null);
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = username.trim().replace(/^@+/, "");
    if (!clean) {
      setErrorMessage("Por favor, digite seu usuário do GitHub.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const success = await onSubmit(clean);
      if (success) {
        onClose();
      } else {
        setErrorMessage("Perfil não atende aos requisitos de conexão da comunidade.");
      }
    } catch {
      setErrorMessage("Erro ao verificar perfil. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-sm sm:max-w-md p-6 bg-base-100 border border-base-300 shadow-2xl rounded-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/60 hover:text-base-content"
          disabled={loading}
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-base-200 border border-base-300">
            <svg className="w-6 h-6 fill-current text-base-content" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-base-content">Identificação GitHub</h3>
            <p className="text-xs text-base-content/60">Conecte seu perfil para validação comunitária</p>
          </div>
        </div>

        {onOAuth && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onOAuth}
              className="btn btn-sm btn-outline w-full gap-2 text-xs font-semibold hover:btn-primary"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Entrar com Login Oficial do GitHub</span>
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-base-300" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-base-100 px-2 text-base-content/50">ou informe seu usuário</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label py-1">
              <span className="label-text text-xs font-medium text-base-content/70">
                Seu usuário do GitHub
              </span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-base-content/40 font-mono text-sm">@</span>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu-usuario"
                disabled={loading}
                className="input input-bordered w-full pl-8 font-mono text-sm focus:input-primary"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="alert alert-warning py-2 text-xs rounded-lg flex items-center gap-2">
              <svg
                className="w-4 h-4 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="modal-action mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-sm btn-ghost text-base-content/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="btn btn-sm btn-primary min-w-[110px]"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  <span>Verificando</span>
                </>
              ) : (
                "Conectar"
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={loading ? undefined : onClose} />
    </div>
  );
}
