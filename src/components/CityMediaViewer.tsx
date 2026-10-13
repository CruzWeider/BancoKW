import React, { useState } from 'react';
import { Play, Image as ImageIcon, Video, X, ExternalLink } from 'lucide-react';

interface CityMediaViewerProps {
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetailsButton?: boolean;
}

export function getEmbedVideoUrl(url?: string): { isYouTube: boolean; embedUrl?: string } {
  if (!url) return { isYouTube: false };

  // Match youtube watch URL
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1`,
    };
  }

  return { isYouTube: false, embedUrl: url };
}

export const CityMediaViewer: React.FC<CityMediaViewerProps> = ({
  name,
  imageUrl,
  videoUrl,
  size = 'md',
  showDetailsButton = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isYouTube, embedUrl } = getEmbedVideoUrl(videoUrl);

  const hasMedia = Boolean(imageUrl || videoUrl);
  if (!hasMedia) return null;

  const heightClass =
    size === 'sm' ? 'h-24' : size === 'lg' ? 'h-56 sm:h-64' : 'h-36 sm:h-40';

  return (
    <>
      {/* Thumbnail Trigger */}
      <div
        onClick={() => setIsOpen(true)}
        className={`relative w-full ${heightClass} rounded-xl overflow-hidden cursor-pointer group bg-slate-950 border border-slate-800 shadow-inner`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // Hide broken image
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-850 text-slate-500">
            {videoUrl ? <Video className="w-8 h-8 text-blue-400" /> : <ImageIcon className="w-8 h-8" />}
            <span className="text-[11px] mt-1 font-semibold text-slate-400">Ver Vídeo</span>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 group-hover:from-slate-950/90 transition-colors" />

        {/* Video / Photo Badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {videoUrl && (
            <span className="px-2 py-0.5 rounded-md bg-rose-600/90 text-white font-bold text-[10px] flex items-center gap-1 shadow-md">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>VÍDEO</span>
            </span>
          )}
          {imageUrl && !videoUrl && (
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-slate-300 text-[10px] flex items-center gap-1 backdrop-blur-sm">
              <ImageIcon className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* Center Play Button if Video Available */}
        {videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        )}

        {/* Bottom City Name */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white font-bold">
          <span className="truncate drop-shadow-md">{name}</span>
          {showDetailsButton && (
            <span className="text-[10px] text-slate-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Ampliar ↗
            </span>
          )}
        </div>
      </div>

      {/* Media Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative space-y-3">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <span>{name}</span>
                  {videoUrl && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                      Vídeo Oficial
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">Galeria de Mídia do Tabuleiro</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Video or Image */}
            <div className="px-4 pb-4">
              {videoUrl ? (
                isYouTube && embedUrl ? (
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                    <iframe
                      src={embedUrl}
                      title={`Vídeo de ${name}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[65vh] rounded-2xl bg-black object-contain shadow-lg"
                  />
                )
              ) : imageUrl ? (
                <div className="max-h-[65vh] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt={name}
                    className="max-h-[65vh] w-auto object-contain rounded-2xl"
                  />
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-4 pb-4 pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
              <span>Mídia associada à propriedade no tabuleiro físico</span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
