import {
  Coffee,
  ExternalLink,
  Heart,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import {
  buildLivePixDonationUrl,
  PRESET_DONATION_AMOUNTS,
} from "../utils/livepix";

export interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDonationInitiated?: (amount: number) => void;
}

export const DonationModal = ({
  isOpen,
  onClose,
  onDonationInitiated,
}: DonationModalProps): ReactElement | null => {
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  // Trata tecla ESC para fechar modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentAmount = isCustom ? Number(customAmount) || 0 : selectedAmount;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount("");
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    setCustomAmount(rawVal);
    setIsCustom(true);
  };

  const handleDonate = () => {
    const finalAmount = currentAmount > 0 ? currentAmount : 10;
    onDonationInitiated?.(finalAmount);

    const donationUrl = buildLivePixDonationUrl({
      amount: finalAmount,
      message: message.trim() || undefined,
    });

    window.open(donationUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-base-100 border border-base-300 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-base-100 to-secondary/10 border-b border-base-300 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-error fill-error/20" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="donation-modal-title"
                  className="text-lg sm:text-xl font-black tracking-tight text-base-content"
                >
                  Apoie o QueroVagas
                </h2>
                <span className="badge badge-success badge-sm font-semibold gap-1 text-[11px]">
                  <Sparkles className="w-3 h-3" /> 100% Livre & Grátis
                </span>
              </div>
              <p className="text-xs text-base-content/70 mt-0.5">
                Ajude a manter os crawlers, servidores e banco de dados rodando 24/7.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost shrink-0"
            title="Fechar modal"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Por que apoiar? */}
          <div className="bg-base-200/50 rounded-xl p-3.5 space-y-2 text-xs text-base-content/80 border border-base-300/60">
            <div className="font-bold text-base-content flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-warning" />
              <span>Como sua contribuição fortalece o projeto:</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-base-content/70 pl-1">
              <li>Custos de infraestrutura, proxies e monitoramento contínuo de vagas.</li>
              <li>Desenvolvimento de melhorias solicitadas pela comunidade.</li>
              <li>Manutenção do catálogo público sem paywalls ou anúncios intrusivos.</li>
            </ul>
          </div>

          {/* Seleção de Valor */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-base-content/70">
              Escolha um valor de apoio (R$)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PRESET_DONATION_AMOUNTS.map((amt) => {
                const isSelected = !isCustom && selectedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectPreset(amt)}
                    className={`btn btn-sm sm:btn-md font-bold transition-all ${
                      isSelected
                        ? "btn-primary shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-base-100"
                        : "btn-outline border-base-300 hover:border-primary/50 text-base-content"
                    }`}
                  >
                    R$ {amt}
                  </button>
                );
              })}
            </div>

            {/* Valor customizado */}
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ou digite outro valor (ex: 15)"
                  value={customAmount}
                  onChange={handleCustomChange}
                  className={`input input-sm sm:input-md input-bordered w-full text-xs sm:text-sm ${
                    isCustom && Number(customAmount) > 0 ? "input-primary" : ""
                  }`}
                  aria-label="Outro valor para doação"
                />
              </div>
            </div>
          </div>

          {/* Mensagem Opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-base-content/70">
              Mensagem de incentivo (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Valeu pelas vagas remotas! - Dev Anônimo"
              maxLength={120}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input input-sm input-bordered w-full text-xs"
            />
          </div>

          {/* Banner de Privacidade e Segurança */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              <strong>Privacidade total:</strong> Seu Pix é processado com segurança pela
              LivePix (seus dados bancários e do criador permanecem anônimos e protegidos).
            </span>
          </div>
        </div>

        {/* Rodapé / Ação de Pagamento */}
        <div className="p-4 sm:p-5 bg-base-200/40 border-t border-base-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <span className="text-[11px] text-base-content/60 block">Valor selecionado:</span>
            <span className="text-lg font-black text-primary">
              R$ {currentAmount > 0 ? currentAmount.toFixed(2) : "10.00"}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-ghost flex-1 sm:flex-initial"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDonate}
              className="btn btn-sm btn-primary gap-2 shadow-xs flex-1 sm:flex-initial"
            >
              <Heart className="w-4 h-4 fill-current" />
              <span>Apoiar via LivePix</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
