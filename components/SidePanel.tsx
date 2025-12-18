
import React, { useMemo, useState, useEffect } from 'react';
import { AppState, CalculationMode, Currency, InstallationStage } from '../types';
import { calculateProjectCosts, formatCurrency, formatNumber, convert, calculateStageCost } from '../services/calculationService';
import { TrendingDown, TrendingUp, Box, Layers, PieChart, ArrowLeft, RotateCcw } from 'lucide-react';
import { CountUp } from './CountUp';

interface Props {
    appState: AppState;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

// --- COLOR PALETTE ---
const CATEGORY_COLORS = {
    SUPPLIERS: '#FFB900',    // Material (Yellow)
    TRANSPORT: '#009697',    // Transport (Jungheinrich Cyan)
    INSTALLATION: '#3F3F46', // Installation (Dark Gray)
    OTHER: '#A1A1AA',        // Other (Light Gray)
    FINANCING: '#8b5cf6',    // Financing (Violet)
    MARGIN: '#10B981'        // Margin (Green)
};

const DETAIL_PALETTE = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#84cc16'  // Lime
];

type ChartSegment = {
    key: string;
    value: number;
    color: string;
    label: string;
    id?: string; // For drill-down identification
    isClickable?: boolean;
};

interface LegendItemProps {
    color: string;
    label: string;
    value: number;
    percent: number;
    currency: string;
    isBold?: boolean;
    onClick?: () => void;
    delay?: number;
}

const LegendItem: React.FC<LegendItemProps> = ({ color, label, value, percent, currency, isBold = false, onClick, delay = 0 }) => (
    <div
        className={`group ${onClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors' : 'cursor-default'} animate-fadeIn`}
        style={{ animationDelay: `${delay}ms` }}
        onClick={onClick}
    >
        <div className="flex justify-between text-xs mb-1 items-center">
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded shadow-sm ${isBold ? 'ring-1 ring-offset-1 ring-zinc-300 dark:ring-zinc-600' : ''}`} style={{ background: color }}></div>
                <span className={`text-zinc-600 dark:text-zinc-300 ${onClick ? 'group-hover:text-zinc-900 dark:group-hover:text-white underline decoration-dotted decoration-zinc-300 underline-offset-2' : ''} transition-colors ${isBold ? 'font-black' : 'font-medium'}`}>{label}</span>
            </div>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
                <CountUp value={value} suffix={` ${currency}`} />
            </span>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.max(0, percent)}%`, background: color }}></div>
            </div>
            <div className="text-[10px] text-zinc-400 w-9 text-right font-mono">{formatNumber(percent, 1)}%</div>
        </div>
    </div>
);

// --- UNIFIED CHART COMPONENT ---
const UnifiedDonutChart = ({
    segments,
    centerContent,
    totalValue,
    currency,
    viewKey,
    onSegmentClick,
    onCenterClick,
    onSegmentHover,
    onSegmentLeave
}: {
    segments: ChartSegment[],
    centerContent: React.ReactNode,
    totalValue: number,
    currency: string,
    viewKey: string,
    onSegmentClick?: (segment: ChartSegment) => void,
    onCenterClick?: () => void,
    onSegmentHover?: (segment: ChartSegment) => void,
    onSegmentLeave?: () => void
}) => {
    const [isAnimated, setIsAnimated] = useState(false);
    const radius = 70;
    const strokeWidth = 24;
    const center = 100;
    const circumference = 2 * Math.PI * radius;

    // Filter out zero/negative values for the visual chart (handled via filteredSegments)
    // Note: If totalValue is 0, we can't render percentages correctly.
    const validTotal = totalValue > 0 ? totalValue : 1;

    let accumulatedPercent = 0;

    useEffect(() => {
        setIsAnimated(false);
        const timer = setTimeout(() => setIsAnimated(true), 50);
        return () => clearTimeout(timer);
    }, [viewKey]);

    const renderedSegments = segments.map((seg, i) => {
        if (seg.value <= 0) return null;

        const percent = seg.value / validTotal;
        const dashArray = percent * circumference;
        // visual gap removed
        const gap = 0;
        const drawValue = Math.max(0, dashArray - gap);

        const offset = circumference - (accumulatedPercent * circumference);
        accumulatedPercent += percent;

        // Animation State
        const currentDashArray = isAnimated ? `${drawValue} ${circumference - drawValue}` : `0 ${circumference}`;

        return (
            <circle
                key={seg.key}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={currentDashArray}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center ${seg.isClickable ? 'cursor-pointer hover:opacity-80 hover:stroke-[26px]' : ''}`}
                style={{ transitionProperty: 'stroke-dasharray, stroke-width, opacity' }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (seg.isClickable && onSegmentClick) onSegmentClick(seg);
                }}
                onMouseEnter={() => onSegmentHover && onSegmentHover(seg)}
                onMouseLeave={() => onSegmentLeave && onSegmentLeave()}
            >
            </circle>
        );
    });

    return (
        <div className="relative flex justify-center items-center py-6">
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
                {renderedSegments}
                <circle cx={center} cy={center} r={radius - strokeWidth / 2 - 5} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" className="text-zinc-300 dark:text-zinc-700 opacity-30" />
            </svg>

            {/* CENTER TEXT */}
            <div
                className={`absolute inset-0 flex flex-col items-center justify-center ${onCenterClick ? 'cursor-pointer group' : 'pointer-events-none'}`}
                onClick={onCenterClick}
            >
                <div key={viewKey} className="flex flex-col items-center justify-center animate-scaleIn w-full">
                    {centerContent}
                </div>
            </div>
        </div>
    );
};

export const SidePanel: React.FC<Props> = ({ appState }) => {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [hoveredSegment, setHoveredSegment] = useState<ChartSegment | null>(null);

    const data = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
    const rate = appState.exchangeRate;
    const currency = appState.offerCurrency;
    const ormFee = appState.globalSettings.ormFeePercent;

    const costs = calculateProjectCosts(data, rate, currency, appState.mode, ormFee, appState.targetMargin, appState.manualPrice);

    // --- PRICE & MARGIN CALCULATION ---
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

    // --- DATA PREPARATION FOR CHART ---

    const prepareChartData = () => {
        // 1. Summary View
        if (!activeCategory) {
            // Combine Suppliers and ORM Fee into one visual segment for simplicity, 
            // as ORM Fee is a material surcharge.
            const segments: ChartSegment[] = [
                { key: 'supp', id: 'SUPPLIERS', value: costs.suppliers + costs.ormFee, color: CATEGORY_COLORS.SUPPLIERS, label: 'Materiał', isClickable: true },
                { key: 'trans', id: 'TRANSPORT', value: costs.transport, color: CATEGORY_COLORS.TRANSPORT, label: 'Transport', isClickable: true },
                { key: 'inst', id: 'INSTALLATION', value: costs.installation, color: CATEGORY_COLORS.INSTALLATION, label: 'Montaż', isClickable: true },
                { key: 'other', id: 'OTHER', value: costs.other, color: CATEGORY_COLORS.OTHER, label: 'Inne', isClickable: true },
                { key: 'finance', id: 'FINANCING', value: costs.financing, color: CATEGORY_COLORS.FINANCING, label: 'Finansowanie', isClickable: false },
            ];

            if (profit > 0) {
                segments.push({ key: 'margin', id: 'MARGIN', value: profit, color: CATEGORY_COLORS.MARGIN, label: 'Zysk', isClickable: false });
            }

            // Base value for summary is Selling Price (if profit) or Total Cost (if loss)
            const baseValue = profit >= 0 ? (sellingPrice || 1) : costs.total;

            return {
                segments,
                totalValue: baseValue,
                center: (
                    <>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Marża</div>
                        <div className={`text-3xl font-black font-mono leading-none tracking-tighter ${marginPercent < 0 ? 'text-red-500' : 'text-zinc-800 dark:text-white'}`}>
                            <CountUp value={marginPercent} decimals={1} suffix="%" />
                        </div>
                        <div className={`text-[11px] font-mono font-bold mt-1 bg-white/80 dark:bg-zinc-900/80 px-2 py-0.5 rounded shadow-sm border border-zinc-100 dark:border-zinc-800 ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {profit > 0 ? '+' : ''}<CountUp value={profit} decimals={0} />
                        </div>
                    </>
                )
            };
        }

        // 2. Drill Down Views
        let segments: ChartSegment[] = [];
        let totalValue = 0;
        let label = '';

        if (activeCategory === 'SUPPLIERS') {
            label = 'Dostawcy';
            totalValue = costs.suppliers + costs.ormFee; // Including fee for consistency

            let breakdownTotal = 0;
            data.suppliers.forEach((s, idx) => {
                if (s.isIncluded !== false) {
                    // Calculate net cost for supplier (roughly what generates the total cost)
                    // Reusing approximate logic from calc service to split by item
                    const subtotal = s.items.reduce((sum, i) => {
                        if (i.isExcluded) return sum;
                        const p = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
                        return sum + (i.quantity * p);
                    }, 0);

                    const discounted = subtotal * (1 - s.discount / 100);
                    const withMarkup = discounted * (1 + (s.extraMarkupPercent || 0) / 100);
                    const ormFeeVal = s.isOrm ? withMarkup * (ormFee / 100) : 0;

                    const val = convert(withMarkup + ormFeeVal, s.currency, currency, rate);
                    breakdownTotal += val;

                    segments.push({
                        key: s.id,
                        value: val,
                        color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
                        label: s.customTabName || s.name,
                        isClickable: false
                    });
                }
            });
            // Adjust total to match calculated total (includes nameplate etc)
            // Add Nameplate as separate segment if exists
            if ((data.nameplateQty || 0) > 0) {
                const npVal = convert((data.nameplateQty || 0) * 19, Currency.PLN, currency, rate);
                segments.push({
                    key: 'nameplate',
                    value: npVal,
                    color: '#374151',
                    label: 'Tabliczki',
                    isClickable: false
                });
                breakdownTotal += npVal;
            }
            // Use the breakdown total for the chart 100% reference in drill down
            totalValue = breakdownTotal;

        } else if (activeCategory === 'TRANSPORT') {
            label = 'Transport';
            let breakdownTotal = 0;
            data.transport.forEach((t, idx) => {
                if (t.isExcluded) return;
                // Check linked suppliers active
                if (t.supplierId) {
                    const s = data.suppliers.find(x => x.id === t.supplierId);
                    if (s && s.isIncluded === false) return;
                }
                const val = convert(t.totalPrice, t.currency, currency, rate);
                breakdownTotal += val;
                segments.push({
                    key: t.id,
                    value: val,
                    color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
                    label: t.name || 'Transport',
                    isClickable: false
                });
            });
            totalValue = breakdownTotal;

        } else if (activeCategory === 'INSTALLATION') {
            label = 'Montaż';
            let breakdownTotal = 0;

            if (appState.mode === CalculationMode.FINAL && data.installation.finalInstallationCosts?.length) {
                // Final breakdown
                data.installation.finalInstallationCosts.forEach((item, idx) => {
                    const val = convert(item.price, item.currency, currency, rate);
                    breakdownTotal += val;
                    segments.push({
                        key: item.id,
                        value: val,
                        color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
                        label: item.description,
                        isClickable: false
                    });
                });
            } else {
                // Standard/Initial Breakdown by Stages
                data.installation.stages.forEach((stage, idx) => {
                    if (stage.isExcluded) return;
                    const stageCost = calculateStageCost(stage, data, { ignoreExclusions: false });
                    const val = convert(stageCost, Currency.PLN, currency, rate);
                    breakdownTotal += val;
                    segments.push({
                        key: stage.id,
                        value: val,
                        color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
                        label: stage.name,
                        isClickable: false
                    });
                });
                // Global Other
                if (data.installation.otherInstallationCosts > 0) {
                    const val = convert(data.installation.otherInstallationCosts, Currency.PLN, currency, rate);
                    breakdownTotal += val;
                    segments.push({
                        key: 'inst_other',
                        value: val,
                        color: '#374151',
                        label: 'Globalne / Ryczałt',
                        isClickable: false
                    });
                }
            }
            totalValue = breakdownTotal;

        } else if (activeCategory === 'OTHER') {
            label = 'Inne';
            let breakdownTotal = 0;
            data.otherCosts.forEach((c, idx) => {
                if (c.isExcluded) return;
                const val = convert(c.price, c.currency, currency, rate);
                breakdownTotal += val;
                segments.push({
                    key: c.id,
                    value: val,
                    color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
                    label: c.description,
                    isClickable: false
                });
            });
            totalValue = breakdownTotal;
        }

        // Sort large to small for better visual
        segments.sort((a, b) => b.value - a.value);

        return {
            segments,
            totalValue: totalValue > 0 ? totalValue : 1, // Avoid /0
            center: (
                <>
                    <div className="absolute top-1/4 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-y-2 group-hover:translate-y-0 duration-200">
                        <ArrowLeft size={16} className="text-zinc-400" />
                    </div>
                    <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5 mt-2">{label}</div>
                    <div className="text-xl font-bold font-mono text-zinc-800 dark:text-white">
                        <CountUp value={totalValue} decimals={0} />
                    </div>
                    <div className="text-[9px] text-zinc-400 font-mono">{currency}</div>
                </>
            )
        };
    };

    const chartData = prepareChartData();

    // --- WHAT-IF DIFFERENTIAL CALCULATION ---
    const hasExclusions = costs.excluded > 0;
    const originalTotalCost = costs.total + costs.excluded;

    let originalSellingPrice = 0;

    if (appState.manualPrice !== null) {
        originalSellingPrice = appState.manualPrice;
    } else {
        const marginDecimal = appState.targetMargin / 100;
        originalSellingPrice = marginDecimal >= 1
            ? (originalTotalCost > 0 ? originalTotalCost * 999 : 0)
            : originalTotalCost / (1 - marginDecimal);
    }

    const diffCost = costs.total - originalTotalCost;
    const diffPrice = sellingPrice - originalSellingPrice;

    // Margin Alert Colors
    const isCritical = marginPercent < 6;
    const isWarning = marginPercent < 7 && !isCritical;

    // --- PALLET SPOTS METRICS ---
    const totalPalletSpots = data.installation.stages.reduce((sum, stage) => {
        if (stage.isExcluded) return sum;
        return sum + (stage.palletSpots || 0);
    }, 0);

    const pricePerSpot = totalPalletSpots > 0 ? sellingPrice / totalPalletSpots : 0;
    const validInstallationTypes = ["UPC (Under Pallet Carrier)", "Regały rzędowe", "DriveIn (Wjezdne)", "Regały mobilne"];
    const showPalletPrice = validInstallationTypes.includes(data.meta.installationType || '');

    return (
        <div className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-widest flex items-center gap-2">
                    <PieChart size={12} /> Struktura Ceny
                </div>
                {activeCategory && (
                    <button
                        onClick={() => setActiveCategory(null)}
                        className="text-[9px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                    >
                        <RotateCcw size={10} /> Reset
                    </button>
                )}
            </div>

            {/* CHART */}
            <UnifiedDonutChart
                segments={chartData.segments}
                centerContent={hoveredSegment ? (
                    <>
                        <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5 mt-2 animate-fadeIn">{hoveredSegment.label}</div>
                        <div className="text-xl font-bold font-mono text-zinc-800 dark:text-white animate-fadeIn">
                            {formatNumber(hoveredSegment.value, 0)}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-mono animate-fadeIn">
                            {((hoveredSegment.value / chartData.totalValue) * 100).toFixed(1)}%
                        </div>
                    </>
                ) : chartData.center}
                totalValue={chartData.totalValue}
                currency={currency}
                viewKey={activeCategory || 'home'}
                onSegmentClick={(seg) => seg.id && setActiveCategory(seg.id)}
                onCenterClick={activeCategory ? () => setActiveCategory(null) : undefined}
                onSegmentHover={setHoveredSegment}
                onSegmentLeave={() => setHoveredSegment(null)}
            />

            {/* Legend / List */}
            <div key={activeCategory || 'home'} className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {!activeCategory ? (
                    // MAIN SUMMARY LEGEND
                    <>
                        <LegendItem delay={0} color={CATEGORY_COLORS.SUPPLIERS} label="Materiał" value={costs.suppliers + costs.ormFee} percent={((costs.suppliers + costs.ormFee) / chartData.totalValue) * 100} currency={currency} onClick={() => setActiveCategory('SUPPLIERS')} />
                        <LegendItem delay={50} color={CATEGORY_COLORS.TRANSPORT} label="Transport" value={costs.transport} percent={(costs.transport / chartData.totalValue) * 100} currency={currency} onClick={() => setActiveCategory('TRANSPORT')} />
                        <LegendItem delay={100} color={CATEGORY_COLORS.INSTALLATION} label="Montaż" value={costs.installation} percent={(costs.installation / chartData.totalValue) * 100} currency={currency} onClick={() => setActiveCategory('INSTALLATION')} />
                        <LegendItem delay={150} color={CATEGORY_COLORS.OTHER} label="Inne" value={costs.other} percent={(costs.other / chartData.totalValue) * 100} currency={currency} onClick={() => setActiveCategory('OTHER')} />
                        {costs.financing > 0 && (
                            <LegendItem delay={200} color={CATEGORY_COLORS.FINANCING} label="Koszty finansowania" value={costs.financing} percent={(costs.financing / chartData.totalValue) * 100} currency={currency} />
                        )}

                        {profit > 0 && (
                            <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 mt-2">
                                <LegendItem delay={250} color={CATEGORY_COLORS.MARGIN} label="Zysk (Marża)" value={profit} percent={(profit / chartData.totalValue) * 100} currency={currency} isBold />
                            </div>
                        )}
                    </>
                ) : (
                    // DRILL DOWN LIST
                    <>
                        {chartData.segments.map((seg, idx) => (
                            <LegendItem
                                key={seg.key}
                                delay={idx * 50}
                                color={seg.color}
                                label={seg.label}
                                value={seg.value}
                                percent={(seg.value / chartData.totalValue) * 100}
                                currency={currency}
                            />
                        ))}
                        {chartData.segments.length === 0 && (
                            <div className="text-center text-xs text-zinc-400 italic py-4">Brak pozycji w tej kategorii.</div>
                        )}
                    </>
                )}
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 mt-1">Koszt Całkowity</span>
                    <div className="text-right">
                        <div className="font-mono font-bold text-sm text-zinc-900 dark:text-white leading-none">
                            <CountUp value={costs.total} />
                        </div>
                        {hasExclusions && (
                            <div className="text-[10px] font-mono text-green-600 dark:text-green-400 flex items-center justify-end gap-0.5 mt-0.5" title="Oszczędność dzięki wykluczeniom">
                                {diffCost > 0 ? '+' : ''}{formatNumber(diffCost)}
                                <TrendingDown size={10} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Price Display */}
                <div className={`p-3 rounded-xl border space-y-3 shadow-sm ${isCritical ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800' : isWarning ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-[10px] uppercase font-bold mt-0.5 ${isCritical ? 'text-red-700 dark:text-red-400' : isWarning ? 'text-orange-700 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-400'}`}>Cena Sprzedaży</span>
                        <div className="text-right">
                            <div className={`font-mono font-bold text-lg leading-none ${isCritical ? 'text-red-800 dark:text-red-300' : isWarning ? 'text-orange-800 dark:text-orange-300' : 'text-zinc-900 dark:text-white'}`}>
                                <CountUp value={sellingPrice} suffix={` ${currency}`} />
                            </div>
                            {hasExclusions && Math.abs(diffPrice) > 0.01 && (
                                <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 mt-0.5 ${diffPrice < 0 ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                                    {diffPrice > 0 ? '+' : ''}{formatNumber(diffPrice)}
                                    {diffPrice < 0 && <TrendingDown size={10} />}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Price Per Pallet Spot Metric */}
                {totalPalletSpots > 0 && showPalletPrice && (
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2 flex justify-between items-center shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                <Box size={10} /> Cena / M. Pal.
                            </span>
                            <span className="text-[9px] text-zinc-400">Suma: {formatNumber(totalPalletSpots, 0)} szt.</span>
                        </div>
                        <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-sm">
                            <CountUp value={pricePerSpot} suffix={` ${currency}`} />
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Excluded Summary (What-If Base) */}
            {hasExclusions && (
                <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border-l-4 border-zinc-400 text-xs text-zinc-500 relative">
                    <div className="uppercase font-bold text-[9px] mb-1 flex items-center gap-1"><Layers size={10} /> Wykluczone (Baza What-If)</div>
                    <div className="font-mono line-through decoration-zinc-400">{formatCurrency(costs.excluded, currency)}</div>
                    <div className="text-[9px] mt-1 italic opacity-70">
                        Wartości w delcie to różnica względem pełnego zakresu.
                    </div>
                </div>
            )}
        </div>
    );
};
