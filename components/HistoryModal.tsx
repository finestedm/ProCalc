import React, { useEffect, useState } from 'react';
import { HistoryEntry } from '../types';
import { Clock, RotateCcw, X, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  historyLog: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
}

const HistoryItem: React.FC<{ entry: HistoryEntry, onRestore: () => void }> = ({ entry, onRestore }) => {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = entry.changes && entry.changes.length > 0;
    const details = entry.changes || [];

    // Use description or fallback to first change if generic
    const mainTitle = entry.description.includes('Zmiana: ') && details.length > 0 
        ? `${details.length} zmian(y)` 
        : entry.description;

    return (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-colors overflow-hidden">
            <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                onClick={() => hasDetails && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full flex items-center justify-center transition-colors ${hasDetails ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-700'}`}>
                        {hasDetails ? (expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>) : <Clock size={16}/>}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">{mainTitle}</span>
                        <span className="text-xs text-zinc-400 font-medium">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                </div>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onRestore(); }}
                    className="text-xs flex items-center gap-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-3 py-1.5 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors font-bold ml-4"
                >
                    <RotateCcw size={14}/> Przywróć
                </button>
            </div>

            {expanded && hasDetails && (
                <div className="px-4 pb-4 pt-0 animate-fadeIn bg-zinc-50/50 dark:bg-zinc-800/30">
                    <div className="h-px bg-zinc-100 dark:bg-zinc-700 mb-3 mx-2"></div>
                    <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2 ml-10 border-l-2 border-zinc-200 dark:border-zinc-600 pl-4 py-1">
                        {details.map((change, i) => (
                            <li key={i} className="leading-relaxed flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-500 mt-1.5 shrink-0"></span>
                                {change}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn flex flex-col max-h-[85vh] border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2.5">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-xl text-yellow-600">
                    <Clock size={20}/>
                </div>
                Historia Zmian
            </h2>
            <button onClick={onClose} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={20} />
            </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1 bg-zinc-50 dark:bg-black/20 custom-scrollbar">
            {historyLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-zinc-400 space-y-2">
                    <Clock size={32} className="opacity-20"/>
                    <p className="italic text-sm">Brak historii zmian w tej sesji.</p>
                </div>
            ) : (
                historyLog.map((entry, idx) => (
                    <HistoryItem 
                        key={entry.timestamp} 
                        entry={entry} 
                        onRestore={() => { onRestore(entry); onClose(); }} 
                    />
                ))
            )}
        </div>
      </div>
    </div>
  );
};