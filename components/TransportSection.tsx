
import React, { useState } from 'react';
import { TransportItem, Supplier, Currency } from '../types';
import { Truck, CheckSquare, Square, Plus, Trash2, ChevronUp, ChevronDown, Combine, Info, Unplug } from 'lucide-react';
import { convert } from '../services/calculationService';

interface Props {
  transport: TransportItem[];
  suppliers: Supplier[];
  onChange: (items: TransportItem[]) => void;
  exchangeRate: number;
  offerCurrency: Currency;
}

export const TransportSection: React.FC<Props> = ({ transport, suppliers, onChange, exchangeRate, offerCurrency }) => {
  const [isOpen, setIsOpen] = useState(true);

  const getTransportItemForSupplier = (supplierId: string): TransportItem => {
      const existing = transport.find(t => t.supplierId === supplierId);
      if (existing) return existing;
      
      const supplier = suppliers.find(s => s.id === supplierId);
      let defaultTrucks = 0;
      let isSupplierOrganized = false;

      if (supplier) {
          // 1. Calculate default trucks based on weight (ORM)
          if (supplier.isOrm) {
              const totalWeight = supplier.items.reduce((sum, i) => sum + (i.weight * i.quantity), 0);
              defaultTrucks = Math.ceil(totalWeight / 22000);
          }
          
          // 2. Auto-detect if supplier already includes transport in items
          // Keywords: transport, delivery, dostawa, shipping, przesyłka, fracht
          const transportKeywords = ['transport', 'dostawa', 'delivery', 'shipping', 'przesyłka', 'fracht'];
          const hasTransportItem = supplier.items.some(i => 
              transportKeywords.some(keyword => i.itemDescription.toLowerCase().includes(keyword))
          );
          
          if (hasTransportItem) {
              isSupplierOrganized = true;
          }
      }

      return {
          id: `temp_${supplierId}`,
          supplierId: supplierId,
          isOrmCalc: supplier?.isOrm || false,
          isSupplierOrganized: isSupplierOrganized, // Default based on detection
          isManualOverride: false,
          trucksCount: defaultTrucks,
          manualStoredTrucks: defaultTrucks,
          pricePerTruck: 0,
          totalPrice: 0,
          currency: Currency.PLN
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
      const autoTrucks = Math.ceil(totalWeight / 22000);

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
          currency: Currency.PLN
      }]);
  };

  // --- Consolidation Logic ---
  const getUniqueSupplierNamesWithMultipleTabs = () => {
      const counts: Record<string, number> = {};
      suppliers.forEach(s => {
          if (s.isIncluded !== false) counts[s.name] = (counts[s.name] || 0) + 1;
      });
      return Object.keys(counts).filter(name => counts[name] > 1);
  };

  const potentialMerges = getUniqueSupplierNamesWithMultipleTabs().filter(name => {
      // Filter out names that are already fully merged
      const suppliersWithName = suppliers.filter(s => s.name === name);
      const ids = suppliersWithName.map(s => s.id);
      
      // Check if there is already a merged transport covering these IDs
      const existingMerge = transport.find(t => 
          t.linkedSupplierIds && 
          t.linkedSupplierIds.length > 0 && 
          t.linkedSupplierIds.some(id => ids.includes(id))
      );
      
      // Show as potential merge if NO existing merge covers them (or covers only some)
      // Simplification: Show if any unmerged individual tabs exist
      const unmergedCount = suppliersWithName.filter(s => {
           // Is this supplier already in a consolidated transport?
           return !transport.some(t => t.linkedSupplierIds?.includes(s.id));
      }).length;

      return unmergedCount > 1; 
  });

  const handleMergeTransport = (supplierName: string) => {
      const suppliersToMerge = suppliers.filter(s => s.name === supplierName && s.isIncluded !== false);
      const ids = suppliersToMerge.map(s => s.id);
      
      // Calculate total weight
      const totalWeight = suppliersToMerge.reduce((sum, s) => {
          return sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0);
      }, 0);
      
      const trucks = Math.ceil(totalWeight / 22000); // 22t capacity

      // Remove existing individual transport entries for these suppliers to avoid duplication
      const newTransport = transport.filter(t => !t.supplierId || !ids.includes(t.supplierId));
      
      // Add Consolidated Entry
      newTransport.push({
          id: Math.random().toString(36).substr(2, 9),
          name: `Transport zbiorczy: ${supplierName}`,
          linkedSupplierIds: ids,
          isOrmCalc: true,
          isSupplierOrganized: false,
          trucksCount: trucks,
          pricePerTruck: 0,
          totalPrice: 0,
          currency: Currency.PLN
      });

      onChange(newTransport);
  };

  const handleUnmerge = (transportId: string) => {
      // Explicitly remove the consolidated item.
      // Individual items will re-appear automatically via getTransportItemForSupplier in render loop.
      onChange(transport.filter(t => t.id !== transportId));
  };

  const removeTransport = (id: string) => onChange(transport.filter(t => t.id !== id));
  
  // Categorize items for rendering
  const activeSuppliers = suppliers.filter(s => s.isIncluded !== false);
  
  // 1. Consolidated Items
  const mergedItems = transport.filter(t => t.linkedSupplierIds && t.linkedSupplierIds.length > 0);
  const mergedSupplierIds = mergedItems.flatMap(t => t.linkedSupplierIds || []);

  // 2. Individual Items (excluding those in merged list)
  const unmergedSuppliers = activeSuppliers.filter(s => !mergedSupplierIds.includes(s.id));
  
  // 3. Manual Items
  const manualItems = transport.filter(t => !t.supplierId && (!t.linkedSupplierIds || t.linkedSupplierIds.length === 0));


  // --- Calculate Total for Header ---
  const transportTotal = transport.reduce((sum, item) => {
      // Logic for exclusions is handled in service, but for header display we need basic check
      
      if (item.supplierId) {
          const s = suppliers.find(x => x.id === item.supplierId);
          if (s && s.isIncluded === false) return sum;
      }
      if (item.linkedSupplierIds) {
          const hasActive = item.linkedSupplierIds.some(id => suppliers.find(s => s.id === id)?.isIncluded !== false);
          if (!hasActive) return sum;
      }

      return sum + convert(item.totalPrice, item.currency, offerCurrency, exchangeRate);
  }, 0);

  // Styling Constants (DataGrid Look)
  const headerClass = "p-2 border-b dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase text-xs tracking-wider sticky top-0 z-10";
  const cellClass = "p-2 border-b dark:border-zinc-800/50 text-sm align-top";
  const inputClass = "w-full p-1.5 border rounded text-right bg-white dark:bg-zinc-900 focus:border-yellow-400 outline-none font-bold text-zinc-900 dark:text-white dark:border-zinc-600 text-sm";
  const textInputClass = "w-full p-1.5 bg-transparent border-b border-transparent focus:border-yellow-400 outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400";
  const selectClass = "w-full p-1.5 bg-white dark:bg-zinc-900 border rounded text-xs outline-none focus:border-yellow-400 dark:border-zinc-600";

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors">
      <div 
          className="p-4 flex justify-between items-center cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Truck className="text-yellow-500" size={20} /> Transport
        </h2>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {transportTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offerCurrency}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="border-t border-zinc-100 dark:border-zinc-700">
                {/* Consolidation Notifications */}
                {potentialMerges.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 border-b border-blue-100 dark:border-blue-900/30 flex flex-wrap gap-4 items-center justify-center">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-xs font-bold">
                            <Info size={14}/> Wykryto możliwość łączenia transportów:
                        </div>
                        {potentialMerges.map(name => (
                            <button 
                                key={name}
                                onClick={() => handleMergeTransport(name)}
                                className="bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1 transition-colors shadow-sm"
                            >
                                <Combine size={12}/> Scal transporty dla "{name}"
                            </button>
                        ))}
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex justify-end p-2 bg-zinc-50 dark:bg-zinc-800/30 border-b dark:border-zinc-700">
                    <button type="button" onClick={addManualTransport} className="text-[10px] bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-3 py-1 rounded flex items-center gap-1 transition-colors font-semibold">
                        <Plus size={12}/> Dodaj ręczny transport
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className={`${headerClass} text-left`}>Dostawca / Nazwa</th>
                                <th className={`${headerClass} text-center`}>Waga</th>
                                <th className={`${headerClass} text-center`}>Org. Dostawcy?</th>
                                <th className={`${headerClass} text-center w-24`}>Tryb</th>
                                <th className={`${headerClass} text-center`}>Ilość Aut</th>
                                <th className={`${headerClass} text-right`}>Cena / Auto</th>
                                <th className={`${headerClass} text-center`}>Waluta</th>
                                <th className={`${headerClass} text-right`}>Suma</th>
                                <th className={`${headerClass} w-10`}></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-800">
                            
                            {/* 1. Individual Suppliers (Unmerged) */}
                            {unmergedSuppliers.map((supplier) => {
                                const tItem = getTransportItemForSupplier(supplier.id);
                                const weight = supplier.items.reduce((s, i) => s + (i.weight * i.quantity), 0);
                                const isOrgBySupplier = tItem.isSupplierOrganized;
                                const isManual = tItem.isManualOverride;

                                return (
                                    <tr key={supplier.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group transition-colors">
                                        <td className={cellClass}>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{supplier.name}</div>
                                            {supplier.isOrm && <span className="text-[10px] bg-green-600 text-white px-1.5 rounded border border-green-200">ORM</span>}
                                        </td>
                                        <td className={`${cellClass} text-center font-mono text-zinc-600 dark:text-zinc-400`}>{weight > 0 ? `${weight.toLocaleString()} kg` : '-'}</td>
                                        <td className={`${cellClass} text-center`}>
                                            <button type="button" onClick={() => updateSupplierTransport(supplier.id, { isSupplierOrganized: !isOrgBySupplier })} className={`flex items-center justify-center gap-2 mx-auto px-2 py-1 rounded border transition-all ${isOrgBySupplier ? 'bg-zinc-100 border-zinc-300 text-zinc-700' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}>
                                                {isOrgBySupplier ? <CheckSquare size={16}/> : <Square size={16}/>}
                                            </button>
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                            {!isOrgBySupplier && supplier.isOrm ? (
                                                <div className="flex items-center justify-center">
                                                    <button 
                                                        onClick={(e) => handleToggleAutoManual(e, supplier)} 
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isManual ? 'bg-zinc-200 text-zinc-600 border-zinc-300' : 'bg-yellow-400 text-zinc-900 border-yellow-500'}`}
                                                        title={isManual ? "Kliknij, aby włączyć automat" : "Kliknij, aby włączyć ręczny"}
                                                    >
                                                        {isManual ? 'MAN' : 'AUTO'}
                                                    </button>
                                                </div>
                                            ) : <span className="text-zinc-300 text-center block">-</span>}
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={`${inputClass} text-center`} value={tItem.trucksCount} onChange={(e) => handleManualInputChange(supplier.id, parseFloat(e.target.value) || 0)} disabled={isOrgBySupplier || (!isManual && supplier.isOrm)} />
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={inputClass} value={tItem.pricePerTruck} onChange={(e) => updateSupplierTransport(supplier.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} disabled={isOrgBySupplier} />
                                        </td>
                                        <td className={cellClass}>
                                            <select className={selectClass} value={tItem.currency} onChange={(e) => updateSupplierTransport(supplier.id, { currency: e.target.value as Currency })} disabled={isOrgBySupplier}>
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono`}>
                                            {isOrgBySupplier ? <span className="text-xs text-zinc-500 font-normal italic">W cenie dost.</span> : `${tItem.totalPrice.toFixed(2)}`}
                                        </td>
                                        <td className={cellClass}></td>
                                    </tr>
                                );
                            })}

                            {/* 2. Consolidated Transports */}
                            {mergedItems.map(item => {
                                const ids = item.linkedSupplierIds || [];
                                const mergedSuppliers = suppliers.filter(s => ids.includes(s.id));
                                const totalWeight = mergedSuppliers.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0), 0);
                                
                                return (
                                    <tr key={item.id} className="bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 transition-colors border-l-4 border-l-blue-400">
                                        <td className={cellClass}>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                                <Combine size={14} className="text-blue-500"/>
                                                {item.name}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                Łączy: {mergedSuppliers.map(s => s.customTabName || s.name).join(', ')}
                                            </div>
                                        </td>
                                        <td className={`${cellClass} text-center font-mono text-zinc-600 dark:text-zinc-400`}>
                                            {totalWeight.toLocaleString()} kg
                                        </td>
                                        <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                        <td className={`${cellClass} text-center`}>
                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AUTO</span>
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={`${inputClass} text-center`} value={item.trucksCount} onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} />
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={inputClass} value={item.pricePerTruck} onChange={(e) => updateById(item.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} />
                                        </td>
                                        <td className={cellClass}>
                                            <select className={selectClass} value={item.currency} onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })}>
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono`}>{item.totalPrice.toFixed(2)}</td>
                                        <td className={`${cellClass} text-center`}>
                                            <button 
                                                type="button" 
                                                onClick={() => handleUnmerge(item.id)} 
                                                className="text-zinc-400 hover:text-red-500 transition-colors"
                                                title="Rozdziel transporty"
                                            >
                                                <Unplug size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* 3. Manual Items */}
                            {manualItems.map(item => (
                                <tr key={item.id} className="bg-yellow-50/20 hover:bg-yellow-50/50 transition-colors">
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} placeholder="Nazwa transportu" value={item.name || ''} onChange={(e) => updateById(item.id, { name: e.target.value })} />
                                    </td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={cellClass}><input type="number" min="0" className={`${inputClass} text-center`} value={item.trucksCount} onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} /></td>
                                    <td className={cellClass}><input type="number" min="0" className={inputClass} value={item.pricePerTruck} onChange={(e) => updateById(item.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} /></td>
                                    <td className={cellClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono`}>{item.totalPrice.toFixed(2)}</td>
                                    <td className={`${cellClass} text-center`}><button type="button" onClick={() => removeTransport(item.id)} className="text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};