import { GameState, BoardSpace, MatchStats, Player, RoomRecord, Transaction } from '../types/game';
import { DEFAULT_BOARD_SPACES } from '../data/defaultBoard';
import { idbGet, idbSet, idbClearAll, syncWithLocalServer, fetchFromLocalServer } from './localDb';

// Novas chaves v2 (dados reais, sem demonstração)
const STORAGE_KEY_STATE = 'banco_imobiliario_state_v2_real';
const STORAGE_KEY_ROOMS = 'banco_imobiliario_rooms_v2_real';
const STORAGE_KEY_HISTORY = 'banco_imobiliario_history_v2_real';
const STORAGE_KEY_BOARD = 'banco_imobiliario_custom_board_v2_real';
const STORAGE_KEY_TYPES = 'banco_imobiliario_property_types_v2_real';
const STORAGE_KEY_COUNTER = 'banco_imobiliario_room_counter_v2_real';
const CHANNEL_NAME = 'banco_imobiliario_sync_channel_v2';

// Limpa chaves legadas v1 que continham propriedades e jogadores de demonstração
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('banco_imobiliario_state_v1');
    localStorage.removeItem('banco_imobiliario_history_v1');
    localStorage.removeItem('banco_imobiliario_custom_board_v1');
  } catch {
    // ignore
  }
}

export const initialGameState: GameState = {
  roomId: 'SALA-001',
  roomName: 'Partida #1',
  createdAt: Date.now(),
  initialBalance: 25000,
  salaryAmount: 2000,
  status: 'LOBBY',
  currentTurnPlayerIndex: 0,
  roundNumber: 1,
  players: [], // Sem usuários de demonstração! Apenas jogadores reais
  ownerships: {},
  customBoardSpaces: DEFAULT_BOARD_SPACES, // As 35 casas reais do tabuleiro físico (28 Cidades + 4 Companhias + 3 Impostos)
  customPropertyTypes: ['Cidade', 'Companhia', 'Imposto'],
  transactions: [],
  notifications: [],
};

function normalizeStateTransactions(state: GameState): GameState {
  const stampedTransactions = (state.transactions || []).map((tx) => ({
    ...tx,
    roomId: tx.roomId || state.roomId,
    roomName: tx.roomName || state.roomName,
  }));
  return {
    ...state,
    transactions: stampedTransactions,
  };
}

function stateToRoomRecord(state: GameState, overrideStatus?: RoomRecord['status'], closedAt?: number): RoomRecord {
  const winner = state.players.find((p) => p.id === state.winnerId);
  return {
    roomId: state.roomId,
    roomName: state.roomName,
    status: overrideStatus || state.status,
    createdAt: state.createdAt || Date.now(),
    closedAt: closedAt,
    initialBalance: state.initialBalance,
    salaryAmount: state.salaryAmount,
    roundNumber: state.roundNumber,
    players: state.players,
    ownerships: state.ownerships,
    transactions: (state.transactions || []).map((t) => ({
      ...t,
      roomId: t.roomId || state.roomId,
      roomName: t.roomName || state.roomName,
    })),
    winnerId: state.winnerId,
    winnerName: winner?.name,
  };
}

class SyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(state: GameState) => void> = [];
  private networkBaseUrl: string | null = null;
  private localIps: string[] = [];
  private lastKnownUpdate: number = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATE' && event.data.payload) {
            this.notifyListeners(event.data.payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY_STATE && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.notifyListeners(parsed);
          } catch (err) {
            console.error('Storage sync parse error:', err);
          }
        }
      });

      this.initNetworkAndLocalDB();
    }
  }

  private async initNetworkAndLocalDB() {
    // 1. Descobre o IP da rede local (Wi-Fi) para o QR Code funcionar em outros celulares
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const info = await res.json();
        if (info.networkUrl) {
          this.networkBaseUrl = info.networkUrl;
        }
        if (Array.isArray(info.ips)) {
          this.localIps = info.ips;
        }
      }
    } catch {
      // ignore
    }

    // 2. Carrega do IndexedDB ou do Servidor Local (/api/db)
    try {
      const serverDb = await fetchFromLocalServer();
      const idbState = await idbGet<GameState>(STORAGE_KEY_STATE);
      const idbRooms = await idbGet<RoomRecord[]>(STORAGE_KEY_ROOMS);
      const idbBoard = await idbGet<BoardSpace[]>(STORAGE_KEY_BOARD);

      if (serverDb && serverDb.activeState) {
        this.lastKnownUpdate = serverDb.updatedAt || Date.now();
        this.applyRemoteDatabase(serverDb);
      } else if (idbState) {
        // Restaura do IndexedDB do tablet e sincroniza com o servidor
        if (idbRooms) {
          this.safeSetLocalStorage(STORAGE_KEY_ROOMS, JSON.stringify(idbRooms));
        }
        if (idbBoard) {
          this.safeSetLocalStorage(STORAGE_KEY_BOARD, JSON.stringify(idbBoard));
          idbState.customBoardSpaces = idbBoard;
        }
        this.safeSetLocalStorage(STORAGE_KEY_STATE, JSON.stringify(idbState));
        this.notifyListeners(idbState);
        this.pushToServer(idbState);
      } else {
        // Inicializa o banco local do servidor com o estado inicial limpo
        const current = this.loadState();
        this.upsertRoomRecord(stateToRoomRecord(current));
        this.pushToServer(current);
      }
    } catch (e) {
      console.warn('Init local DB error:', e);
    }

    // 3. Conecta ao Server-Sent Events (/api/events) para sincronizar todos os aparelhos em tempo real
    try {
      const evtSource = new EventSource('/api/events');
      evtSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TUNNEL_READY' && msg.url) {
            this.networkBaseUrl = msg.url;
            this.notifyListeners(this.loadState());
          } else if (msg.type === 'DB_UPDATE' && msg.payload) {
            const db = msg.payload;
            if (db.updatedAt && db.updatedAt > this.lastKnownUpdate && db.activeState) {
              this.lastKnownUpdate = db.updatedAt;
              this.applyRemoteDatabase(db);
            }
          }
        } catch {
          // ignore parse error
        }
      };
    } catch {
      // Fallback polling leve a cada 3s caso SSE não esteja disponível
      setInterval(async () => {
        const db = await fetchFromLocalServer();
        if (db && db.updatedAt && db.updatedAt > this.lastKnownUpdate && db.activeState) {
          this.lastKnownUpdate = db.updatedAt;
          this.applyRemoteDatabase(db);
        }
      }, 3000);
    }
  }

  private safeSetLocalStorage(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`LocalStorage quota warning for ${key}:`, e);
    }
  }

  private applyRemoteDatabase(db: any) {
    if (Array.isArray(db.rooms)) {
      this.safeSetLocalStorage(STORAGE_KEY_ROOMS, JSON.stringify(db.rooms));
      idbSet(STORAGE_KEY_ROOMS, db.rooms);
    }
    if (Array.isArray(db.boardSpaces)) {
      this.safeSetLocalStorage(STORAGE_KEY_BOARD, JSON.stringify(db.boardSpaces));
      idbSet(STORAGE_KEY_BOARD, db.boardSpaces);
    }
    if (Array.isArray(db.history)) {
      this.safeSetLocalStorage(STORAGE_KEY_HISTORY, JSON.stringify(db.history));
      idbSet(STORAGE_KEY_HISTORY, db.history);
    }
    if (typeof db.roomCounter === 'number') {
      this.safeSetLocalStorage(STORAGE_KEY_COUNTER, String(db.roomCounter));
      idbSet(STORAGE_KEY_COUNTER, db.roomCounter);
    }
    if (db.activeState) {
      if (Array.isArray(db.activeState.customPropertyTypes)) {
        this.safeSetLocalStorage(STORAGE_KEY_TYPES, JSON.stringify(db.activeState.customPropertyTypes));
        idbSet(STORAGE_KEY_TYPES, db.activeState.customPropertyTypes);
      }
      const mergedActiveState: GameState = {
        ...db.activeState,
        customBoardSpaces:
          Array.isArray(db.boardSpaces) && db.boardSpaces.length > 0
            ? db.boardSpaces
            : db.activeState.customBoardSpaces && db.activeState.customBoardSpaces.length > 0
            ? db.activeState.customBoardSpaces
            : DEFAULT_BOARD_SPACES,
        customPropertyTypes:
          Array.isArray(db.activeState.customPropertyTypes) &&
          db.activeState.customPropertyTypes.length > 0
            ? db.activeState.customPropertyTypes
            : ['Cidade', 'Companhia', 'Imposto'],
      };
      this.safeSetLocalStorage(STORAGE_KEY_STATE, JSON.stringify(mergedActiveState));
      idbSet(STORAGE_KEY_STATE, mergedActiveState);
      this.notifyListeners(mergedActiveState);
    }
  }

  private pushToServer(state: GameState) {
    const rooms = this.loadRooms();
    const boardSpaces = state.customBoardSpaces || this.loadCustomBoard();
    const history = this.loadHistory();
    const roomCounter = this.getRoomCounter();

    this.lastKnownUpdate = Date.now();
    syncWithLocalServer({
      activeRoomId: state.roomId,
      roomCounter,
      activeState: state,
      rooms,
      boardSpaces,
      history,
    });
  }

  public getNetworkOrigin(): string {
    if (typeof window === 'undefined') return 'http://localhost:3000';
    if (this.networkBaseUrl) {
      return this.networkBaseUrl;
    }
    return window.location.origin;
  }

  public getLocalIps(): string[] {
    return this.localIps;
  }

  public subscribe(callback: (state: GameState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(state: GameState) {
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error('Error notifying sync listener', e);
      }
    });
  }

  public broadcast(rawState: GameState) {
    const state = normalizeStateTransactions(rawState);

    // 1. Atualiza o registro desta Sala no banco de salas (rooms)
    this.upsertRoomRecord(stateToRoomRecord(state));

    // 2. Salva em LocalStorage e IndexedDB do Tablet
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      idbSet(STORAGE_KEY_STATE, state);
    }

    // 3. Sincroniza com o Banco de Dados Local no Servidor (e propaga via Wi-Fi para todos os celulares)
    this.pushToServer(state);

    // 4. Broadcast para outras abas no mesmo navegador
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'STATE_UPDATE', payload: state });
      } catch (e) {
        console.warn('BroadcastChannel post error:', e);
      }
    }

    // 5. Notifica listeners locais
    this.notifyListeners(state);
  }

  /**
   * Cadastra um jogador a partir de qualquer celular conectado na mesma rede Wi-Fi
   */
  public async registerPlayerOverNetwork(newPlayer: Player, fallbackState: GameState): Promise<void> {
    try {
      const res = await fetch('/api/players/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: newPlayer }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeState) {
          this.broadcast(data.activeState);
          return;
        }
      }
    } catch {
      // Fallback caso offline
    }

    this.broadcast({
      ...fallbackState,
      players: [...fallbackState.players, newPlayer],
    });
  }

  public loadState(): GameState {
    if (typeof window === 'undefined') return initialGameState;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATE);
      if (saved) {
        const parsed: GameState = JSON.parse(saved);
        if (!parsed.customBoardSpaces || parsed.customBoardSpaces.length === 0) {
          parsed.customBoardSpaces = this.loadCustomBoard();
        }
        if (!parsed.customPropertyTypes || parsed.customPropertyTypes.length === 0) {
          parsed.customPropertyTypes = this.loadPropertyTypes();
        }
        return normalizeStateTransactions(parsed);
      }
    } catch (e) {
      console.error('Error reading saved state:', e);
    }
    return {
      ...initialGameState,
      customBoardSpaces: this.loadCustomBoard(),
      customPropertyTypes: this.loadPropertyTypes(),
    };
  }

  public loadCustomBoard(): BoardSpace[] {
    if (typeof window === 'undefined') return DEFAULT_BOARD_SPACES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOARD);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading custom board preset:', e);
    }
    return DEFAULT_BOARD_SPACES;
  }

  public saveCustomBoard(board: BoardSpace[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_BOARD, JSON.stringify(board));
    } catch (e) {
      console.error('Error saving custom board preset:', e);
    }
    idbSet(STORAGE_KEY_BOARD, board);
  }

  public loadPropertyTypes(): string[] {
    if (typeof window === 'undefined') return ['Cidade', 'Companhia', 'Imposto'];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TYPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading custom property types:', e);
    }
    return ['Cidade', 'Companhia', 'Imposto'];
  }

  public savePropertyTypes(types: string[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_TYPES, JSON.stringify(types));
    } catch (e) {
      console.error('Error saving custom property types:', e);
    }
    idbSet(STORAGE_KEY_TYPES, types);
  }

  // ================= GESTÃO DE SALAS (PARTIDAS) E TRANSAÇÕES POR SALA =================

  public getRoomCounter(): number {
    if (typeof window === 'undefined') return 1;
    const saved = localStorage.getItem(STORAGE_KEY_COUNTER);
    const num = saved ? parseInt(saved, 10) : 1;
    return isNaN(num) || num < 1 ? 1 : num;
  }

  public setRoomCounter(val: number) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_COUNTER, String(val));
    idbSet(STORAGE_KEY_COUNTER, val);
  }

  public loadRooms(): RoomRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROOMS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading rooms:', e);
    }
    return [];
  }

  public saveRooms(rooms: RoomRecord[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
    } catch (e) {
      console.error('Error saving rooms:', e);
    }
    idbSet(STORAGE_KEY_ROOMS, rooms);
  }

  public upsertRoomRecord(record: RoomRecord) {
    const rooms = this.loadRooms();
    const existsIdx = rooms.findIndex((r) => r.roomId === record.roomId);
    let updated: RoomRecord[];
    if (existsIdx >= 0) {
      updated = [...rooms];
      // Se já estava CLOSED e o record não tem closedAt, preserva o closedAt
      updated[existsIdx] = {
        ...updated[existsIdx],
        ...record,
        closedAt: record.closedAt ?? updated[existsIdx].closedAt,
      };
    } else {
      updated = [record, ...rooms];
    }
    this.saveRooms(updated);
  }

  /**
   * Retorna todas as transações de todas as salas/partidas salvas no banco local,
   * garantindo que a sala atual esteja sincronizada.
   */
  public loadAllTransactionsAcrossRooms(currentState?: GameState): Transaction[] {
    const rooms = this.loadRooms();
    const mapByRoom = new Map<string, Transaction[]>();

    rooms.forEach((r) => {
      mapByRoom.set(
        r.roomId,
        (r.transactions || []).map((t) => ({
          ...t,
          roomId: t.roomId || r.roomId,
          roomName: t.roomName || r.roomName,
        }))
      );
    });

    if (currentState) {
      mapByRoom.set(
        currentState.roomId,
        (currentState.transactions || []).map((t) => ({
          ...t,
          roomId: t.roomId || currentState.roomId,
          roomName: t.roomName || currentState.roomName,
        }))
      );
    }

    const all: Transaction[] = [];
    for (const txList of mapByRoom.values()) {
      all.push(...txList);
    }

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Fecha a partida/sala atual (salvando todas as transações e histórico dela no banco local)
   * e abre imediatamente uma NOVA SALA limpa para a próxima partida!
   */
  public closeCurrentRoomAndOpenNew(
    currentState: GameState,
    options?: {
      newRoomName?: string;
      keepPlayers?: boolean;
    }
  ): GameState {
    const now = Date.now();

    // 1. Determina o vencedor da sala que está sendo fechada (se teve jogadores)
    let winnerPlayer: Player | undefined = undefined;
    if (currentState.players.length > 0) {
      if (currentState.winnerId) {
        winnerPlayer = currentState.players.find((p) => p.id === currentState.winnerId);
      } else {
        const sorted = [...currentState.players].sort(
          (a, b) =>
            calculateNetWorth(b, currentState.ownerships, currentState.customBoardSpaces) -
            calculateNetWorth(a, currentState.ownerships, currentState.customBoardSpaces)
        );
        winnerPlayer = sorted[0];
      }
    }

    // 2. Salva a sala antiga como FECHADA (CLOSED) no banco de salas
    const closedRecord: RoomRecord = {
      ...stateToRoomRecord(
        {
          ...currentState,
          winnerId: winnerPlayer?.id,
        },
        'CLOSED',
        now
      ),
      winnerName: winnerPlayer ? winnerPlayer.name : 'Sem vencedor',
    };
    this.upsertRoomRecord(closedRecord);

    // 3. Se a sala antiga teve jogadores ou transações, registra também no histórico de partidas concluídas
    if (currentState.players.length > 0 || currentState.transactions.length > 0) {
      const history = this.loadHistory();
      const alreadyInHistory = history.some((h) => h.roomId === currentState.roomId);
      if (!alreadyInHistory) {
        const rents = currentState.transactions.filter((t) => t.category === 'RENT');
        const topRent = rents.reduce((max, t) => (t.amount > (max?.amount || 0) ? t : max), rents[0]);

        const matchStats: MatchStats = {
          id: `match-${currentState.roomId}-${now}`,
          roomId: currentState.roomId,
          name: `${currentState.roomId} · ${currentState.roomName}`,
          date: new Date(now).toLocaleDateString('pt-BR'),
          closedAt: now,
          durationMinutes: Math.max(5, currentState.roundNumber * 3),
          winnerName: winnerPlayer ? winnerPlayer.name : 'Encerrada',
          totalTransactions: currentState.transactions.length,
          totalMoneyCirculated: currentState.transactions.reduce((acc, t) => acc + t.amount, 0),
          topRentCollected: {
            playerName: topRent ? topRent.toName : 'Nenhum',
            amount: topRent ? topRent.amount : 0,
            spaceName: topRent?.spaceName || 'N/A',
          },
        };
        this.saveMatchToHistory(matchStats);
      }
    }

    // 4. Incrementa o contador e gera o código da NOVA SALA (ex: SALA-002, SALA-003...)
    const currentCounter = this.getRoomCounter();
    const nextCounter = currentCounter + 1;
    this.setRoomCounter(nextCounter);

    const nextRoomId = `SALA-${String(nextCounter).padStart(3, '0')}`;
    const nextRoomName = options?.newRoomName?.trim() || `Partida #${nextCounter}`;

    const nextPlayers: Player[] = options?.keepPlayers
      ? currentState.players.map((p) => ({
          ...p,
          balance: currentState.initialBalance,
          currentSpaceSequence: 1,
          inJail: false,
          jailTurns: 0,
          isBankrupt: false,
        }))
      : [];

    const newRoomState: GameState = {
      roomId: nextRoomId,
      roomName: nextRoomName,
      createdAt: now,
      initialBalance: currentState.initialBalance,
      salaryAmount: currentState.salaryAmount,
      status: 'LOBBY',
      currentTurnPlayerIndex: 0,
      roundNumber: 1,
      players: nextPlayers,
      ownerships: {},
      customBoardSpaces: currentState.customBoardSpaces,
      customPropertyTypes: currentState.customPropertyTypes || this.loadPropertyTypes(),
      transactions: [],
      notifications: [],
      lastDiceRoll: undefined,
      turnHasRolled: false,
      winnerId: undefined,
    };

    // 5. Registra a nova sala aberta e propaga para todos os dispositivos
    this.broadcast(newRoomState);
    return newRoomState;
  }

  public loadHistory(): MatchStats[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading history:', e);
    }
    return [];
  }

  public saveMatchToHistory(match: MatchStats) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.loadHistory();
      const filtered = current.filter((m) => m.id !== match.id && (!match.roomId || m.roomId !== match.roomId));
      const updated = [match, ...filtered].slice(0, 100);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      idbSet(STORAGE_KEY_HISTORY, updated);
    } catch (e) {
      console.error('Error saving match history:', e);
    }
  }

  /**
   * Exporta todo o Banco de Dados Local do Tablet em arquivo JSON para backup
   */
  public exportDatabaseBackup(currentState: GameState) {
    if (typeof window === 'undefined') return;
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      activeRoomId: currentState.roomId,
      roomCounter: this.getRoomCounter(),
      activeState: currentState,
      rooms: this.loadRooms(),
      boardSpaces: currentState.customBoardSpaces,
      history: this.loadHistory(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banco_imobiliario_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Limpa completamente o banco de dados local (caso o mediador queira zerar tudo do tablet)
   */
  public async resetAllDatabase(): Promise<GameState> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_STATE);
      localStorage.removeItem(STORAGE_KEY_ROOMS);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.removeItem(STORAGE_KEY_BOARD);
      localStorage.removeItem(STORAGE_KEY_COUNTER);
      localStorage.removeItem('bi_player_id');
      await idbClearAll();
      try {
        await fetch('/api/db/reset', { method: 'POST' });
      } catch {
        // ignore
      }
    }

    const freshState: GameState = {
      ...initialGameState,
      createdAt: Date.now(),
      players: [],
      customBoardSpaces: [],
      transactions: [],
      ownerships: {},
      notifications: [],
    };
    this.setRoomCounter(1);
    this.broadcast(freshState);
    return freshState;
  }
}

export const syncManager = new SyncManager();

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateNetWorth(
  player: Player,
  ownerships: GameState['ownerships'],
  boardSpaces: BoardSpace[]
): number {
  let propertyValue = 0;
  const spacesMap = new Map(boardSpaces.map((s) => [s.id, s]));

  Object.values(ownerships).forEach((own) => {
    if (own.ownerId === player.id) {
      const space = spacesMap.get(own.spaceId);
      if (space) {
        if (!own.isMortgaged) {
          propertyValue += space.price;
          if (own.houses >= 3) {
            propertyValue += space.houseCost * 2 + (space.hotelCost ?? space.houseCost);
          } else if (own.houses > 0) {
            propertyValue += space.houseCost * own.houses;
          }
        } else {
          propertyValue += space.mortgageValue;
        }
      }
    }
  });

  return player.balance + propertyValue;
}

/**
 * Redimensiona e comprime fotos tiradas pela câmera do tablet/celular (ex: 8MB -> ~60KB)
 * para evitar travamentos de memória, estouro do limite de 5MB do localStorage e lentidão na rede.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension: number = 900,
  quality: number = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Imagem vazia.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Caso o navegador não consiga decodificar no canvas, retorna o original
        resolve(rawDataUrl);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

