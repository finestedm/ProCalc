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
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className={`p-4 border-b ${side === 'Left' ? 'bg-yellow-50 border-yellow-200' : 'bg-zinc-50 border-zinc-200'}`}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dostawca {side}</label>
                <select 
                    className="w-full p-2 border rounded font-bold text-zinc-800"
                    value={selectedId}
                    onChange={(e) => setId(e.target.value)}
                >
                    {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
                    ))}
                </select>
                {selectedSupplier && (
                    <div className="mt-2 text-sm text-gray-600 flex justify-between">
                         <span>Oferta: <strong>{selectedSupplier.offerNumber}</strong></span>
                         <span>Rabat: <strong>{selectedSupplier.discount}%</strong></span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-100 text-zinc-600 sticky top-0">
                        <tr>
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Nazwa</th>
                            <th className="p-2 text-center">Il.</th>
                            <th className="p-2 text-right">Cena</th>
                            <th className="p-2 text-right">Wartość</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {items.map((item, idx) => {
                            const price = selectedSupplier?.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-2">
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => setItems(moveItem(items, idx, 'up'))}
                                                disabled={idx === 0}
                                                className="text-gray-400 hover:text-black disabled:opacity-20"
                                            >
                                                <ChevronUp size={12}/>
                                            </button>
                                            <button 
                                                onClick={() => setItems(moveItem(items, idx, 'down'))}
                                                disabled={idx === items.length - 1}
                                                className="text-gray-400 hover:text-black disabled:opacity-20"
                                            >
                                                <ChevronDown size={12}/>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2 text-xs">{item.itemDescription}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-right text-gray-500">{formatNumber(price)}</td>
                                    <td className="p-2 text-right font-medium">{formatNumber(item.quantity * price)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                 <span className="font-bold text-gray-500">Suma netto:</span>
                 <span className="text-xl font-bold text-zinc-800">
                     {formatNumber(totalValue)} {selectedSupplier?.currency}
                 </span>
            </div>
        </div>
      );
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
        <div className="flex items-center gap-4 mb-4">
             <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
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