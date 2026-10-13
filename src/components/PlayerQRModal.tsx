import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Player } from '../types/game';
import { syncManager } from '../utils/sync';
import { QrCode, Copy, Check, ExternalLink, Printer, Users } from 'lucide-react';
import { audio } from '../utils/audio';

interface PlayerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null; // If null, displays all players in a grid
  allPlayers: Player[];
  roomId: string;
}

const TOKEN_ICONS: Record<string, string> = {
  car: '🏎️ Carro',
  hat: '🎩 Chapéu',
  ship: '🚢 Navio',
  dog: '🐶 Cãozinho',
  boot: '👢 Bota',
  train: '🚂 Trem',
  thimble: '🧵 Dedal',
  airplane: '✈️ Avião',
};

interface SingleQRCardProps {
  player: Player;
  roomId: string;
}

const SingleQRCard: React.FC<SingleQRCardProps> = ({ player, roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  const getPlayerDirectUrl = () => {
    const base = syncManager.getNetworkOrigin();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    return `${base}${pathname}?room=${roomId}&role=player&player=${player.id}`;
  };

  const directUrl = getPlayerDirectUrl();

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        directUrl,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#020617', // slate-950
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Error generating player QR code:', error);
        }
      );
    }
  }, [directUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(directUrl);
    setCopied(true);
    audio.playClickSound();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-3 relative shadow-md">
      {/* Player identity banner */}
      <div className="flex items-center gap-2">
        <span
          className="w-3.5 h-3.5 rounded-full shrink-0"
          style={{ backgroundColor: player.color }}
        />
        <strong className="text-white text-sm font-bold truncate max-w-[160px]">
          {player.name}
        </strong>
      </div>
      <span className="text-[11px] text-slate-400 -mt-2">
        Peão: {TOKEN_ICONS[player.tokenPiece] || player.tokenPiece}
      </span>

      {/* QR Canvas */}
      <div className="bg-white p-2 rounded-xl shadow-lg border-2 border-slate-200">
        <canvas ref={canvasRef} className="block rounded-lg" />
      </div>

      <p className="text-[11px] text-emerald-400 font-medium">
        Aponte a câmera na mesma rede Wi-Fi para abrir a conta de {player.name}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 w-full pt-1">
        <button
          onClick={handleCopy}
          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700 flex items-center justify-center gap-1 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
        </button>

        <a
          href={directUrl}
          target="_blank"
          rel="noreferrer"
          className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Abrir</span>
        </a>
      </div>
    </div>
  );
};

export const PlayerQRModal: React.FC<PlayerQRModalProps> = ({
  isOpen,
  onClose,
  player,
  allPlayers,
  roomId,
}) => {
  const [viewMode, setViewMode] = useState<'SINGLE' | 'ALL'>(player ? 'SINGLE' : 'ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(player || allPlayers[0] || null);

  useEffect(() => {
    if (player) {
      setSelectedPlayer(player);
      setViewMode('SINGLE');
    } else {
      setSelectedPlayer(allPlayers[0] || null);
      setViewMode('ALL');
    }
  }, [player, isOpen, allPlayers]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 pr-8 sm:pr-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>QR Code de Acesso Direto</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Rede Local Wi-Fi
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cada jogador escaneia seu QR Code no próprio celular e cai diretamente na sua tela!
              </p>
            </div>
          </div>

          {/* Toggle between Single and All */}
          {allPlayers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setViewMode('SINGLE')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    viewMode === 'SINGLE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setViewMode('ALL')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                    viewMode === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({allPlayers.length})
                </button>
              </div>

              <button
                onClick={handlePrint}
                title="Imprimir cartões dos jogadores"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {allPlayers.length === 0 ? (
          <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-bold text-white">Nenhum jogador cadastrado nesta sala ainda</p>
            <p className="text-xs text-slate-400">
              Use o botão <strong>"QR da Sala"</strong> para que os jogadores na mesma rede Wi-Fi escaneiem e se cadastrem pelo celular, ou adicione-os manualmente no painel.
            </p>
          </div>
        ) : (
          <>
            {/* Single Mode View */}
            {viewMode === 'SINGLE' && (
              <div className="space-y-4">
                {/* Player Picker Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {allPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayer(p);
                        audio.playClickSound();
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        selectedPlayer?.id === p.id
                          ? 'bg-slate-800 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>

                {selectedPlayer && (
                  <div className="max-w-sm mx-auto">
                    <SingleQRCard player={selectedPlayer} roomId={roomId} />
                  </div>
                )}
              </div>
            )}

            {/* All Players Grid View */}
            {viewMode === 'ALL' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>
                    Coloque o tablet na mesa ou exiba os cartões abaixo para que cada participante escaneie seu próprio código:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  {allPlayers.map((p) => (
                    <SingleQRCard key={p.id} player={p} roomId={roomId} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
