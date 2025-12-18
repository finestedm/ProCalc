import React, { useState } from 'react';
import { User, X, Save, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileEditModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { profile, updateProfile } = useAuth();
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [role, setRole] = useState<'engineer' | 'specialist' | 'admin'>(profile?.role || 'engineer');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        setLoading(true);

        const { error: updateError } = await updateProfile({
            full_name: fullName,
            role: role,
        });

        if (updateError) {
            setError(updateError.message || 'Błąd aktualizacji profilu');
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            setTimeout(() => {
                onClose();
            }, 1500);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <User size={24} />
                                Edycja Profilu
                            </h2>
                            <p className="text-blue-100 text-sm mt-1">Zaktualizuj swoje dane</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                            <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-700 dark:text-green-300">Profil zaktualizowany!</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                            Email (nie można zmienić)
                        </label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                            Imię i nazwisko
                        </label>
                        <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Jan Kowalski"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                            Rola *
                        </label>
                        <select
                            required
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'engineer' | 'specialist' | 'admin')}
                            className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                            disabled={loading}
                        >
                            <option value="engineer">Inżynier</option>
                            <option value="specialist">Specjalista</option>
                            <option value="admin">Administrator</option>
                        </select>
                        <p className="text-xs text-zinc-400 mt-1">Wybierz swoją rolę w firmie</p>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                            disabled={loading}
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader size={16} className="animate-spin" />
                                    Zapisywanie...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Zapisz
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
