
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Supplier, SupplierItem, Currency, Language, SupplierStatus, TransportItem, InstallationData } from '../types';
import { Package, Plus, Trash2, Calendar, FileSpreadsheet, Copy, Eye, EyeOff, StickyNote, Tag, Loader2, Sparkles, Euro, Maximize2, ArrowUp, ArrowDown, Search, ArrowUpDown, ChevronDown, ChevronUp, GripVertical, Settings2, ArrowLeft, ArrowRight, Zap, FolderPlus, Edit3, MessageSquarePlus } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import * as XLSX from 'xlsx';
import { extractDataFromOffer } from '../services/aiService';
import { SupplierDetailModal } from './SupplierDetailModal';
import { DataGrid } from './DataGrid';
import { convert } from '../services/calculationService';

interface Props {
  suppliers: Supplier[];
  transport: TransportItem[]; // Added for validation
  installation: InstallationData; // Added for validation
  onChange: (suppliers: Supplier[]) => void;
  onBatchChange?: (updates: { suppliers: Supplier[], transport: TransportItem[] }) => void;
  onOpenComparison: () => void;
  exchangeRate: number;
  offerCurrency: Currency;
  nameplateQty: number;
  onNameplateChange: (qty: number) => void;
  onConfirm: (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => void;
}

export const SuppliersSection: React.FC<Props> = ({ suppliers, transport, installation, onChange, onBatchChange, onOpenComparison, exchangeRate, offerCurrency, nameplateQty, onNameplateChange, onConfirm }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [detailViewIndex, setDetailViewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newOrmInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Constants
  const NAMEPLATE_TAB_INDEX = suppliers.length;

  const addSupplier = () => {
    const newSupplier: Supplier = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Nowy Dostawca',
      customTabName: 'Nowy Dostawca',
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
      notes: ''
    };
    const updated = [...suppliers, newSupplier];
    onChange(updated);
    setActiveTab(updated.length - 1);
    if (!isOpen) setIsOpen(true);
  };

  const duplicateSupplier = (index: number) => {
    const source = suppliers[index];
    if (source.isOrm) return;
    const newSupplier: Supplier = {
        ...source,
        id: Math.random().toString(36).substr(2, 9),
        name: `${source.name} (Kopia)`,
        customTabName: `${source.customTabName || source.name} (Kopia)`,
        status: SupplierStatus.TO_ORDER,
        items: source.items.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }))
    };
    const updated = [...suppliers];
    updated.splice(index + 1, 0, newSupplier);
    onChange(updated);
    setActiveTab(index + 1);
  };

  const removeSupplier = (index: number) => {
    onConfirm(
        "Usuwanie dostawcy",
        "Czy na pewno usunąć tego dostawcę? Wszystkie pozycje zostaną utracone.",
        () => {
            const updated = suppliers.filter((_, i) => i !== index);
            onChange(updated);
            if (activeTab >= updated.length) setActiveTab(Math.max(0, updated.length - 1));
        },
        true
    );
  };

  const updateSupplier = (index: number, field: keyof Supplier, value: any) => {
    // Validation for Name Change
    if (field === 'name') {
        const supplierId = suppliers[index].id;
        
        // Check Transport links
        const linkedTransport = transport.some(t => t.linkedSupplierIds?.includes(supplierId));
        
        // Check Installation links (Stages or Custom Items)
        const linkedInstallation = installation.stages.some(s => 
            s.linkedSupplierIds?.includes(supplierId) || 
            s.customItems.some(i => i.linkedSources?.some(src => src.id === supplierId))
        );

        if (linkedTransport || linkedInstallation) {
            const msg = "UWAGA: Ten dostawca jest połączony z Transportem Zbiorczym lub Etapami Montażu.\n\n" +
                        "Zmiana nazwy może spowodować niespójność danych w tych sekcjach (np. nazwy transportów zbiorczych) lub wymusić ich rozłączenie.\n\n" +
                        "Czy na pewno chcesz kontynuować?";
            
            onConfirm("Zmiana nazwy powiązanego dostawcy", msg, () => {
                const updatedSuppliers = [...suppliers];
                updatedSuppliers[index] = { ...updatedSuppliers[index], [field]: value };
                
                // --- HANDLE TRANSPORT DISCONNECTION ---
                let updatedTransport = transport;
                if (linkedTransport) {
                     updatedTransport = transport.reduce((acc, t) => {
                         if (t.linkedSupplierIds?.includes(supplierId)) {
                             // Remove this supplier from the consolidated transport
                             const newIds = t.linkedSupplierIds.filter(id => id !== supplierId);
                             
                             if (newIds.length < 2) {
                                 // Dissolve transport if less than 2 items remain
                                 // The remaining single supplier will naturally be picked up as individual transport by TransportSection
                                 return acc; 
                             } else {
                                 // Keep transport with remaining items
                                 acc.push({ ...t, linkedSupplierIds: newIds });
                                 return acc;
                             }
                         }
                         acc.push(t);
                         return acc;
                     }, [] as TransportItem[]);
                }

                // If we have onBatchChange, use it to update both. Otherwise just suppliers.
                if (onBatchChange && linkedTransport) {
                    onBatchChange({ suppliers: updatedSuppliers, transport: updatedTransport });
                } else {
                    onChange(updatedSuppliers);
                }
            }, false);
            return;
        }
    }

    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // --- FIXED ITEM OPERATIONS (Immutability) ---
  const addItem = (supplierIndex: number) => {
    const updatedSuppliers = [...suppliers];
    const supplier = { ...updatedSuppliers[supplierIndex] };
    const newItem: SupplierItem = {
      id: Math.random().toString(36).substr(2, 9),
      itemDescription: '', componentNumber: '', quantity: 1, weight: 0, unitPrice: 0
    };
    supplier.items = [...supplier.items, newItem];
    updatedSuppliers[supplierIndex] = supplier;
    onChange(updatedSuppliers);
  };

  const removeItem = (supplierIndex: number, itemId: string) => {
    const updatedSuppliers = [...suppliers];
    const supplier = { ...updatedSuppliers[supplierIndex] };
    supplier.items = supplier.items.filter(i => i.id !== itemId);
    updatedSuppliers[supplierIndex] = supplier;
    onChange(updatedSuppliers);
  };

  const updateItem = (supplierIndex: number, itemId: string, field: keyof SupplierItem, value: any) => {
    const updatedSuppliers = [...suppliers];
    const supplier = { ...updatedSuppliers[supplierIndex] };
    const items = [...supplier.items];
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;
    
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    supplier.items = items;
    updatedSuppliers[supplierIndex] = supplier;
    onChange(updatedSuppliers);
  };

  const moveItemManual = (supplierIndex: number, originalIndex: number, direction: 'up' | 'down') => {
      const updatedSuppliers = [...suppliers];
      const supplier = { ...updatedSuppliers[supplierIndex] };
      const items = [...supplier.items];
      
      if (direction === 'up' && originalIndex === 0) return;
      if (direction === 'down' && originalIndex === items.length - 1) return;

      const targetIndex = direction === 'up' ? originalIndex - 1 : originalIndex + 1;
      const temp = items[originalIndex];
      items[originalIndex] = items[targetIndex];
      items[targetIndex] = temp;
      
      supplier.items = items;
      updatedSuppliers[supplierIndex] = supplier;
      onChange(updatedSuppliers);
  };

  const checkAutoDiscount = (currentSuppliers: Supplier[], index: number) => {
      const supplier = currentSuppliers[index];
      if (!supplier.isOrm) return;
      const subtotalJH = supplier.items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice * 0.5)), 0);
      if (subtotalJH > 10000 && supplier.discount !== 17) supplier.discount = 17;
  };

  const getWeeksRemaining = (dateString: string): string | null => {
      if (!dateString) return null;
      if (dateString === 'ASAP') return '(PILNE)';
      const diffMs = new Date(dateString).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
      const diffWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
      if (diffWeeks < 0) return `(${Math.abs(diffWeeks)} tyg. temu)`;
      if (diffWeeks === 0) return '(W tym tygodniu)';
      return `(za ${diffWeeks} tyg.)`;
  };

  const parseOrmFile = (file: File, callback: (items: SupplierItem[]) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(name => name.endsWith('Items'));
        if (!sheetName) { alert('Nie znaleziono arkusza "Items".'); return; }
        const sheet = workbook.Sheets[sheetName];
        const newItems: SupplierItem[] = [];
        let rowIndex = 3; 
        while (true) {
            const quantity = sheet['A' + rowIndex]?.v;
            if (quantity === undefined || quantity === null || quantity === '') break;
            
            // Extract Time (Column M, index 12)
            const timeVal = sheet['M' + rowIndex]?.v;

            newItems.push({
                id: Math.random().toString(36).substr(2, 9),
                itemDescription: String(sheet['B' + rowIndex]?.v || ''),
                componentNumber: String(sheet['I' + rowIndex]?.v || ''),
                quantity: parseFloat(quantity as string) || 0,
                weight: parseFloat(sheet['K' + rowIndex]?.v as string) || 0,
                unitPrice: parseFloat(sheet['L' + rowIndex]?.v as string) || 0,
                timeMinutes: parseFloat(timeVal as string) || 0
            });
            rowIndex++;
            if (rowIndex > 5000) break; 
        }
        callback(newItems);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    parseOrmFile(file, (newItems) => {
        if (newItems.length > 0) {
            const updated = [...suppliers];
            updated[activeTab] = {
                ...updated[activeTab],
                items: [...updated[activeTab].items, ...newItems],
                isOrm: true,
                currency: Currency.EUR,
                name: "ORM Import"
            };
            checkAutoDiscount(updated, activeTab);
            onChange(updated);
        }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewOrmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      parseOrmFile(file, (newItems) => {
          if (newItems.length > 0) {
              const fileName = file.name.split('.')[0].substring(0, 15);
              const newSupplier: Supplier = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: `ORM ${fileName}`, // Supplier Name
                  customTabName: `ORM ${fileName}`, // Default Tab Name
                  offerNumber: '',
                  offerDate: '',
                  deliveryDate: '',
                  currency: Currency.EUR,
                  discount: 0,
                  language: Language.PL,
                  items: newItems,
                  isOrm: true,
                  status: SupplierStatus.TO_ORDER,
                  isIncluded: true,
                  notes: ''
              };
              
              const updated = [...suppliers, newSupplier];
              checkAutoDiscount(updated, updated.length - 1);
              onChange(updated);
              setActiveTab(updated.length - 1); // Switch to new tab
          }
      });
      if (newOrmInputRef.current) newOrmInputRef.current.value = '';
  };

  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const base64String = (event.target?.result as string).split(',')[1];
            const result = await extractDataFromOffer(base64String, file.type);
            
            const updated = [...suppliers];
            const current = updated[activeTab];
            
            const newSupplierState = { ...current };
            newSupplierState.items = [...newSupplierState.items, ...result.items];
            newSupplierState.currency = result.currency as Currency;
            if (result.discount > 0) newSupplierState.discount = result.discount;
            if (result.name) {
                newSupplierState.name = result.name;
                if(!newSupplierState.customTabName) newSupplierState.customTabName = result.name;
            }
            if (result.offerNumber) newSupplierState.offerNumber = result.offerNumber;
            
            updated[activeTab] = newSupplierState;
            onChange(updated);
            alert(`Pomyślnie zaimportowano ${result.items.length} pozycji.`);
        } catch (err) {
            console.error(err);
            alert("Błąd podczas analizy pliku. Spróbuj ponownie.");
        } finally {
            setIsImporting(false);
        }
    };
    reader.readAsDataURL(file);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  // --- Calculate Total for Header ---
  const totalCost = suppliers.reduce((acc, s) => {
    if (s.isIncluded === false) return acc;
    const sTotal = s.items.reduce((sum, i) => {
        const price = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
        return sum + (i.quantity * price);
    }, 0);
    const discounted = sTotal * (1 - s.discount / 100);
    return acc + convert(discounted, s.currency, offerCurrency, exchangeRate);
  }, 0);
  
  const nameplateCost = convert((nameplateQty || 0) * 19, Currency.PLN, offerCurrency, exchangeRate);
  const totalWithNameplate = totalCost + nameplateCost;

  const currentSupplier = activeTab < suppliers.length ? suppliers[activeTab] : null;
  const isCurrentIncluded = currentSupplier ? currentSupplier.isIncluded !== false : true;
  const isNameplateTab = activeTab === NAMEPLATE_TAB_INDEX;
  
  // Calculate Subtotal for the Active Supplier Table
  const activeSupplierSubtotal = currentSupplier ? currentSupplier.items.reduce((sum, i) => {
      const price = currentSupplier.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
      return sum + (i.quantity * price);
  }, 0) : 0;
  const activeSupplierTotal = activeSupplierSubtotal * (1 - (currentSupplier?.discount || 0) / 100);

  const supplierMenuItems = [
      { label: 'Importuj Excel (Dołącz do aktywnej)', icon: <FileSpreadsheet size={16} />, onClick: () => fileInputRef.current?.click() },
      { label: 'Inteligentny Import (PDF/Img)', icon: <Sparkles size={16} />, onClick: () => pdfInputRef.current?.click() },
      { label: 'Duplikuj', icon: <Copy size={16} />, onClick: () => duplicateSupplier(activeTab), disabled: currentSupplier?.isOrm },
      { label: 'Usuń dostawcę', icon: <Trash2 size={16} />, onClick: () => removeSupplier(activeTab), danger: true }
  ];

  const handleAddNotes = () => {
      // Just ensure notes string is initialized so the textarea renders
      updateSupplier(activeTab, 'notes', ' ');
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors relative">
      {isImporting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 z-20 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-yellow-500 mb-2" size={40} />
              <p className="text-zinc-800 dark:text-zinc-200 font-semibold animate-pulse">Analizuję ofertę (AI)...</p>
          </div>
      )}
      
      <div 
          className="p-4 flex justify-between items-center cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Package className="text-yellow-500" size={20} /> Koszty Dostawców
        </h2>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {totalWithNameplate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offerCurrency}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-100 dark:border-zinc-700">
            {/* Top Padded Section for Tabs and Header Controls */}
            <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30">
                {/* TABS */}
                <div className="flex overflow-x-auto gap-2 mb-4 border-b dark:border-zinc-700 pb-1 items-end">
                    {suppliers.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveTab(idx)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                                activeTab === idx
                                ? `bg-white dark:bg-zinc-700 border-yellow-500 text-zinc-900 dark:text-white shadow-sm ${s.isIncluded === false ? 'opacity-50' : ''}`
                                : `bg-transparent border-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${s.isIncluded === false ? 'opacity-40' : ''}`
                            } ${s.status === SupplierStatus.ORDERED ? 'border-t-4 border-t-green-400' : 'border-t-4 border-t-orange-400'}`}
                        >
                            {/* Display Custom Tab Name or Default Name */}
                            {s.customTabName || s.name}
                        </button>
                    ))}

                    {/* Dedicated Nameplate Tab */}
                    <button
                        onClick={() => setActiveTab(NAMEPLATE_TAB_INDEX)}
                        className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${
                            isNameplateTab
                            ? 'bg-white dark:bg-zinc-700 border-yellow-500 text-zinc-900 dark:text-white shadow-sm'
                            : 'bg-transparent border-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                    >
                        <Tag size={14} className={isNameplateTab ? "text-yellow-600" : ""} /> Tabliczki
                    </button>

                    <div className="flex items-center gap-1 border-l pl-2 ml-1 border-zinc-300 dark:border-zinc-600">
                         {/* Import New ORM Button */}
                        <button
                            onClick={() => newOrmInputRef.current?.click()}
                            className="px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors border-b-2 border-transparent bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 flex items-center justify-center gap-1"
                            title="Importuj jako nowy dostawca ORM"
                        >
                            <FileSpreadsheet size={16} /> <Plus size={12} className="-ml-1"/>
                        </button>

                        {/* Add Supplier Tab Button */}
                        <button
                            onClick={addSupplier}
                            className="px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors border-b-2 border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-yellow-600 flex items-center justify-center"
                            title="Dodaj pustego Dostawcę"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* --- SUPPLIER HEADER CONTROLS --- */}
                {!isNameplateTab && currentSupplier && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-2">
                        {/* Tab Name Editing */}
                        <div className="col-span-1 md:col-span-2">
                             <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                                <Edit3 size={10} /> Nazwa Zakładki
                             </label>
                             <input
                                type="text"
                                className="w-full p-2 border rounded text-sm focus:border-yellow-400 outline-none bg-white dark:bg-zinc-800 font-bold"
                                value={currentSupplier.customTabName || currentSupplier.name}
                                onChange={(e) => updateSupplier(activeTab, 'customTabName', e.target.value)}
                                placeholder="Nazwa widoczna na zakładce"
                             />
                        </div>

                        {/* Supplier Name (Official) */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">Dostawca (w systemie)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className={`w-full p-2 border rounded text-sm focus:border-yellow-400 outline-none ${!isCurrentIncluded ? 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-800'}`}
                                    value={currentSupplier.name}
                                    onChange={(e) => updateSupplier(activeTab, 'name', e.target.value)}
                                    disabled={!isCurrentIncluded}
                                    placeholder="Oficjalna nazwa dostawcy"
                                />
                                <button 
                                    onClick={() => updateSupplier(activeTab, 'isIncluded', !isCurrentIncluded)}
                                    className={`p-2 rounded border flex-shrink-0 transition-colors ${
                                        isCurrentIncluded 
                                        ? 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-500' 
                                        : 'bg-red-50 text-red-600'
                                    }`}
                                    style={{ pointerEvents: 'auto' }} 
                                >
                                    {isCurrentIncluded ? <Eye size={18}/> : <EyeOff size={18}/>}
                                </button>
                                <button
                                    onClick={() => setDetailViewIndex(activeTab)}
                                    className="p-2 rounded border bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-yellow-600 hover:border-yellow-400 transition-colors"
                                    title="Rozszerz / Edytuj szczegóły"
                                >
                                    <Maximize2 size={18} />
                                </button>
                                <DropdownMenu items={supplierMenuItems} />
                            </div>
                            {currentSupplier.isOrm && <span className="text-[10px] text-green-600 dark:text-green-400 font-bold ml-1">ORM</span>}
                        </div>
                        
                        <div className={`contents transition-opacity duration-200 ${isCurrentIncluded ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none select-none'}`}>
                            {/* Currency Selector */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">Waluta</label>
                                <div className="relative">
                                    <Euro className="absolute left-2 top-2.5 text-zinc-400" size={14}/>
                                    <select
                                        className="w-full pl-8 p-2 border rounded text-sm outline-none focus:border-yellow-400 bg-white dark:bg-zinc-800 disabled:bg-zinc-100 dark:disabled:bg-zinc-700"
                                        value={currentSupplier.currency}
                                        onChange={(e) => updateSupplier(activeTab, 'currency', e.target.value)}
                                        disabled={currentSupplier.isOrm}
                                    >
                                        <option value={Currency.PLN}>PLN</option>
                                        <option value={Currency.EUR}>EUR</option>
                                    </select>
                                </div>
                            </div>

                            <div className="col-span-1 lg:col-span-2">
                                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                                    Dostawa <span className="text-[10px] font-normal text-zinc-500">{getWeeksRemaining(currentSupplier.deliveryDate)}</span>
                                </label>
                                <div className="flex gap-1 items-center flex-nowrap">
                                    <div className="relative flex-1 min-w-0">
                                        <Calendar className="absolute left-2 top-2.5 text-zinc-400" size={14}/>
                                        <input
                                            type="date"
                                            className="w-full pl-8 p-2 border rounded text-sm focus:border-yellow-400 outline-none bg-white dark:bg-zinc-800 disabled:bg-zinc-100 dark:disabled:bg-zinc-700 disabled:text-zinc-400"
                                            value={currentSupplier.deliveryDate === 'ASAP' ? '' : currentSupplier.deliveryDate}
                                            onChange={(e) => updateSupplier(activeTab, 'deliveryDate', e.target.value)}
                                            disabled={currentSupplier.deliveryDate === 'ASAP'}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => updateSupplier(activeTab, 'deliveryDate', currentSupplier.deliveryDate === 'ASAP' ? '' : 'ASAP')}
                                        className={`px-2 py-2 rounded text-[10px] font-bold border transition-colors flex-shrink-0 whitespace-nowrap h-[38px] ${currentSupplier.deliveryDate === 'ASAP' ? 'bg-red-500 text-white border-red-600' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-red-400 hover:text-red-500'}`}
                                        title="Ustaw ASAP"
                                    >
                                        ASAP
                                    </button>
                                </div>
                            </div>
                           
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                            <input type="file" ref={newOrmInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleNewOrmUpload} />
                            <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf, .png, .jpg, .jpeg" onChange={handleSmartImport} />
                        </div>
                    </div>
                )}
            </div>

            {/* --- NAMEPLATE VIEW --- */}
            {isNameplateTab && (
                <div className="bg-zinc-50 dark:bg-zinc-900 p-8 animate-fadeIn flex flex-col items-center text-center">
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full mb-4">
                        <Tag size={40} className="text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">Tabliczki Znamionowe</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 max-w-md">
                        Wprowadź ilość tabliczek znamionowych wymaganych dla tego projektu. 
                        Koszt jednostkowy jest stały i wynosi 19 PLN.
                    </p>

                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row items-center gap-8">
                        <div className="text-center">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Cena Jedn.</label>
                            <div className="text-xl font-bold text-zinc-400">19.00 PLN</div>
                        </div>
                        <div className="text-2xl text-zinc-300 dark:text-zinc-600 font-light">×</div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Ilość Sztuk</label>
                            <input 
                                type="number" 
                                min="0" 
                                value={nameplateQty || 0} 
                                onChange={(e) => onNameplateChange(parseFloat(e.target.value) || 0)} 
                                className="w-32 p-3 text-center text-2xl font-bold border-2 rounded-lg border-zinc-200 focus:border-yellow-400 outline-none bg-transparent" 
                            />
                        </div>
                        <div className="text-2xl text-zinc-300 dark:text-zinc-600 font-light">=</div>
                        <div className="text-center">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Koszt Całkowity</label>
                            <div className="text-3xl font-mono font-bold text-yellow-600 dark:text-yellow-500">
                                {(nameplateQty * 19).toFixed(2)} PLN
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SUPPLIER DETAIL VIEW (DataGrid) --- */}
            {!isNameplateTab && currentSupplier && (
                <div className={`transition-opacity duration-200 ${isCurrentIncluded ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none select-none'}`}>
                    
                    {/* Flush DataGrid Implementation */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700">
                        <DataGrid 
                            items={currentSupplier.items}
                            currency={currentSupplier.currency}
                            isOrm={currentSupplier.isOrm}
                            onUpdateItem={(id, field, value) => updateItem(activeTab, id, field, value)}
                            onDeleteItem={(id) => removeItem(activeTab, id)}
                            onAddItem={() => addItem(activeTab)}
                            onMoveItem={(idx, dir) => moveItemManual(activeTab, idx, dir)}
                            className="max-h-[70vh] border-0 rounded-none shadow-none" 
                        />
                    </div>

                    {/* Footer Summary Bar for the Table */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 px-4 py-2 flex justify-between items-center border-t border-yellow-100 dark:border-yellow-900/30">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                            Suma pozycji dla "{currentSupplier.customTabName || currentSupplier.name}"
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-zinc-500">
                                Suma: <span className="font-mono">{activeSupplierSubtotal.toFixed(2)}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-bold uppercase">Rabat (%)</span>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    className="w-16 p-1 border rounded text-center text-sm focus:border-yellow-400 outline-none font-bold bg-white dark:bg-zinc-800" 
                                    value={currentSupplier.discount} 
                                    onChange={(e) => updateSupplier(activeTab, 'discount', parseFloat(e.target.value) || 0)} 
                                />
                            </div>
                            <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                = {activeSupplierTotal.toFixed(2)} {currentSupplier.currency}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                        <label className="block text-xs font-bold text-zinc-500 mb-2 flex items-center gap-1">
                            <StickyNote size={12}/> Dodatkowe Uwagi (do zamówienia)
                        </label>
                        
                        {!currentSupplier.notes ? (
                             <button 
                                onClick={handleAddNotes}
                                className="text-xs flex items-center gap-1 text-zinc-500 hover:text-yellow-600 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded hover:border-yellow-400 transition-all"
                             >
                                 <MessageSquarePlus size={14}/> Dodaj uwagi
                             </button>
                        ) : (
                            <textarea 
                                className="w-full p-3 border rounded text-sm min-h-[80px] focus:border-yellow-400 outline-none bg-white dark:bg-zinc-900 animate-fadeIn" 
                                placeholder="Wpisz uwagi..." 
                                value={currentSupplier.notes || ''} 
                                onChange={(e) => updateSupplier(activeTab, 'notes', e.target.value)} 
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
      )}

      {detailViewIndex !== null && suppliers[detailViewIndex] && (
        <SupplierDetailModal 
            supplier={suppliers[detailViewIndex]}
            onSave={(updatedSupplier) => {
                const newSuppliers = [...suppliers];
                newSuppliers[detailViewIndex] = updatedSupplier;
                onChange(newSuppliers);
                setDetailViewIndex(null);
            }}
            onClose={() => setDetailViewIndex(null)}
        />
      )}
    </div>
  );
};
