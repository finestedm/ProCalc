


import React, { useEffect } from 'react';
import { CalculationData, Currency, AppState, CalculationMode } from '../types';
import { X, Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { calculateProjectCosts } from '../services/calculationService';

interface Props {
  initial: CalculationData;
  final: CalculationData;
  appState: AppState;
  onClose: () => void;
}

export const CalculationComparisonView: React.FC<Props> = ({ initial, final, appState, onClose }) => {
    // Handle Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const rate = appState.exchangeRate;
    const currency = appState.offerCurrency;
    const ormFee = appState.globalSettings.ormFeePercent;
    
    // We pass the global margin settings to both to ensure fair comparison based on current app configuration
    const costsInitial = calculateProjectCosts(initial, rate, currency, CalculationMode.INITIAL, ormFee, appState.targetMargin, appState.manualPrice);
    const costsFinal = calculateProjectCosts(final, rate, currency, CalculationMode.FINAL, ormFee, appState.targetMargin, appState.manualPrice);

    const getSellingPrice = (costs: { total: number }) => {
        if (appState.manualPrice !== null) return appState.manualPrice;
        const marginDecimal = appState.targetMargin / 100;
        const sellingPrice = marginDecimal >= 1 ? 0 : costs.total / (1 - marginDecimal);
        return sellingPrice;
    };

    const priceInitial = getSellingPrice(costsInitial);
    // For Final, if final manual price exists, use it, else fallback to initial price
    const priceFinal = appState.finalManualPrice !== null 
        ? appState.finalManualPrice
        : priceInitial;

    const renderRow = (label: string, valInitial: number, valFinal: number, isCurrency: boolean = true) => {
        const diff = valFinal - valInitial;
        const percentDiff = valInitial !== 0 ? (diff / valInitial) * 100 : 0;
        
        return (
            <div className="grid grid-cols-4 gap-4 py-3 border-b border-zinc-100 dark:border-zinc-700 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm">
                <div className="font-medium text-zinc-700 dark:text-zinc-300">{label}</div>
                <div className="text-right text-zinc-500 dark:text-zinc-400 font-mono">
                    {isCurrency ? valInitial.toFixed(2) : valInitial}
                </div>
                <div className="text-right font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                    {isCurrency ? valFinal.toFixed(2) : valFinal}
                </div>
                <div className={`text-right font-mono text-xs flex items-center justify-end gap-1 ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-500' : 'text-zinc-400'}`}>
                    {diff !== 0 && (diff > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>)}
                    {diff > 0 ? '+' : ''}{isCurrency ? diff.toFixed(2) : diff.toFixed(1)}
                    {valInitial !== 0 && <span className="opacity-75">({diff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%)</span>}
                </div>
            </div>
        );
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={onClose} // Close on backdrop click
        >
            <div 
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-slideUp"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                    <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Scale className="text-yellow-500"/> Porównanie: Wstępna vs Końcowa
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[80vh]">
                     <div className="grid grid-cols-4 gap-4 pb-2 border-b-2 border-zinc-200 dark:border-zinc-600 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        <div>Kategoria</div>
                        <div className="text-right">Wycena Wstępna ({currency})</div>
                        <div className="text-right">Wycena Końcowa ({currency})</div>
                        <div className="text-right">Różnica</div>
                    </div>

                    {renderRow('Materiał', costsInitial.suppliers, costsFinal.suppliers)}
                    {renderRow('Transport', costsInitial.transport, costsFinal.transport)}
                    {renderRow('Inne', costsInitial.other, costsFinal.other)}
                    {renderRow('Montaż', costsInitial.installation, costsFinal.installation)}
                    {costsFinal.financing > 0 && renderRow('Finansowanie', costsInitial.financing, costsFinal.financing)}
                    
                    <div className="my-4 border-t-2 border-zinc-200 dark:border-zinc-600"></div>
                    {renderRow('SUMA KOSZTÓW', costsInitial.total, costsFinal.total)}
                    <div className="my-4 border-t-2 border-zinc-200 dark:border-zinc-600"></div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 -mx-4 px-4 border-y border-yellow-100 dark:border-yellow-900/30">
                         {renderRow('Cena Sprzedaży', priceInitial, priceFinal)}
                         {renderRow('Zysk', priceInitial - costsInitial.total, priceFinal - costsFinal.total)}
                    </div>
                </div>
            </div>
        </div>
    );
};
