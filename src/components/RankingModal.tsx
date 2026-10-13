import React from 'react';
import { GameState, MatchStats } from '../types/game';
import { calculateNetWorth, formatCurrency, syncManager } from '../utils/sync';
import { Trophy, Medal, Award, Crown, DollarSign, Building, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audio } from '../utils/audio';

interface RankingModalProps {
  gameState: GameState;
  onCrownWinner?: (playerId: string) => void;
}

export const RankingModal: React.FC<RankingModalProps> = ({ gameState, onCrownWinner }) => {
  const history = syncManager.loadHistory();

  // Sort players by total Net Worth (Patrimônio Líquido)
  const rankedPlayers = [...gameState.players].map((player) => {
    const netWorth = calculateNetWorth(player, gameState.ownerships, gameState.customBoardSpaces);
    const propertiesOwned = Object.values(gameState.ownerships).filter((o) => o.ownerId === player.id);
    const totalHouses = propertiesOwned.reduce((acc, o) => acc + (o.houses === 4 ? 4 : o.houses), 0);

    return {
      player,
      netWorth,
      cash: player.balance,
      propertiesCount: propertiesOwned.length,
      housesCount: totalHouses,
    };
  }).sort((a, b) => b.netWorth - a.netWorth);

  const handleCelebrate = () => {
    audio.playVictoryFanfare();
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Current Match Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                <Trophy className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-white">Ranking em Tempo Real da Partida</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Classificação por Patrimônio Líquido Total (Saldo em Conta + Valor Venal dos Imóveis + Casas e Hotéis)
            </p>
          </div>

          <button
            onClick={handleCelebrate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Comemorar Campeão</span>
          </button>
        </div>

        {/* Podium / Leaderboard Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rankedPlayers.slice(0, 3).map((item, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            return (
              <div
                key={item.player.id}
                className={`rounded-2xl p-5 border relative overflow-hidden flex flex-col justify-between ${
                  isFirst
                    ? 'bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/5'
                    : isSecond
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                {isFirst && (
                  <div className="absolute top-3 right-3 text-amber-400">
                    <Crown className="w-6 h-6 animate-pulse" />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center font-mono ${
                        isFirst
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : isSecond
                          ? 'bg-slate-300 text-slate-950'
                          : 'bg-amber-700 text-white'
                      }`}
                    >
                      {index + 1}º
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-base">{item.player.name}</h4>
                      <span className="text-[11px] text-slate-400">Peça: {item.player.tokenPiece}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Patrimônio Líquido:</span>
                      <strong className="text-emerald-400 font-mono text-sm">
                        {formatCurrency(item.netWorth)}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Saldo em Dinheiro:</span>
                      <span className="font-mono text-slate-300">{formatCurrency(item.cash)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Imóveis Possuídos:</span>
                      <span className="font-mono text-blue-300">{item.propertiesCount} cidades</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Casas & Hotéis:</span>
                      <span className="font-mono text-amber-300">{item.housesCount} construções</span>
                    </div>
                  </div>
                </div>

                {isFirst && onCrownWinner && (
                  <button
                    onClick={() => onCrownWinner(item.player.id)}
                    className="mt-4 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Declarar Vencedor da Partida</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Full Player List */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Posição</th>
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-4">Saldo em Caixa</th>
                <th className="py-3 px-4">Propriedades</th>
                <th className="py-3 px-4">Casas/Hotéis</th>
                <th className="py-3 px-4 text-right">Patrimônio Líquido Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rankedPlayers.map((item, idx) => (
                <tr key={item.player.id} className="hover:bg-slate-850 transition-colors">
                  <td className="py-3 px-4 font-bold text-white font-mono">{idx + 1}º</td>
                  <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.player.color }}
                    />
                    <span>{item.player.name}</span>
                    {item.player.isBankrupt && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                        FALIDO
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400">{formatCurrency(item.cash)}</td>
                  <td className="py-3 px-4 font-mono">{item.propertiesCount} cidades</td>
                  <td className="py-3 px-4 font-mono">{item.housesCount}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-white">
                    {formatCurrency(item.netWorth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Matches Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Histórico de Partidas Concluídas</h3>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">
            Nenhuma partida finalizada ainda. Quando o mediador encerrar e declarar um vencedor, o registro ficará salvo aqui.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {history.map((match) => (
              <div
                key={match.id}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-white text-sm">{match.name}</strong>
                  <span className="text-slate-500 font-mono text-[11px]">{match.date}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Campeão:</span>
                  <strong className="text-amber-400 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    {match.winnerName}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Total Movimentado:</span>
                  <span className="font-mono text-slate-200">
                    {formatCurrency(match.totalMoneyCirculated)}
                  </span>
                </div>
                {match.topRentCollected && (
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Maior Aluguel da Partida:</span>
                    <span className="font-mono text-rose-300">
                      {formatCurrency(match.topRentCollected.amount)} ({match.topRentCollected.spaceName})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
