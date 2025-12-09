
import React, { useEffect } from 'react';
import { X, Keyboard, Command, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ShortcutRow = ({ keys, desc }: { keys: string[], desc: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <span key={i} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 min-w-[24px] text-center shadow-sm">
            {k}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Keyboard className="text-amber-500" size={20}/> Skróty Klawiszowe
            </h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={20}/>
            </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-zinc-950">
            <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                    <Command size={12}/> Ogólne
                </h3>
                <ShortcutRow keys={['Ctrl', 'Z']} desc="Cofnij" />
                <ShortcutRow keys={['Ctrl', 'Y']} desc="Ponów" />
                <ShortcutRow keys={['Ctrl', 'S']} desc="Zapisz (Smart)" />
                <ShortcutRow keys={['Ctrl', 'O']} desc="Menedżer Projektów" />
                <ShortcutRow keys={['Ctrl', 'E']} desc="Eksportuj (.json)" />
                <ShortcutRow keys={['Alt', 'T']} desc="Zmień Motyw" />
            </div>
            
            <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                    <ArrowRight size={12}/> Nawigacja
                </h3>
                <ShortcutRow keys={['Alt', 'Shift', '1']} desc="Kalkulator" />
                <ShortcutRow keys={['Alt', 'Shift', '2']} desc="Logistyka" />
                <ShortcutRow keys={['Alt', 'Shift', '3']} desc="Notatki" />
                <ShortcutRow keys={['Alt', 'Shift', '4']} desc="Dokumenty" />
                <div className="my-2 border-t border-zinc-100 dark:border-zinc-800"></div>
                <ShortcutRow keys={['Alt', 'Q']} desc="Tryb Wstępny" />
                <ShortcutRow keys={['Alt', 'W']} desc="Tryb Końcowy" />
                <ShortcutRow keys={['Alt', 'C']} desc="Porównaj Wersje" />
            </div>
        </div>
        
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-center text-[10px] text-zinc-400">
            Wciśnij <span className="font-bold text-zinc-500 dark:text-zinc-300">Alt + /</span> aby otworzyć to okno w dowolnym momencie.
        </div>
      </div>
    </div>
  );
};
