import React from 'react';
import { CalculationData, AppState, Currency } from '../types';
import { Calculator, ArrowRight } from 'lucide-react';
import { calculateProjectCosts } from '../services/calculationService';

interface Props {
  data: CalculationData;
  appState: AppState;
}

export const FloatingSummary: React.FC<Props> = ({ data, appState }) => {
  const rate = appState.exchangeRate;
  
  const costs = calculateProjectCosts(data, rate, appState.offerCurrency, appState.mode);
  const totalCost = costs.total;
  
  let sellingPricePLN = 0;
  let marginPercent = 0;

  if (appState.manualPrice !== null) {
      // Manual Price is in Offer Currency
      const sellingPriceOffer = appState.manualPrice;
      
      // Calculate Margin
      if (sellingPriceOffer !== 0) {
          marginPercent = (1 - (totalCost / sellingPriceOffer)) * 100;
      }
      // For display below, we need Offer Currency value
      sellingPricePLN = sellingPriceOffer; 

  } else {
      marginPercent = appState.targetMargin;
      const marginDecimal = marginPercent / 100;
      sellingPricePLN = marginDecimal >= 1 
        ? (totalCost > 0 ? totalCost * 999 : 0) 
        : totalCost / (1 - marginDecimal);
  }

  // sellingPricePLN here is actually in Offer Currency units because calculateProjectCosts returns target currency
  const sellingPriceOffer = sellingPricePLN;

  return (
    <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-800 border-t border-yellow-500 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-slideUp">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
         <div className="flex flex-col sm:flex-row gap-x-6 gap-y-1">
             <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                 <span>Koszt:</span>
                 <span className="font-mono font-bold text-zinc-900 dark:text-white">{totalCost.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appState.offerCurrency}</span>
             </div>
             <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                 <span>Marża:</span>
                 <span className={`font-bold ${appState.manualPrice !== null ? 'text-zinc-900 dark:text-white' : 'text-yellow-600 dark:text-yellow-400'}`}>
                     {marginPercent.toFixed(2)}%
                 </span>
             </div>
         </div>

         <div className="flex items-center gap-3">
             <div className="text-right">
                 <div className="text-[10px] text-zinc-500 uppercase font-bold">Cena ({appState.offerCurrency})</div>
                 <div className="text-xl font-bold text-zinc-900 dark:text-white font-mono leading-none">
                     {sellingPriceOffer.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};