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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edytuj Profil</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={20} className="text-zinc-500" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm">
                        Zmiana zapisana pomyślnie.
                    </div>
                )}

                {profile?.pending_role && (
                    <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm">
                        <strong>Oczekująca zmiana roli:</strong> {
                            profile.pending_role === 'engineer' ? 'Inżynier' :
                                profile.pending_role === 'specialist' ? 'Specjalista' :
                                    profile.pending_role === 'logistics' ? 'Logistyka' : 'Menadżer'
                        }
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Imię i Nazwisko
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Rola
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'engineer' | 'specialist' | 'manager' | 'logistics')}
                            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                        >
                            <option value="engineer">Inżynier</option>
                            <option value="specialist">Specjalista</option>
                            <option value="manager">Menadżer</option>
                            <option value="logistics">Logistyka</option>
                        </select>
                        {!profile?.is_admin && role !== profile?.role && (
                            <p className="text-xs text-amber-600 mt-1">Zmiana roli wymaga zatwierdzenia.</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
