
import React, { useState, useEffect } from 'react';
import { Supplier, SupplierItem } from '../types';
import { SplitSquareHorizontal, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react';
import { formatNumber } from '../services/calculationService';

interface Props {
  suppliers: Supplier[];
  onBack: () => void;
}

export const ComparisonView: React.FC<Props> = ({ suppliers, onBack }) => {
  const [leftId, setLeftId] = useState<string>(suppliers[0]?.id || '');
  const [rightId, setRightId] = useState<string>(suppliers[1]?.id || '');

  const [leftItems, setLeftItems] = useState<SupplierItem[]>([]);
  const [rightItems, setRightItems] = useState<SupplierItem[]>([]);

  // Update local state when selection changes
  useEffect(() => {
    const s = suppliers.find(x => x.id === leftId);
    if (s) setLeftItems([...s.items]);
  }, [leftId, suppliers]);

  useEffect(() => {
    const s = suppliers.find(x => x.id === rightId);
    if (s) setRightItems([...s.items]);
  }, [rightId, suppliers]);

  const moveItem = (items: SupplierItem[], index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return items;
      if (direction === 'down' && index === items.length - 1) return items;

      const newItems = [...items];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      return newItems;
  };

  const renderColumn = (
      selectedId: string, 
      setId: (id: string) => void, 
      items: SupplierItem[], 
      setItems: (i: SupplierItem[]) => void,
      side: 'Left' | 'Right'
  ) => {
      const selectedSupplier = suppliers.find(s => s.id === selectedId);
      const totalValue = items.reduce((sum, item) => {
          const price = selectedSupplier?.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
          return sum + (item.quantity * price);
      }, 0);

      return (
        <div className="flex-1 bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-colors">
            <div className={`p-4 border-b ${side === 'Left' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-900/30' : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'}`}>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Dostawca {side}</label>
                <select 
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-sm font-bold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                    value={selectedId}
                    onChange={(e) => setId(e.target.value)}
                >
                    {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
                    ))}
                </select>
                {selectedSupplier && (
                    <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 flex justify-between">
                         <span>Oferta: <strong className="text-zinc-800 dark:text-zinc-200">{selectedSupplier.offerNumber}</strong></span>
                         <span>Rabat: <strong className="text-zinc-800 dark:text-zinc-200">{selectedSupplier.discount}%</strong></span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-0 bg-white dark:bg-zinc-950">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-2 w-8"></th>
                            <th className="p-2 text-xs font-bold uppercase tracking-wide">Nazwa</th>
                            <th className="p-2 text-center text-xs font-bold uppercase tracking-wide">Il.</th>
                            <th className="p-2 text-right text-xs font-bold uppercase tracking-wide">Cena</th>
                            <th className="p-2 text-right text-xs font-bold uppercase tracking-wide">Wartość</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {items.map((item, idx) => {
                            const price = selectedSupplier?.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
                            return (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                                    <td className="p-2">
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setItems(moveItem(items, idx, 'up'))}
                                                disabled={idx === 0}
                                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20"
                                            >
                                                <ChevronUp size={12}/>
                                            </button>
                                            <button 
                                                onClick={() => setItems(moveItem(items, idx, 'down'))}
                                                disabled={idx === items.length - 1}
                                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20"
                                            >
                                                <ChevronDown size={12}/>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2 text-xs text-zinc-800 dark:text-zinc-300">{item.itemDescription}</td>
                                    <td className="p-2 text-center font-medium text-zinc-700 dark:text-zinc-400">{item.quantity}</td>
                                    <td className="p-2 text-right text-zinc-500 dark:text-zinc-500 font-mono text-xs">{formatNumber(price)}</td>
                                    <td className="p-2 text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono">{formatNumber(item.quantity * price)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
                 <span className="font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Suma netto:</span>
                 <span className="text-xl font-bold text-zinc-900 dark:text-white font-mono">
                     {formatNumber(totalValue)} {selectedSupplier?.currency}
                 </span>
            </div>
        </div>
      );
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
        <div className="flex items-center gap-4 mb-4">
             <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                 <ArrowLeft size={20} />
             </button>
             <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                 <SplitSquareHorizontal className="text-amber-500"/> Porównanie Dostawców
             </h2>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden">
            {renderColumn(leftId, setLeftId, leftItems, setLeftItems, 'Left')}
            {renderColumn(rightId, setRightId, rightItems, setRightItems, 'Right')}
        </div>
    </div>
  );
};
