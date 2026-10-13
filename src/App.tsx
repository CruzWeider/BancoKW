import React, { useState, useEffect } from 'react';
import { GameState, BoardSpace, MatchStats } from './types/game';
import { syncManager } from './utils/sync';
import { HeaderNav, ActiveTab } from './components/HeaderNav';
import { BankDashboard } from './components/BankDashboard';
import { PlayerWallet } from './components/PlayerWallet';
import { BoardCustomizer } from './components/BoardCustomizer';
import { TransactionHistory } from './components/TransactionHistory';
import { RankingModal } from './components/RankingModal';
import { audio } from './utils/audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => syncManager.loadState());
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('bi_active_bank_tab') as ActiveTab | null;
      if (
        savedTab &&
        ['BANK', 'BOARD_CUSTOMIZER', 'TRANSACTIONS', 'RANKING'].includes(savedTab)
      ) {
        return savedTab;
      }
    }
    return 'BANK';
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerDevice, setIsPlayerDevice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && tab !== 'WALLET') {
      try {
        localStorage.setItem('bi_active_bank_tab', tab);
      } catch {
        // ignore
      }
    }
  };

  // Subscribe to real-time synchronization (BroadcastChannel & LocalStorage)
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((updatedState) => {
      setGameState(updatedState);
    });

    // Check URL parameters and local device persistence for direct mobile join vs bank mediator
    const resolveDeviceRole = () => {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const urlPlayerId = params.get('player');
      const urlRole = params.get('role');
      const storedPlayerId = localStorage.getItem('bi_player_id');
      const storedDeviceRole = localStorage.getItem('bi_device_role');
      const savedBankTab = localStorage.getItem('bi_active_bank_tab') as ActiveTab | null;
      const isMobileScreen = window.innerWidth < 768;
      const isStandalonePWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      if (urlPlayerId) {
        // Direct QR code scanned for a specific player account
        localStorage.setItem('bi_player_id', urlPlayerId);
        localStorage.setItem('bi_device_role', 'player');
        setSelectedPlayerId(urlPlayerId);
        setIsPlayerDevice(true);
        setActiveTabState('WALLET');
      } else if (urlRole === 'player') {
        // Scanned room join code to participate as player
        localStorage.setItem('bi_device_role', 'player');
        setIsPlayerDevice(true);
        setActiveTabState('WALLET');
        if (storedPlayerId) {
          setSelectedPlayerId(storedPlayerId);
        } else {
          setSelectedPlayerId(null);
        }
      } else if (urlRole === 'bank') {
        // Explicitly bank mediator mode
        localStorage.setItem('bi_device_role', 'bank');
        localStorage.removeItem('bi_player_id');
        setIsPlayerDevice(false);
        setSelectedPlayerId(null);
        if (savedBankTab && ['BANK', 'BOARD_CUSTOMIZER', 'TRANSACTIONS', 'RANKING'].includes(savedBankTab)) {
          setActiveTabState(savedBankTab);
        } else {
          setActiveTabState('BANK');
        }
      } else if (storedPlayerId) {
        // Modo Inteligente: celular já tem um jogador salvo -> abre direto na Carteira dele!
        setIsPlayerDevice(true);
        setSelectedPlayerId(storedPlayerId);
        setActiveTabState('WALLET');
      } else if (storedDeviceRole === 'player' || (isStandalonePWA && isMobileScreen && storedDeviceRole !== 'bank')) {
        // Modo Inteligente: celular configurado como dispositivo de jogador ou aberto como App instalado no smartphone
        setIsPlayerDevice(true);
        setSelectedPlayerId(null);
        setActiveTabState('WALLET');
      } else {
        // Host / Central Bank Dashboard — preserva a aba em que o mediador estava (ex: Cadastro do Tabuleiro)
        setIsPlayerDevice(false);
        setSelectedPlayerId(null);
        if (savedBankTab && ['BANK', 'BOARD_CUSTOMIZER', 'TRANSACTIONS', 'RANKING'].includes(savedBankTab)) {
          setActiveTabState(savedBankTab);
        }
      }
    };

    resolveDeviceRole();
    window.addEventListener('popstate', resolveDeviceRole);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', resolveDeviceRole);
    };
  }, []);

  // Sync state changes
  const handleUpdateGameState = (newState: GameState) => {
    setGameState(newState);
    syncManager.broadcast(newState);
  };

  // Custom board save
  const handleSaveBoardSpaces = (newSpaces: BoardSpace[]) => {
    setGameState((prevState) => {
      const updated: GameState = {
        ...prevState,
        customBoardSpaces: newSpaces,
      };
      syncManager.saveCustomBoard(newSpaces);
      syncManager.broadcast(updated);
      return updated;
    });
  };

  // Custom property types save
  const handleSavePropertyTypes = (newTypes: string[]) => {
    setGameState((prevState) => {
      const updated: GameState = {
        ...prevState,
        customPropertyTypes: newTypes,
      };
      syncManager.savePropertyTypes(newTypes);
      syncManager.broadcast(updated);
      return updated;
    });
  };

  // Switch/Select player identity on device
  const handleSelectPlayer = (id: string | null) => {
    if (id) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('bi_player_id', id);
        localStorage.setItem('bi_device_role', 'player');
      }
      setSelectedPlayerId(id);
      setIsPlayerDevice(true);
      setActiveTab('WALLET');
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bi_player_id');
      }
      setSelectedPlayerId(null);
    }
  };

  // Leave / Switch player account
  const handleLeavePlayer = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bi_player_id');
    }
    setSelectedPlayerId(null);
    audio.playClickSound();
  };

  // Alternar entre Modo Jogador (Carteira) e Modo Mediador (Banco Central) no topo
  const handleToggleDeviceRole = () => {
    audio.playClickSound();
    if (isPlayerDevice) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('bi_device_role', 'bank');
      }
      setIsPlayerDevice(false);
      setActiveTab('BANK');
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('bi_device_role', 'player');
        const savedPlayerId = localStorage.getItem('bi_player_id');
        if (savedPlayerId) {
          setSelectedPlayerId(savedPlayerId);
        }
      }
      setIsPlayerDevice(true);
      setActiveTabState('WALLET');
    }
  };

  // Crown winner and save match history
  const handleCrownWinner = (winnerId: string) => {
    const winner = gameState.players.find((p) => p.id === winnerId) || gameState.players[0] || null;
    const winnerName = winner ? winner.name : 'Nenhum';

    // Calculate biggest rent collected
    const rents = gameState.transactions.filter((t) => t.category === 'RENT');
    const topRent = rents.reduce((max, t) => (t.amount > (max?.amount || 0) ? t : max), rents[0]);

    const matchStats: MatchStats = {
      id: `match-${gameState.roomId}-${Date.now()}`,
      roomId: gameState.roomId,
      name: `${gameState.roomId} · ${gameState.roomName}`,
      date: new Date().toLocaleDateString('pt-BR'),
      durationMinutes: Math.max(15, gameState.roundNumber * 3),
      winnerName: winnerName,
      totalTransactions: gameState.transactions.length,
      totalMoneyCirculated: gameState.transactions.reduce((acc, t) => acc + t.amount, 0),
      topRentCollected: {
        playerName: topRent ? topRent.toName : 'Nenhum',
        amount: topRent ? topRent.amount : 0,
        spaceName: topRent?.spaceName || 'N/A',
      },
    };

    syncManager.saveMatchToHistory(matchStats);

    const updatedState: GameState = {
      ...gameState,
      status: 'FINISHED',
      winnerId: winner?.id || undefined,
    };

    handleUpdateGameState(updatedState);
  };

  const currentPlayer = gameState.players.find((p) => p.id === selectedPlayerId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Navigation Bar with strict role isolation & quick role toggle */}
      <HeaderNav
        gameState={gameState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlayerDevice={isPlayerDevice}
        onToggleDeviceRole={handleToggleDeviceRole}
        currentPlayer={currentPlayer}
        onLeavePlayer={handleLeavePlayer}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {isPlayerDevice ? (
          /* ================= ONLY PLAYER VIEW ================= */
          <>
            {activeTab === 'WALLET' && (
              <PlayerWallet
                gameState={gameState}
                activePlayerId={selectedPlayerId}
                onSelectPlayer={(id) => handleSelectPlayer(id)}
                onUpdateState={handleUpdateGameState}
              />
            )}

            {activeTab === 'TRANSACTIONS' && (
              <TransactionHistory
                transactions={gameState.transactions}
                players={gameState.players}
                gameState={gameState}
              />
            )}

            {activeTab === 'RANKING' && (
              <RankingModal
                gameState={gameState}
                onCrownWinner={handleCrownWinner}
              />
            )}
          </>
        ) : (
          /* ================= ONLY BANK MEDIATOR VIEW ================= */
          <>
            {activeTab === 'BANK' && (
              <BankDashboard
                gameState={gameState}
                onUpdateState={handleUpdateGameState}
                onFinishMatch={handleCrownWinner}
                onOpenBoardCustomizer={() => setActiveTab('BOARD_CUSTOMIZER')}
              />
            )}

            {activeTab === 'BOARD_CUSTOMIZER' && (
              <BoardCustomizer
                spaces={gameState.customBoardSpaces}
                customPropertyTypes={gameState.customPropertyTypes || []}
                onSaveSpaces={handleSaveBoardSpaces}
                onSavePropertyTypes={handleSavePropertyTypes}
              />
            )}

            {activeTab === 'TRANSACTIONS' && (
              <TransactionHistory
                transactions={gameState.transactions}
                players={gameState.players}
                gameState={gameState}
              />
            )}

            {activeTab === 'RANKING' && (
              <RankingModal
                gameState={gameState}
                onCrownWinner={handleCrownWinner}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
