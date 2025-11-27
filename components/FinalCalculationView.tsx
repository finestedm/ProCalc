
import React from 'react';
import { CalculationData, Currency, Supplier, TransportItem, OtherCostItem, InstallationData, FinalInstallationItem, SupplierStatus, Language } from '../types';
import { FileText, Truck, Wrench, Receipt, Plus, Trash2, AlertCircle } from 'lucide-react';
import { convert } from '../services/calculationService';

interface Props {
    data: CalculationData; // This is the 'Final' state
    initialData: CalculationData; // This is the 'Initial' state (Plan)
    onChange: (data: CalculationData) => void;
    exchangeRate: number;
    offerCurrency: Currency;
}

export const FinalCalculationView: React.FC<Props> = ({ data, initialData, onChange, exchangeRate, offerCurrency }) => {

    // --- Actions ---

    const updateSupplierOverride = (id: string, updates: Partial<Supplier>) => {
        const existingInFinal = data.suppliers.find(s => s.id === id);
        let newSuppliers = [...data.suppliers];

        if (existingInFinal) {
            newSuppliers = newSuppliers.map(s => s.id === id ? { ...s, ...updates } : s);
        } else {
            const source = initialData.suppliers.find(s => s.id === id);
            if (source) {
                const clone = JSON.parse(JSON.stringify(source));
                // Apply updates
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

    // Style constants
    const headerClass = "p-2 border-b dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase text-xs tracking-wider sticky top-0 z-10";
    const sectionHeaderClass = "p-2 font-bold text-xs uppercase text-zinc-800 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-700/50 pl-4 border-y dark:border-zinc-600";
    const cellClass = "p-2 border-b dark:border-zinc-800/50 text-sm align-top";
    const inputClass = "w-full p-1.5 border rounded text-right bg-white dark:bg-zinc-900 focus:border-yellow-400 outline-none font-bold text-zinc-900 dark:text-white dark:border-zinc-600 text-sm";
    const textInputClass = "w-full p-1.5 bg-transparent border-b border-transparent focus:border-yellow-400 outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400";
    const selectClass = "w-full p-1.5 bg-white dark:bg-zinc-900 border rounded text-xs outline-none focus:border-yellow-400 dark:border-zinc-600";

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-800 p-0 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded text-green-700 dark:text-green-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Rozliczenie Końcowe</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Wprowadź faktyczne koszty na podstawie faktur.</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className={`${headerClass} text-left w-1/4`}>Pozycja / Opis</th>
                                <th className={`${headerClass} text-left w-1/5`}>Dostawca / Wykonawca</th>
                                <th className={`${headerClass} text-right w-32`}>Szacunek (Wst.)</th>
                                <th className={`${headerClass} text-right w-32`}>Faktura</th>
                                <th className={`${headerClass} text-center w-20`}>Waluta</th>
                                <th className={`${headerClass} text-right w-24`}>Różnica</th>
                                <th className={`${headerClass} w-10`}></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-800">
                            
                            {/* SUPPLIERS */}
                            <tr>
                                <td colSpan={7} className={sectionHeaderClass}>
                                    <div className="flex justify-between items-center">
                                        <span>Dostawcy (Materiał)</span>
                                        <button onClick={addManualSupplier} className="text-[10px] bg-zinc-300 dark:bg-zinc-600 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                                            <Plus size={12}/> Dodaj Dostawcę
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
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
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
                                        <td className={cellClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={vendorName}
                                                onChange={(e) => updateSupplierOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Nazwa dostawcy..."
                                            />
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>
                                            {!isManual ? (
                                                <>{estimated.toFixed(2)} <span className="text-[10px]">{displayS.currency}</span></>
                                            ) : (
                                                <span className="text-zinc-300">-</span>
                                            )}
                                        </td>
                                        <td className={cellClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={!isManual && estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateSupplierOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellClass}>
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
                                        <td className={`${cellClass} text-right font-bold font-mono ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '-'}
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
                                        <button onClick={addManualTransport} className="text-[10px] bg-zinc-300 dark:bg-zinc-600 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                                            <Plus size={12}/> Dodaj Transport
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
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
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
                                        <td className={cellClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={finalVendor}
                                                onChange={(e) => updateTransportOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Przewoźnik..."
                                            />
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>
                                            {initialT ? estimated.toFixed(2) : '-'} <span className="text-[10px]">{displayT.currency}</span>
                                        </td>
                                        <td className={cellClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateTransportOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellClass}>
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
                                        <td className={`${cellClass} text-right font-bold font-mono ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '-'}
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
                                        <button onClick={() => addFinalInstallationItem('LABOR')} className="text-[10px] bg-zinc-300 dark:bg-zinc-600 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                                            <Plus size={12}/> Dodaj Fakturę (Montaż)
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                                <td colSpan={2} className={`${cellClass} italic text-zinc-500`}>Szacowany koszt robocizny (Plan)</td>
                                <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{getEstimatedInstallationSplit().labor.toFixed(2)} <span className="text-[10px]">PLN</span></td>
                                <td colSpan={4} className={cellClass}></td>
                            </tr>
                            {finalLaborItems.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.description} onChange={(e) => updateFinalInstallationItem(item.id, 'description', e.target.value)} placeholder="Opis usługi..." />
                                    </td>
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.vendorName} onChange={(e) => updateFinalInstallationItem(item.id, 'vendorName', e.target.value)} placeholder="Wykonawca..." />
                                    </td>
                                    <td className={`${cellClass} text-right text-zinc-300`}>-</td>
                                    <td className={cellClass}>
                                        <input type="number" className={inputClass} value={item.price} onChange={(e) => updateFinalInstallationItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td className={cellClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateFinalInstallationItem(item.id, 'currency', e.target.value)}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={cellClass}></td>
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
                                        <button onClick={() => addFinalInstallationItem('RENTAL')} className="text-[10px] bg-zinc-300 dark:bg-zinc-600 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                                            <Plus size={12}/> Dodaj Fakturę (Wynajem)
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                                <td colSpan={2} className={`${cellClass} italic text-zinc-500`}>Szacowany koszt wynajmów (Plan)</td>
                                <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{getEstimatedInstallationSplit().rental.toFixed(2)} <span className="text-[10px]">PLN</span></td>
                                <td colSpan={4} className={cellClass}></td>
                            </tr>
                            {finalRentalItems.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.description} onChange={(e) => updateFinalInstallationItem(item.id, 'description', e.target.value)} placeholder="Opis wynajmu..." />
                                    </td>
                                    <td className={cellClass}>
                                        <input type="text" className={textInputClass} value={item.vendorName} onChange={(e) => updateFinalInstallationItem(item.id, 'vendorName', e.target.value)} placeholder="Dostawca sprzętu..." />
                                    </td>
                                    <td className={`${cellClass} text-right text-zinc-300`}>-</td>
                                    <td className={cellClass}>
                                        <input type="number" className={inputClass} value={item.price} onChange={(e) => updateFinalInstallationItem(item.id, 'price', parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td className={cellClass}>
                                        <select className={selectClass} value={item.currency} onChange={(e) => updateFinalInstallationItem(item.id, 'currency', e.target.value)}>
                                            <option value={Currency.PLN}>PLN</option>
                                            <option value={Currency.EUR}>EUR</option>
                                        </select>
                                    </td>
                                    <td className={cellClass}></td>
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
                                        <button onClick={addManualOtherCost} className="text-[10px] bg-zinc-300 dark:bg-zinc-600 hover:bg-yellow-400 hover:text-black dark:text-zinc-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors">
                                            <Plus size={12}/> Dodaj Inny Koszt
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
                                    <tr key={id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
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
                                        <td className={cellClass}>
                                            <input 
                                                type="text" 
                                                className={textInputClass} 
                                                value={vendor}
                                                onChange={(e) => updateOtherCostOverride(id, { finalVendorName: e.target.value })}
                                                placeholder="Usługodawca..."
                                            />
                                        </td>
                                        <td className={`${cellClass} text-right text-zinc-500 font-mono`}>{estimated.toFixed(2)} <span className="text-[10px]">{displayC.currency}</span></td>
                                        <td className={cellClass}>
                                            <input 
                                                type="number" 
                                                className={inputClass}
                                                placeholder={estimated > 0 ? estimated.toFixed(2) : "0.00"}
                                                value={valToShow}
                                                onChange={(e) => updateOtherCostOverride(id, { finalCostOverride: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td className={cellClass}>
                                            <select 
                                                className={selectClass}
                                                value={currency}
                                                onChange={(e) => updateOtherCostOverride(id, { finalCurrency: e.target.value as Currency })}
                                            >
                                                <option value={Currency.PLN}>PLN</option>
                                                <option value={Currency.EUR}>EUR</option>
                                            </select>
                                        </td>
                                        <td className={`${cellClass} text-right font-bold font-mono ${finalOverride !== undefined ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-zinc-400') : 'text-zinc-300'}`}>
                                            {finalOverride !== undefined ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '-'}
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
        </div>
    );
};
