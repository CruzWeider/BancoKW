import React, { useState, useMemo } from 'react';
import { Transaction, TransactionCategory, Player, GameState, RoomRecord } from '../types/game';
import { formatCurrency, syncManager } from '../utils/sync';
import { Search, Filter, Download, DollarSign, FolderOpen, Lock, CheckCircle2, Layers } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  players: Player[];
  gameState?: GameState;
}

const CATEGORY_MAP: Record<TransactionCategory, { label: string; bg: string; text: string; icon: string }> = {
  RENT: { label: 'Aluguel', bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400', icon: '🏠' },
  PROPERTY_BUY: { label: 'Compra de Imóvel', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', icon: '🏙️' },
  HOUSE_BUY: { label: 'Construção de Casa', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', icon: '🔨' },
  HOTEL_BUY: { label: 'Construção de Hotel', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-300', icon: '🏨' },
  TRANSFER_PIX: { label: 'Pix / Transferência', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: '💸' },
  SALARY: { label: 'Ponto de Partida', bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400', icon: '🏁' },
  TAX: { label: 'Imposto / Taxa', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', icon: '⚖️' },
  PROFIT: { label: 'Lucros & Dividendos', bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', icon: '📈' },
  FINE: { label: 'Multa / Fiança', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', icon: '🚨' },
  MORTGAGE: { label: 'Hipoteca', bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400', icon: '📜' },
  UNMORTGAGE: { label: 'Resgate Hipoteca', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400', icon: '🔓' },
  LOAN: { label: 'Empréstimo', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', icon: '🤝' },
  INITIAL_DEPOSIT: { label: 'Depósito Inicial', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', icon: '💰' },
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  players,
  gameState,
}) => {
  const currentRoomId = gameState?.roomId || 'SALA-001';
  const currentRoomName = gameState?.roomName || 'Partida Atual';

  const [selectedRoomId, setSelectedRoomId] = useState<string>(currentRoomId);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('ALL');

  // Carrega todas as salas salvas no Banco de Dados Local do Tablet
  const roomsList = useMemo(() => {
    const savedRooms = syncManager.loadRooms();
    const map = new Map<string, RoomRecord>();

    savedRooms.forEach((r) => {
      map.set(r.roomId, r);
    });

    // Garante que a sala atual esteja presente e atualizada
    map.set(currentRoomId, {
      roomId: currentRoomId,
      roomName: currentRoomName,
      status: gameState?.status || 'LOBBY',
      createdAt: gameState?.createdAt || Date.now(),
      initialBalance: gameState?.initialBalance || 25000,
      salaryAmount: gameState?.salaryAmount || 2000,
      roundNumber: gameState?.roundNumber || 1,
      players: players,
      ownerships: gameState?.ownerships || {},
      transactions: transactions.map((t) => ({
        ...t,
        roomId: t.roomId || currentRoomId,
        roomName: t.roomName || currentRoomName,
      })),
    });

    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [currentRoomId, currentRoomName, gameState, players, transactions]);

  // Todas as transações de todas as salas combinadas
  const allTransactions = useMemo(() => {
    const list: Transaction[] = [];
    roomsList.forEach((room) => {
      (room.transactions || []).forEach((tx) => {
        list.push({
          ...tx,
          roomId: tx.roomId || room.roomId,
          roomName: tx.roomName || room.roomName,
        });
      });
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [roomsList]);

  // Transações filtradas pela Sala (Partida) selecionada
  const roomTransactions = useMemo(() => {
    if (selectedRoomId === 'ALL_ROOMS') {
      return allTransactions;
    }
    return allTransactions.filter((t) => (t.roomId || currentRoomId) === selectedRoomId);
  }, [allTransactions, selectedRoomId, currentRoomId]);

  // Jogadores disponíveis para filtro na sala selecionada
  const roomPlayers = useMemo(() => {
    if (selectedRoomId === 'ALL_ROOMS') {
      const pMap = new Map<string, Player>();
      roomsList.forEach((r) => {
        (r.players || []).forEach((p) => pMap.set(p.id, p));
      });
      return Array.from(pMap.values());
    }
    const foundRoom = roomsList.find((r) => r.roomId === selectedRoomId);
    return foundRoom ? foundRoom.players : players;
  }, [roomsList, selectedRoomId, players]);

  const filtered = roomTransactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.fromName.toLowerCase().includes(search.toLowerCase()) ||
      t.toName.toLowerCase().includes(search.toLowerCase()) ||
      (t.roomId && t.roomId.toLowerCase().includes(search.toLowerCase())) ||
      (t.spaceName && t.spaceName.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchesPlayer =
      selectedPlayer === 'ALL' || t.fromId === selectedPlayer || t.toId === selectedPlayer;

    return matchesSearch && matchesCategory && matchesPlayer;
  });

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Sala/Partida', 'Data/Hora', 'Origem', 'Destino', 'Categoria', 'Valor (R$)', 'Descricao'];
    const rows = filtered.map((t) => [
      `${t.roomId || currentRoomId} (${t.roomName || currentRoomName})`,
      new Date(t.timestamp).toLocaleString('pt-BR'),
      t.fromName,
      t.toName,
      CATEGORY_MAP[t.category]?.label || t.category,
      t.amount,
      `"${t.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `extrato_${selectedRoomId.toLowerCase()}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalVolume = roomTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalRents = roomTransactions
    .filter((t) => t.category === 'RENT')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner and Summary Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Extrato Financeiro Dividido por Partida (Sala)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Todas as transações ficam salvas no Banco de Dados Local do tablet e separadas por cada Sala/Partida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs flex-1 sm:flex-initial">
            <span className="text-slate-400 block text-[10px]">Volume na Sala Selecionada:</span>
            <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(totalVolume)}</strong>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs flex-1 sm:flex-initial">
            <span className="text-slate-400 block text-[10px]">Aluguéis na Sala:</span>
            <strong className="text-rose-400 font-mono text-sm">{formatCurrency(totalRents)}</strong>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 disabled:opacity-40 border border-slate-700 transition-colors w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Room / Match Selector Cards (Divisão de Transações por Partida/Sala) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Selecione a Partida (Sala) para ver as Transações ({roomsList.length} salas registradas)</span>
          </div>
          <button
            onClick={() => {
              setSelectedRoomId('ALL_ROOMS');
              setSelectedPlayer('ALL');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              selectedRoomId === 'ALL_ROOMS'
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ver Todas as Salas Juntas ({allTransactions.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {roomsList.map((room) => {
            const isCurrentActive = room.roomId === currentRoomId && room.status !== 'CLOSED';
            const isSelected = selectedRoomId === room.roomId;
            const roomTxCount = (room.transactions || []).length;
            const roomVol = (room.transactions || []).reduce((acc, t) => acc + t.amount, 0);

            return (
              <button
                key={room.roomId}
                type="button"
                onClick={() => {
                  setSelectedRoomId(room.roomId);
                  setSelectedPlayer('ALL');
                }}
                className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-xs text-emerald-400">
                    {room.roomId}
                  </span>
                  {isCurrentActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Aberta Atual
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      <Lock className="w-2.5 h-2.5" />
                      Fechada
                    </span>
                  )}
                </div>

                <div>
                  <strong className="text-white text-xs block truncate">{room.roomName}</strong>
                  <span className="text-[10px] text-slate-400 block">
                    {room.players?.length || 0} jogadores · {roomTxCount} transações
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
                  <span className="text-slate-400">Movimentado:</span>
                  <strong className="font-mono text-emerald-400">{formatCurrency(roomVol)}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por jogador, cidade, motivo ou sala..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todas as Categorias</option>
            {Object.entries(CATEGORY_MAP).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos os Jogadores / Banco</option>
            <option value="BANK">🏦 Banco Central</option>
            {roomPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                👤 {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Filter className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">
              Nenhuma transação registrada para {selectedRoomId === 'ALL_ROOMS' ? 'as salas' : `a sala ${selectedRoomId}`}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Partida / Sala</th>
                  <th className="py-3 px-4">Horário</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Origem → Destino</th>
                  <th className="py-3 px-4">Detalhes</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((t) => {
                  const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.TRANSFER_PIX;
                  const txRoomId = t.roomId || currentRoomId;
                  return (
                    <tr key={`${txRoomId}-${t.id}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] font-bold text-emerald-400">
                          {txRoomId}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(t.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${cat.bg} ${cat.text}`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className={t.fromId === 'BANK' ? 'text-blue-400 font-bold' : 'text-slate-200'}>
                            {t.fromName}
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className={t.toId === 'BANK' ? 'text-blue-400 font-bold' : 'text-slate-200'}>
                            {t.toName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {t.description}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-sm text-emerald-400">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
