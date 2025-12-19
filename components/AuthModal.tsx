import React, { useState } from 'react';
import { LogIn, UserPlus, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'login' | 'register';

export const AuthModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { signIn, signUp } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'engineer' | 'specialist' | 'manager'>('engineer');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        role: 'engineer' as 'engineer' | 'specialist' | 'manager'
    });

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setFullName('');
        setRole('engineer');
        setError(null);
        setSuccessMessage(null);
    };

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        resetForm();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await signIn(email, password);

        if (error) {
            setError(error.message || 'Błąd logowania');
            setLoading(false);
        } else {
            // Logowanie zakończone sukcesem, modal zostanie zamknięty przez App.tsx
            resetForm();
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        if (!fullName.trim()) {
            setError('Proszę podać imię i nazwisko');
            setLoading(false);
            return;
        }

        const { error } = await signUp(email, password, fullName, role);

        if (error) {
            setError(error.message || 'Błąd rejestracji');
            setLoading(false);
        } else {
            setSuccessMessage('Rejestracja zakończona! Poczekaj na zatwierdzenie przez administratora.');
            resetForm();
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={(e) => {
                // Nie pozwalaj zamknąć modala klikając poza nim (wymuszamy logowanie)
                e.stopPropagation();
            }}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-amber-500 to-orange-500">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <LogIn size={24} />
                        ProCalc - Logowanie
                    </h2>
                    <p className="text-amber-50 text-sm mt-1">Zaloguj się, aby kontynuować</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                    <button
                        onClick={() => handleTabChange('login')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'login'
                            ? 'bg-white dark:bg-zinc-900 text-amber-600 border-b-2 border-amber-600'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <LogIn size={16} className="inline mr-2" />
                        Logowanie
                    </button>
                    <button
                        onClick={() => handleTabChange('register')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'register'
                            ? 'bg-white dark:bg-zinc-900 text-amber-600 border-b-2 border-amber-600'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        <UserPlus size={16} className="inline mr-2" />
                        Rejestracja
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                            <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                        </div>
                    )}

                    {/* Login Form */}
                    {activeTab === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="twoj@email.com"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                    Hasło
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader size={18} className="animate-spin" />
                                        Logowanie...
                                    </>
                                ) : (
                                    <>
                                        <LogIn size={18} />
                                        Zaloguj się
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Register Form */}
                    {activeTab === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                    Imię i nazwisko
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="Jan Kowalski"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="twoj@email.com"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                    Hasło
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                <p className="text-xs text-zinc-400 mt-1">Minimum 6 znaków</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Rola <span className="text-red-500">*</span>
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
                                <p className="text-xs text-zinc-400 mt-1">Wybierz swoją rolę w firmie</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader size={18} className="animate-spin" />
                                        Rejestracja...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={18} />
                                        Zarejestruj się
                                    </>
                                )}
                            </button>

                            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    <AlertCircle size={14} className="inline mr-1" />
                                    Po rejestracji poczekaj na zatwierdzenie przez administratora.
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
