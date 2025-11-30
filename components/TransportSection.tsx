

import React, { useState } from 'react';
import { TransportItem, Supplier, Currency, VariantItemType } from '../types';
import { Truck, CheckSquare, Square, Plus, Trash2, ChevronUp, ChevronDown, Combine, Info, Unplug } from 'lucide-react';
import { convert, formatCurrency, formatNumber } from '../services/calculationService';

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
          currency: Currency.PLN
      }]);
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
      const ids = suppliersWithName.map(s => s.id);
      const unmergedCount = suppliersWithName.filter(s => !transport.some(t => t.linkedSupplierIds?.includes(s.id))).length;
      return unmergedCount > 1; 
  });

  const handleMergeTransport = (supplierName: string) => {
      const suppliersToMerge = suppliers.filter(s => s.name === supplierName && s.isIncluded !== false);
      const ids = suppliersToMerge.map(s => s.id);
      const totalWeight = suppliersToMerge.reduce((sum, s) => {
          return sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0);
      }, 0);
      const trucks = Math.ceil(totalWeight / truckLoadCapacity); 
      const newTransport = transport.filter(t => !t.supplierId || !ids.includes(t.supplierId));
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

  const handleUnmerge = (transportId: string) => onChange(transport.filter(t => t.id !== transportId));
  const removeTransport = (id: string) => onChange(transport.filter(t => t.id !== id));
  
  const activeSuppliers = suppliers.filter(s => s.isIncluded !== false);
  const mergedItems = transport.filter(t => t.linkedSupplierIds && t.linkedSupplierIds.length > 0);
  const mergedSupplierIds = mergedItems.flatMap(t => t.linkedSupplierIds || []);
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

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-colors">
      <div 
          className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
                {potentialMerges.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 mb-4 rounded-none flex flex-wrap gap-4 items-center justify-center border-b border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            <Info size={12}/> Wykryto możliwość łączenia transportów:
                        </div>
                        {potentialMerges.map(name => (
                            <button 
                                key={name}
                                onClick={() => handleMergeTransport(name)}
                                className="bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-none text-[10px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1 transition-colors shadow-sm"
                            >
                                <Combine size={10}/> Scal transporty dla "{name}"
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-end mb-2 pt-2">
                    <button type="button" onClick={addManualTransport} className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-none flex items-center gap-1 transition-colors">
                        <Plus size={12}/> Dodaj ręczny transport
                    </button>
                </div>

                <div className="overflow-x-auto border border-zinc-100 dark:border-zinc-800">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className={`${headerClass} pl-4`}>Dostawca / Nazwa</th>
                                <th className={`${headerClass} text-center`}>Waga</th>
                                <th className={`${headerClass} text-center`}>Org. Dostawcy?</th>
                                <th className={`${headerClass} text-center w-24`}>Tryb</th>
                                <th className={`${headerClass} text-center w-20`}>Auta</th>
                                <th className={`${headerClass} text-right w-28`}>Cena / Auto</th>
                                <th className={`${headerClass} text-center w-20`}>Waluta</th>
                                <th className={`${headerClass} text-right pr-4`}>Suma</th>
                                <th className={`${headerClass} w-10`}></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-950">
                            {unmergedSuppliers.map((supplier) => {
                                const tItem = getTransportItemForSupplier(supplier.id);
                                const weight = supplier.items.reduce((s, i) => s + (i.weight * i.quantity), 0);
                                const isOrgBySupplier = tItem.isSupplierOrganized;
                                const isManual = tItem.isManualOverride;

                                return (
                                    <tr 
                                        key={supplier.id} 
                                        className={`${pickingClass} group transition-colors`}
                                        onClick={(e) => handlePick(e, tItem)}
                                    >
                                        <td className={`${cellClass} pl-4`}>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{supplier.name}</div>
                                            {supplier.isOrm && <span className="text-[9px] bg-green-100 text-green-700 px-1 font-bold">ORM</span>}
                                        </td>
                                        <td className={`${cellClass} text-center font-mono text-zinc-600 dark:text-zinc-400 text-[10px]`}>{weight > 0 ? `${weight.toLocaleString()} kg` : '-'}</td>
                                        <td className={`${cellClass} text-center`}>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); updateSupplierTransport(supplier.id, { isSupplierOrganized: !isOrgBySupplier }); }} className={`flex items-center justify-center gap-2 mx-auto px-2 py-0.5 border transition-all ${isOrgBySupplier ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}>
                                                {isOrgBySupplier ? <CheckSquare size={14}/> : <Square size={14}/>}
                                            </button>
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                            {!isOrgBySupplier && supplier.isOrm ? (
                                                <div className="flex items-center justify-center">
                                                    <button 
                                                        onClick={(e) => handleToggleAutoManual(e, supplier)} 
                                                        className={`px-2 py-0.5 text-[9px] font-bold border transition-colors ${isManual ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}
                                                    >
                                                        {isManual ? 'MAN' : 'AUTO'}
                                                    </button>
                                                </div>
                                            ) : <span className="text-zinc-300 text-center block">-</span>}
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={`${inputClass} text-center`} value={tItem.trucksCount} onChange={(e) => handleManualInputChange(supplier.id, parseFloat(e.target.value) || 0)} disabled={isOrgBySupplier || (!isManual && supplier.isOrm)} onClick={(e) => e.stopPropagation()} />
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={inputClass} value={tItem.pricePerTruck} onChange={(e) => updateSupplierTransport(supplier.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} disabled={isOrgBySupplier} onClick={(e) => e.stopPropagation()} />
                                        </td>
                                        <td className={cellClass}>
                                            <select className={selectClass} value={tItem.currency} onChange={(e) => updateSupplierTransport(supplier.id, { currency: e.target.value as Currency })} disabled={isOrgBySupplier} onClick={(e) => e.stopPropagation()}>
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono pr-4`}>
                                            {isOrgBySupplier ? <span className="text-[10px] text-zinc-400 font-normal italic">W cenie dost.</span> : `${formatNumber(tItem.totalPrice)}`}
                                        </td>
                                        <td className={cellClass}></td>
                                    </tr>
                                );
                            })}

                            {mergedItems.map(item => {
                                const ids = item.linkedSupplierIds || [];
                                const mergedSuppliers = suppliers.filter(s => ids.includes(s.id));
                                const totalWeight = mergedSuppliers.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0), 0);
                                
                                return (
                                    <tr 
                                        key={item.id} 
                                        className={`${pickingClass} bg-blue-50/30 dark:bg-blue-900/10 transition-colors border-l-2 border-l-blue-400 dark:border-l-blue-600`}
                                        onClick={(e) => handlePick(e, item)}
                                    >
                                        <td className={`${cellClass} pl-4`}>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                                <Combine size={14} className="text-blue-500"/>
                                                {item.name}
                                            </div>
                                            <div className="text-[9px] text-zinc-500 ml-6">
                                                Łączy: {mergedSuppliers.map(s => s.customTabName || s.name).join(', ')}
                                            </div>
                                        </td>
                                        <td className={`${cellClass} text-center font-mono text-zinc-600 dark:text-zinc-400 text-[10px]`}>
                                            {totalWeight.toLocaleString()} kg
                                        </td>
                                        <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                        <td className={`${cellClass} text-center`}>
                                            <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AUTO</span>
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={`${inputClass} text-center`} value={item.trucksCount} onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()}/>
                                        </td>
                                        <td className={cellClass}>
                                            <input type="number" min="0" className={inputClass} value={item.pricePerTruck} onChange={(e) => updateById(item.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()}/>
                                        </td>
                                        <td className={cellClass}>
                                            <select className={selectClass} value={item.currency} onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })} onClick={(e) => e.stopPropagation()}>
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono pr-4`}>{formatNumber(item.totalPrice)}</td>
                                        <td className={`${cellClass} text-center`}>
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); handleUnmerge(item.id); }} 
                                                className="text-zinc-400 hover:text-red-500 transition-colors"
                                                title="Rozdziel transporty"
                                            >
                                                <Unplug size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {manualItems.map(item => (
                                <tr 
                                    key={item.id} 
                                    className={`${pickingClass} bg-amber-50/20 transition-colors`}
                                    onClick={(e) => handlePick(e, item)}
                                >
                                    <td className={`${cellClass} pl-4`}>
                                        <input type="text" className={textInputClass} placeholder="Nazwa transportu" value={item.name || ''} onChange={(e) => updateById(item.id, { name: e.target.value })} onClick={(e) => e.stopPropagation()}/>
                                    </td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={`${cellClass} text-center text-zinc-300`}>-</td>
                                    <td className={cellClass}><input type="number" min="0" className={`${inputClass} text-center`} value={item.trucksCount} onChange={(e) => updateById(item.id, { trucksCount: parseFloat(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()}/></td>
                                    <td className={cellClass}><input type="number" min="0" className={inputClass} value={item.pricePerTruck} onChange={(e) => updateById(item.id, { pricePerTruck: parseFloat(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()}/></td>
                                    <td className={cellClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateById(item.id, { currency: e.target.value as Currency })} onClick={(e) => e.stopPropagation()}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={`${cellClass} text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono pr-4`}>{formatNumber(item.totalPrice)}</td>
                                    <td className={`${cellClass} text-center`}><button type="button" onClick={(e) => { e.stopPropagation(); removeTransport(item.id); }} className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12}/></button></td>
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