
import React, { useEffect } from 'react';
import { HistoryEntry } from '../types';
import { Clock, RotateCcw, X, ArrowRight } from 'lucide-react';

interface Props {
  historyLog: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
}

export const HistoryModal: React.FC<Props> = ({ historyLog, onRestore, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="text-yellow-500"/> Historia Zmian
            </h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
            {historyLog.length === 0 ? (
                <p className="text-center text-zinc-400 italic py-8">Brak historii zmian w tej sesji.</p>
            ) : (
                historyLog.map((entry, idx) => (
                    <div key={entry.timestamp} className="flex items-center justify-between p-3 rounded border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <div className="flex flex-col">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">{entry.description}</span>
                            <span className="text-xs text-zinc-400">{new Date(entry.timestamp).toLocaleDateString()}</span>
                        </div>
                        <button 
                            onClick={() => { onRestore(entry); onClose(); }}
                            className="text-xs flex items-center gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-3 py-1.5 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors font-semibold"
                        >
                            <RotateCcw size={14}/> Przywróć
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
