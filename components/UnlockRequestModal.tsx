import React, { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export const UnlockRequestModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-700 animate-slideUp">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-amber-500">
                        <AlertTriangle size={32} />
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Kalkulacja Zablokowana</h2>
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Ten projekt został zablokowany przez Logistykę lub Menadżera.
                        Wprowadzanie zmian jest możliwe, ale musisz podać powód aktualizacji, który zostanie odnotowany w systemie.
                    </p>

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                            Powód aktualizacji
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="np. Zmiana ilości na prośbę klienta..."
                            className="w-full h-24 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded font-bold transition-colors flex items-center gap-2 text-sm"
                        >
                            <X size={16} /> Anuluj
                        </button>
                        <button
                            onClick={() => onConfirm(reason)}
                            disabled={!reason.trim()}
                            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded font-bold transition-colors flex items-center gap-2 text-sm shadow-lg shadow-amber-500/20"
                        >
                            <Check size={16} /> Zapisz Zmianę
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
