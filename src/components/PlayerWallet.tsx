import React, { useState, useEffect } from 'react';
import { GameState, Player, BoardSpace, PropertyOwnership, TokenPiece } from '../types/game';
import { formatCurrency, syncManager } from '../utils/sync';
import {
  Wallet,
  Send,
  QrCode,
  Search,
  Building,
  Home,
  MapPin,
  Bell,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Smartphone,
  Dices,
  Play,
  Volume2,
  VolumeX,
  Radio
} from 'lucide-react';
import { PixModal } from './PixModal';
import { QRCodeModal } from './QRCodeModal';
import { PlayerQRModal } from './PlayerQRModal';
import { CityMediaViewer } from './CityMediaViewer';
import { DiceRollerModal } from './DiceRollerModal';
import { TurnLiveSummary } from './TurnLiveSummary';
import { rollDiceAndAdvancePlayer, passTurnToNextPlayer, calculateUnownedBankRent } from '../utils/gameEngine';
import { audio } from '../utils/audio';

interface PlayerWalletProps {
  gameState: GameState;
  activePlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  onUpdateState: (newState: GameState) => void;
}

const TOKEN_ICONS: Record<TokenPiece, string> = {
  car: '🏎️ Carro',
  hat: '🎩 Chapéu',
  ship: '🚢 Navio',
  dog: '🐶 Cãozinho',
  boot: '👢 Bota',
  train: '🚂 Trem',
  thimble: '🧵 Dedal',
  airplane: '✈️ Avião',
};

const COLOR_OPTIONS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const COLOR_BAR_MAP: Record<string, string> = {
  purple: 'bg-purple-600',
  light_blue: 'bg-cyan-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  red: 'bg-rose-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  dark_blue: 'bg-blue-600',
  special: 'bg-slate-500',
};

export const PlayerWallet: React.FC<PlayerWalletProps> = ({
  gameState,
  activePlayerId,
  onSelectPlayer,
  onUpdateState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPixModal, setShowPixModal] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [showDirectQRModal, setShowDirectQRModal] = useState(false);
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [isAlertMutedManually, setIsAlertMutedManually] = useState(false);

  // New player registration state if player not found
  const [regName, setRegName] = useState('');
  const [regToken, setRegToken] = useState<TokenPiece>('car');
  const [regColor, setRegColor] = useState(COLOR_OPTIONS[0]);

  const player = gameState.players.find((p) => p.id === activePlayerId);
  const currentTurnPlayer = gameState.players[gameState.currentTurnPlayerIndex];
  const isMyTurn = gameState.status === 'PLAYING' && currentTurnPlayer?.id === player?.id;
  const hasRolledThisTurn = Boolean(gameState.turnHasRolled);

  // Sound and vibration alert that pulses until the player rolls the dice!
  useEffect(() => {
    if (!isMyTurn || gameState.status !== 'PLAYING' || hasRolledThisTurn || isAlertMutedManually) return;

    // Trigger immediate sound and vibration on turn arrival
    audio.playTurnAlertSound();
    audio.vibrateDevice([300, 150, 300, 150, 500]);

    // Pulsing reminder every 4.5 seconds until dice are rolled
    const timer = setInterval(() => {
      audio.playTurnAlertSound();
      audio.vibrateDevice([250, 120, 250, 120, 400]);
    }, 4500);

    return () => clearInterval(timer);
  }, [isMyTurn, gameState.currentTurnPlayerIndex, hasRolledThisTurn, isAlertMutedManually]);

  const handleRollComplete = (d1: number, d2: number, total: number, isManual?: boolean) => {
    const { updatedState } = rollDiceAndAdvancePlayer(gameState, d1, d2, total, isManual);
    onUpdateState(updatedState);
    audio.playDiceRollSound();
    setShowDiceModal(false);
  };

  const handlePassTurn = () => {
    const updatedState = passTurnToNextPlayer(gameState);
    onUpdateState(updatedState);
    setIsAlertMutedManually(false);
    audio.playClickSound();
  };

  // Handle register new player from smartphone on the local Wi-Fi network
  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;

    const newP: Player = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: regName.trim(),
      tokenPiece: regToken,
      color: regColor,
      balance: gameState.initialBalance,
      currentSpaceSequence: 1,
      inJail: false,
      jailTurns: 0,
      isBankrupt: false,
      joinedAt: Date.now(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('bi_player_id', newP.id);
    }
    await syncManager.registerPlayerOverNetwork(newP, gameState);
    onSelectPlayer(newP.id);
    audio.playCoinSound();
  };

  /* ================= NOTIFICATIONS & ACTIONS ================= */
  const playerNotifications = gameState.notifications.filter(
    (n) => n.targetPlayerId === player?.id && n.status === 'PENDING'
  );

  const handlePayRentNotif = (notifId: string, spaceId: string, amount: number, ownerId?: string) => {
    if (!player) return;
    if (player.balance < amount) {
      alert(`Saldo insuficiente (${formatCurrency(player.balance)}) para pagar o aluguel de ${formatCurrency(amount)}.`);
      audio.playAlertSound();
      return;
    }

    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    const owner = gameState.players.find((p) => p.id === ownerId);

    const updatedPlayers = gameState.players.map((p) => {
      if (p.id === player.id) return { ...p, balance: p.balance - amount };
      if (owner && p.id === owner.id) return { ...p, balance: p.balance + amount };
      return p;
    });

    const newTx = {
      id: `tx-rent-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: owner ? owner.id : 'BANK',
      fromName: player.name,
      toName: owner ? owner.name : 'Banco Central',
      amount,
      category: 'RENT' as const,
      description: `Pagou aluguel de ${space?.name || 'Propriedade'}`,
      spaceId,
      spaceName: space?.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
  };

  const handleBuyPropertyNotif = (notifId: string, spaceId: string, price: number) => {
    if (!player) return;
    if (player.balance < price) {
      alert(`Saldo insuficiente para comprar esta propriedade (${formatCurrency(price)}).`);
      audio.playAlertSound();
      return;
    }

    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    if (!space) return;

    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: p.balance - price } : p
    );

    const updatedOwnerships = {
      ...gameState.ownerships,
      [space.id]: {
        spaceId: space.id,
        ownerId: player.id,
        houses: 0,
        isMortgaged: false,
      },
    };

    const newTx = {
      id: `tx-buy-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount: price,
      category: 'PROPERTY_BUY' as const,
      description: `Comprou o título de propriedade de ${space.name}`,
      spaceId: space.id,
      spaceName: space.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      ownerships: updatedOwnerships,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
  };

  const handlePayBankRentNotif = (notifId: string, spaceId: string, rentAmount: number) => {
    if (!player) return;
    if (player.balance < rentAmount) {
      alert(`Saldo insuficiente (${formatCurrency(player.balance)}) para pagar o aluguel de ${formatCurrency(rentAmount)} ao Banco.`);
      audio.playAlertSound();
      return;
    }

    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: p.balance - rentAmount } : p
    );

    const newTx = {
      id: `tx-bank-rent-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount: rentAmount,
      category: 'RENT' as const,
      description: `Optou por não comprar e pagou aluguel de ${space?.name || 'Propriedade'} ao Banco Central`,
      spaceId,
      spaceName: space?.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
  };

  const handleBuildHouseNotif = (notifId: string, spaceId: string, cost: number) => {
    if (!player) return;
    if (player.balance < cost) {
      alert(`Saldo insuficiente para construir (${formatCurrency(cost)}).`);
      audio.playAlertSound();
      return;
    }

    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    const ownership = gameState.ownerships[spaceId];
    if (!space || !ownership) return;

    const isHotel = ownership.houses === 2;
    const newHouses = ownership.houses + 1;

    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: p.balance - cost } : p
    );

    const updatedOwnerships = {
      ...gameState.ownerships,
      [spaceId]: {
        ...ownership,
        houses: newHouses,
      },
    };

    const newTx = {
      id: `tx-build-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount: cost,
      category: isHotel ? ('HOTEL_BUY' as const) : ('HOUSE_BUY' as const),
      description: isHotel ? `Construiu HOTEL em ${space.name}` : `Construiu a ${newHouses}ª Casa em ${space.name}`,
      spaceId: space.id,
      spaceName: space.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      ownerships: updatedOwnerships,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playHammerSound();
  };

  const handlePayTaxNotif = (notifId: string, spaceId: string, amount: number) => {
    if (!player) return;
    if (player.balance < amount) {
      alert(`Saldo insuficiente (${formatCurrency(player.balance)}) para pagar o imposto de ${formatCurrency(amount)}.`);
      audio.playAlertSound();
      return;
    }

    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: p.balance - amount } : p
    );

    const newTx = {
      id: `tx-tax-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount,
      category: 'TAX' as const,
      description: `Pagou Imposto (${space?.name || 'Imposto'}) ao Banco Central`,
      spaceId,
      spaceName: space?.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
  };

  const handleDismissNotif = (notifId: string) => {
    const updatedNotifs = gameState.notifications.map((n) =>
      n.id === notifId ? { ...n, status: 'DISMISSED' as const } : n
    );
    onUpdateState({ ...gameState, notifications: updatedNotifs });
    audio.playClickSound();
  };

  /* ================= PROPERTIES OWNED & RENT CALCULATION ================= */
  const myProperties = Object.values(gameState.ownerships)
    .filter((o) => o.ownerId === player?.id)
    .map((o) => {
      const space = gameState.customBoardSpaces.find((s) => s.id === o.spaceId);
      return {
        ownership: o,
        space: space!,
      };
    })
    .filter((item) => item.space !== undefined);

  const filteredProperties = myProperties.filter(
    (item) =>
      item.space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.space.colorGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentSpace = player
    ? gameState.customBoardSpaces.find((s) => s.sequence === player.currentSpaceSequence)
    : null;

  // Toggle mortgage
  const handleToggleMortgage = (spaceId: string) => {
    if (!player) return;
    const ownership = gameState.ownerships[spaceId];
    const space = gameState.customBoardSpaces.find((s) => s.id === spaceId);
    if (!ownership || !space) return;

    if (!ownership.isMortgaged) {
      // Mortgage: receive mortgageValue
      const updatedPlayers = gameState.players.map((p) =>
        p.id === player.id ? { ...p, balance: p.balance + space.mortgageValue } : p
      );
      const updatedOwnerships = {
        ...gameState.ownerships,
        [spaceId]: { ...ownership, isMortgaged: true },
      };
      const newTx = {
        id: `tx-mort-${Date.now()}`,
        timestamp: Date.now(),
        fromId: 'BANK',
        toId: player.id,
        fromName: 'Banco Central',
        toName: player.name,
        amount: space.mortgageValue,
        category: 'MORTGAGE' as const,
        description: `Hipotecou ${space.name} e recebeu ${formatCurrency(space.mortgageValue)}`,
        spaceId,
        spaceName: space.name,
      };
      onUpdateState({
        ...gameState,
        players: updatedPlayers,
        ownerships: updatedOwnerships,
        transactions: [newTx, ...gameState.transactions],
      });
      audio.playCoinSound();
    } else {
      // Unmortgage: pay mortgageValue + 10%
      const unmortgageCost = Math.round(space.mortgageValue * 1.1);
      if (player.balance < unmortgageCost) {
        alert(`Saldo insuficiente para resgatar hipoteca (${formatCurrency(unmortgageCost)}).`);
        audio.playAlertSound();
        return;
      }
      const updatedPlayers = gameState.players.map((p) =>
        p.id === player.id ? { ...p, balance: p.balance - unmortgageCost } : p
      );
      const updatedOwnerships = {
        ...gameState.ownerships,
        [spaceId]: { ...ownership, isMortgaged: false },
      };
      const newTx = {
        id: `tx-unmort-${Date.now()}`,
        timestamp: Date.now(),
        fromId: player.id,
        toId: 'BANK',
        fromName: player.name,
        toName: 'Banco Central',
        amount: unmortgageCost,
        category: 'UNMORTGAGE' as const,
        description: `Resgatou hipoteca de ${space.name}`,
        spaceId,
        spaceName: space.name,
      };
      onUpdateState({
        ...gameState,
        players: updatedPlayers,
        ownerships: updatedOwnerships,
        transactions: [newTx, ...gameState.transactions],
      });
      audio.playCoinSound();
    }
  };

  /* ================= IF NO PLAYER SELECTED / REGISTRATION SCREEN ================= */
  if (!player) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Wallet className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white">Abrir Conta no Banco Imobiliário</h2>
            <p className="text-xs text-slate-400 mt-1">
              Participe da partida com sua carteira digital para receber e transferir dinheiro em tempo real.
            </p>
          </div>

          {/* Quick select existing player */}
          {gameState.players.length > 0 && (
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-left">
              <span className="text-[11px] text-slate-400 block font-semibold">
                Ou selecione uma conta já cadastrada:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {gameState.players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('bi_player_id', p.id);
                      }
                      onSelectPlayer(p.id);
                      audio.playClickSound();
                    }}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-left flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs font-bold text-white truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleRegisterAccount} className="space-y-4 text-left text-xs pt-2">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Seu Nome:</label>
              <input
                type="text"
                required
                placeholder="Ex: Gustavo, Juliana..."
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Escolha seu Peão:</label>
              <select
                value={regToken}
                onChange={(e) => setRegToken(e.target.value as TokenPiece)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {Object.entries(TOKEN_ICONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Cor do seu Pino:</label>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRegColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      regColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Abrir Conta e Entrar na Sala</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ================= ACTIVE PLAYER SMARTPHONE WALLET ================= */
  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-5">
      {/* Active Debt / Transaction Push Notifications Banner */}
      {playerNotifications.length > 0 && (
        <div className="space-y-2">
          {playerNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-2xl border shadow-xl flex flex-col gap-3 relative animate-bounce-short ${
                notif.type === 'RENT_DUE'
                  ? 'bg-rose-950/90 border-rose-500 text-white'
                  : notif.type === 'BUY_OFFER'
                  ? 'bg-blue-950/90 border-blue-500 text-white'
                  : 'bg-amber-950/90 border-amber-500 text-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                  <div>
                    <h4 className="font-extrabold text-sm">{notif.title}</h4>
                    <p className="text-xs text-slate-300 mt-0.5">{notif.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissNotif(notif.id)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* City Photo/Video if available */}
              {(() => {
                const targetSpace = notif.spaceId
                  ? gameState.customBoardSpaces.find((s) => s.id === notif.spaceId)
                  : null;
                if (!targetSpace || (!targetSpace.imageUrl && !targetSpace.videoUrl)) return null;
                return (
                  <div className="rounded-xl overflow-hidden">
                    <CityMediaViewer
                      name={targetSpace.name}
                      imageUrl={targetSpace.imageUrl}
                      videoUrl={targetSpace.videoUrl}
                      size="sm"
                    />
                  </div>
                );
              })()}

              {/* Action buttons on notification */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                {notif.type === 'RENT_DUE' && notif.spaceId && notif.amount && (
                  <button
                    onClick={() =>
                      handlePayRentNotif(notif.id, notif.spaceId!, notif.amount!, notif.fromPlayerId)
                    }
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
                  >
                    <span>Pagar Aluguel ({formatCurrency(notif.amount)})</span>
                  </button>
                )}

                {notif.type === 'BUY_OFFER' && notif.spaceId && notif.amount !== undefined && (() => {
                  const targetSpace = gameState.customBoardSpaces.find((s) => s.id === notif.spaceId);
                  const bankRentVal =
                    notif.secondaryAmount ??
                    (targetSpace
                      ? calculateUnownedBankRent(targetSpace, gameState.lastDiceRoll?.total)
                      : 0);
                  return (
                    <>
                      <button
                        onClick={() => handleBuyPropertyNotif(notif.id, notif.spaceId!, notif.amount!)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>Comprar ({formatCurrency(notif.amount)})</span>
                      </button>
                      <button
                        onClick={() => handlePayBankRentNotif(notif.id, notif.spaceId!, bankRentVal)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5"
                      >
                        <span>Pagar Aluguel ao Banco ({formatCurrency(bankRentVal)})</span>
                      </button>
                    </>
                  );
                })()}

                {notif.type === 'BUILD_OFFER' && notif.spaceId && notif.amount && (
                  <button
                    onClick={() => handleBuildHouseNotif(notif.id, notif.spaceId!, notif.amount!)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1.5"
                  >
                    <Home className="w-4 h-4" />
                    <span>Construir ({formatCurrency(notif.amount)})</span>
                  </button>
                )}

                {notif.type === 'TAX_DUE' && notif.spaceId && notif.amount && (
                  <button
                    onClick={() => handlePayTaxNotif(notif.id, notif.spaceId!, notif.amount!)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
                  >
                    <span>Pagar Imposto ao Banco ({formatCurrency(notif.amount)})</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turn Action Banner or Live Watch Banner */}
      {gameState.status === 'PLAYING' && (
        <>
          {isMyTurn ? (
            /* ================= MY TURN: ROLL DICE & ALERT ================= */
            !hasRolledThisTurn ? (
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-slate-900 border-2 border-amber-400 shadow-2xl space-y-3.5 relative overflow-hidden animate-pulse">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black animate-bounce shrink-0">
                      <Dices className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-base font-black text-amber-300 tracking-tight flex items-center gap-1.5 truncate">
                        <span>É A SUA VEZ DE JOGAR!</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                        Toque no botão abaixo para lançar os dados
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setIsAlertMutedManually(!isAlertMutedManually);
                        audio.playClickSound();
                      }}
                      title={isAlertMutedManually ? 'Reativar alarme de vez' : 'Silenciar alarme de vez'}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                    >
                      {isAlertMutedManually ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-400/40">
                      Rodada {gameState.roundNumber}
                    </span>
                  </div>
                </div>

                {/* Primary Button to Roll Dice */}
                <div className="pt-1">
                  <button
                    onClick={() => setShowDiceModal(true)}
                    className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 hover:from-amber-300 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Dices className="w-5 h-5" />
                    <span>JOGAR / LANÇAR DADOS AGORA</span>
                  </button>
                </div>
              </div>
            ) : (
              /* MY TURN AFTER ROLL */
              <div className="p-5 rounded-3xl bg-slate-900 border border-emerald-500/60 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Jogada Realizada · Sua Vez
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Rodada {gameState.roundNumber}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handlePassTurn}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Passar a Vez para o Próximo Jogador</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ) : null}

          {/* Painel ao Vivo da Rodada para TODOS os jogadores saberem tudo o que aconteceu */}
          <TurnLiveSummary gameState={gameState} viewerPlayerId={player.id} />
        </>
      )}

      {/* Modern Digital Debit Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/40 shadow-2xl space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg font-bold border shrink-0"
              style={{ backgroundColor: `${player.color}25`, borderColor: player.color }}
            >
              {TOKEN_ICONS[player.tokenPiece].slice(0, 2)}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-emerald-400 block truncate">
                Conta Digital do Jogador
              </span>
              <h3 className="text-sm sm:text-base font-black text-white truncate">{player.name}</h3>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
              Banco Central
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">Sala {gameState.roomId}</span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-400">Saldo Disponível em Conta:</span>
          <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
            <span className="text-emerald-400 text-2xl font-bold">R$</span>
            <span>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(player.balance)}</span>
          </div>
        </div>

        {/* Quick Action Buttons (Pix Transfer, Receive QR & Direct Phone QR) */}
        <div className="grid grid-cols-3 gap-2 pt-1 sm:pt-2">
          <button
            onClick={() => setShowPixModal(true)}
            className="py-2.5 px-2 sm:px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-[11px] sm:text-xs shadow-lg shadow-emerald-600/25 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Transferir</span>
          </button>

          <button
            onClick={() => setShowMyQR(true)}
            className="py-2.5 px-2 sm:px-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-95 text-slate-200 font-bold text-[11px] sm:text-xs border border-slate-700 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Receber Pix</span>
          </button>

          <button
            onClick={() => setShowDirectQRModal(true)}
            title="Compartilhar ou abrir esta carteira em outro celular"
            className="py-2.5 px-2 sm:px-3 rounded-2xl bg-cyan-950/70 hover:bg-cyan-900/90 active:scale-95 text-cyan-200 font-bold text-[11px] sm:text-xs border border-cyan-800/60 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">QR Celular</span>
          </button>
        </div>
      </div>

      {/* Current Position on Physical Board */}
      {currentSpace && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Sua Posição no Tabuleiro Físico
              </span>
              <strong className="text-white text-sm block">{currentSpace.name}</strong>
              <span className="text-[11px] text-slate-400">
                Casa #{currentSpace.sequence} de {gameState.customBoardSpaces.length}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                COLOR_BAR_MAP[currentSpace.colorGroup] || 'bg-slate-700'
              } text-white`}
            >
              {currentSpace.propertyType || 'Propriedade'}
            </span>
          </div>
        </div>
      )}

      {/* "Minhas Propriedades" Section with Instant Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-white text-sm">
              Minhas Propriedades ({myProperties.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Títulos de Posse</span>
        </div>

        {/* Quick Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar cidade ou tipo de propriedade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Properties List */}
        {filteredProperties.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs space-y-1">
            <p>Você ainda não possui propriedades ou nenhuma corresponde à busca.</p>
            <p className="text-[11px] text-slate-600">
              Ao cair em uma cidade livre no tabuleiro físico, você poderá comprá-la.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProperties.map(({ space, ownership }) => {
              const colorBarClass = COLOR_BAR_MAP[space.colorGroup] || 'bg-slate-600';

              // Calculate current rent based on houses (0 = Aluguel, 1 = 1 Casa, 2 = 2 Casas, >=3 = Hotel)
              let currentRent = space.baseRent;
              if (ownership.houses === 1) currentRent = space.rent1House;
              if (ownership.houses === 2) currentRent = space.rent2Houses;
              if (ownership.houses >= 3) currentRent = space.rentHotel;

              return (
                <div
                  key={space.id}
                  className={`bg-slate-950 rounded-2xl border overflow-hidden transition-all ${
                    ownership.isMortgaged ? 'border-rose-900/60 opacity-60' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top color bar with city name */}
                  <div className={`h-2 w-full ${colorBarClass}`} />

                  {/* City Photo / Video thumbnail if present */}
                  {(space.imageUrl || space.videoUrl) && (
                    <div className="p-2 pb-0">
                      <CityMediaViewer
                        name={space.name}
                        imageUrl={space.imageUrl}
                        videoUrl={space.videoUrl}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-white text-sm">{space.name}</strong>
                          <span className="text-[10px] text-slate-500 font-mono">
                            #{space.sequence}
                          </span>
                          {space.propertyType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                              {space.propertyType}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Valor de Compra: {space.price > 0 ? formatCurrency(space.price) : 'A definir'}
                        </span>
                      </div>

                      {/* Houses / Hotel Indicator */}
                      <div className="text-right">
                        {ownership.houses >= 3 ? (
                          <span className="text-xs font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                            🏨 HOTEL
                          </span>
                        ) : ownership.houses > 0 ? (
                          <div className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold">
                            {Array.from({ length: ownership.houses }).map((_, i) => (
                              <span key={i}>🏠</span>
                            ))}
                            <span className="text-[11px] ml-1 font-mono">{ownership.houses}C</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-semibold">Sem casas</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 border-t border-slate-850 text-xs gap-2">
                      <div>
                        <span className="text-slate-400 text-[11px]">Rendimento de Aluguel:</span>
                        <div className="font-mono font-bold text-emerald-400">
                          {ownership.isMortgaged ? 'R$ 0 (Hipotecado)' : formatCurrency(currentRent)}
                        </div>
                      </div>

                      {/* Mortgage Button */}
                      <button
                        onClick={() => handleToggleMortgage(space.id)}
                        className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                          ownership.isMortgaged
                            ? 'bg-rose-900/60 text-rose-200 border border-rose-700 hover:bg-rose-800'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {ownership.isMortgaged
                          ? `Resgatar (${formatCurrency(Math.round(space.mortgageValue * 1.1))})`
                          : `Hipotecar (+${formatCurrency(space.mortgageValue)})`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account switch option for mobile device */}
      <div className="pt-2 pb-4 text-center">
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('bi_player_id');
            }
            onSelectPlayer('');
            audio.playClickSound();
          }}
          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 transition-colors"
        >
          Trocar de jogador neste celular
        </button>
      </div>

      {/* Pix Modal */}
      <PixModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        sender={player}
        allPlayers={gameState.players}
        onTransfer={(fromId, toId, amount, description) => {
          const fromP = gameState.players.find((p) => p.id === fromId);
          const toP = gameState.players.find((p) => p.id === toId);

          const updatedPlayers = gameState.players.map((p) => {
            if (p.id === fromId) return { ...p, balance: p.balance - amount };
            if (p.id === toId) return { ...p, balance: p.balance + amount };
            return p;
          });

          const newTx = {
            id: `tx-pix-${Date.now()}`,
            timestamp: Date.now(),
            fromId,
            toId,
            fromName: fromP ? fromP.name : 'Banco Central',
            toName: toP ? toP.name : 'Banco Central',
            amount,
            category: 'TRANSFER_PIX' as const,
            description,
          };

          onUpdateState({
            ...gameState,
            players: updatedPlayers,
            transactions: [newTx, ...gameState.transactions],
          });
        }}
      />

      {/* QR Code Modal for Receiving */}
      <QRCodeModal
        isOpen={showMyQR}
        onClose={() => setShowMyQR(false)}
        title={`Chave Pix de ${player.name}`}
        subtitle="Outros jogadores podem escanear este QR code para transferir valores diretamente para sua conta."
        value={`pix:bancoimobiliario:${gameState.roomId}:${player.id}`}
      />

      {/* Direct Player QR Modal */}
      <PlayerQRModal
        isOpen={showDirectQRModal}
        onClose={() => setShowDirectQRModal(false)}
        player={player}
        allPlayers={gameState.players}
        roomId={gameState.roomId}
      />

      {/* Dice Roller Modal directly on the player's smartphone */}
      <DiceRollerModal
        isOpen={showDiceModal}
        onClose={() => setShowDiceModal(false)}
        playerName={player.name}
        onRollComplete={handleRollComplete}
      />
    </div>
  );
};
