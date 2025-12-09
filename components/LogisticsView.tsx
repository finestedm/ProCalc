
import React, { useState } from 'react';
import { CalculationData, Supplier, SupplierStatus, TransportItem, Language } from '../types';
import { Truck, Calendar, Package, Printer, UserCircle, Combine, LayoutDashboard, Flag } from 'lucide-react';
import { GanttChart } from './GanttChart';

interface Props {
  data: CalculationData;
  onChange: (data: CalculationData) => void;
}

// --- HELPER: Transport Organization Detection ---
const isOrganizedBySupplier = (s: Supplier, transport: TransportItem[]) => {
    const tItem = transport.find(t => t.supplierId === s.id);
    if (tItem) return tItem.isSupplierOrganized;
    const transportKeywords = ['transport', 'dostawa', 'delivery', 'shipping', 'przesyłka', 'fracht'];
    return s.items.some(i => 
        transportKeywords.some(keyword => i.itemDescription.toLowerCase().includes(keyword))
    );
};

export const LogisticsView: React.FC<Props> = ({ data, onChange }) => {
  const onUpdateSupplier = (supplierId: string, updates: Partial<Supplier>) => {
      const updatedSuppliers = data.suppliers.map(s => s.id === supplierId ? { ...s, ...updates } : s);
      onChange({ ...data, suppliers: updatedSuppliers });
  };

  const updateInstallation = (updates: Partial<typeof data.installation>) => {
      onChange({ ...data, installation: { ...data.installation, ...updates } });
  };

  const activeSuppliers = data.suppliers.filter(s => s.isIncluded !== false);

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
          case SupplierStatus.TO_ORDER: return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
          case SupplierStatus.ORDERED: return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      }
  };

  const handlePrintOrder = (supplier: Supplier) => {
      // (Print logic preserved as is)
      const printWindow = window.open('', '', 'width=900,height=1000');
      if (!printWindow) return;

      const isEn = supplier.language === Language.EN;
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

  const combinedTransports = data.transport.filter(t => t.linkedSupplierIds && t.linkedSupplierIds.length > 0);
  const combinedSupplierIds = combinedTransports.flatMap(t => t.linkedSupplierIds || []);
  
  const singleJHTransportSuppliers = activeSuppliers.filter(s => {
      const isCombined = combinedSupplierIds.includes(s.id);
      const isSupplierOrg = isOrganizedBySupplier(s, data.transport);
      return !isCombined && !isSupplierOrg;
  });
  
  const supplierTransportSuppliers = activeSuppliers.filter(s => {
      const isCombined = combinedSupplierIds.includes(s.id);
      const isSupplierOrg = isOrganizedBySupplier(s, data.transport);
      return !isCombined && isSupplierOrg;
  });

  const renderSupplierRow = (supplier: Supplier, isSupplierTransport: boolean, isCombinedChild: boolean = false) => {
      const tItem = data.transport.find(t => t.supplierId === supplier.id);
      const totalSupplierWeight = supplier.items.reduce((s, i) => s + (i.weight * i.quantity), 0);
      const showTransportInfo = !isCombinedChild && (tItem || isSupplierTransport);

      return (
        <div key={supplier.id} className={`p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isCombinedChild ? 'pl-8 bg-zinc-50/50 dark:bg-zinc-900/30' : ''}`}>
            
            {/* Info Block */}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{supplier.name}</h4>
                    {supplier.isOrm && <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">ORM</span>}
                    {isCombinedChild && <span className="text-[9px] text-zinc-400 flex items-center gap-1"><Combine size={10}/> w/ zbiorczym</span>}
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 items-center">
                    <span className="flex items-center gap-1 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                        REF: {supplier.offerNumber || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12}/> 
                        {supplier.deliveryDate === 'ASAP' ? <span className="text-red-600 font-bold">ASAP</span> : <span className="font-mono">{supplier.deliveryDate || '-'}</span>}
                    </span>
                    <span className="flex items-center gap-1">
                        <Package size={12}/> <span className="font-mono font-bold">{totalSupplierWeight.toLocaleString()} kg</span>
                    </span>
                </div>

                {showTransportInfo && (
                    <div className="mt-2 text-[10px] text-zinc-400 flex items-center gap-2">
                        {isSupplierTransport ? (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1"><UserCircle size={10}/> Org. Dostawcy</span>
                        ) : tItem && (
                            <span className="bg-cyan-50 text-cyan-700 border border-cyan-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Truck size={10}/> {tItem.trucksCount} aut ({tItem.totalPrice.toFixed(0)} {tItem.currency})
                            </span>
                        )}
                    </div>
                )}
            </div>
            
            {/* Actions Block */}
            <div className="flex items-center gap-3">
                <select
                    value={supplier.status}
                    onChange={(e) => onUpdateSupplier(supplier.id, { status: e.target.value as SupplierStatus })}
                    className={`h-8 px-3 rounded-sm text-[10px] font-bold uppercase outline-none border transition-colors cursor-pointer appearance-none ${getStatusColor(supplier.status)}`}
                >
                    <option value={SupplierStatus.TO_ORDER}>Do Zamówienia</option>
                    <option value={SupplierStatus.ORDERED}>Zamówione</option>
                </select>

                <div className="flex items-center h-8 border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                    <button
                        onClick={() => onUpdateSupplier(supplier.id, { language: supplier.language === Language.PL ? Language.EN : Language.PL })}
                        className="h-full px-2 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 border-r border-zinc-200 dark:border-zinc-700 transition-colors w-8 flex items-center justify-center"
                        title="Zmień język zamówienia"
                    >
                        {supplier.language}
                    </button>
                    <button 
                        className="h-full px-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-900 flex items-center justify-center"
                        title="Drukuj Zamówienie (PDF)"
                        onClick={() => handlePrintOrder(supplier)} 
                    >
                        <Printer size={14} />
                    </button>
                </div>
            </div>
        </div>
      );
  };

  const renderCombinedTransportCard = (transport: TransportItem) => {
      const linkedSuppliers = activeSuppliers.filter(s => transport.linkedSupplierIds?.includes(s.id));
      const totalCombinedWeight = linkedSuppliers.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + (i.weight * i.quantity), 0), 0);

      if (linkedSuppliers.length === 0) return null;

      return (
          <div key={transport.id} className="border-b-4 border-zinc-100 dark:border-zinc-800 last:border-b-0">
               <div className="bg-cyan-50/50 dark:bg-cyan-900/10 p-4 border-b border-cyan-100 dark:border-cyan-900/30 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                       <div className="bg-cyan-500 text-white p-1.5 rounded-sm shadow-sm">
                           <Combine size={16} />
                       </div>
                       <div>
                           <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{transport.name}</h4>
                           <div className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-bold uppercase tracking-wide">
                               Transport Zbiorczy (JH)
                           </div>
                       </div>
                   </div>
                   <div className="flex gap-6 text-sm items-center">
                        <div className="text-right">
                           <div className="text-[9px] text-zinc-400 uppercase font-bold">Auta</div>
                           <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{transport.trucksCount}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-[9px] text-zinc-400 uppercase font-bold">Waga Całk.</div>
                           <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{totalCombinedWeight.toLocaleString()} kg</div>
                        </div>
                   </div>
               </div>
               <div className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                   {linkedSuppliers.map(s => renderSupplierRow(s, false, true))}
               </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
        
        {/* KPI CARDS - Styled like SummarySection */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between relative group">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Waga Całkowita</span>
                <div className="text-2xl font-mono font-bold text-amber-500">
                    {totalWeight.toLocaleString()} <span className="text-sm text-zinc-400 font-sans font-normal">kg</span>
                </div>
                <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-full opacity-80"></div>
                </div>
            </div>

             <div className="bg-white dark:bg-zinc-950 p-6 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between relative group">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Auta (Plan)</span>
                <div className="text-2xl font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    {totalTrucks}
                </div>
                <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 w-full opacity-80"></div>
                </div>
            </div>

             <div className="bg-white dark:bg-zinc-950 p-4 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 md:col-span-2 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-zinc-400 mb-3">
                    <Flag size={12}/> <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Status Zamówień</span>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-2 rounded-sm flex justify-between items-center px-4">
                        <span className="text-[10px] font-bold text-red-600 uppercase">Do Zamówienia</span>
                        <span className="font-mono font-bold text-xl text-red-700 dark:text-red-400">{statusCounts[SupplierStatus.TO_ORDER]}</span>
                    </div>
                    <div className="flex-1 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-2 rounded-sm flex justify-between items-center px-4">
                        <span className="text-[10px] font-bold text-green-600 uppercase">Zamówione</span>
                        <span className="font-mono font-bold text-xl text-green-700 dark:text-green-400">{statusCounts[SupplierStatus.ORDERED]}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* GANTT CHART */}
        <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <GanttChart 
                suppliers={activeSuppliers}
                installation={data.installation}
                meta={data.meta}
                transport={data.transport}
                onUpdateInstallation={updateInstallation}
                onUpdateSupplier={onUpdateSupplier}
                tasks={data.tasks}
                onUpdateTasks={(tasks) => onChange({ ...data, tasks })}
            />
        </div>

        {/* LOGISTICS LISTS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* 1. Transport JH */}
            <div className="bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-sm text-cyan-600 dark:text-cyan-400">
                            <Truck size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Transport JH</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Organizowane przez nas</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded">
                        {combinedTransports.length + singleJHTransportSuppliers.length} pozycji
                    </div>
                </div>
                
                <div className="flex flex-col">
                    {combinedTransports.length === 0 && singleJHTransportSuppliers.length === 0 && (
                        <div className="p-8 text-center text-zinc-400 italic text-xs">Brak pozycji w tej kategorii.</div>
                    )}
                    {combinedTransports.map(t => renderCombinedTransportCard(t))}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                        {singleJHTransportSuppliers.map(s => renderSupplierRow(s, false))}
                    </div>
                </div>
            </div>

             {/* 2. Transport Supplier */}
             <div className="bg-white dark:bg-zinc-950 rounded-sm shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-fit">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                            <UserCircle size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Transport Dostawcy</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">W cenie / po stronie dostawcy</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-mono font-bold text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded">
                        {supplierTransportSuppliers.length} pozycji
                    </div>
                </div>
                
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                    {supplierTransportSuppliers.length === 0 && (
                        <div className="p-8 text-center text-zinc-400 italic text-xs">Brak pozycji w tej kategorii.</div>
                    )}
                    {supplierTransportSuppliers.map(s => renderSupplierRow(s, true))}
                </div>
            </div>

        </div>
    </div>
  );
};
