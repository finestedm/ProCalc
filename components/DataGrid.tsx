import React, { useState, useMemo, useEffect } from 'react';
import { SupplierItem, Currency } from '../types';
import { ArrowUp, ArrowDown, Trash2, ArrowLeft, ArrowRight, ArrowUpDown, ChevronUp, ChevronDown, Search, Settings2, Plus, Eye, EyeOff } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface ColumnConfig {
    id: keyof SupplierItem | 'totalValue' | 'jhPrice' | 'actions';
    label: string;
    width: number;
    minWidth: number;
}

interface DataGridProps {
    items: SupplierItem[];
    currency: Currency;
    isOrm?: boolean;
    onUpdateItem: (id: string, field: keyof SupplierItem, value: any) => void;
    onDeleteItem: (id: string) => void;
    onAddItem?: () => void;
    onMoveItem?: (index: number, direction: 'up' | 'down') => void; // Manual sort override
    readOnly?: boolean;
    className?: string; // Allow external layout control
    // Picking Mode
    isPickingMode?: boolean;
    onPick?: (id: string, coords?: {x: number, y: number}) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({ 
    items, 
    currency, 
    isOrm, 
    onUpdateItem, 
    onDeleteItem,
    onAddItem,
    onMoveItem,
    readOnly,
    className = '',
    isPickingMode,
    onPick
}) => {
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    
    // Default columns configuration - REORDERED based on request
    const defaultColumns: ColumnConfig[] = [
        { id: 'quantity', label: 'Ilość', width: 80, minWidth: 60 },
        { id: 'itemDescription', label: 'Opis', width: 350, minWidth: 200 },
        { id: 'componentNumber', label: 'Nr Komponentu', width: 150, minWidth: 100 },
        { id: 'weight', label: 'Waga (kg)', width: 80, minWidth: 60 },
        { id: 'unitPrice', label: 'Cena jedn.', width: 120, minWidth: 80 },
        { id: 'jhPrice', label: 'Cena JH', width: 100, minWidth: 80 }, // Logic handles visibility
        { id: 'totalValue', label: 'Wartość', width: 120, minWidth: 80 },
        { id: 'actions', label: 'Opcje', width: 80, minWidth: 80 },
    ];
    const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);

    // Reset columns if ORM status changes (to ensure consistency, though logic handles visibility)
    useEffect(() => {
        setColumns(defaultColumns);
    }, [isOrm]);

    const handleResize = (colId: string, startWidth: number, startX: number) => {
        const onMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX;
            setColumns(cols => cols.map(c => {
                if (c.id === colId) {
                    return { ...c, width: Math.max(c.minWidth, startWidth + diff) };
                }
                return c;
            }));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleSort = (key: string) => {
        if (key === 'actions') return;
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const moveColumn = (index: number, direction: 'left' | 'right') => {
        const newCols = [...columns];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCols.length) return;
        
        const temp = newCols[index];
        newCols[index] = newCols[targetIndex];
        newCols[targetIndex] = temp;
        setColumns(newCols);
    };

    const processedItems = useMemo(() => {
        let result = [...items];

        // Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            result = result.filter(i => 
                (i.itemDescription?.toLowerCase() || '').includes(lower) || 
                (i.componentNumber?.toLowerCase() || '').includes(lower)
            );
        }

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                let valA: any = a[sortConfig.key as keyof SupplierItem];
                let valB: any = b[sortConfig.key as keyof SupplierItem];

                // Computed fields sorting logic
                if (sortConfig.key === 'totalValue') {
                     const pA = isOrm ? (a.unitPrice * 0.5) : a.unitPrice;
                     const pB = isOrm ? (b.unitPrice * 0.5) : b.unitPrice;
                     valA = a.quantity * pA;
                     valB = b.quantity * pB;
                } else if (sortConfig.key === 'jhPrice') {
                     valA = isOrm ? (a.unitPrice * 0.5) : a.unitPrice;
                     valB = isOrm ? (b.unitPrice * 0.5) : b.unitPrice;
                }

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }
                
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [items, filterText, sortConfig, isOrm]);

    // Use picking-pulse animation (inset box shadow) which doesn't affect layout
    const pickingClass = isPickingMode 
        ? "cursor-crosshair hover:animate-pulse-border" 
        : "hover:bg-blue-50/50 dark:hover:bg-blue-900/10";

    return (
        <div className={`flex flex-col w-full ${className}`}>
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-2 px-1 gap-2 shrink-0">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 text-zinc-400" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Filtruj pozycje..."
                        className="w-full pl-8 p-2 border border-zinc-200 dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400 transition-colors"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <DropdownMenu 
                    align="right"
                    trigger={<Settings2 size={18} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"/>}
                    items={[
                        { label: 'Resetuj kolumny', onClick: () => {
                            setColumns(defaultColumns);
                            setSortConfig(null);
                        }}
                    ]}
                />
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 shadow-sm relative min-h-[200px]">
                <table className="text-sm text-left border-collapse table-fixed" style={{ minWidth: '100%' }}>
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 sticky top-0 z-10 font-semibold uppercase text-xs tracking-wider shadow-sm">
                        <tr>
                            <th className="p-2 w-10 text-center border-b dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">#</th>
                            
                            {!sortConfig && onMoveItem && (
                                <th className="p-2 w-16 text-center border-b dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">Sort</th>
                            )}

                            {columns.map((col, idx) => {
                                // Skip JH Price column if not ORM
                                if (col.id === 'jhPrice' && !isOrm) return null;

                                return (
                                    <th 
                                        key={col.id}
                                        className={`p-2 border-b dark:border-zinc-700 relative group select-none ${col.id === 'jhPrice' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-l border-green-100 dark:border-green-800' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                                        style={{ width: col.width }}
                                    >
                                        <div className="flex items-center justify-between h-full">
                                            <div 
                                                className={`flex items-center gap-1 cursor-pointer flex-1 truncate hover:text-zinc-900 dark:hover:text-zinc-200 ${col.id === 'actions' ? 'justify-center' : ''}`}
                                                onClick={() => handleSort(col.id)}
                                            >
                                                {col.label}
                                                {sortConfig?.key === col.id && (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
                                                )}
                                            </div>
                                            
                                            {col.id !== 'actions' && (
                                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity mr-2 gap-1">
                                                    <button 
                                                        disabled={idx === 0}
                                                        onClick={(e) => { e.stopPropagation(); moveColumn(idx, 'left'); }}
                                                        className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-0"
                                                    ><ArrowLeft size={10}/></button>
                                                    <button 
                                                        disabled={idx === columns.length - 1}
                                                        onClick={(e) => { e.stopPropagation(); moveColumn(idx, 'right'); }}
                                                        className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-0"
                                                    ><ArrowRight size={10}/></button>
                                                </div>
                                            )}
                                        </div>

                                        {col.id !== 'actions' && (
                                            <div 
                                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yellow-400 active:bg-yellow-600 z-20"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleResize(col.id, col.width, e.clientX);
                                                }}
                                            />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {processedItems.map((item, index) => {
                            // Helper to find original index for onMoveItem
                            const originalIndex = items.findIndex(i => i.id === item.id);
                            const unitPrice = item.unitPrice;
                            const jhPrice = isOrm ? unitPrice * 0.5 : unitPrice;
                            const totalValue = item.quantity * jhPrice;
                            const isExcluded = item.isExcluded;

                            return (
                                <tr 
                                    key={item.id} 
                                    className={`${pickingClass} transition-colors group ${isExcluded ? 'opacity-50' : ''}`}
                                    onClick={(e) => {
                                        if (isPickingMode && onPick) {
                                            e.stopPropagation(); // Stop propagation to prevent group selection
                                            onPick(item.id, { x: e.clientX, y: e.clientY });
                                        }
                                    }}
                                >
                                    <td className="p-2 text-center text-zinc-400 text-xs">{index + 1}</td>
                                    
                                    {!sortConfig && onMoveItem && (
                                        <td className="p-2">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => onMoveItem(originalIndex, 'up')}
                                                    disabled={originalIndex === 0}
                                                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-20"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => onMoveItem(originalIndex, 'down')}
                                                    disabled={originalIndex === items.length - 1}
                                                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-20"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}

                                    {columns.map(col => {
                                         if (col.id === 'jhPrice' && !isOrm) return null;
                                         if (col.id === 'actions') {
                                             return (
                                                 <td key={col.id} className="p-2 text-center border-l border-transparent">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onUpdateItem(item.id, 'isExcluded', !item.isExcluded); }}
                                                            className={`p-1.5 rounded transition-colors ${isExcluded ? 'text-zinc-400 hover:text-zinc-600' : 'text-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100'}`}
                                                            title={isExcluded ? "Przywróć do kalkulacji" : "Wyłącz z kalkulacji"}
                                                        >
                                                            {isExcluded ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                        </button>
                                                        {!readOnly && (
                                                            <button onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} className="p-1.5 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                 </td>
                                             );
                                         }

                                         return (
                                            <td key={col.id} className={`p-0 border-l border-transparent focus-within:border-yellow-400 transition-colors truncate relative ${isExcluded ? 'decoration-slice line-through text-zinc-400' : ''}`}>
                                                {col.id === 'itemDescription' && (
                                                    <input 
                                                        type="text" 
                                                        className={`w-full px-3 py-2.5 bg-transparent outline-none ${isExcluded ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-200 placeholder-zinc-300'}`}
                                                        value={item.itemDescription} 
                                                        onChange={(e) => onUpdateItem(item.id, 'itemDescription', e.target.value)}
                                                        readOnly={readOnly || isExcluded}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {col.id === 'componentNumber' && (
                                                    <input 
                                                        type="text" 
                                                        className={`w-full px-3 py-2.5 bg-transparent outline-none font-mono text-xs ${isExcluded ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'}`}
                                                        value={item.componentNumber} 
                                                        onChange={(e) => onUpdateItem(item.id, 'componentNumber', e.target.value)}
                                                        readOnly={readOnly || isExcluded}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {col.id === 'quantity' && (
                                                    <input 
                                                        type="number" 
                                                        className={`w-full px-3 py-2.5 text-center bg-transparent outline-none font-bold ${isExcluded ? 'text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}
                                                        value={item.quantity} 
                                                        onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                        readOnly={readOnly || isExcluded}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {col.id === 'weight' && (
                                                    <input 
                                                        type="number" 
                                                        className="w-full px-3 py-2.5 text-center bg-transparent outline-none text-zinc-500" 
                                                        value={item.weight} 
                                                        onChange={(e) => onUpdateItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                                                        readOnly={readOnly || isExcluded}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {col.id === 'unitPrice' && (
                                                    <div className={`h-full ${isOrm && !isExcluded ? 'bg-orange-50/30 dark:bg-orange-900/5' : ''}`}>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            className={`w-full px-3 py-2.5 text-right bg-transparent outline-none font-mono ${isOrm && !isExcluded ? 'text-orange-800 dark:text-orange-400 font-medium' : ''}`}
                                                            value={item.unitPrice} 
                                                            onChange={(e) => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                            readOnly={readOnly || isExcluded}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                )}
                                                {col.id === 'jhPrice' && isOrm && (
                                                     <div className={`px-3 py-2.5 text-right font-mono font-bold ${isExcluded ? 'text-zinc-400 bg-transparent' : 'text-green-700 dark:text-green-500 bg-green-50/30 dark:bg-green-900/5'} h-full flex items-center justify-end cursor-not-allowed`}>
                                                        {jhPrice.toFixed(2)}
                                                    </div>
                                                )}
                                                {col.id === 'totalValue' && (
                                                    <div className={`px-3 py-2.5 text-right font-medium ${isExcluded ? 'text-zinc-400 bg-transparent' : 'text-zinc-800 dark:text-zinc-200 bg-zinc-50/50 dark:bg-zinc-800/30'} h-full flex items-center justify-end`}>
                                                        {totalValue.toFixed(2)}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {processedItems.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 3} className="p-8 text-center text-zinc-400 italic">
                                    {filterText ? 'Brak pozycji spełniających kryteria.' : 'Brak pozycji w ofercie.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {!readOnly && onAddItem && (
                <div className="mt-2 shrink-0">
                    <button onClick={onAddItem} className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-black bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 px-3 py-2 rounded flex items-center gap-1 transition-colors border dark:border-zinc-600 w-full justify-center">
                        <Plus size={16} /> Dodaj pozycję
                    </button>
                </div>
            )}
        </div>
    );
};