export type SpaceType = 
  | 'PROPERTY' 
  | 'COMPANY' 
  | 'START' 
  | 'JAIL' 
  | 'GO_TO_JAIL' 
  | 'LUCK' 
  | 'TAX' 
  | 'PROFIT' 
  | 'FREE_PARKING';

export type ColorGroup = 
  | 'purple' 
  | 'light_blue' 
  | 'pink' 
  | 'orange' 
  | 'red' 
  | 'yellow' 
  | 'green' 
  | 'dark_blue' 
  | 'company'
  | 'special';

export interface BoardSpace {
  id: string;
  sequence: number; // 1 to N on physical board
  name: string;
  type: SpaceType;
  propertyType?: string; // Tipo de propriedade cadastrado pelo próprio usuário
  colorGroup: ColorGroup;
  price: number;         // Valor de compra (pode ser 0 para informar depois)
  baseRent: number;      // ALUGUEL
  rent1House: number;    // COM 1 CASA
  rent2Houses: number;   // COM 2 CASAS
  rent3Houses?: number;  // Opcional (legado)
  rentHotel: number;     // COM HOTEL
  houseCost: number;     // CASA (custo de construção da casa)
  hotelCost?: number;    // HOTEL (custo de construção do hotel)
  mortgageValue: number; // HIPOTECA
  taxAmount?: number;    // IMPOSTO (valor que o jogador é obrigado a pagar ao Banco)
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export type TokenPiece = 'car' | 'hat' | 'ship' | 'dog' | 'boot' | 'train' | 'thimble' | 'airplane';

export interface Player {
  id: string;
  name: string;
  tokenPiece: TokenPiece;
  color: string;
  balance: number;
  currentSpaceSequence: number; // 1 to N
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  joinedAt: number;
}

export interface PropertyOwnership {
  spaceId: string;
  ownerId: string;
  houses: number; // 0, 1, 2, 3 (houses) or 4 (hotel)
  isMortgaged: boolean;
}

export type TransactionCategory = 
  | 'RENT' 
  | 'PROPERTY_BUY' 
  | 'HOUSE_BUY' 
  | 'HOTEL_BUY' 
  | 'TRANSFER_PIX' 
  | 'SALARY' 
  | 'TAX' 
  | 'PROFIT' 
  | 'FINE' 
  | 'MORTGAGE' 
  | 'UNMORTGAGE' 
  | 'LOAN' 
  | 'INITIAL_DEPOSIT';

export interface Transaction {
  id: string;
  roomId?: string;   // Identificador da Partida / Sala (ex: SALA-001)
  roomName?: string; // Nome da Partida / Sala
  timestamp: number;
  fromId: string; // Player ID or 'BANK'
  toId: string;   // Player ID or 'BANK'
  fromName: string;
  toName: string;
  amount: number;
  category: TransactionCategory;
  description: string;
  spaceId?: string;
  spaceName?: string;
}

export type NotificationType = 
  | 'RENT_DUE' 
  | 'BUY_OFFER' 
  | 'BUILD_OFFER' 
  | 'TAX_DUE' 
  | 'PAYMENT_RECEIVED' 
  | 'SPECIAL_SPACE';

export interface GameNotification {
  id: string;
  targetPlayerId: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  secondaryAmount?: number; // Ex: Valor do aluguel ao Banco quando o jogador cai em propriedade sem dono
  spaceId?: string;
  fromPlayerId?: string;
  createdAt: number;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
}

export interface MatchStats {
  id: string;
  roomId?: string;
  name: string;
  date: string;
  closedAt?: number;
  durationMinutes: number;
  winnerName: string;
  totalTransactions: number;
  totalMoneyCirculated: number;
  topRentCollected: {
    playerName: string;
    amount: number;
    spaceName: string;
  };
}

export interface RoomRecord {
  roomId: string;
  roomName: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED' | 'CLOSED';
  createdAt: number;
  closedAt?: number;
  initialBalance: number;
  salaryAmount: number;
  roundNumber: number;
  players: Player[];
  ownerships: Record<string, PropertyOwnership>;
  transactions: Transaction[];
  winnerId?: string;
  winnerName?: string;
}

export interface GameState {
  roomId: string;
  roomName: string;
  createdAt?: number;
  initialBalance: number;
  salaryAmount: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  currentTurnPlayerIndex: number;
  roundNumber: number;
  turnStartedAt?: number;
  players: Player[];
  ownerships: Record<string, PropertyOwnership>; // spaceId -> PropertyOwnership
  customBoardSpaces: BoardSpace[];
  customPropertyTypes?: string[];
  transactions: Transaction[];
  notifications: GameNotification[];
  lastDiceRoll?: {
    dice1: number;
    dice2: number;
    total: number;
    playerId: string;
    timestamp: number;
    isManual?: boolean;
    spaceId?: string;
    spaceName?: string;
    spaceSequence?: number;
  };
  turnHasRolled?: boolean;
  winnerId?: string;
}
