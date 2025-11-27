import React from 'react';
import { AppState, CalculationMode, Currency, CalculationData } from '../types';
import { Package, Truck, Receipt, Wrench, Undo2, Redo2, EyeOff } from 'lucide-react';
import { calculateProjectCosts } from '../services/calculationService';

interface Props {
  appState: AppState;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const formatMoney = (val: number, currency: string) => 
  `${val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const CostPieChart = ({ 
    data 
}: { 
    data: { label: string; value: number; color: string }[] 
}) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const activeData = data.filter(item => item.value > 0);

    if (total === 0 || activeData.length === 0) {
        return <div className="h-32 flex items-center justify-center text-xs text-zinc-400 italic">Brak danych</div>;
    }

    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <div className="flex flex-col items-center mt-4 mb-2">
            <svg viewBox="-1 -1 2 2" className="w-32 h-32 transform -rotate-90">
                {activeData.map((item, i) => {
                    const percent = item.value / total;
                    if (percent === 1) {
                         return <circle key={i} cx="0" cy="0" r="1" fill={item.color} />;
                    }
                    const start = cumulativePercent;
                    const end = cumulativePercent + percent;
                    cumulativePercent += percent;
                    const [startX, startY] = getCoordinatesForPercent(start);
                    const [endX, endY] = getCoordinatesForPercent(end);
                    const largeArcFlag = percent > 0.5 ? 1 : 0;
                    const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

                    return <path key={i} d={pathData} fill={item.color} className="transition-all duration-300 hover:opacity-90"/>;
                })}
                <circle cx="0" cy="0" r="0.6" className="fill-white dark:fill-zinc-800 transition-colors" />
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span>{item.label} ({total > 0 ? ((item.value/total)*100).toFixed(0) : 0}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SidePanel: React.FC<Props> = ({ appState, onUndo, onRedo, canUndo, canRedo }) => {
  const isFinal = appState.mode === CalculationMode.FINAL;
  const currentData = isFinal ? appState.final : appState.initial;
  
  // Use Centralized Calculation Service
  const costs = calculateProjectCosts(currentData, appState.exchangeRate, appState.offerCurrency, appState.mode);
  
  let sellingPrice = 0;
  let currentMarginPercent = 0;

  if (appState.manualPrice !== null) {
      sellingPrice = appState.manualPrice;
      if (sellingPrice !== 0) {
        const marginDecimal = 1 - (costs.total / sellingPrice);
        currentMarginPercent = marginDecimal * 100;
      }
  } else {
      const marginDecimal = appState.targetMargin / 100;
      currentMarginPercent = appState.targetMargin;
      sellingPrice = marginDecimal >= 1 ? 0 : (costs.total / (1 - marginDecimal));
  }

  const chartData = [
      { label: 'Materiał', value: costs.suppliers, color: '#FFCC00' }, // Yellow
      { label: 'Transport', value: costs.transport, color: '#1e293b' }, // Zinc 800
      { label: 'Inne', value: costs.other, color: '#94a3b8' }, // Zinc 400
      { label: 'Montaż', value: costs.installation, color: '#475569' }, // Zinc 600
  ];

  const currencyLabel = appState.offerCurrency;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 sticky top-20 transition-colors">
      <div className="flex justify-between items-center mb-4 border-b border-yellow-500 pb-2">
          <h3 className="text-zinc-800 dark:text-zinc-100 font-bold">Podsumowanie ({currencyLabel})</h3>
      </div>

      <CostPieChart data={chartData} />

      <div className="space-y-3 mb-6 mt-4 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-4">
          <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Package size={14}/> Materiał</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatMoney(costs.suppliers, currencyLabel)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Truck size={14}/> Transport</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatMoney(costs.transport, currencyLabel)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Receipt size={14}/> Inne</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatMoney(costs.other, currencyLabel)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-2"><Wrench size={14}/> Montaż</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatMoney(costs.installation, currencyLabel)}</span>
          </div>
          
          {/* Excluded Items (What-If) Summary */}
          {costs.excluded > 0 && (
              <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-dashed dark:border-zinc-700 pt-2 mt-2 italic">
                  <span className="flex items-center gap-2"><EyeOff size={12}/> Wyłączone (What-If)</span>
                  <span className="font-mono line-through">{formatMoney(costs.excluded, currencyLabel)}</span>
              </div>
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 flex justify-between items-center font-bold">
               <span className="text-zinc-800 dark:text-zinc-200 uppercase text-xs">Suma Kosztów</span>
               <span className="text-zinc-900 dark:text-white">{formatMoney(costs.total, currencyLabel)}</span>
          </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <div>
           <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Marża</p>
           <div className="flex items-baseline gap-2">
             <span className={`text-xl font-bold ${appState.manualPrice !== null ? 'text-zinc-800 dark:text-white' : 'text-yellow-600 dark:text-yellow-400'}`}>
                 {currentMarginPercent.toFixed(2)}%
             </span>
             {appState.manualPrice !== null && <span className="text-[10px] text-zinc-500 font-semibold bg-zinc-100 dark:bg-zinc-700 px-1 rounded border border-zinc-200">RĘCZNA</span>}
             <span className="text-xs text-zinc-400">({formatMoney(sellingPrice - costs.total, currencyLabel)})</span>
           </div>
        </div>

        <div className={`p-3 rounded-lg border ${appState.manualPrice !== null ? 'bg-zinc-100 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'}`}>
           <p className="text-xs uppercase font-bold text-zinc-600 dark:text-zinc-300">Cena Oferty ({currencyLabel})</p>
           <p className="text-2xl font-bold text-black dark:text-white">{formatMoney(sellingPrice, currencyLabel)}</p>
        </div>
      </div>
    </div>
  );
};