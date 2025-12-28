import React, { useState } from 'react';
import { X, AlertCircle, MessageSquare, Send, Plus, Trash2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (points: string[]) => void;
    projectNumber: string;
}

export const CorrectionRequestModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    projectNumber
}) => {
    const [points, setPoints] = useState<string[]>(['']);

    if (!isOpen) return null;

    const handleAddPoint = () => setPoints([...points, '']);
    const handleRemovePoint = (index: number) => setPoints(points.filter((_, i) => i !== index));
    const handleUpdatePoint = (index: number, value: string) => {
        const newPoints = [...points];
        newPoints[index] = value;
        setPoints(newPoints);
    };

    const handleSend = () => {
        const filteredPoints = points.map(p => p.trim()).filter(Boolean);
        if (filteredPoints.length === 0) {
            alert("Proszę wpisać treść przynajmniej jednej poprawki.");
            return;
        }
        onConfirm(filteredPoints);
        setPoints(['']);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-slideUp">

                {/* Header */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <AlertCircle size={20} className="text-red-500" />
                            Prośba o Poprawkę
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Projekt: <strong className="text-zinc-700 dark:text-zinc-200">{projectNumber}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Podaj listę poprawek do wykonania. Specjaliści będą musieli odznaczyć każdy punkt przed wysłaniem projektu z powrotem.
                    </p>

                    <div className="space-y-3">
                        {points.map((point, index) => (
                            <div key={index} className="flex gap-2">
                                <div className="flex-1 relative">
                                    <textarea
                                        className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none text-zinc-900 dark:text-white resize-none h-20"
                                        placeholder={`Punkt ${index + 1}...`}
                                        value={point}
                                        onChange={(e) => handleUpdatePoint(index, e.target.value)}
                                        autoFocus={index === points.length - 1 && points.length > 1}
                                    />
                                    {points.length > 1 && (
                                        <button
                                            onClick={() => handleRemovePoint(index)}
                                            className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddPoint}
                            className="w-full py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                        >
                            <Plus size={14} /> Dodaj kolejny punkt
                        </button>
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

                    <button
                        onClick={handleSend}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-600/20 transition-colors flex items-center gap-2"
                    >
                        <Send size={16} /> Wyślij listę poprawek
                    </button>
                </div>
            </div>
        </div>
    );
};
