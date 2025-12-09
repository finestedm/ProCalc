
import React, { useState, useMemo } from 'react';
import { Supplier, SupplierItem } from '../types';
import { SplitSquareHorizontal, ArrowLeft, AlertCircle, Check, X, Link, Unlink, MousePointer2 } from 'lucide-react';
import { formatNumber } from '../services/calculationService';

interface Props {
  suppliers: Supplier[];
  onClose: () => void;
}

interface ComparisonRow {
    id: string; // unique ID for the row key
    type: 'MATCH' | 'DIFF';
    left?: SupplierItem;
    right?: SupplierItem;
    isManual?: boolean;
}

export const ComparisonView: React.FC<Props> = ({ suppliers, onClose }) => {
  const [leftId, setLeftId] = useState<string>(suppliers[0]?.id || '');
  const [rightId, setRightId] = useState<string>(suppliers[1]?.id || '');
  
  // Manual Linking State
  // Map<LeftItemId, RightItemId>
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);

  const leftSupplier = suppliers.find(s => s.id === leftId);
  const rightSupplier = suppliers.find(s => s.id === rightId);

  // Helper to normalize names for matching
  const normalize = (str: string) => str.trim().toLowerCase();

  // --- ACTIONS ---

  const handleLink = () => {
      if (selectedLeftId && selectedRightId) {
          setManualLinks(prev => ({
              ...prev,
              [selectedLeftId]: selectedRightId
          }));
          setSelectedLeftId(null);
          setSelectedRightId(null);
      }
  };

  const handleUnlink = (leftItemId: string) => {
      setManualLinks(prev => {
          const next = { ...prev };
          delete next[leftItemId];
          return next;
      });
  };

  const handleSelectLeft = (id: string) => {
      if (selectedLeftId === id) setSelectedLeftId(null);
      else {
          setSelectedLeftId(id);
          // If right matches, auto-link could happen here if we wanted
          if (selectedRightId) {
              setManualLinks(prev => ({ ...prev, [id]: selectedRightId }));
              setSelectedLeftId(null);
              setSelectedRightId(null);
          }
      }
  };

  const handleSelectRight = (id: string) => {
      if (selectedRightId === id) setSelectedRightId(null);
      else {
          setSelectedRightId(id);
          // If left matches, auto-link
          if (selectedLeftId) {
              setManualLinks(prev => ({ ...prev, [selectedLeftId]: id }));
              setSelectedLeftId(null);
              setSelectedRightId(null);
          }
      }
  };

  // --- DATA PROCESSING ---

  const comparisonRows = useMemo(() => {
      const rows: ComparisonRow[] = [];
      const leftItems = leftSupplier ? [...leftSupplier.items] : [];
      const rightItems = rightSupplier ? [...rightSupplier.items] : [];

      const usedLeftIds = new Set<string>();
      const usedRightIds = new Set<string>();

      // 1. Process Manual Links
      Object.entries(manualLinks).forEach(([lId, rId]) => {
          const rIdStr = rId as string;
          const left = leftItems.find(i => i.id === lId);
          const right = rightItems.find(i => i.id === rIdStr);
          
          if (left && right) {
              rows.push({
                  id: `manual-${lId}-${rIdStr}`,
                  type: 'MATCH',
                  left,
                  right,
                  isManual: true
              });
              usedLeftIds.add(lId);
              usedRightIds.add(rIdStr);
          }
      });

      // 2. Process Auto Matching (Name based) for remaining items
      leftItems.forEach(leftItem => {
          if (usedLeftIds.has(leftItem.id)) return;

          const key = normalize(leftItem.itemDescription);
          // Find a matching right item that hasn't been used yet
          const rightItem = rightItems.find(r => 
              !usedRightIds.has(r.id) && normalize(r.itemDescription) === key
          );

          if (rightItem) {
              rows.push({
                  id: `auto-${leftItem.id}-${rightItem.id}`,
                  type: 'MATCH',
                  left: leftItem,
                  right: rightItem,
                  isManual: false
              });
              usedLeftIds.add(leftItem.id);
              usedRightIds.add(rightItem.id);
          } else {
              // No match found yet, will process in step 3
          }
      });

      // 3. Process Leftovers (Diffs)
      leftItems.forEach(leftItem => {
          if (!usedLeftIds.has(leftItem.id)) {
              rows.push({
                  id: `left-${leftItem.id}`,
                  type: 'DIFF',
                  left: leftItem,
                  right: undefined
              });
          }
      });

      rightItems.forEach(rightItem => {
          if (!usedRightIds.has(rightItem.id)) {
              rows.push({
                  id: `right-${rightItem.id}`,
                  type: 'DIFF',
                  left: undefined,
                  right: rightItem
              });
          }
      });

      // 4. Sort: Manual matches -> Auto matches -> Diffs
      return rows.sort((a, b) => {
          if (a.isManual && !b.isManual) return -1;
          if (!a.isManual && b.isManual) return 1;
          if (a.type === 'MATCH' && b.type !== 'MATCH') return -1;
          if (a.type !== 'MATCH' && b.type === 'MATCH') return 1;
          return 0; 
      });

  }, [leftSupplier, rightSupplier, manualLinks]);

  // --- CALCULATIONS ---

  const calculateTotal = (supplier: Supplier | undefined) => {
      if (!supplier) return 0;
      return supplier.items.reduce((sum, item) => {
          const price = supplier.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
          return sum + (item.quantity * price);
      }, 0);
  };

  const leftTotal = calculateTotal(leftSupplier);
  const rightTotal = calculateTotal(rightSupplier);

  // --- STYLES ---
  const headerClass = "p-3 bg-zinc-100 dark:bg-zinc-900 font-bold text-xs uppercase text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10";
  const cellClass = "p-2 text-sm border-b border-zinc-100 dark:border-zinc-800 h-10 align-middle";
  const emptyCellClass = "p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50";

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
        onClick={onClose}
    >
        <div 
            className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
            onClick={(e) => e.stopPropagation()}
        >
            
            {/* HEADER CONTROLS */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg text-amber-600 dark:text-amber-500">
                        <SplitSquareHorizontal size={24}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
                            Porównanie Dostawców
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Automatyczne dopasowanie i ręczne łączenie pozycji
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-6 items-center">
                    {/* Legend */}
                    <div className="hidden md:flex gap-4 text-xs border-r border-zinc-200 dark:border-zinc-700 pr-6">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> <span>Ręczne połączenie</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> <span>Niższa cena</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-orange-400"></div> <span>Różne ilości</span>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* SUPPLIER SELECTORS & SUMMARY */}
            <div className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                {/* LEFT SELECTOR */}
                <div className="p-4 border-r border-zinc-200 dark:border-zinc-800">
                    <select 
                        className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-sm font-bold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-amber-500 outline-none transition-colors mb-2"
                        value={leftId}
                        onChange={(e) => setLeftId(e.target.value)}
                    >
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
                        ))}
                    </select>
                    {leftSupplier && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Oferta: {leftSupplier.offerNumber}</span>
                            <span className="font-mono font-bold text-lg text-zinc-900 dark:text-white">
                                {formatNumber(leftTotal)} {leftSupplier.currency}
                            </span>
                        </div>
                    )}
                </div>

                {/* RIGHT SELECTOR */}
                <div className="p-4">
                    <select 
                        className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-sm font-bold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-amber-500 outline-none transition-colors mb-2"
                        value={rightId}
                        onChange={(e) => setRightId(e.target.value)}
                    >
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
                        ))}
                    </select>
                    {rightSupplier && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500">Oferta: {rightSupplier.offerNumber}</span>
                            <span className="font-mono font-bold text-lg text-zinc-900 dark:text-white">
                                {formatNumber(rightTotal)} {rightSupplier.currency}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* UNIFIED SCROLLABLE TABLE */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 relative">
                <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                        {/* Left Columns */}
                        <col className="w-12" /> {/* Qty */}
                        <col className="w-auto" /> {/* Name */}
                        <col className="w-24" /> {/* Price */}
                        <col className="w-24" /> {/* Total */}
                        
                        {/* Divider/Status */}
                        <col className="w-12" /> 

                        {/* Right Columns */}
                        <col className="w-12" /> {/* Qty */}
                        <col className="w-auto" /> {/* Name */}
                        <col className="w-24" /> {/* Price */}
                        <col className="w-24" /> {/* Total */}
                    </colgroup>
                    
                    <thead>
                        <tr>
                            <th className={`${headerClass} text-center`}>Il.</th>
                            <th className={`${headerClass}`}>Nazwa (Lewa)</th>
                            <th className={`${headerClass} text-right`}>Cena</th>
                            <th className={`${headerClass} text-right border-r border-zinc-200 dark:border-zinc-700`}>Wartość</th>
                            
                            <th className={`${headerClass} text-center px-0 bg-zinc-200 dark:bg-zinc-800`}>Vs</th>

                            <th className={`${headerClass} text-center`}>Il.</th>
                            <th className={`${headerClass}`}>Nazwa (Prawa)</th>
                            <th className={`${headerClass} text-right`}>Cena</th>
                            <th className={`${headerClass} text-right`}>Wartość</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        {comparisonRows.map((row) => {
                            // Calculate Left Values
                            const lPrice = row.left && leftSupplier ? (leftSupplier.isOrm ? row.left.unitPrice * 0.5 : row.left.unitPrice) : 0;
                            const lTotal = row.left ? row.left.quantity * lPrice : 0;

                            // Calculate Right Values
                            const rPrice = row.right && rightSupplier ? (rightSupplier.isOrm ? row.right.unitPrice * 0.5 : row.right.unitPrice) : 0;
                            const rTotal = row.right ? row.right.quantity * rPrice : 0;

                            // Comparison highlight logic
                            const isMatch = row.type === 'MATCH';
                            const priceDiffers = isMatch && Math.abs(lPrice - rPrice) > 0.01;
                            const qtyDiffers = isMatch && row.left?.quantity !== row.right?.quantity;
                            
                            // Determine lighter/cheaper side
                            const isLeftCheaper = isMatch && priceDiffers && lPrice < rPrice;
                            const isRightCheaper = isMatch && priceDiffers && rPrice < lPrice;

                            // Selection States
                            const isLeftSelected = row.left && selectedLeftId === row.left.id;
                            const isRightSelected = row.right && selectedRightId === row.right.id;

                            // Row Background
                            let rowBg = 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50';
                            if (row.isManual) rowBg = 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900';
                            if (!isMatch) rowBg = 'bg-orange-50/10 dark:bg-orange-900/10';

                            return (
                                <tr key={row.id} className={`transition-colors group ${rowBg}`}>
                                    
                                    {/* LEFT SIDE */}
                                    {row.left ? (
                                        <>
                                            <td 
                                                className={`${cellClass} text-center text-zinc-500 font-bold cursor-pointer ${isLeftSelected ? 'bg-amber-100 text-amber-700' : ''} ${qtyDiffers ? 'text-orange-600' : ''}`}
                                                onClick={() => !isMatch && handleSelectLeft(row.left!.id)}
                                            >
                                                {row.left.quantity}
                                            </td>
                                            <td 
                                                className={`${cellClass} truncate cursor-pointer ${isLeftSelected ? 'bg-amber-100 dark:bg-amber-900/30 font-bold' : ''}`} 
                                                title={row.left.itemDescription}
                                                onClick={() => !isMatch && handleSelectLeft(row.left!.id)}
                                            >
                                                <div className={`text-zinc-800 dark:text-zinc-200 ${isLeftSelected ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                                                    {row.left.itemDescription}
                                                </div>
                                                {/* Hint for selection */}
                                                {!isMatch && !isLeftSelected && (
                                                    <div className="text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        <MousePointer2 size={8}/> Kliknij, aby połączyć
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`${cellClass} text-right font-mono ${isLeftCheaper ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold border-y border-green-200 dark:border-green-800' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                {formatNumber(lPrice)}
                                            </td>
                                            <td className={`${cellClass} text-right font-mono font-bold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800`}>
                                                {formatNumber(lTotal)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className={emptyCellClass}></td>
                                            <td className={`${emptyCellClass} text-xs italic text-zinc-400 text-center`}>
                                                {selectedRightId === row.right?.id ? (
                                                    <span className="text-amber-500 font-bold animate-pulse">Wybierz pozycję po prawej...</span>
                                                ) : "Brak pozycji"}
                                            </td>
                                            <td className={emptyCellClass}></td>
                                            <td className={`${emptyCellClass} border-r border-zinc-200 dark:border-zinc-800`}></td>
                                        </>
                                    )}

                                    {/* DIVIDER STATUS */}
                                    <td className={`${cellClass} text-center bg-zinc-50 dark:bg-zinc-900 border-x border-zinc-100 dark:border-zinc-800 relative`}>
                                        {row.type === 'MATCH' ? (
                                            <div className={`flex justify-center group/link relative ${(priceDiffers || qtyDiffers) ? 'text-orange-400' : 'text-zinc-300'}`}>
                                                {/* Icon Logic */}
                                                {row.isManual ? (
                                                    <Link size={14} className="text-blue-500"/>
                                                ) : (
                                                    (priceDiffers || qtyDiffers) ? <AlertCircle size={14}/> : <Check size={14}/>
                                                )}

                                                {/* Unlink Action on Hover */}
                                                <button 
                                                    onClick={() => row.left && handleUnlink(row.left.id)}
                                                    className="absolute inset-0 bg-red-100 dark:bg-red-900 text-red-600 flex items-center justify-center opacity-0 group-hover/link:opacity-100 transition-opacity"
                                                    title="Rozłącz pary"
                                                >
                                                    <Unlink size={14}/>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-center text-zinc-300">
                                                <X size={14}/>
                                            </div>
                                        )}
                                    </td>

                                    {/* RIGHT SIDE */}
                                    {row.right ? (
                                        <>
                                            <td 
                                                className={`${cellClass} text-center text-zinc-500 font-bold cursor-pointer ${isRightSelected ? 'bg-amber-100 text-amber-700' : ''} ${qtyDiffers ? 'text-orange-600' : ''}`}
                                                onClick={() => !isMatch && handleSelectRight(row.right!.id)}
                                            >
                                                {row.right.quantity}
                                            </td>
                                            <td 
                                                className={`${cellClass} truncate cursor-pointer ${isRightSelected ? 'bg-amber-100 dark:bg-amber-900/30 font-bold' : ''}`} 
                                                title={row.right.itemDescription}
                                                onClick={() => !isMatch && handleSelectRight(row.right!.id)}
                                            >
                                                <div className={`text-zinc-800 dark:text-zinc-200 ${isRightSelected ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                                                    {row.right.itemDescription}
                                                </div>
                                                {!isMatch && !isRightSelected && (
                                                    <div className="text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        <MousePointer2 size={8}/> Kliknij, aby połączyć
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`${cellClass} text-right font-mono ${isRightCheaper ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold border-y border-green-200 dark:border-green-800' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                                {formatNumber(rPrice)}
                                            </td>
                                            <td className={`${cellClass} text-right font-mono font-bold text-zinc-800 dark:text-zinc-200`}>
                                                {formatNumber(rTotal)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className={emptyCellClass}></td>
                                            <td className={`${emptyCellClass} text-xs italic text-zinc-400 text-center`}>
                                                {selectedLeftId === row.left?.id ? (
                                                    <span className="text-amber-500 font-bold animate-pulse">Wybierz pozycję po prawej...</span>
                                                ) : "Brak pozycji"}
                                            </td>
                                            <td className={emptyCellClass}></td>
                                            <td className={emptyCellClass}></td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                        
                        {comparisonRows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-zinc-400 italic">
                                    Brak danych do porównania. Wybierz dostawców posiadających pozycje.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
