import React, { useEffect, useState } from 'react';
import { Shield, X, UserCheck, UserX, Crown, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { authService, UserProfile } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const AdminPanel: React.FC<Props> = ({ isOpen, onClose }) => {
    const { profile: currentUserProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadUsers();
        }
    }, [isOpen]);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        const allUsers = await authService.getAllUsers();
        setUsers(allUsers);
        setLoading(false);
    };

    const handleApprove = async (userId: string) => {
        setActionLoading(userId);
        setError(null);
        setSuccessMessage(null);

        const { error } = await authService.approveUser(userId);

        if (error) {
            setError(`Błąd zatwierdzania: ${error.message}`);
        } else {
            setSuccessMessage('Użytkownik został zatwierdzony');
            await loadUsers();
        }

        setActionLoading(null);
    };

    const handleRevoke = async (userId: string) => {
        setActionLoading(userId);
        setError(null);
        setSuccessMessage(null);

        const { error } = await authService.revokeApproval(userId);

        if (error) {
            setError(`Błąd cofania zatwierdzenia: ${error.message}`);
        } else {
            setSuccessMessage('Zatwierdzenie zostało cofnięte');
            await loadUsers();
        }

        setActionLoading(null);
    };

    const handleMakeAdmin = async (userId: string) => {
        setActionLoading(userId);
        setError(null);
        setSuccessMessage(null);

        const { error } = await authService.makeAdmin(userId);

        if (error) {
            setError(`Błąd nadawania uprawnień: ${error.message}`);
        } else {
            setSuccessMessage('Użytkownik został administratorem');
            await loadUsers();
        }

        setActionLoading(null);
    };

    if (!isOpen) return null;

    // Sprawdź czy aktualny użytkownik jest adminem
    if (!currentUserProfile?.is_admin) {
        return (
            <div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md">
                    <div className="text-center">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-2">
                            Brak dostępu
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Nie masz uprawnień administratora.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-bold"
                        >
                            Zamknij
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scaleIn border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-purple-600 to-indigo-600">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Shield size={28} />
                                Panel Administratora
                            </h2>
                            <p className="text-purple-100 text-sm mt-1">Zarządzanie użytkownikami</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                        <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                        <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader size={32} className="animate-spin text-purple-600" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12">
                            <UserX size={48} className="text-zinc-400 mx-auto mb-4" />
                            <p className="text-zinc-500">Brak użytkowników</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">
                                                    {user.full_name || 'Brak nazwy'}
                                                </h3>
                                                {user.is_admin && (
                                                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded flex items-center gap-1">
                                                        <Crown size={12} />
                                                        Admin
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded">
                                                    {user.role === 'manager' ? 'Menadżer' :
                                                        user.role === 'specialist' ? 'Specjalista' :
                                                            user.role === 'logistics' ? 'Logistyka' : 'Inżynier'}
                                                </span>
                                                {user.approved ? (
                                                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded flex items-center gap-1">
                                                        <UserCheck size={12} />
                                                        Zatwierdzony
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold rounded flex items-center gap-1">
                                                        <AlertCircle size={12} />
                                                        Oczekuje
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>

                                            {user.pending_role && (
                                                <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-2 rounded border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                                                    <span>
                                                        Wnioskuje o zmianę na: <strong>
                                                            {user.pending_role === 'manager' ? 'Menadżer' :
                                                                user.pending_role === 'specialist' ? 'Specjalista' :
                                                                    user.pending_role === 'logistics' ? 'Logistyka' : 'Inżynier'}
                                                        </strong>
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={async () => {
                                                                setActionLoading(user.id);
                                                                await authService.approveRoleChange(user.id);
                                                                setSuccessMessage('Zmiana roli zatwierdzona');
                                                                await loadUsers();
                                                                setActionLoading(null);
                                                            }}
                                                            disabled={actionLoading === user.id}
                                                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                                        >
                                                            <CheckCircle size={12} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                setActionLoading(user.id);
                                                                await authService.rejectRoleChange(user.id);
                                                                setSuccessMessage('Zmiana roli odrzucona');
                                                                await loadUsers();
                                                                setActionLoading(null);
                                                            }}
                                                            disabled={actionLoading === user.id}
                                                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-xs text-zinc-400 mt-1">
                                                Utworzono: {new Date(user.created_at).toLocaleDateString('pl-PL')}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 items-start">
                                            {!user.approved && (
                                                <button
                                                    onClick={() => handleApprove(user.id)}
                                                    disabled={actionLoading === user.id}
                                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                >
                                                    {actionLoading === user.id ? (
                                                        <Loader size={14} className="animate-spin" />
                                                    ) : (
                                                        <UserCheck size={14} />
                                                    )}
                                                    Zatwierdź
                                                </button>
                                            )}

                                            {user.approved && !user.is_admin && (
                                                <>
                                                    <button
                                                        onClick={() => handleRevoke(user.id)}
                                                        disabled={actionLoading === user.id}
                                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                    >
                                                        {actionLoading === user.id ? (
                                                            <Loader size={14} className="animate-spin" />
                                                        ) : (
                                                            <UserX size={14} />
                                                        )}
                                                        Cofnij
                                                    </button>
                                                    <button
                                                        onClick={() => handleMakeAdmin(user.id)}
                                                        disabled={actionLoading === user.id}
                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                    >
                                                        {actionLoading === user.id ? (
                                                            <Loader size={14} className="animate-spin" />
                                                        ) : (
                                                            <Crown size={14} />
                                                        )}
                                                        Admin
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center">
                    <p className="text-xs text-zinc-500">
                        Łącznie użytkowników: <span className="font-bold">{users.length}</span>
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-bold text-sm hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                    >
                        Zamknij
                    </button>
                </div>
            </div >
        </div >
    );
};
