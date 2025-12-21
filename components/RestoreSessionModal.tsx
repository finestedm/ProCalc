import React from 'react';
import { History, FilePlus, X, AlertCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onRestore: () => void;
    onDiscard: () => void;
    projectName?: string;
    lastSaved?: string;
}

export const RestoreSessionModal: React.FC<Props> = ({ isOpen, onRestore, onDiscard, projectName, lastSaved }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-300">
                <div className="relative p-6 text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                        <History size={32} />
                    </div>

                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Przywrócić ostatnią sesję?</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
                        Znaleźliśmy niezapisaną sesję lub ostatnio otwarty projekt.
                        {projectName && (
                            <span className="block mt-2 font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg inline-block">
                                {projectName}
                            </span>
                        )}
                        {lastSaved && (
                            <span className="block mt-1 text-xs opacity-75">Ostatnia aktywność: {lastSaved}</span>
                        )}
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onRestore}
                            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            <History size={18} />
                            Przywróć ostatnią sesję
                        </button>

                        <button
                            onClick={onDiscard}
                            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all text-zinc-700 dark:text-zinc-300 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
                        >
                            <FilePlus size={18} />
                            Zacznij nowy projekt
                        </button>
                    </div>

                    <p className="mt-6 text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1 uppercase tracking-widest font-bold">
                        <AlertCircle size={10} /> Dane sesji są przechowywane lokalnie w przeglądarce
                    </p>
                </div>
            </div>
        </div>
    );
};
