import React, { useState } from 'react';
import { Send, X, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storage';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    calculationId: string;
    projectNumber: string;
    onSuccess: () => void;
}

export const RequestAccessModal: React.FC<Props> = ({ isOpen, onClose, calculationId, projectNumber, onSuccess }) => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await storageService.createAccessRequest(calculationId, message);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Nie udało się wysłać prośby.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl overflow-hidden animate-slideUp">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="text-amber-500" size={18} />
                        Prośba o Dostęp
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Kalkulacja <span className="font-mono font-bold text-zinc-900 dark:text-white">{projectNumber}</span> jest obecnie zablokowana do edycji.
                        Wiadomość zostanie wysłana do działu logistyki i managerów.
                    </p>

                    <div className="mb-6">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                            Uzasadnienie (opcjonalnie)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Np. Muszę zaktualizować cenę transportu..."
                            className="w-full h-24 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none"
                        />
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                            ) : (
                                <Send size={16} />
                            )}
                            Wyślij Prośbę
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
