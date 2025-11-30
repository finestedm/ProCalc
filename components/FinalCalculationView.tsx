
import React, { useState, useEffect } from 'react';
import { CalculationData, Currency, Supplier, TransportItem, OtherCostItem, InstallationData, FinalInstallationItem, SupplierStatus, Language, CalculationMode } from '../types';
import { FileText, Truck, Wrench, Receipt, Plus, Trash2, AlertCircle, ArrowRight, DollarSign, TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Printer } from 'lucide-react';
import { convert, formatCurrency, formatNumber, calculateProjectCosts } from '../services/calculationService';

interface Props {
    data: CalculationData; // This is the 'Final' state
    initialData: CalculationData; // This is the 'Initial' state (Plan)
    onChange: (data: CalculationData) => void;
    exchangeRate: number;
    offerCurrency: Currency;
    // New Props for Footer Summary
    manualPrice: number | null;
    targetMargin: number;
    onUpdateState: (updates: { manualPrice?: number | null, targetMargin?: number }) => void;
}

export const FinalCalculationView: React.FC<Props> = ({ 
    data, 
    initialData, 
    onChange, 
    exchangeRate, 
    offerCurrency,
    manualPrice,
    targetMargin,
    onUpdateState
}) => {
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [localPriceInput, setLocalPriceInput] = useState('');

    // --- Print Theme Logic ---
    useEffect(() => {
        const handleBeforePrint = () => {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                document.documentElement.dataset.wasDark = 'true';
            }
        };

        const handleAfterPrint = () => {
            if (document.documentElement.dataset.wasDark === 'true') {
                document.documentElement.classList.add('dark');
                delete document.documentElement.dataset.wasDark;
            }
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    // --- Actions --- (Same logic as before, just styling update)

    const updateSupplierOverride = (id: string, updates: Partial<Supplier>) => {
        const existingInFinal = data.suppliers.find(s => s.id === id);
        let newSuppliers = [...data.suppliers];

        if (existingInFinal) {
            newSuppliers = newSuppliers.map(s => s.id === id ? { ...s, ...updates } : s);
        } else {
            const source = initialData.suppliers.find(s => s.id === id);
            if (source) {
                const clone = JSON.parse(JSON.stringify(source));
                Object.assign(clone, updates);
                newSuppliers.push(clone);
            }
        }
        onChange({ ...data, suppliers: newSuppliers });
    };

    const addManualSupplier = () => {
        const newSupplier: Supplier = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Nowy Dostawca',
            offerNumber: '',
            offerDate: '',
            deliveryDate: '',
            currency: Currency.PLN,
            discount: 0,
            language: Language.PL,
            items: [],
            isOrm: false,
            status: SupplierStatus.TO_ORDER,
            isIncluded: true,
            isManualFinal: true,
            finalCostOverride: 0,
            finalVendorName: ''
        };
        onChange({ ...data, suppliers: [...data.suppliers, newSupplier] });
    };

    const removeManualSupplier = (id: string) => {
        onChange({ ...data, suppliers: data.suppliers.filter(s => s.id !== id) });
    };

    const updateTransportOverride = (id: string, updates: Partial<TransportItem>) => {
        const existingInFinal = data.transport.find(t => t.id === id);
        let newTransport = [...data.transport];

        if (existingInFinal) {
            newTransport = newTransport.map(t => t.id === id ? { ...t, ...updates } : t);
        } else {
            const source = initialData.transport.find(t => t.id === id);
            if (source) {
                const clone = JSON.parse(JSON.stringify(source));
                Object.assign(clone, updates);
                newTransport.push(clone);
            }
        }
        onChange({ ...data, transport: newTransport });
    };

    const addManualTransport = () => {
        const newItem: TransportItem = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Dodatkowy Transport',
            isOrmCalc: false,
            isSupplierOrganized: false,
            trucksCount: 1,
            pricePerTruck: 0,
            totalPrice: 0,
            currency: Currency.PLN,
            finalCostOverride: 0, 
            finalCurrency: Currency.PLN,
            isManualOverride: true
        };
        onChange({ ...data, transport: [...data.transport, newItem] });
    };

    const removeManualTransport = (id: string) => {
        onChange({ ...data, transport: data.transport.filter(t => t.id !== id) });
    };

    const updateOtherCostOverride = (id: string, updates: Partial<OtherCostItem>) => {
        const existingInFinal = data.otherCosts.find(c => c.id === id);
        let newCosts = [...data.otherCosts];

        if (existingInFinal) {
            newCosts = newCosts.map(c => c.id === id ? { ...c, ...updates } : c);
        } else {
            const source = initialData.otherCosts.find(c => c.id === id);
            if (source) {
                const clone = JSON.parse(JSON.stringify(source));
                Object.assign(clone, updates);
                newCosts.push(clone);
            }
        }
        onChange({ ...data, otherCosts: newCosts });
    };

    const addManualOtherCost = () => {
        const newItem: OtherCostItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: 'Dodatkowy Koszt',
            price: 0,
            currency: Currency.PLN,
            finalCostOverride: 0,
            finalCurrency: Currency.PLN
        };
        onChange({ ...data, otherCosts: [...data.otherCosts, newItem] });
    };

    const removeManualOtherCost = (id: string) => {
        onChange({ ...data, otherCosts: data.otherCosts.filter(c => c.id !== id) });
    };

    // --- INSTALLATION SPLIT LOGIC ---
    const addFinalInstallationItem = (category: 'LABOR' | 'RENTAL') => {
        const newItem: FinalInstallationItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: category === 'LABOR' ? 'Usługa montażu' : 'Wynajem podnośnika',
            price: 0,
            currency: Currency.PLN,
            vendorName: '',
            category
        };
        const currentList = data.installation.finalInstallationCosts || [];
        onChange({ 
            ...data, 
            installation: { 
                ...data.installation, 
                finalInstallationCosts: [...currentList, newItem] 
            } 
        });
    };

    const updateFinalInstallationItem = (id: string, field: keyof FinalInstallationItem, value: any) => {
        const currentList = data.installation.finalInstallationCosts || [];
        const updated = currentList.map(i => i.id === id ? { ...i, [field]: value } : i);
        onChange({ 
            ...data, 
            installation: { ...data.installation, finalInstallationCosts: updated } 
        });
    };

    const removeFinalInstallationItem = (id: string) => {
        const currentList = data.installation.finalInstallationCosts || [];
        onChange({ 
            ...data, 
            installation: { ...data.installation, finalInstallationCosts: currentList.filter(i => i.id !== id) } 
        });
    };


    // --- Helpers for Display Values ---

    const getEstimatedSupplierCost = (s: Supplier) => {
        const subtotal = s.items.reduce((sum, i) => sum + (i.quantity * (s.isOrm ? i.unitPrice * 0.5 : i.unitPrice)), 0);
        return subtotal * (1 - s.discount / 100);
    };

    const getEstimatedTransportCost = (t: TransportItem) => t.totalPrice;

    // Splits initial estimates into Labor vs Rental
    const getEstimatedInstallationSplit = () => {
        const i = initialData.installation;
        const custom = i.customItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        
        const labor = (i.palletSpots * i.palletSpotPrice) + i.otherInstallationCosts + custom;
        const rental = 
            ((i.forkliftDailyRate * i.forkliftDays) + i.forkliftTransportPrice) +
            ((i.scissorLiftDailyRate * i.scissorLiftDays) + i.scissorLiftTransportPrice);

        return { labor, rental };
    };

    // --- Data Prep ---
    const allSupplierIds = Array.from(new Set([...initialData.suppliers.map(s => s.id), ...data.suppliers.map(s => s.id)]));
    const allTransportIds = Array.from(new Set([...initialData.transport.map(t => t.id), ...data.transport.map(t => t.id)]));
    const allOtherIds = Array.from(new Set([...initialData.otherCosts.map(c => c.id), ...data.otherCosts.map(c => c.id)]));
    
    // Installation Items
    const finalInstItems = data.installation.finalInstallationCosts || [];
    const finalLaborItems = finalInstItems.filter(i => i.category === 'LABOR');
    const finalRentalItems = finalInstItems.filter(i => i.category === 'RENTAL');

    // Calculations for Summary
    const finalCosts = calculateProjectCosts(data, exchangeRate, offerCurrency, CalculationMode.FINAL);
    const totalFinalCost = finalCosts.total;

    // Calculate Initial Price to use as default (Copy from Initial Calculation)
    const initialCosts = calculateProjectCosts(initialData, exchangeRate, offerCurrency, CalculationMode.INITIAL);
    const initialMarginDecimal = targetMargin / 100;
    const initialPrice = initialMarginDecimal >= 1 ? 0 : initialCosts.total / (1 - initialMarginDecimal);

    // Selling Price & Margin
    // Defaults to Initial Price if no manual price is set, instead of recalculating based on Final Costs
    const sellingPrice = manualPrice !== null 
        ? manualPrice 
        : initialPrice;

    const actualMargin = sellingPrice > 0 ? (1 - (totalFinalCost / sellingPrice)) * 100 : 0;
    const profit = sellingPrice - totalFinalCost;

    // Margin Alert Logic
    const isCritical = actualMargin < 6;
    const isWarning = actualMargin < 7 && !isCritical;
    const marginColor = isCritical 
        ? 'text-red-600 dark:text-red-500' 
        : isWarning 
            ? 'text-orange-500' 
            : (actualMargin < targetMargin ? 'text-yellow-500' : 'text-green-600');

    const handlePriceFocus = () => {
        setIsEditingPrice(true);
        setLocalPriceInput(sellingPrice ? sellingPrice.toFixed(2) : '');
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalPriceInput(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            onUpdateState({ manualPrice: num });
        }
    };

    const handlePriceBlur = () => {
        setIsEditingPrice(false);
    };

    const handlePrint = () => {
        window.print();
    };

    // Style constants
    const headerClass = "p-2 border-b dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase text-xs tracking-wider sticky top-0 z-10";
    const headerCyanClass = "p-2 border-b dark:border-zinc-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400 font-bold uppercase text-xs tracking-wider sticky top-0 z-10 border-l border-cyan-100 dark:border-cyan-800";
    
    const sectionHeaderClass = "p-2 font-bold text-xs uppercase text-zinc-800 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-700/50 pl-4 border-y dark:border-zinc-600";
    const cellClass = "p-2 border-b dark:border-zinc-800/50 text-sm align-top";
    const cellCyanClass = "p-2 border-b border-cyan-50 dark:border-cyan-900/20 bg-cyan-50/20 dark:bg-cyan-900/10 text-sm align-top border-l border-cyan-100 dark:border-zinc-800";
    
    const inputClass = "w-full p-1.5 border border-cyan-200 dark:border-cyan-800 rounded-sm text-right bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-cyan-500 outline-none font-bold text-zinc-900 dark:text-white text-sm";
    const textInputClass = "w-full p-1.5 bg-transparent border-b border-transparent focus:border-cyan-400 outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400";
    const selectClass = "w-full p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 rounded-sm text-xs outline-none focus:border-cyan-400 dark:border-zinc-700";

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-sm text-green-700 dark:text-green-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Rozliczenie Końcowe</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Wprowadź faktyczne koszty z faktur</p>
                        </div>
                    </div>
                    <button 
                        onClick={handlePrint}
                        className="bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600 px-3 py-2 rounded-sm flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                    >
                        <Printer size={16}/> Drukuj
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[900px]">
                        <thead>
                            <tr>
                                <th className={`${headerClass} text-left w-1/4`}>Pozycja (Plan)</th>
                                <th className={`${headerClass} text-right w-32`}>Szacunek</th>
                                
                                {/* Reality Section */}
                                <th className={`${headerCyanClass} text-left w-1/5`}><div className="flex items-center gap-1">Faktura (Dostawca) <ArrowRight size={10}/></div></th>
                                <th className={`${headerCyanClass} text-right w-32`}>Kwota Netto</th>
                                <th className={`${headerCyanClass} text-center w-20`}>Waluta</th>
                                
                                <th className={`${headerClass} text-right w-24 border-l border-zinc-200 dark:border-zinc-700`}>Różnica</th>
                                <th className={`${headerClass} w-10`}></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-950">
                            
                            {/* SUPPLIERS */}
                            <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Dostawcy (Materiał)</span>
                                        <button onClick={addManualSupplier} className="text-[10px] bg-white dark:bg-zinc-600 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-zinc-300 dark:border-zinc-500">
                                            <Plus size={12}/> Dodaj
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {allSupplierIds.map(id => {
                                const initialS = initialData.suppliers.find(s => s.id === id);
                                const finalS = data.suppliers.find(s => s.id === id);
                                const displayS = initialS || finalS;
                                
                                if (!displayS || displayS.isIncluded === false) return null;

                                const estimated = initialS ? getEstimatedSupplierCost(initialS) : 0;
                                const finalOverride = finalS?.finalCostOverride;
                                const valToShow = finalOverride !== undefined ? finalOverride : '';
                                const diff = finalOverride !== undefined ? estimated - finalOverride : 0;
                                const vendorName = finalS?.finalVendorName || displayS.name;
                                const isManual = !!displayS.isManualFinal;

                                return (
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                        <td className={cellClass}>
                                            {isManual ? (
                                                <input 
                                                    type="text" 
                                                    className={textInputClass} 
                                                    value={displayS.name} 
                                                    onChange={(e) => updateSupplierOverride(id, { name: e.target.value })}
                                                    placeholder="Nazwa dostawcy..."
                                                />
                                            ) : (
                                                <>
                                                    <div className="font-medium text-zinc-800 dark:text-zinc-200">
                                                        {displayS.name}
                                                        {!initialS && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">NOWY</span>}
                                                    </div>
                                                    <div className="text-xs text-zinc-400 font-normal">Oferta: {displayS.offerNumber}</div>
                                                </>
                                            )}
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>
                                            {!isManual ? (
                                                <>{formatNumber(estimated)} <span className="text-[10px]">{displayS.currency}</span></>
                                            ) : (
                                                <span className="text-zinc-300">-</span>
                                            )}
                                        </td>
                                        
                                        {/* CYAN ZONE */}
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={vendorName}
                                                onChange={(e) => updateSupplierOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Nazwa z faktury..."
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={!isManual && estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateSupplierOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            {isManual ? (
                                                <select 
                                                    className={selectClass}
                                                    value={displayS.currency}
                                                    onChange={(e) => updateSupplierOverride(id, { currency: e.target.value as Currency })}
                                                >
                                                    <option value={Currency.PLN}>PLN</option>
                                                    <option value={Currency.EUR}>EUR</option>
                                                </select>
                                            ) : (
                                                <div className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                                    {displayS.currency}
                                                </div>
                                            )}
                                        </td>

                                        <td className={`${cellClass} text-right font-bold font-mono border-l border-zinc-200 dark:border-zinc-800 ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${formatNumber(diff)}` : '-'}
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                            {isManual && (
                                                <button onClick={() => removeManualSupplier(id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}


                            {/* TRANSPORT */}
                            <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Transport</span>
                                        <button onClick={addManualTransport} className="text-[10px] bg-white dark:bg-zinc-600 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-zinc-300 dark:border-zinc-500">
                                            <Plus size={12}/> Dodaj
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {allTransportIds.map(id => {
                                const initialT = initialData.transport.find(t => t.id === id);
                                const finalT = data.transport.find(t => t.id === id);
                                const displayT = initialT || finalT;

                                if (!displayT || displayT.isSupplierOrganized) return null;

                                const estimated = initialT ? getEstimatedTransportCost(initialT) : 0;
                                const finalOverride = finalT?.finalCostOverride;
                                const valToShow = finalOverride !== undefined ? finalOverride : '';
                                const diff = finalOverride !== undefined ? estimated - finalOverride : 0;

                                const isManualFinal = !initialT && finalT; 
                                const label = displayT.supplierId 
                                    ? `Transport: ${initialData.suppliers.find(s=>s.id === displayT.supplierId)?.name || 'Dostawca'}` 
                                    : (displayT.name || 'Transport własny');
                                
                                const finalVendor = finalT?.finalVendorName || '';
                                const finalCurrency = finalT?.finalCurrency || displayT.currency;

                                return (
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className={cellClass}>
                                            {isManualFinal ? (
                                                <input 
                                                    type="text" 
                                                    value={displayT.name} 
                                                    onChange={(e) => updateTransportOverride(id, { name: e.target.value })}
                                                    className={textInputClass}
                                                    placeholder="Nazwa transportu..."
                                                />
                                            ) : (
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{label}</div>
                                            )}
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>
                                            {initialT ? formatNumber(estimated) : '-'} <span className="text-[10px]">{displayT.currency}</span>
                                        </td>

                                        {/* CYAN ZONE */}
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={finalVendor}
                                                onChange={(e) => updateTransportOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Przewoźnik..."
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateTransportOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            {/* Allow currency selection only if manual or overriding */}
                                            <select 
                                                className={selectClass}
                                                value={finalCurrency}
                                                onChange={(e) => updateTransportOverride(id, { finalCurrency: e.target.value as Currency })}
                                            >
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>

                                        <td className={`${cellClass} text-right font-bold font-mono border-l border-zinc-200 dark:border-zinc-800 ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${formatNumber(diff)}` : '-'}
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                            {isManualFinal && (
                                                <button onClick={() => removeManualTransport(id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}


                            {/* INSTALLATION - LABOR */}
                            <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Montaż / Robocizna</span>
                                        <button onClick={() => addFinalInstallationItem('LABOR')} className="text-[10px] bg-white dark:bg-zinc-600 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-zinc-300 dark:border-zinc-500">
                                            <Plus size={12}/> Dodaj
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                                <td className={`${cellClass} italic text-zinc-500`}>Szacowany koszt robocizny (Plan)</td>
                                <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{formatNumber(getEstimatedInstallationSplit().labor)} <span className="text-[10px]">PLN</span></td>
                                <td colSpan={5} className={cellClass}></td>
                            </tr>
                            {finalLaborItems.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.description} onChange={(e) => updateFinalInstallationItem(item.id, 'description', e.target.value)} placeholder="Opis usługi..." />
                                    </td>
                                    <td className={`${cellClass} text-right text-zinc-300`}>-</td>
                                    
                                    <td className={cellCyanClass}>
                                        <input type="text" className={textInputClass} value={item.vendorName} onChange={(e) => updateFinalInstallationItem(item.id, 'vendorName', e.target.value)} placeholder="Wykonawca..." />
                                    </td>
                                    <td className={cellCyanClass}>
                                        <input type="number" className={inputClass} value={item.price} onChange={(e) => updateFinalInstallationItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td className={cellCyanClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateFinalInstallationItem(item.id, 'currency', e.target.value)}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={`${cellClass} border-l border-zinc-200 dark:border-zinc-800`}></td>
                                    <td className={`${cellClass} text-center`}>
                                        <button onClick={() => removeFinalInstallationItem(item.id)} className="text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}


                             {/* INSTALLATION - RENTALS */}
                             <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Wynajmy (Wózki, Podnośniki)</span>
                                        <button onClick={() => addFinalInstallationItem('RENTAL')} className="text-[10px] bg-white dark:bg-zinc-600 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-zinc-300 dark:border-zinc-500">
                                            <Plus size={12}/> Dodaj
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                                <td className={`${cellClass} italic text-zinc-500`}>Szacowany koszt wynajmów (Plan)</td>
                                <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{formatNumber(getEstimatedInstallationSplit().rental)} <span className="text-[10px]">PLN</span></td>
                                <td colSpan={5} className={cellClass}></td>
                            </tr>
                            {finalRentalItems.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.description} onChange={(e) => updateFinalInstallationItem(item.id, 'description', e.target.value)} placeholder="Opis wynajmu..." />
                                    </td>
                                    <td className={`${cellClass} text-right text-zinc-300`}>-</td>
                                    
                                    <td className={cellCyanClass}>
                                        <input type="text" className={textInputClass} value={item.vendorName} onChange={(e) => updateFinalInstallationItem(item.id, 'vendorName', e.target.value)} placeholder="Dostawca sprzętu..." />
                                    </td>
                                    <td className={cellCyanClass}>
                                        <input type="number" className={inputClass} value={item.price} onChange={(e) => updateFinalInstallationItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td className={cellCyanClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateFinalInstallationItem(item.id, 'currency', e.target.value)}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={`${cellClass} border-l border-zinc-200 dark:border-zinc-800`}></td>
                                    <td className={`${cellClass} text-center`}>
                                        <button onClick={() => removeFinalInstallationItem(item.id)} className="text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}


                            {/* OTHER COSTS */}
                            <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Inne Koszty</span>
                                        <button onClick={addManualOtherCost} className="text-[10px] bg-white dark:bg-zinc-600 hover:bg-cyan-50 dark:hover:bg-cyan-900 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-zinc-300 dark:border-zinc-500">
                                            <Plus size={12}/> Dodaj
                                        </button>
                                    </div>
                                </td>
                            </tr>
                             {allOtherIds.map(id => {
                                const initialC = initialData.otherCosts.find(c => c.id === id);
                                const finalC = data.otherCosts.find(c => c.id === id);
                                const displayC = initialC || finalC;

                                if (!displayC) return null;

                                const estimated = initialC ? initialC.price : 0;
                                const finalOverride = finalC?.finalCostOverride;
                                const valToShow = finalOverride !== undefined ? finalOverride : '';
                                const diff = finalOverride !== undefined ? estimated - finalOverride : 0;
                                const isManualFinal = !initialC && finalC;
                                const vendor = finalC?.finalVendorName || '';
                                const currency = finalC?.finalCurrency || displayC.currency;

                                return (
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className={cellClass}>
                                             {isManualFinal ? (
                                                <input 
                                                    type="text" 
                                                    value={displayC.description} 
                                                    onChange={(e) => updateOtherCostOverride(id, { description: e.target.value })}
                                                    className={textInputClass}
                                                    placeholder="Opis kosztu..."
                                                />
                                            ) : (
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{displayC.description}</div>
                                            )}
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{formatNumber(estimated)} <span className="text-[10px]">{displayC.currency}</span></td>
                                        
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={vendor}
                                                onChange={(e) => updateOtherCostOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Usługodawca..."
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateOtherCostOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellCyanClass}>
                                            <select 
                                                className={selectClass}
                                                value={currency}
                                                onChange={(e) => updateOtherCostOverride(id, { finalCurrency: e.target.value as Currency })}
                                            >
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>

                                        <td className={`${cellClass} text-right font-bold font-mono border-l border-zinc-200 dark:border-zinc-800 ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${formatNumber(diff)}` : '-'}
                                        </td>
                                        <td className={`${cellClass} text-center`}>
                                             {isManualFinal && (
                                                <button onClick={() => removeManualOtherCost(id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FINAL SUMMARY FOOTER - Updated to Light Theme (Zinc-50/White) */}
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-sm shadow-lg border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row items-center justify-between gap-8">
                
                {/* 1. Final Cost */}
                <div className="flex-1 w-full lg:w-auto text-center lg:text-left border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 pb-4 lg:pb-0 pr-0 lg:pr-8">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Całkowity Koszt Rzeczywisty</div>
                    <div className="text-3xl font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        {formatNumber(totalFinalCost)} <span className="text-lg text-zinc-400">{offerCurrency}</span>
                    </div>
                </div>

                {/* 2. Confirmed Price (Input) */}
                <div className="flex-1 w-full lg:w-auto flex flex-col items-center">
                    <div className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                        <DollarSign size={12}/> Potwierdzona Cena Sprzedaży
                    </div>
                    <div className="relative group">
                        <input 
                            type="number" 
                            className="bg-transparent text-4xl font-mono font-bold text-zinc-900 dark:text-white text-center outline-none border-b-2 border-zinc-200 dark:border-zinc-700 focus:border-amber-500 transition-all w-64 placeholder-zinc-300 dark:placeholder-zinc-700"
                            placeholder="0.00"
                            value={isEditingPrice ? localPriceInput : (sellingPrice > 0 ? sellingPrice.toFixed(2) : '')}
                            onChange={handlePriceChange}
                            onFocus={handlePriceFocus}
                            onBlur={handlePriceBlur}
                        />
                        <span className="absolute right-0 bottom-2 text-lg text-zinc-400 font-mono pointer-events-none">{offerCurrency}</span>
                    </div>
                </div>

                {/* 3. Result (Profit & Margin) */}
                <div className="flex-1 w-full lg:w-auto flex justify-around lg:justify-end gap-8 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 pt-4 lg:pt-0 pl-0 lg:pl-8">
                    <div className="text-center lg:text-right">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1 justify-end">
                            {isCritical && <AlertOctagon size={12} className="text-red-500"/>}
                            {isWarning && <AlertTriangle size={12} className="text-orange-500"/>}
                            Marża Rzeczywista
                        </div>
                        <div className={`text-2xl font-bold font-mono ${marginColor}`}>
                            {actualMargin.toFixed(2)}%
                        </div>
                    </div>
                    <div className="text-center lg:text-right">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Zysk / Strata</div>
                        <div className={`text-2xl font-bold font-mono flex items-center gap-1 justify-center lg:justify-end ${profit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {profit > 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                            {formatNumber(profit)}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
