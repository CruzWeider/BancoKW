import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, X, Sparkles } from 'lucide-react';
import { audio } from '../utils/audio';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPWAButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Registra o Service Worker do PWA (Cache de fotos das cidades e funcionamento rápido)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('Registro do Service Worker:', err));
    }

    // 2. Mantém a tela do celular/tablet acesa durante a partida (Screen Wake Lock API)
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Ignora silenciosamente se o aparelho estiver em modo de economia extrema de bateria
      }
    };

    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Verifica se já está rodando instalado em Tela Cheia (Standalone)
    const checkStandalone = () => {
      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(standaloneMatch);
    };
    checkStandalone();

    // 4. Detecta iPhone / iPad (iOS)
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetected = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDetected);

    // 5. Captura o evento de instalação automática do Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  const handleInstallClick = async () => {
    audio.playClickSound();

    // Se o navegador Android/Chrome forneceu o prompt nativo de 1 clique, dispara imediatamente!
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
        return;
      } catch {
        // Se falhar, abre o modal explicativo
      }
    }

    // No iPhone (iOS) ou quando o prompt automático já foi usado, abre o guia ilustrado super simples
    setShowGuideModal(true);
  };

  if (isInstalled) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-bold text-emerald-300"
        title="Aplicativo Banco KW instalado em modo Tela Cheia com tela sempre acesa"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>App Instalado</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all shrink-0"
        title="Instalar o aplicativo Banco KW na tela inicial do celular"
      >
        <Download className="w-3.5 h-3.5 text-slate-950 shrink-0" />
        <span>Instalar App</span>
      </button>

      {/* Modal Ilustrado Passo a Passo (Especial para iPhone e Android) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 relative my-auto">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho com o Ícone Oficial do Banco KW */}
            <div className="flex items-center gap-3.5 border-b border-slate-800 pb-4">
              <img
                src="/icon.svg"
                alt="Banco KW"
                className="w-14 h-14 rounded-2xl shadow-lg border border-amber-500/40 shrink-0"
              />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Aplicativo Oficial PWA</span>
                </span>
                <h3 className="text-lg font-black text-white">Instalar o Banco KW</h3>
                <p className="text-xs text-slate-400">
                  Fica na tela inicial do celular em tela cheia e mantém a tela acesa!
                </p>
              </div>
            </div>

            {isIOS ? (
              /* Passo a Passo Ilustrado para iPhone (Safari / Chrome no iOS) */
              <div className="space-y-3 text-xs">
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3.5 text-amber-200 font-semibold">
                  📱 <strong>Como instalar no seu iPhone em 2 toques:</strong>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 font-black">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">
                      1. Toque no botão Compartilhar
                    </strong>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Toque no ícone de <strong>Compartilhar</strong> (o quadradinho com uma seta apontando para cima) na barra do navegador do iPhone.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 font-black">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">
                      2. Toque em "Adicionar à Tela de Início"
                    </strong>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Role a lista um pouquinho para baixo, escolha{' '}
                      <strong className="text-emerald-300">Adicionar à Tela de Início</strong> e confirme em <strong>Adicionar</strong>!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Passo a Passo para Android / Outros Navegadores */
              <div className="space-y-3 text-xs">
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 text-emerald-200 font-semibold">
                  🤖 <strong>Como instalar no seu celular Android:</strong>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 font-black">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">
                      1. Abra o menu do navegador (⋮)
                    </strong>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do Chrome.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 font-black">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block text-sm">
                      2. Toque em "Instalar aplicativo"
                    </strong>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Selecione <strong className="text-emerald-300">Instalar aplicativo</strong> (ou <em>Adicionar à tela inicial</em>) e o ícone do <strong>Banco KW</strong> vai aparecer nos seus apps!
                    </p>
                  </div>
                </div>

                {/* No iPhone visto de outro aparelho também mostra a dica rápida */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-400">
                  💡 <strong>No iPhone:</strong> toque em <strong>Compartilhar [↑]</strong> →{' '}
                  <strong>Adicionar à Tela de Início</strong>.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
