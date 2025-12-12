
import React, { useState, useMemo } from 'react';
import { TransportItem, Supplier, Currency, VariantItemType } from '../types';
import { Truck, CheckSquare, Square, Plus, Trash2, ChevronUp, ChevronDown, Combine, Info, Unplug, AlertTriangle, Calendar, X, Scale, Layers, Link } from 'lucide-react';
import { convert, formatCurrency, formatNumber } from '../services/calculationService';
import { SmartInput } from './SmartInput';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';

interface Props {
  transport: TransportItem[];
  suppliers: Supplier[];
  onChange: (items: TransportItem[]) => void;
  exchangeRate: number;
  offerCurrency: Currency;
  isPickingMode?: boolean;
  onPick?: (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => void;
  truckLoadCapacity?: number; // In KG
}

export const TransportSection: React.FC<Props> = ({ 
    transport, suppliers, onChange, exchangeRate, offerCurrency,
    isPickingMode, onPick,
    truckLoadCapacity = 22000
}) => {
  const [isOpen, setIsOpen] = useState(true);
  
  // Merge Modal State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [mergeWarning, setMergeWarning] = useState<string | null>(null); // For generic confirmation if needed

  const handlePick = (e: React.MouseEvent, t: TransportItem) => {
      if (isPickingMode && onPick) {
          const name = t.name || (t.supplierId ? suppliers.find(s => s.id === t.supplierId)?.name : 'Transport');
          onPick({
              id: t.id,
              type: 'TRANSPORT',
              label: `[Transport] ${name}`
          }, { x: e.clientX, y: e.clientY });
      }
  };

  const getTransportItemForSupplier = (supplierId: string): TransportItem => {
      const existing = transport.find(t => t.supplierId === supplierId);
      if (existing) return existing;
      
      const supplier = suppliers.find(s => s.id === supplierId);
      let defaultTrucks = 0;
      let isSupplierOrganized = false;

      if (supplier) {
          if (supplier.isOrm) {
              const totalWeight = supplier.items.reduce((sum, i) => sum + (i.weight * i.quantity), 0);
              defaultTrucks = Math.ceil(totalWeight / truckLoadCapacity);
          }
          const transportKeywords = ['transport', 'dostawa', 'delivery', 'shipping', 'przesyłka', 'fracht'];
          const hasTransportItem = supplier.items.some(i => 
              transportKeywords.some(keyword => i.itemDescription.toLowerCase().includes(keyword))
          );
          if (hasTransportItem) isSupplierOrganized = true;
      }

      return {
          id: `temp_${supplierId}`,
          supplierId: supplierId,
          isOrmCalc: supplier?.isOrm || false,
          isSupplierOrganized: isSupplierOrganized,
          isManualOverride: false,
          trucksCount: defaultTrucks,
          manualStoredTrucks: defaultTrucks,
          pricePerTruck: 0,
          totalPrice: 0,
          currency: Currency.EUR // DEFAULT EUR
      };
  };

  const updateSupplierTransport = (supplierId: string, updates: Partial<TransportItem>) => {
      const currentTransport = [...transport];
      const index = currentTransport.findIndex(t => t.supplierId === supplierId);
      let finalItem: TransportItem;

      if (index >= 0) {
          finalItem = { ...currentTransport[index], ...updates };
      } else {
          const defaultItem = getTransportItemForSupplier(supplierId);
          finalItem = { ...defaultItem, id: Math.random().toString(36).substr(2, 9), ...updates };
      }
      
      if (finalItem.isSupplierOrganized) {
           finalItem.totalPrice = 0;
      } else {
           finalItem.totalPrice = finalItem.trucksCount * finalItem.pricePerTruck;
      }
      
      if (index >= 0) currentTransport[index] = finalItem;
      else currentTransport.push(finalItem);
      onChange(currentTransport);
  };

  const handleToggleAutoManual = (e: React.MouseEvent, supplier: Supplier) => {
      e.preventDefault(); e.stopPropagation();
      const tItem = getTransportItemForSupplier(supplier.id);
      const isCurrentlyManual = tItem.isManualOverride;
      const totalWeight = supplier.items.reduce((sum, i) => sum + (i.weight * i.quantity), 0);
      const autoTrucks = Math.ceil(totalWeight / truckLoadCapacity);

      if (isCurrentlyManual) {
          updateSupplierTransport(supplier.id, { isManualOverride: false, trucksCount: autoTrucks });
      } else {
          updateSupplierTransport(supplier.id, { isManualOverride: true, trucksCount: tItem.manualStoredTrucks || autoTrucks });
      }
  };

  const handleManualInputChange = (supplierId: string, value: number) => {
      updateSupplierTransport(supplierId, { trucksCount: value, manualStoredTrucks: value });
  };

  const updateById = (id: string, updates: Partial<TransportItem>) => {
      const currentTransport = [...transport];
      const index = currentTransport.findIndex(t => t.id === id);
      if (index === -1) return;
      const item = { ...currentTransport[index], ...updates };
      item.totalPrice = item.trucksCount * item.pricePerTruck;
      currentTransport[index] = item;
      onChange(currentTransport);
  };

  const addManualTransport = () => {
      onChange([...transport, {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Transport Dodatkowy',
          isOrmCalc: false,
          isSupplierOrganized: false,
          trucksCount: 1,
          pricePerTruck: 0,
          totalPrice: 0,
          currency: Currency.EUR // DEFAULT EUR
      }]);
  };

  // --- MERGE LOGIC ---

  const openMergeCreator = (preSelectedName?: string) => {
      if (preSelectedName) {
          const matchingIds = suppliers
            .filter(s => s.name === preSelectedName && s.isIncluded !== false)
            .map(s => s.id);
          setSelectedForMerge(new Set(matchingIds));
      } else {
          setSelectedForMerge(new Set());
      }
      setIsMergeModalOpen(true);
  };

  const toggleMergeSelection = (supplierId: string) => {
      const newSet = new Set(selectedForMerge);
      if (newSet.has(supplierId)) newSet.delete(supplierId);
      else newSet.add(supplierId);
      setSelectedForMerge(newSet);
  };

  const finalizeMerge = () => {
      if (selectedForMerge.size < 2) return;

      const ids = Array.from(selectedForMerge);
      const suppliersToMerge = suppliers.filter(s => ids.includes(s.id));
      
      // Calculate consolidated metrics
      const totalWeight = suppliersToMerge.reduce((sum, s) => {
          return sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0);
      }, 0);
      const trucks = Math.ceil(totalWeight / truckLoadCapacity);
      
      // Calculate Max Price from existing individual items to inherit
      let inheritedPrice = 0;
      let inheritedCurrency = Currency.EUR;
      
      ids.forEach(id => {
          // Check existing individual transports for price
          const t = transport.find(t => t.supplierId === id);
          if (t && t.pricePerTruck > inheritedPrice) {
              inheritedPrice = t.pricePerTruck;
              inheritedCurrency = t.currency;
          }
      });

      // Generate Name
      const mainName = suppliersToMerge[0].name; // Use first supplier name as base
      const isMixed = suppliersToMerge.some(s => s.name !== mainName);
      const transportName = isMixed 
        ? `Transport zbiorczy (${suppliersToMerge.length} dostawców)` 
        : `Transport zbiorczy: ${mainName}`;

      // Clean up old transports (remove single items for these suppliers)
      // NOTE: We allow the same supplier to be in MULTIPLE merged groups.
      // We ONLY remove the "individual" manual override for that supplier to avoid clutter,
      // but we do NOT modify or remove other existing groups that might contain these suppliers.
      
      const newTransport = transport.filter(t => {
          // Remove if it's a specific individual transport entry for one of the selected suppliers
          if (t.supplierId && ids.includes(t.supplierId)) return false;
          
          // Keep everything else (including other groups that share these suppliers)
          return true;
      });

      // Add new Group
      newTransport.push({
          id: Math.random().toString(36).substr(2, 9),
          name: transportName,
          linkedSupplierIds: ids,
          isOrmCalc: suppliersToMerge.some(s => s.isOrm),
          isSupplierOrganized: false,
          trucksCount: trucks,
          pricePerTruck: inheritedPrice, // Use inherited max price
          totalPrice: trucks * inheritedPrice,
          currency: inheritedCurrency
      });

      onChange(newTransport);
      setIsMergeModalOpen(false);
      setSelectedForMerge(new Set());
  };

  const getUniqueSupplierNamesWithMultipleTabs = () => {
      const counts: Record<string, number> = {};
      suppliers.forEach(s => {
          if (s.isIncluded !== false) counts[s.name] = (counts[s.name] || 0) + 1;
      });
      return Object.keys(counts).filter(name => counts[name] > 1);
  };

  const potentialMerges = getUniqueSupplierNamesWithMultipleTabs().filter(name => {
      const suppliersWithName = suppliers.filter(s => s.name === name);
      // Suggest if there are multiple tabs, regardless of whether they are already in a group or not
      // This allows creating alternative groupings.
      return suppliersWithName.length > 1; 
  });

  const handleUnmerge = (transportId: string) => onChange(transport.filter(t => t.id !== transportId));
  const removeTransport = (id: string) => onChange(transport.filter(t => t.id !== id));
  
  const activeSuppliers = suppliers.filter(s => s.isIncluded !== false);
  const mergedItems = transport.filter(t => t.linkedSupplierIds && t.linkedSupplierIds.length > 0);
  const mergedSupplierIds = mergedItems.flatMap(t => t.linkedSupplierIds || []);
  
  // A supplier is "unmerged" only if it is NOT present in ANY group.
  const unmergedSuppliers = activeSuppliers.filter(s => !mergedSupplierIds.includes(s.id));
  
  const manualItems = transport.filter(t => !t.supplierId && (!t.linkedSupplierIds || t.linkedSupplierIds.length === 0));

  const transportTotal = transport.reduce((sum, item) => {
      if (item.supplierId) {
          const s = suppliers.find(x => x.id === item.supplierId);
          if (s && s.isIncluded === false) return sum;
      }
      if (item.linkedSupplierIds) {
          const hasActiveSupplier = item.linkedSupplierIds.some(id => suppliers.find(s => s.id === id)?.isIncluded !== false);
          if (!hasActiveSupplier) return sum;
      }
      return sum + convert(item.totalPrice, item.currency, offerCurrency, exchangeRate);
  }, 0);

  const headerClass = "p-2 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider text-left first:rounded-none last:rounded-none";
  const cellClass = "p-2 border-b border-zinc-50 dark:border-zinc-800/50 text-xs align-middle";
  const inputClass = "w-full p-1.5 bg-zinc-100 dark:bg-zinc-700 border-0 rounded-none text-right font-bold text-zinc-800 dark:text-white focus:ring-1 focus:ring-inset focus:ring-amber-500 outline-none transition-all text-xs";
  const textInputClass = "w-full p-1.5 bg-transparent border-0 font-medium text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:bg-white focus:shadow-inner rounded-none transition-colors text-xs";
  const selectClass = "w-full p-1.5 bg-zinc-100 dark:bg-zinc-700 border-0 rounded-none text-xs font-bold focus:ring-1 focus:ring-amber-500 outline-none cursor-pointer";
  
  const pickingClass = isPickingMode 
      ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:ring-1 hover:ring-inset hover:ring-amber-400 cursor-crosshair hover:animate-pulse-border"
      : "hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10";

  const isEmpty = unmergedSuppliers.length === 0 && mergedItems.length === 0 && manualItems.length === 0;

  // --- MERGE CREATOR RENDER HELPERS ---
  const renderMergeList = () => {
      // Group suppliers by Name
      const grouped: Record<string, Supplier[]> = {};
      activeSuppliers.forEach(s => {
          if (!grouped[s.name]) grouped[s.name] = [];
          grouped[s.name].push(s);
      });

      return (
          <div className="space-y-4">
              {Object.entries(grouped).map(([name, group]) => (
                  <div key={name} className="border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                      <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 flex justify-between items-center">
                          <span>{name}</span>
                          <span className="text-[10px] text-zinc-400">{group.length} zakładki</span>
                      </div>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                          {group.map(s => {
                              const isChecked = selectedForMerge.has(s.id);
                              const totalWeight = s.items.reduce((sum, i) => sum + (i.weight * i.quantity), 0);
                              
                              // Check if already merged elsewhere (can be multiple groups)
                              const existingGroups = transport.filter(t => t.linkedSupplierIds?.includes(s.id));
                              const groupNames = existingGroups.map(t => t.name || 'Bez nazwy').join(', ');
                              
                              return (
                                  <div 
                                    key={s.id} 
                                    className={`flex items-center p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                    onClick={() => toggleMergeSelection(s.id)}
                                  >
                                      <div className={`w-4 h-4 border mr-3 flex items-center justify-center rounded-sm transition-colors ${isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                          {isChecked && <CheckSquare size={12} />}
                                      </div>
                                      <div className="flex-1">
                                          <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                              {s.customTabName || s.name}
                                          </div>
                                          <div className="text-[10px] text-zinc-400 flex flex-wrap gap-2 items-center">
                                              <span>Waga: {formatNumber(totalWeight, 0)} kg</span>
                                              {existingGroups.length > 0 && (
                                                  <span className="text-blue-500 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-1.5 rounded border border-blue-100 dark:border-blue-800/50" title={groupNames}>
                                                      <Link size={10}/> W grupach: {existingGroups.length}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                      {s.isOrm && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">ORM</span>}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  const selectedTotalWeight = activeSuppliers
      .filter(s => selectedForMerge.has(s.id))
      .reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0), 0);
  
  const estimatedTrucks = Math.ceil(selectedTotalWeight / truckLoadCapacity);

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-colors">
      <div 
          className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                <Truck size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Transport</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Logistyka dostaw i wysyłek</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg">
                    {formatCurrency(transportTotal, offerCurrency)}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 pt-0">
                
                {/* Suggestions Bar */}
                {potentialMerges.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 mb-4 rounded-none flex flex-wrap gap-4 items-center justify-center border-b border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            <Info size={12}/> Sugerowane łączenie:
                        </div>
                        {potentialMerges.map(name => (
                            <button 
                                key={name}
                                onClick={() => openMergeCreator(name)}
                                className="bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-none text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1 transition-colors shadow-sm"
                            >
                                <Combine size={10}/> Połącz "{name}"...
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2 mb-2 pt-2">
                    <button onClick={() => openMergeCreator()} className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-none flex items-center gap-1 transition-colors">
                        <Combine size={12}/> Kreator Łączenia
                    </button>
                    <button type="button" onClick={addManualTransport} className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-none flex items-center gap-1 transition-colors">
                        <Plus size={12}/> Dodaj ręczny transport
                    </button>
                </div>

                <div className="overflow-x-auto border border-zinc-100 dark:border-zinc-800 min-h-[150px] flex flex-col">
                    {isEmpty ? (
                        <div className="flex-1 flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-900/30 py-8">
                            <EmptyState 
                                icon={Truck}
                                title="Brak Transportu"
                                description="Lista transportów jest pusta. Dodaj dostawcę, aby zobaczyć koszty transportu."
                                action={{
                                    label: "Dodaj ręczny transport",
                                    onClick: addManualTransport,
                                    icon: Plus
                                }}
                            />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className={`${headerClass} pl-4`}>Dostawca / Opis</th>
                                    <th className={headerClass}>Typ</th>
                                    <th className={`${headerClass} w-24 text-center`}>Ilość Aut</th>
                                    <th className={`${headerClass} text-right w-32`}>Cena / Auto</th>
                                    <th className={`${headerClass} text-center w-24`}>Waluta</th>
                                    <th className={`${headerClass} text-right w-32 pr-4`}>Razem</th>
                                    <th className={`${headerClass} w-16`}></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-950">
                                {/* 1. MERGED TRANSPORTS */}
                                {mergedItems.map(item => {
                                    const linkedNames = suppliers.filter(s => item.linkedSupplierIds?.includes(s.id)).map(s => s.customTabName || s.name).join(', ');
                                    
                                    return (
                                        <tr 
                                            key={item.id} 
                                            className={`${pickingClass} transition-colors border-l-4 border-l-blue-500`}
                                            onClick={(e) => handlePick(e, item)}
                                        >
                                            <td className={`${cellClass} pl-4`}>
                                                <div className="font-bold text-blue-700 dark:text-blue-300">{item.name}</div>
                                                <div className="text-[10px] text-zinc-400 truncate max-w-[200px]" title={linkedNames}>
                                                    {linkedNames}
                                                </div>
                                            </td>
                                            <td className={cellClass}>
                                                <span className="bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center w-fit gap-1">
                                                    <Combine size={10}/> Zbiorczy
                                                </span>
                                            </td>
                                            <td className={cellClass}>
                                                <input 
                                                    type="number" 
                                                    className={`${inputClass} text-center`}
                                                    value={item.trucksCount} 
                                                    onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} 
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className={cellClass}>
                                                <SmartInput 
                                                    className={inputClass} 
                                                    value={item.pricePerTruck} 
                                                    onChange={(val) => updateById(item.id, { pricePerTruck: val })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className={cellClass}>
                                                <select 
                                                    className={selectClass} 
                                                    value={item.currency} 
                                                    onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })} 
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value={Currency.PLN}>PLN</option>
                                                    <option value={Currency.EUR}>EUR</option>
                                                </select>
                                            </td>
                                            <td className={`${cellClass} text-right pr-4 font-mono font-bold text-zinc-700 dark:text-zinc-200`}>
                                                {formatNumber(item.totalPrice)}
                                            </td>
                                            <td className={`${cellClass} text-center`}>
                                                <button onClick={(e) => { e.stopPropagation(); handleUnmerge(item.id); }} className="text-zinc-400 hover:text-red-500 p-1" title="Rozdziel transport">
                                                    <Unplug size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* 2. UNMERGED SUPPLIERS */}
                                {unmergedSuppliers.map(s => {
                                    const tItem = getTransportItemForSupplier(s.id);
                                    const isManual = tItem.isManualOverride;
                                    
                                    return (
                                        <tr 
                                            key={s.id} 
                                            className={`${pickingClass} transition-colors ${s.isOrm ? 'bg-zinc-50/30' : ''}`}
                                            onClick={(e) => handlePick(e, tItem)}
                                        >
                                            <td className={`${cellClass} pl-4`}>
                                                <div className="font-bold text-zinc-800 dark:text-zinc-200">{s.customTabName || s.name}</div>
                                                {s.isOrm && <span className="text-[9px] text-green-600 dark:text-green-400 font-bold">ORM</span>}
                                            </td>
                                            <td className={cellClass}>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); updateSupplierTransport(s.id, { isSupplierOrganized: !tItem.isSupplierOrganized }); }}
                                                    className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold transition-all ${tItem.isSupplierOrganized ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-300'}`}
                                                >
                                                    {tItem.isSupplierOrganized ? 'Dostawca' : 'JH'}
                                                </button>
                                            </td>
                                            
                                            {/* Logic: If Supplier Organized -> Inputs Disabled/Hidden */}
                                            {tItem.isSupplierOrganized ? (
                                                <>
                                                    <td colSpan={3} className={`${cellClass} text-center text-zinc-400 italic text-[10px]`}>
                                                        Wliczone w cenę materiału
                                                    </td>
                                                    <td className={`${cellClass} text-right pr-4 font-mono font-bold text-zinc-400`}>-</td>
                                                    <td className={cellClass}></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className={cellClass}>
                                                        <div className="relative group">
                                                            <input 
                                                                type="number" 
                                                                className={`${inputClass} text-center ${isManual ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
                                                                value={tItem.trucksCount} 
                                                                onChange={(e) => handleManualInputChange(s.id, parseFloat(e.target.value) || 0)} 
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <button 
                                                                className={`absolute -right-2 -top-2 p-0.5 bg-white dark:bg-zinc-800 border rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${isManual ? 'text-blue-500' : 'text-zinc-300'}`}
                                                                onClick={(e) => handleToggleAutoManual(e, s)}
                                                                title={isManual ? "Przywróć Auto" : "Ustaw Ręcznie"}
                                                            >
                                                                {isManual ? <Square size={8} fill="currentColor"/> : <CheckSquare size={8}/>}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className={cellClass}>
                                                        <SmartInput 
                                                            className={inputClass} 
                                                            value={tItem.pricePerTruck} 
                                                            onChange={(val) => updateSupplierTransport(s.id, { pricePerTruck: val })} 
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </td>
                                                    <td className={cellClass}>
                                                        <select 
                                                            className={selectClass} 
                                                            value={tItem.currency} 
                                                            onChange={(e) => updateSupplierTransport(s.id, { currency: e.target.value as Currency })} 
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value={Currency.PLN}>PLN</option>
                                                            <option value={Currency.EUR}>EUR</option>
                                                        </select>
                                                    </td>
                                                    <td className={`${cellClass} text-right pr-4 font-mono font-bold text-zinc-700 dark:text-zinc-200`}>
                                                        {formatNumber(tItem.totalPrice)}
                                                    </td>
                                                    <td className={cellClass}></td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}

                                {/* 3. MANUAL TRANSPORTS */}
                                {manualItems.map(item => (
                                    <tr 
                                        key={item.id} 
                                        className={`${pickingClass} transition-colors border-l-4 border-l-zinc-300 dark:border-l-zinc-600`}
                                        onClick={(e) => handlePick(e, item)}
                                    >
                                        <td className={`${cellClass} pl-4`}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={item.name} 
                                                onChange={(e) => updateById(item.id, { name: e.target.value })} 
                                                placeholder="Opis transportu..."
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className={cellClass}>
                                            <span className="bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                                Manual
                                            </span>
                                        </td>
                                        <td className={cellClass}>
                                            <input 
                                                type="number" 
                                                className={`${inputClass} text-center`}
                                                value={item.trucksCount} 
                                                onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} 
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className={cellClass}>
                                            <SmartInput 
                                                className={inputClass} 
                                                value={item.pricePerTruck} 
                                                onChange={(val) => updateById(item.id, { pricePerTruck: val })} 
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className={cellClass}>
                                            <select 
                                                className={selectClass} 
                                                value={item.currency} 
                                                onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })} 
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right pr-4 font-mono font-bold text-zinc-700 dark:text-zinc-200`}>
                                            {formatNumber(item.totalPrice)}
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                            <button onClick={(e) => { e.stopPropagation(); removeTransport(item.id); }} className="text-zinc-400 hover:text-red-500 p-1">
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* MERGE WIZARD MODAL */}
      {isMergeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
              <div 
                  className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[80vh]"
                  onClick={(e) => e.stopPropagation()}
              >
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded text-blue-600 dark:text-blue-400"><Combine size={20}/></div>
                          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Kreator Łączenia Transportów</h3>
                      </div>
                      <button onClick={() => setIsMergeModalOpen(false)} className="hover:text-red-500"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      <p className="text-xs text-zinc-500 mb-4">Wybierz dostawców (zakładki) do wspólnego transportu. Dostawca może należeć do wielu grup.</p>
                      {renderMergeList()}
                  </div>

                  <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
                      <div className="text-xs">
                          <div className="text-zinc-500">Wybrano: <span className="font-bold text-zinc-900 dark:text-white">{selectedForMerge.size}</span></div>
                          <div className="text-zinc-500">Szacowana waga: <span className="font-bold text-zinc-900 dark:text-white">{formatNumber(selectedTotalWeight, 0)} kg</span></div>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-700">
                              <span className="text-[10px] font-bold uppercase text-zinc-400">Estymacja Aut:</span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-lg">{estimatedTrucks}</span>
                          </div>
                          <button 
                              onClick={finalizeMerge}
                              disabled={selectedForMerge.size < 2}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 transition-colors"
                          >
                              <Combine size={14}/> Utwórz Grupę
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Confirmation Dialog (Legacy/Unused currently but kept for safety) */}
      <ConfirmDialog 
          isOpen={!!mergeWarning}
          title="Uwaga"
          message={mergeWarning || ''}
          onConfirm={() => { /* Logic handled in modal now */ setMergeWarning(null); }}
          onCancel={() => setMergeWarning(null)}
          isDanger={true}
      />
    </div>
  );
};
