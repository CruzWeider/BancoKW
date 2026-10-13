import React, { useState } from 'react';
import {
  Building2,
  Coins,
  RotateCcw,
  Trophy,
  TrendingUp,
  Users,
  ChevronDown,
  Sparkles,
  Home,
  CheckCircle2,
  AlertCircle,
  QrCode,
  DollarSign
} from 'lucide-react';
import { GameState } from '../types/game';
import { formatCurrency, calculateNetWorth } from '../utils/sync';

interface MatchOverviewCardProps {
  gameState: GameState;
  defaultExpanded?: boolean;
  onFinishMatch?: () => void;
  onResetToLobby?: () => void;
  onOpenRoomQR?: () => void;
  onOpenPlayerQR?: () => void;
  onOpenPixModal?: () => void;
}

export const MatchOverviewCard: React.FC<MatchOverviewCardProps> = ({
  gameState,
  defaultExpanded = true,
  onFinishMatch,
  onResetToLobby,
  onOpenRoomQR,
  onOpenPlayerQR,
  onOpenPixModal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // 1. Calculations: Properties Owned & Board stats
  const buyableSpaces = gameState.customBoardSpaces.filter(
    (s) => s.type === 'PROPERTY' || s.type === 'COMPANY'
  );
  const totalBuyableCount = buyableSpaces.length;
  const ownedList = Object.values(gameState.ownerships);
  const totalPropertiesOwned = ownedList.length;
  const ownershipPercentage = totalBuyableCount > 0
    ? Math.round((totalPropertiesOwned / totalBuyableCount) * 100)
    : 0;

  let totalHouses = 0;
  let totalHotels = 0;
  ownedList.forEach((o) => {
    if (o.houses >= 3) {
      totalHotels += 1;
    } else if (o.houses > 0) {
      totalHouses += o.houses;
    }
  });

  // 2. Calculations: Money in Circulation
  const totalMoneyInCirculation = gameState.players.reduce(
    (sum, p) => sum + (p.isBankrupt ? 0 : p.balance),
    0
  );
  const activePlayers = gameState.players.filter((p) => !p.isBankrupt);
  const avgMoneyPerPlayer = activePlayers.length > 0
    ? Math.round(totalMoneyInCirculation / activePlayers.length)
    : 0;

  // 3. Current Player / Turn
  const currentPlayer = gameState.players[gameState.currentTurnPlayerIndex] || gameState.players[0];

  // 4. Calculations: Richest Player (Net worth)
  const playersWithNetWorth = gameState.players.map((p) => ({
    player: p,
    netWorth: calculateNetWorth(p, gameState.ownerships, gameState.customBoardSpaces),
    propsCount: ownedList.filter((o) => o.ownerId === p.id).length,
  }));
  playersWithNetWorth.sort((a, b) => b.netWorth - a.netWorth);
  const richestPlayer = playersWithNetWorth[0];

  // 5. Calculations: Transactions volume
  const totalTransactionVolume = gameState.transactions.reduce((sum, tx) => sum + tx.amount, 0);

  // 6. Player statuses
  const inJailCount = gameState.players.filter((p) => p.inJail).length;
  const bankruptCount = gameState.players.filter((p) => p.isBankrupt).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden transition-all duration-300">
      {/* Clickable Card Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="w-full text-left p-4 sm:p-5 flex flex-col gap-3.5 hover:bg-slate-850/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors select-none"
        aria-expanded={isExpanded}
        aria-label="Alternar exibição da Visão Geral da Partida"
      >
        {/* Linha 1: Título da Visão Geral + Botão Recolher/Expandir */}
        <div className="flex items-start sm:items-center justify-between gap-3 w-full">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Visão Geral da Partida
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Tempo Real
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                Estatísticas ao vivo do tabuleiro, capital circulante e progresso da rodada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all shrink-0">
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            <ChevronDown
              className={`w-4 h-4 text-emerald-400 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </div>
        </div>

        {/* Linha 2: Resumo Rápido + Botões de Ação com quebra de linha automática (sem sair da tela) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70 w-full">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
              Sala <strong className="text-emerald-400 font-mono">{gameState.roomId}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
              Rodada <strong className="text-white">{gameState.roundNumber}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
              <strong className="text-emerald-400 font-mono">
                {formatCurrency(totalMoneyInCirculation)}
              </strong>{' '}
              ativo
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onOpenRoomQR && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRoomQR();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
                title="Abrir QR Code da sala para conectar jogadores"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>QR Sala</span>
              </button>
            )}

            {onOpenPlayerQR && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPlayerQR();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
                title="Ver QR Codes dos jogadores"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>QR Jogadores</span>
              </button>
            )}

            {onOpenPixModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPixModal();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs transition-all"
                title="Transferir dinheiro do Banco Central para um jogador"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Pix Banco</span>
              </button>
            )}

            {onFinishMatch && gameState.status !== 'FINISHED' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFinishMatch();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                title="Encerrar partida e declarar o campeão"
              >
                <Trophy className="w-3.5 h-3.5 text-slate-950" />
                <span>Finalizar Partida</span>
              </button>
            )}

            {onResetToLobby && gameState.status === 'FINISHED' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetToLobby();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                title="Iniciar nova partida"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nova Partida</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Real-time Statistics Body */}
      {isExpanded && (
        <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-800/80 space-y-5 animate-fade-in">
          {/* Main 3 Key KPIs (Requested directly in user prompt) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI 1: Total Properties Owned */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Propriedades Compradas
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {ownershipPercentage}% do tabuleiro
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {totalPropertiesOwned}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">
                    / {totalBuyableCount} totais
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {totalBuyableCount - totalPropertiesOwned} propriedades ainda disponíveis no Banco Central
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-850 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, ownershipPercentage))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3 text-amber-400" />
                  Casas no tabuleiro: <strong className="text-white">{totalHouses}</strong>
                </span>
                <span>
                  Hotéis: <strong className="text-amber-400">{totalHotels}</strong>
                </span>
              </div>
            </div>

            {/* KPI 2: Total Money in Circulation */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  Dinheiro em Circulação
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {activePlayers.length} jogadores ativos
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {formatCurrency(totalMoneyInCirculation)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Média de <strong className="text-slate-200 font-mono">{formatCurrency(avgMoneyPerPlayer)}</strong> em mãos por jogador
                </p>
              </div>

              {/* Cash share visual indicators */}
              <div className="w-full bg-slate-850 rounded-full h-2 overflow-hidden flex border border-slate-800">
                {gameState.players.map((p) => {
                  const share = totalMoneyInCirculation > 0
                    ? Math.round((Math.max(0, p.balance) / totalMoneyInCirculation) * 100)
                    : 0;
                  return (
                    <div
                      key={p.id}
                      title={`${p.name}: ${share}% (${formatCurrency(p.balance)})`}
                      style={{
                        width: `${share}%`,
                        backgroundColor: p.color,
                      }}
                      className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <span>
                  Salário Partida: <strong className="text-slate-200">{formatCurrency(gameState.salaryAmount)}</strong>
                </span>
                <span>
                  Balanço inicial: <strong className="text-slate-200">{formatCurrency(gameState.initialBalance)}</strong>
                </span>
              </div>
            </div>

            {/* KPI 3: Current Game Round */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Andamento da Partida
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                    gameState.status === 'PLAYING'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : gameState.status === 'FINISHED'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}
                >
                  {gameState.status === 'PLAYING'
                    ? 'Em Andamento'
                    : gameState.status === 'FINISHED'
                    ? 'Finalizada'
                    : 'Sala de Espera'}
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Rodada
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    #{gameState.roundNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                  <span>Vez atual:</span>
                  {currentPlayer && (
                    <span className="flex items-center gap-1 font-bold text-white">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: currentPlayer.color }}
                      />
                      {currentPlayer.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Transações Registradas:</span>
                  <strong className="text-purple-400 font-mono">
                    {gameState.transactions.length}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <span>
                  Volume movimentado:{' '}
                  <strong className="text-slate-200 font-mono">
                    {formatCurrency(totalTransactionVolume)}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Player Real-Time Breakdown Strip */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Distribuição de Patrimônio e Propriedades entre os Jogadores</span>
              </h3>
              {richestPlayer && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Líder: <strong>{richestPlayer.player.name}</strong> ({formatCurrency(richestPlayer.netWorth)})
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {playersWithNetWorth.map(({ player, netWorth, propsCount }, idx) => {
                const isCurrentTurn = player.id === currentPlayer?.id;
                const isLeader = idx === 0 && gameState.players.length > 1;

                return (
                  <div
                    key={player.id}
                    className={`bg-slate-900/90 rounded-xl p-3 border transition-all ${
                      isCurrentTurn
                        ? 'border-emerald-500/60 shadow-md shadow-emerald-500/5'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/30"
                          style={{ backgroundColor: player.color }}
                        />
                        <strong className="text-white text-xs truncate">
                          {player.name}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isLeader && (
                          <span title="Líder em patrimônio total" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5" />
                            1º
                          </span>
                        )}
                        {isCurrentTurn && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider border border-emerald-500/30">
                            Vez
                          </span>
                        )}
                        {player.inJail && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            Preso
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Saldo em conta:</span>
                        <strong className="text-emerald-400 font-mono font-semibold">
                          {formatCurrency(player.balance)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Patrimônio total:</span>
                        <strong className="text-slate-200 font-mono">
                          {formatCurrency(netWorth)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Propriedades:</span>
                        <span className="text-blue-300 font-bold">
                          {propsCount} {propsCount === 1 ? 'cidade' : 'cidades'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Toolbar for the Match / Room */}
          <div className="pt-3 border-t border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">
                Ações da Partida (Sala <strong className="text-emerald-400 font-mono">{gameState.roomId}</strong>):
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenRoomQR && (
                <button
                  type="button"
                  onClick={onOpenRoomQR}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>QR da Sala</span>
                </button>
              )}

              {onOpenPlayerQR && (
                <button
                  type="button"
                  onClick={onOpenPlayerQR}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>QR Jogadores</span>
                </button>
              )}

              {onOpenPixModal && (
                <button
                  type="button"
                  onClick={onOpenPixModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Pagar pelo Banco</span>
                </button>
              )}

              {onFinishMatch && gameState.status !== 'FINISHED' && (
                <button
                  type="button"
                  onClick={onFinishMatch}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Trophy className="w-4 h-4 text-slate-950" />
                  <span>Finalizar Partida</span>
                </button>
              )}

              {onResetToLobby && gameState.status === 'FINISHED' && (
                <button
                  type="button"
                  onClick={onResetToLobby}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Iniciar Nova Partida</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
