import React, { useState, useRef, useEffect } from 'react';
import { BoardSpace } from '../types/game';
import { compressImageFileToDataUrl } from '../utils/sync';
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Plus,
  Tag
} from 'lucide-react';
import { audio } from '../utils/audio';

const SCANNER_DRAFT_KEY = 'bi_scanner_draft_v1';

interface PropertyCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSpace: (scannedSpace: Partial<BoardSpace>, imagePhotoDataUrl?: string) => void;
  existingSpaceSequence?: number;
  customPropertyTypes: string[];
  onAddPropertyType: (newType: string) => void;
}

export const PropertyCardScannerModal: React.FC<PropertyCardScannerModalProps> = ({
  isOpen,
  onClose,
  onConfirmSpace,
  existingSpaceSequence,
  customPropertyTypes,
  onAddPropertyType,
}) => {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(SCANNER_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.photoDataUrl || null;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usePhotoAsPropertyImage, setUsePhotoAsPropertyImage] = useState(true);
  const [extractedData, setExtractedData] = useState<Partial<BoardSpace> | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(SCANNER_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.extractedData || null;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [newTypeInput, setNewTypeInput] = useState('');
  const [showNewTypeBox, setShowNewTypeBox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (photoDataUrl || extractedData) {
        sessionStorage.setItem(
          SCANNER_DRAFT_KEY,
          JSON.stringify({ photoDataUrl, extractedData })
        );
      } else {
        sessionStorage.removeItem(SCANNER_DRAFT_KEY);
      }
    } catch {
      // ignore
    }
  }, [photoDataUrl, extractedData]);

  if (!isOpen) return null;

  const handleImageFile = async (file: File) => {
    if (!file) return;

    setErrorMsg(null);
    setIsAnalyzing(true);

    // Preenche imediatamente os dados base do card para que o formulário nunca fique vazio
    const initialCardData: Partial<BoardSpace> = {
      name: '',
      type: 'PROPERTY',
      propertyType: customPropertyTypes[0] || '',
      colorGroup: 'red',
      price: 0,
      houseCost: 30,
      hotelCost: 60,
      baseRent: 20,
      rent1House: 60,
      rent2Houses: 100,
      rentHotel: 160,
      mortgageValue: 80,
    };
    setExtractedData(initialCardData);

    try {
      // Comprime a foto da câmera do tablet (ex: 6MB -> ~60KB) para salvar instantaneamente
      const compressedDataUrl = await compressImageFileToDataUrl(file, 900, 0.78);
      setPhotoDataUrl(compressedDataUrl);
      await analyzePhotoWithGemini(compressedDataUrl, 'image/jpeg', initialCardData);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg('Foto carregada! Preencha ou confira os valores do card abaixo e clique em Salvar Propriedade.');
    }
  };

  const analyzePhotoWithGemini = async (
    base64Image: string,
    mimeType: string,
    fallbackData: Partial<BoardSpace>
  ) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    audio.playClickSound();

    try {
      const response = await fetch('/api/parse-property-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Falha ao analisar a foto.');
      }

      const parsed = result.data;

      const newSpaceData: Partial<BoardSpace> = {
        name: parsed.name || '',
        type: 'PROPERTY',
        propertyType: customPropertyTypes[0] || '',
        colorGroup: 'red',
        price: Number(parsed.price) || 0,
        houseCost: Number(parsed.houseCost) || 30,
        hotelCost: Number(parsed.hotelCost) || 60,
        baseRent: Number(parsed.baseRent) || 20,
        rent1House: Number(parsed.rent1House) || 60,
        rent2Houses: Number(parsed.rent2Houses) || 100,
        rentHotel: Number(parsed.rentHotel) || 160,
        mortgageValue: Number(parsed.mortgageValue) || 80,
      };

      setExtractedData(newSpaceData);
      audio.playVictoryFanfare();
    } catch (err: any) {
      console.warn('Aviso na leitura automática da carta:', err);
      setErrorMsg(
        'Foto anexada com sucesso! Confira ou digite o nome e os valores do card abaixo e clique em Salvar Propriedade.'
      );
      setExtractedData((prev) => prev || fallbackData);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateCustomType = () => {
    const trimmed = newTypeInput.trim();
    if (!trimmed) return;
    onAddPropertyType(trimmed);
    if (extractedData) {
      setExtractedData({ ...extractedData, propertyType: trimmed });
    }
    setNewTypeInput('');
    setShowNewTypeBox(false);
    audio.playClickSound();
  };

  const handleConfirm = () => {
    if (!extractedData) return;
    onConfirmSpace(extractedData, usePhotoAsPropertyImage && photoDataUrl ? photoDataUrl : undefined);
    audio.playCoinSound();
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setPhotoDataUrl(null);
    setExtractedData(null);
    setErrorMsg(null);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SCANNER_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Escanear Card de Propriedade
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>IA Gemini Vision</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tire foto do card físico (Nome, Casa, Hotel, Aluguéis e Hipoteca). O valor de compra pode ser informado depois!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File / Camera Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageFile(f);
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageFile(f);
          }}
        />

        {/* STEP 1: Upload or Capture if no photo yet */}
        {!photoDataUrl && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-3xl p-6 sm:p-8 text-center bg-slate-950/60 transition-colors space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Camera className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Fotografe o Card Físico do seu Jogo
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Aponte a câmera para o card (ex: ROMA) mostrando CASA, HOTEL, ALUGUEL, COM 1 CASA, COM 2 CASAS, COM HOTEL e HIPOTECA.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 text-slate-950" />
                  <span>Tirar Foto com a Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Upload className="w-4 h-4 text-slate-300" />
                  <span>Escolher da Galeria / Arquivos</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 & 3: Photo Preview and AI Extraction State */}
        {photoDataUrl && (
          <div className="space-y-4">
            {isAnalyzing ? (
              <div className="p-8 text-center space-y-4 bg-slate-950/80 rounded-2xl border border-amber-500/40">
                <div className="w-12 h-12 mx-auto rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>Lendo card físico com Inteligência Artificial...</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Extraindo Nome, Casa, Hotel, Aluguéis (1 Casa, 2 Casas, Hotel) e Hipoteca.
                  </p>
                </div>
              </div>
            ) : null}

            {errorMsg && (
              <div className="p-3 bg-amber-950/70 border border-amber-800 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {extractedData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Photo thumbnail */}
                  <div className="sm:col-span-1 bg-slate-950 p-2 rounded-2xl border border-slate-800 flex flex-col justify-between">
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                      <img
                        src={photoDataUrl}
                        alt="Carta capturada"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/75 text-[9px] text-white px-1.5 py-0.5 rounded">
                        Foto do Card
                      </span>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="w-full py-1.5 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 hover:bg-slate-900 rounded-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tirar Outra Foto</span>
                      </button>
                    </div>
                  </div>

                  {/* Form fields matching the exact physical card */}
                  <div className="sm:col-span-2 space-y-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Dados do Card</span>
                      </span>
                      {existingSpaceSequence && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Casa #{existingSpaceSequence}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Nome */}
                      <div className="sm:col-span-2">
                        <label className="block text-slate-300 mb-0.5 text-[11px] font-bold uppercase">
                          Nome da Propriedade (ex: ROMA):
                        </label>
                        <input
                          type="text"
                          value={extractedData.name || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, name: e.target.value })}
                          placeholder="Ex: ROMA"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Tipo de Propriedade (Cadastrado pelo próprio usuário) */}
                      <div className="sm:col-span-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-300 text-[11px] font-bold flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-amber-400" />
                            <span>Tipo de Propriedade:</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowNewTypeBox(!showNewTypeBox)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Cadastrar Meu Tipo</span>
                          </button>
                        </div>

                        {showNewTypeBox || customPropertyTypes.length === 0 ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newTypeInput}
                              onChange={(e) => setNewTypeInput(e.target.value)}
                              placeholder="Digite um tipo (ex: Cidade, País, Europa...)"
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={handleCreateCustomType}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </div>
                        ) : null}

                        {customPropertyTypes.length > 0 && (
                          <select
                            value={extractedData.propertyType || ''}
                            onChange={(e) =>
                              setExtractedData({ ...extractedData, propertyType: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500 text-xs"
                          >
                            <option value="">-- Selecione um tipo --</option>
                            {customPropertyTypes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* CASA ($) e HOTEL ($) */}
                      <div>
                        <label className="block text-amber-300 mb-0.5 text-[11px] font-bold">
                          CASA ($) — Custo 1 Casa:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.houseCost ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, houseCost: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-300 mb-0.5 text-[11px] font-bold">
                          HOTEL ($) — Custo Hotel:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.hotelCost ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, hotelCost: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* ALUGUEL, COM 1 CASA, COM 2 CASAS, COM HOTEL */}
                      <div>
                        <label className="block text-blue-400 mb-0.5 text-[11px] font-bold">
                          ALUGUEL ($):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.baseRent ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, baseRent: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-0.5 text-[11px] font-bold">
                          COM 1 CASA ($):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.rent1House ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, rent1House: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-0.5 text-[11px] font-bold">
                          COM 2 CASAS ($):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.rent2Houses ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, rent2Houses: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-0.5 text-[11px] font-bold">
                          COM HOTEL ($):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.rentHotel ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, rentHotel: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* HIPOTECA ($) e VALOR DE COMPRA (opcional para depois) */}
                      <div>
                        <label className="block text-blue-400 mb-0.5 text-[11px] font-bold">
                          HIPOTECA ($):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.mortgageValue ?? 0}
                          onChange={(e) =>
                            setExtractedData({
                              ...extractedData,
                              mortgageValue: Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-emerald-400 mb-0.5 text-[11px] font-bold">
                          Valor de Compra (opcional p/ depois):
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={extractedData.price ?? 0}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, price: Number(e.target.value) })
                          }
                          placeholder="0 = informar depois"
                          className="w-full bg-slate-900 border border-emerald-700/50 rounded-lg px-2.5 py-1.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Option to attach photo */}
                    <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePhotoAsPropertyImage}
                        onChange={(e) => setUsePhotoAsPropertyImage(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                      />
                      <span>Salvar foto como imagem oficial da propriedade</span>
                    </label>
                  </div>
                </div>

                {/* Confirm Action Button */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Salvar Propriedade</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
