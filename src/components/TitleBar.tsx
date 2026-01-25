import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    window.electron.invoke('window-minimize');
  };

  const handleMaximize = () => {
    window.electron.invoke('window-maximize');
  };

  const handleClose = () => {
    window.electron.invoke('window-close');
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-8 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-50 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 flex items-center justify-center">
          <img src="/MineBench.png" alt="MineBench" className="w-full h-full object-contain" />
        </div>
        <span className="text-xs font-medium text-zinc-400">MineBench Client</span>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 rounded transition-colors text-zinc-400"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
