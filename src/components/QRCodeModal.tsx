import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react';

interface QRCodeModalProps {
  title: string;
  subtitle?: string;
  value: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  title,
  subtitle,
  value,
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: 256,
          margin: 2,
          color: {
            dark: '#020617', // slate-950
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center space-y-4 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>

        <div className="flex items-center justify-center gap-2 text-emerald-400">
          <QrCode className="w-5 h-5" />
          <h3 className="font-bold text-base text-white">{title}</h3>
        </div>

        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}

        <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto border-4 border-emerald-500/30">
          <canvas ref={canvasRef} className="rounded-xl block" />
        </div>

        <div className="text-xs text-slate-400 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px]">
          {value}
        </div>

        {/* Dica rápida para iPhone (iOS bloqueia Rede Local no Chrome por padrão) */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 text-left text-[11px] text-amber-200 space-y-1">
          <strong className="text-amber-400 block">📱 Usando iPhone e não abriu no Chrome?</strong>
          <p className="text-slate-300 leading-relaxed">
            1. Abra pelo navegador <strong>Safari</strong> (nativo do iPhone), ou<br />
            2. No iPhone, vá em <strong>Ajustes → Apps → Chrome</strong> e ative a opção <strong>"Rede Local"</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copiado!' : 'Copiar Link'}</span>
          </button>

          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir</span>
          </a>
        </div>
      </div>
    </div>
  );
};
