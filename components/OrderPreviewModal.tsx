
import React, { useState, useEffect } from 'react';
import { Supplier, CalculationData, Language } from '../types';
import { X, Printer, RefreshCw, Type, Save } from 'lucide-react';

interface Props {
  suppliers: Supplier[];
  data: CalculationData;
  onClose: () => void;
}

export const OrderPreviewModal: React.FC<Props> = ({ suppliers, data, onClose }) => {
  if (!suppliers || suppliers.length === 0) return null;

  const mainSupplier = suppliers[0];
  const [language, setLanguage] = useState<Language>(mainSupplier.language);
  
  // Editable Fields State
  const [placeDate, setPlaceDate] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [buyerText, setBuyerText] = useState('');
  const [supplierText, setSupplierText] = useState('');
  const [deliveryText, setDeliveryText] = useState('');
  const [notes, setNotes] = useState('');

  // Initialization Logic
  useEffect(() => {
    const isEn = language === Language.EN;
    const today = new Date().toLocaleDateString();
    
    setPlaceDate(`${data.recipient.city || '...................'}, ${today}`);
    setProjectRef(data.meta.projectNumber || '');
    setOrderRef(data.meta.orderNumber || '');

    // Buyer
    setBuyerText([
        data.orderingParty.name,
        data.orderingParty.street,
        `${data.orderingParty.zip} ${data.orderingParty.city}`,
        `NIP: ${data.orderingParty.nip}`,
        data.meta.salesPerson ? `${isEn ? 'Contact' : 'Kontakt'}: ${data.meta.salesPerson}` : ''
    ].filter(Boolean).join('\n'));

    // Supplier
    setSupplierText([
        mainSupplier.name,
        mainSupplier.street || '---',
        `${mainSupplier.zip || ''} ${mainSupplier.city || ''}`,
        mainSupplier.nip ? `NIP: ${mainSupplier.nip}` : '',
        mainSupplier.phone ? `Tel: ${mainSupplier.phone}` : '',
        mainSupplier.email ? `Email: ${mainSupplier.email}` : '',
        mainSupplier.contactPerson ? `${isEn ? 'Contact' : 'Kontakt'}: ${mainSupplier.contactPerson}` : ''
    ].filter(Boolean).join('\n'));

    // Delivery
    setDeliveryText([
        data.recipient.name,
        data.recipient.street,
        `${data.recipient.zip} ${data.recipient.city}`,
        mainSupplier.deliveryDate ? `${isEn ? 'Delivery' : 'Dostawa'}: ${mainSupplier.deliveryDate}` : ''
    ].filter(Boolean).join('\n'));

    // Notes
    let combinedNotes = "";
    suppliers.forEach(s => {
        if (s.notes) combinedNotes += `${suppliers.length > 1 ? s.customTabName || s.name : ''} ${s.notes}\n`;
    });
    setNotes(combinedNotes.trim());

  }, [data, mainSupplier, suppliers, language]);

  // Handle Printing
  const handlePrint = () => {
      const printWindow = window.open('', '', 'width=900,height=1000');
      if (!printWindow) return;

      const isEn = language === Language.EN;
      const L = {
          title: isEn ? "ORDER" : "ZAMÓWIENIE",
          date: isEn ? "Date" : "Data",
          supplier: isEn ? "Supplier" : "Dostawca",
          buyer: isEn ? "Buyer" : "Zamawiający",
          deliveryAddr: isEn ? "Delivery Address" : "Adres Dostawy",
          project: isEn ? "Project" : "Projekt",
          ref: isEn ? "Ref" : "Nr Zam.",
          desc: isEn ? "Description" : "Opis",
          qty: isEn ? "Qty" : "Ilość",
          unit: isEn ? "pcs" : "szt",
          partNo: isEn ? "Part No." : "Nr Kat.",
          weight: isEn ? "Weight" : "Waga",
          notes: isEn ? "Notes" : "Uwagi",
          footer: isEn ? "Please confirm receipt of this order." : "Prosimy o potwierdzenie otrzymania zamówienia.",
          offerRef: isEn ? "Based on Offer" : "Dotyczy oferty",
      };

      // Generate items HTML
      let cumulativeIndex = 1;
      const itemsHtml = suppliers.map(supplier => {
          const sectionHeader = suppliers.length > 1 
            ? `<tr><td colspan="5" style="background: #f9fafb; font-weight: bold; font-size: 11px; padding: 8px; border-bottom: 2px solid #eee; text-transform: uppercase; color: #555;">Zakładka: ${supplier.customTabName || supplier.name}</td></tr>` 
            : '';

          const rows = supplier.items.map((item) => `
            <tr>
                <td style="text-align: center;">${cumulativeIndex++}</td>
                <td>${item.itemDescription}</td>
                <td>${item.componentNumber}</td>
                <td style="text-align: center;">${item.quantity} ${L.unit}</td>
                <td style="text-align: right;">${item.weight} kg</td>
            </tr>
          `).join('');
          return sectionHeader + rows;
      }).join('');

      const totalGroupWeight = suppliers.reduce((sum, s) => sum + s.items.reduce((is, i) => is + (i.weight * i.quantity), 0), 0);

      const html = `
        <html>
          <head>
            <title>${L.title} - ${mainSupplier.name}</title>
            <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.4; color: #333; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #F0C80E; padding-bottom: 20px; }
              .title-block h1 { margin: 0; font-size: 32px; letter-spacing: 1px; color: #000; }
              .meta { text-align: right; font-size: 14px; }
              .grid { display: flex; gap: 40px; margin-bottom: 30px; }
              .box { flex: 1; }
              .box h3 { margin-top: 0; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              .box p { margin: 5px 0; font-size: 14px; white-space: pre-wrap; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
              th { background: #f4f4f5; text-align: left; padding: 10px; font-weight: bold; border-bottom: 2px solid #ddd; }
              td { padding: 10px; border-bottom: 1px solid #eee; }
              .notes { margin-top: 30px; padding: 15px; background: #fffbeb; border: 1px solid #fde68a; font-size: 13px; white-space: pre-wrap; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
              .summary { margin-top: 20px; text-align: right; font-size: 13px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
                <div class="title-block">
                    <h1>${L.title}</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold;">${projectRef}</p>
                </div>
                <div class="meta">
                    <p><strong>${L.date}:</strong> ${placeDate}</p>
                    <p><strong>${L.ref}:</strong> ${mainSupplier.offerNumber || '-'}</p>
                    <p><strong>JH Order:</strong> ${orderRef}</p>
                </div>
            </div>
            <div class="grid">
                <div class="box">
                    <h3>${L.buyer}</h3>
                    <p>${buyerText}</p>
                </div>
                <div class="box">
                    <h3>${L.supplier}</h3>
                    <p>${supplierText}</p>
                </div>
            </div>
            <div class="grid" style="margin-bottom: 10px;">
                 <div class="box">
                    <h3>${L.deliveryAddr}</h3>
                    <p>${deliveryText}</p>
                 </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th>${L.desc}</th>
                        <th style="width: 120px;">${L.partNo}</th>
                        <th style="text-align: center; width: 80px;">${L.qty}</th>
                        <th style="text-align: right; width: 80px;">${L.weight}</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="summary">
                Total Weight: ${totalGroupWeight.toLocaleString()} kg
            </div>

            ${notes ? `
                <div class="notes">
                    <strong>${L.notes}:</strong><br/>${notes}
                </div>
            ` : ''}
            <div class="footer">
                ${L.footer}<br/>
                ${L.offerRef}: ${mainSupplier.offerNumber}
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const isEn = language === Language.EN;
  const textareaClass = "w-full bg-transparent resize-none outline-none border border-transparent hover:border-zinc-200 focus:border-amber-400 p-1 rounded transition-colors text-sm font-sans";
  const labelClass = "text-[10px] font-bold text-zinc-400 uppercase border-b border-zinc-100 mb-1 pb-1";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            
            {/* Toolbar */}
            <div className="bg-zinc-800 text-white p-3 flex justify-between items-center shadow-md shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Type size={18} className="text-amber-400"/>
                        <span className="font-bold text-sm">Podgląd Zamówienia (Edycja)</span>
                    </div>
                    <div className="h-6 w-px bg-zinc-600"></div>
                    <div className="flex bg-zinc-700 rounded p-0.5">
                        <button 
                            onClick={() => setLanguage(Language.PL)}
                            className={`px-3 py-1 text-xs font-bold rounded ${language === Language.PL ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                        >
                            PL
                        </button>
                        <button 
                            onClick={() => setLanguage(Language.EN)}
                            className={`px-3 py-1 text-xs font-bold rounded ${language === Language.EN ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                        >
                            EN
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handlePrint}
                        className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                        <Printer size={14}/> Drukuj
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors">
                        <X size={20}/>
                    </button>
                </div>
            </div>

            {/* Document Preview (A4-ish Container) */}
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-200 dark:bg-black/50 flex justify-center custom-scrollbar">
                <div className="bg-white text-zinc-900 w-[210mm] min-h-[297mm] shadow-lg p-[15mm] flex flex-col relative text-[13px] leading-snug">
                    
                    {/* Header */}
                    <div className="flex justify-between border-b-2 border-amber-400 pb-6 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-wide mb-2">{isEn ? "ORDER" : "ZAMÓWIENIE"}</h1>
                            <input 
                                className="font-bold text-lg outline-none hover:bg-zinc-50 w-full" 
                                value={projectRef}
                                onChange={(e) => setProjectRef(e.target.value)}
                                placeholder="Nr Projektu"
                            />
                        </div>
                        <div className="text-right space-y-1">
                            <div className="flex justify-end gap-2 items-baseline">
                                <span className="font-bold text-xs w-20">{isEn ? "Place, Date" : "Miejscowość"}:</span>
                                <input className="text-right outline-none hover:bg-zinc-50 w-40 border-b border-dotted border-zinc-300" value={placeDate} onChange={e => setPlaceDate(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-2 items-baseline">
                                <span className="font-bold text-xs w-20">{isEn ? "Offer Ref" : "Nr Oferty"}:</span>
                                <span>{mainSupplier.offerNumber}</span>
                            </div>
                            <div className="flex justify-end gap-2 items-baseline">
                                <span className="font-bold text-xs w-20">JH Order:</span>
                                <input className="text-right outline-none hover:bg-zinc-50 w-40 border-b border-dotted border-zinc-300 font-bold" value={orderRef} onChange={e => setOrderRef(e.target.value)} placeholder="Nr Zamówienia..." />
                            </div>
                        </div>
                    </div>

                    {/* Address Grid */}
                    <div className="grid grid-cols-2 gap-12 mb-8">
                        <div>
                            <div className={labelClass}>{isEn ? "Buyer" : "Zamawiający"}</div>
                            <textarea 
                                className={textareaClass} 
                                rows={5}
                                value={buyerText}
                                onChange={(e) => setBuyerText(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className={labelClass}>{isEn ? "Supplier" : "Dostawca"}</div>
                            <textarea 
                                className={textareaClass} 
                                rows={5}
                                value={supplierText}
                                onChange={(e) => setSupplierText(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className={labelClass}>{isEn ? "Delivery Address" : "Adres Dostawy"}</div>
                        <textarea 
                            className={textareaClass} 
                            rows={3}
                            value={deliveryText}
                            onChange={(e) => setDeliveryText(e.target.value)}
                        />
                    </div>

                    {/* Static Items Table (Rendering Only) */}
                    <table className="w-full border-collapse text-sm mb-8">
                        <thead className="bg-zinc-100">
                            <tr>
                                <th className="border-b border-zinc-300 p-2 text-left w-10">#</th>
                                <th className="border-b border-zinc-300 p-2 text-left">{isEn ? "Description" : "Opis"}</th>
                                <th className="border-b border-zinc-300 p-2 text-left w-32">{isEn ? "Part No." : "Nr Kat."}</th>
                                <th className="border-b border-zinc-300 p-2 text-center w-20">{isEn ? "Qty" : "Ilość"}</th>
                                <th className="border-b border-zinc-300 p-2 text-right w-24">{isEn ? "Weight" : "Waga"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s, sIdx) => (
                                <React.Fragment key={s.id}>
                                    {suppliers.length > 1 && (
                                        <tr>
                                            <td colSpan={5} className="bg-zinc-50 p-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center border-b border-zinc-200">
                                                {s.customTabName || s.name}
                                            </td>
                                        </tr>
                                    )}
                                    {s.items.map((item, idx) => (
                                        <tr key={item.id} className="border-b border-zinc-100">
                                            <td className="p-2 text-center text-zinc-500">{idx + 1}</td>
                                            <td className="p-2">{item.itemDescription}</td>
                                            <td className="p-2 text-zinc-600 font-mono text-xs">{item.componentNumber}</td>
                                            <td className="p-2 text-center font-bold">{item.quantity}</td>
                                            <td className="p-2 text-right text-zinc-500">{item.weight} kg</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    {/* Notes */}
                    <div className="mt-auto">
                        <div className={labelClass}>{isEn ? "Notes" : "Uwagi"}</div>
                        <textarea 
                            className={`${textareaClass} bg-yellow-50 border-yellow-100 focus:border-yellow-400`}
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Wpisz dodatkowe uwagi..."
                        />
                    </div>

                    <div className="mt-12 pt-6 border-t border-zinc-200 text-center text-xs text-zinc-400">
                        {isEn ? "Please confirm receipt of this order." : "Prosimy o potwierdzenie otrzymania zamówienia."}<br/>
                        {isEn ? "Based on Offer" : "Dotyczy oferty"}: {mainSupplier.offerNumber}
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};
