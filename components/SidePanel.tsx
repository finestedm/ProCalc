
import React, { useState } from 'react';
import { AppState, CalculationMode } from '../types';
import { calculateProjectCosts, formatCurrency, formatNumber } from '../services/calculationService';

interface Props {
  appState: AppState;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const SidePanel: React.FC<Props> = ({ appState }) => {
  const data = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
  const rate = appState.exchangeRate;
  const currency = appState.offerCurrency;
  const ormFee = appState.globalSettings.ormFeePercent;
  
  const costs = calculateProjectCosts(data, rate, currency, appState.mode, ormFee);
  const hasTotal = costs.total > 0;
  
  // Calculate percentages for chart, guard against division by zero
  const pSuppliers = hasTotal ? (costs.suppliers / costs.total) * 100 : 0;
  const pTransport = hasTotal ? (costs.transport / costs.total) * 100 : 0;
  const pInstallation = hasTotal ? (costs.installation / costs.total) * 100 : 0;
  const pOther = hasTotal ? (costs.other / costs.total) * 100 : 0;

  // Colors - Updated for Jungheinrich Palette
  const cSuppliers = '#F0C80E'; // Amber/Yellow (Primary)
  const cTransport = '#0093DD'; // Cyan (Secondary)
  const cInstallation = '#ef4444'; // Red
  const cOther = '#a855f7'; // Purple

  // Conic Gradient Logic
  const startSuppliers = 0;
  const endSuppliers = pSuppliers;
  const endTransport = endSuppliers + pTransport;
  const endInstallation = endTransport + pInstallation;
  const endOther = endInstallation + pOther;

  // If no total, use a grey circle
  const gradient = hasTotal ? `conic-gradient(
    ${cSuppliers} 0% ${endSuppliers}%,
    ${cTransport} ${endSuppliers}% ${endTransport}%,
    ${cInstallation} ${endTransport}% ${endInstallation}%,
    ${cOther} ${endInstallation}% 100%
  )` : '#27272a'; // Zinc-800

  // --- PRICE & MARGIN CALCULATION ---
  let sellingPrice = 0; 
  let marginPercent = 0;

  if (appState.manualPrice !== null) {
      sellingPrice = appState.manualPrice;
      if (sellingPrice !== 0) {
          marginPercent = (1 - (costs.total / sellingPrice)) * 100;
      }
  } else {
      marginPercent = appState.targetMargin;
      const marginDecimal = marginPercent / 100;
      sellingPrice = marginDecimal >= 1 
        ? (costs.total > 0 ? costs.total * 999 : 0) 
        : costs.total / (1 - marginDecimal);
  }

  // Margin Alert Colors
  const isCritical = marginPercent < 6;
  const isWarning = marginPercent < 7 && !isCritical;
  const marginColor = isCritical 
    ? 'text-red-600 dark:text-red-500' 
    : isWarning 
        ? 'text-orange-500' 
        : 'text-green-800 dark:text-green-300';

  return (
    <div className="animate-fadeIn space-y-6">
        <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
            Struktura Kosztów
        </div>

        {/* Pie Chart (Donut) */}
        <div className="flex justify-center py-2">
            <div className="relative w-32 h-32 rounded-full shadow-lg border-4 border-zinc-50 dark:border-zinc-900 overflow-hidden" style={{ background: gradient }}>
                <div className="absolute inset-0 m-auto w-20 h-20 bg-white dark:bg-zinc-950 rounded-full flex items-center justify-center flex-col z-10">
                    <span className="text-[9px] text-zinc-400 uppercase font-bold">Suma</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{hasTotal ? '100%' : '0%'}</span>
                </div>
            </div>
        </div>

        {/* Legend */}
        <div className="space-y-3">
            <div>
                <div className="flex justify-between text-xs mb-1 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cSuppliers }}></div>
                        <span className="text-zinc-600 dark:text-zinc-400">Materiał</span>
                    </div>
                    <span className="font-mono">{formatCurrency(costs.suppliers, currency)}</span>
                </div>
                <div className="text-[9px] text-zinc-400 text-right">{formatNumber(pSuppliers, 1)}%</div>
            </div>

            <div>
                <div className="flex justify-between text-xs mb-1 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cTransport }}></div>
                        <span className="text-zinc-600 dark:text-zinc-400">Transport</span>
                    </div>
                    <span className="font-mono">{formatCurrency(costs.transport, currency)}</span>
                </div>
                <div className="text-[9px] text-zinc-400 text-right">{formatNumber(pTransport, 1)}%</div>
            </div>

            <div>
                <div className="flex justify-between text-xs mb-1 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cInstallation }}></div>
                        <span className="text-zinc-600 dark:text-zinc-400">Montaż</span>
                    </div>
                    <span className="font-mono">{formatCurrency(costs.installation, currency)}</span>
                </div>
                <div className="text-[9px] text-zinc-400 text-right">{formatNumber(pInstallation, 1)}%</div>
            </div>

            <div>
                <div className="flex justify-between text-xs mb-1 items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cOther }}></div>
                        <span className="text-zinc-600 dark:text-zinc-400">Inne</span>
                    </div>
                    <span className="font-mono">{formatCurrency(costs.other, currency)}</span>
                </div>
                <div className="text-[9px] text-zinc-400 text-right">{formatNumber(pOther, 1)}%</div>
            </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Koszt Całkowity</span>
                <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                    {formatNumber(costs.total)}
                </span>
            </div>
            
            {/* Added Price & Margin Display */}
            <div className={`p-3 rounded-sm border space-y-2 ${isCritical ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800' : isWarning ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'}`}>
                <div className="flex justify-between items-center">
                    <span className={`text-[10px] uppercase font-bold ${isCritical ? 'text-red-700 dark:text-red-400' : isWarning ? 'text-orange-700 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>Cena Sprzedaży</span>
                    <span className={`font-mono font-bold text-sm ${isCritical ? 'text-red-800 dark:text-red-300' : isWarning ? 'text-orange-800 dark:text-orange-300' : 'text-green-800 dark:text-green-300'}`}>
                        {formatCurrency(sellingPrice, currency)}
                    </span>
                </div>
                <div className={`flex justify-between items-center border-t pt-2 ${isCritical ? 'border-red-200 dark:border-red-800' : isWarning ? 'border-orange-200 dark:border-orange-800' : 'border-green-200 dark:border-green-800'}`}>
                    <span className={`text-[10px] uppercase font-bold ${isCritical ? 'text-red-700 dark:text-red-400' : isWarning ? 'text-orange-700 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>Marża</span>
                    <span className={`font-mono font-bold text-sm ${marginColor}`}>
                        {formatNumber(marginPercent, 2)}%
                    </span>
                </div>
            </div>
        </div>
        
        {/* Quick Excluded Summary */}
        {costs.excluded > 0 && (
            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-sm border-l-2 border-zinc-400 text-xs text-zinc-500">
                <div className="uppercase font-bold text-[9px] mb-1">Wykluczone (What-If)</div>
                <div className="font-mono line-through decoration-zinc-400">{formatCurrency(costs.excluded, currency)}</div>
            </div>
        )}
    </div>
  );
};
