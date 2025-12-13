
import React, { useState, useEffect } from 'react';
import { CalculationData, AppState, Currency, Language } from '../types';
import { X, Printer, LayoutTemplate, Merge, RotateCcw } from 'lucide-react';
import { calculateProjectCosts, formatCurrency, formatNumber } from '../services/calculationService';
import { SmartInput } from './SmartInput';

interface Props {
    data: CalculationData;
    appState: AppState;
    onClose: () => void;
}

type PricingMode = 'DETAILED' | 'AGGREGATED';

interface EditableRow {
    id: string;
    description: string;
    quantity: string;
    price: number;
    type: 'ITEM' | 'HEADER';
}

export const OfferGeneratorModal: React.FC<Props> = ({ data, appState, onClose }) => {
    const [pricingMode, setPricingMode] = useState<PricingMode>('DETAILED');
    const [mergeTransport, setMergeTransport] = useState(false);
    const [mergeInstallation, setMergeInstallation] = useState(false);
    const [language, setLanguage] = useState<Language>(Language.PL);

    // --- EDITABLE STATE ---
    const [title, setTitle] = useState('OFERTA HANDLOWA');
    const [projectRef, setProjectRef] = useState(data.meta.projectNumber || '');
    const [orderRef, setOrderRef] = useState(data.meta.orderNumber || '-');

    // Text Blocks
    const [buyerText, setBuyerText] = useState('');
    const [detailsText, setDetailsText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [validityText, setValidityText] = useState('');

    // Rows
    const [rows, setRows] = useState<EditableRow[]>([]);

    const isEn = language === Language.EN;
    const currency = appState.offerCurrency;

    // --- INITIALIZATION / RE-CALCULATION ---
    useEffect(() => {
        initializeData();
    }, [pricingMode, mergeTransport, mergeInstallation, language, data, appState.manualPrice, appState.targetMargin]);

    const initializeData = () => {
        const rate = appState.exchangeRate;
        const ormFee = appState.globalSettings.ormFeePercent;

        // Costs
        const costs = calculateProjectCosts(data, rate, currency, appState.mode, ormFee, appState.targetMargin, appState.manualPrice);

        // Determine Selling Price & Multiplier
        let sellingPrice = 0;
        if (appState.manualPrice !== null) {
            sellingPrice = appState.manualPrice;
        } else {
            const marginDecimal = appState.targetMargin / 100;
            sellingPrice = marginDecimal >= 1
                ? (costs.total > 0 ? costs.total * 999 : 0)
                : costs.total / (1 - marginDecimal);
        }

        const multiplier = costs.total > 0 ? sellingPrice / costs.total : 1;

        // Component Prices
        let materialPrice = (costs.suppliers + costs.ormFee + costs.other) * multiplier;
        let transportPrice = costs.transport * multiplier;
        let installationPrice = costs.installation * multiplier;

        if (mergeTransport) {
            materialPrice += transportPrice;
            transportPrice = 0;
        }
        if (mergeInstallation) {
            materialPrice += installationPrice;
            installationPrice = 0;
        }

        // 1. Build Rows
        const newRows: EditableRow[] = [];
        let idx = 1;

        // Material
        const suppliersText = data.suppliers
            .filter(s => s.isIncluded !== false)
            .map(s => s.customTabName || s.name)
            .join(', ');

        newRows.push({
            id: 'mat',
            type: 'ITEM',
            description: isEn
                ? `${data.meta.invoiceText || 'Warehouse Equipment'}\nIncluded: ${suppliersText}`
                : `${data.meta.invoiceText || 'System Regałowy'}\nZakres: ${suppliersText}`,
            quantity: `1 ${isEn ? 'cpl' : 'kpl'}`,
            price: materialPrice
        });

        // Transport
        if (transportPrice > 0) {
            newRows.push({
                id: 'trans',
                type: 'ITEM',
                description: isEn
                    ? `Transport / Delivery (DDP: ${data.recipient.city})`
                    : `Transport i Dostawa (DDP: ${data.recipient.city})`,
                quantity: `1 ${isEn ? 'srv' : 'usł'}`,
                price: transportPrice
            });
        }

        // Installation
        if (installationPrice > 0) {
            newRows.push({
                id: 'inst',
                type: 'ITEM',
                description: isEn
                    ? 'Installation / Assembly'
                    : 'Montaż / Instalacja',
                quantity: `1 ${isEn ? 'srv' : 'usł'}`,
                price: installationPrice
            });
        }

        // Financing
        if (costs.financing > 0) {
            newRows.push({
                id: 'fin',
                type: 'ITEM',
                description: isEn ? 'Financing Costs' : 'Koszty finansowania',
                quantity: `1 ${isEn ? 'srv' : 'usł'}`,
                price: costs.financing * multiplier // Assuming margin applies to financing too or just pass-through
            });
        }

        setRows(newRows);

        // 2. Build Text Blocks
        setTitle(isEn ? 'COMMERCIAL OFFER' : 'OFERTA HANDLOWA');

        const buyerLabel = isEn ? 'Buyer / Customer:' : 'Nabywca / Zamawiający:';
        setBuyerText(`${buyerLabel}\n${data.orderingParty.name}\n${data.orderingParty.street}\n${data.orderingParty.zip} ${data.orderingParty.city}\nNIP: ${data.orderingParty.nip}`);

        const detailsLabel = isEn ? 'Project Details:' : 'Szczegóły Projektu:';
        setDetailsText(`${detailsLabel}\n${data.meta.installationType}\n${isEn ? 'Sales Engineer' : 'Inżynier'}: ${data.meta.salesPerson}`);

        const terms = data.paymentTerms;
        const payText = terms
            ? `${terms.advance1Percent > 0 ? `${terms.advance1Percent}% ${isEn ? 'Advance' : 'Zaliczki'}, ` : ''}${terms.advance2Percent > 0 ? `${terms.advance2Percent}% ${isEn ? 'Milestone' : 'Transzy'}, ` : ''}${(100 - (terms?.advance1Percent || 0) - (terms?.advance2Percent || 0))}% ${isEn ? 'Final Payment' : 'Płatność końcowa'} ${terms?.finalPaymentDays} ${isEn ? 'days' : 'dni'}.`
            : '-';

        setFooterText(`${isEn ? 'Payment Terms' : 'Warunki Płatności'}: ${payText}\n${isEn ? 'General Terms and Conditions apply.' : 'Obowiązują Ogólne Warunki Sprzedaży.'}`);

        const today = new Date();
        const validDate = new Date();
        validDate.setDate(today.getDate() + 14);
        setValidityText(`${isEn ? 'Offer valid until' : 'Oferta ważna do'}: ${validDate.toLocaleDateString()}`);
    };

    // 3. Print Mode Class Toggle
    useEffect(() => {
        document.body.classList.add('modal-open-print');
        return () => {
            document.body.classList.remove('modal-open-print');
        };
    }, []);

    // --- HANDLERS ---
    const updateRow = (id: string, field: keyof EditableRow, value: any) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handlePrint = () => window.print();

    // Summary Calcs based on Edited Rows
    const totalNet = rows.reduce((sum, r) => sum + r.price, 0);
    const vatValue = totalNet * 0.23;
    const totalGross = totalNet + vatValue;

    const textareaClass = "w-full bg-transparent resize-none outline-none border border-transparent hover:border-zinc-300 focus:border-amber-400 p-1 rounded transition-colors font-sans text-zinc-700 leading-snug";
    const inputTableClass = "w-full bg-transparent outline-none border-b border-transparent hover:border-zinc-300 focus:border-amber-400 text-sm py-1 transition-colors";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn print:static print:h-auto print:w-auto print:bg-white print:p-0 print:block">
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-scaleIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:bg-white print:block">

                {/* Toolbar */}
                <div className="bg-zinc-800 text-white p-3 flex justify-between items-center shadow-md shrink-0 print:hidden">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <LayoutTemplate size={18} className="text-amber-400" />
                            <span className="font-bold text-sm">Generator Oferty (Edycja)</span>
                        </div>

                        <div className="h-6 w-px bg-zinc-600"></div>

                        {/* Controls */}
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex bg-zinc-700 rounded p-0.5">
                                <button
                                    onClick={() => setPricingMode('DETAILED')}
                                    className={`px-3 py-1 font-bold rounded transition-colors ${pricingMode === 'DETAILED' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    Szczegółowa
                                </button>
                                <button
                                    onClick={() => { setPricingMode('AGGREGATED'); setMergeTransport(false); setMergeInstallation(false); }}
                                    className={`px-3 py-1 font-bold rounded transition-colors ${pricingMode === 'AGGREGATED' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    Tylko Suma
                                </button>
                            </div>

                            {pricingMode === 'DETAILED' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setMergeTransport(!mergeTransport)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${mergeTransport ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-zinc-600 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        <Merge size={12} /> {mergeTransport ? 'Trans. w cenie' : '+ Transport'}
                                    </button>
                                    <button
                                        onClick={() => setMergeInstallation(!mergeInstallation)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${mergeInstallation ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-zinc-600 text-zinc-400 hover:bg-zinc-700'}`}
                                    >
                                        <Merge size={12} /> {mergeInstallation ? 'Mont. w cenie' : '+ Montaż'}
                                    </button>
                                </div>
                            )}

                            <div className="flex bg-zinc-700 rounded p-0.5 ml-4">
                                <button onClick={() => setLanguage(Language.PL)} className={`px-2 py-1 font-bold rounded ${language === Language.PL ? 'bg-amber-500 text-black' : 'text-zinc-400'}`}>PL</button>
                                <button onClick={() => setLanguage(Language.EN)} className={`px-2 py-1 font-bold rounded ${language === Language.EN ? 'bg-amber-500 text-black' : 'text-zinc-400'}`}>EN</button>
                            </div>

                            <button onClick={initializeData} className="ml-4 text-zinc-400 hover:text-white flex items-center gap-1" title="Resetuj edycje">
                                <RotateCcw size={12} /> Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors">
                            <Printer size={14} /> Drukuj / PDF
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* PREVIEW AREA (A4) */}
                <div className="flex-1 overflow-y-auto p-8 bg-zinc-200 dark:bg-black/50 flex justify-center custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block">
                    <div className="printable-content bg-white text-zinc-900 w-[210mm] min-h-[297mm] shadow-lg p-[20mm] flex flex-col relative text-[12px] leading-snug print:shadow-none print:w-full print:min-h-0 print:p-0">

                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-amber-500 pb-6 mb-8">
                            <div>
                                {/* Logo Placeholder */}
                                <div className="font-black text-2xl tracking-tighter mb-2 flex items-center gap-2">
                                    <div className="w-6 h-6 bg-red-600 text-white flex items-center justify-center text-[10px]">JH</div>
                                    LOGO
                                </div>
                                <div className="text-zinc-500 text-[10px]">
                                    Jungheinrich Polska Sp. z o.o.<br />
                                    ul. Świerkowa 32<br />
                                    05-850 Ożarów Mazowiecki
                                </div>
                            </div>
                            <div className="text-right w-1/2">
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="text-2xl font-bold uppercase tracking-wide text-right w-full outline-none hover:bg-zinc-50 mb-2 bg-transparent"
                                />
                                <div className="flex justify-end items-center gap-2">
                                    <span className="text-zinc-500">{isEn ? 'Project No:' : 'Nr Projektu:'}</span>
                                    <input value={projectRef} onChange={e => setProjectRef(e.target.value)} className="font-bold text-right outline-none hover:bg-zinc-50 w-32 bg-transparent" />
                                </div>
                                <div className="flex justify-end items-center gap-2">
                                    <span className="text-zinc-500">{isEn ? 'Date:' : 'Data:'}</span>
                                    <span>{new Date().toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-end items-center gap-2">
                                    <span className="text-zinc-500">{isEn ? 'Your Ref:' : 'Twoje Zamówienie:'}</span>
                                    <input value={orderRef} onChange={e => setOrderRef(e.target.value)} className="text-right outline-none hover:bg-zinc-50 w-32 bg-transparent" />
                                </div>
                            </div>
                        </div>

                        {/* Address Grid */}
                        <div className="grid grid-cols-2 gap-12 mb-10 items-start">
                            <textarea
                                className={`${textareaClass} h-32 font-medium`}
                                value={buyerText}
                                onChange={(e) => setBuyerText(e.target.value)}
                            />
                            <textarea
                                className={`${textareaClass} h-32 text-right`}
                                value={detailsText}
                                onChange={(e) => setDetailsText(e.target.value)}
                            />
                        </div>

                        {/* Main Table */}
                        <table className="w-full border-collapse mb-8">
                            <thead className="bg-zinc-100 text-zinc-600 font-bold uppercase text-[10px]">
                                <tr>
                                    <th className="p-2 text-left w-10">#</th>
                                    <th className="p-2 text-left">{isEn ? 'Description' : 'Opis / Zakres'}</th>
                                    <th className="p-2 text-center w-24">{isEn ? 'Quantity' : 'Ilość'}</th>
                                    {pricingMode === 'DETAILED' && (
                                        <th className="p-2 text-right w-32">{isEn ? 'Net Value' : 'Wartość Netto'}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {rows.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-zinc-200 hover:bg-zinc-50/50">
                                        <td className="p-3 text-center text-zinc-400">{idx + 1}</td>
                                        <td className="p-3">
                                            <textarea
                                                rows={2}
                                                className={`${inputTableClass} resize-none overflow-hidden h-auto`}
                                                value={row.description}
                                                onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                                style={{ height: 'auto', minHeight: '1.5em' }}
                                                onInput={(e) => {
                                                    const target = e.target as HTMLTextAreaElement;
                                                    target.style.height = 'auto';
                                                    target.style.height = `${target.scrollHeight}px`;
                                                }}
                                            />
                                        </td>
                                        <td className="p-3 text-center align-top">
                                            <input
                                                className={`${inputTableClass} text-center font-bold`}
                                                value={row.quantity}
                                                onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        {pricingMode === 'DETAILED' && (
                                            <td className="p-3 text-right align-top bg-zinc-50/30">
                                                <SmartInput
                                                    className={`${inputTableClass} text-right font-mono font-bold`}
                                                    value={row.price}
                                                    onChange={(val) => updateRow(row.id, 'price', val)}
                                                    decimalScale={2}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Summary Block */}
                        <div className="flex justify-end mb-12">
                            <div className="w-1/2 bg-zinc-50 p-4 rounded border border-zinc-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-zinc-500 font-bold uppercase text-[10px]">{isEn ? 'Total Net' : 'Suma Netto'}</span>
                                    <span className="font-mono font-bold text-lg">{formatCurrency(totalNet, currency)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2 border-b border-zinc-200 pb-2">
                                    <span className="text-zinc-500 font-bold uppercase text-[10px]">VAT 23%</span>
                                    <span className="font-mono text-zinc-600">{formatCurrency(vatValue, currency)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-zinc-800 font-black uppercase text-xs">{isEn ? 'Total Gross' : 'Do Zapłaty Brutto'}</span>
                                    <span className="font-mono font-black text-xl text-amber-600">{formatCurrency(totalGross, currency)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Terms */}
                        <div className="mt-auto pt-6 border-t border-zinc-200">
                            <div className="grid grid-cols-2 gap-8 mb-6">
                                <textarea
                                    className={`${textareaClass} h-20 bg-zinc-50 border-zinc-100`}
                                    value={footerText}
                                    onChange={(e) => setFooterText(e.target.value)}
                                />
                                <textarea
                                    className={`${textareaClass} h-20 bg-zinc-50 border-zinc-100 text-right`}
                                    value={validityText}
                                    onChange={(e) => setValidityText(e.target.value)}
                                />
                            </div>
                            <div className="text-[10px] text-zinc-400 text-center">
                                {isEn ? 'This document is a commercial offer.' : 'Niniejszy dokument stanowi ofertę handlową.'}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
