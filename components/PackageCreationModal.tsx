
import React, { useState, useEffect } from 'react';
import { VariantItem, Supplier } from '../types';
import { Package, X, Check, Layers, ArrowRight, Calculator, Edit2, PlusCircle } from 'lucide-react';
import { SmartInput } from './SmartInput';
import { formatNumber } from '../services/calculationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: VariantItem[];
  suppliers: Supplier[];
  onCreatePackage: (name: string, totalPrice: number, individualPrices: Record<string, number>) => void;
  onUpdatePackage?: (name: string, totalPrice: number, individualPrices: Record<string, number>) => void;
  onAddSeparately?: () => void;
  initialName?: string;
  initialPrices?: Record<string, number>;
  isEditing?: boolean;
  onAddMore?: (currentName: string, currentPrices: Record<string, number>) => void;
}

export const PackageCreationModal: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    items, 
    suppliers, 
    onCreatePackage, 
    onUpdatePackage, 
    onAddSeparately,
    initialName,
    initialPrices,
    isEditing = false,
    onAddMore
}) => {
  const [packageName, setPackageName] = useState('');
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setPackageName(initialName || (isEditing ? '' : `Pakiet montażowy (${items.length} el.)`));
      
      const prices: Record<string, number> = {};
      items.forEach(i => {
          prices[i.id] = initialPrices ? (initialPrices[i.id] || 0) : 0;
      });
      setUnitPrices(prices);
    }
  }, [isOpen, items, initialName, initialPrices, isEditing]);

  if (!isOpen) return null;

  const getQuantity = (item: VariantItem): number => {
      // Logic to resolve quantity from Supplier Data
      if (item.type === 'SUPPLIER_ITEM') {
          if (item.id.startsWith('group_supp_')) {
              // Group: Sum of all items in supplier
              const suppId = item.id.replace('group_supp_', '');
              const s = suppliers.find(sup => sup.id === suppId);
              return s ? s.items.reduce((sum, i) => sum + i.quantity, 0) : 1;
          } else {
              // Single Item
              for (const s of suppliers) {
                  const found = s.items.find(i => i.id === item.id);
                  if (found) return found.quantity;
              }
          }
      }
      return 1; // Default fallback
  };

  const handleUnitPriceChange = (id: string, val: number) => {
    setUnitPrices(prev => ({ ...prev, [id]: val }));
  };

  // Calculate Totals
  let packageTotal = 0;
  const rowData = items.map(item => {
      const qty = getQuantity(item);
      const unitPrice = unitPrices[item.id] || 0;
      const rowTotal = qty * unitPrice;
      packageTotal += rowTotal;
      return { ...item, qty, unitPrice, rowTotal };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && onUpdatePackage) {
        onUpdatePackage(packageName, packageTotal, unitPrices);
    } else {
        onCreatePackage(packageName, packageTotal, unitPrices);
    }
  };

  const handleAddMoreClick = () => {
      if (onAddMore) {
          onAddMore(packageName, unitPrices);
      }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scaleIn border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                  {isEditing ? 'Edytuj Pakiet Montażowy' : 'Utwórz Pakiet Montażowy'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing ? 'Aktualizuj ceny jednostkowe dla elementów pakietu' : `Połącz ${items.length} elementów w jedną pozycję montażową`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-zinc-950">
          <div className="mb-6">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Nazwa Pakietu</label>
            <input 
              type="text" 
              className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-purple-400 outline-none"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Element (Źródło)</th>
                  <th className="p-3 text-center w-24">Ilość</th>
                  <th className="p-3 text-right w-40 bg-purple-50/50 dark:bg-purple-900/10">Cena jedn. montażu</th>
                  <th className="p-3 text-right w-32">Wartość</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rowData.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="p-3 text-center text-zinc-400 text-xs">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 line-clamp-2" title={row.originalDescription}>
                        {row.originalDescription}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Layers size={10}/> {row.type}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-zinc-600 dark:text-zinc-400">
                        {row.qty}
                    </td>
                    <td className="p-3 bg-purple-50/30 dark:bg-purple-900/5">
                      <div className="relative">
                        <SmartInput 
                          className="w-full p-2 pr-8 text-right bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-mono font-bold text-purple-700 dark:text-purple-300"
                          value={row.unitPrice}
                          onChange={(val) => handleUnitPriceChange(row.id, val)}
                          placeholder="0.00"
                        />
                        <span className="absolute right-2 top-2.5 text-[10px] text-purple-400 font-bold">PLN</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-800 dark:text-zinc-200">
                        {formatNumber(row.rowTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-purple-50/50 dark:bg-purple-900/10 font-bold border-t-2 border-purple-100 dark:border-purple-900/30">
                <tr>
                  <td colSpan={4} className="p-3 text-right text-purple-800 dark:text-purple-300 uppercase text-xs tracking-wider">
                    <div className="flex items-center justify-end gap-2 h-full">
                        <Calculator size={14}/> Suma Pakietu:
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono text-lg text-purple-700 dark:text-purple-400">
                    {formatNumber(packageTotal)} <span className="text-xs">PLN</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex justify-between items-center">
          <div className="flex gap-2">
              {onAddSeparately ? (
                  <button 
                    onClick={onAddSeparately}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors flex items-center gap-2"
                  >
                    <ArrowRight size={14}/> Osobno
                  </button>
              ) : <div></div>}
              
              {isEditing && onAddMore && (
                  <button 
                    onClick={handleAddMoreClick}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-2"
                  >
                    <PlusCircle size={14}/> Dobierz elementy
                  </button>
              )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors"
            >
              Anuluj
            </button>
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all transform hover:scale-105"
            >
              {isEditing ? <><Edit2 size={16}/> Aktualizuj</> : <><Check size={16}/> Utwórz</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
