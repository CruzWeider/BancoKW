import React, { useState } from 'react';
import { BoardSpace } from '../types/game';
import { formatCurrency, compressImageFileToDataUrl } from '../utils/sync';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Search,
  Check,
  Building,
  Info,
  Image as ImageIcon,
  Upload,
  X,
  Camera,
  Sparkles,
  Tag,
  Landmark
} from 'lucide-react';
import { CityMediaViewer } from './CityMediaViewer';
import { PropertyCardScannerModal } from './PropertyCardScannerModal';
import { audio } from '../utils/audio';

const DRAFT_EDITING_SPACE_KEY = 'bi_customizer_editing_space_v1';
const DRAFT_SCANNER_OPEN_KEY = 'bi_customizer_scanner_open_v1';

interface BoardCustomizerProps {
  spaces: BoardSpace[];
  customPropertyTypes: string[];
  onSaveSpaces: (newSpaces: BoardSpace[]) => void;
  onSavePropertyTypes: (newTypes: string[]) => void;
}

export const BoardCustomizer: React.FC<BoardCustomizerProps> = ({
  spaces,
  customPropertyTypes,
  onSaveSpaces,
  onSavePropertyTypes,
}) => {
  const [boardList, setBoardList] = useState<BoardSpace[]>(spaces);
  const [typesList, setTypesList] = useState<string[]>(customPropertyTypes || []);
  const [editingSpace, setEditingSpace] = useState<BoardSpace | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(DRAFT_EDITING_SPACE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [searchFilter, setSearchFilter] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem(DRAFT_SCANNER_OPEN_KEY) === 'true';
      } catch {
        // ignore
      }
    }
    return false;
  });
  const [scanningTargetId, setScanningTargetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado para cadastrar novos tipos de propriedade pelo próprio usuário
  const [newTypeName, setNewTypeName] = useState('');
  const [modalNewTypeName, setModalNewTypeName] = useState('');
  const [showModalNewTypeInput, setShowModalNewTypeInput] = useState(false);

  React.useEffect(() => {
    setBoardList(spaces);
  }, [spaces]);

  React.useEffect(() => {
    setTypesList(customPropertyTypes || []);
  }, [customPropertyTypes]);

  // Persiste o rascunho do modal em sessionStorage para nunca perder dados ao abrir a câmera do tablet
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (editingSpace) {
        sessionStorage.setItem(DRAFT_EDITING_SPACE_KEY, JSON.stringify(editingSpace));
      } else {
        sessionStorage.removeItem(DRAFT_EDITING_SPACE_KEY);
      }
    } catch {
      // ignore
    }
  }, [editingSpace]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (showScannerModal) {
        sessionStorage.setItem(DRAFT_SCANNER_OPEN_KEY, 'true');
      } else {
        sessionStorage.removeItem(DRAFT_SCANNER_OPEN_KEY);
      }
    } catch {
      // ignore
    }
  }, [showScannerModal]);

  const triggerSavedBanner = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const updateAndPersistSpaces = (nextList: BoardSpace[]) => {
    setBoardList(nextList);
    onSaveSpaces(nextList);
  };

  const handleAddPropertyType = (typeName: string) => {
    const cleaned = typeName.trim();
    if (!cleaned) return;
    if (typesList.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      return;
    }
    const updatedTypes = [...typesList, cleaned];
    setTypesList(updatedTypes);
    onSavePropertyTypes(updatedTypes);
    audio.playClickSound();
  };

  const handleRemovePropertyType = (typeName: string) => {
    const updatedTypes = typesList.filter((t) => t !== typeName);
    setTypesList(updatedTypes);
    onSavePropertyTypes(updatedTypes);
    audio.playClickSound();
  };

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= boardList.length) return;

    const copy = [...boardList];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const resequenced = copy.map((item, idx) => ({
      ...item,
      sequence: idx + 1,
    }));

    updateAndPersistSpaces(resequenced);
    audio.playClickSound();
  };

  const handleDelete = (id: string) => {
    const filtered = boardList.filter((s) => s.id !== id);
    const resequenced = filtered.map((item, idx) => ({
      ...item,
      sequence: idx + 1,
    }));
    updateAndPersistSpaces(resequenced);
    audio.playClickSound();
  };

  const handleAddNew = () => {
    const nextSeq = boardList.length + 1;
    const newSpace: BoardSpace = {
      id: `custom-space-${Date.now()}`,
      sequence: nextSeq,
      name: '',
      type: 'PROPERTY',
      propertyType: typesList[0] || '',
      colorGroup: 'red',
      price: 0, // Valor de compra pode ser informado depois
      houseCost: 30,
      hotelCost: 60,
      baseRent: 20,
      rent1House: 60,
      rent2Houses: 100,
      rentHotel: 160,
      mortgageValue: 80,
      taxAmount: 0,
    };
    setEditingSpace(newSpace);
    audio.playClickSound();
  };

  const handleAddNewTaxSpace = () => {
    const nextSeq = boardList.length + 1;
    const newTaxSpace: BoardSpace = {
      id: `custom-tax-${Date.now()}`,
      sequence: nextSeq,
      name: '',
      type: 'TAX',
      propertyType: 'Imposto',
      colorGroup: 'special',
      price: 0,
      houseCost: 0,
      hotelCost: 0,
      baseRent: 100,
      rent1House: 0,
      rent2Houses: 0,
      rentHotel: 0,
      mortgageValue: 0,
      taxAmount: 100, // Valor padrão editável do imposto
    };
    setEditingSpace(newTaxSpace);
    audio.playClickSound();
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace) return;

    const isTax = editingSpace.type === 'TAX';
    const isCompany = editingSpace.type === 'COMPANY' || editingSpace.propertyType === 'Companhia';
    const taxVal = isTax ? (editingSpace.taxAmount ?? editingSpace.baseRent ?? 0) : 0;

    const finalSpace: BoardSpace = {
      ...editingSpace,
      name:
        editingSpace.name.trim() ||
        (isTax
          ? `Imposto ${editingSpace.sequence}`
          : isCompany
          ? `Companhia ${editingSpace.sequence}`
          : `Propriedade ${editingSpace.sequence}`),
      type: isTax ? 'TAX' : isCompany ? 'COMPANY' : 'PROPERTY',
      taxAmount: isTax ? taxVal : editingSpace.taxAmount,
      baseRent: isTax ? taxVal : editingSpace.baseRent,
    };

    const exists = boardList.some((s) => s.id === finalSpace.id);
    const updated = exists
      ? boardList.map((s) => (s.id === finalSpace.id ? finalSpace : s))
      : [...boardList, finalSpace];

    updateAndPersistSpaces(updated);
    setEditingSpace(null);
    triggerSavedBanner();
    audio.playCoinSound();
  };

  // Permite atualizar rapidamente o Valor de Compra direto no card quando o usuário quiser informar depois
  const handleQuickPriceChange = (spaceId: string, newPrice: number) => {
    const updated = boardList.map((s) =>
      s.id === spaceId ? { ...s, price: Math.max(0, newPrice) } : s
    );
    updateAndPersistSpaces(updated);
  };

  // Permite atualizar rapidamente o Valor do Imposto direto no card
  const handleQuickTaxChange = (spaceId: string, newTax: number) => {
    const val = Math.max(0, newTax);
    const updated = boardList.map((s) =>
      s.id === spaceId ? { ...s, taxAmount: val, baseRent: val } : s
    );
    updateAndPersistSpaces(updated);
  };

  const handleConfirmScannedSpace = (
    scannedData: Partial<BoardSpace>,
    imagePhotoDataUrl?: string
  ) => {
    if (scanningTargetId) {
      const existsInBoard = boardList.some((s) => s.id === scanningTargetId);
      if (existsInBoard) {
        const updated = boardList.map((s) => {
          if (s.id === scanningTargetId) {
            return {
              ...s,
              ...scannedData,
              name: scannedData.name?.trim() || s.name || `Propriedade ${s.sequence}`,
              type: 'PROPERTY' as const,
              imageUrl: imagePhotoDataUrl || s.imageUrl,
            };
          }
          return s;
        });
        updateAndPersistSpaces(updated);
        triggerSavedBanner();
      }
      if (editingSpace && editingSpace.id === scanningTargetId) {
        setEditingSpace({
          ...editingSpace,
          ...scannedData,
          name: scannedData.name?.trim() || editingSpace.name,
          type: 'PROPERTY',
          imageUrl: imagePhotoDataUrl || editingSpace.imageUrl,
        });
      }
      setScanningTargetId(null);
    } else {
      const nextSeq = boardList.length + 1;
      const newSpace: BoardSpace = {
        id: `custom-space-${Date.now()}`,
        sequence: nextSeq,
        name: scannedData.name?.trim() || `Propriedade ${nextSeq}`,
        type: 'PROPERTY',
        propertyType: scannedData.propertyType || typesList[0] || '',
        colorGroup: 'red',
        price: scannedData.price ?? 0,
        houseCost: scannedData.houseCost ?? 30,
        hotelCost: scannedData.hotelCost ?? 60,
        baseRent: scannedData.baseRent ?? 20,
        rent1House: scannedData.rent1House ?? 60,
        rent2Houses: scannedData.rent2Houses ?? 100,
        rentHotel: scannedData.rentHotel ?? 160,
        mortgageValue: scannedData.mortgageValue ?? 80,
        imageUrl: imagePhotoDataUrl,
      };
      const nextList = [...boardList, newSpace];
      updateAndPersistSpaces(nextList);
      triggerSavedBanner();
    }
    setShowScannerModal(false);
    audio.playVictoryFanfare();
  };

  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja excluir TODAS as propriedades cadastradas no banco local?')) {
      updateAndPersistSpaces([]);
      audio.playClickSound();
    }
  };

  const handleSaveToGame = () => {
    onSaveSpaces(boardList);
    triggerSavedBanner();
    audio.playVictoryFanfare();
  };

  // Upload e compressão de foto local
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSpace) return;

    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file, 900, 0.78);
      setEditingSpace((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: compressedDataUrl,
            }
          : null
      );
      audio.playClickSound();
    } catch {
      alert('Não foi possível processar a foto selecionada.');
    }
  };

  const filteredSpaces = boardList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.sequence.toString() === searchFilter.trim() ||
      (s.propertyType || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.type === 'TAX' && 'imposto'.includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner de Confirmação de Salvamento */}
      {savedSuccess && (
        <div className="bg-emerald-950/90 border border-emerald-500 rounded-2xl p-3.5 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Propriedade / Tabuleiro salvo com sucesso no Banco Local!</span>
        </div>
      )}

      {/* Header Info — Empilhado em 2 linhas para que os botões nunca saiam para fora da tela no tablet */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-4 overflow-hidden">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Cadastro de Propriedades e Impostos do Jogo</span>
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              {boardList.length} Casas Cadastradas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cadastre os cards de propriedades (<strong>Casa, Hotel, Aluguéis de 1 e 2 Casas, Hotel e Hipoteca</strong>) e também os lugares de <strong>Imposto obrigatório ao Banco</strong> definindo o valor do imposto.
          </p>
        </div>

        {/* Barra de Botões Responsiva com quebra automática dentro do card */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80 w-full">
          <button
            type="button"
            onClick={() => {
              setScanningTargetId(null);
              setShowScannerModal(true);
              audio.playClickSound();
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            title="Tirar foto do cartão físico de papel e incluir no tabuleiro com IA"
          >
            <Camera className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Incluir por Foto do Card</span>
          </button>
          <button
            type="button"
            onClick={handleAddNew}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Nova Propriedade</span>
          </button>
          <button
            type="button"
            onClick={handleAddNewTaxSpace}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
            title="Cadastrar um lugar no tabuleiro que obriga o jogador a pagar imposto para o Banco"
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span>Novo Imposto (Banco)</span>
          </button>
          {boardList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-rose-950/70 text-rose-300 hover:text-white hover:bg-rose-900 border border-rose-800/70 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Excluir Todas</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveToGame}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-colors sm:ml-auto"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-200 shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
            <span>{savedSuccess ? 'Salvo no Banco Local!' : 'Salvar no Banco Local'}</span>
          </button>
        </div>
      </div>

      {/* Gerenciador dos Tipos de Propriedade do Usuário */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              Meus Tipos de Propriedade ({typesList.length})
            </h2>
            <span className="text-xs text-slate-400">
              Cadastre aqui os tipos de propriedades do seu jogo (ex: Cidade, País, Companhia, Imposto...)
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTypeName.trim()) return;
            handleAddPropertyType(newTypeName);
            setNewTypeName('');
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <input
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="Digite um novo tipo de propriedade e clique em Adicionar..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!newTypeName.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Meu Tipo</span>
          </button>
        </form>

        {typesList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {typesList.map((typeItem) => (
              <span
                key={typeItem}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-700 text-xs font-semibold text-amber-300"
              >
                <span>{typeItem}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePropertyType(typeItem)}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                  title={`Remover tipo ${typeItem}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Nenhum tipo cadastrado ainda. Digite acima (ou dentro da janela da propriedade) para criar seus próprios tipos.
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search */}
      {boardList.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por nome da propriedade (ex: ROMA), imposto, número ou tipo..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>
      )}

      {boardList.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <Building className="w-7 h-7" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h2 className="text-lg font-extrabold text-white">
              Cadastre os Cards e Impostos Reais do Seu Jogo
            </h2>
            <p className="text-xs text-slate-400">
              Tire uma foto do card físico (como o de <strong>ROMA</strong>), adicione uma propriedade manualmente ou cadastre lugares de <strong>Imposto ao Banco</strong>!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setScanningTargetId(null);
                setShowScannerModal(true);
                audio.playClickSound();
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>Cadastrar por Foto do Card</span>
            </button>
            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nova Propriedade</span>
            </button>
            <button
              type="button"
              onClick={handleAddNewTaxSpace}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
            >
              <Landmark className="w-4 h-4 shrink-0" />
              <span>Novo Imposto (Pagar ao Banco)</span>
            </button>
          </div>
        </div>
      )}

      {/* Cards Grid - Layout Fiel ao Cartão Físico do Jogo, Companhias e Impostos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSpaces.map((space) => {
          const originalIndex = boardList.findIndex((s) => s.id === space.id);
          const isTaxSpace = space.type === 'TAX';
          const isCompanySpace = space.type === 'COMPANY' || space.propertyType === 'Companhia';
          const currentTaxVal = space.taxAmount ?? space.baseRent ?? space.price ?? 0;

          return (
            <div
              key={space.id}
              className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all flex flex-col justify-between shadow-xl ${
                isTaxSpace
                  ? 'border-rose-600/70 hover:border-rose-500'
                  : isCompanySpace
                  ? 'border-cyan-600/70 hover:border-cyan-400'
                  : 'border-slate-700/90 hover:border-amber-500/60'
              }`}
            >
              <div>
                {/* Cabeçalho no estilo do Card Físico */}
                <div
                  className={`px-3.5 py-2.5 bg-slate-950 border-b-2 flex items-center justify-between gap-2 ${
                    isTaxSpace
                      ? 'border-rose-500/60'
                      : isCompanySpace
                      ? 'border-cyan-500/60'
                      : 'border-amber-500/60'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md bg-slate-900 font-mono text-xs font-bold flex items-center justify-center border shrink-0 ${
                      isTaxSpace
                        ? 'text-rose-400 border-rose-500/30'
                        : isCompanySpace
                        ? 'text-cyan-400 border-cyan-500/30'
                        : 'text-amber-400 border-amber-500/30'
                    }`}
                  >
                    #{space.sequence}
                  </span>
                  <h3
                    className={`text-base font-black tracking-wide uppercase truncate text-center flex-1 ${
                      isCompanySpace ? 'text-cyan-300' : 'text-rose-400'
                    }`}
                  >
                    {space.name}
                  </h3>
                  {isTaxSpace ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                      IMPOSTO
                    </span>
                  ) : isCompanySpace ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                      {space.propertyType || 'Companhia'}
                    </span>
                  ) : space.propertyType ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 truncate max-w-[90px]">
                      {space.propertyType}
                    </span>
                  ) : (
                    <span className="w-6" />
                  )}
                </div>

                {isTaxSpace ? (
                  /* ================= VISUALIZAÇÃO DO CARD DE IMPOSTO AO BANCO ================= */
                  <div className="p-3.5 space-y-3">
                    {space.imageUrl && (
                      <CityMediaViewer
                        name={space.name}
                        imageUrl={space.imageUrl}
                        size="sm"
                      />
                    )}

                    <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 text-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 block">
                        Pagamento Obrigatório ao Banco
                      </span>
                      <div className="text-2xl font-black text-white font-mono">
                        {formatCurrency(currentTaxVal)}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Ao cair aqui, o jogador paga este valor diretamente ao Banco Central.
                      </p>
                    </div>

                    {/* Ajuste rápido do Valor do Imposto */}
                    <div className="bg-rose-950/25 p-2.5 rounded-xl border border-rose-800/40 flex items-center justify-between gap-2 text-xs">
                      <span className="text-rose-300 font-bold text-[11px]">
                        Valor do Imposto:
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-rose-400 font-mono text-xs font-bold">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={currentTaxVal || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleQuickTaxChange(space.id, Number(e.target.value))
                          }
                          className="w-28 bg-slate-950 border border-rose-700/60 rounded-lg px-2 py-1 text-right text-rose-300 font-mono text-xs font-bold focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : isCompanySpace ? (
                  /* ================= VISUALIZAÇÃO DO CARD DE COMPANHIA (Dados x $ 50) ================= */
                  <div className="p-3.5 space-y-3">
                    {space.imageUrl ? (
                      <CityMediaViewer
                        name={space.name}
                        imageUrl={space.imageUrl}
                        size="sm"
                      />
                    ) : (
                      <div className="aspect-[16/9] rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                        <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                        <span className="text-[10px]">Sem Foto</span>
                      </div>
                    )}

                    {/* Regra Fiel do Cartão de Companhia */}
                    <div className="bg-slate-950/90 p-3.5 rounded-xl border border-cyan-800/50 text-center space-y-2">
                      <div className="text-xs font-black uppercase tracking-wider text-rose-400">
                        ALUGUEL:
                      </div>
                      <div className="text-xs font-bold text-slate-200 uppercase leading-relaxed">
                        Pontos nos dados multiplicados por{' '}
                        <strong className="text-cyan-300 font-mono text-sm">
                          {formatCurrency(space.baseRent || 50)}
                        </strong>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-blue-400 font-bold">HIPOTECA</span>
                        <span className="flex-1 border-b border-dotted border-slate-700 mx-2 h-3" />
                        <span className="text-blue-300 font-bold">
                          {formatCurrency(space.mortgageValue)}
                        </span>
                      </div>
                    </div>

                    {/* Valor de Compra da Companhia */}
                    <div className="bg-emerald-950/25 p-2.5 rounded-xl border border-emerald-800/40 flex items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-300 font-bold text-[11px]">
                        Valor de Compra:
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-mono text-xs font-bold">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={space.price || ''}
                          placeholder="100"
                          onChange={(e) =>
                            handleQuickPriceChange(space.id, Number(e.target.value))
                          }
                          className="w-28 bg-slate-950 border border-emerald-700/60 rounded-lg px-2 py-1 text-right text-emerald-300 font-mono text-xs font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================= VISUALIZAÇÃO DO CARD DE PROPRIEDADE (Ex: ROMA) ================= */
                  <div className="p-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-3 items-center bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        {space.imageUrl ? (
                          <CityMediaViewer
                            name={space.name}
                            imageUrl={space.imageUrl}
                            size="sm"
                          />
                        ) : (
                          <div className="aspect-[4/3] rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                            <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                            <span className="text-[10px]">Sem Foto</span>
                          </div>
                        )}
                      </div>

                      <div className="text-center space-y-2">
                        <div className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                          <span className="block text-[10px] font-black uppercase text-slate-300 tracking-wider">
                            CASA
                          </span>
                          <strong className="text-sm font-mono font-black text-white">
                            {formatCurrency(space.houseCost)}
                          </strong>
                        </div>
                        <div className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                          <span className="block text-[10px] font-black uppercase text-amber-400 tracking-wider">
                            HOTEL
                          </span>
                          <strong className="text-sm font-mono font-black text-amber-300">
                            {formatCurrency(space.hotelCost ?? space.houseCost)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Tabela de Aluguéis e Hipoteca idêntica ao Card Físico */}
                    <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-blue-400 font-bold">
                        <span>ALUGUEL</span>
                        <span className="flex-1 border-b border-dotted border-slate-700 mx-2 h-3" />
                        <span>{formatCurrency(space.baseRent)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-200">
                        <span>COM 1 CASA</span>
                        <span className="flex-1 border-b border-dotted border-slate-800 mx-2 h-3" />
                        <span>{formatCurrency(space.rent1House)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-200">
                        <span>COM 2 CASAS</span>
                        <span className="flex-1 border-b border-dotted border-slate-800 mx-2 h-3" />
                        <span>{formatCurrency(space.rent2Houses)}</span>
                      </div>
                      <div className="flex items-center justify-between text-amber-300 font-semibold">
                        <span>COM HOTEL</span>
                        <span className="flex-1 border-b border-dotted border-slate-800 mx-2 h-3" />
                        <span>{formatCurrency(space.rentHotel)}</span>
                      </div>
                      <div className="flex items-center justify-between text-blue-400 font-bold pt-1 border-t border-slate-800/80">
                        <span>HIPOTECA</span>
                        <span className="flex-1 border-b border-dotted border-slate-700 mx-2 h-3" />
                        <span>{formatCurrency(space.mortgageValue)}</span>
                      </div>
                    </div>

                    {/* Campo rápido para informar/atualizar o Valor de Compra depois */}
                    <div className="bg-emerald-950/25 p-2.5 rounded-xl border border-emerald-800/40 flex items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-300 font-bold text-[11px]">
                        Valor de Compra:
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-mono text-xs font-bold">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={space.price || ''}
                          placeholder="Informar depois"
                          onChange={(e) =>
                            handleQuickPriceChange(space.id, Number(e.target.value))
                          }
                          className="w-28 bg-slate-950 border border-emerald-700/60 rounded-lg px-2 py-1 text-right text-emerald-300 font-mono text-xs font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Action Controls */}
              <div className="p-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs bg-slate-950/50">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMove(originalIndex, 'UP')}
                    disabled={originalIndex === 0}
                    title="Mover para antes"
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(originalIndex, 'DOWN')}
                    disabled={originalIndex === boardList.length - 1}
                    title="Mover para depois"
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isTaxSpace && (
                    <button
                      onClick={() => {
                        setScanningTargetId(space.id);
                        setShowScannerModal(true);
                        audio.playClickSound();
                      }}
                      title="Escanear carta de papel para preencher esta propriedade com IA"
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingSpace(space)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(space.id)}
                    title="Remover casa"
                    className="p-1 rounded text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Cadastro / Edição (Propriedade ou Imposto ao Banco) */}
      {editingSpace && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Casa #{editingSpace.sequence}</span>
                {editingSpace.name && (
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase">
                    {editingSpace.name}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setEditingSpace(null)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Seletor: Propriedade (Card) vs Imposto Obrigatório ao Banco */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setEditingSpace({ ...editingSpace, type: 'PROPERTY' })}
                className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  editingSpace.type !== 'TAX'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Propriedade (Card)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setEditingSpace({
                    ...editingSpace,
                    type: 'TAX',
                    taxAmount: editingSpace.taxAmount || 100,
                  })
                }
                className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  editingSpace.type === 'TAX'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Imposto (Pagar ao Banco)</span>
              </button>
            </div>

            {editingSpace.type !== 'TAX' && (
              /* Banner rápido para escanear card por foto */
              <div className="bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-amber-200 truncate">
                    Quer preencher automaticamente tirando foto do card físico?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanningTargetId(editingSpace.id);
                    setShowScannerModal(true);
                    audio.playClickSound();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] shrink-0 flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Escanear Foto</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {editingSpace.type === 'TAX' ? (
                /* ================= FORMULÁRIO DE IMPOSTO AO BANCO ================= */
                <div className="space-y-4">
                  <div className="bg-rose-950/30 border border-rose-800/60 p-4 rounded-2xl space-y-3">
                    <div>
                      <label className="block text-slate-200 font-bold mb-1">
                        Nome do Lugar de Imposto no Tabuleiro:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Imposto de Renda, Alfândega, Taxa do Banco..."
                        value={editingSpace.name}
                        onChange={(e) => setEditingSpace({ ...editingSpace, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold uppercase focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-rose-300 font-black uppercase mb-1">
                        Valor do Imposto a Pagar para o Banco ($):
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="10"
                        placeholder="Ex: 100"
                        value={editingSpace.taxAmount ?? editingSpace.baseRent ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingSpace({
                            ...editingSpace,
                            taxAmount: val,
                            baseRent: val,
                          });
                        }}
                        className="w-full bg-slate-950 border border-rose-600/70 rounded-xl px-3 py-2.5 text-rose-300 font-mono font-black text-base focus:outline-none focus:border-rose-400"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Sempre que um jogador cair neste lugar, o sistema cobrará exatamente esse valor para o Banco Central.
                      </span>
                    </div>
                  </div>

                  {/* Foto Opcional para o Imposto */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span>Foto da Casa no Tabuleiro (Opcional):</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Enviar Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileUpload}
                          className="hidden"
                        />
                      </label>
                      {editingSpace.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingSpace({ ...editingSpace, imageUrl: undefined })}
                          className="p-2 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= FORMULÁRIO DE PROPRIEDADE (CARD FÍSICO) ================= */
                <>
                  {/* Nome e Valor de Compra */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Nome da Propriedade (ex: ROMA):
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: ROMA"
                        value={editingSpace.name}
                        onChange={(e) => setEditingSpace({ ...editingSpace, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold uppercase focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-emerald-400 font-bold mb-1">
                        Valor de Compra (opcional p/ depois):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="0 = informar depois"
                        value={editingSpace.price || ''}
                        onChange={(e) =>
                          setEditingSpace({ ...editingSpace, price: Number(e.target.value) })
                        }
                        className="w-full bg-slate-950 border border-emerald-700/60 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Campo Tipo de Propriedade com criação pelo próprio usuário */}
                  <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tipo de Propriedade:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowModalNewTypeInput(!showModalNewTypeInput)}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showModalNewTypeInput ? 'Fechar novo tipo' : 'Cadastrar Novo Tipo'}</span>
                      </button>
                    </div>

                    {(showModalNewTypeInput || typesList.length === 0) && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={modalNewTypeName}
                          onChange={(e) => setModalNewTypeName(e.target.value)}
                          placeholder="Digite seu tipo (ex: Cidade, País, Companhia...)"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = modalNewTypeName.trim();
                            if (!trimmed) return;
                            handleAddPropertyType(trimmed);
                            setEditingSpace({ ...editingSpace, propertyType: trimmed });
                            setModalNewTypeName('');
                            setShowModalNewTypeInput(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0"
                        >
                          Adicionar Tipo
                        </button>
                      </div>
                    )}

                    {typesList.length > 0 && (
                      <select
                        value={editingSpace.propertyType || ''}
                        onChange={(e) =>
                          setEditingSpace({ ...editingSpace, propertyType: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- Selecione um dos seus tipos cadastrados --</option>
                        {typesList.map((typeItem) => (
                          <option key={typeItem} value={typeItem}>
                            {typeItem}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Foto da Propriedade + CASA ($) e HOTEL ($) lado a lado como no Card Físico */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                    <div className="space-y-2">
                      <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Foto da Propriedade:</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                          <Upload className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Enviar Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileUpload}
                            className="hidden"
                          />
                        </label>

                        {editingSpace.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setEditingSpace({ ...editingSpace, imageUrl: undefined })}
                            className="p-2 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900"
                            title="Remover foto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {editingSpace.imageUrl && (
                        <div className="relative h-24 rounded-xl overflow-hidden border border-slate-700">
                          <img
                            src={editingSpace.imageUrl}
                            alt="Prévia da foto"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* CASA ($) e HOTEL ($) */}
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-slate-200 font-black uppercase mb-1">
                          CASA ($) — Custo da Casa:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.houseCost}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, houseCost: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-400 font-black uppercase mb-1">
                          HOTEL ($) — Custo do Hotel:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.hotelCost ?? editingSpace.houseCost}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, hotelCost: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-amber-600/60 rounded-lg px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Opções Exatas do Card: ALUGUEL, COM 1 CASA, COM 2 CASAS, COM HOTEL e HIPOTECA */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="font-bold text-slate-200 flex items-center justify-between">
                      <span>Valores Impressos no Card (2 Casas + Hotel):</span>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        Sem 3ª casa (após 2 casas já constrói Hotel)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-blue-400 font-bold mb-0.5">ALUGUEL ($):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.baseRent}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, baseRent: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5">COM 1 CASA ($):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.rent1House}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, rent1House: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5">COM 2 CASAS ($):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.rent2Houses}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, rent2Houses: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-400 font-bold mb-0.5">COM HOTEL ($):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.rentHotel}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, rentHotel: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-amber-600/50 rounded-lg px-2.5 py-1.5 text-amber-200 font-mono font-bold"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-blue-400 font-bold mb-0.5">HIPOTECA ($):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingSpace.mortgageValue}
                          onChange={(e) =>
                            setEditingSpace({ ...editingSpace, mortgageValue: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-blue-600/50 rounded-lg px-2.5 py-1.5 text-blue-300 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSpace(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-black transition-colors shadow-md ${
                    editingSpace.type === 'TAX'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  {editingSpace.type === 'TAX' ? 'Salvar Imposto ao Banco' : 'Salvar Propriedade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Property Card Scanner Modal (Gemini Vision OCR) */}
      <PropertyCardScannerModal
        isOpen={showScannerModal}
        onClose={() => {
          setShowScannerModal(false);
          setScanningTargetId(null);
        }}
        onConfirmSpace={handleConfirmScannedSpace}
        existingSpaceSequence={
          scanningTargetId
            ? boardList.find((s) => s.id === scanningTargetId)?.sequence
            : undefined
        }
        customPropertyTypes={typesList}
        onAddPropertyType={handleAddPropertyType}
      />
    </div>
  );
};
