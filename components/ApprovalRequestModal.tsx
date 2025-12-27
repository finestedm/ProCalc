import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { ApprovalResult } from '../services/lifecycleService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (message: string, forceManual: boolean) => void;
    autoValidation: ApprovalResult;
}

export const ApprovalRequestModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    autoValidation
}) => {
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const isValid = autoValidation.approved;

    const handleSend = (forceManual: boolean) => {
        onConfirm(message, forceManual);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-slideUp">

                {/* Header */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <Send size={20} className="text-amber-500" />
                            Prośba o Akceptację
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Zweryfikuj status projektu i wyślij prośbę.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Validation Result */}
                    <div className={`p-4 rounded-lg border flex gap-3 ${isValid
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>

                        {isValid ? <CheckCircle size={24} className="shrink-0" /> : <AlertCircle size={24} className="shrink-0" />}

                        <div>
                            <h3 className="font-bold text-sm mb-1">
                                {isValid ? "Projekt spełnia kryteria Auto-Akceptacji" : "Projekt wymaga ręcznej akceptacji"}
                            </h3>
                            {!isValid && (
                                <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 opacity-80">
                                    {autoValidation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                            )}
                            {isValid && (
                                <p className="text-xs opacity-80">
                                    Możesz zatwierdzić go automatycznie lub wymusić ręczne sprawdzenie przez Managera.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Message Input */}
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2 flex items-center gap-2">
                            <MessageSquare size={14} />
                            Wiadomość do Managera (Opcjonalnie)
                        </label>
                        <textarea
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-zinc-900 dark:text-white resize-none h-24"
                            placeholder={isValid ? "Np. Proszę o sprawdzenie dostawcy X..." : "Wyjaśnij powód niskiej marży lub braku zaliczki..."}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
                    >
                        Anuluj
                    </button>

                    {isValid ? (
                        <>
                            <button
                                onClick={() => handleSend(true)}
                                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Wymuś Ręczną Akceptację
                            </button>
                            <button
                                onClick={() => handleSend(false)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/20 transition-colors flex items-center gap-2"
                            >
                                <CheckCircle size={16} /> Auto-Akceptuj
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => handleSend(false)} // forceManual is irrelevant here, it's always manual since invalid
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold shadow-lg shadow-amber-500/20 transition-colors flex items-center gap-2"
                        >
                            <Send size={16} /> Wyślij do Akceptacji
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
