import React, { useState, useEffect } from 'react';
import { Currency } from '../types';
import { Zap, X, ArrowRight, User, Briefcase, Layers, FileText, Globe } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { INSTALLATION_TYPES } from '../services/optionsDatabase';

interface QuickStartData {
    projectNumber: string;
    clientName: string;
    salesPerson: string;
    assistantPerson: string;
    installationType: string;
    currency: Currency;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApply: (data: QuickStartData) => void;
    defaultSalesPerson?: string;
    defaultSupportPerson?: string;
    currentUserRole?: string;
    currentUserName?: string | null;
}

export const QuickStartModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onApply,
    defaultSalesPerson = '',
    defaultSupportPerson = '',
    currentUserRole,
    currentUserName
}) => {
    const [data, setData] = useState<QuickStartData>({
        projectNumber: '',
        clientName: '',
        salesPerson: defaultSalesPerson,
        assistantPerson: defaultSupportPerson,
        installationType: '',
        currency: Currency.EUR
    });

    const [salesPeople, setSalesPeople] = useState<string[]>([]);
    const [supportPeople, setSupportPeople] = useState<string[]>([]);

    // Fetch users on mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data: users, error } = await supabase
                    .from('users')
                    .select('full_name, role');

                if (error) throw error;

                if (users) {
                    const sales = users
                        .filter(u => ['manager', 'admin', 'engineer'].includes(u.role))
                        .map(u => u.full_name)
                        .filter(Boolean)
                        .sort();

                    const support = users
                        .filter(u => ['manager', 'admin', 'specialist'].includes(u.role))
                        .map(u => u.full_name)
                        .filter(Boolean)
                        .sort();

                    setSalesPeople(prev => [...new Set([...prev, ...sales])]);
                    setSupportPeople(prev => [...new Set([...prev, ...support])]);
                }
            } catch (err) {
                console.error('Error fetching users for QuickStart:', err);
                // Fallback handled by empty lists or manual typing
            }
        };

        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    // Reset defaults when opening
    useEffect(() => {
        if (isOpen) {
            let initialSales = defaultSalesPerson;
            let initialSupport = defaultSupportPerson;

            // Auto-fill from current user profile if defaults are empty
            if (currentUserName) {
                if (currentUserRole === 'engineer' && !initialSales) {
                    initialSales = currentUserName;
                } else if (currentUserRole === 'specialist' && !initialSupport) {
                    initialSupport = currentUserName;
                }
            }

            setData(prev => ({
                ...prev,
                salesPerson: prev.salesPerson || initialSales,
                assistantPerson: prev.assistantPerson || initialSupport
            }));
        }
    }, [isOpen, defaultSalesPerson, defaultSupportPerson, currentUserRole, currentUserName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApply(data);
    };

    const inputClass = "w-full p-2.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all dark:text-white";
    const labelClass = "block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700">

                {/* Header */}
                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-xl text-amber-600 dark:text-amber-500">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Szybki Start</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                Uzupełnij podstawowe dane, aby natychmiast skonfigurować projekt.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Row 1: Identification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}><FileText size={12} /> Nr Projektu (CRM)</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="np. 12345678"
                                value={data.projectNumber}
                                onChange={e => setData({ ...data, projectNumber: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className={labelClass}><Briefcase size={12} /> Klient (Skrót)</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nazwa firmy..."
                                value={data.clientName}
                                onChange={e => setData({ ...data, clientName: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Row 2: Type & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}><Layers size={12} /> Typ Projektu</label>
                            <select
                                className={inputClass}
                                value={data.installationType}
                                onChange={e => setData({ ...data, installationType: e.target.value })}
                            >
                                <option value="">Wybierz...</option>
                                {INSTALLATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}><Globe size={12} /> Waluta Oferty</label>
                            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md border border-zinc-300 dark:border-zinc-600">
                                <button
                                    type="button"
                                    onClick={() => setData({ ...data, currency: Currency.EUR })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${data.currency === Currency.EUR ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                                >
                                    EUR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setData({ ...data, currency: Currency.PLN })}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${data.currency === Currency.PLN ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                                >
                                    PLN
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: People */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}><User size={12} /> Inżynier</label>
                            <input
                                list="qs-sales-list"
                                className={inputClass}
                                placeholder="Wybierz..."
                                value={data.salesPerson}
                                onChange={e => setData({ ...data, salesPerson: e.target.value })}
                            />
                            <datalist id="qs-sales-list">
                                {salesPeople.length > 0 ? salesPeople.map(p => <option key={p} value={p} />) : <option value="Ładowanie..." />}
                            </datalist>
                        </div>
                        <div>
                            <label className={labelClass}><User size={12} /> Specjalista</label>
                            <input
                                list="qs-support-list"
                                className={inputClass}
                                placeholder="Wybierz..."
                                value={data.assistantPerson}
                                onChange={e => setData({ ...data, assistantPerson: e.target.value })}
                            />
                            <datalist id="qs-support-list">
                                {supportPeople.length > 0 ? supportPeople.map(p => <option key={p} value={p} />) : <option value="Ładowanie..." />}
                            </datalist>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm font-medium transition-colors"
                        >
                            Pomiń ten krok
                        </button>
                        <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-2.5 px-6 rounded-lg shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                        >
                            Rozpocznij <ArrowRight size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};