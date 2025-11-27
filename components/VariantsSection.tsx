
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { CalculationData, ProjectVariant, VariantItem, VariantItemType, Currency, VariantStatus } from '../types';
import { Layers, Search, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Check, X, Crosshair, MinusCircle, Link, ArrowRight, Edit2, Lock, Plus } from 'lucide-react';
import { convert, calculateStageCost } from '../services/calculationService';

interface Props {
  data: CalculationData;
  onChange: (data: CalculationData) => void;
  exchangeRate: number;
  offerCurrency: Currency;
  onConfirm: (title: string, message: string, onConfirm: () => void, isDanger?: boolean) => void;
}

interface SearchResult {
    id: string;
    type: VariantItemType;
    label: string;
    description?: string;
    isGroup?: boolean;
    groupId?: string; // For macro selection or linking items to parents
    value?: number; // Estimated value for display
    currency?: Currency;
    isRecommended?: boolean; // Smart linking recommendation
}

export const VariantsSection: React.FC<Props> = ({ data, onChange, exchangeRate, offerCurrency, onConfirm }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [newVariantName, setNewVariantName] = useState('');
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null); // For editing (expanding row)
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false); // Controls visibility
  const [hoveredItemId, setHoveredItemId] = useState<{ id: string, type: VariantItemType } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number, left: number, width: number } | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position Calculation Function
  const updateDropdownPosition = () => {
      if (searchInputRef.current) {
          const rect = searchInputRef.current.getBoundingClientRect();
          setDropdownPosition({
              top: rect.bottom + 5,
              left: rect.left,
              width: rect.width
          });
      }
  };

  // Update dropdown position on render, scroll, and resize
  useLayoutEffect(() => {
      if (showDropdown && activeVariantId) {
          updateDropdownPosition();
          window.addEventListener('scroll', updateDropdownPosition, true);
          window.addEventListener('resize', updateDropdownPosition);
      }

      return () => {
          window.removeEventListener('scroll', updateDropdownPosition, true);
          window.removeEventListener('resize', updateDropdownPosition);
      };
  }, [showDropdown, activeVariantId, searchTerm]);

  // Click Outside Logic to close dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (
              dropdownRef.current && 
              !dropdownRef.current.contains(event.target as Node) &&
              searchInputRef.current &&
              !searchInputRef.current.contains(event.target as Node)
          ) {
              setShowDropdown(false);
          }
      };

      if (showDropdown) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showDropdown]);


  // --- ACTIONS ---

  const addVariant = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newVariantName.trim()) return;
      const newVariant: ProjectVariant = {
          id: Math.random().toString(36).substr(2, 9),
          name: newVariantName.trim(),
          status: 'NEUTRAL', // Start as Neutral
          items: []
      };
      onChange({ ...data, variants: [...(data.variants || []), newVariant] });
      setNewVariantName('');
      setActiveVariantId(newVariant.id);
      setShowDropdown(true); // Auto open search for new variant
  };

  const removeVariant = (id: string) => {
      onConfirm(
          "Usuwanie wariantu",
          "Czy na pewno chcesz usunąć ten wariant? Ta operacja jest nieodwracalna.",
          () => {
              const newData = { ...data };
              newData.variants = newData.variants.filter(v => v.id !== id);
              recalculateGlobalExclusions(newData);
              onChange(newData);
          },
          true
      );
  };

  const updateVariantName = (id: string, newName: string) => {
      const newData = { ...data };
      const variant = newData.variants.find(v => v.id === id);
      if (variant) {
          variant.name = newName;
      }
      onChange(newData);
  };

  const setVariantStatus = (id: string, status: VariantStatus) => {
      const newData = { ...data };
      const variant = newData.variants.find(v => v.id === id);
      
      if (variant) {
          if (variant.status === status && status !== 'NEUTRAL') {
              variant.status = 'NEUTRAL';
          } else {
              variant.status = status;
          }
          recalculateGlobalExclusions(newData);
      }
      onChange(newData);
  };

  const handleSoloVariant = (variantId: string) => {
      const newData = { ...data };
      newData.variants.forEach(v => {
          if (v.id === variantId) v.status = 'INCLUDED';
          else v.status = 'NEUTRAL';
      });
      recalculateGlobalExclusions(newData);
      onChange(newData);
  };

  // --- CENTRALIZED EXCLUSION LOGIC ---
  const recalculateGlobalExclusions = (d: CalculationData) => {
      const includedVariants = d.variants.filter(v => v.status === 'INCLUDED');
      const excludedVariants = d.variants.filter(v => v.status === 'EXCLUDED');

      const collectIds = (variants: ProjectVariant[]): Set<string> => {
          const ids = new Set<string>();
          variants.forEach(v => {
              v.items.forEach(vItem => {
                   if (vItem.type === 'SUPPLIER_ITEM') {
                        if (vItem.id.startsWith('group_supp_')) {
                            const suppId = vItem.id.replace('group_supp_', '');
                            const supp = d.suppliers.find(s => s.id === suppId);
                            supp?.items.forEach(i => ids.add(i.id));
                        } else {
                            ids.add(vItem.id);
                        }
                   } else if (vItem.type === 'TRANSPORT') {
                        ids.add(vItem.id);
                   } else if (vItem.type === 'OTHER') {
                        ids.add(vItem.id);
                   } else if (vItem.type === 'STAGE') {
                        ids.add(vItem.id); // Maps to Stage ID
                   }
              });
          });
          return ids;
      };

      // Helper to apply state
      const apply = (isWhitelist: boolean, ids: Set<string>) => {
           // Suppliers
           d.suppliers.forEach(s => s.items.forEach(i => i.isExcluded = isWhitelist ? !ids.has(i.id) : ids.has(i.id)));
           // Transport
           d.transport.forEach(t => t.isExcluded = isWhitelist ? !ids.has(t.id) : ids.has(t.id));
           // Other
           d.otherCosts.forEach(o => o.isExcluded = isWhitelist ? !ids.has(o.id) : ids.has(o.id));
           // Stages (excludes whole stage)
           d.installation.stages.forEach(stage => stage.isExcluded = isWhitelist ? !ids.has(stage.id) : ids.has(stage.id));
      };

      if (includedVariants.length > 0) {
          const whitelist = collectIds(includedVariants);
          apply(true, whitelist);
      } else {
          const blacklist = collectIds(excludedVariants);
          apply(false, blacklist);
      }
  };

  const addItemToVariant = (variantId: string, result: SearchResult) => {
      const newData = { ...data };
      const variant = newData.variants.find(v => v.id === variantId);
      if (!variant) return;

      const itemsToAdd: VariantItem[] = [];
      itemsToAdd.push({ id: result.id, type: result.type, originalDescription: result.label });

      itemsToAdd.forEach(item => {
          if (!variant.items.some(i => i.id === item.id && i.type === item.type)) {
              variant.items.push(item);
          }
      });
      recalculateGlobalExclusions(newData);
      onChange(newData);
      setSearchTerm(''); 
      // Keep dropdown open for multiple adds
  };

  const removeItemFromVariant = (variantId: string, itemId: string, type: VariantItemType) => {
      const newData = { ...data };
      const variant = newData.variants.find(v => v.id === variantId);
      if (variant) {
          variant.items = variant.items.filter(i => !(i.id === itemId && i.type === type));
          recalculateGlobalExclusions(newData);
      }
      onChange(newData);
  };

  const getItemValue = (id: string, type: VariantItemType): { val: number, curr: Currency } => {
      if (type === 'SUPPLIER_ITEM') {
          if (id.startsWith('group_supp_')) {
              const suppId = id.replace('group_supp_', '');
              const s = data.suppliers.find(x => x.id === suppId);
              if (s) {
                   const sVal = s.items.reduce((sum, i) => sum + (i.quantity * (s.isOrm ? i.unitPrice * 0.5 : i.unitPrice)), 0);
                   return { val: sVal * (1 - s.discount/100), curr: s.currency };
              }
          } else {
              for (const s of data.suppliers) {
                  const item = s.items.find(i => i.id === id);
                  if (item) {
                      const price = s.isOrm ? item.unitPrice * 0.5 : item.unitPrice;
                      return { val: (item.quantity * price) * (1 - s.discount/100), curr: s.currency };
                  }
              }
          }
      } else if (type === 'STAGE') {
          const stage = data.installation.stages.find(s => s.id === id);
          if (stage) return { val: calculateStageCost(stage, data), curr: Currency.PLN };
      } else if (type === 'TRANSPORT') {
          const t = data.transport.find(x => x.id === id);
          if (t) return { val: t.totalPrice, curr: t.currency };
      }
      return { val: 0, curr: Currency.PLN };
  };

  const calculateVariantTotal = (variant: ProjectVariant): number => {
      return variant.items.reduce((sum, vItem) => {
          const { val, curr } = getItemValue(vItem.id, vItem.type);
          return sum + convert(val, curr, offerCurrency, exchangeRate);
      }, 0);
  };

  // --- SEARCH & SMART SUGGESTIONS ---
  
  const getContextFromVariant = (variant: ProjectVariant) => {
      const activeSupplierIds = new Set<string>();
      
      variant.items.forEach(item => {
          if (item.type === 'SUPPLIER_ITEM') {
              if (item.id.startsWith('group_supp_')) {
                  activeSupplierIds.add(item.id.replace('group_supp_', ''));
              } else {
                  // Find supplier for item
                  const s = data.suppliers.find(sup => sup.items.some(i => i.id === item.id));
                  if(s) activeSupplierIds.add(s.id);
              }
          } else if (item.type === 'TRANSPORT') {
              const t = data.transport.find(tr => tr.id === item.id);
              if (t?.supplierId) activeSupplierIds.add(t.supplierId);
              if (t?.linkedSupplierIds) t.linkedSupplierIds.forEach(id => activeSupplierIds.add(id));
          } else if (item.type === 'STAGE') {
              const st = data.installation.stages.find(s => s.id === item.id);
              if (st?.linkedSupplierIds) st.linkedSupplierIds.forEach(id => activeSupplierIds.add(id));
          }
      });
      return { activeSupplierIds };
  };

  const searchItems = (term: string, currentVariant: ProjectVariant): SearchResult[] => {
      if (!term && currentVariant.items.length === 0) return [];

      const lower = term.toLowerCase();
      const results: SearchResult[] = [];
      const { activeSupplierIds } = getContextFromVariant(currentVariant);

      // 1. Suppliers
      data.suppliers.forEach(s => {
          const match = !term || s.name.toLowerCase().includes(lower) || (s.customTabName && s.customTabName.toLowerCase().includes(lower));
          const isRelated = activeSupplierIds.has(s.id); 

          if (match) {
               results.push({ 
                   id: `group_supp_${s.id}`, 
                   groupId: s.id, 
                   type: 'SUPPLIER_ITEM', 
                   label: `DOSTAWCA: ${s.customTabName || s.name}`, 
                   isGroup: true,
                   isRecommended: isRelated 
                });
          }
          if (term) {
              s.items.forEach(i => {
                  if (i.itemDescription.toLowerCase().includes(lower) || i.componentNumber.toLowerCase().includes(lower)) {
                      results.push({ 
                          id: i.id, 
                          type: 'SUPPLIER_ITEM', 
                          groupId: s.id, // Important for parent/child checking
                          label: `[Mat] ${i.itemDescription}`, 
                          description: `${s.customTabName || s.name} | ${i.componentNumber}` 
                        });
                  }
              });
          }
      });

      // 2. Stages
      data.installation.stages.forEach(st => {
          const match = !term || st.name.toLowerCase().includes(lower);
          const isRelated = st.linkedSupplierIds.some(sid => activeSupplierIds.has(sid));

          if (match) {
              results.push({
                  id: st.id,
                  type: 'STAGE',
                  label: `[Etap] ${st.name}`,
                  description: `${st.linkedSupplierIds.length} dostawców | ${st.calcMethod === 'BOTH' ? 'Łączona' : st.calcMethod}`,
                  isRecommended: isRelated
              });
          }
      });

      // 3. Transport
      data.transport.forEach(t => {
          const name = t.name || (t.supplierId ? data.suppliers.find(s => s.id === t.supplierId)?.name : 'Transport');
          const match = !term || (name && name.toLowerCase().includes(lower));
          
          let isRelated = false;
          if (t.supplierId && activeSupplierIds.has(t.supplierId)) isRelated = true;
          if (t.linkedSupplierIds && t.linkedSupplierIds.some(id => activeSupplierIds.has(id))) isRelated = true;

          if (match) {
              results.push({
                  id: t.id,
                  type: 'TRANSPORT',
                  label: `[Transport] ${name}`,
                  description: `${t.trucksCount} aut | ${t.totalPrice.toFixed(0)} ${t.currency}`,
                  isRecommended: isRelated
              });
          }
      });

      results.sort((a, b) => (b.isRecommended === true ? 1 : 0) - (a.isRecommended === true ? 1 : 0));

      return results;
  };

  const activeVariant = data.variants.find(v => v.id === activeVariantId);
  const searchResults = activeVariant ? searchItems(searchTerm, activeVariant) : [];

  // --- TOOLTIP LOGIC ---
  const handleMouseEnterItem = (e: React.MouseEvent, id: string, type: VariantItemType) => {
      setHoveredItemId({ id, type });
      setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const renderTooltip = () => {
      if (!hoveredItemId) return null;

      let content = null;
      let title = '';

      // CASE 1: Supplier Group
      if (hoveredItemId.type === 'SUPPLIER_ITEM' && hoveredItemId.id.startsWith('group_supp_')) {
          const suppId = hoveredItemId.id.replace('group_supp_', '');
          const s = data.suppliers.find(x => x.id === suppId);
          if (s) {
              title = s.customTabName || s.name;
              const sortedItems = [...s.items].sort((a,b) => (b.weight * b.quantity) - (a.weight * a.quantity)).slice(0, 5);
              const totalWeight = s.items.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
              content = (
                  <>
                    <div className="space-y-1 mb-2">
                        {sortedItems.map(i => (
                            <div key={i.id} className="flex justify-between">
                                <span className="truncate w-40">{i.itemDescription}</span>
                                <span className="text-zinc-400">{i.quantity} szt.</span>
                            </div>
                        ))}
                        {s.items.length > 5 && <div className="italic text-zinc-500 text-[10px]">+ {s.items.length - 5} innych...</div>}
                    </div>
                    <div className="pt-1 border-t border-zinc-700 font-bold text-yellow-500">
                        Total Waga: {totalWeight.toFixed(0)} kg
                    </div>
                  </>
              );
          }
      } 
      // CASE 2: Installation Stage
      else if (hoveredItemId.type === 'STAGE') {
          const stage = data.installation.stages.find(s => s.id === hoveredItemId.id);
          if (stage) {
              title = stage.name;
              content = (
                  <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-zinc-400">Metoda:</span> <span>{stage.calcMethod}</span></div>
                      {stage.calcMethod !== 'TIME' && (
                          <div className="flex justify-between"><span className="text-zinc-400">Miejsca:</span> <span>{stage.palletSpots} szt.</span></div>
                      )}
                      {(stage.calcMethod === 'TIME' || stage.calcMethod === 'BOTH') && (
                          <>
                           <div className="flex justify-between"><span className="text-zinc-400">Ekipa:</span> <span>{stage.installersCount} os.</span></div>
                           <div className="flex justify-between"><span className="text-zinc-400">Czas:</span> <span>{stage.calculatedDuration} dni</span></div>
                          </>
                      )}
                      <div className="pt-1 border-t border-zinc-700 font-bold text-yellow-500 text-right">
                          {calculateStageCost(stage, data).toFixed(2)} PLN
                      </div>
                  </div>
              );
          }
      }
      // CASE 3: Transport
      else if (hoveredItemId.type === 'TRANSPORT') {
          const t = data.transport.find(x => x.id === hoveredItemId.id);
          if (t) {
              title = t.name || 'Transport';
              content = (
                   <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-zinc-400">Ilość aut:</span> <span>{t.trucksCount}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400">Cena/Auto:</span> <span>{t.pricePerTruck.toFixed(2)} {t.currency}</span></div>
                      {t.linkedSupplierIds && t.linkedSupplierIds.length > 0 && (
                          <div className="text-[10px] text-zinc-500 mt-1">
                              Łączy: {t.linkedSupplierIds.length} dostawców
                          </div>
                      )}
                      <div className="pt-1 border-t border-zinc-700 font-bold text-yellow-500 text-right">
                          {t.totalPrice.toFixed(2)} {t.currency}
                      </div>
                  </div>
              );
          }
      }

      if (!content) return null;

      return (
          <div 
            className="fixed z-[9999] bg-zinc-900 text-white p-3 rounded shadow-xl text-xs w-64 pointer-events-none"
            style={{ top: tooltipPosition.y + 10, left: tooltipPosition.x + 10 }}
          >
              <div className="font-bold mb-2 border-b border-zinc-700 pb-1">{title}</div>
              {content}
          </div>
      );
  };

  const headerClass = "p-3 border-b dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 text-left";
  const cellClass = "p-3 border-b border-zinc-100 dark:border-zinc-800/50 text-sm align-middle";

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 transition-colors relative z-0">
      {renderTooltip()}
      
      <div 
          className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded-t-2xl"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                <Layers size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Warianty / Symulacje</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                    Status: <span className="font-bold text-zinc-700 dark:text-zinc-300">{(data.variants || []).some(v => v.status === 'INCLUDED') ? 'WHITELIST (Solo/Include)' : 'BLACKLIST (Standard)'}</span>
                </p>
            </div>
        </div>
        
        <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <ChevronDown size={20}/>
        </button>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="p-0 border-t border-zinc-100 dark:border-zinc-700">
                {/* Add New Variant Toolbar */}
                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-700 flex justify-end">
                    <form onSubmit={addVariant} className="flex gap-2 w-full md:w-auto">
                        <input 
                            type="text" 
                            placeholder="Nazwa wariantu (np. Opcja A)..."
                            className="flex-1 p-2 border border-zinc-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:border-yellow-400 outline-none min-w-[200px]"
                            value={newVariantName}
                            onChange={(e) => setNewVariantName(e.target.value)}
                        />
                        <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                            <Plus size={16}/> Utwórz
                        </button>
                    </form>
                </div>

                {/* Variants Table */}
                <div className="overflow-x-auto min-h-[100px]">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr>
                                <th className={`${headerClass} w-1/3`}>Nazwa Wariantu</th>
                                <th className={`${headerClass} text-center`}>Elementy</th>
                                <th className={`${headerClass} text-right`}>Wartość ({offerCurrency})</th>
                                <th className={`${headerClass} text-center w-64`}>Akcje (Symulacja)</th>
                                <th className={`${headerClass} w-16`}></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700">
                            {(data.variants || []).length === 0 && (
                                <tr><td colSpan={5} className="p-8 text-center text-zinc-400 italic">Brak wariantów. Dodaj pierwszy wariant powyżej.</td></tr>
                            )}
                            
                            {(data.variants || []).map(variant => {
                                const variantCost = calculateVariantTotal(variant);
                                const isEditing = activeVariantId === variant.id;

                                return (
                                    <React.Fragment key={variant.id}>
                                        <tr className={`transition-colors ${variant.status === 'INCLUDED' ? 'bg-green-50/50 dark:bg-green-900/10' : variant.status === 'EXCLUDED' ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                            <td className={cellClass}>
                                                <div className="relative group/edit">
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-yellow-400 outline-none font-bold text-zinc-700 dark:text-zinc-200 transition-colors py-1"
                                                        value={variant.name}
                                                        onChange={(e) => updateVariantName(variant.id, e.target.value)}
                                                    />
                                                    <Edit2 size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300 opacity-0 group-hover/edit:opacity-100 pointer-events-none"/>
                                                </div>
                                                <div className="text-[10px] text-zinc-400 uppercase font-semibold mt-1">{variant.status}</div>
                                            </td>
                                            <td className={`${cellClass} text-center`}>
                                                <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded-full text-xs font-bold">
                                                    {variant.items.length}
                                                </span>
                                            </td>
                                            <td className={`${cellClass} text-right font-mono font-bold text-zinc-700 dark:text-zinc-300`}>
                                                {variantCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`${cellClass} text-center`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleSoloVariant(variant.id)} className="p-2 rounded-lg text-zinc-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors" title="SOLO"><Crosshair size={16}/></button>
                                                    <button onClick={() => setVariantStatus(variant.id, 'EXCLUDED')} className={`p-2 rounded-lg transition-colors ${variant.status === 'EXCLUDED' ? 'bg-red-100 text-red-600' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'}`} title="WYKLUCZ"><EyeOff size={16}/></button>
                                                    <button onClick={() => setVariantStatus(variant.id, 'INCLUDED')} className={`p-2 rounded-lg transition-colors ${variant.status === 'INCLUDED' ? 'bg-green-100 text-green-600' : 'text-zinc-400 hover:text-green-500 hover:bg-green-50'}`} title="UWZGLĘDNIJ"><Eye size={16}/></button>
                                                    <button onClick={() => setVariantStatus(variant.id, 'NEUTRAL')} className={`p-2 rounded-lg transition-colors ${variant.status === 'NEUTRAL' ? 'text-zinc-300 cursor-default' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`} title="RESET"><MinusCircle size={16}/></button>
                                                </div>
                                            </td>
                                            <td className={`${cellClass} text-center`}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => {
                                                        setActiveVariantId(isEditing ? null : variant.id);
                                                        setShowDropdown(true); // Open dropdown when editing starts
                                                    }} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${isEditing ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50'}`}>{isEditing ? 'Gotowe' : 'Edytuj'}</button>
                                                    <button onClick={() => removeVariant(variant.id)} className="text-zinc-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                        
                                        {isEditing && (
                                            <tr>
                                                <td colSpan={5} className="bg-zinc-50/50 dark:bg-black/20 p-0 border-b border-zinc-100 dark:border-zinc-700 animate-fadeIn">
                                                    <div className="p-4 relative">
                                                        <div className="relative z-50 mb-4">
                                                            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16}/>
                                                            <input 
                                                                ref={searchInputRef}
                                                                type="text" 
                                                                className="w-full pl-10 p-2.5 border border-zinc-200 dark:border-zinc-600 rounded-xl text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 dark:bg-zinc-900 dark:text-white transition-all" 
                                                                placeholder="Wyszukaj elementy do dodania (Etap, Dostawca, Transport)..." 
                                                                value={searchTerm} 
                                                                onChange={(e) => {
                                                                    setSearchTerm(e.target.value);
                                                                    setShowDropdown(true);
                                                                }}
                                                                onFocus={() => setShowDropdown(true)}
                                                                autoFocus
                                                            />
                                                        </div>

                                                        {/* Fixed Position Dropdown to avoid clipping - Updates on Scroll */}
                                                        {showDropdown && (searchTerm.length > 0 || searchResults.length > 0) && activeVariantId && dropdownPosition && (
                                                            <div 
                                                                ref={dropdownRef}
                                                                className="fixed bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 shadow-2xl rounded-xl max-h-80 overflow-y-auto z-[9999] flex flex-col"
                                                                style={{
                                                                    top: dropdownPosition.top,
                                                                    left: dropdownPosition.left,
                                                                    width: dropdownPosition.width
                                                                }}
                                                            >
                                                                <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-700 p-2 flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-600 tracking-wider">
                                                                    <span>Wyniki Wyszukiwania</span>
                                                                    <button onClick={() => setShowDropdown(false)} className="hover:text-red-500 p-1"><X size={14}/></button>
                                                                </div>

                                                                {searchResults.length === 0 && searchTerm ? (
                                                                    <div className="p-4 text-xs text-zinc-400 text-center">Brak wyników dla "{searchTerm}".</div>
                                                                ) : (
                                                                    searchResults.map((res, i) => {
                                                                        // Check if item is already added
                                                                        const isExactMatch = variant.items.some(x => x.id === res.id && x.type === res.type);

                                                                        // Check Parent/Child overlap logic
                                                                        // 1. If I am an item, is my Group already selected?
                                                                        let isParentGroupSelected = false;
                                                                        if (res.type === 'SUPPLIER_ITEM' && !res.isGroup && res.groupId) {
                                                                            isParentGroupSelected = variant.items.some(x => x.id === `group_supp_${res.groupId}` && x.type === 'SUPPLIER_ITEM');
                                                                        }

                                                                        // 2. If I am a Group, are any of my children selected?
                                                                        let isChildSelected = false;
                                                                        if (res.isGroup && res.groupId) {
                                                                            // Find actual supplier to check items
                                                                            const supp = data.suppliers.find(s => s.id === res.groupId);
                                                                            if (supp) {
                                                                                isChildSelected = supp.items.some(i => variant.items.some(v => v.id === i.id));
                                                                            }
                                                                        }

                                                                        const isDisabled = isExactMatch || isParentGroupSelected || isChildSelected;

                                                                        return (
                                                                            <button 
                                                                                key={`${res.id}-${i}`} 
                                                                                onClick={() => !isDisabled && addItemToVariant(variant.id, res)} 
                                                                                disabled={isDisabled}
                                                                                className={`w-full text-left p-3 text-xs border-b border-zinc-100 dark:border-zinc-700 last:border-0 flex justify-between items-center transition-colors 
                                                                                    ${isDisabled 
                                                                                        ? 'bg-zinc-50 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed' 
                                                                                        : 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                                                    }`}
                                                                            >
                                                                                <div>
                                                                                    <div className={`font-bold flex items-center gap-2 ${isDisabled ? 'text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                                                                        {res.isRecommended && !isDisabled && <Link size={12} className="text-green-500" />}
                                                                                        {res.label}
                                                                                    </div>
                                                                                    {res.description && <div className="text-[10px] text-zinc-500 mt-0.5">{res.description}</div>}
                                                                                    {isParentGroupSelected && <div className="text-[9px] text-red-400 italic mt-0.5">Grupa nadrzędna już wybrana</div>}
                                                                                    {isChildSelected && <div className="text-[9px] text-red-400 italic mt-0.5">Elementy tej grupy są już wybrane</div>}
                                                                                </div>
                                                                                {isDisabled ? (
                                                                                    isExactMatch ? <Check size={14} className="text-green-500"/> : <Lock size={12} className="text-zinc-400"/>
                                                                                ) : (
                                                                                    res.isRecommended ? <ArrowRight size={14} className="text-green-500 opacity-50"/> : null
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto border border-zinc-200 dark:border-zinc-600 rounded-xl bg-white dark:bg-zinc-900">
                                                            {variant.items.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 italic">Pusty wariant. Dodaj elementy korzystając z wyszukiwarki powyżej.</div>}
                                                            {variant.items.map((item, idx) => {
                                                                const { val, curr } = getItemValue(item.id, item.type);
                                                                return (
                                                                    <div 
                                                                        key={`${item.id}-${idx}`} 
                                                                        className="flex justify-between items-center p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
                                                                        onMouseEnter={(e) => handleMouseEnterItem(e, item.id, item.type)}
                                                                        onMouseLeave={() => setHoveredItemId(null)}
                                                                    >
                                                                        <span className="truncate text-xs font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                                                                            {item.type === 'STAGE' && <div className="p-1 bg-purple-100 text-purple-600 rounded"><Layers size={10}/></div>}
                                                                            {item.type === 'TRANSPORT' && <div className="p-1 bg-blue-100 text-blue-600 rounded"><Layers size={10}/></div>}
                                                                            {item.originalDescription}
                                                                            
                                                                            {val > 0 && (
                                                                                <span className="ml-2 text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                                                                                    {val.toFixed(2)} {curr}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <button onClick={() => removeItemFromVariant(variant.id, item.id, item.type)} className="text-zinc-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><X size={14}/></button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
