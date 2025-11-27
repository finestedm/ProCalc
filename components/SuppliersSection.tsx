
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Supplier, SupplierItem, Currency, Language, SupplierStatus, TransportItem, InstallationData, VariantItemType } from '../types';
import { Package, Plus, Trash2, Calendar, FileSpreadsheet, Copy, Eye, EyeOff, StickyNote, Tag, Loader2, Sparkles, Euro, Maximize2, ArrowUp, ArrowDown, Search, ArrowUpDown, ChevronDown, ChevronUp, GripVertical, Settings2, ArrowLeft, ArrowRight, Zap, FolderPlus, Edit3, MessageSquarePlus, SplitSquareHorizontal, MousePointer2 } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';
import * as XLSX from 'xlsx';
import { extractDataFromOffer } from '../services/aiService';
import { SupplierDetailModal } from './SupplierDetailModal';
import { DataGrid } from './DataGrid';
import { convert } from '../services/calculationService';

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
  // Picking Mode Props
  isPickingMode?: boolean;
  onPick?: (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => void;
}

interface OrmSheetResult {
    sheetName: string;
    items: SupplierItem[];
}

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

  // Constants
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

  // Upgraded ORM Parsing to handle multiple sheets AND Date Validation
  const parseOrmFile = (file: File, callback: (results: OrmSheetResult[], warning?: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const results: OrmSheetResult[] = [];
        let expiredWarning = undefined;

        // --- 1. Check Date Validity in First Sheet (Cell B4) ---
        if (workbook.SheetNames.length > 0) {
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const cellB4 = firstSheet['B4'];
            
            if (cellB4 && typeof cellB4.v === 'string') {
                // Expected format: "T4A 2025 (01/10/2025 => 31/10/2025)"
                const text = cellB4.v;
                const match = text.match(/=>\s*(\d{2}\/\d{2}\/\d{4})/);
                
                if (match && match[1]) {
                    const [day, month, year] = match[1].split('/').map(Number);
                    const expiryDate = new Date(year, month - 1, day); // Month is 0-indexed
                    const today = new Date();
                    today.setHours(0,0,0,0);

                    if (expiryDate < today) {
                        expiredWarning = `UWAGA: Wykryto nieaktualny cennik!\n\nOdczytano datę ważności: ${match[1]}\n(Komórka B4 w arkuszu "${firstSheetName}")\n\nCzy na pewno chcesz kontynuować import?`;
                    }
                }
            }
        }

        // --- 2. Iterate through ALL sheets, find ones ending in "Items" ---
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
    
    // For appending, we might just grab ALL items from ALL sheets and add to current
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
                    name: "ORM Import"
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
                  // Generate a shared Group ID for all tabs from this file
                  const groupId = `orm_group_${Date.now()}`;
                  
                  const newSuppliers: Supplier[] = results.map(res => {
                      // Clean up name: remove 'Items' suffix for cleaner tab name
                      const cleanName = res.sheetName.replace(/Items$/, '');
                      
                      return {
                          id: Math.random().toString(36).substr(2, 9),
                          groupId: groupId, // Link them together
                          name: `ORM ${cleanName}`, 
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
                  
                  // Add all new suppliers
                  const updated = [...suppliers, ...newSuppliers];
                  
                  // Apply discount check to each
                  for(let i = suppliers.length; i < updated.length; i++) {
                      checkAutoDiscount(updated, i);
                  }

                  onChange(updated);
                  setActiveTab(suppliers.length); // Switch to first new tab
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

  // --- Calculate Total for Header ---
  const totalCost = suppliers.reduce((acc, s) => {
    if (s.isIncluded === false) return acc;
    const sTotal = s.items.reduce((sum, i) => {
        const price = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
        return sum + (i.quantity * price);
    }, 0);
    const discounted = sTotal * (1 - s.discount / 100);
    
    // Add ORM Fee to total (internal cost)
    let ormFee = 0;
    if (s.isOrm) ormFee = discounted * 0.016;

    return acc + convert(discounted + ormFee, s.currency, offerCurrency, exchangeRate);
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
  
  // Calculate ORM Fee for Display (only if active)
  const activeOrmFee = currentSupplier?.isOrm ? (activeSupplierTotal * 0.016) : 0;

  const supplierMenuItems = [
      { label: 'Porównaj Dostawców', icon: <SplitSquareHorizontal size={16} />, onClick: onOpenComparison },
      { label: 'Importuj Excel (Dołącz do aktywnej)', icon: <FileSpreadsheet size={16} />, onClick: () => fileInputRef.current?.click() },
      { label: 'Inteligentny Import (PDF/Img)', icon: <Sparkles size={16} />, onClick: () => pdfInputRef.current?.click() },
      { label: 'Duplikuj', icon: <Copy size={16} />, onClick: () => duplicateSupplier(activeTab), disabled: currentSupplier?.isOrm },
      { label: 'Usuń dostawcę', icon: <Trash2 size={16} />, onClick: () => removeSupplier(activeTab), danger: true }
  ];

  // --- Add Button Dropdown Items ---
  const addButtonMenuItems = [
      { label: 'Importuj ORM (Excel)', icon: <FileSpreadsheet size={16} className="text-green-600" />, onClick: () => newOrmInputRef.current?.click() },
      { label: 'Inteligentny Import (PDF)', icon: <Sparkles size={16} className="text-purple-500" />, onClick: () => pdfInputRef.current?.click() }
  ];

  const handleAddNotes = () => {
      // Just ensure notes string is initialized so the textarea renders
      updateSupplier(activeTab, 'notes', ' ');
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 overflow-hidden transition-colors relative">
      {isImporting && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 z-20 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-yellow-500 mb-2" size={40} />
              <p className="text-zinc-800 dark:text-zinc-200 font-semibold animate-pulse">Analizuję ofertę (AI)...</p>
          </div>
      )}
      
      <div 
          className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                <Package size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Koszty Dostawców</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Materiały i Produkty</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg">
                    {totalWithNameplate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offerCurrency}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="border-t border-zinc-100 dark:border-zinc-700">
                {/* Top Padded Section for Tabs and Header Controls */}
                <div className="pt-4 bg-zinc-50 dark:bg-zinc-800">
                    
                    {/* NEW TAB NAVIGATION LAYOUT */}
                    <div className="flex items-end border-b border-zinc-300 dark:border-zinc-600 px-4">
                        {/* 1. Scrollable Tabs Area */}
                        <div 
                            className="flex-1 flex overflow-x-auto items-end mb-0 [&::-webkit-scrollbar]:hidden" 
                            style={{ scrollbarWidth: 'none' }}
                        >
                            {suppliers.map((s, idx) => {
                                const isActive = activeTab === idx;
                                
                                // Grouping Logic for visual merging
                                const prev = suppliers[idx - 1];
                                const next = suppliers[idx + 1];
                                
                                const isGroupStart = s.groupId && (!prev || prev.groupId !== s.groupId);
                                const isGroupEnd = s.groupId && (!next || next.groupId !== s.groupId);
                                const isGroupMiddle = s.groupId && !isGroupStart && !isGroupEnd;
                                
                                // Check if group only has 1 element (should be standalone visually)
                                const isSingleItemGroup = s.groupId && isGroupStart && isGroupEnd;
                                const isStandalone = !s.groupId || isSingleItemGroup;

                                // Base roundness
                                let roundClass = 'rounded-t-lg mx-1'; // Default standalone
                                let borderClass = 'border-x border-t';

                                if (!isStandalone && s.groupId) {
                                    if (isGroupStart) {
                                        roundClass = 'rounded-tl-lg rounded-tr-none mr-0 ml-1';
                                        borderClass = 'border-l border-t border-r-0';
                                    } else if (isGroupEnd) {
                                        roundClass = 'rounded-tr-lg rounded-tl-none ml-0 mr-1';
                                        borderClass = 'border-r border-t border-l-0';
                                    } else if (isGroupMiddle) {
                                        roundClass = 'rounded-none mx-0';
                                        borderClass = 'border-t border-x-0';
                                    }
                                }

                                // Separator for middle items
                                const separator = isGroupMiddle || isGroupStart ? 'border-r border-zinc-200 dark:border-zinc-700' : '';

                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setActiveTab(idx)}
                                        className={`relative px-4 py-2 text-sm font-bold transition-all whitespace-nowrap min-w-[80px] max-w-[200px] truncate group
                                            ${roundClass}
                                            ${borderClass}
                                            ${separator}
                                            ${isActive 
                                                ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-600 border-b-zinc-50 dark:border-b-zinc-800 z-10 mb-[-1px] pb-2.5' 
                                                : 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-transparent border-b-zinc-300 dark:border-b-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                                            }
                                            ${s.isIncluded === false ? 'opacity-50' : ''}
                                            ${isPickingMode && isActive ? 'ring-2 ring-yellow-400 z-20 cursor-crosshair' : ''}
                                        `}
                                    >
                                        {/* Color Stripe indicator */}
                                        <div className={`absolute top-0 left-0 right-0 h-[3px] ${isGroupStart || isStandalone ? 'rounded-tl-lg' : ''} ${isGroupEnd || isStandalone ? 'rounded-tr-lg' : ''} ${s.isOrm ? 'bg-green-500' : 'bg-yellow-500'} ${!isActive ? 'opacity-50' : ''}`}></div>
                                        <span className="relative z-10 flex items-center gap-1 justify-center">
                                            {isPickingMode && isActive && <MousePointer2 size={12} className="animate-pulse" />}
                                            {s.customTabName || s.name}
                                        </span>
                                    </button>
                                );
                            })}

                            {/* Dedicated Nameplate Tab */}
                            <button
                                onClick={() => setActiveTab(NAMEPLATE_TAB_INDEX)}
                                className={`relative px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-x border-t flex items-center gap-2 whitespace-nowrap ml-1
                                    ${isNameplateTab 
                                        ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-600 border-b-zinc-50 dark:border-b-zinc-800 z-10 mb-[-1px] pb-2.5' 
                                        : 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-transparent border-b-zinc-300 dark:border-b-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                                    }
                                `}
                            >
                                <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-lg bg-zinc-400 ${!isNameplateTab ? 'opacity-50' : ''}`}></div>
                                <Tag size={14} className={isNameplateTab ? "text-yellow-600" : ""} /> Tabliczki
                            </button>
                        </div>

                        {/* 2. Separator */}
                        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-2 mb-2 shrink-0"></div>

                        {/* 3. Add Button (Separated from Scroll) */}
                        <div className="shrink-0 mb-[-1px] relative z-20">
                            <div className="flex items-center bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-t-lg shadow-sm hover:border-yellow-400 transition-colors h-[34px]">
                                {/* Primary Action: Add Empty */}
                                <button
                                    onClick={addSupplier}
                                    className="px-3 h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-tl-lg transition-colors flex items-center justify-center gap-1"
                                    title="Dodaj pustą kartę dostawcy"
                                >
                                    <Plus size={14} /> 
                                    <span className="text-[10px] font-bold uppercase">Nowa</span>
                                </button>
                                
                                <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-600"></div>
                                
                                {/* Secondary Action: Dropdown */}
                                <DropdownMenu 
                                    items={addButtonMenuItems}
                                    trigger={
                                        <div className="px-1.5 h-full flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-tr-lg cursor-pointer text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                            <ChevronDown size={12} />
                                        </div>
                                    }
                                    align="right"
                                />
                            </div>
                        </div>
                    </div>

                    {/* --- SUPPLIER HEADER CONTROLS --- */}
                    <div 
                        className={`bg-zinc-50 dark:bg-zinc-800 p-4 border-x border-b border-zinc-200 dark:border-zinc-700 rounded-b-lg relative transition-all
                            ${isPickingMode && currentSupplier ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/10 cursor-crosshair hover:animate-pulse-border' : ''}
                        `}
                        onClick={(e) => currentSupplier && handleSupplierGroupPick(e, currentSupplier)}
                    >
                        {isPickingMode && currentSupplier && (
                            <div className="absolute top-2 right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow animate-pulse pointer-events-none z-10">
                                Kliknij, aby dodać całą grupę
                            </div>
                        )}

                        {!isNameplateTab && currentSupplier && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                {/* Tab Name Editing */}
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
                                        <Edit3 size={10} /> Nazwa Zakładki
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded text-sm focus:border-yellow-400 outline-none bg-white dark:bg-zinc-900 font-bold"
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
                                            className={`w-full p-2 border rounded text-sm focus:border-yellow-400 outline-none ${!isCurrentIncluded ? 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-900'}`}
                                            value={currentSupplier.name}
                                            onChange={(e) => updateSupplier(activeTab, 'name', e.target.value)}
                                            disabled={!isCurrentIncluded}
                                            placeholder="Oficjalna nazwa dostawcy"
                                        />
                                        <button 
                                            onClick={() => updateSupplier(activeTab, 'isIncluded', !isCurrentIncluded)}
                                            className={`p-2 rounded border flex-shrink-0 transition-colors ${
                                                isCurrentIncluded 
                                                ? 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-red-500' 
                                                : 'bg-red-50 text-red-600'
                                            }`}
                                            style={{ pointerEvents: 'auto' }} 
                                        >
                                            {isCurrentIncluded ? <Eye size={18}/> : <EyeOff size={18}/>}
                                        </button>
                                        <button
                                            onClick={() => setDetailViewIndex(activeTab)}
                                            className="p-2 rounded border bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-yellow-600 hover:border-yellow-400 transition-colors"
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
                                                className="w-full pl-8 p-2 border rounded text-sm outline-none focus:border-yellow-400 bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-700"
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
                                                    className="w-full pl-8 p-2 border rounded text-sm focus:border-yellow-400 outline-none bg-white dark:bg-zinc-900 disabled:bg-zinc-100 dark:disabled:bg-zinc-700 disabled:text-zinc-400"
                                                    value={currentSupplier.deliveryDate === 'ASAP' ? '' : currentSupplier.deliveryDate}
                                                    onChange={(e) => updateSupplier(activeTab, 'deliveryDate', e.target.value)}
                                                    disabled={currentSupplier.deliveryDate === 'ASAP'}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => updateSupplier(activeTab, 'deliveryDate', currentSupplier.deliveryDate === 'ASAP' ? '' : 'ASAP')}
                                                className={`px-2 py-2 rounded text-[10px] font-bold border transition-colors flex-shrink-0 whitespace-nowrap h-[38px] ${currentSupplier.deliveryDate === 'ASAP' ? 'bg-red-500 text-white border-red-600' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-red-400 hover:text-red-500'}`}
                                                title="Ustaw ASAP"
                                            >
                                                ASAP
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- NAMEPLATE VIEW --- */}
                        {isNameplateTab && (
                            <div className="bg-zinc-50 dark:bg-zinc-800 p-8 animate-fadeIn flex flex-col items-center text-center border-t border-zinc-200 dark:border-zinc-700">
                                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full mb-4">
                                    <Tag size={40} className="text-yellow-600 dark:text-yellow-500" />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">Tabliczki Znamionowe</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 max-w-md">
                                    Wprowadź ilość tabliczek znamionowych wymaganych dla tego projektu. 
                                    Koszt jednostkowy jest stały i wynosi 19 PLN.
                                </p>

                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row items-center gap-8">
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
                                
                                {/* Flush DataGrid Implementation with Only Top Padding */}
                                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                                    <DataGrid 
                                        items={currentSupplier.items}
                                        currency={currentSupplier.currency}
                                        isOrm={currentSupplier.isOrm}
                                        onUpdateItem={(id, field, value) => updateItem(activeTab, id, field, value)}
                                        onDeleteItem={(id) => removeItem(activeTab, id)}
                                        onAddItem={() => addItem(activeTab)}
                                        onMoveItem={(idx, dir) => moveItemManual(activeTab, idx, dir)}
                                        className="max-h-[70vh] border-0 rounded-none shadow-none"
                                        // PICKING PROPS
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

                                {/* Footer Summary Bar for the Table */}
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 px-4 py-2 flex justify-between items-center border-t border-yellow-100 dark:border-yellow-900/30">
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 italic flex items-center gap-2">
                                        Suma pozycji dla "{currentSupplier.customTabName || currentSupplier.name}"
                                        {activeOrmFee > 0 && (
                                            <span className="text-pink-600 dark:text-pink-400 font-semibold bg-pink-100 dark:bg-pink-900/30 px-1.5 rounded">
                                                + Opłata ORM (1.6%): {activeOrmFee.toFixed(2)} {currentSupplier.currency}
                                            </span>
                                        )}
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
                                                className="w-16 p-1 border rounded text-center text-sm focus:border-yellow-400 outline-none font-bold bg-white dark:bg-zinc-900" 
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
      
      {/* Hidden inputs always available */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
      <input type="file" ref={newOrmInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleNewOrmUpload} />
      <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf, .png, .jpg, .jpeg" onChange={handleSmartImport} />
    </div>
  );
};
