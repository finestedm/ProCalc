
import React from 'react';
import { AppState, CalculationMode } from '../types';
import { Package, Truck, Receipt, Wrench, EyeOff, BarChart3, TrendingUp, Landmark } from 'lucide-react';
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
        <div className="flex flex-col items-center mt-6 mb-4 animate-scaleIn relative">
            <svg viewBox="-1 -1 2 2" className="w-40 h-40 transform -rotate-90 drop-shadow-xl">
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

                    return <path key={i} d={pathData} fill={item.color} className="transition-all duration-300 hover:opacity-90 stroke-white dark:stroke-zinc-800 stroke-[0.02]"/>;
                })}
                {/* Inner circle to make it a donut chart */}
                <circle cx="0" cy="0" r="0.7" className="fill-white dark:fill-zinc-800" />
            </svg>
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Suma</span>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{total > 1000 ? (total/1000).toFixed(1) + 'k' : total.toFixed(0)}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-6 w-full px-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                        <div className="flex justify-between w-full">
                            <span>{item.label}</span>
                            <span className="font-mono opacity-70">{total > 0 ? ((item.value/total)*100).toFixed(0) : 0}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SidePanel: React.FC<Props> = ({ appState }) => {
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

  // Soft UI Palette
  const chartData = [
      { label: 'Materiał', value: costs.suppliers, color: '#F59E0B' }, // Amber-500
      { label: 'Transport', value: costs.transport, color: '#3B82F6' }, // Blue-500
      { label: 'Inne', value: costs.other, color: '#8B5CF6' }, // Violet-500
      { label: 'Montaż', value: costs.installation, color: '#10B981' }, // Emerald-500
  ];

  // Only add ORM Fee if it exists
  if (costs.ormFee > 0) {
      chartData.push({ label: 'Opłata ORM', value: costs.ormFee, color: '#ec4899' }); // Pink-500
  }

  const currencyLabel = appState.offerCurrency;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg shadow-zinc-200/50 dark:shadow-black/30 overflow-hidden border border-zinc-100 dark:border-zinc-700 transition-all duration-300 sticky top-4">
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
          <div>
              <h3 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <BarChart3 size={18} className="text-yellow-500"/> Podsumowanie
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Kalkulacja kosztów w {currencyLabel}</p>
          </div>
      </div>

      <div className="p-6">
          <CostPieChart data={chartData} />

          {/* List Breakdown */}
          <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center text-sm group">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-3 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded-lg text-amber-600 dark:text-amber-400"><Package size={14}/></div>
                      Materiał
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatMoney(costs.suppliers, currencyLabel)}</span>
              </div>
              <div className="flex justify-between items-center text-sm group">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-3 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg text-blue-600 dark:text-blue-400"><Truck size={14}/></div>
                      Transport
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatMoney(costs.transport, currencyLabel)}</span>
              </div>
              <div className="flex justify-between items-center text-sm group">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-3 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      <div className="bg-violet-100 dark:bg-violet-900/30 p-1.5 rounded-lg text-violet-600 dark:text-violet-400"><Receipt size={14}/></div>
                      Inne
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatMoney(costs.other, currencyLabel)}</span>
              </div>
              <div className="flex justify-between items-center text-sm group">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-3 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400"><Wrench size={14}/></div>
                      Montaż
                  </span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatMoney(costs.installation, currencyLabel)}</span>
              </div>
              
              {/* ORM Fee Breakdown Item */}
              {costs.ormFee > 0 && (
                  <div className="flex justify-between items-center text-sm group">
                      <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-3 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                          <div className="bg-pink-100 dark:bg-pink-900/30 p-1.5 rounded-lg text-pink-600 dark:text-pink-400"><Landmark size={14}/></div>
                          Opłata ORM
                      </span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatMoney(costs.ormFee, currencyLabel)}</span>
                  </div>
              )}
              
              {/* Excluded Items (What-If) Summary */}
              {costs.excluded > 0 && (
                  <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-3 mt-2 italic">
                      <span className="flex items-center gap-2"><EyeOff size={12}/> Wyłączone (What-If)</span>
                      <span className="font-mono line-through decoration-zinc-300">{formatMoney(costs.excluded, currencyLabel)}</span>
                  </div>
              )}

              <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4 mt-2 flex justify-between items-center">
                   <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Koszt Całkowity</span>
                   <span className="text-zinc-900 dark:text-white font-bold font-mono">{formatMoney(costs.total, currencyLabel)}</span>
              </div>
          </div>
      </div>

      {/* Footer - Final Price Area */}
      <div className="bg-zinc-50 dark:bg-zinc-900 p-6 border-t border-zinc-100 dark:border-zinc-700">
        <div className="flex justify-between items-end mb-2">
           <div className="flex flex-col">
               <span className="text-xs text-zinc-400 font-bold uppercase mb-1">Marża</span>
               <div className="flex items-center gap-2">
                   <span className={`text-lg font-bold ${appState.manualPrice !== null ? 'text-zinc-900 dark:text-white' : 'text-yellow-600'}`}>
                       {currentMarginPercent.toFixed(2)}%
                   </span>
                   {appState.manualPrice !== null && (
                       <span className="text-[9px] bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Ręczna</span>
                   )}
               </div>
           </div>
           <div className="flex flex-col items-end">
               <span className="text-xs text-zinc-400 font-bold uppercase mb-1">Zysk</span>
               <span className="text-sm font-mono text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                   <TrendingUp size={12}/> {formatMoney(sellingPrice - costs.total, currencyLabel)}
               </span>
           </div>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
           <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">Cena Oferty (Netto)</p>
           <p className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">{formatMoney(sellingPrice, currencyLabel)}</p>
        </div>
      </div>
    </div>
  );
};
