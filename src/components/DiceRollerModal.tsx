import React, { useState } from 'react';
import { Dices, Keyboard, Play } from 'lucide-react';
import { audio } from '../utils/audio';

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onRollComplete: (dice1: number, dice2: number, total: number, isManual?: boolean) => void;
}

const DICE_DOTS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
  isOpen,
  onClose,
  playerName,
  onRollComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'DIGITAL' | 'MANUAL'>('DIGITAL');
  const [isRolling, setIsRolling] = useState(false);
  const [dice1, setDice1] = useState(3);
  const [dice2, setDice2] = useState(4);
  const [manualInput, setManualInput] = useState<number>(7);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDigitalRoll = () => {
    setIsRolling(true);
    audio.playDiceRollSound();

    let iterations = 0;
    const interval = setInterval(() => {
      setDice1(Math.floor(Math.random() * 6) + 1);
      setDice2(Math.floor(Math.random() * 6) + 1);
      iterations++;

      if (iterations >= 8) {
        clearInterval(interval);
        const final1 = Math.floor(Math.random() * 6) + 1;
        const final2 = Math.floor(Math.random() * 6) + 1;
        setDice1(final1);
        setDice2(final2);
        setIsRolling(false);

        setTimeout(() => {
          onRollComplete(final1, final2, final1 + final2, false);
          onClose();
        }, 600);
      }
    }, 70);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput < 2 || manualInput > 12) {
      setErrorMsg('A soma de 2 dados físicos deve ser entre 2 e 12.');
      return;
    }
    setErrorMsg(null);
    const d1 = Math.floor(manualInput / 2);
    const d2 = manualInput - d1;
    audio.playDiceRollSound();
    onRollComplete(d1, d2, manualInput, true);
    onClose();
  };

  const renderDiceFace = (value: number) => {
    const dots = DICE_DOTS[value] || DICE_DOTS[1];
    return (
      <div className="w-16 h-16 bg-white rounded-2xl p-2.5 shadow-xl border-2 border-slate-300 grid grid-cols-3 grid-rows-3 gap-0.5 relative transition-transform">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => {
            const hasDot = dots.some(([dr, dc]) => dr === r && dc === c);
            return (
              <div key={`${r}-${c}`} className="flex items-center justify-center">
                {hasDot && <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1">
          ✕
        </button>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Vez de Jogar
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">{playerName}</h3>
          <p className="text-xs text-slate-400">Lance os dados para avançar no tabuleiro de papel</p>
        </div>

        {/* Mode selector */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('DIGITAL')}
            className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'DIGITAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>Dados Digitais</span>
          </button>
          <button
            onClick={() => setActiveTab('MANUAL')}
            className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'MANUAL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Dado Físico</span>
          </button>
        </div>

        {activeTab === 'DIGITAL' ? (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-4 py-3">
              <div className={isRolling ? 'animate-bounce' : ''}>{renderDiceFace(dice1)}</div>
              <div className="text-xl font-bold text-slate-600">+</div>
              <div className={isRolling ? 'animate-bounce' : ''}>{renderDiceFace(dice2)}</div>
            </div>

            <div className="text-sm font-semibold text-slate-300">
              Total:{' '}
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {dice1 + dice2}
              </span>
            </div>

            <button
              onClick={handleDigitalRoll}
              disabled={isRolling}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isRolling ? 'Rolando Dados...' : 'Rolar Dados Agora'}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs text-slate-400">
                Digite a soma que caiu nos dados físicos da mesa:
              </label>
              <input
                type="number"
                min="2"
                max="12"
                required
                value={manualInput || ''}
                onChange={(e) => setManualInput(Number(e.target.value))}
                className="w-24 mx-auto text-center bg-slate-900 border border-slate-700 rounded-xl py-2 text-2xl font-black text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-center gap-1.5 pt-2 flex-wrap">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setManualInput(num)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                      manualInput === num
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Confirmar Jogada ({manualInput} Casas)</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
