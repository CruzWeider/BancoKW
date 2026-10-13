import React from 'react';
import { GameState, Player, TokenPiece } from '../types/game';
import {
  Building2,
  Wallet,
  TableProperties,
  ReceiptText,
  Trophy,
  Volume2,
  VolumeX,
  LogOut,
  ArrowLeftRight
} from 'lucide-react';
import { audio } from '../utils/audio';
import { InstallPWAButton } from './InstallPWAButton';

export type ActiveTab = 'BANK' | 'WALLET' | 'BOARD_CUSTOMIZER' | 'TRANSACTIONS' | 'RANKING';

const TOKEN_ICONS: Record<TokenPiece, string> = {
  car: '🏎️',
  hat: '🎩',
  ship: '🚢',
  dog: '🐶',
  boot: '👢',
  train: '🚂',
  thimble: '🧵',
  airplane: '✈️',
};

interface HeaderNavProps {
  gameState: GameState;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isPlayerDevice: boolean;
  onToggleDeviceRole: () => void;
  currentPlayer: Player | null;
  onLeavePlayer?: () => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  gameState,
  activeTab,
  setActiveTab,
  isPlayerDevice,
  onToggleDeviceRole,
  currentPlayer,
  onLeavePlayer,
  isMuted,
  setIsMuted,
}) => {
  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMuted(nextMuted);
    if (!nextMuted) audio.playClickSound();
  };

  const currentTurnPlayer = gameState.players[gameState.currentTurnPlayerIndex];
  const isMyTurn = gameState.status === 'PLAYING' && currentTurnPlayer?.id === currentPlayer?.id;
  const hasRolledThisTurn = Boolean(gameState.turnHasRolled);

  return (
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 space-y-2 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        {/* Top bar on mobile / Left area on desktop */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand Banco KW */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/icon.svg"
              alt="Banco KW"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shadow-emerald-500/10 border border-amber-500/40 shrink-0"
            />
            <div>
              <div className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 leading-none">
                <span>Banco KW</span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Digital
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 leading-none">
                <span>Sala: <strong className="text-slate-200">{gameState.roomId}</strong></span>
                <span className="hidden sm:inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {isPlayerDevice ? 'Modo Jogador' : 'Painel do Banco'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick action buttons on mobile (Install App, Mode Switch, Sound & Logout) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <InstallPWAButton />

            <button
              type="button"
              onClick={onToggleDeviceRole}
              title={isPlayerDevice ? 'Alternar para Banco Central' : 'Alternar para Carteira do Jogador'}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
              <span>{isPlayerDevice ? 'Banco' : 'Jogador'}</span>
            </button>

            {isPlayerDevice && onLeavePlayer && currentPlayer && (
              <button
                onClick={onLeavePlayer}
                title="Trocar de conta neste celular"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-850 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleSound}
              title={isMuted ? 'Ativar Sons' : 'Silenciar'}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Center / Navigation Controls - Row 2 on mobile, Center on desktop */}
        <div className="w-full md:w-auto overflow-x-auto scrollbar-none py-0.5">
          {isPlayerDevice ? (
            /* ================= PLAYER'S CELL PHONE VIEW ================= */
            <div className="flex items-center gap-2 min-w-max">
              {currentPlayer && (
                <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-sm shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentPlayer.color }}
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1 truncate max-w-[110px] sm:max-w-none">
                    <span>{TOKEN_ICONS[currentPlayer.tokenPiece] || '👤'}</span>
                    <span className="truncate">{currentPlayer.name}</span>
                  </span>
                  {isMyTurn && !hasRolledThisTurn && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 animate-pulse shrink-0">
                      Sua Vez! 🎲
                    </span>
                  )}
                </div>
              )}

              <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    setActiveTab('WALLET');
                    audio.playClickSound();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === 'WALLET'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Minha Carteira</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('TRANSACTIONS');
                    audio.playClickSound();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === 'TRANSACTIONS'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Extrato</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('RANKING');
                    audio.playClickSound();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === 'RANKING'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Ranking</span>
                </button>
              </nav>
            </div>
          ) : (
            /* ================= BANK MEDIATOR NAVIGATION ================= */
            <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 min-w-max">
              <button
                onClick={() => {
                  setActiveTab('BANK');
                  audio.playClickSound();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'BANK'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Banco Central</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('BOARD_CUSTOMIZER');
                  audio.playClickSound();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'BOARD_CUSTOMIZER'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>Cadastro do Tabuleiro</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('TRANSACTIONS');
                  audio.playClickSound();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'TRANSACTIONS'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ReceiptText className="w-3.5 h-3.5" />
                <span>Extrato</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('RANKING');
                  audio.playClickSound();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'RANKING'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Ranking</span>
              </button>
            </nav>
          )}
        </div>

        {/* Action Controls on Desktop */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <InstallPWAButton />

          <button
            type="button"
            onClick={onToggleDeviceRole}
            title={isPlayerDevice ? 'Alternar para Painel do Banco Central' : 'Alternar para Carteira do Jogador'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
            <span>{isPlayerDevice ? 'Ver Banco' : 'Modo Jogador'}</span>
          </button>

          {isPlayerDevice && onLeavePlayer && currentPlayer && (
            <button
              onClick={onLeavePlayer}
              title="Trocar de conta neste celular"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-850 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={toggleSound}
            title={isMuted ? 'Ativar Sons' : 'Silenciar'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
