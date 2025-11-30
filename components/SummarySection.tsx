
import React, { useState } from 'react';
import { CalculationData, Currency, AppState, CalculationMode, EMPTY_PAYMENT_TERMS, PaymentTerms } from '../types';
import { RefreshCw, Unlock, DollarSign, ToggleLeft, ToggleRight, AlertTriangle, AlertOctagon } from 'lucide-react';
import { fetchEurRate } from '../services/currencyService';
import { calculateProjectCosts, formatCurrency, formatNumber } from '../services/calculationService';

interface Props {
  appState: AppState;
  onUpdateState: (updates: Partial<AppState>) => void;
  data: CalculationData;
}

export const SummarySection: React.FC<Props> = ({ appState, onUpdateState, data }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tempPrice, setTempPrice] = useState("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  // Specific override toggle for invoice currency payment
  const [paymentInPln, setPaymentInPln] = useState(false);

  const targetCurrency = appState.offerCurrency;
  const rate = appState.exchangeRate;
  const ormFee = appState.globalSettings.ormFeePercent;

  const costs = calculateProjectCosts(data, rate, targetCurrency, appState.mode, ormFee);
  const totalCost = costs.total;
  
  let sellingPrice = 0; 
  let marginPercent = 0;
  let profit = 0;

  if (appState.manualPrice !== null) {
      sellingPrice = appState.manualPrice;
      if (sellingPrice !== 0) {
          marginPercent = (1 - (totalCost / sellingPrice)) * 100;
      }
      profit = sellingPrice - totalCost;
  } else {
      marginPercent = appState.targetMargin;
      const marginDecimal = marginPercent / 100;
      sellingPrice = marginDecimal >= 1 
        ? (totalCost > 0 ? totalCost * 999 : 0) 
        : totalCost / (1 - marginDecimal);
      
      profit = sellingPrice - totalCost;
  }

  // Margin Warning Logic
  const isCriticalMargin = marginPercent < 6;
  const isWarningMargin = marginPercent < 7 && !isCriticalMargin;
  
  const marginColorClass = isCriticalMargin 
    ? 'text-red-600 dark:text-red-500' 
    : isWarningMargin 
        ? 'text-orange-500' 
        : 'text-amber-500';

  // Display Logic
  const vatRate = 0.23;
  // const netPrice = sellingPrice; // Unused
  // const grossPrice = netPrice * (1 + vatRate); // Removed in favor of explicit VAT display

  // Calculated Payment in PLN if applicable
  const showPlnPayment = targetCurrency === Currency.EUR && paymentInPln;
  const paymentPlnNet = sellingPrice * rate;

  // Calculate VAT in PLN specifically
  // If currency is EUR, convert selling price to PLN first
  // If currency is PLN, use selling price directly
  const baseForVatPLN = targetCurrency === Currency.EUR ? (sellingPrice * rate) : sellingPrice;
  const vatValuePLN = baseForVatPLN * vatRate;

  const paymentTerms = data.paymentTerms || EMPTY_PAYMENT_TERMS;
  const updatePaymentTerms = (updates: Partial<PaymentTerms>) => {
      const newData = { ...data, paymentTerms: { ...paymentTerms, ...updates } };
      const key = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
      onUpdateState({ [key]: newData });
  };

  const handleFetchRate = async () => {
    setIsRefreshing(true);
    const rate = await fetchEurRate();
    if (rate) onUpdateState({ exchangeRate: rate });
    setIsRefreshing(false);
  };

  const handleFinalPriceBlur = () => {
      setIsEditingPrice(false);
      const newPrice = parseFloat(tempPrice);
      if (!isNaN(newPrice)) onUpdateState({ manualPrice: newPrice });
  };

  const handleMarginChange = (newMargin: number) => {
      onUpdateState({ targetMargin: newMargin, manualPrice: null });
  };

  const handlePriceFocus = () => {
      setIsEditingPrice(true);
      setTempPrice(sellingPrice.toFixed(2));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
  };

  const isFinalMode = appState.mode === CalculationMode.FINAL;

  const advance1Amount = sellingPrice * (paymentTerms.advance1Percent / 100);
  const advance2Amount = sellingPrice * (paymentTerms.advance2Percent / 100);
  const finalPercent = 100 - paymentTerms.advance1Percent - paymentTerms.advance2Percent;
  const finalAmount = sellingPrice - advance1Amount - advance2Amount;

  return (
    <div className="animate-slideUp">
      <h2 className="text-xs font-mono font-bold uppercase text-zinc-500 mb-4 tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
          Panel Finansowy
      </h2>

      {/* Main Dashboard Grid - Layout Refactored */}
      <div className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-sm overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-4">
          
          {/* LEFT COLUMN GROUP (Metrics + Payment Terms) - Spans 3 columns */}
          <div className="lg:col-span-3 flex flex-col">
              
              {/* TOP ROW: 3 Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800 h-auto md:h-32">
                  
                  {/* 1. Cost Base */}
                  <div className="p-6 flex flex-col justify-between relative group">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Baza Kosztowa</span>
                      <div className="text-2xl font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {formatNumber(totalCost)} <span className="text-sm text-zinc-400">{targetCurrency}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 mt-2 overflow-hidden rounded-full">
                          <div className="h-full bg-zinc-300 dark:bg-zinc-600 w-full opacity-50"></div>
                      </div>
                  </div>

                  {/* 2. Margin Control */}
                  <div className={`p-6 flex flex-col justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors relative ${isCriticalMargin ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                      <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Marża Celowana</span>
                          {appState.manualPrice !== null && (
                              <button 
                                type="button"
                                className="text-amber-500 cursor-pointer" 
                                onClick={() => onUpdateState({ manualPrice: null })} 
                                title="Odblokuj Marżę"
                              >
                                <Unlock size={12} />
                              </button>
                          )}
                      </div>
                      <div className="flex items-baseline gap-1">
                          <input
                              type="number"
                              step="0.1"
                              value={parseFloat(marginPercent.toFixed(2))}
                              onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                              className={`bg-transparent text-4xl font-mono font-bold outline-none w-32 placeholder-zinc-300 ${marginColorClass}`}
                          />
                          <span className="text-zinc-400 font-mono text-xl">%</span>
                      </div>
                  </div>

                  {/* 3. Exchange Rate & Toggle */}
                  <div className="p-6 flex flex-col justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <div className="flex justify-between">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Kurs EUR/PLN</span>
                          <button onClick={handleFetchRate} className={`text-zinc-400 hover:text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={12}/></button>
                      </div>
                      <div className="flex items-baseline gap-2">
                          <input
                              type="number"
                              step="0.0001"
                              value={appState.exchangeRate}
                              onChange={(e) => onUpdateState({ exchangeRate: parseFloat(e.target.value) || 0 })}
                              className="bg-transparent text-2xl font-mono font-bold text-zinc-700 dark:text-zinc-300 outline-none w-24 border-b border-zinc-200 dark:border-zinc-700 focus:border-amber-500 transition-colors"
                          />
                      </div>
                      
                      {/* Currency Toggle */}
                      <div className="flex justify-between items-center mt-1">
                          <div className="flex gap-1">
                                {Object.values(Currency).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => !isFinalMode && onUpdateState({ offerCurrency: c, clientCurrency: c === Currency.PLN ? Currency.PLN : appState.clientCurrency })}
                                        disabled={isFinalMode}
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${appState.offerCurrency === c ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-black dark:border-zinc-100' : 'text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                          </div>
                          
                          {/* Payment PLN Toggle */}
                          {appState.offerCurrency === Currency.EUR && (
                              <div 
                                className="flex items-center gap-1 cursor-pointer group"
                                onClick={() => setPaymentInPln(!paymentInPln)}
                              >
                                  <span className={`text-[9px] font-bold ${paymentInPln ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400 group-hover:text-zinc-600'}`}>Płatność PLN</span>
                                  {paymentInPln ? <ToggleRight size={16} className="text-amber-500"/> : <ToggleLeft size={16} className="text-zinc-300 group-hover:text-zinc-400"/>}
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* BOTTOM ROW: Payment Terms (Stretches to fill remaining height on left) */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/30 flex-1 flex items-center">
                  <div className="flex items-center gap-6 w-full">
                      <div className="text-[10px] font-mono text-zinc-400 uppercase w-24 shrink-0 text-right pr-4 border-r border-zinc-200 dark:border-zinc-800 self-stretch flex items-center justify-end">Warunki<br/>Płatności</div>
                      
                      <div className="flex gap-4 min-w-[300px] flex-1">
                          {/* Advance 1 */}
                          <div className="flex-1 bg-white dark:bg-zinc-800 p-2 rounded-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                                  <span>Zaliczka 1</span>
                                  <div className="flex items-center">
                                      <input 
                                          type="number" 
                                          min="0"
                                          value={paymentTerms.advance1Days} 
                                          onChange={(e) => updatePaymentTerms({ advance1Days: parseInt(e.target.value) || 0 })} 
                                          className="w-8 bg-transparent text-right outline-none text-zinc-500 focus:text-amber-500 transition-colors"
                                      />
                                      <span className="ml-1 text-zinc-400">dni</span>
                                  </div>
                              </div>
                              <div className="flex items-center gap-1">
                                  <input type="number" value={paymentTerms.advance1Percent} onChange={(e) => updatePaymentTerms({ advance1Percent: parseFloat(e.target.value) })} className="w-12 bg-transparent text-amber-500 font-mono font-bold text-sm text-center outline-none border-b border-zinc-200 focus:border-amber-500"/>
                                  <span className="text-zinc-400">%</span>
                              </div>
                              <div className="text-[10px] text-zinc-600 dark:text-zinc-300 font-mono mt-1 text-right">{formatNumber(advance1Amount, 0)}</div>
                          </div>
                          
                          {/* Advance 2 */}
                          <div className="flex-1 bg-white dark:bg-zinc-800 p-2 rounded-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                                  <span>Zaliczka 2</span>
                                  <div className="flex items-center">
                                      <input 
                                          type="number" 
                                          min="0"
                                          value={paymentTerms.advance2Days} 
                                          onChange={(e) => updatePaymentTerms({ advance2Days: parseInt(e.target.value) || 0 })} 
                                          className="w-8 bg-transparent text-right outline-none text-zinc-500 focus:text-amber-500 transition-colors"
                                      />
                                      <span className="ml-1 text-zinc-400">dni</span>
                                  </div>
                              </div>
                              <div className="flex items-center gap-1">
                                  <input type="number" value={paymentTerms.advance2Percent} onChange={(e) => updatePaymentTerms({ advance2Percent: parseFloat(e.target.value) })} className="w-12 bg-transparent text-amber-500 font-mono font-bold text-sm text-center outline-none border-b border-zinc-200 focus:border-amber-500"/>
                                  <span className="text-zinc-400">%</span>
                              </div>
                              <div className="text-[10px] text-zinc-600 dark:text-zinc-300 font-mono mt-1 text-right">{formatNumber(advance2Amount, 0)}</div>
                          </div>

                          {/* Final Payment */}
                          <div className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 rounded-sm relative shadow-sm">
                              <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                                  <span>Końcowa</span>
                                  <div className="flex items-center">
                                      <input 
                                          type="number" 
                                          min="0"
                                          value={paymentTerms.finalPaymentDays} 
                                          onChange={(e) => updatePaymentTerms({ finalPaymentDays: parseInt(e.target.value) || 0 })} 
                                          className="w-8 bg-transparent text-right outline-none text-zinc-500 focus:text-amber-500 transition-colors"
                                      />
                                      <span className="ml-1">dni</span>
                                  </div>
                              </div>
                              <div className="font-mono font-bold text-sm text-center py-0.5 text-zinc-900 dark:text-white">{finalPercent}%</div>
                              <div className="text-[10px] text-zinc-600 dark:text-zinc-300 font-mono mt-1 text-right">{formatNumber(finalAmount, 0)}</div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN (Final Price) - Spans 1 column, Full Height */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 relative bg-zinc-50 dark:bg-zinc-900/50">
              <div className="absolute top-0 right-0 p-2 opacity-5 text-zinc-900 dark:text-white">
                  <DollarSign size={96} />
              </div>
              
              {/* Main Price Box - Centered Vertically */}
              <div className="flex flex-col justify-center h-full p-6 z-10 relative">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2 flex justify-between">
                      Cena Sprzedaży (Netto)
                  </span>
                  <div className="flex flex-col items-start gap-1 mb-2">
                      {isEditingPrice ? (
                          <input 
                              type="number" 
                              className="bg-transparent text-4xl font-mono font-bold text-amber-500 outline-none w-full border-b border-transparent focus:border-amber-500 transition-colors"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              onBlur={handleFinalPriceBlur}
                              onKeyDown={handleKeyDown}
                              autoFocus
                          />
                      ) : (
                          <div 
                              className="text-4xl font-mono font-bold text-zinc-900 dark:text-white w-full cursor-text hover:text-amber-600 dark:hover:text-amber-400 transition-colors break-words"
                              onClick={handlePriceFocus}
                          >
                              {formatNumber(sellingPrice)}
                          </div>
                      )}
                      <span className="text-zinc-400 font-mono text-xl">{targetCurrency}</span>
                  </div>
                  
                  {/* Detailed Breakdown */}
                  <div className="mt-4 w-full space-y-2">
                      {/* WARNING BLOCKS */}
                      {isCriticalMargin && (
                          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2 rounded-sm flex items-center gap-2 text-red-700 dark:text-red-400 animate-pulse">
                              <AlertOctagon size={16} className="shrink-0"/>
                              <span className="text-[10px] font-bold uppercase leading-tight">Poziom Krytyczny!<br/>Marża poniżej 6%</span>
                          </div>
                      )}
                      {isWarningMargin && (
                          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-2 rounded-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                              <AlertTriangle size={16} className="shrink-0"/>
                              <span className="text-[10px] font-bold uppercase">Uwaga: Marża poniżej 7%</span>
                          </div>
                      )}

                      {/* Conditional PLN Payment Row - Only for EUR */}
                      {showPlnPayment && (
                          <div className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 flex justify-between items-center animate-fadeIn">
                              <span className="uppercase tracking-wide opacity-80">Wartość PLN (Netto):</span>
                              <span>{formatCurrency(paymentPlnNet, 'PLN')}</span>
                          </div>
                      )}

                      {/* Profit & VAT - Always Visible */}
                      <div className="flex flex-col gap-1 pt-2 border-t border-zinc-200 dark:border-zinc-800 w-full">
                          <div className="flex justify-between items-center text-[10px] text-zinc-500">
                              <span>Zysk:</span>
                              <span className="text-green-600 dark:text-green-400 font-bold">+{formatCurrency(profit, targetCurrency)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-500">
                              <span>+VAT 23%:</span>
                              <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatCurrency(vatValuePLN, 'PLN')}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
