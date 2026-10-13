import React, { useState } from 'react';
import { GameState, Player, BoardSpace, PropertyOwnership, TokenPiece } from '../types/game';
import { formatCurrency, syncManager } from '../utils/sync';
import { LUCK_CARDS } from '../data/defaultBoard';
import {
  Play,
  Dices,
  QrCode,
  Users,
  Plus,
  Trash2,
  DollarSign,
  Building,
  Home,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Scale,
  Trophy,
  Crown,
  Database,
  FolderPlus,
  Wifi
} from 'lucide-react';
import { DiceRollerModal } from './DiceRollerModal';
import { QRCodeModal } from './QRCodeModal';
import { PixModal } from './PixModal';
import { PlayerQRModal } from './PlayerQRModal';
import { CityMediaViewer } from './CityMediaViewer';
import { FinishMatchModal } from './FinishMatchModal';
import { MatchOverviewCard } from './MatchOverviewCard';
import { TurnLiveSummary } from './TurnLiveSummary';
import { calculateUnownedBankRent } from '../utils/gameEngine';
import { audio } from '../utils/audio';

interface BankDashboardProps {
  gameState: GameState;
  onUpdateState: (newState: GameState) => void;
  onSwitchToPlayer?: (playerId: string) => void;
  onFinishMatch?: (winnerId: string) => void;
  onOpenBoardCustomizer?: () => void;
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

export const BankDashboard: React.FC<BankDashboardProps> = ({
  gameState,
  onUpdateState,
  onSwitchToPlayer,
  onFinishMatch,
  onOpenBoardCustomizer,
}) => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixSender, setPixSender] = useState<Player | null>(null);
  const [playerForQR, setPlayerForQR] = useState<Player | null>(null);
  const [showPlayerQRModal, setShowPlayerQRModal] = useState(false);
  const [showFinishMatchModal, setShowFinishMatchModal] = useState(false);

  // Modal de Nova Partida (Fecha a sala antiga e abre uma nova sala)
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomNameInput, setNewRoomNameInput] = useState('');
  const [keepPlayersInNewRoom, setKeepPlayersInNewRoom] = useState(false);

  // New player form for lobby
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newToken, setNewToken] = useState<TokenPiece>('ship');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[2]);

  // Initial balance settings
  const [initBalanceInput, setInitBalanceInput] = useState(gameState.initialBalance);
  const [salaryInput, setSalaryInput] = useState(gameState.salaryAmount);

  // Action feedback message
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' | 'info' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'warn' | 'info' = 'info') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const currentPlayer = gameState.players[gameState.currentTurnPlayerIndex] || gameState.players[0];

  const currentSpace =
    gameState.customBoardSpaces.find(
      (s) => s.sequence === (currentPlayer?.currentSpaceSequence || 1)
    ) ||
    gameState.customBoardSpaces[0] ||
    null;

  const currentOwnership = currentSpace ? gameState.ownerships[currentSpace.id] : null;
  const propertyOwner = currentOwnership
    ? gameState.players.find((p) => p.id === currentOwnership.ownerId)
    : null;

  // URL na Rede Local (Wi-Fi) para qualquer celular na mesma rede se cadastrar
  const networkOrigin = syncManager.getNetworkOrigin();
  const joinUrl =
    typeof window !== 'undefined'
      ? `${networkOrigin}${window.location.pathname}?room=${gameState.roomId}&role=player`
      : `${networkOrigin}?room=${gameState.roomId}&role=player`;

  /* ================= LOBBY ACTIONS ================= */
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    const newP: Player = {
      id: `p-${Date.now()}`,
      name: newPlayerName.trim(),
      tokenPiece: newToken,
      color: newColor,
      balance: gameState.initialBalance,
      currentSpaceSequence: 1,
      inJail: false,
      jailTurns: 0,
      isBankrupt: false,
      joinedAt: Date.now(),
    };

    onUpdateState({
      ...gameState,
      players: [...gameState.players, newP],
    });

    setNewPlayerName('');
    audio.playClickSound();
    showFeedback(`Jogador ${newP.name} adicionado à partida!`, 'success');
  };

  const handleRemovePlayer = (id: string) => {
    const updated = gameState.players.filter((p) => p.id !== id);
    onUpdateState({
      ...gameState,
      players: updated,
      currentTurnPlayerIndex: 0,
    });
    audio.playClickSound();
  };

  const handleStartGame = () => {
    if (gameState.players.length < 2) {
      alert('São necessários pelo menos 2 jogadores para iniciar a partida.');
      return;
    }

    // Distribute equal initial balance
    const updatedPlayers = gameState.players.map((p) => ({
      ...p,
      balance: initBalanceInput,
      currentSpaceSequence: 1,
    }));

    // Register initial deposits transactions
    const depositTransactions = updatedPlayers.map((p) => ({
      id: `tx-init-${p.id}-${Date.now()}`,
      timestamp: Date.now(),
      fromId: 'BANK',
      toId: p.id,
      fromName: 'Banco Central',
      toName: p.name,
      amount: initBalanceInput,
      category: 'INITIAL_DEPOSIT' as const,
      description: `Distribuição de saldo inicial de abertura de conta (${formatCurrency(initBalanceInput)})`,
    }));

    onUpdateState({
      ...gameState,
      status: 'PLAYING',
      initialBalance: initBalanceInput,
      salaryAmount: salaryInput,
      players: updatedPlayers,
      roundNumber: 1,
      currentTurnPlayerIndex: 0,
      turnHasRolled: false,
      turnStartedAt: Date.now(),
      transactions: [...depositTransactions, ...gameState.transactions],
    });

    audio.playVictoryFanfare();
    showFeedback('Partida iniciada! Saldo distribuído a todos os jogadores.', 'success');
  };

  /* ================= IN-GAME TURN & DICE ROLL ================= */
  const handleRollComplete = (d1: number, d2: number, total: number, isManual?: boolean) => {
    if (!currentPlayer) return;

    const totalSpaces = gameState.customBoardSpaces.length;
    let nextSeq = currentPlayer.currentSpaceSequence + total;
    let passedStart = false;

    if (totalSpaces > 0 && nextSeq > totalSpaces) {
      nextSeq = ((nextSeq - 1) % totalSpaces) + 1;
      passedStart = true;
    }

    const landedSpace = totalSpaces > 0 ? gameState.customBoardSpaces.find((s) => s.sequence === nextSeq) : undefined;
    const newTransactions = [...gameState.transactions];
    const newNotifications = [...gameState.notifications];
    let updatedBalance = currentPlayer.balance;

    // Passed Start salary (+R$ 2.000)
    if (passedStart) {
      updatedBalance += gameState.salaryAmount;
      newTransactions.unshift({
        id: `tx-sal-${Date.now()}`,
        roomId: gameState.roomId,
        roomName: gameState.roomName,
        timestamp: Date.now(),
        fromId: 'BANK',
        toId: currentPlayer.id,
        fromName: 'Banco Central',
        toName: currentPlayer.name,
        amount: gameState.salaryAmount,
        category: 'SALARY',
        description: `Passou pelo Ponto de Partida e recebeu ${formatCurrency(gameState.salaryAmount)}`,
      });
      audio.playCoinSound();
      showFeedback(`${currentPlayer.name} passou pelo Ponto de Partida e recebeu ${formatCurrency(gameState.salaryAmount)}!`, 'success');
    }

    // Go to jail space?
    let inJail = currentPlayer.inJail;
    if (landedSpace?.type === 'GO_TO_JAIL') {
      const jailSpace = gameState.customBoardSpaces.find((s) => s.type === 'JAIL');
      nextSeq = jailSpace ? jailSpace.sequence : 1;
      inJail = true;
      audio.playAlertSound();
      showFeedback(`🚨 ${currentPlayer.name} foi enviado direto para a prisão!`, 'warn');
    }

    // Auto-dispatch notification to player's smartphone
    if (landedSpace) {
      const ownership = gameState.ownerships[landedSpace.id];
      if (landedSpace.type === 'PROPERTY' || landedSpace.type === 'COMPANY') {
        if (!ownership) {
          // Propriedade sem dono: Escolha entre Comprar ou Pagar Aluguel ao Banco
          const bankRent = calculateUnownedBankRent(landedSpace, total);
          const isCompany = landedSpace.type === 'COMPANY' || landedSpace.propertyType === 'Companhia';
          newNotifications.unshift({
            id: `notif-${Date.now()}`,
            targetPlayerId: currentPlayer.id,
            type: 'BUY_OFFER',
            title: `Comprar ${landedSpace.name} ou Pagar Aluguel ao Banco?`,
            message: isCompany
              ? `Você caiu em ${landedSpace.name} (do Banco) com ${total} nos dados. Escolha: Comprar por ${formatCurrency(landedSpace.price)} ou Pagar Aluguel de ${formatCurrency(bankRent)} (${total} × ${formatCurrency(landedSpace.baseRent || 50)}) ao Banco.`
              : `Você caiu em ${landedSpace.name} (do Banco). Escolha: Comprar por ${formatCurrency(landedSpace.price)} ou Pagar Aluguel de ${formatCurrency(bankRent)} ao Banco Central.`,
            amount: landedSpace.price,
            secondaryAmount: bankRent,
            spaceId: landedSpace.id,
            createdAt: Date.now(),
            status: 'PENDING',
          });
        } else if (ownership.ownerId !== currentPlayer.id && !ownership.isMortgaged) {
          // Owned by someone else: Rent Due
          const isCompany = landedSpace.type === 'COMPANY' || landedSpace.propertyType === 'Companhia';
          const rentVal = calculateRent(landedSpace, ownership, total);
          const ownerPlayer = gameState.players.find((p) => p.id === ownership.ownerId);
          newNotifications.unshift({
            id: `notif-${Date.now()}`,
            targetPlayerId: currentPlayer.id,
            type: 'RENT_DUE',
            title: `Cobrança de Aluguel: ${landedSpace.name}`,
            message: isCompany
              ? `Você tirou ${total} nos dados na companhia de ${ownerPlayer?.name || 'outro jogador'} (${total} × ${formatCurrency(landedSpace.baseRent || 50)}). Aluguel devido: ${formatCurrency(rentVal)}.`
              : `Você caiu na propriedade de ${ownerPlayer?.name || 'outro jogador'}. Aluguel devido: ${formatCurrency(rentVal)}.`,
            amount: rentVal,
            spaceId: landedSpace.id,
            fromPlayerId: ownership.ownerId,
            createdAt: Date.now(),
            status: 'PENDING',
          });
        } else if (ownership.ownerId === currentPlayer.id && landedSpace.type === 'PROPERTY') {
          // Landing on own property: Offer build house (up to 2 houses, then Hotel)
          if (ownership.houses < 3) {
            const isHotel = ownership.houses === 2;
            const buildCost = isHotel ? (landedSpace.hotelCost ?? landedSpace.houseCost) : landedSpace.houseCost;
            newNotifications.unshift({
              id: `notif-${Date.now()}`,
              targetPlayerId: currentPlayer.id,
              type: 'BUILD_OFFER',
              title: isHotel ? `Construir Hotel em ${landedSpace.name}` : `Construir Casa em ${landedSpace.name}`,
              message: `Aumente seu aluguel investindo ${formatCurrency(buildCost)}.`,
              amount: buildCost,
              spaceId: landedSpace.id,
              createdAt: Date.now(),
              status: 'PENDING',
            });
          }
        }
      } else if (landedSpace.type === 'TAX') {
        const taxVal = landedSpace.taxAmount ?? landedSpace.baseRent ?? landedSpace.price ?? 0;
        if (taxVal > 0) {
          newNotifications.unshift({
            id: `notif-${Date.now()}`,
            targetPlayerId: currentPlayer.id,
            type: 'TAX_DUE',
            title: `Imposto ao Banco: ${landedSpace.name}`,
            message: `Você caiu em ${landedSpace.name}. Pague ${formatCurrency(taxVal)} de imposto para o Banco Central.`,
            amount: taxVal,
            spaceId: landedSpace.id,
            createdAt: Date.now(),
            status: 'PENDING',
          });
        }
      }
    }

    const updatedPlayers = gameState.players.map((p) =>
      p.id === currentPlayer.id
        ? {
            ...p,
            currentSpaceSequence: nextSeq,
            balance: updatedBalance,
            inJail,
          }
        : p
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: newTransactions,
      notifications: newNotifications,
      lastDiceRoll: {
        dice1: d1,
        dice2: d2,
        total,
        playerId: currentPlayer.id,
        timestamp: Date.now(),
        isManual,
        spaceId: landedSpace?.id,
        spaceName: landedSpace?.name || 'Tabuleiro Físico',
        spaceSequence: nextSeq,
      },
      turnHasRolled: true,
    });
  };

  const handleNextTurn = () => {
    if (gameState.players.length === 0) return;
    const nextIdx = (gameState.currentTurnPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextIdx];
    const newRound = nextIdx === 0 ? gameState.roundNumber + 1 : gameState.roundNumber;

    onUpdateState({
      ...gameState,
      currentTurnPlayerIndex: nextIdx,
      roundNumber: newRound,
      turnHasRolled: false,
      turnStartedAt: Date.now(),
    });
    audio.playClickSound();
    showFeedback(`Vez de ${nextPlayer.name}!`, 'info');
  };

  const handleResetToLobby = () => {
    const nextCounter = syncManager.getRoomCounter() + 1;
    setNewRoomNameInput(`Partida #${nextCounter}`);
    setKeepPlayersInNewRoom(false);
    setShowNewRoomModal(true);
    audio.playClickSound();
  };

  const handleConfirmOpenNewRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const oldRoomId = gameState.roomId;
    const newRoomState = syncManager.closeCurrentRoomAndOpenNew(gameState, {
      newRoomName: newRoomNameInput.trim(),
      keepPlayers: keepPlayersInNewRoom,
    });
    onUpdateState(newRoomState);
    setShowNewRoomModal(false);
    audio.playVictoryFanfare();
    showFeedback(
      `Sala ${oldRoomId} fechada e salva no banco! Nova sala ${newRoomState.roomId} aberta.`,
      'success'
    );
  };

  const handleFinishMatchClick = () => {
    audio.playClickSound();
    setShowFinishMatchModal(true);
  };

  /* ================= PROPERTY MANAGEMENT ================= */
  const calculateRent = (
    space: BoardSpace,
    ownership: PropertyOwnership,
    diceTotalOverride?: number
  ): number => {
    if (ownership.isMortgaged) return 0;
    if (space.type === 'COMPANY' || space.propertyType === 'Companhia') {
      const multiplier = space.baseRent || 50;
      const diceSum = diceTotalOverride ?? gameState.lastDiceRoll?.total ?? 1;
      return diceSum * multiplier;
    }
    if (ownership.houses === 0) return space.baseRent;
    if (ownership.houses === 1) return space.rent1House;
    if (ownership.houses === 2) return space.rent2Houses;
    if (ownership.houses >= 3) return space.rentHotel;
    return space.baseRent;
  };

  // Buy Property from Bank
  const handleBuyProperty = (space: BoardSpace, buyer: Player) => {
    if (buyer.balance < space.price) {
      alert(`Saldo insuficiente de ${buyer.name} para comprar ${space.name} (${formatCurrency(space.price)}).`);
      audio.playAlertSound();
      return;
    }

    const updatedPlayers = gameState.players.map((p) =>
      p.id === buyer.id ? { ...p, balance: p.balance - space.price } : p
    );

    const updatedOwnerships = {
      ...gameState.ownerships,
      [space.id]: {
        spaceId: space.id,
        ownerId: buyer.id,
        houses: 0,
        isMortgaged: false,
      },
    };

    const newTx = {
      id: `tx-buy-${Date.now()}`,
      timestamp: Date.now(),
      fromId: buyer.id,
      toId: 'BANK',
      fromName: buyer.name,
      toName: 'Banco Central',
      amount: space.price,
      category: 'PROPERTY_BUY' as const,
      description: `Comprou o título de propriedade de ${space.name}`,
      spaceId: space.id,
      spaceName: space.name,
    };

    // Resolve any pending buy notification for this space
    const updatedNotifs = gameState.notifications.map((n) =>
      n.spaceId === space.id && n.type === 'BUY_OFFER' ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      ownerships: updatedOwnerships,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
    showFeedback(`${buyer.name} comprou ${space.name} por ${formatCurrency(space.price)}!`, 'success');
  };

  // Pay Rent to Bank when landing on an unowned property and choosing not to buy
  const handlePayRentToBank = (space: BoardSpace, tenant: Player) => {
    const diceSum = gameState.lastDiceRoll?.total ?? 1;
    const bankRent = calculateUnownedBankRent(space, diceSum);

    if (tenant.balance < bankRent) {
      alert(
        `${tenant.name} não possui saldo suficiente (${formatCurrency(tenant.balance)}) para pagar o aluguel de ${formatCurrency(bankRent)} ao Banco Central.`
      );
      audio.playAlertSound();
    }

    const updatedPlayers = gameState.players.map((p) =>
      p.id === tenant.id ? { ...p, balance: p.balance - bankRent } : p
    );

    const newTx = {
      id: `tx-bank-rent-${Date.now()}`,
      timestamp: Date.now(),
      fromId: tenant.id,
      toId: 'BANK',
      fromName: tenant.name,
      toName: 'Banco Central',
      amount: bankRent,
      category: 'RENT' as const,
      description: `Optou por não comprar e pagou aluguel de ${space.name} ao Banco Central`,
      spaceId: space.id,
      spaceName: space.name,
    };

    const updatedNotifs = gameState.notifications.map((n) =>
      n.spaceId === space.id && n.type === 'BUY_OFFER' ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
    showFeedback(
      `${tenant.name} optou por não comprar e pagou ${formatCurrency(bankRent)} de aluguel ao Banco Central!`,
      'info'
    );
  };

  // Pay Rent (Transfer from player to property owner)
  const handlePayRent = (space: BoardSpace, tenant: Player, owner: Player) => {
    const ownership = gameState.ownerships[space.id];
    if (!ownership) return;
    const isCompany = space.type === 'COMPANY' || space.propertyType === 'Companhia';
    const diceSum = gameState.lastDiceRoll?.total ?? 1;
    const rentAmount = calculateRent(space, ownership, diceSum);

    if (tenant.balance < rentAmount) {
      alert(`${tenant.name} não possui saldo suficiente (${formatCurrency(tenant.balance)}) para pagar o aluguel de ${formatCurrency(rentAmount)}. É necessário hipotecar bens ou declarar falência.`);
      audio.playAlertSound();
    }

    const updatedPlayers = gameState.players.map((p) => {
      if (p.id === tenant.id) return { ...p, balance: p.balance - rentAmount };
      if (p.id === owner.id) return { ...p, balance: p.balance + rentAmount };
      return p;
    });

    const newTx = {
      id: `tx-rent-${Date.now()}`,
      timestamp: Date.now(),
      fromId: tenant.id,
      toId: owner.id,
      fromName: tenant.name,
      toName: owner.name,
      amount: rentAmount,
      category: 'RENT' as const,
      description: isCompany
        ? `Aluguel de ${space.name} (Dados: ${diceSum} × ${formatCurrency(space.baseRent || 50)})`
        : `Aluguel de ${space.name} (${ownership.houses >= 3 ? 'Hotel' : `${ownership.houses} Casa(s)`})`,
      spaceId: space.id,
      spaceName: space.name,
    };

    // Mark notification resolved
    const updatedNotifs = gameState.notifications.map((n) =>
      n.spaceId === space.id && n.type === 'RENT_DUE' ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playCoinSound();
    showFeedback(`Aluguel de ${formatCurrency(rentAmount)} pago por ${tenant.name} para ${owner.name}!`, 'success');
  };

  // Build House / Hotel (2 Casas + Hotel)
  const handleBuildHouse = (space: BoardSpace, owner: Player) => {
    const ownership = gameState.ownerships[space.id];
    if (!ownership || ownership.houses >= 3) return;

    const isUpgradingToHotel = ownership.houses === 2;
    const buildCost = isUpgradingToHotel ? (space.hotelCost ?? space.houseCost) : space.houseCost;

    if (owner.balance < buildCost) {
      alert(`Saldo insuficiente para construir em ${space.name} (${formatCurrency(buildCost)}).`);
      audio.playAlertSound();
      return;
    }

    const newHousesCount = ownership.houses + 1;

    const updatedPlayers = gameState.players.map((p) =>
      p.id === owner.id ? { ...p, balance: p.balance - buildCost } : p
    );

    const updatedOwnerships = {
      ...gameState.ownerships,
      [space.id]: {
        ...ownership,
        houses: newHousesCount,
      },
    };

    const newTx = {
      id: `tx-build-${Date.now()}`,
      timestamp: Date.now(),
      fromId: owner.id,
      toId: 'BANK',
      fromName: owner.name,
      toName: 'Banco Central',
      amount: buildCost,
      category: isUpgradingToHotel ? ('HOTEL_BUY' as const) : ('HOUSE_BUY' as const),
      description: isUpgradingToHotel
        ? `Construiu HOTEL em ${space.name}`
        : `Construiu a ${newHousesCount}ª Casa em ${space.name}`,
      spaceId: space.id,
      spaceName: space.name,
    };

    // Mark build notification resolved
    const updatedNotifs = gameState.notifications.map((n) =>
      n.spaceId === space.id && n.type === 'BUILD_OFFER' ? { ...n, status: 'RESOLVED' as const } : n
    );

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      ownerships: updatedOwnerships,
      transactions: [newTx, ...gameState.transactions],
      notifications: updatedNotifs,
    });

    audio.playHammerSound();
    showFeedback(
      isUpgradingToHotel
        ? `🏨 Hotel construído com sucesso em ${space.name}!`
        : `🏠 Casa adicionada em ${space.name}! Novo aluguel aumentado.`,
      'success'
    );
  };

  /* ================= MEDIATOR SPECIAL ACTIONS ================= */
  const handlePayBail = (player: Player) => {
    const bailAmount = 500;
    if (player.balance < bailAmount) {
      alert(`Saldo insuficiente para pagar fiança (${formatCurrency(bailAmount)}).`);
      return;
    }

    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: p.balance - bailAmount, inJail: false, jailTurns: 0 } : p
    );

    const newTx = {
      id: `tx-bail-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount: bailAmount,
      category: 'FINE' as const,
      description: `Pagamento de fiança para sair da prisão`,
    };

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
    });

    audio.playCoinSound();
    showFeedback(`${player.name} pagou R$ 500 de fiança e está livre!`, 'success');
  };

  const handleDrawLuckCard = (player: Player) => {
    const randomCard = LUCK_CARDS[Math.floor(Math.random() * LUCK_CARDS.length)];
    let newBalance = player.balance;

    if (randomCard.type === 'receive') {
      newBalance += randomCard.amount;
    } else {
      newBalance -= randomCard.amount;
    }

    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, balance: newBalance } : p
    );

    const newTx = {
      id: `tx-luck-${Date.now()}`,
      timestamp: Date.now(),
      fromId: randomCard.type === 'receive' ? 'BANK' : player.id,
      toId: randomCard.type === 'receive' ? player.id : 'BANK',
      fromName: randomCard.type === 'receive' ? 'Banco Central' : player.name,
      toName: randomCard.type === 'receive' ? player.name : 'Banco Central',
      amount: randomCard.amount,
      category: randomCard.type === 'receive' ? ('PROFIT' as const) : ('FINE' as const),
      description: `Sorte ou Revés: ${randomCard.title} - ${randomCard.text}`,
    };

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
    });

    if (randomCard.type === 'receive') {
      audio.playCoinSound();
    } else {
      audio.playAlertSound();
    }

    showFeedback(`🎲 Carta Sorte/Revés para ${player.name}: ${randomCard.text}`, 'info');
  };

  const handleDeclareBankrupt = (player: Player) => {
    if (!window.confirm(`Tem certeza que deseja declarar FALÊNCIA de ${player.name}? Todas as propriedades voltarão ao Banco.`)) return;

    // Release all properties
    const updatedOwnerships = { ...gameState.ownerships };
    Object.keys(updatedOwnerships).forEach((key) => {
      if (updatedOwnerships[key].ownerId === player.id) {
        delete updatedOwnerships[key];
      }
    });

    const updatedPlayers = gameState.players.map((p) =>
      p.id === player.id ? { ...p, isBankrupt: true, balance: 0 } : p
    );

    const newTx = {
      id: `tx-bankrupt-${Date.now()}`,
      timestamp: Date.now(),
      fromId: player.id,
      toId: 'BANK',
      fromName: player.name,
      toName: 'Banco Central',
      amount: 0,
      category: 'FINE' as const,
      description: `Falência decretada. Bens leiloados/devolvidos ao Banco.`,
    };

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      ownerships: updatedOwnerships,
      transactions: [newTx, ...gameState.transactions],
    });

    audio.playAlertSound();
    showFeedback(`🚨 ${player.name} faliu e foi eliminado da partida!`, 'warn');
  };

  /* ================= PIX HANDLER ================= */
  const handlePixTransfer = (fromId: string, toId: string, amount: number, description: string) => {
    const fromPlayer = gameState.players.find((p) => p.id === fromId);
    const toPlayer = gameState.players.find((p) => p.id === toId);

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
      fromName: fromPlayer ? fromPlayer.name : 'Banco Central',
      toName: toPlayer ? toPlayer.name : 'Banco Central',
      amount,
      category: 'TRANSFER_PIX' as const,
      description,
    };

    onUpdateState({
      ...gameState,
      players: updatedPlayers,
      transactions: [newTx, ...gameState.transactions],
    });

    showFeedback(`Pix de ${formatCurrency(amount)} transferido com sucesso!`, 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-slide-up ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
              : feedbackMsg.type === 'warn'
              ? 'bg-amber-950 border-amber-500 text-amber-200'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedbackMsg.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Top Banner & Room Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                <Building className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-black text-white">Banco Central Digital (Mediador)</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controle de partidas, leitura de dados da mesa, automatização de aluguéis e transferências Pix.
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sala Ativa:</span>
            <strong className="text-emerald-400 font-mono font-bold">{gameState.roomId}</strong>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 font-semibold truncate max-w-[130px]">{gameState.roomName}</span>
          </div>
        </div>

        {/* Room Match Actions Linked directly to current room */}
        <div className="flex flex-wrap items-center gap-2 w-full bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            title="Conectar jogadores na mesma rede Wi-Fi pelo QR Code da sala"
          >
            <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>QR da Sala (Wi-Fi)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPlayerForQR(null); // Open all players QR codes
              setShowPlayerQRModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            title="Ver carteiras e QR Codes de todos os jogadores"
          >
            <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>QR Jogadores</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPixSender(null); // Bank as sender
              setShowPixModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-colors"
            title="Transferência Pix do Banco Central para jogador"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>Pix Banco</span>
          </button>

          {gameState.status !== 'FINISHED' && (
            <button
              type="button"
              onClick={handleFinishMatchClick}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              title="Encerrar a partida, calcular patrimônio líquido de todos e coroar o campeão"
            >
              <Trophy className="w-4 h-4 text-slate-950 shrink-0" />
              <span>Finalizar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetToLobby}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-95 transition-all sm:ml-auto"
            title="Fechar a sala atual (salvando todas as transações dela no banco) e abrir uma nova sala"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span>Nova Partida (Nova Sala)</span>
          </button>
        </div>
      </div>

      {/* ================= LOBBY VIEW ================= */}
      {gameState.status === 'LOBBY' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Real-time Match Overview Card */}
          <div className="col-span-1 lg:col-span-3">
            <MatchOverviewCard
              gameState={gameState}
              defaultExpanded={false}
              onFinishMatch={handleFinishMatchClick}
              onResetToLobby={handleResetToLobby}
              onOpenRoomQR={() => setShowQRModal(true)}
              onOpenPlayerQR={() => {
                setPlayerForQR(null);
                setShowPlayerQRModal(true);
              }}
              onOpenPixModal={() => {
                setPixSender(null);
                setShowPixModal(true);
              }}
            />
          </div>

          {/* QR Code and Local Wi-Fi Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cadastro pela Mesma Rede Wi-Fi</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Qualquer pessoa conectada no mesmo Wi-Fi deste tablet pode escanear o QR Code abaixo e abrir sua conta bancária!
              </p>
            </div>

            <button
              onClick={() => setShowQRModal(true)}
              className="p-4 bg-white rounded-2xl shadow-xl hover:scale-105 transition-transform"
            >
              <div className="text-slate-950 text-xs font-bold mb-1">Clique para Ampliar QR da Rede</div>
              <QrCode className="w-36 h-36 text-slate-950 mx-auto" />
            </button>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 w-full space-y-1 font-mono">
              <div>
                Sala Aberta: <strong className="text-emerald-400">{gameState.roomId} ({gameState.roomName})</strong>
              </div>
              <div className="text-[10px] text-cyan-400 truncate" title={joinUrl}>
                Rede Local: {networkOrigin}
              </div>
            </div>
          </div>

          {/* Lobby Settings & Add Player */}
          <div className="lg:col-span-2 space-y-5">
            {/* Initial Money Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <span>Configuração Financeira Inicial</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Saldo Inicial por Jogador (R$):</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={initBalanceInput}
                    onChange={(e) => setInitBalanceInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Distribuído igualmente ao clicar em Iniciar Partida.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Salário Ponto de Partida (R$):</label>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Creditado automaticamente ao dar uma volta completa.
                  </span>
                </div>
              </div>
            </div>

            {/* Players Roster */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Jogadores Cadastrados ({gameState.players.length})</span>
                </h2>
                <span className="text-xs text-slate-400">Mínimo 2 jogadores</span>
              </div>

              {/* Add player manual form */}
              <form onSubmit={handleAddPlayer} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Jogador:</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos, Ana..."
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Peça / Peão:</label>
                    <select
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value as TokenPiece)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(TOKEN_ICONS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Cor do Pino:</label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {COLOR_OPTIONS.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            newColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newPlayerName.trim()}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Jogador à Mesa</span>
                </button>
              </form>

              {/* Registered Players List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {gameState.players.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-md"
                        style={{ backgroundColor: `${p.color}25`, borderColor: p.color, borderWidth: 1 }}
                      >
                        {TOKEN_ICONS[p.tokenPiece].slice(0, 2)}
                      </div>
                      <div>
                        <strong className="text-white text-xs block">{p.name}</strong>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {formatCurrency(p.balance)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setPlayerForQR(p);
                          setShowPlayerQRModal(true);
                          audio.playClickSound();
                        }}
                        title="Abrir QR Code para o jogador escanear no celular dele"
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 transition-colors flex items-center gap-1 text-[11px] font-bold"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Celular</span>
                      </button>
                      <button
                        onClick={() => handleRemovePlayer(p.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start game button */}
              <div className="pt-3">
                <button
                  onClick={handleStartGame}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Iniciar Partida e Distribuir {formatCurrency(initBalanceInput)} a Cada Jogador</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= IN-GAME DASHBOARD ================= */
        <div className="space-y-6">
          {/* Victory Banner if match ended */}
          {gameState.status === 'FINISHED' && (
            <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-2xl shadow-lg shrink-0">
                  <Trophy className="w-6 h-6 text-slate-950" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                    Partida Finalizada · Grande Campeão Coroado!
                  </span>
                  <h2 className="text-xl font-black text-white">
                    {gameState.players.find((p) => p.id === gameState.winnerId)?.name ||
                      (gameState.players[0]?.name ? `${gameState.players[0].name} (1º Lugar)` : 'Partida Encerrada')}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Todas as contas e patrimônios foram consolidados pelo Banco Central.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToLobby}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Nova Partida (Sala de Espera)</span>
                </button>
              </div>
            </div>
          )}

          {/* Click-and-Expand Real-time Match Overview Card */}
          <MatchOverviewCard
            gameState={gameState}
            defaultExpanded={true}
            onFinishMatch={handleFinishMatchClick}
            onResetToLobby={handleResetToLobby}
            onOpenRoomQR={() => setShowQRModal(true)}
            onOpenPlayerQR={() => {
              setPlayerForQR(null);
              setShowPlayerQRModal(true);
            }}
            onOpenPixModal={() => {
              setPixSender(null);
              setShowPixModal(true);
            }}
          />

          {/* Resumo ao Vivo da Rodada Atual para todos acompanharem */}
          <TurnLiveSummary gameState={gameState} />

          {/* Turn HUD & Current Space Resolution - ONLY ACTIVE WHEN PLAYING */}
          {gameState.status === 'PLAYING' && currentPlayer && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Player of the Turn */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0"
                style={{
                  backgroundColor: `${currentPlayer.color}25`,
                  borderColor: currentPlayer.color,
                  borderWidth: 2,
                }}
              >
                {TOKEN_ICONS[currentPlayer.tokenPiece].slice(0, 2)}
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Vez da Jogada
                </span>
                <h2 className="text-xl font-black text-white">{currentPlayer.name}</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Saldo:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {formatCurrency(currentPlayer.balance)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Current Physical Board Space Info */}
            {currentSpace ? (
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Posição no Tabuleiro:</span>
                  <span className="font-mono text-slate-300 font-bold">
                    Casa #{currentSpace.sequence} de {gameState.customBoardSpaces.length}
                  </span>
                </div>
                <div className="text-base font-bold text-white truncate flex items-center gap-2">
                  <span>{currentSpace.name}</span>
                  {currentOwnership && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Dono: {propertyOwner?.name || 'Desconhecido'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentSpace.type === 'COMPANY' || currentSpace.propertyType === 'Companhia'
                    ? `Compra: ${formatCurrency(currentSpace.price)} · Aluguel: Dados × ${formatCurrency(currentSpace.baseRent || 50)}`
                    : currentSpace.type === 'PROPERTY'
                    ? `Valor: ${formatCurrency(currentSpace.price)} · Aluguel: ${formatCurrency(currentSpace.baseRent)}`
                    : currentSpace.type === 'TAX'
                    ? `Imposto obrigatório ao Banco: ${formatCurrency(currentSpace.taxAmount ?? currentSpace.baseRent ?? currentSpace.price ?? 0)}`
                    : currentSpace.description}
                </p>
              </div>
            ) : (
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <span className="text-amber-400 font-bold block">Tabuleiro Físico (Sem casas digitais cadastradas)</span>
                <p className="text-[11px] text-slate-400">
                  Você pode cadastrar as propriedades reais na aba <strong>Cadastro do Tabuleiro</strong> ou usar o Pix do Banco normalmente.
                </p>
                {onOpenBoardCustomizer && (
                  <button
                    type="button"
                    onClick={onOpenBoardCustomizer}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] border border-amber-500/30 transition-colors"
                  >
                    Ir para Cadastro de Propriedades
                  </button>
                )}
              </div>
            )}

            {/* Roll Dice & Turn Action */}
            <div className="flex flex-col gap-2">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>
                  Botão de lançar dados ativo no celular de <strong>{currentPlayer.name}</strong> (com alerta sonoro e vibração).
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setShowDiceModal(true)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  title="Caso o jogador prefira que o mediador lance pelo tablet"
                >
                  <Dices className="w-3.5 h-3.5 text-blue-400" />
                  <span>Lançar pelo Tablet</span>
                </button>

                <button
                  onClick={handleNextTurn}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Passar Vez</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    setShowFinishMatchModal(true);
                    audio.playClickSound();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition-colors flex items-center justify-center gap-1.5"
                  title="Encerrar a partida e apurar campeão"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Finalizar Partida</span>
                </button>
              </div>
            </div>
          </div>

          {/* Automated Space Action Box (Buy / Rent / House Upgrade) */}
          {currentSpace && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                    <Building className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Automação da Casa Onde o Jogador Caiu ({currentSpace.name})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Ações acionadas automaticamente de acordo com as regras do jogo
                </span>
              </div>

              {/* City Photo / Video if present */}
              {(currentSpace.imageUrl || currentSpace.videoUrl) && (
                <div className="rounded-2xl overflow-hidden">
                  <CityMediaViewer
                    name={currentSpace.name}
                    imageUrl={currentSpace.imageUrl}
                    videoUrl={currentSpace.videoUrl}
                    size="md"
                  />
                </div>
              )}

              {/* Case 1: Unowned Property -> Buy Offer OR Pay Rent to Bank */}
              {(currentSpace.type === 'PROPERTY' || currentSpace.type === 'COMPANY') && !currentOwnership && (() => {
                const bankRentVal = calculateUnownedBankRent(
                  currentSpace,
                  gameState.lastDiceRoll?.total
                );
                return (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                        Propriedade Livre (Do Banco) · Escolha do Jogador
                      </span>
                      <strong className="text-white text-base">{currentSpace.name}</strong>
                      <div className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Valor de Compra:{' '}
                          <strong className="text-emerald-400 font-mono">
                            {formatCurrency(currentSpace.price)}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Aluguel ao Banco (se não comprar):{' '}
                          <strong className="text-amber-300 font-mono">
                            {formatCurrency(bankRentVal)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleBuyProperty(currentSpace, currentPlayer)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Comprar para {currentPlayer.name} ({formatCurrency(currentSpace.price)})
                        </span>
                      </button>

                      <button
                        onClick={() => handlePayRentToBank(currentSpace, currentPlayer)}
                        className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-600/20 transition-colors flex items-center gap-1.5"
                      >
                        <DollarSign className="w-4 h-4 shrink-0" />
                        <span>
                          Pagar Aluguel ao Banco ({formatCurrency(bankRentVal)})
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Case 2: Owned by another player -> Rent Collection */}
              {(currentSpace.type === 'PROPERTY' || currentSpace.type === 'COMPANY') &&
                currentOwnership &&
                currentOwnership.ownerId !== currentPlayer.id && (
                  <div className="bg-rose-950/40 p-4 rounded-2xl border border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                        Propriedade de {propertyOwner?.name || 'Adversário'}!
                      </span>
                      <strong className="text-white text-base">{currentSpace.name}</strong>
                      <div className="text-xs text-rose-200 mt-0.5">
                        Aluguel a Pagar:{' '}
                        <strong className="text-rose-400 font-mono text-sm">
                          {formatCurrency(calculateRent(currentSpace, currentOwnership))}
                        </strong>
                        {(currentSpace.type === 'COMPANY' || currentSpace.propertyType === 'Companhia') ? (
                          <span className="text-cyan-300 ml-1.5 font-semibold">
                            (Dados: {gameState.lastDiceRoll?.total ?? 1} × {formatCurrency(currentSpace.baseRent || 50)})
                          </span>
                        ) : (
                          currentOwnership.houses > 0 && (
                            <span className="text-amber-300 ml-1">
                              ({currentOwnership.houses >= 3 ? 'Hotel' : `${currentOwnership.houses} Casa(s)`})
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePayRent(currentSpace, currentPlayer, propertyOwner!)}
                        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-colors flex items-center gap-1.5"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Transferir Aluguel para {propertyOwner?.name}</span>
                      </button>
                    </div>
                  </div>
                )}

              {/* Case 3: Owned by landing player -> House / Hotel Construction */}
              {currentSpace.type === 'PROPERTY' &&
                currentOwnership &&
                currentOwnership.ownerId === currentPlayer.id && (
                  <div className="bg-amber-950/40 p-4 rounded-2xl border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                        Propriedade Própria de {currentPlayer.name}
                      </span>
                      <strong className="text-white text-base">{currentSpace.name}</strong>
                      <div className="text-xs text-slate-300 mt-0.5">
                        Construções Atuais:{' '}
                        <strong className="text-amber-300">
                          {currentOwnership.houses === 0
                            ? 'Nenhuma casa'
                            : currentOwnership.houses >= 3
                            ? 'Hotel Construído (Máximo)'
                            : `${currentOwnership.houses} de 2 Casas`}
                        </strong>
                      </div>
                    </div>

                    <div>
                      {currentOwnership.houses < 3 ? (
                        <button
                          onClick={() => handleBuildHouse(currentSpace, currentPlayer)}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-600/20 transition-colors flex items-center gap-1.5"
                        >
                          <Home className="w-4 h-4" />
                          <span>
                            {currentOwnership.houses === 2
                              ? `Construir Hotel (${formatCurrency(currentSpace.hotelCost ?? currentSpace.houseCost)})`
                              : `Construir ${currentOwnership.houses + 1}ª Casa (${formatCurrency(currentSpace.houseCost)})`}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-amber-400 bg-amber-500/20 px-3 py-1.5 rounded-xl">
                          🏨 Hotel Construído! Aluguel no nível máximo.
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {/* Case 4: Special Spaces (Luck, Tax, Profit, Jail) */}
              {currentSpace.type === 'LUCK' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-400 block">Sorte ou Revés</span>
                    <p className="text-xs text-slate-300">Tire uma carta da pilha física ou gere aleatoriamente no sistema.</p>
                  </div>
                  <button
                    onClick={() => handleDrawLuckCard(currentPlayer)}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                  >
                    🎲 Tirar Carta Automática
                  </button>
                </div>
              )}

              {currentSpace.type === 'TAX' && (() => {
                const taxVal = currentSpace.taxAmount ?? currentSpace.baseRent ?? currentSpace.price ?? 0;
                return (
                  <div className="bg-rose-950/30 p-4 rounded-2xl border border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-rose-400 block">
                        Imposto Obrigatório ao Banco · {currentSpace.name}
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Valor do Imposto definido:{' '}
                        <strong className="text-rose-400 font-mono text-sm">
                          {formatCurrency(taxVal)}
                        </strong>{' '}
                        devido aos cofres do Banco Central.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const updated = gameState.players.map((p) =>
                          p.id === currentPlayer.id ? { ...p, balance: p.balance - taxVal } : p
                        );
                        const newTx = {
                          id: `tx-tax-${Date.now()}`,
                          timestamp: Date.now(),
                          fromId: currentPlayer.id,
                          toId: 'BANK',
                          fromName: currentPlayer.name,
                          toName: 'Banco Central',
                          amount: taxVal,
                          category: 'TAX' as const,
                          description: `Pagamento de Imposto (${currentSpace.name})`,
                          spaceId: currentSpace.id,
                          spaceName: currentSpace.name,
                        };
                        const updatedNotifs = gameState.notifications.map((n) =>
                          n.spaceId === currentSpace.id && n.type === 'TAX_DUE'
                            ? { ...n, status: 'RESOLVED' as const }
                            : n
                        );
                        onUpdateState({
                          ...gameState,
                          players: updated,
                          transactions: [newTx, ...gameState.transactions],
                          notifications: updatedNotifs,
                        });
                        audio.playAlertSound();
                        showFeedback(`${currentPlayer.name} pagou ${formatCurrency(taxVal)} de Imposto (${currentSpace.name}) ao Banco!`, 'warn');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 shrink-0"
                    >
                      Cobrar {formatCurrency(taxVal)} ao Banco
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

          {/* Players Roster in Play with Mediator Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Jogadores na Partida ({gameState.players.length})</span>
              </h3>
              <span className="text-xs text-slate-400">Controles do Mediador</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {gameState.players.map((p) => {
                const isTurn = p.id === currentPlayer?.id;
                const ownedProps = Object.values(gameState.ownerships).filter((o) => o.ownerId === p.id);

                return (
                  <div
                    key={p.id}
                    className={`bg-slate-950 p-4 rounded-2xl border transition-all ${
                      isTurn ? 'border-emerald-500 shadow-md shadow-emerald-500/10' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <strong className="text-white text-sm">{p.name}</strong>
                      </div>
                      {p.inJail && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                          PRESO
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Saldo Disponível:</span>
                        <strong className="text-emerald-400 font-mono text-sm">
                          {formatCurrency(p.balance)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Propriedades:</span>
                        <span className="font-mono text-slate-200">{ownedProps.length} cidades</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Posição Atual:</span>
                        <span className="font-mono text-slate-200">Casa #{p.currentSpaceSequence}</span>
                      </div>
                    </div>

                    {/* Mediator quick action buttons */}
                    <div className="pt-3 mt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          setPlayerForQR(p);
                          setShowPlayerQRModal(true);
                          audio.playClickSound();
                        }}
                        title="Abrir QR Code para o jogador escanear no celular dele"
                        className="px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>QR Celular</span>
                      </button>

                      {p.inJail ? (
                        <button
                          onClick={() => handlePayBail(p)}
                          className="px-2 py-1 rounded-lg bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 text-[11px] font-semibold border border-rose-800"
                        >
                          Pagar Fiança (R$ 500)
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const updated = gameState.players.map((item) =>
                              item.id === p.id ? { ...item, inJail: true } : item
                            );
                            onUpdateState({ ...gameState, players: updated });
                            audio.playAlertSound();
                            showFeedback(`${p.name} enviado para a prisão!`, 'warn');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px]"
                        >
                          Prender
                        </button>
                      )}

                      {!p.isBankrupt && (
                        <button
                          onClick={() => handleDeclareBankrupt(p)}
                          className="px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-950/40 text-[11px]"
                        >
                          Falência
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dice Roller Modal */}
      <DiceRollerModal
        isOpen={showDiceModal}
        onClose={() => setShowDiceModal(false)}
        playerName={currentPlayer?.name || 'Jogador'}
        onRollComplete={handleRollComplete}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Escaneie para Abrir sua Conta"
        subtitle="Cada jogador pode apontar a câmera do celular para este código para ver seu saldo e propriedades em tempo real."
        value={joinUrl}
      />

      {/* Pix Modal from Bank */}
      <PixModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        sender={pixSender}
        allPlayers={gameState.players}
        onTransfer={handlePixTransfer}
      />

      {/* Direct Player QR Modal */}
      <PlayerQRModal
        isOpen={showPlayerQRModal}
        onClose={() => setShowPlayerQRModal(false)}
        player={playerForQR}
        allPlayers={gameState.players}
        roomId={gameState.roomId}
      />

      {/* Barra do Banco de Dados Local do Tablet */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Banco de Dados Local do Tablet Ativo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                IndexedDB + Disco Local
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sala ativa: <strong>{gameState.roomId}</strong> · {syncManager.loadRooms().length || 1} salas salvas ·{' '}
              {gameState.customBoardSpaces.length} propriedades cadastradas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              syncManager.exportDatabaseBackup(gameState);
              audio.playClickSound();
              showFeedback('Backup do banco de dados local baixado!', 'success');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-colors"
          >
            Baixar Backup (.json)
          </button>
        </div>
      </div>

      {/* Finish Match Modal */}
      <FinishMatchModal
        isOpen={showFinishMatchModal}
        onClose={() => setShowFinishMatchModal(false)}
        gameState={gameState}
        onConfirmFinish={(winnerId) => {
          if (onFinishMatch) {
            onFinishMatch(winnerId);
          } else {
            onUpdateState({
              ...gameState,
              status: 'FINISHED',
              winnerId,
            });
          }
          showFeedback('Partida finalizada! Vencedor declarado.', 'success');
        }}
      />

      {/* Modal: Nova Partida (Fecha a Sala Antiga e Abre Outra Sala) */}
      {showNewRoomModal && (
        <div className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Iniciar Nova Partida (Nova Sala)</h3>
                  <p className="text-[11px] text-slate-400">
                    Fecha a sala atual e abre uma nova sala limpa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewRoomModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sala que será fechada:</span>
                <strong className="font-mono text-rose-400">
                  {gameState.roomId} ({gameState.roomName})
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nova sala que será aberta:</span>
                <strong className="font-mono text-emerald-400">
                  SALA-{String(syncManager.getRoomCounter() + 1).padStart(3, '0')}
                </strong>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                Todas as <strong>{gameState.transactions.length} transações</strong> da {gameState.roomId} continuarão salvas e separadas no Extrato por Sala!
              </p>
            </div>

            <form onSubmit={handleConfirmOpenNewRoom} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nome da Nova Partida / Sala:
                </label>
                <input
                  type="text"
                  required
                  value={newRoomNameInput}
                  onChange={(e) => setNewRoomNameInput(e.target.value)}
                  placeholder="Ex: Partida #2, Jogo de Domingo..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              {gameState.players.length > 0 && (
                <label className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepPlayersInNewRoom}
                    onChange={(e) => setKeepPlayersInNewRoom(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-300">
                    Manter os {gameState.players.length} jogadores atuais na nova sala (resetando saldo para {formatCurrency(gameState.initialBalance)})
                  </span>
                </label>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRoomModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg shadow-blue-600/20"
                >
                  Fechar Antiga e Abrir Nova Sala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
