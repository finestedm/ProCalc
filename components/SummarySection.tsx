
import React, { useState } from 'react';
import { CalculationData, Currency, AppState, CalculationMode, EMPTY_PAYMENT_TERMS, PaymentTerms } from '../types';
import { Calculator, RefreshCw, BrainCircuit, Loader2, ArrowLeftRight, Lock, Unlock, Globe, AlertTriangle, EyeOff, Calendar, CreditCard, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchEurRate } from '../services/currencyService';
import { generateInvoiceSummary } from '../services/aiService';
import { calculateProjectCosts } from '../services/calculationService';

interface Props {
  appState: AppState;
  onUpdateState: (updates: Partial<AppState>) => void;
  data: CalculationData;
}

export const SummarySection: React.FC<Props> = ({ appState, onUpdateState, data }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  const targetCurrency = appState.offerCurrency;
  const rate = appState.exchangeRate;

  // Use Centralized Calculation
  const costs = calculateProjectCosts(data, rate, targetCurrency, appState.mode);
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

  // Calculate VAT
  const vatRate = 0.23;
  // Net price in offer currency
  const netPrice = sellingPrice;
  // VAT is always calculated into PLN
  const vatAmountPLN = (appState.offerCurrency === Currency.EUR)
      ? (netPrice * rate) * vatRate
      : netPrice * vatRate;
  
  const grossPrice = netPrice * (1 + vatRate);


  // Settlement Value for Client in PLN if offer is EUR
  const settlementValue = appState.clientCurrency === Currency.PLN && appState.offerCurrency === Currency.EUR
    ? sellingPrice * rate
    : sellingPrice;

  // Payment Terms
  const paymentTerms = data.paymentTerms || EMPTY_PAYMENT_TERMS;
  const updatePaymentTerms = (updates: Partial<PaymentTerms>) => {
      // Need to update data state, which requires bubbling up or hacking local data update if parent doesn't expose granular updater here
      // Since `data` prop is passed down, we need to invoke onUpdateState on AppState level to update initial/final data
      const newData = { ...data, paymentTerms: { ...paymentTerms, ...updates } };
      // Helper to update correct data bucket based on mode
      const key = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
      onUpdateState({ [key]: newData });
  };


  const handleFetchRate = async () => {
    setIsRefreshing(true);
    const rate = await fetchEurRate();
    if (rate) onUpdateState({ exchangeRate: rate });
    setIsRefreshing(false);
  };

  const handleGenerateAi = async () => {
    setAiLoading(true);
    const summary = await generateInvoiceSummary(data, sellingPrice, appState.offerCurrency);
    setAiResult(summary);
    setAiLoading(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') e.currentTarget.blur();
  };

  const handleOfferCurrencyChange = (curr: Currency) => {
      const updates: Partial<AppState> = { offerCurrency: curr };
      if (curr === Currency.PLN) updates.clientCurrency = Currency.PLN;
      onUpdateState(updates);
  };
  
  const isFinalMode = appState.mode === CalculationMode.FINAL;

  // Calculate Payment Amounts
  const advance1Amount = sellingPrice * (paymentTerms.advance1Percent / 100);
  const advance2Amount = sellingPrice * (paymentTerms.advance2Percent / 100);
  const finalPercent = 100 - paymentTerms.advance1Percent - paymentTerms.advance2Percent;
  const finalAmount = sellingPrice - advance1Amount - advance2Amount;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors">
      
      {/* Header */}
      <div 
          className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg text-green-600">
                <Calculator size={20} />
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                        Podsumowanie
                    </h2>
                    {appState.manualPrice !== null && (
                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Cena Ręczna</span>
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">Kalkulacja końcowa i marża</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             {appState.manualPrice !== null && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onUpdateState({ manualPrice: null }); }}
                    className="text-xs flex items-center gap-1 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-3 py-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 transition-colors mr-2"
                >
                    <Unlock size={12}/> Odblokuj marżę
                </button>
             )}
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="p-6 pt-0 border-t border-transparent">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    
                    {/* Settings Column */}
                    <div className="space-y-4 border-r border-zinc-100 dark:border-zinc-700 pr-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Kurs Sprzedaży NBP (EUR)</label>
                        <div className="flex gap-2">
                        <input
                            type="number"
                            step="0.0001"
                            value={appState.exchangeRate}
                            onChange={(e) => onUpdateState({ exchangeRate: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border border-zinc-200 dark:border-zinc-600 rounded-xl bg-zinc-50 dark:bg-zinc-700 font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none text-sm"
                        />
                        <button 
                            onClick={handleFetchRate} 
                            className="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-3 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600"
                            title="Pobierz kurs NBP"
                        >
                            <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
                        </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                            Marża (%) {appState.manualPrice !== null && <span className="text-zinc-800 dark:text-zinc-200 normal-case">(Wynikowa)</span>}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.1"
                                value={parseFloat(marginPercent.toFixed(2))}
                                onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                                className={`w-full p-3 border rounded-xl font-bold outline-none text-sm ${
                                    appState.manualPrice !== null 
                                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-600' 
                                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
                                }`}
                            />
                            {appState.manualPrice !== null && (
                                <Lock size={14} className="absolute right-3 top-3.5 text-zinc-400 opacity-50"/>
                            )}
                        </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Globe size={12}/> Waluta Oferty (Globalna)
                        </label>
                        <div className={`flex bg-zinc-100 dark:bg-zinc-700 p-1 rounded-xl mb-2 ${isFinalMode ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            <button 
                                onClick={() => !isFinalMode && handleOfferCurrencyChange(Currency.PLN)}
                                disabled={isFinalMode}
                                className={`flex-1 py-1.5 text-sm rounded-lg transition-all ${
                                    appState.offerCurrency === Currency.PLN 
                                    ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white font-bold' 
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                PLN
                            </button>
                            <button 
                                onClick={() => !isFinalMode && handleOfferCurrencyChange(Currency.EUR)}
                                disabled={isFinalMode}
                                className={`flex-1 py-1.5 text-sm rounded-lg transition-all ${
                                    appState.offerCurrency === Currency.EUR 
                                    ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white font-bold' 
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                EUR
                            </button>
                        </div>
                        {isFinalMode && <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1"><Lock size={10}/> Zmiana waluty zablokowana w trybie końcowym</div>}

                        {appState.offerCurrency === Currency.EUR && (
                            <div className="animate-fadeIn mt-4">
                                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                    Waluta Rozliczenia (Faktura)
                                </label>
                                <div className={`flex bg-zinc-100 dark:bg-zinc-700 p-1 rounded-xl ${isFinalMode ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                    <button 
                                        onClick={() => !isFinalMode && onUpdateState({ clientCurrency: Currency.PLN })}
                                        disabled={isFinalMode}
                                        className={`flex-1 py-1.5 text-sm rounded-lg transition-all ${
                                            appState.clientCurrency === Currency.PLN 
                                            ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white font-bold' 
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        PLN
                                    </button>
                                    <button 
                                        onClick={() => !isFinalMode && onUpdateState({ clientCurrency: Currency.EUR })}
                                        disabled={isFinalMode}
                                        className={`flex-1 py-1.5 text-sm rounded-lg transition-all ${
                                            appState.clientCurrency === Currency.EUR 
                                            ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white font-bold' 
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        EUR
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    </div>

                    {/* Calculation Details */}
                    <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300 border-r border-zinc-100 dark:border-zinc-700 pr-4">
                        <div className="flex justify-between py-1"><span>Materiał ({targetCurrency}):</span><span className="font-mono">{costs.suppliers.toFixed(2)}</span></div>
                        <div className="flex justify-between py-1"><span>Transport ({targetCurrency}):</span><span className="font-mono">{costs.transport.toFixed(2)}</span></div>
                        <div className="flex justify-between py-1"><span>Inne ({targetCurrency}):</span><span className="font-mono">{costs.other.toFixed(2)}</span></div>
                        <div className="flex justify-between py-1"><span>Montaż ({targetCurrency}):</span><span className="font-mono">{costs.installation.toFixed(2)}</span></div>
                        
                        {/* Display ORM Fee separately */}
                        {costs.ormFee > 0 && (
                            <div className="flex justify-between py-1 text-pink-600 dark:text-pink-400">
                                <span>Opłata ORM ({targetCurrency}):</span>
                                <span className="font-mono font-semibold">{costs.ormFee.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Excluded Items (What-If) Summary */}
                        {costs.excluded > 0 && (
                            <div className="flex justify-between text-zinc-400 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-2 mt-2 italic text-xs">
                                <span className="flex items-center gap-1"><EyeOff size={10}/> Wyłączone elementy:</span>
                                <span className="font-mono line-through">{costs.excluded.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-zinc-800 dark:text-zinc-100 pt-4 border-t border-zinc-100 dark:border-zinc-700 mt-4 text-base">
                            <span>Koszt Całkowity:</span><span className="font-mono">{totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400 pt-2">
                            <span>Zysk ({targetCurrency}):</span><span className="font-mono font-bold">+{profit.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Final Price */}
                    <div className={`flex flex-col justify-center items-center rounded-2xl p-6 text-center transition-colors ${
                        appState.manualPrice !== null 
                        ? 'bg-zinc-100 dark:bg-zinc-700' 
                        : 'bg-yellow-50 dark:bg-yellow-900/10'
                    }`}>
                        <h3 className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-bold tracking-wider mb-4">Cena Ofertowa (Netto)</h3>
                        
                        <div className="relative w-full max-w-[200px]">
                            <input 
                                type="number" 
                                step="0.01" 
                                className={`w-full text-center text-3xl font-bold font-mono bg-transparent border-b-2 outline-none pb-2 transition-colors ${
                                    appState.manualPrice !== null 
                                    ? 'text-zinc-900 dark:text-white border-zinc-400 dark:border-zinc-500 focus:border-zinc-900 dark:focus:border-white' 
                                    : 'text-yellow-600 dark:text-yellow-400 border-yellow-400 dark:border-yellow-600 focus:border-yellow-600 dark:focus:border-yellow-400'
                                }`}
                                value={isEditingPrice ? tempPrice : parseFloat(sellingPrice.toFixed(2))}
                                onChange={(e) => setTempPrice(e.target.value)}
                                onFocus={handlePriceFocus}
                                onBlur={handleFinalPriceBlur}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div className="text-xs text-zinc-400 mt-3 flex flex-col items-center gap-1 justify-center mb-6">
                            <span className="flex items-center gap-1 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full">
                                <ArrowLeftRight size={10}/> 
                                {appState.manualPrice !== null ? 'Tryb Ceny Ręcznej' : 'Tryb Marży'} | Waluta: {appState.offerCurrency}
                            </span>
                        </div>

                        {/* VAT and Gross Breakdown */}
                        <div className="w-full text-sm border-t border-zinc-200/50 dark:border-zinc-600 pt-4 space-y-3">
                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                                <span>VAT 23% (PLN):</span>
                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{vatAmountPLN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN</span>
                            </div>
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-zinc-500 uppercase text-xs">Brutto ({appState.offerCurrency}):</span>
                                <span className="font-mono text-zinc-900 dark:text-white">{grossPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appState.offerCurrency}</span>
                            </div>
                        </div>

                        {appState.offerCurrency === Currency.EUR && appState.clientCurrency === Currency.PLN && (
                            <div className="mt-4 pt-4 border-t w-full border-zinc-300 dark:border-zinc-600">
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold mb-1">Całkowita wartość (PLN)</div>
                                <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-mono">
                                    {settlementValue.toFixed(2)} PLN <span className="text-sm font-normal text-zinc-400">(Netto)</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Terms Section */}
                <div className="border-t border-zinc-100 dark:border-zinc-700 pt-6 mb-6 mt-8">
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-4 flex items-center gap-2">
                        <CreditCard size={16} className="text-yellow-500"/> Warunki Płatności
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Advance 1 */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-zinc-500">Zaliczka 1 (%)</span>
                                <input 
                                    type="number" min="0" max="100" 
                                    className="w-16 p-1 text-center border rounded-lg text-sm bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400"
                                    value={paymentTerms.advance1Percent}
                                    onChange={(e) => updatePaymentTerms({ advance1Percent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg mb-3">
                                {advance1Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appState.offerCurrency}
                            </div>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-2.5 text-zinc-400" size={12}/>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        className="w-full pl-8 p-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-xs bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400"
                                        value={paymentTerms.advance1Days}
                                        onChange={(e) => updatePaymentTerms({ advance1Days: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-xs text-zinc-400 font-medium">dni</span>
                                </div>
                            </div>
                        </div>

                        {/* Advance 2 */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-zinc-500">Zaliczka 2 (%)</span>
                                <input 
                                    type="number" min="0" max="100" 
                                    className="w-16 p-1 text-center border rounded-lg text-sm bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400"
                                    value={paymentTerms.advance2Percent}
                                    onChange={(e) => updatePaymentTerms({ advance2Percent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg mb-3">
                                {advance2Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appState.offerCurrency}
                            </div>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-2.5 text-zinc-400" size={12}/>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        className="w-full pl-8 p-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-xs bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400"
                                        value={paymentTerms.advance2Days}
                                        onChange={(e) => updatePaymentTerms({ advance2Days: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-xs text-zinc-400 font-medium">dni</span>
                                </div>
                            </div>
                        </div>

                        {/* Final Payment */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-yellow-800 dark:text-yellow-500">Faktura Końcowa</span>
                                <span className="text-sm font-bold bg-white dark:bg-zinc-800 px-3 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-900/50">{finalPercent.toFixed(0)}%</span>
                            </div>
                            <div className="font-mono font-bold text-zinc-900 dark:text-white text-lg mb-3">
                                {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appState.offerCurrency}
                            </div>
                            <div className="relative">
                                <Clock className="absolute left-2.5 top-2.5 text-zinc-400" size={12}/>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        className="w-full pl-8 p-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-xs bg-white dark:bg-zinc-800 outline-none focus:border-yellow-400"
                                        value={paymentTerms.finalPaymentDays}
                                        onChange={(e) => updatePaymentTerms({ finalPaymentDays: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-xs text-zinc-400 font-medium">dni</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="mt-6 border-t border-zinc-100 dark:border-zinc-700 pt-4">
                    <button 
                        onClick={handleGenerateAi}
                        disabled={aiLoading}
                        className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium text-sm disabled:opacity-50 transition-colors"
                    >
                        {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
                        Generuj opis faktury i notatkę (AI)
                    </button>
                    {aiResult && (
                        <div className="mt-4 bg-zinc-50 dark:bg-zinc-700/50 p-4 rounded-xl text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line border border-zinc-200 dark:border-zinc-600">
                            {aiResult}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
