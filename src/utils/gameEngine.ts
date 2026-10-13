import { GameState, BoardSpace, PropertyOwnership, Transaction, GameNotification } from '../types/game';
import { formatCurrency } from './sync';

export function calculateRent(space: BoardSpace, ownership?: PropertyOwnership, diceTotal?: number): number {
  if (!ownership || ownership.isMortgaged) return 0;
  if (space.type === 'COMPANY' || space.propertyType === 'Companhia') {
    const multiplier = space.baseRent > 0 ? space.baseRent : 50;
    const roll = diceTotal && diceTotal > 0 ? diceTotal : 1;
    return roll * multiplier;
  }
  if (ownership.houses === 0) return space.baseRent;
  if (ownership.houses === 1) return space.rent1House;
  if (ownership.houses === 2) return space.rent2Houses;
  if (ownership.houses >= 3) return space.rentHotel;
  return space.baseRent;
}

/**
 * Calcula o valor do aluguel pago para o Banco Central quando o jogador
 * cai em uma propriedade sem dono e escolhe não comprar.
 */
export function calculateUnownedBankRent(space: BoardSpace, diceTotal?: number): number {
  if (space.type === 'COMPANY' || space.propertyType === 'Companhia') {
    const multiplier = space.baseRent > 0 ? space.baseRent : 50;
    const roll = diceTotal && diceTotal > 0 ? diceTotal : 1;
    return roll * multiplier;
  }
  return space.baseRent;
}

export function rollDiceAndAdvancePlayer(
  gameState: GameState,
  d1: number,
  d2: number,
  total: number,
  isManual: boolean = false
): { updatedState: GameState; notificationText: string; notificationType: 'success' | 'warn' | 'info' } {
  const currentPlayer = gameState.players[gameState.currentTurnPlayerIndex];
  if (!currentPlayer) {
    return { updatedState: gameState, notificationText: 'Nenhum jogador na vez.', notificationType: 'warn' };
  }

  const totalSpaces = gameState.customBoardSpaces.length;
  let nextSeq = currentPlayer.currentSpaceSequence + total;
  let passedStart = false;

  if (totalSpaces > 0 && nextSeq > totalSpaces) {
    nextSeq = ((nextSeq - 1) % totalSpaces) + 1;
    passedStart = true;
  }

  const landedSpace = totalSpaces > 0 ? gameState.customBoardSpaces.find((s) => s.sequence === nextSeq) : undefined;
  const newTransactions: Transaction[] = [...gameState.transactions];
  const newNotifications: GameNotification[] = [...gameState.notifications];
  let updatedBalance = currentPlayer.balance;
  let notificationText = landedSpace
    ? `${currentPlayer.name} tirou ${total} nos dados e caiu em ${landedSpace.name}!`
    : `${currentPlayer.name} tirou ${total} nos dados (${d1} + ${d2})!`;
  let notificationType: 'success' | 'warn' | 'info' = 'info';

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
    notificationText = `${currentPlayer.name} passou pelo Ponto de Partida (+${formatCurrency(gameState.salaryAmount)})${
      landedSpace ? ` e caiu em ${landedSpace.name}` : ''
    }!`;
    notificationType = 'success';
  }

  // Go to jail space?
  let inJail = currentPlayer.inJail;
  if (landedSpace?.type === 'GO_TO_JAIL') {
    const jailSpace = gameState.customBoardSpaces.find((s) => s.type === 'JAIL');
    nextSeq = jailSpace ? jailSpace.sequence : 1;
    inJail = true;
    notificationText = `🚨 ${currentPlayer.name} foi enviado direto para a Prisão!`;
    notificationType = 'warn';
  }

  // Auto-dispatch notification for the landed space
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
        // Owned by someone else: Rent Due (para Companhia: Dados * 50)
        const isCompany = landedSpace.type === 'COMPANY' || landedSpace.propertyType === 'Companhia';
        const rentVal = calculateRent(landedSpace, ownership, total);
        const ownerPlayer = gameState.players.find((p) => p.id === ownership.ownerId);
        const multiplier = landedSpace.baseRent > 0 ? landedSpace.baseRent : 50;
        newNotifications.unshift({
          id: `notif-${Date.now()}`,
          targetPlayerId: currentPlayer.id,
          type: 'RENT_DUE',
          title: `Cobrança de Aluguel: ${landedSpace.name}`,
          message: isCompany
            ? `Você caiu na companhia de ${ownerPlayer?.name || 'outro jogador'} com ${total} nos dados (${total} × ${formatCurrency(multiplier)} = ${formatCurrency(rentVal)}).`
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

  const updatedState: GameState = {
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
  };

  return { updatedState, notificationText, notificationType };
}

export function passTurnToNextPlayer(gameState: GameState): GameState {
  if (gameState.players.length === 0) return gameState;
  const nextIdx = (gameState.currentTurnPlayerIndex + 1) % gameState.players.length;
  const newRound = nextIdx === 0 ? gameState.roundNumber + 1 : gameState.roundNumber;

  return {
    ...gameState,
    currentTurnPlayerIndex: nextIdx,
    roundNumber: newRound,
    turnHasRolled: false,
    turnStartedAt: Date.now(),
  };
}
