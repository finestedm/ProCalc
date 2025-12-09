


import React, { useMemo } from 'react';
import { AppState, CalculationMode } from '../types';
import { calculateProjectCosts, formatCurrency, formatNumber } from '../services/calculationService';
import { TrendingDown, TrendingUp, Box, Layers, PieChart } from 'lucide-react';

interface Props {
  appState: AppState;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// --- COLOR PALETTE ---
const CHART_COLORS = {
    SUPPLIERS: '#FFB900',    // Material (Yellow)
    TRANSPORT: '#009697',    // Transport (Jungheinrich Cyan)
    INSTALLATION: '#3F3F46', // Installation (Dark Gray)
    OTHER: '#A1A1AA',        // Other (Light Gray)
    FINANCING: '#8b5cf6',    // Financing (Violet)
    MARGIN: '#10B981'        // Margin (Green)
};

// --- UNIFIED CHART COMPONENT ---
const UnifiedDonutChart = ({ 
    costs, 
    sellingPrice, 
    marginPercent, 
    profit, 
    currency 
}: { 
    costs: any, 
    sellingPrice: number, 
    marginPercent: number, 
    profit: number, 
    currency: string 
}) => {
    const radius = 70;
    const strokeWidth = 24; // Thicker single ring
    const center = 100;
    const circumference = 2 * Math.PI * radius;

    // --- LOGIC ---
    // The chart base represents the Selling Price (100%).
    // If Loss (Selling Price < Total Cost), the base becomes Total Cost to show the breakdown of costs fully.
    const isLoss = profit < 0;
    const baseValue = isLoss ? costs.total : (sellingPrice > 0 ? sellingPrice : 1);

    // Prepare Segments
    const segments = [
        { key: 'supp', value: costs.suppliers, color: CHART_COLORS.SUPPLIERS, label: 'Materiał' },
        { key: 'trans', value: costs.transport, color: CHART_COLORS.TRANSPORT, label: 'Transport' },
        { key: 'inst', value: costs.installation, color: CHART_COLORS.INSTALLATION, label: 'Montaż' },
        { key: 'other', value: costs.other, color: CHART_COLORS.OTHER, label: 'Inne' },
        { key: 'finance', value: costs.financing, color: CHART_COLORS.FINANCING, label: 'Finansowanie' },
    ];

    // Add Margin Segment only if profitable
    if (!isLoss && profit > 0) {
        segments.push({ 
            key: 'margin', 
            value: profit, 
            color: CHART_COLORS.MARGIN,
            label: 'Zysk (Marża)' 
        });
    }

    let accumulatedPercent = 0;

    const renderedSegments = segments.map((seg) => {
        if (seg.value <= 0) return null;

        const percent = seg.value / baseValue;
        const dashArray = percent * circumference;
        const gap = 4; // Gap between segments
        // Ensure we don't break if segment is tiny
        const drawValue = Math.max(0, dashArray - gap);
        
        // Calculate rotation offset
        // SVG circles start at 3 o'clock (0 degrees). We rotate container -90deg so 0 is 12 o'clock.
        // Dashoffset is counter-clockwise.
        const offset = circumference - (accumulatedPercent * circumference);

        accumulatedPercent += percent;

        return (
            <circle
                key={seg.key}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${drawValue} ${circumference - drawValue}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out hover:opacity-80 hover:stroke-[26px] origin-center"
            >
                <title>{seg.label}: {formatCurrency(seg.value, currency)} ({((seg.value / baseValue) * 100).toFixed(1)}%)</title>
            </circle>
        );
    });

    return (
        <div className="relative flex justify-center items-center py-6">
            {/* Filter for glow effect */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
            </svg>

            <svg width="220" height="220" viewBox="0 0 200 200" className="rotate-[-90deg]">
                {/* Background Track */}
                <circle 
                    cx={center} 
                    cy={center} 
                    r={radius} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={strokeWidth} 
                    className="text-zinc-100 dark:text-zinc-800" 
                />

                {/* Data Segments */}
                {renderedSegments}
                
                {/* Inner Decoration Line */}
                <circle cx={center} cy={center} r={radius - strokeWidth/2 - 5} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" className="text-zinc-300 dark:text-zinc-700 opacity-30" />
            </svg>

            {/* CENTER TEXT */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Marża</div>
                <div className={`text-3xl font-black font-mono leading-none tracking-tighter ${marginPercent < 0 ? 'text-red-500' : 'text-zinc-800 dark:text-white'}`}>
                    {marginPercent.toFixed(1)}<span className="text-sm font-normal text-zinc-400">%</span>
                </div>
                <div className={`text-[11px] font-mono font-bold mt-1 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded shadow-sm border border-zinc-100 dark:border-zinc-800 ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {profit > 0 ? '+' : ''}{formatNumber(profit, 0)}
                </div>
            </div>
        </div>
    );
};

export const SidePanel: React.FC<Props> = ({ appState }) => {
  const data = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
  const rate = appState.exchangeRate;
  const currency = appState.offerCurrency;
  const ormFee = appState.globalSettings.ormFeePercent;
  
  const costs = calculateProjectCosts(data, rate, currency, appState.mode, ormFee, appState.targetMargin, appState.manualPrice);
  const hasTotal = costs.total > 0;
  
  // --- PRICE & MARGIN CALCULATION (ACTIVE) ---
  let sellingPrice = 0; 
  let marginPercent = 0;
  let profit = 0;

  if (appState.manualPrice !== null) {
      sellingPrice = appState.manualPrice;
      if (sellingPrice !== 0) {
          marginPercent = (1 - (costs.total / sellingPrice)) * 100;
      }
      profit = sellingPrice - costs.total;
  } else {
      marginPercent = appState.targetMargin;
      const marginDecimal = marginPercent / 100;
      sellingPrice = marginDecimal >= 1 
        ? (costs.total > 0 ? costs.total * 999 : 0) 
        : costs.total / (1 - marginDecimal);
      profit = sellingPrice - costs.total;
  }

  // Calculate percentages for legend relative to Selling Price (or Cost if loss)
  const baseForLegend = profit >= 0 ? (sellingPrice || 1) : costs.total;
  
  const pSuppliers = (costs.suppliers / baseForLegend) * 100;
  const pTransport = (costs.transport / baseForLegend) * 100;
  const pInstallation = (costs.installation / baseForLegend) * 100;
  const pOther = (costs.other / baseForLegend) * 100;
  const pFinancing = (costs.financing / baseForLegend) * 100;
  const pMargin = profit > 0 ? (profit / baseForLegend) * 100 : 0;

  // Colors
  const cSuppliers = CHART_COLORS.SUPPLIERS; 
  const cTransport = CHART_COLORS.TRANSPORT; 
  const cInstallation = CHART_COLORS.INSTALLATION; 
  const cOther = CHART_COLORS.OTHER;
  const cFinancing = CHART_COLORS.FINANCING;
  const cMargin = CHART_COLORS.MARGIN;

  // --- WHAT-IF DIFFERENTIAL CALCULATION ---
  const hasExclusions = costs.excluded > 0;
  const originalTotalCost = costs.total + costs.excluded;
  
  let originalSellingPrice = 0;
  let originalMarginPercent = 0;

  if (appState.manualPrice !== null) {
      originalSellingPrice = appState.manualPrice;
      if (originalSellingPrice !== 0) {
          originalMarginPercent = (1 - (originalTotalCost / originalSellingPrice)) * 100;
      }
  } else {
      originalMarginPercent = appState.targetMargin;
      const marginDecimal = originalMarginPercent / 100;
      originalSellingPrice = marginDecimal >= 1 
        ? (originalTotalCost > 0 ? originalTotalCost * 999 : 0) 
        : originalTotalCost / (1 - marginDecimal);
  }

  const diffCost = costs.total - originalTotalCost; 
  const diffPrice = sellingPrice - originalSellingPrice;
  const diffMargin = marginPercent - originalMarginPercent;

  // Margin Alert Colors
  const isCritical = marginPercent < 6;
  const isWarning = marginPercent < 7 && !isCritical;
  const marginColor = isCritical 
    ? 'text-red-600 dark:text-red-500' 
    : isWarning 
        ? 'text-orange-500' 
        : 'text-green-800 dark:text-green-300';

  // --- PALLET SPOTS METRICS ---
  const totalPalletSpots = data.installation.stages.reduce((sum, stage) => {
      if (stage.isExcluded) return sum;
      return sum + (stage.palletSpots || 0);
  }, 0);
  
  const pricePerSpot = totalPalletSpots > 0 ? sellingPrice / totalPalletSpots : 0;
  const validInstallationTypes = ["UPC (Under Pallet Carrier)", "Regały rzędowe", "DriveIn (Wjezdne)", "Regały mobilne"];
  const showPalletPrice = validInstallationTypes.includes(data.meta.installationType || '');

  const LegendItem = ({ color, label, value, percent, isBold = false }: { color: string, label: string, value: number, percent: number, isBold?: boolean }) => (
      <div className="group cursor-default">
          <div className="flex justify-between text-xs mb-1 items-center">
              <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm shadow-sm ${isBold ? 'ring-1 ring-offset-1 ring-zinc-300 dark:ring-zinc-600' : ''}`} style={{ background: color }}></div>
                  <span className={`text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors ${isBold ? 'font-black' : 'font-medium'}`}>{label}</span>
              </div>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatCurrency(value, currency)}</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, percent)}%`, background: color }}></div>
              </div>
              <div className="text-[10px] text-zinc-400 w-9 text-right font-mono">{formatNumber(percent, 1)}%</div>
          </div>
      </div>
  );

  return (
    <div className="animate-fadeIn space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-widest flex items-center gap-2">
                <PieChart size={12} /> Struktura Ceny
            </div>
            <div className="text-[9px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                Live Data
            </div>
        </div>

        {/* UNIFIED CHART */}
        <UnifiedDonutChart 
            costs={costs} 
            sellingPrice={sellingPrice} 
            marginPercent={marginPercent}
            profit={profit}
            currency={currency}
        />

        {/* Legend */}
        <div className="space-y-4">
            <LegendItem color={cSuppliers} label="Materiał" value={costs.suppliers} percent={pSuppliers} />
            <LegendItem color={cTransport} label="Transport" value={costs.transport} percent={pTransport} />
            <LegendItem color={cInstallation} label="Montaż" value={costs.installation} percent={pInstallation} />
            <LegendItem color={cOther} label="Inne" value={costs.other} percent={pOther} />
            {costs.financing > 0 && (
                <LegendItem color={cFinancing} label="Koszty finansowania" value={costs.financing} percent={pFinancing} />
            )}
            
            {/* Margin in Legend */}
            {profit > 0 && (
                <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2">
                    <LegendItem color={cMargin} label="Zysk (Marża)" value={profit} percent={pMargin} isBold />
                </div>
            )}
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 mt-1">Koszt Całkowity</span>
                <div className="text-right">
                    <div className="font-mono font-bold text-sm text-zinc-900 dark:text-white leading-none">
                        {formatNumber(costs.total)}
                    </div>
                    {hasExclusions && (
                        <div className="text-[10px] font-mono text-green-600 dark:text-green-400 flex items-center justify-end gap-0.5 mt-0.5" title="Oszczędność dzięki wykluczeniom">
                            {diffCost > 0 ? '+' : ''}{formatNumber(diffCost)}
                            <TrendingDown size={10}/>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Price Display */}
            <div className={`p-3 rounded-sm border space-y-3 shadow-sm ${isCritical ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800' : isWarning ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex justify-between items-start">
                    <span className={`text-[10px] uppercase font-bold mt-0.5 ${isCritical ? 'text-red-700 dark:text-red-400' : isWarning ? 'text-orange-700 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-400'}`}>Cena Sprzedaży</span>
                    <div className="text-right">
                        <div className={`font-mono font-bold text-lg leading-none ${isCritical ? 'text-red-800 dark:text-red-300' : isWarning ? 'text-orange-800 dark:text-orange-300' : 'text-zinc-900 dark:text-white'}`}>
                            {formatCurrency(sellingPrice, currency)}
                        </div>
                        {hasExclusions && Math.abs(diffPrice) > 0.01 && (
                            <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 mt-0.5 ${diffPrice < 0 ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                                {diffPrice > 0 ? '+' : ''}{formatNumber(diffPrice)}
                                {diffPrice < 0 && <TrendingDown size={10}/>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Price Per Pallet Spot Metric */}
            {totalPalletSpots > 0 && showPalletPrice && (
                <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-sm border border-zinc-200 dark:border-zinc-800 mt-2 flex justify-between items-center shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Box size={10}/> Cena / M. Pal.
                        </span>
                        <span className="text-[9px] text-zinc-400">Suma: {formatNumber(totalPalletSpots, 0)} szt.</span>
                    </div>
                    <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-sm">
                        {formatCurrency(pricePerSpot, currency)}
                    </div>
                </div>
            )}
        </div>
        
        {/* Quick Excluded Summary (What-If Base) */}
        {hasExclusions && (
            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-sm border-l-4 border-zinc-400 text-xs text-zinc-500 relative">
                <div className="uppercase font-bold text-[9px] mb-1 flex items-center gap-1"><Layers size={10}/> Wykluczone (Baza What-If)</div>
                <div className="font-mono line-through decoration-zinc-400">{formatCurrency(costs.excluded, currency)}</div>
                <div className="text-[9px] mt-1 italic opacity-70">
                    Wartości w delcie to różnica względem pełnego zakresu.
                </div>
            </div>
        )}
    </div>
  );
};
