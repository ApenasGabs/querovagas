import {
  ExternalLink,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";

export function CommunityDiscussions(): ReactElement {
  const commentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = commentsRef.current;
    if (!container) return;

    // Remove qualquer script ou iframe anterior para recarregar limpo
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://utteranc.es/client.js";
    script.setAttribute("repo", "ApenasGabs/querovagas");
    script.setAttribute("issue-term", "title");
    script.setAttribute("theme", "github-dark");
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner Informativo Comunitário - Inspirado no DevPedia */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Fórum Comunitário de Oportunidades & Empresas</span>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-base-content">
            Espaço Aberto de Discussão da Comunidade (Estilo DevPedia)
          </h3>
          <p className="text-xs sm:text-sm text-base-content/70 leading-relaxed">
            Assim como na enciclopédia colaborativa do <strong>DevPedia</strong>, acreditamos que a
            comunidade de tecnologia cresce mais rápido quando se ajuda! Utilize o espaço abaixo
            para compartilhar dicas de processos seletivos, relatar links de carreiras quebrados ou
            sugerir novas ATS e empresas para monitorarmos.
          </p>
        </div>

        {/* Links Rápidos e Ações de Contribuição */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <a
            href="https://github.com/ApenasGabs/querovagas/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60 hover:bg-base-200 transition-colors text-left border border-base-300"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GitBranch className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-base-content flex items-center gap-1">
                Abrir Issue no GitHub
                <ExternalLink className="w-3 h-3 text-base-content/50" />
              </span>
              <p className="text-[11px] text-base-content/60 truncate">
                Sugira melhorias ou reporte novas ATS diretamente no repositório.
              </p>
            </div>
          </a>

          <a
            href="https://github.com/ApenasGabs/devpedia"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60 hover:bg-base-200 transition-colors text-left border border-base-300"
          >
            <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-base-content flex items-center gap-1">
                Conheça o DevPedia
                <ExternalLink className="w-3 h-3 text-base-content/50" />
              </span>
              <p className="text-[11px] text-base-content/60 truncate">
                Enciclopédia comunitária de ferramentas e plataformas dev.
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Caixa de Comentários Utterances */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-base-200 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-base-content">
              Comentários e Dúvidas Recentes
            </h4>
          </div>
          <span className="text-[11px] text-base-content/50 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Alimentado via GitHub Issues & Utterances
          </span>
        </div>

        <div
          ref={commentsRef}
          className="min-h-[160px] flex items-center justify-center text-xs text-base-content/40"
        >
          Carregando espaço de discussão da comunidade...
        </div>
      </div>
    </div>
  );
}
