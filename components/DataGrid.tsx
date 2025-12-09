
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupplierItem, Currency } from '../types';
import { ArrowUp, ArrowDown, Trash2, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Search, Settings2, Plus, Eye, EyeOff, GripVertical, PackageOpen, CheckSquare, Square, X } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import { formatNumber } from '../services/calculationService';
import { SmartInput } from './SmartInput';
import { EmptyState } from './EmptyState';

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
    onReorderItems?: (fromIndex: number, toIndex: number) => void; // Drag and Drop reorder
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
    onReorderItems,
    readOnly,
    className = '',
    isPickingMode,
    onPick
}) => {
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Drag & Drop State
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

    // Default columns configuration
    const defaultColumns: ColumnConfig[] = [
        { id: 'quantity', label: 'Qty', width: 70, minWidth: 60 },
        { id: 'itemDescription', label: 'Description', width: 350, minWidth: 200 },
        { id: 'componentNumber', label: 'Part No.', width: 140, minWidth: 100 },
        { id: 'weight', label: 'Weight', width: 70, minWidth: 60 },
        { id: 'unitPrice', label: 'Unit Price', width: 100, minWidth: 80 },
        { id: 'jhPrice', label: 'JH Price', width: 90, minWidth: 80 }, // Logic handles visibility
        { id: 'totalValue', label: 'Total', width: 100, minWidth: 80 },
        { id: 'actions', label: '...', width: 50, minWidth: 50 },
    ];
    const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);

    // Reset columns if ORM status changes
    useEffect(() => {
        setColumns(defaultColumns);
    }, [isOrm]);

    // --- BULK ACTIONS LOGIC ---
    const toggleSelectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (confirm(`Czy na pewno usunąć ${selectedIds.size} elementów?`)) {
            selectedIds.forEach(id => onDeleteItem(id));
            setSelectedIds(new Set());
        }
    };

    const handleBulkExclude = (exclude: boolean) => {
        selectedIds.forEach(id => onUpdateItem(id, 'isExcluded', exclude));
        setSelectedIds(new Set());
    };

    // --- DRAG AND DROP LOGIC ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (sortConfig || filterText) return; // Disable DnD when sorted/filtered
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
        
        // Create custom drag ghost
        const item = items.find(i => i.id === id);
        if (item) {
            const ghost = document.createElement('div');
            ghost.style.position = 'absolute';
            ghost.style.top = '-1000px';
            ghost.style.left = '-1000px';
            ghost.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#18181b' : '#ffffff';
            ghost.style.color = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
            ghost.style.border = '1px solid #fbbf24'; // Amber border
            ghost.style.borderRadius = '4px';
            ghost.style.padding = '8px 12px';
            ghost.style.zIndex = '9999';
            ghost.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            ghost.style.fontSize = '12px';
            ghost.style.fontWeight = 'bold';
            ghost.style.display = 'flex';
            ghost.style.alignItems = 'center';
            ghost.style.gap = '8px';
            
            ghost.innerHTML = `
                <span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 2px; font-family: monospace;">${item.quantity}x</span>
                <span>${item.itemDescription.substring(0, 30)}${item.itemDescription.length > 30 ? '...' : ''}</span>
            `;
            
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(ghost);
            }, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (sortConfig || filterText || draggedItemId === id) return;
        setDragOverItemId(id);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (sortConfig || filterText) return;
        
        if (draggedItemId && draggedItemId !== targetId && onReorderItems) {
            const fromIndex = items.findIndex(i => i.id === draggedItemId);
            const toIndex = items.findIndex(i => i.id === targetId);
            onReorderItems(fromIndex, toIndex);
        }
        setDraggedItemId(null);
        setDragOverItemId(null);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDragOverItemId(null);
    };

    // --- RESIZING & SORTING ---
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

    const pickingClass = isPickingMode 
        ? "cursor-crosshair hover:animate-pulse-border" 
        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50";

    const isAllSelected = items.length > 0 && selectedIds.size === items.length;

    return (
        <div className={`flex flex-col w-full ${className}`}>
            <style>{`
                @keyframes slideDown {
                    from { height: 0; opacity: 0; }
                    to { height: 40px; opacity: 1; }
                }
                .animate-slideDown {
                    animation: slideDown 0.15s ease-out forwards;
                }
            `}</style>

            {/* Toolbar */}
            <div className="flex justify-between items-center mb-2 px-1 gap-2 shrink-0 pt-2">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2 text-zinc-400" size={14}/>
                    <input 
                        type="text" 
                        placeholder="Filter items..."
                        className="w-full pl-8 p-1.5 border border-zinc-200 dark:border-zinc-700 rounded-sm text-xs bg-white dark:bg-zinc-900 outline-none focus:border-yellow-500 transition-all font-mono"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <DropdownMenu 
                    align="right"
                    trigger={<Settings2 size={14} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"/>}
                    items={[
                        { label: 'Reset Columns', onClick: () => {
                            setColumns(defaultColumns);
                            setSortConfig(null);
                        }}
                    ]}
                />
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 relative min-h-[200px] flex flex-col">
                {items.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30">
                        <EmptyState 
                            icon={PackageOpen}
                            title="Brak pozycji"
                            description="Lista elementów jest pusta."
                            action={onAddItem ? {
                                label: "Dodaj pierwszy element",
                                onClick: onAddItem,
                                icon: Plus
                            } : undefined}
                        />
                    </div>
                ) : (
                    <table className="text-xs text-left border-collapse table-fixed w-full">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 sticky top-0 z-10 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-300 dark:border-zinc-700 shadow-sm">
                            <tr>
                                {/* Drag Handle Column */}
                                {!sortConfig && !filterText && onReorderItems && (
                                    <th className="w-6 border-r border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900"></th>
                                )}

                                {/* Checkbox Column */}
                                {!readOnly && (
                                    <th className="w-8 border-r border-zinc-300 dark:border-zinc-700 text-center bg-zinc-100 dark:bg-zinc-900 align-middle">
                                        <button onClick={toggleSelectAll} className="flex items-center justify-center w-full h-full text-zinc-400 hover:text-zinc-600">
                                            {isAllSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                                        </button>
                                    </th>
                                )}

                                <th className="p-0 border-r border-zinc-300 dark:border-zinc-700 w-8 text-center bg-zinc-100 dark:bg-zinc-900">#</th>
                                
                                {columns.map((col, idx) => {
                                    if (col.id === 'jhPrice' && !isOrm) return null;

                                    return (
                                        <th 
                                            key={col.id}
                                            className={`p-2 relative group select-none border-r border-zinc-300 dark:border-zinc-700 last:border-r-0 ${col.id === 'jhPrice' ? 'bg-green-50/50 dark:bg-green-900/20 text-green-800 dark:text-green-400' : ''}`}
                                            style={{ width: col.width }}
                                        >
                                            <div className="flex items-center justify-between h-full">
                                                <div 
                                                    className={`flex items-center gap-1 cursor-pointer flex-1 truncate hover:text-zinc-900 dark:hover:text-white ${col.id === 'actions' ? 'justify-center' : ''}`}
                                                    onClick={() => handleSort(col.id)}
                                                >
                                                    {col.label}
                                                    {sortConfig?.key === col.id && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp size={10}/> : <ChevronDown size={10}/>
                                                    )}
                                                </div>
                                                
                                                {col.id !== 'actions' && (
                                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity mr-1 gap-0.5">
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
                                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-yellow-500 active:bg-yellow-600 z-20"
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
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {processedItems.map((item, index) => {
                                const unitPrice = item.unitPrice;
                                const jhPrice = isOrm ? unitPrice * 0.5 : unitPrice;
                                const totalValue = item.quantity * jhPrice;
                                const isExcluded = item.isExcluded;
                                const isSelected = selectedIds.has(item.id);
                                const isDragged = draggedItemId === item.id;
                                const isDragOver = dragOverItemId === item.id;

                                return (
                                    <React.Fragment key={item.id}>
                                        {/* Drop Indicator Spacer */}
                                        {isDragOver && !isDragged && (
                                            <tr 
                                                onDragOver={(e) => handleDragOver(e, item.id)}
                                                onDrop={(e) => handleDrop(e, item.id)}
                                            >
                                                <td colSpan={columns.length + 3} className="p-0 border-0 bg-transparent">
                                                    <div className="mx-1 my-1 border-2 border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-sm flex items-center justify-center relative overflow-hidden animate-slideDown">
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                                            Upuść tutaj
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        <tr 
                                            draggable={!sortConfig && !filterText && !readOnly}
                                            onDragStart={(e) => handleDragStart(e, item.id)}
                                            onDragOver={(e) => handleDragOver(e, item.id)}
                                            onDrop={(e) => handleDrop(e, item.id)}
                                            onDragEnd={handleDragEnd}
                                            className={`
                                                ${pickingClass} transition-colors group 
                                                ${isExcluded ? 'opacity-50 grayscale' : ''}
                                                ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20' : ''}
                                                ${isDragged ? 'opacity-30 bg-zinc-100 dark:bg-zinc-800' : ''}
                                            `}
                                            onClick={(e) => {
                                                if (isPickingMode && onPick) {
                                                    e.stopPropagation();
                                                    onPick(item.id, { x: e.clientX, y: e.clientY });
                                                }
                                            }}
                                        >
                                            {/* Drag Handle */}
                                            {!sortConfig && !filterText && onReorderItems && (
                                                <td className="w-6 border-r border-zinc-200 dark:border-zinc-800 text-center cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500">
                                                    <div className="flex justify-center"><GripVertical size={12}/></div>
                                                </td>
                                            )}

                                            {/* Checkbox */}
                                            {!readOnly && (
                                                <td className="w-8 border-r border-zinc-200 dark:border-zinc-800 text-center">
                                                    <button onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }} className={`flex items-center justify-center w-full h-full ${isSelected ? 'text-amber-500' : 'text-zinc-300 hover:text-zinc-500'}`}>
                                                        {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                                                    </button>
                                                </td>
                                            )}

                                            <td className="p-1 text-center text-zinc-400 text-[10px] font-mono border-r border-zinc-200 dark:border-zinc-800">{index + 1}</td>
                                            
                                            {columns.map(col => {
                                                if (col.id === 'jhPrice' && !isOrm) return null;
                                                
                                                // Special Action Column
                                                if (col.id === 'actions') {
                                                    return (
                                                        <td key={col.id} className="p-1 text-center border-r border-zinc-200 dark:border-zinc-800 last:border-r-0">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); onUpdateItem(item.id, 'isExcluded', !item.isExcluded); }}
                                                                    className={`p-1 rounded transition-colors ${isExcluded ? 'text-zinc-400 hover:text-zinc-600' : 'text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                                                    title={isExcluded ? "Include" : "Exclude"}
                                                                >
                                                                    {isExcluded ? <EyeOff size={10}/> : <Eye size={10}/>}
                                                                </button>
                                                                {!readOnly && (
                                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} className="p-1 rounded text-zinc-300 hover:text-red-500 transition-colors">
                                                                        <Trash2 size={10}/>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                // Data Columns
                                                const cellClass = "p-0 relative border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 h-[28px]";
                                                const commonInputClass = `w-full h-full px-2 bg-transparent outline-none border-none rounded-none focus:ring-1 focus:ring-inset focus:ring-yellow-500 text-xs font-mono transition-all ${isExcluded ? 'text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`;

                                                return (
                                                    <td key={col.id} className={cellClass}>
                                                        {col.id === 'itemDescription' && (
                                                            <input 
                                                                type="text" 
                                                                className={`${commonInputClass} font-sans`}
                                                                value={item.itemDescription} 
                                                                onChange={(e) => onUpdateItem(item.id, 'itemDescription', e.target.value)}
                                                                readOnly={readOnly || isExcluded}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        {col.id === 'componentNumber' && (
                                                            <input 
                                                                type="text" 
                                                                className={commonInputClass}
                                                                value={item.componentNumber} 
                                                                onChange={(e) => onUpdateItem(item.id, 'componentNumber', e.target.value)}
                                                                readOnly={readOnly || isExcluded}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        {col.id === 'quantity' && (
                                                            <input 
                                                                type="number" 
                                                                className={`${commonInputClass} text-center font-bold`}
                                                                value={item.quantity} 
                                                                onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                readOnly={readOnly || isExcluded}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        {col.id === 'weight' && (
                                                            <input 
                                                                type="number" 
                                                                className={`${commonInputClass} text-center text-zinc-500`}
                                                                value={item.weight} 
                                                                onChange={(e) => onUpdateItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                                                                readOnly={readOnly || isExcluded}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        {col.id === 'unitPrice' && (
                                                            <SmartInput 
                                                                className={`${commonInputClass} text-right ${isOrm && !isExcluded ? 'text-orange-600 dark:text-orange-400' : ''}`}
                                                                value={item.unitPrice} 
                                                                onChange={(val) => onUpdateItem(item.id, 'unitPrice', val)}
                                                                readOnly={readOnly || isExcluded}
                                                                onClick={(e) => e.stopPropagation()}
                                                                placeholder="0.00"
                                                            />
                                                        )}
                                                        {col.id === 'jhPrice' && isOrm && (
                                                            <div className={`px-2 h-full flex items-center justify-end font-mono text-xs font-bold ${isExcluded ? 'text-zinc-400' : 'text-green-700 dark:text-green-500 bg-green-50/20 dark:bg-green-900/10'}`}>
                                                                {formatNumber(jhPrice)}
                                                            </div>
                                                        )}
                                                        {col.id === 'totalValue' && (
                                                            <div className={`px-2 h-full flex items-center justify-end font-mono text-xs ${isExcluded ? 'text-zinc-400' : 'text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/50'}`}>
                                                                {formatNumber(totalValue)}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            
            {/* FLOATING BULK ACTIONS BAR */}
            {selectedIds.size > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-4 py-2 rounded shadow-xl flex items-center gap-4 animate-slideUp">
                    <span className="text-xs font-bold">{selectedIds.size} wybranych</span>
                    <div className="h-4 w-px bg-zinc-700"></div>
                    <button onClick={() => handleBulkExclude(true)} className="flex items-center gap-1 text-xs hover:text-amber-400 transition-colors">
                        <EyeOff size={14}/> Wyklucz
                    </button>
                    <button onClick={() => handleBulkExclude(false)} className="flex items-center gap-1 text-xs hover:text-green-400 transition-colors">
                        <Eye size={14}/> Przywróć
                    </button>
                    <button onClick={handleBulkDelete} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                        <Trash2 size={14}/> Usuń
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="ml-2 hover:text-zinc-400"><X size={14}/></button>
                </div>
            )}

            {!readOnly && onAddItem && items.length > 0 && (
                <div className="mt-2 shrink-0 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-2">
                    <button onClick={onAddItem} className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-4 py-2 rounded-sm flex items-center gap-2 transition-colors w-full justify-center border border-zinc-200 dark:border-zinc-700">
                        <Plus size={12} /> Add Item Row
                    </button>
                </div>
            )}
        </div>
    );
};
