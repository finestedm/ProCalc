




import React, { useState } from 'react';
import { CalculationData, SupplierStatus, AppState, CalculationMode } from '../types';
import { FileText, Mail, Printer, Copy, CheckCircle, ArrowLeft, Send, CheckCircle2, Lock, LayoutTemplate } from 'lucide-react';
import { calculateProjectCosts, formatCurrency, formatNumber } from '../services/calculationService';
import { OfferGeneratorModal } from './OfferGeneratorModal';

interface Props {
  data: CalculationData;
  onBack: () => void;
  onApproveOpening?: () => Promise<boolean>;
  onApproveClosing?: () => Promise<boolean>;
  appState: AppState;
}

export const DocumentsView: React.FC<Props> = ({ data, onBack, onApproveOpening, onApproveClosing, appState }) => {
  const [copied, setCopied] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);

  // --- PROTOCOL GENERATION ---
  const handlePrintProtocol = () => {
      const printWindow = window.open('', '', 'width=900,height=1000');
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Protokół Odbioru Końcowego</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
              h1 { text-align: center; margin-bottom: 40px; font-size: 24px; text-transform: uppercase; }
              .section { margin-bottom: 30px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .label { font-weight: bold; width: 200px; }
              .value { flex: 1; border-bottom: 1px dotted #ccc; padding-left: 10px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 14px; }
              .signatures { margin-top: 100px; display: flex; justify-content: space-between; }
              .sig-block { width: 40%; text-align: center; border-top: 1px solid #000; padding-top: 10px; }
            </style>
          </head>
          <body>
            <h1>Protokół Odbioru Końcowego</h1>
            
            <div class="section">
              <div class="row">
                <span class="label">Miejscowość, Data:</span>
                <span class="value">${data.recipient.city || '...................'}, ${data.meta.protocolDate || new Date().toLocaleDateString()}</span>
              </div>
              <div class="row">
                <span class="label">Projekt (Nr):</span>
                <span class="value">${data.meta.projectNumber || '...................'}</span>
              </div>
               <div class="row">
                <span class="label">Zamówienie (Nr):</span>
                <span class="value">${data.meta.orderNumber || '...................'}</span>
              </div>
            </div>

            <div class="section">
              <p><strong>Zamawiający:</strong><br/>
              ${data.orderingParty.name}<br/>
              ${data.orderingParty.street}, ${data.orderingParty.zip} ${data.orderingParty.city}<br/>
              NIP: ${data.orderingParty.nip}</p>
            </div>

            <div class="section">
              <p>Przedmiotem odbioru są prace wykonane w ramach projektu. Zakres prac obejmował dostawę i montaż elementów wyposażenia magazynowego zgodnie z ofertą.</p>
              
              <h3>Wykaz elementów (Skrócony):</h3>
              <table>
                <thead><tr><th>Dostawca</th><th>Elementów</th><th>Uwagi</th></tr></thead>
                <tbody>
                  ${data.suppliers.filter(s => s.isIncluded !== false).map(s => `
                    <tr>
                      <td>${s.name}</td>
                      <td>${s.items.length} poz.</td>
                      <td></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="section">
               <p>Strony stwierdzają, że prace zostały wykonane:</p>
               <p>[ ] bez zastrzeżeń</p>
               <p>[ ] z następującymi usterkami (załącznik nr 1)</p>
            </div>

            <div class="signatures">
              <div class="sig-block">Przedstawiciel Zamawiającego</div>
              <div class="sig-block">Przedstawiciel Wykonawcy</div>
            </div>
            
            <script>window.print();</script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
  };

  // --- OPENING EMAIL GENERATION (Logistics) ---
  const logisticsSuppliers = data.suppliers.filter(s => s.isIncluded !== false && s.status === SupplierStatus.TO_ORDER);
  
  const openingSubject = `ZAMÓWIENIE | Projekt: ${data.meta.projectNumber || 'XXX'} | ${data.orderingParty.name || 'Klient'}`;
  
  const openingBody = `
Dzień dobry,

Zatwierdzam do realizacji. Proszę o złożenie zamówień dla projektu:
Numer Projektu: ${data.meta.projectNumber || 'BRAK'}
Numer SAP: ${data.meta.sapProjectNumber || 'BRAK'}
Klient: ${data.orderingParty.name}
Adres Dostawy: ${data.recipient.street}, ${data.recipient.zip} ${data.recipient.city}

--- DOSTAWCY DO ZAMÓWIENIA (${logisticsSuppliers.length}) ---

${logisticsSuppliers.map((s, i) => `${i+1}. ${s.name}
   - Nr Oferty: ${s.offerNumber || 'Brak'}
   - Waluta: ${s.currency}
   - Rabat: ${s.discount}%
   - Termin: ${s.deliveryDate || 'Wg oferty'}
   - Uwagi: ${s.notes || 'Brak'}
`).join('\n')}

--- TRANSPORT ---
${data.transport.filter(t => !t.isSupplierOrganized).map(t => `- ${t.name || 'Transport JH'}: ${t.trucksCount} aut`).join('\n')}

Pozdrawiam,
${data.meta.salesPerson || 'Handlowiec'}
  `.trim();

  const handleCopyOpening = () => {
      navigator.clipboard.writeText(openingBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleApproveAndSendOpening = async () => {
      if (onApproveOpening) {
          const success = await onApproveOpening();
          if (success) {
              const subject = encodeURIComponent(openingSubject);
              const body = encodeURIComponent(openingBody);
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }
      }
  };

  // --- CLOSING EMAIL GENERATION (Settlement) ---
  const closingSubject = `ROZLICZENIE | Projekt: ${data.meta.projectNumber || 'XXX'}`;
  
  // Calculate financials for Closing Email
  const rate = appState.exchangeRate;
  const currency = appState.offerCurrency;
  const ormFee = appState.globalSettings.ormFeePercent;
  
  // Costs based on CURRENT mode (data provided)
  const finalCosts = calculateProjectCosts(data, rate, currency, appState.mode, ormFee, appState.targetMargin, appState.manualPrice);
  const totalFinalCost = finalCosts.total;

  let sellingPrice = 0;
  let marginPercent = 0;
  let profit = 0;

  if (appState.manualPrice !== null) {
      sellingPrice = appState.manualPrice;
      if (sellingPrice !== 0) {
          marginPercent = (1 - (totalFinalCost / sellingPrice)) * 100;
      }
      profit = sellingPrice - totalFinalCost;
  } else {
      marginPercent = appState.targetMargin;
      const marginDecimal = marginPercent / 100;
      sellingPrice = marginDecimal >= 1 
        ? (totalFinalCost > 0 ? totalFinalCost * 999 : 0) 
        : totalFinalCost / (1 - marginDecimal);
      profit = sellingPrice - totalFinalCost;
  }

  const closingBody = `
Dzień dobry,

Zatwierdzam koszty dla projektu i proszę o zamknięcie.

Numer SAP: ${data.meta.sapProjectNumber || 'BRAK'}
Projekt CRM: ${data.meta.projectNumber}
Klient: ${data.orderingParty.name}

Wartość Faktur Sprzedaży: ${formatCurrency(sellingPrice, currency)}
Koszt Rzeczywisty: ${formatCurrency(totalFinalCost, currency)}
Wynik: ${formatCurrency(profit, currency)} (${marginPercent.toFixed(2)}%)

Proszę o wystawienie faktury końcowej (jeśli dotyczy).

Pozdrawiam,
${data.meta.salesPerson}
  `.trim();

  const handleApproveAndSendClosing = async () => {
      if (onApproveClosing) {
          const success = await onApproveClosing();
          if (success) {
              const subject = encodeURIComponent(closingSubject);
              const body = encodeURIComponent(closingBody);
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }
      }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
        {showOfferModal && (
            <OfferGeneratorModal 
                data={data} 
                appState={appState} 
                onClose={() => setShowOfferModal(false)} 
            />
        )}

        <div className="flex items-center gap-4 mb-4">
             <button onClick={onBack} className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition-colors">
                 <ArrowLeft size={18} /> Wróć
             </button>
             <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 font-mono uppercase tracking-tight">
                 <FileText className="text-amber-500"/> Dokumenty i Logistyka
             </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* NEW: CARD OFFER GENERATOR */}
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit md:col-span-2">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 text-zinc-800 dark:text-zinc-100 font-bold text-lg">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full text-amber-600 dark:text-amber-500"><LayoutTemplate size={24}/></div>
                            Generator Oferty Handlowej
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Stwórz profesjonalną ofertę PDF dla klienta na podstawie bieżącej kalkulacji. 
                            Skonfiguruj widoczność cen (szczegółowa / zbiorcza) i ukryj koszty transportu w cenie materiału.
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowOfferModal(true)}
                        className="py-3 px-8 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-black text-white rounded-sm font-bold flex items-center gap-2 transition-colors uppercase text-xs tracking-wider shadow-lg shadow-zinc-500/20"
                    >
                        <Printer size={16}/> Generuj Ofertę
                    </button>
                </div>
            </div>

            {/* CARD 1: PROTOCOL */}
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4 text-zinc-800 dark:text-zinc-100 font-bold text-lg">
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-full text-zinc-600 dark:text-zinc-300"><FileText size={24}/></div>
                        Protokół Odbioru
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                        Generuje standardowy druk protokołu odbioru końcowego, wypełniony danymi klienta i listą dostawców. Gotowy do podpisu.
                    </p>
                    <button 
                        onClick={handlePrintProtocol}
                        className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-sm font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-wider"
                    >
                        <Printer size={16}/> Drukuj Protokół
                    </button>
                </div>
            </div>

            {/* CARD 2: OPENING EMAIL */}
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4 text-zinc-800 dark:text-zinc-100 font-bold text-lg">
                        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600 dark:text-green-400"><Mail size={24}/></div>
                        Mail do Logistyki (Otwarcie)
                    </div>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700 mb-4 font-mono text-xs overflow-y-auto max-h-48 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
                        <div className="font-bold text-zinc-800 dark:text-zinc-100 border-b dark:border-zinc-700 pb-1 mb-2">{openingSubject}</div>
                        {openingBody}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleApproveAndSendOpening}
                            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-sm font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-wider"
                        >
                            <CheckCircle2 size={16}/> Zatwierdź i Wyślij
                        </button>
                        <button 
                            onClick={handleCopyOpening}
                            className={`flex-1 py-3 rounded-sm font-bold flex items-center justify-center gap-2 transition-colors border uppercase text-xs tracking-wider ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                        >
                            {copied ? <><CheckCircle size={16}/> Skopiowano</> : <><Copy size={16}/> Kopiuj</>}
                        </button>
                    </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 text-[10px] text-zinc-400 text-center uppercase font-bold tracking-wider">
                    Waliduje dane, zapisuje wersję "OPENING" i tworzy maila.
                </div>
            </div>

            {/* CARD 3: CLOSING EMAIL */}
            <div className="bg-white dark:bg-zinc-950 p-0 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden md:col-span-2 lg:col-span-1">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4 text-zinc-800 dark:text-zinc-100 font-bold text-lg">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full text-purple-600 dark:text-purple-400"><Lock size={24}/></div>
                        Mail do Logistyki (Zamknięcie)
                    </div>
                    
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-sm border border-zinc-200 dark:border-zinc-700 mb-4 font-mono text-xs overflow-y-auto max-h-48 whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
                        <div className="font-bold text-zinc-800 dark:text-zinc-100 border-b dark:border-zinc-700 pb-1 mb-2">{closingSubject}</div>
                        {closingBody}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleApproveAndSendClosing}
                            disabled={appState.mode !== CalculationMode.FINAL}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-wider"
                        >
                            <CheckCircle2 size={16}/> Zatwierdź i Wyślij
                        </button>
                    </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 text-[10px] text-zinc-400 text-center uppercase font-bold tracking-wider">
                    {appState.mode === CalculationMode.FINAL 
                        ? 'Zapisuje wersję "FINAL" i tworzy maila z wynikiem.' 
                        : 'Wymaga trybu "Końcowa" do aktywacji.'}
                </div>
            </div>

        </div>
    </div>
  );
};
