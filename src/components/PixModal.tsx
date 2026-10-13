import React, { useState } from 'react';
import { Player } from '../types/game';
import { formatCurrency } from '../utils/sync';
import { Send, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { audio } from '../utils/audio';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  sender: Player | null; // null = BANK
  allPlayers: Player[];
  preselectedRecipientId?: string | null;
  defaultAmount?: number;
  reason?: string;
  onTransfer: (fromId: string, toId: string, amount: number, description: string) => void;
}

export const PixModal: React.FC<PixModalProps> = ({
  isOpen,
  onClose,
  sender,
  allPlayers,
  preselectedRecipientId,
  defaultAmount,
  reason,
  onTransfer,
}) => {
  const [recipientId, setRecipientId] = useState<string>(preselectedRecipientId || 'BANK');
  const [amount, setAmount] = useState<number>(defaultAmount || 500);
  const [description, setDescription] = useState<string>(reason || 'Transferência Pix');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableRecipients = [
    { id: 'BANK', name: '🏦 Banco Central' },
    ...allPlayers
      .filter((p) => p.id !== sender?.id)
      .map((p) => ({ id: p.id, name: `👤 ${p.name}` })),
  ];

  const handleQuickAdd = (val: number) => {
    setAmount((prev) => (prev || 0) + val);
    audio.playClickSound();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('Informe um valor maior que zero.');
      return;
    }

    if (sender && sender.balance < amount) {
      setErrorMsg(`Saldo insuficiente! Você possui apenas ${formatCurrency(sender.balance)}.`);
      audio.playAlertSound();
      return;
    }

    const fromId = sender ? sender.id : 'BANK';
    onTransfer(fromId, recipientId, amount, description);
    audio.playCoinSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Transferência Pix Digital</h3>
              <p className="text-[11px] text-slate-400">Pagamento instantâneo em tempo real</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Sender & Recipient Flow */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="text-left flex-1 truncate">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Origem:</span>
              <strong className="text-slate-200 text-xs truncate">
                {sender ? sender.name : 'Banco Central'}
              </strong>
              {sender && (
                <div className="text-[10px] text-emerald-400 font-mono">
                  Saldo: {formatCurrency(sender.balance)}
                </div>
              )}
            </div>

            <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />

            <div className="text-right flex-1">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Destino:</span>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500 max-w-[150px]"
              >
                {availableRecipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Valor a Transferir (R$):</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                R$
              </span>
              <input
                type="number"
                min="1"
                step="10"
                required
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-lg font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quick add pill buttons */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              {[100, 200, 500, 1000, 2000, 5000].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAdd(val)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[11px] whitespace-nowrap border border-slate-700"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Descrição ou Motivo:</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel Leblon, Empréstimo, Acordo..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Transferência instantânea sem taxas
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-slate-400 hover:text-white font-medium bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Confirmar Pix</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
