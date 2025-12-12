import React, { useState, useEffect } from 'react';
import { CalculationScenario } from '../types';
import { X, GripVertical, Trash2, Copy, Edit2, Check, ArrowUp, ArrowDown, Plus, Eraser, Settings, ChevronDown, ChevronUp, Import } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    scenarios: CalculationScenario[];
    activeId: string;
    onReorder: (newOrder: CalculationScenario[]) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    // New Props
    onAddEmpty: () => void;
    onClearData: (id: string) => void;
    onCopyModules: (targetId: string, sourceId: string, modules: string[]) => void;
}

export const ScenarioManagerModal: React.FC<Props> = ({ 
    isOpen, onClose, scenarios, activeId, onReorder, onRename, onDelete, onDuplicate,
    onAddEmpty, onClearData, onCopyModules
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    
    // State for Copy Tool
    const [importSourceId, setImportSourceId] = useState<string>('');
    const [selectedModules, setSelectedModules] = useState<string[]>(['suppliers', 'transport', 'installation', 'otherCosts']);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!isOpen) return null;

    const handleStartEdit = (s: CalculationScenario) => {
        setEditingId(s.id);
        setEditName(s.name);
    };

    const handleSaveEdit = () => {
        if (editingId && editName.trim()) {
            onRename(editingId, editName.trim());
        }
        setEditingId(null);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newScenarios = [...scenarios];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex >= 0 && targetIndex < newScenarios.length) {
            const temp = newScenarios[index];
            newScenarios[index] = newScenarios[targetIndex];
            newScenarios[targetIndex] = temp;
            onReorder(newScenarios);
        }
    };

    const toggleExpand = (id: string) => {
        if (expandedRowId === id) {
            setExpandedRowId(null);
        } else {
            setExpandedRowId(id);
            // Default source to first OTHER scenario if available
            const others = scenarios.filter(s => s.id !== id);
            if (others.length > 0) setImportSourceId(others[0].id);
        }
    };

    const handleCopySubmit = (targetId: string) => {
        if (importSourceId && selectedModules.length > 0) {
            onCopyModules(targetId, importSourceId, selectedModules);
            setExpandedRowId(null); // Close tool
        }
    };

    const toggleModule = (mod: string) => {
        if (selectedModules.includes(mod)) {
            setSelectedModules(prev => prev.filter(m => m !== mod));
        } else {
            setSelectedModules(prev => [...prev, mod]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div 
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                            Zarządzanie Wariantami
                        </h2>
                        <button 
                            onClick={onAddEmpty}
                            className="text-[10px] bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors font-bold shadow-sm"
                        >
                            <Plus size={10}/> Nowy Pusty
                        </button>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2 bg-white dark:bg-zinc-900">
                    {scenarios.map((scenario, index) => {
                        const isActive = scenario.id === activeId;
                        const isEditing = editingId === scenario.id;
                        const isExpanded = expandedRowId === scenario.id;

                        return (
                            <div key={scenario.id} className={`rounded-lg border transition-all overflow-hidden ${isActive ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                                <div className="flex items-center gap-3 p-3">
                                    <div className="flex flex-col gap-1 text-zinc-400">
                                        <button onClick={() => moveItem(index, 'up')} disabled={index === 0} className="hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"><ArrowUp size={12}/></button>
                                        <button onClick={() => moveItem(index, 'down')} disabled={index === scenarios.length - 1} className="hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"><ArrowDown size={12}/></button>
                                    </div>

                                    <div className="flex-1">
                                        {isEditing ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    className="flex-1 p-1 text-sm border rounded outline-none focus:border-amber-400 dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                />
                                                <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={16}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${isActive ? 'text-amber-700 dark:text-amber-500' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                                    {scenario.name}
                                                    {isActive && <span className="ml-2 text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 px-1.5 py-0.5 rounded-full uppercase">Aktywny</span>}
                                                </span>
                                                <span className="text-[10px] text-zinc-400">
                                                    {scenario.suppliers.length} dostawców • {scenario.installation.stages.length} etapów
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {!isEditing && (
                                            <button onClick={() => handleStartEdit(scenario)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Zmień nazwę">
                                                <Edit2 size={14}/>
                                            </button>
                                        )}
                                        <button onClick={() => onDuplicate(scenario.id)} className="p-2 text-zinc-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors" title="Duplikuj zawartość">
                                            <Copy size={14}/>
                                        </button>
                                        
                                        {/* Toggle Expanded Tools */}
                                        <button 
                                            onClick={() => toggleExpand(scenario.id)}
                                            className={`p-2 rounded transition-colors ${isExpanded ? 'bg-zinc-200 text-zinc-800' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
                                            title="Narzędzia danych"
                                        >
                                            <Settings size={14}/>
                                        </button>

                                        {scenarios.length > 1 && (
                                            <button 
                                                onClick={() => onDelete(scenario.id)} 
                                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Usuń wariant"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* EXPANDED TOOLS AREA */}
                                {isExpanded && (
                                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-4 text-sm animate-slideDown">
                                        <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                            <Settings size={12}/> Operacje na danych wariantu
                                        </h4>
                                        
                                        <div className="space-y-4">
                                            {/* Clear Data */}
                                            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                                                <span className="text-zinc-600 dark:text-zinc-300 text-xs">Usuń wszystkie dane (resetuj do pustego)</span>
                                                <button 
                                                    onClick={() => { if(confirm("Czy na pewno wyczyścić dane?")) onClearData(scenario.id); }}
                                                    className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-100 transition-colors flex items-center gap-1"
                                                >
                                                    <Eraser size={12}/> Wyczyść
                                                </button>
                                            </div>

                                            {/* Import Data */}
                                            <div className="bg-white dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-700">
                                                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1">
                                                    <Import size={12}/> Kopiuj dane z innego wariantu
                                                </div>
                                                
                                                <div className="flex flex-col gap-2 mb-3">
                                                    <label className="text-[10px] uppercase text-zinc-400 font-bold">Źródło:</label>
                                                    <select 
                                                        className="w-full p-1.5 text-xs border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-600"
                                                        value={importSourceId}
                                                        onChange={(e) => setImportSourceId(e.target.value)}
                                                    >
                                                        {scenarios.filter(s => s.id !== scenario.id).map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="mb-3">
                                                    <label className="text-[10px] uppercase text-zinc-400 font-bold mb-1 block">Moduły do skopiowania:</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { id: 'suppliers', label: 'Dostawcy' },
                                                            { id: 'transport', label: 'Transport' },
                                                            { id: 'installation', label: 'Montaż' },
                                                            { id: 'otherCosts', label: 'Inne Koszty' }
                                                        ].map(mod => (
                                                            <label key={mod.id} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedModules.includes(mod.id)}
                                                                    onChange={() => toggleModule(mod.id)}
                                                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                                                                />
                                                                {mod.label}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => handleCopySubmit(scenario.id)}
                                                    disabled={!importSourceId}
                                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-1.5 rounded font-bold transition-colors disabled:opacity-50"
                                                >
                                                    Kopiuj Wybrane
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-bold rounded hover:opacity-90 transition-opacity"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        </div>
    );
};