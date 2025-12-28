import React from 'react';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { CorrectionItem } from '../types';

interface Props {
    items: CorrectionItem[];
    onToggle: (id: string) => void;
}

export const CorrectionPanel: React.FC<Props> = ({ items, onToggle }) => {
    if (!items || items.length === 0) return null;

    const resolvedCount = items.filter(i => i.status === 'resolved').length;
    const allResolved = resolvedCount === items.length;

    return (
        <div className={`mb-6 rounded-xl border-2 transition-all shadow-lg overflow-hidden ${allResolved ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10'}`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b-2 ${allResolved ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2">
                    <AlertCircle size={18} className={allResolved ? 'text-emerald-600' : 'text-red-600'} />
                    <h3 className={`font-black uppercase tracking-widest text-xs ${allResolved ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        Lista Poprawek do wykonania
                    </h3>
                </div>
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${allResolved ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {resolvedCount} / {items.length}
                </div>
            </div>

            <div className="p-4 space-y-2">
                {items.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onToggle(item.id)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${item.status === 'resolved'
                                ? 'bg-white/50 dark:bg-zinc-800/50 border-emerald-200 dark:border-emerald-800/50 opacity-70'
                                : 'bg-white dark:bg-zinc-800 border-red-200 dark:border-red-800/50 shadow-sm hover:border-red-400'
                            }`}
                    >
                        <div className="mt-0.5">
                            {item.status === 'resolved' ? (
                                <CheckCircle2 size={18} className="text-emerald-500" />
                            ) : (
                                <Circle size={18} className="text-red-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-bold leading-tight ${item.status === 'resolved' ? 'text-zinc-500 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                {item.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">
                                    Od: {item.requestedBy}
                                </span>
                                <span className="text-[10px] text-zinc-300">
                                    {new Date(item.timestamp).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </button>
                ))}

                {allResolved && (
                    <div className="bg-emerald-500/10 rounded-lg p-3 flex items-center gap-3 animate-pulse border border-emerald-500/20">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                            Wszystkie punkty poprawione! Możesz teraz wysłać projekt do zamknięcia.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
