import React from 'react';
import { GameState } from '../types/game';
import { formatCurrency } from '../utils/sync';
import { calculateRent, calculateUnownedBankRent } from '../utils/gameEngine';
import { CityMediaViewer } from './CityMediaViewer';
import {
  Radio,
  Dices,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building,
  DollarSign,
  Landmark,
  Home,
  Sparkles,
} from 'lucide-react';

interface TurnLiveSummaryProps {
  gameState: GameState;
  viewerPlayerId?: string | null; // ID do jogador que está olhando a tela no celular (ou null no tablet)
}

export const TurnLiveSummary: React.FC<TurnLiveSummaryProps> = ({
  gameState,
  viewerPlayerId,
}) => {
  if (gameState.status !== 'PLAYING' || gameState.players.length === 0) {
    return null;
  }

  const currentPlayer =
    gameState.players[gameState.currentTurnPlayerIndex] || gameState.players[0];
  if (!currentPlayer) return null;

  const hasRolled = Boolean(gameState.turnHasRolled && gameState.lastDiceRoll);
  const lastRoll = hasRolled ? gameState.lastDiceRoll : undefined;

  const landedSpace = lastRoll?.spaceId
    ? gameState.customBoardSpaces.find((s) => s.id === lastRoll.spaceId)
    : gameState.customBoardSpaces.find(
        (s) => s.sequence === currentPlayer.currentSpaceSequence
      );

  const landedOwnership = landedSpace ? gameState.ownerships[landedSpace.id] : undefined;
  const landedOwner = landedOwnership
    ? gameState.players.find((p) => p.id === landedOwnership.ownerId)
    : undefined;

  // Transações que aconteceram nesta vez (desde que os dados foram rolados ou que o turno começou)
  const turnStartReference =
    gameState.turnStartedAt ||
    (lastRoll?.timestamp ? lastRoll.timestamp - 2000 : Date.now() - 60000);

  const turnTransactions = (gameState.transactions || []).filter(
    (tx) =>
      tx.timestamp >= turnStartReference &&
      (tx.fromId === currentPlayer.id || tx.toId === currentPlayer.id)
  );

  // Notificações pendentes do jogador da vez
  const pendingTurnNotifs = (gameState.notifications || []).filter(
    (n) => n.targetPlayerId === currentPlayer.id && n.status === 'PENDING'
  );

  // Verifica se o jogador que está olhando a tela no celular vai receber (ou já recebeu) aluguel nesta vez
  const isViewerReceivingRent =
    viewerPlayerId &&
    landedOwner?.id === viewerPlayerId &&
    landedOwner?.id !== currentPlayer.id &&
    hasRolled;

  // Últimas 4 transações gerais da partida para todos acompanharem tudo o que aconteceu
  const recentMatchTransactions = (gameState.transactions || [])
    .filter((tx) => tx.category !== 'INITIAL_DEPOSIT')
    .slice(0, 4);

  return (
    <div className="bg-slate-900/95 border-2 border-indigo-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
      {/* Cabeçalho do Painel Ao Vivo da Rodada */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
          </span>
          <Radio className="w-4 h-4 text-indigo-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
            Resumo ao Vivo da Rodada · Todos os Jogadores
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
            Rodada #{gameState.roundNumber}
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentPlayer.color }}
            />
            <span className="text-slate-300 font-semibold">
              Vez de: <strong className="text-white">{currentPlayer.name}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Destaque especial caso o dono do celular seja quem vai receber o aluguel */}
      {isViewerReceivingRent && landedSpace && landedOwnership && (
        <div className="bg-emerald-950/90 border-2 border-emerald-400 rounded-2xl p-3.5 text-emerald-100 flex items-center gap-3 shadow-lg animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
              🎉 Boa notícia para você!
            </span>
            <p className="text-xs sm:text-sm font-bold text-white">
              <strong>{currentPlayer.name}</strong> caiu na sua propriedade{' '}
              <strong>{landedSpace.name}</strong>! Você recebe{' '}
              <strong className="text-emerald-300 font-mono">
                {formatCurrency(
                  calculateRent(landedSpace, landedOwnership, lastRoll?.total)
                )}
              </strong>{' '}
              de aluguel!
            </p>
          </div>
        </div>
      )}

      {/* Passo 1: Status dos Dados e Casa Onde Caiu */}
      {!hasRolled ? (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-slate-300">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <strong className="text-white block text-sm">
              Aguardando {currentPlayer.name} lançar os dados...
            </strong>
            <span className="text-[11px] text-slate-400">
              Assim que {currentPlayer.name} jogar os dados, todos verão aqui em qual casa caiu e o que aconteceu.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          {/* Linha dos Dados e Casa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Dices className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Dados Lançados por {currentPlayer.name}
                </span>
                <strong className="text-white text-sm font-mono">
                  Tirou {lastRoll?.total} ({lastRoll?.dice1} + {lastRoll?.dice2})
                </strong>
              </div>
            </div>

            {landedSpace && (
              <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  #{landedSpace.sequence}
                </span>
                <div>
                  <span className="text-[10px] text-slate-400 block">Caiu na casa:</span>
                  <strong className="text-amber-300 font-black uppercase">
                    {landedSpace.name}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Foto Miniatura + Situação da Casa Onde Caiu */}
          {landedSpace && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              {(landedSpace.imageUrl || landedSpace.videoUrl) && (
                <div className="sm:col-span-1 rounded-xl overflow-hidden">
                  <CityMediaViewer
                    name={landedSpace.name}
                    imageUrl={landedSpace.imageUrl}
                    videoUrl={landedSpace.videoUrl}
                    size="sm"
                  />
                </div>
              )}

              <div
                className={`${
                  landedSpace.imageUrl || landedSpace.videoUrl
                    ? 'sm:col-span-2'
                    : 'sm:col-span-3'
                } space-y-2 text-xs`}
              >
                {/* Situação atual da casa */}
                {(landedSpace.type === 'PROPERTY' || landedSpace.type === 'COMPANY') &&
                  !landedOwnership && (
                    <div className="bg-blue-950/40 border border-blue-700/50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-blue-300 font-black text-[11px] uppercase">
                        <Building className="w-3.5 h-3.5 shrink-0" />
                        <span>Propriedade Livre (Pertence ao Banco)</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        <strong>{currentPlayer.name}</strong> deve escolher entre{' '}
                        <strong className="text-emerald-300">
                          Comprar por {formatCurrency(landedSpace.price)}
                        </strong>{' '}
                        ou{' '}
                        <strong className="text-amber-300">
                          Pagar Aluguel de{' '}
                          {formatCurrency(
                            calculateUnownedBankRent(landedSpace, lastRoll?.total)
                          )}{' '}
                          ao Banco Central
                        </strong>
                        .
                      </p>
                    </div>
                  )}

                {(landedSpace.type === 'PROPERTY' || landedSpace.type === 'COMPANY') &&
                  landedOwnership &&
                  landedOwnership.ownerId !== currentPlayer.id && (
                    <div className="bg-rose-950/40 border border-rose-700/50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-300 font-black text-[11px] uppercase">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Propriedade de {landedOwner?.name || 'Outro Jogador'} · Cobrança de Aluguel
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        <strong>{currentPlayer.name}</strong> caiu na propriedade de{' '}
                        <strong className="text-white">{landedOwner?.name}</strong>.{' '}
                        <strong className="text-emerald-300">{landedOwner?.name}</strong>{' '}
                        recebe{' '}
                        <strong className="text-rose-300 font-mono">
                          {formatCurrency(
                            calculateRent(landedSpace, landedOwnership, lastRoll?.total)
                          )}
                        </strong>{' '}
                        de aluguel!
                      </p>
                    </div>
                  )}

                {(landedSpace.type === 'PROPERTY' || landedSpace.type === 'COMPANY') &&
                  landedOwnership &&
                  landedOwnership.ownerId === currentPlayer.id && (
                    <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-black text-[11px] uppercase">
                        <Home className="w-3.5 h-3.5 shrink-0" />
                        <span>Propriedade Própria de {currentPlayer.name}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        <strong>{currentPlayer.name}</strong> é o dono de{' '}
                        <strong>{landedSpace.name}</strong>.{' '}
                        {landedSpace.type === 'PROPERTY' && landedOwnership.houses < 3
                          ? `Pode construir ${
                              landedOwnership.houses === 2 ? 'um Hotel' : 'uma Casa'
                            } nesta rodada.`
                          : 'Nenhuma cobrança devida.'}
                      </p>
                    </div>
                  )}

                {landedSpace.type === 'TAX' && (
                  <div className="bg-rose-950/40 border border-rose-700/50 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-300 font-black text-[11px] uppercase">
                      <Landmark className="w-3.5 h-3.5 shrink-0" />
                      <span>Imposto Obrigatório ao Banco Central</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      <strong>{currentPlayer.name}</strong> caiu em{' '}
                      <strong>{landedSpace.name}</strong> e deve pagar{' '}
                      <strong className="text-rose-300 font-mono">
                        {formatCurrency(
                          landedSpace.taxAmount ?? landedSpace.baseRent ?? 30
                        )}
                      </strong>{' '}
                      ao Banco Central.
                    </p>
                  </div>
                )}

                {/* Status de Decisão Pendente vs Concluída nesta rodada */}
                {pendingTurnNotifs.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    <span>
                      Aguardando <strong>{currentPlayer.name}</strong> confirmar:{' '}
                      <strong>{pendingTurnNotifs[0].title}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* O Que Aconteceu Nesta Jogada (Ações Confirmadas de currentPlayer) */}
          {turnTransactions.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>O Que {currentPlayer.name} Já Fez Nesta Jogada:</span>
              </span>
              <div className="space-y-1.5">
                {turnTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong>{tx.fromName}</strong>
                        <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                        <strong>{tx.toName}</strong>: {tx.description}
                      </span>
                    </div>
                    <strong className="font-mono text-emerald-300 font-black">
                      {formatCurrency(tx.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Últimas Movimentações da Partida (Visível para Todos) */}
      {recentMatchTransactions.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            📋 Últimos Acontecimentos da Partida (Mural da Mesa):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {recentMatchTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-slate-950/90 border border-slate-800/90 rounded-xl px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2"
              >
                <div className="truncate text-slate-300">
                  <strong className="text-white">{tx.fromName}</strong> →{' '}
                  <strong className="text-emerald-300">{tx.toName}</strong>:{' '}
                  <span className="text-slate-400">{tx.description}</span>
                </div>
                <span className="font-mono font-bold text-amber-300 shrink-0">
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
