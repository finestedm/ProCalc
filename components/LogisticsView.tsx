


import React, { useMemo } from 'react';
import { CalculationData, Supplier, SupplierStatus, TransportItem, Currency, Language } from '../types';
import { Truck, Calendar, Package, AlertCircle, BarChart3, Printer, CheckCircle2, UserCircle, Globe, Combine, Layers, ArrowRight, Clock } from 'lucide-react';

interface Props {
  data: CalculationData;
  onUpdateSupplier: (supplierId: string, updates: Partial<Supplier>) => void;
}

// --- HELPER: Business Day Calculation ---
const getNextBusinessDay = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    if (day === 5) { // Friday -> Monday
        result.setDate(result.getDate() + 3);
    } else if (day === 6) { // Saturday -> Monday
        result.setDate(result.getDate() + 2);
    } else { // Sun-Thu -> Next Day
        result.setDate(result.getDate() + 1);
    }
    return result;
};

const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
};

export const LogisticsView: React.FC<Props> = ({ data, onUpdateSupplier }) => {
  // Filter only included suppliers
  const activeSuppliers = data.suppliers.filter(s => s.isIncluded !== false);

  // Aggregate data
  const totalWeight = activeSuppliers.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, i) => itemSum + (i.weight * i.quantity), 0);
  }, 0);

  const totalTrucks = data.transport.reduce((sum, t) => {
      if (t.supplierId) {
          const s = data.suppliers.find(x => x.id === t.supplierId);
          if (s && s.isIncluded === false) return sum;
      }
      return sum + t.trucksCount;
  }, 0);
  
  const statusCounts = {
      [SupplierStatus.TO_ORDER]: activeSuppliers.filter(s => s.status === SupplierStatus.TO_ORDER).length,
      [SupplierStatus.ORDERED]: activeSuppliers.filter(s => s.status === SupplierStatus.ORDERED).length,
  };

  const getStatusColor = (status: SupplierStatus) => {
      switch(status) {
          case SupplierStatus.TO_ORDER: return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
          case SupplierStatus.ORDERED: return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      }
  };

  const handlePrintOrder = (supplier: Supplier) => {
      const printWindow = window.open('', '', 'width=900,height=1000');
      if (!printWindow) return;

      const isEn = supplier.language === Language.EN;
      
      // Labels Dictionary
      const L = {
          title: isEn ? "ORDER" : "ZAMÓWIENIE",
          date: isEn ? "Date" : "Data",
          supplier: isEn ? "Supplier" : "Dostawca",
          buyer: isEn ? "Buyer" : "Zamawiający",
          deliveryAddr: isEn ? "Delivery Address" : "Adres Dostawy",
          contact: isEn ? "Contact" : "Kontakt",
          project: isEn ? "Project" : "Projekt",
          ref: isEn ? "Ref" : "Nr Zam.",
          items: isEn ? "Items" : "Pozycje",
          desc: isEn ? "Description" : "Opis",
          qty: isEn ? "Qty" : "Ilość",
          unit: isEn ? "pcs" : "szt",
          partNo: isEn ? "Part No." : "Nr Kat.",
          weight: isEn ? "Weight" : "Waga",
          total: isEn ? "Total" : "Razem",
          notes: isEn ? "Notes" : "Uwagi",
          footer: isEn ? "Please confirm receipt of this order." : "Prosimy o potwierdzenie otrzymania zamówienia.",
          offerRef: isEn ? "Based on Offer" : "Dotyczy oferty",
      };

      const itemsHtml = supplier.items.map((item, idx) => `
        <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${item.itemDescription}</td>
            <td>${item.componentNumber}</td>
            <td style="text-align: center;">${item.quantity} ${L.unit}</td>
            <td style="text-align: right;">${item.weight} kg</td>
        </tr>
      `).join('');

      const html = `
        <html>
          <head>
            <title>${L.title} - ${supplier.name}</title>
            <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.4; color: #333; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #F0C80E; padding-bottom: 20px; }
              .title-block h1 { margin: 0; font-size: 32px; letter-spacing: 1px; color: #000; }
              .meta { text-align: right; font-size: 14px; }
              .grid { display: flex; gap: 40px; margin-bottom: 30px; }
              .box { flex: 1; }
              .box h3 { margin-top: 0; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              .box p { margin: 5px 0; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
              th { background: #f4f4f5; text-align: left; padding: 10px; font-weight: bold; border-bottom: 2px solid #ddd; }
              td { padding: 10px; border-bottom: 1px solid #eee; }
              .notes { margin-top: 30px; padding: 15px; background: #fffbeb; border: 1px solid #fde68a; font-size: 13px; }
              .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
                <div class="title-block">
                    <h1>${L.title}</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold;">${data.meta.projectNumber || ''}</p>
                </div>
                <div class="meta">
                    <p><strong>${L.date}:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>${L.ref}:</strong> ${supplier.offerNumber || '-'}</p>
                </div>
            </div>

            <div class="grid">
                <div class="box">
                    <h3>${L.buyer}</h3>
                    <p><strong>${data.orderingParty.name}</strong></p>
                    <p>${data.orderingParty.street}</p>
                    <p>${data.orderingParty.zip} ${data.orderingParty.city}</p>
                    <p>NIP: ${data.orderingParty.nip}</p>
                    ${data.meta.salesPerson ? `<p>${L.contact}: ${data.meta.salesPerson}</p>` : ''}
                </div>
                <div class="box">
                    <h3>${L.supplier}</h3>
                    <p><strong>${supplier.name}</strong></p>
                    <p>${supplier.street || '---'}</p>
                    <p>${supplier.zip || ''} ${supplier.city || ''}</p>
                    <p>${supplier.nip ? `NIP: ${supplier.nip}` : ''}</p>
                    ${supplier.phone ? `<p>Tel: ${supplier.phone}</p>` : ''}
                    ${supplier.contactPerson ? `<p>${L.contact}: ${supplier.contactPerson}</p>` : ''}
                    ${supplier.email ? `<p>Email: ${supplier.email}</p>` : ''}
                </div>
            </div>

            <div class="grid" style="margin-bottom: 10px;">
                 <div class="box">
                    <h3>${L.deliveryAddr}</h3>
                    <p><strong>${data.recipient.name}</strong></p>
                    <p>${data.recipient.street}</p>
                    <p>${data.recipient.zip} ${data.recipient.city}</p>
                    ${supplier.deliveryDate ? `<p><strong>Delivery: ${supplier.deliveryDate}</strong></p>` : ''}
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

            ${supplier.notes ? `
                <div class="notes">
                    <strong>${L.notes}:</strong><br/>
                    ${supplier.notes}
                </div>
            ` : ''}

            <div class="footer">
                ${L.footer}<br/>
                ${L.offerRef}: ${supplier.offerNumber}
            </div>
            
            <script>window.print();</script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
  };

  // --- GANTT CHART DATA PREP ---
  const projectStartDate = data.meta.orderDate ? new Date(data.meta.orderDate) : new Date();
  projectStartDate.setHours(0,0,0,0);

  const ganttData = useMemo(() => {
      return activeSuppliers.map(s => {
          let pickupDate: Date;
          let isEstimated = false;
          let label = "";

          if (s.deliveryDate === 'ASAP') {
              if (s.isOrm) {
                  // ORM ASAP = Order Date + 4 Weeks
                  pickupDate = new Date(projectStartDate);
                  pickupDate.setDate(pickupDate.getDate() + 28);
                  isEstimated = true;
                  label = "Est. 4 tyg (ORM)";
              } else {
                  // Standard ASAP = Today/Now (Assumption)
                  pickupDate = new Date();
                  label = "ASAP";
              }
          } else if (s.deliveryDate) {
              pickupDate = new Date(s.deliveryDate);
          } else {
              // No date set -> Default to today
              pickupDate = new Date();
          }
          
          // Fix time for comparison
          pickupDate.setHours(0,0,0,0);

          const deliveryDate = getNextBusinessDay(pickupDate);
          
          return {
              ...s,
              pickupDate,
              deliveryDate,
              isEstimated,
              timeLabel: label
          };
      }).sort((a, b) => a.pickupDate.getTime() - b.pickupDate.getTime());
  }, [activeSuppliers, projectStartDate]);

  // Determine Timeline Bounds
  let minDate = new Date(projectStartDate);
  minDate.setDate(minDate.getDate() - 2); // Buffer
  
  let maxDate = new Date(projectStartDate);
  maxDate.setDate(maxDate.getDate() + 35); // Default min view 5 weeks

  if (ganttData.length > 0) {
      const lastDelivery = ganttData.reduce((max, item) => item.deliveryDate > max ? item.deliveryDate : max, new Date(0));
      if (lastDelivery > maxDate) {
          maxDate = new Date(lastDelivery);
          maxDate.setDate(maxDate.getDate() + 5); // Buffer
      }
  }

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const pixelsPerDay = 40; // Scale
  const chartWidth = totalDays * pixelsPerDay;

  // --- LOGISTICS GROUPING LOGIC ---
  const combinedTransports = data.transport.filter(t => t.linkedSupplierIds && t.linkedSupplierIds.length > 0);
  const combinedSupplierIds = combinedTransports.flatMap(t => t.linkedSupplierIds || []);
  const singleJHTransportSuppliers = activeSuppliers.filter(s => {
      const isCombined = combinedSupplierIds.includes(s.id);
      const tItem = data.transport.find(t => t.supplierId === s.id);
      return !isCombined && !tItem?.isSupplierOrganized;
  });
  const supplierTransportSuppliers = activeSuppliers.filter(s => {
      const isCombined = combinedSupplierIds.includes(s.id);
      const tItem = data.transport.find(t => t.supplierId === s.id);
      return !isCombined && tItem?.isSupplierOrganized;
  });

  // --- RENDER HELPERS ---
  const renderSupplierRow = (supplier: Supplier, isSupplierTransport: boolean, isCombinedChild: boolean = false) => {
      const tItem = data.transport.find(t => t.supplierId === supplier.id);
      const totalSupplierWeight = supplier.items.reduce((s, i) => s + (i.weight * i.quantity), 0);

      return (
        <div key={supplier.id} className={`p-5 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors border-b dark:border-zinc-700 last:border-b-0 ${isCombinedChild ? 'bg-cyan-50/20 dark:bg-zinc-800/50' : ''}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{supplier.name}</h4>
                        {supplier.isOrm && <span className="text-[10px] bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded font-bold border border-green-100 dark:border-green-900">ORM</span>}
                        
                        {!isCombinedChild && (
                            <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold ${isSupplierTransport ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-500 dark:border-amber-900/50' : 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-500 dark:border-cyan-900/50'}`}>
                                {isSupplierTransport ? <UserCircle size={10}/> : <Truck size={10}/>}
                                {isSupplierTransport ? 'Dostawca' : 'JH'}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-4 items-center">
                        <span className="bg-zinc-100 dark:bg-zinc-700/50 px-2 py-0.5 rounded text-[10px]">Oferta: <strong className="text-zinc-700 dark:text-zinc-300">{supplier.offerNumber || '-'}</strong></span>
                        <span className="flex items-center gap-1">
                            {supplier.deliveryDate === 'ASAP' ? (
                                <span className="text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded text-[10px] border border-red-100 dark:border-red-900/30">ASAP</span>
                            ) : (
                                <span className="flex items-center gap-1"><Calendar size={10}/> <strong className="text-zinc-700 dark:text-zinc-300">{supplier.deliveryDate || '-'}</strong></span>
                            )}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">Waga</div>
                        <div className="font-mono font-bold text-zinc-700 dark:text-zinc-200 text-sm">{totalSupplierWeight.toLocaleString()} kg</div>
                    </div>
                    
                    <select
                        value={supplier.status}
                        onChange={(e) => onUpdateSupplier(supplier.id, { status: e.target.value as SupplierStatus })}
                        className={`px-3 py-1.5 rounded-sm border text-[10px] font-bold uppercase outline-none cursor-pointer appearance-none transition-colors ${getStatusColor(supplier.status)}`}
                    >
                        <option value={SupplierStatus.TO_ORDER}>Do Zamówienia</option>
                        <option value={SupplierStatus.ORDERED}>Zamówione</option>
                    </select>

                    <div className="flex items-center border border-zinc-200 dark:border-zinc-600 rounded-sm overflow-hidden h-[34px]">
                        {/* Language Toggle */}
                        <button
                            onClick={() => onUpdateSupplier(supplier.id, { language: supplier.language === Language.PL ? Language.EN : Language.PL })}
                            className="h-full px-2 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors w-10"
                            title="Zmień język zamówienia"
                        >
                            {supplier.language}
                        </button>
                        
                        {/* Print Button */}
                        <button 
                            className="h-full px-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors bg-white dark:bg-zinc-900"
                            title="Drukuj Zamówienie (PDF)"
                            onClick={() => handlePrintOrder(supplier)} 
                        >
                            <Printer size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Linked Transport Details */}
            {!isCombinedChild && tItem && (
                <div className={`rounded-sm p-2.5 border text-xs flex items-center gap-3 mt-2 ${isSupplierTransport ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30' : 'bg-cyan-50/50 border-cyan-100 dark:bg-cyan-900/10 dark:border-cyan-900/30'}`}>
                    <div className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Truck size={12} className={isSupplierTransport ? 'text-amber-600' : 'text-cyan-600'} /> 
                        Info:
                    </div>
                    {isSupplierTransport ? (
                        <span className="text-zinc-500 dark:text-zinc-400 italic">Transport w cenie / organizowany przez dostawcę.</span>
                    ) : (
                        <div className="flex gap-4 text-zinc-600 dark:text-zinc-400">
                            <span>Aut: <strong className="text-zinc-800 dark:text-zinc-200">{tItem.trucksCount}</strong></span>
                            <span>Koszt: <strong className="text-zinc-800 dark:text-zinc-200">{tItem.totalPrice.toFixed(2)} {tItem.currency}</strong></span>
                        </div>
                    )}
                </div>
            )}
        </div>
      );
  };

  const renderCombinedTransportCard = (transport: TransportItem) => {
      const linkedSuppliers = activeSuppliers.filter(s => transport.linkedSupplierIds?.includes(s.id));
      const totalCombinedWeight = linkedSuppliers.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0), 0);

      if (linkedSuppliers.length === 0) return null;

      return (
          <div key={transport.id} className="border-b-4 border-zinc-100 dark:border-zinc-800 last:border-b-0">
               {/* Combined Header */}
               <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 border-b border-cyan-100 dark:border-cyan-900/30 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                       <div className="bg-cyan-500 text-white p-2 rounded-lg shadow-sm">
                           <Combine size={18} />
                       </div>
                       <div>
                           <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{transport.name}</h4>
                           <div className="text-[10px] text-cyan-700 dark:text-cyan-300 mt-0.5">
                               Transport Zbiorczy (JH) | Łączy: {linkedSuppliers.length} dost.
                           </div>
                       </div>
                   </div>
                   <div className="flex gap-6 text-sm">
                        <div className="text-right">
                           <div className="text-[10px] text-zinc-400 uppercase font-bold">Auta</div>
                           <div className="font-bold text-zinc-800 dark:text-zinc-200">{transport.trucksCount}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-[10px] text-zinc-400 uppercase font-bold">Waga Całk.</div>
                           <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{totalCombinedWeight.toLocaleString()} kg</div>
                        </div>
                   </div>
               </div>
               <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                   {linkedSuppliers.map(s => renderSupplierRow(s, false, true))}
               </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
        
        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5"><Package size={64}/></div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide">Waga Całkowita</span>
                </div>
                <div className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{totalWeight.toLocaleString()} <span className="text-sm font-sans font-normal text-zinc-400">kg</span></div>
            </div>
             <div className="bg-white dark:bg-zinc-950 p-5 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5"><Truck size={64}/></div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">Auta (Plan)</span>
                </div>
                <div className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{totalTrucks}</div>
            </div>
             <div className="bg-white dark:bg-zinc-950 p-5 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 md:col-span-2 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-4">
                    <span className="text-xs font-bold uppercase tracking-wide">Status Zamówień</span>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1 bg-red-50 dark:bg-red-900/10 rounded-sm p-3 text-center border border-red-100 dark:border-red-900/30">
                        <div className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase mb-1">Do Zamówienia</div>
                        <div className="font-mono font-bold text-xl text-red-700 dark:text-red-400">{statusCounts[SupplierStatus.TO_ORDER]}</div>
                    </div>
                    <div className="flex-1 bg-green-50 dark:bg-green-900/10 rounded-sm p-3 text-center border border-green-100 dark:border-green-900/30">
                        <div className="text-[10px] text-green-500 dark:text-green-400 font-bold uppercase mb-1">Zamówione</div>
                        <div className="font-mono font-bold text-xl text-green-700 dark:text-green-400">{statusCounts[SupplierStatus.ORDERED]}</div>
                    </div>
                </div>
            </div>
        </div>
        
        {/* GANTT CHART CARD */}
        <div className="bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                <h3 className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-tight">
                    <Calendar className="text-amber-500" size={18} /> Harmonogram Dostaw
                </h3>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        <div className="w-2 h-2 rounded-full bg-amber-400"></div> Czas realizacji
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        <div className="w-2 h-2 rounded-full bg-zinc-800 dark:bg-white"></div> Dostawa
                    </div>
                </div>
            </div>
            
            <div className="relative overflow-x-auto custom-scrollbar bg-white dark:bg-zinc-950">
                <div className="min-w-[800px] p-6 pb-2" style={{ width: Math.max(800, chartWidth + 300) + 'px' }}>
                    {/* Time Axis (Dates at bottom logic needs space, so we render graph first then dates) */}
                    
                    {/* Rows */}
                    <div className="space-y-4 mb-12 relative z-10 pt-6">
                        {/* Vertical line for "Order Start" */}
                        <div className="absolute top-0 bottom-0 w-px bg-amber-500/30 border-l border-dashed border-amber-500 z-0" style={{ left: '0px' }}></div>
                        <div className="absolute -top-4 left-0 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1 rounded transform -translate-x-1/2">START</div>

                        {ganttData.map((item, idx) => {
                            // Similar calculation logic as before, ensuring safety
                            const offsetPx = ((projectStartDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * pixelsPerDay;
                            const pickupPx = ((item.pickupDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * pixelsPerDay;
                            const deliveryPx = ((item.deliveryDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * pixelsPerDay;
                            const width = Math.max(4, pickupPx - offsetPx);

                            return (
                                <div key={item.id} className="relative h-8 flex items-center group">
                                    {/* Label */}
                                    <div 
                                        className="absolute right-full mr-4 w-48 text-right text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate flex items-center justify-end gap-2"
                                        style={{ left: offsetPx - 210 }}
                                    >
                                        {item.isOrm && <span className="text-[9px] bg-green-100 text-green-800 px-1 rounded">ORM</span>}
                                        {item.name}
                                    </div>

                                    {/* Bar (Duration) */}
                                    <div 
                                        className={`absolute h-2 rounded-sm ${item.status === SupplierStatus.ORDERED ? 'bg-green-300' : 'bg-amber-200 dark:bg-amber-800'}`}
                                        style={{ left: offsetPx, width: width }}
                                    ></div>

                                    {/* Estimated Label on Bar */}
                                    {item.isEstimated && (
                                        <div 
                                            className="absolute text-[9px] text-zinc-400 top-[-10px] whitespace-nowrap"
                                            style={{ left: offsetPx + (width/2), transform: 'translateX(-50%)' }}
                                        >
                                            {item.timeLabel}
                                        </div>
                                    )}

                                    {/* Pickup Dot */}
                                    <div 
                                        className="absolute w-2 h-2 bg-zinc-400 rounded-full z-10"
                                        style={{ left: pickupPx }}
                                        title={`Odbiór: ${formatDateShort(item.pickupDate)}`}
                                    ></div>

                                    {/* Connecting Line (Pickup -> Delivery) */}
                                    <div 
                                        className="absolute h-[1px] bg-zinc-300 dark:bg-zinc-600 border-b border-dashed border-zinc-400"
                                        style={{ left: pickupPx, width: deliveryPx - pickupPx }}
                                    ></div>

                                    {/* Delivery Diamond/Dot */}
                                    <div 
                                        className="absolute w-3 h-3 bg-zinc-800 dark:bg-white rotate-45 z-20 shadow-sm cursor-help"
                                        style={{ left: deliveryPx - 6 }} // center
                                        title={`Dostawa: ${formatDateShort(item.deliveryDate)} (Dzień roboczy po odbiorze)`}
                                    ></div>

                                    {/* Date Label Next to Diamond */}
                                    <div 
                                        className="absolute text-[10px] font-bold text-zinc-600 dark:text-zinc-300 ml-2 bg-white/80 dark:bg-black/50 px-1 rounded backdrop-blur-sm"
                                        style={{ left: deliveryPx + 5 }}
                                    >
                                        {formatDateShort(item.deliveryDate)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* X-Axis Dates */}
                    <div className="relative h-8 border-t border-zinc-300 dark:border-zinc-700 mt-2">
                        {Array.from({ length: totalDays + 1 }).map((_, i) => {
                            if (i % 7 !== 0) return null; // Show every week
                            const d = new Date(minDate);
                            d.setDate(d.getDate() + i);
                            const left = i * pixelsPerDay;
                            return (
                                <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left }}>
                                    <div className="h-1.5 w-px bg-zinc-300 dark:bg-zinc-600"></div>
                                    <div className="text-[9px] text-zinc-400 mt-1 whitespace-nowrap">{formatDateShort(d)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* LOGISTICS LISTS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* 1. Transport JH (Secondary Color - Cyan) */}
            <div className="bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 px-6 py-4 border-b border-cyan-100 dark:border-cyan-900/30 flex items-center justify-between">
                    <h3 className="text-zinc-800 dark:text-zinc-100 font-bold font-mono uppercase tracking-tight flex items-center gap-2">
                        <div className="bg-cyan-500 text-white p-1.5 rounded-sm"><Truck size={16} /></div> 
                        Transport Organizowany przez JH
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold bg-white dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{combinedTransports.length} zbiorcze</span>
                        <span className="text-[10px] font-bold bg-white dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{singleJHTransportSuppliers.length} pojedyńcze</span>
                    </div>
                </div>
                
                <div className="flex flex-col">
                    {combinedTransports.length === 0 && singleJHTransportSuppliers.length === 0 && (
                        <div className="p-8 text-center text-zinc-400 italic text-sm">Brak dostawców w tej kategorii.</div>
                    )}
                    {combinedTransports.map(t => renderCombinedTransportCard(t))}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {singleJHTransportSuppliers.map(s => renderSupplierRow(s, false))}
                    </div>
                </div>
            </div>

             {/* 2. Transport Supplier (Primary/Amber or Neutral) */}
             <div className="bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit">
                <div className="bg-zinc-100 dark:bg-zinc-900 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="text-zinc-700 dark:text-zinc-200 font-bold font-mono uppercase tracking-tight flex items-center gap-2">
                        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 p-1.5 rounded-sm"><UserCircle size={16} /></div> 
                        Transport Organizowany przez Dostawcę
                    </h3>
                    <span className="text-[10px] font-bold bg-white dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{supplierTransportSuppliers.length} dostawców</span>
                </div>
                
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {supplierTransportSuppliers.length === 0 && (
                        <div className="p-8 text-center text-zinc-400 italic text-sm">Brak dostawców w tej kategorii.</div>
                    )}
                    {supplierTransportSuppliers.map(s => renderSupplierRow(s, true))}
                </div>
            </div>

        </div>
    </div>
  );
};