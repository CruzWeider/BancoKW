import React from 'react';
import { GameState, Player } from '../types/game';
import { calculateNetWorth, formatCurrency } from '../utils/sync';
import { Trophy, Crown, Flag, AlertCircle, Sparkles, X, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audio } from '../utils/audio';

interface FinishMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onConfirmFinish: (winnerId: string) => void;
}

export const FinishMatchModal: React.FC<FinishMatchModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onConfirmFinish,
}) => {
  if (!isOpen) return null;

  // Rank players by total Net Worth
  const ranked = [...gameState.players]
    .map((player) => {
      const netWorth = calculateNetWorth(
        player,
        gameState.ownerships,
        gameState.customBoardSpaces
      );
      const ownedCount = Object.values(gameState.ownerships).filter(
        (o) => o.ownerId === player.id
      ).length;

      return {
        player,
        netWorth,
        cash: player.balance,
        ownedCount,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);

  const winner = ranked[0];

  const handleConfirm = () => {
    audio.playVictoryFanfare();
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
    });

    onConfirmFinish(winner ? winner.player.id : '');
    onClose();
  };

  const totalMoney = gameState.transactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 relative my-auto max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg">
            <Trophy className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Finalizar Partida</h3>
            <p className="text-xs text-slate-400">
              Apuração do vencedor por Patrimônio Líquido Total
            </p>
          </div>
        </div>

        {/* Winner Spotlight Card */}
        {winner && (
          <div className="bg-gradient-to-b from-amber-500/20 via-slate-950 to-slate-950 p-5 rounded-2xl border border-amber-500/50 text-center space-y-2 relative overflow-hidden shadow-xl">
            <div className="absolute top-3 right-3 text-amber-400">
              <Crown className="w-6 h-6 animate-bounce" />
            </div>

            <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 block">
              1º Lugar · Campeão da Partida
            </span>
            <h4 className="text-2xl font-black text-white flex items-center justify-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: winner.player.color }}
              />
              <span>{winner.player.name}</span>
            </h4>

            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatCurrency(winner.netWorth)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-slate-500 text-[10px] block">Saldo em Dinheiro:</span>
                <strong className="font-mono">{formatCurrency(winner.cash)}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Propriedades:</span>
                <strong className="font-mono">{winner.ownedCount} cidades</strong>
              </div>
            </div>
          </div>
        )}

        {/* Other players rank list */}
        <div className="space-y-2">
          <span className="text-xs text-slate-400 font-semibold block">
            Classificação Geral ({ranked.length} jogadores):
          </span>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {ranked.map((item, idx) => (
              <div
                key={item.player.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  idx === 0
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-400 w-5">
                    {idx + 1}º
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.player.color }}
                  />
                  <strong className="text-white truncate max-w-[140px]">
                    {item.player.name}
                  </strong>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(item.netWorth)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {item.ownedCount} imóveis
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Match statistics summary */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div>
            <span>Rodadas Jogadas:</span>
            <strong className="block text-white font-mono">{gameState.roundNumber}</strong>
          </div>
          <div>
            <span>Total Movimentado:</span>
            <strong className="block text-emerald-400 font-mono">{formatCurrency(totalMoney)}</strong>
          </div>
        </div>

        {!winner && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Nenhum Jogador Cadastrado</h4>
            <p className="text-xs text-slate-300">
              Você pode encerrar esta partida para reiniciar as configurações da sala de espera.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            Continuar Partida
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{winner ? 'Declarar Campeão e Encerrar' : 'Encerrar Partida'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
