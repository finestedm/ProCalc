
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Supplier, SupplierItem, Currency, Language, SupplierStatus, TransportItem, InstallationData, VariantItemType } from '../types';
import { Package, Plus, Trash2, Calendar, FileSpreadsheet, Copy, Eye, EyeOff, StickyNote, Tag, Loader2, Sparkles, Euro, Maximize2, ArrowUp, ArrowDown, Search, ArrowUpDown, ChevronDown, ChevronUp, GripVertical, Settings2, ArrowLeft, ArrowRight, Zap, FolderPlus, Edit3, MessageSquarePlus, SplitSquareHorizontal, MousePointer2, AlertTriangle, CheckCircle } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import * as XLSX from 'xlsx';
import { extractDataFromOffer } from '../services/aiService';
import { SupplierDetailModal } from './SupplierDetailModal';
import { DataGrid } from './DataGrid';
import { convert, formatCurrency, formatNumber } from '../services/calculationService';
import { PREDEFINED_SUPPLIERS } from '../services/supplierDatabase';

interface Props {
  suppliers: Supplier[];
  transport: TransportItem[];
  installation: InstallationData;
  onChange: (suppliers: Supplier[]) => void;
  onBatchChange?: (updates: { suppliers: Supplier[], transport: TransportItem[] }) => void;
  onOpenComparison: () => void;
  exchangeRate: number;
  offerCurrency: Currency;
  nameplateQty: number;
  onNameplateChange: (qty: number) => void;
  onConfirm: (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => void;
  isPickingMode?: boolean;
  onPick?: (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => void;
}

interface OrmSheetResult {
    sheetName: string;
    items: SupplierItem[];
}

// --- VALIDATION HELPER ---
const validateSupplierData = (s: Supplier): { isValid: boolean, missing: string[] } => {
    // Skip system/excluded suppliers
    if (s.isOrm || s.isIncluded === false) return { isValid: true, missing: [] };

    const missing: string[] = [];

    // Basic Fields
    if (!s.name?.trim()) missing.push('Nazwa');
    if (!s.street?.trim()) missing.push('Ulica');
    if (!s.city?.trim()) missing.push('Miasto');

    // NIP Validation (10 digits, allow formatting chars)
    const cleanNip = (s.nip || '').replace(/[^0-9]/g, '');
    if (cleanNip.length !== 10) missing.push('NIP (10 cyfr)');

    // Zip Validation (XX-XXX or XXXXX)
    const zipPattern = /^\d{2}-?\d{3}$/;
    if (!zipPattern.test(s.zip || '')) missing.push('Kod pocztowy');

    // Email Validation (Basic)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(s.email || '')) missing.push('Email');

    return { isValid: missing.length === 0, missing };
};

export const SuppliersSection: React.FC<Props> = ({ 
    suppliers, transport, installation, onChange, onBatchChange, onOpenComparison, exchangeRate, offerCurrency, nameplateQty, onNameplateChange, onConfirm,
    isPickingMode, onPick 
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [detailViewIndex, setDetailViewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newOrmInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const NAMEPLATE_TAB_INDEX = suppliers.length;

  // Picking Handler for Header (Whole Supplier Group)
  const handleSupplierGroupPick = (e: React.MouseEvent, s: Supplier) => {
      if (isPickingMode && onPick) {
          e.preventDefault();
          e.stopPropagation();
          onPick({
              id: `group_supp_${s.id}`, // Special ID prefix for whole group
              type: 'SUPPLIER_ITEM',
              label: `DOSTAWCA: ${s.customTabName || s.name}`
          }, { x: e.clientX, y: e.clientY });
      }
  };

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
    if (field === 'name') {
        const supplierId = suppliers[index].id;
        const linkedTransport = transport.some(t => t.linkedSupplierIds?.includes(supplierId));
        const linkedInstallation = installation.stages.some(s => 
            s.linkedSupplierIds?.includes(supplierId) || 
            s.customItems.some(i => i.linkedSources?.some(src => src.id === supplierId))
        );

        if (linkedTransport || linkedInstallation) {
            const msg = "UWAGA: Ten dostawca jest połączony z Transportem Zbiorczym lub Etapami Montażu.\n\n" +
                        "Zmiana nazwy może spowodować niespójność danych w tych sekcjach.\n\n" +
                        "Czy na pewno chcesz kontynuować?";
            
            onConfirm("Zmiana nazwy powiązanego dostawcy", msg, () => {
                const updatedSuppliers = [...suppliers];
                updatedSuppliers[index] = { ...updatedSuppliers[index], [field]: value };
                
                let updatedTransport = transport;
                if (linkedTransport) {
                     updatedTransport = transport.reduce((acc, t) => {
                         if (t.linkedSupplierIds?.includes(supplierId)) {
                             const newIds = t.linkedSupplierIds.filter(id => id !== supplierId);
                             if (newIds.length < 2) {
                                 return acc; 
                             } else {
                                 acc.push({ ...t, linkedSupplierIds: newIds });
                                 return acc;
                             }
                         }
                         acc.push(t);
                         return acc;
                     }, [] as TransportItem[]);
                }

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

  // Logic to handle supplier selection from DB or custom
  const handleSupplierSelect = (index: number, selectedName: string) => {
      const dbSupplier = PREDEFINED_SUPPLIERS.find(s => s.name === selectedName);
      const updated = [...suppliers];
      const current = { ...updated[index] };

      if (dbSupplier) {
          // Fill from DB
          current.name = dbSupplier.name;
          current.customTabName = dbSupplier.name;
          current.street = dbSupplier.street;
          current.zip = dbSupplier.zip;
          current.city = dbSupplier.city;
          current.nip = dbSupplier.nip;
          current.email = dbSupplier.email;
          current.phone = dbSupplier.phone;
          current.contactPerson = dbSupplier.contactPerson;
      } else if (selectedName === 'OTHER') {
          // Reset to custom/manual
          current.name = 'Inny Dostawca';
          current.customTabName = 'Inny Dostawca';
          // Clear address fields to force manual entry
          current.street = '';
          current.zip = '';
          current.city = '';
          current.nip = '';
          current.email = '';
          current.phone = '';
          current.contactPerson = '';
      }

      updated[index] = current;
      onChange(updated);
  };

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

  const reorderItems = (supplierIndex: number, fromIndex: number, toIndex: number) => {
      const updatedSuppliers = [...suppliers];
      const supplier = { ...updatedSuppliers[supplierIndex] };
      const items = [...supplier.items];
      
      const [movedItem] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, movedItem);
      
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

  const parseOrmFile = (file: File, callback: (results: OrmSheetResult[], warning?: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const results: OrmSheetResult[] = [];
        let expiredWarning = undefined;

        if (workbook.SheetNames.length > 0) {
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const cellB4 = firstSheet['B4'];
            
            if (cellB4 && typeof cellB4.v === 'string') {
                const text = cellB4.v;
                const match = text.match(/=>\s*(\d{2}\/\d{2}\/\d{4})/);
                
                if (match && match[1]) {
                    const [day, month, year] = match[1].split('/').map(Number);
                    const expiryDate = new Date(year, month - 1, day); 
                    const today = new Date();
                    today.setHours(0,0,0,0);

                    if (expiryDate < today) {
                        expiredWarning = `UWAGA: Wykryto nieaktualny cennik!\n\nOdczytano datę ważności: ${match[1]}\n(Komórka B4 w arkuszu "${firstSheetName}")\n\nCzy na pewno chcesz kontynuować import?`;
                    }
                }
            }
        }

        workbook.SheetNames.forEach(sheetName => {
            if (sheetName.endsWith('Items')) {
                const sheet = workbook.Sheets[sheetName];
                const newItems: SupplierItem[] = [];
                let rowIndex = 3; 
                while (true) {
                    const quantity = sheet['A' + rowIndex]?.v;
                    if (quantity === undefined || quantity === null || quantity === '') break;
                    
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
                
                if (newItems.length > 0) {
                    results.push({ sheetName, items: newItems });
                }
            }
        });

        if (results.length === 0) {
            alert('Nie znaleziono żadnych arkuszy kończących się na "Items".');
            return;
        }

        callback(results, expiredWarning);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    parseOrmFile(file, (results, warning) => {
        const processImport = () => {
            const allNewItems = results.flatMap(r => r.items);
            
            if (allNewItems.length > 0) {
                const updated = [...suppliers];
                updated[activeTab] = {
                    ...updated[activeTab],
                    items: [...updated[activeTab].items, ...allNewItems],
                    isOrm: true,
                    currency: Currency.EUR,
                    name: "ORM"
                };
                checkAutoDiscount(updated, activeTab);
                onChange(updated);
            }
        };

        if (warning) {
            onConfirm("Nieaktualny Cennik ORM", warning, processImport, true);
        } else {
            processImport();
        }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewOrmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      parseOrmFile(file, (results, warning) => {
          const processImport = () => {
              if (results.length > 0) {
                  const fileName = file.name.split('.')[0];
                  const groupId = `orm_group_${Date.now()}`;
                  
                  const newSuppliers: Supplier[] = results.map(res => {
                      const cleanName = res.sheetName.replace(/Items$/, '');
                      
                      return {
                          id: Math.random().toString(36).substr(2, 9),
                          groupId: groupId, 
                          name: 'ORM', 
                          customTabName: cleanName, 
                          offerNumber: '',
                          offerDate: '',
                          deliveryDate: '',
                          currency: Currency.EUR,
                          discount: 0,
                          language: Language.PL,
                          items: res.items,
                          isOrm: true,
                          status: SupplierStatus.TO_ORDER,
                          isIncluded: true,
                          notes: ''
                      };
                  });
                  
                  const updated = [...suppliers, ...newSuppliers];
                  for(let i = suppliers.length; i < updated.length; i++) {
                      checkAutoDiscount(updated, i);
                  }

                  onChange(updated);
                  setActiveTab(suppliers.length); 
              }
          };

          if (warning) {
              onConfirm("Nieaktualny Cennik ORM", warning, processImport, true);
          } else {
              processImport();
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

  // Calculation Logic moved to calculationService mostly, but basic total display:
  const totalCost = suppliers.reduce((acc, s) => {
    if (s.isIncluded === false) return acc;
    // Note: totalCost calc logic inside calculateProjectCosts handles extraMarkupPercent.
    const sTotal = s.items.reduce((sum, i) => {
        if (i.isExcluded) return sum;
        const price = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
        return sum + (i.quantity * price);
    }, 0);
    const discounted = sTotal * (1 - s.discount / 100);
    const withMarkup = discounted * (1 + (s.extraMarkupPercent || 0) / 100);
    let ormFee = 0;
    if (s.isOrm) ormFee = withMarkup * 0.016; 

    return acc + convert(withMarkup + ormFee, s.currency, offerCurrency, exchangeRate);
  }, 0);
  
  const nameplateCost = convert((nameplateQty || 0) * 19, Currency.PLN, offerCurrency, exchangeRate);
  const totalWithNameplate = totalCost + nameplateCost;

  const currentSupplier = activeTab < suppliers.length ? suppliers[activeTab] : null;
  const isCurrentIncluded = currentSupplier ? currentSupplier.isIncluded !== false : true;
  const isNameplateTab = activeTab === NAMEPLATE_TAB_INDEX;
  
  // UPDATED: Calculate subtotal respecting exclusion
  const activeSupplierSubtotal = currentSupplier ? currentSupplier.items.reduce((sum, i) => {
      if (i.isExcluded) return sum; // Respect exclusion
      const price = currentSupplier.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
      return sum + (i.quantity * price);
  }, 0) : 0;
  
  const activeDiscounted = activeSupplierSubtotal * (1 - (currentSupplier?.discount || 0) / 100);
  const activeSupplierTotal = activeDiscounted * (1 + (currentSupplier?.extraMarkupPercent || 0) / 100);
  const activeOrmFee = currentSupplier?.isOrm ? (activeSupplierTotal * 0.016) : 0;

  // Validation Logic
  const validationState = currentSupplier ? validateSupplierData(currentSupplier) : { isValid: true, missing: [] };
  const isCurrentMissingData = !validationState.isValid && isCurrentIncluded;

  const supplierMenuItems = [
      { label: 'Porównaj Dostawców', icon: <SplitSquareHorizontal size={14} />, onClick: onOpenComparison },
      { label: 'Importuj Excel (Dołącz do aktywnej)', icon: <FileSpreadsheet size={14} />, onClick: () => fileInputRef.current?.click() },
      { label: 'Inteligentny Import (PDF/Img)', icon: <Sparkles size={14} />, onClick: () => pdfInputRef.current?.click() },
      { label: 'Duplikuj', icon: <Copy size={14} />, onClick: () => duplicateSupplier(activeTab), disabled: currentSupplier?.isOrm },
      { label: 'Usuń dostawcę', icon: <Trash2 size={14} />, onClick: () => removeSupplier(activeTab), danger: true }
  ];

  const addButtonMenuItems = [
      { label: 'Importuj ORM (Excel)', icon: <FileSpreadsheet size={14} className="text-green-600" />, onClick: () => newOrmInputRef.current?.click() },
      { label: 'Inteligentny Import (PDF)', icon: <Sparkles size={14} className="text-purple-500" />, onClick: () => pdfInputRef.current?.click() }
  ];

  const handleAddNotes = () => {
      updateSupplier(activeTab, 'notes', ' ');
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden transition-colors relative">
      {isImporting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 z-20 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
              <p className="text-zinc-800 dark:text-zinc-200 font-semibold animate-pulse text-sm">Analizuję ofertę (AI)...</p>
          </div>
      )}
      
      {/* Standardized Header */}
      <div 
          className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                <Package size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Dostawcy</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Materiały i towary handlowe</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg">
                    {formatCurrency(totalWithNameplate, offerCurrency)}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                
                {/* TAB NAV */}
                <div className="flex h-10 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 select-none">
                    <div 
                        className="flex-1 flex overflow-x-auto [&::-webkit-scrollbar]:hidden" 
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {suppliers.map((s, idx) => {
                            const isActive = activeTab === idx;
                            // Tab-specific validation
                            const val = validateSupplierData(s);
                            const isMissingData = !val.isValid && s.isIncluded !== false;
                            
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveTab(idx)}
                                    title={isMissingData ? `Brakuje: ${val.missing.join(', ')}` : ''}
                                    className={`
                                        relative px-4 h-full text-xs font-medium transition-colors whitespace-nowrap min-w-[120px] max-w-[200px] truncate group border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2
                                        ${isActive 
                                            ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold' 
                                            : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        }
                                        ${s.isIncluded === false ? 'opacity-50 decoration-slate-400 line-through' : ''}
                                        ${isPickingMode && isActive ? 'ring-2 ring-inset ring-amber-400 z-20 cursor-crosshair' : ''}
                                        ${isMissingData ? 'text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20 shadow-[inset_0_-2px_0_0_rgba(239,68,68,1)]' : ''}
                                    `}
                                >
                                    {isPickingMode && isActive && <MousePointer2 size={10} className="inline animate-pulse text-amber-500" />}
                                    {isMissingData && <AlertTriangle size={12} className="text-red-500 shrink-0"/>}
                                    <span className="truncate">{s.customTabName || s.name}</span>
                                </button>
                            );
                        })}

                        <button
                            onClick={() => setActiveTab(NAMEPLATE_TAB_INDEX)}
                            className={`
                                relative px-4 h-full text-xs font-medium transition-colors whitespace-nowrap border-r border-zinc-200 dark:border-zinc-800 flex items-center gap-2
                                ${isNameplateTab 
                                    ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold' 
                                    : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
                                }
                            `}
                        >
                            <Tag size={12} className={isNameplateTab ? "text-amber-600" : ""} /> Tabliczki
                        </button>
                    </div>

                    <div className="flex items-center h-full border-l border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shrink-0">
                        <button
                            onClick={addSupplier}
                            className="w-10 h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800"
                            title="Dodaj pustą kartę dostawcy"
                        >
                            <Plus size={16} /> 
                        </button>
                        <DropdownMenu 
                            items={addButtonMenuItems}
                            trigger={
                                <div className="w-10 h-full flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
                                    <ChevronDown size={16} />
                                </div>
                            }
                            align="right"
                        />
                    </div>
                </div>

                <div 
                    className={`bg-white dark:bg-zinc-950 p-3 border-x border-b border-zinc-200 dark:border-zinc-800 relative transition-all min-h-[200px]
                        ${isPickingMode && currentSupplier ? 'hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-crosshair hover:animate-pulse-border' : ''}
                        ${isCurrentMissingData ? 'border-red-400 dark:border-red-800' : ''}
                    `}
                    onClick={(e) => currentSupplier && handleSupplierGroupPick(e, currentSupplier)}
                >
                        {isPickingMode && currentSupplier && (
                            <div className="absolute top-2 right-2 bg-amber-400 text-black text-[9px] font-bold px-2 py-0.5 rounded shadow animate-pulse pointer-events-none z-10">
                                Kliknij, aby dodać całą grupę
                            </div>
                        )}

                        {!isNameplateTab && currentSupplier && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 mb-1 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 flex items-center gap-1">
                                        <Edit3 size={10} /> Nazwa Zakładki
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-2 h-9 border border-zinc-200 dark:border-zinc-700 rounded-none text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none bg-white dark:bg-zinc-950 font-bold transition-all"
                                        value={currentSupplier.customTabName || currentSupplier.name}
                                        onChange={(e) => updateSupplier(activeTab, 'customTabName', e.target.value)}
                                        placeholder="Nazwa widoczna na zakładce"
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5">Dostawca (w systemie)</label>
                                    <div className="flex gap-1 h-9 relative">
                                        {/* Supplier Select / Input Combo */}
                                        <div className="relative flex-1">
                                            {currentSupplier.isOrm ? (
                                                // If ORM, lock it but allow editing name if needed
                                                <input
                                                    type="text"
                                                    className="w-full px-2 h-full border border-zinc-200 dark:border-zinc-700 rounded-none text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none bg-white dark:bg-zinc-950 transition-all text-zinc-500"
                                                    value={currentSupplier.name}
                                                    readOnly
                                                    disabled
                                                />
                                            ) : (
                                                <select
                                                    className={`w-full px-2 h-full border rounded-none text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none bg-white dark:bg-zinc-950 transition-all ${isCurrentMissingData ? 'border-red-400 text-red-600 font-bold' : 'border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-white'}`}
                                                    value={PREDEFINED_SUPPLIERS.some(s => s.name === currentSupplier.name) ? currentSupplier.name : 'OTHER'}
                                                    onChange={(e) => handleSupplierSelect(activeTab, e.target.value)}
                                                    disabled={!isCurrentIncluded}
                                                >
                                                    {PREDEFINED_SUPPLIERS.map(s => (
                                                        <option key={s.id} value={s.name}>{s.name}</option>
                                                    ))}
                                                    <option value="OTHER">Inny / Ręczny (Uzupełnij)</option>
                                                </select>
                                            )}
                                            {isCurrentMissingData && <div className="absolute right-6 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none animate-pulse"><AlertTriangle size={14}/></div>}
                                        </div>

                                        <button 
                                            onClick={() => updateSupplier(activeTab, 'isIncluded', !isCurrentIncluded)}
                                            className={`h-full w-9 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 transition-colors rounded-none ${
                                                isCurrentIncluded 
                                                ? 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:text-red-500' 
                                                : 'bg-red-50 text-red-600'
                                            }`}
                                            style={{ pointerEvents: 'auto' }} 
                                        >
                                            {isCurrentIncluded ? <Eye size={14}/> : <EyeOff size={14}/>}
                                        </button>
                                        <button
                                            onClick={() => setDetailViewIndex(activeTab)}
                                            className={`h-full w-9 border flex items-center justify-center transition-colors rounded-none ${isCurrentMissingData ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 hover:border-amber-400'}`}
                                            title="Rozszerz / Edytuj szczegóły"
                                        >
                                            <Maximize2 size={14} />
                                        </button>
                                        <div className="h-full">
                                            <DropdownMenu 
                                                trigger={
                                                    <div className="h-9 w-9 flex items-center justify-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                                        <ChevronDown size={14}/>
                                                    </div>
                                                }
                                                items={supplierMenuItems} 
                                            />
                                        </div>
                                    </div>
                                    {currentSupplier.isOrm && <span className="text-[9px] text-green-600 dark:text-green-400 font-bold ml-1">ORM</span>}
                                    {isCurrentMissingData && <span className="text-[9px] text-red-500 font-bold ml-1 block mt-1">! Uzupełnij: {validationState.missing.join(', ')}</span>}
                                </div>
                                
                                <div className={`contents transition-opacity duration-200 ${isCurrentIncluded ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none select-none'}`}>
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5">Waluta</label>
                                        <div className="relative">
                                            <Euro className="absolute left-2 top-2.5 text-zinc-400" size={12}/>
                                            <select
                                                className="w-full pl-6 h-9 border border-zinc-200 dark:border-zinc-700 rounded-none text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white dark:bg-zinc-950 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 transition-all"
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
                                        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5">
                                            Dostawa <span className="text-[9px] font-normal text-zinc-500">{getWeeksRemaining(currentSupplier.deliveryDate)}</span>
                                        </label>
                                        <div className="flex gap-1 items-center flex-nowrap h-9">
                                            <div className="relative flex-1 min-w-0 h-full">
                                                <Calendar className="absolute left-2 top-2.5 text-zinc-400" size={12}/>
                                                <input
                                                    type="date"
                                                    className="w-full pl-6 h-full border border-zinc-200 dark:border-zinc-700 rounded-none text-xs focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none bg-white dark:bg-zinc-950 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 transition-all"
                                                    value={currentSupplier.deliveryDate === 'ASAP' ? '' : currentSupplier.deliveryDate}
                                                    onChange={(e) => updateSupplier(activeTab, 'deliveryDate', e.target.value)}
                                                    disabled={currentSupplier.deliveryDate === 'ASAP'}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => updateSupplier(activeTab, 'deliveryDate', currentSupplier.deliveryDate === 'ASAP' ? '' : 'ASAP')}
                                                className={`px-3 h-full text-[9px] font-bold border transition-colors flex-shrink-0 whitespace-nowrap rounded-none flex items-center justify-center ${currentSupplier.deliveryDate === 'ASAP' ? 'bg-red-500 text-white border-red-600' : 'bg-white dark:bg-zinc-950 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-red-400 hover:text-red-500'}`}
                                                title="Ustaw ASAP"
                                            >
                                                ASAP
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isNameplateTab && (
                            <div className="bg-zinc-50 dark:bg-zinc-900 p-6 animate-fadeIn flex flex-col items-center text-center border-t border-zinc-200 dark:border-zinc-700">
                                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full mb-3">
                                    <Tag size={32} className="text-amber-600 dark:text-amber-500" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1">Tabliczki Znamionowe</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4 max-w-md">
                                    Wprowadź ilość tabliczek znamionowych wymaganych dla tego projektu. 
                                    Koszt jednostkowy jest stały i wynosi 19 PLN.
                                </p>

                                <div className="bg-white dark:bg-zinc-950 p-4 shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row items-center gap-6">
                                    <div className="text-center">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Cena Jedn.</label>
                                        <div className="text-lg font-bold text-zinc-400">19,00 PLN</div>
                                    </div>
                                    <div className="text-xl text-zinc-300 dark:text-zinc-600 font-light">×</div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Ilość Sztuk</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={nameplateQty || 0} 
                                            onChange={(e) => onNameplateChange(parseFloat(e.target.value) || 0)} 
                                            className="w-24 p-2 text-center text-xl font-bold border-2 border-zinc-200 focus:border-amber-400 outline-none bg-transparent" 
                                        />
                                    </div>
                                    <div className="text-xl text-zinc-300 dark:text-zinc-600 font-light">=</div>
                                    <div className="text-center">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Koszt Całkowity</label>
                                        <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-500">
                                            {formatNumber(nameplateQty * 19)} PLN
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isNameplateTab && currentSupplier && (
                            <div className={`transition-opacity duration-200 ${isCurrentIncluded ? 'opacity-100' : 'opacity-30 grayscale pointer-events-none select-none'}`}>
                                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                                    <DataGrid 
                                        items={currentSupplier.items}
                                        currency={currentSupplier.currency}
                                        isOrm={currentSupplier.isOrm}
                                        onUpdateItem={(id, field, value) => updateItem(activeTab, id, field, value)}
                                        onDeleteItem={(id) => removeItem(activeTab, id)}
                                        onAddItem={() => addItem(activeTab)}
                                        onReorderItems={(from, to) => reorderItems(activeTab, from, to)}
                                        className="max-h-[70vh] border-0 shadow-none"
                                        isPickingMode={isPickingMode}
                                        onPick={(id, coords) => {
                                            if (onPick) {
                                                const item = currentSupplier.items.find(i => i.id === id);
                                                if (item) {
                                                    onPick({
                                                        id: item.id,
                                                        type: 'SUPPLIER_ITEM',
                                                        label: `[Mat] ${item.itemDescription}`
                                                    }, coords);
                                                }
                                            }
                                        }}
                                    />
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/10 px-4 py-1.5 flex flex-wrap justify-between items-center border-t border-amber-100 dark:border-amber-900/30 gap-2">
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic flex items-center gap-2">
                                        Suma pozycji dla "{currentSupplier.customTabName || currentSupplier.name}"
                                        {activeOrmFee > 0 && (
                                            <span className="text-pink-600 dark:text-pink-400 font-semibold bg-pink-100 dark:bg-pink-900/30 px-1.5 rounded">
                                                + Opłata ORM (1.6%): {formatCurrency(activeOrmFee, currentSupplier.currency)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] text-zinc-500">
                                            Suma: <span className="font-mono">{formatNumber(activeSupplierSubtotal)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-3">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Rabat (%)</span>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100" 
                                                className="w-12 p-0.5 border rounded-none text-center text-xs focus:border-amber-400 outline-none font-bold bg-white dark:bg-zinc-950" 
                                                value={currentSupplier.discount} 
                                                onChange={(e) => updateSupplier(activeTab, 'discount', parseFloat(e.target.value) || 0)} 
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-3">
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Korekta (%)</span>
                                            <input 
                                                type="number" 
                                                step="0.5"
                                                className="w-12 p-0.5 border rounded-none text-center text-xs focus:border-amber-400 outline-none font-bold bg-white dark:bg-zinc-950 text-blue-600" 
                                                value={currentSupplier.extraMarkupPercent || 0} 
                                                onChange={(e) => updateSupplier(activeTab, 'extraMarkupPercent', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 pl-3 border-l border-zinc-200 dark:border-zinc-700">
                                            = {formatCurrency(activeSupplierTotal, currentSupplier.currency)}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
                                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                        <StickyNote size={10}/> Dodatkowe Uwagi (do zamówienia)
                                    </label>
                                    
                                    {!currentSupplier.notes ? (
                                        <button 
                                            onClick={handleAddNotes}
                                            className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-amber-600 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:border-amber-400 transition-all"
                                        >
                                            <MessageSquarePlus size={12}/> Dodaj uwagi
                                        </button>
                                    ) : (
                                        <textarea 
                                            className="w-full p-2 border rounded-none text-xs min-h-[60px] focus:border-amber-400 outline-none bg-white dark:bg-zinc-950 animate-fadeIn" 
                                            placeholder="Wpisz uwagi..." 
                                            value={currentSupplier.notes || ''} 
                                            onChange={(e) => updateSupplier(activeTab, 'notes', e.target.value)} 
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
            </div>
        </div>
      </div>

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
      
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
      <input type="file" ref={newOrmInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleNewOrmUpload} />
      <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf, .png, .jpg, .jpeg" onChange={handleSmartImport} />
    </div>
  );
};
