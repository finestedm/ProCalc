
import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    neutralLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onNeutral?: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Potwierdź",
    cancelLabel = "Anuluj",
    neutralLabel,
    isDanger = false,
    onConfirm,
    onCancel,
    onNeutral
}) => {

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onCancel();
            // Enter only confirms if it's not a complex dialog to avoid accidents
            if (e.key === 'Enter' && !neutralLabel) onConfirm();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel, onConfirm, neutralLabel]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={onCancel}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full flex-shrink-0 ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                                {title}
                            </h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 flex flex-wrap justify-end gap-3 border-t border-zinc-100 dark:border-zinc-700">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {cancelLabel}
                    </button>

                    {onNeutral && neutralLabel && (
                        <button
                            onClick={() => {
                                onNeutral();
                                // Usually handled by parent closing, but safety first
                            }}
                            className="px-4 py-2 rounded-md text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                        >
                            {neutralLabel}
                        </button>
                    )}

                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-md text-sm font-semibold text-white shadow-sm transition-colors ${isDanger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
