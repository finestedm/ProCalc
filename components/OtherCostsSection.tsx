import React, { useState } from 'react';
import { OtherCostItem, Currency } from '../types';
import { Receipt, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { convert } from '../services/calculationService';

interface Props {
  costs: OtherCostItem[];
  onChange: (costs: OtherCostItem[]) => void;
  exchangeRate: number;
  offerCurrency: Currency;
}

export const OtherCostsSection: React.FC<Props> = ({ costs, onChange, exchangeRate, offerCurrency }) => {
  const [isOpen, setIsOpen] = useState(true);

  const addCost = () => {
    onChange([...costs, {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      price: 0,
      currency: Currency.PLN
    }]);
  };

  const removeCost = (index: number) => {
    onChange(costs.filter((_, i) => i !== index));
  };

  const updateCost = (index: number, field: keyof OtherCostItem, value: any) => {
    const updated = [...costs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // --- Calculate Total for Header ---
  const otherTotal = costs.reduce((total, c) => {
      return total + convert(c.price, c.currency, offerCurrency, exchangeRate);
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
            <Receipt className="text-yellow-500" size={20} /> Inne Koszty
        </h2>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {otherTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offerCurrency}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-100 dark:border-zinc-700">
             <div className="flex justify-end p-2 bg-zinc-50 dark:bg-zinc-800/30 border-b dark:border-zinc-700">
                 <button onClick={addCost} className="text-[10px] bg-zinc-200 dark:bg-zinc-700 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-3 py-1 rounded flex items-center gap-1 transition-colors font-semibold">
                    <Plus size={12} /> Dodaj Koszt
                 </button>
             </div>

            <div className="overflow-x-auto min-h-[150px]">
                <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                    <thead>
                        <tr>
                            <th className={`${headerClass} w-10 text-center`}>#</th>
                            <th className={`${headerClass} text-left`}>Opis kosztu</th>
                            <th className={`${headerClass} text-right w-40`}>Wartość</th>
                            <th className={`${headerClass} w-32`}>Waluta</th>
                            <th className={`${headerClass} w-10`}></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-800">
                        {costs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-zinc-400 italic">Brak dodatkowych kosztów.</td>
                            </tr>
                        )}
                        {costs.map((cost, idx) => (
                            <tr key={cost.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className={`${cellClass} text-center text-zinc-400`}>{idx + 1}</td>
                                <td className={cellClass}>
                                    <input type="text" placeholder="np. Hotel, Paliwo" className={textInputClass} value={cost.description} onChange={(e) => updateCost(idx, 'description', e.target.value)} />
                                </td>
                                <td className={cellClass}>
                                    <input type="number" min="0" step="0.01" className={inputClass} value={cost.price} onChange={(e) => updateCost(idx, 'price', parseFloat(e.target.value) || 0)} />
                                </td>
                                <td className={cellClass}>
                                    <select className={selectClass} value={cost.currency} onChange={(e) => updateCost(idx, 'currency', e.target.value)}>
                                        <option value={Currency.PLN}>PLN</option>
                                        <option value={Currency.EUR}>EUR</option>
                                    </select>
                                </td>
                                <td className={`${cellClass} text-center`}>
                                    <button onClick={() => removeCost(idx)} className="text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};