
import React, { useState, useEffect, useRef } from 'react';
import { InstallationData, CustomInstallationItem, Currency, Supplier, InstallationStage, LinkedSource } from '../types';
import { Wrench, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Link, Search, X, Box, Package, Clock, Users, Combine, Info, RefreshCw, Settings, Truck, Edit2, Lock, Unlock, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { convert, calculateStageCost } from '../services/calculationService';

interface Props {
  data: InstallationData;
  onChange: (data: InstallationData) => void;
  exchangeRate: number;
  offerCurrency: Currency;
  suppliers: Supplier[];
}

interface LinkOption {
    id: string;
    type: 'GROUP' | 'ITEM';
    label: string;
    subLabel?: string;
    qty: number;
    supplierId: string;
}

export const InstallationSection: React.FC<Props> = ({ data, onChange, exchangeRate, offerCurrency, suppliers }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [linkMenuOpen, setLinkMenuOpen] = useState<{stageId: string, itemIdx: number} | null>(null);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const linkMenuRef = useRef<HTMLDivElement>(null);

  // Initialize stages if empty (Migration logic)
  useEffect(() => {
      if (!data.stages || data.stages.length === 0) {
          const defaultStage: InstallationStage = {
              id: 'default_stage',
              name: 'Montaż Główny',
              linkedSupplierIds: suppliers.map(s => s.id),
              calcMethod: data.calcMethod || 'PALLETS',
              palletSpots: data.palletSpots || 0,
              palletSpotPrice: data.palletSpotPrice || 0,
              palletSpotsPerDay: data.palletSpotsPerDay || 0,
              workDayHours: data.workDayHours || 10,
              installersCount: data.installersCount || 2,
              manDayRate: data.manDayRate || 0,
              manualLaborHours: data.manualLaborHours || 0,
              // Migration of global equipment to first stage
              forkliftDailyRate: data.forkliftDailyRate || 0,
              forkliftDays: data.forkliftDays || 0,
              forkliftTransportPrice: data.forkliftTransportPrice || 0,
              scissorLiftDailyRate: data.scissorLiftDailyRate || 0,
              scissorLiftDays: data.scissorLiftDays || 0,
              scissorLiftTransportPrice: data.scissorLiftTransportPrice || 0,
              customItems: data.customItems || [],
              
              calculatedCost: 0,
              calculatedDuration: 0
          };
          onChange({ ...data, stages: [defaultStage] });
      }
  }, []);

  // Click outside to close link menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (linkMenuRef.current && !linkMenuRef.current.contains(event.target as Node)) {
              setLinkMenuOpen(null);
          }
      };
      if (linkMenuOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [linkMenuOpen]);

  // Reset search on open
  useEffect(() => {
    if (linkMenuOpen) setLinkSearchTerm('');
  }, [linkMenuOpen]);

  const stages = data.stages || [];

  const updateStage = (stageId: string, updates: Partial<InstallationStage>) => {
      const newStages = stages.map(s => s.id === stageId ? { ...s, ...updates } : s);
      onChange({ ...data, stages: newStages });
  };

  const toggleStageCollapse = (id: string) => {
      const newSet = new Set(collapsedStages);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setCollapsedStages(newSet);
  };

  const addStage = () => {
      const newStage: InstallationStage = {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Nowy Etap Montażu',
          linkedSupplierIds: [],
          calcMethod: 'PALLETS',
          palletSpots: 0,
          palletSpotPrice: 0,
          palletSpotsPerDay: 0,
          workDayHours: 10,
          installersCount: 2,
          manDayRate: 0,
          manualLaborHours: 0,
          forkliftDailyRate: 0,
          forkliftDays: 0,
          forkliftTransportPrice: 0,
          scissorLiftDailyRate: 0,
          scissorLiftDays: 0,
          scissorLiftTransportPrice: 0,
          customItems: [],
          calculatedCost: 0,
          calculatedDuration: 0
      };
      onChange({ ...data, stages: [...stages, newStage] });
  };

  const removeStage = (id: string) => {
      if(stages.length <= 1) {
          alert("Musi istnieć przynajmniej jeden etap montażu.");
          return;
      }
      onChange({ ...data, stages: stages.filter(s => s.id !== id) });
  };

  const toggleSupplierInStage = (stageId: string, supplierId: string) => {
      const stage = stages.find(s => s.id === stageId);
      if (!stage) return;
      
      let newIds = stage.linkedSupplierIds || [];
      if (newIds.includes(supplierId)) {
          newIds = newIds.filter(id => id !== supplierId);
      } else {
          newIds = [...newIds, supplierId];
      }
      
      const newStages = stages.map(s => {
          if (s.id === stageId) return { ...s, linkedSupplierIds: newIds };
          return s;
      });
      
      onChange({ ...data, stages: newStages });
  };

  // --- Calculations for Display ---
  let totalProjectCostPLN = data.otherInstallationCosts;
  
  stages.forEach(stage => {
      if (!stage.isExcluded) {
        totalProjectCostPLN += calculateStageCost(stage, { ...data, suppliers });
      }
  });

  const installationTotal = convert(totalProjectCostPLN, Currency.PLN, offerCurrency, exchangeRate);

  // --- HELPER FOR LINKING OPTIONS ---
  const getLinkOptions = (): LinkOption[] => {
      const options: LinkOption[] = [];
      suppliers.forEach(s => {
          if(s.isIncluded === false) return;
          const supplierTotalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);
          
          // Add Supplier Group Option
          options.push({
              id: s.id,
              type: 'GROUP',
              label: `Dostawca: ${s.customTabName || s.name}`,
              subLabel: `Suma elementów: ${supplierTotalQty}`,
              qty: supplierTotalQty,
              supplierId: s.id
          });

          // Add Individual Items
          s.items.forEach(i => {
              options.push({
                  id: i.id,
                  type: 'ITEM',
                  label: `${i.itemDescription}`,
                  subLabel: `${s.customTabName || s.name} | ${i.quantity} szt.`,
                  qty: i.quantity,
                  supplierId: s.id
              });
          });
      });
      return options;
  };

  // Calculate global usage of items/groups across ALL stages and ALL custom items
  const getGlobalUsage = () => {
      const usedGroups = new Set<string>();
      const usedItems = new Set<string>();

      stages.forEach(s => {
          // 1. Linked Suppliers (ORM) are effectively used Groups
          s.linkedSupplierIds?.forEach(id => usedGroups.add(id));

          // 2. Custom Items Links
          s.customItems.forEach(ci => {
              ci.linkedSources?.forEach(src => {
                  if (src.type === 'GROUP') usedGroups.add(src.id);
                  if (src.type === 'ITEM') usedItems.add(src.id);
              });
          });
      });
      return { usedGroups, usedItems };
  };

  const { usedGroups, usedItems } = getGlobalUsage();

  // Filter options based on search term
  const filteredLinkOptions = getLinkOptions().filter(opt => {
      if (!linkSearchTerm) return true;
      const lower = linkSearchTerm.toLowerCase();
      return (
          opt.label.toLowerCase().includes(lower) || 
          (opt.subLabel && opt.subLabel.toLowerCase().includes(lower))
      );
  });

  // Helper to calculate total Qty from sources
  const calculateTotalLinkedQty = (sources: LinkedSource[]): number => {
      if (!sources || sources.length === 0) return 0;
      let total = 0;
      sources.forEach(src => {
          if (src.type === 'GROUP') {
              const s = suppliers.find(x => x.id === src.id);
              if (s) total += s.items.reduce((sum, i) => sum + i.quantity, 0);
          } else {
              for(const s of suppliers) {
                  const found = s.items.find(i => i.id === src.id);
                  if (found) { total += found.quantity; break; }
              }
          }
      });
      return total;
  };

  // --- Render Stage ---
  const renderStage = (stage: InstallationStage, index: number) => {
      const stageCost = calculateStageCost(stage, { ...data, suppliers });
      const isExcluded = stage.isExcluded;
      const isCollapsed = collapsedStages.has(stage.id);
      
      // Calculate Time metrics
      let stageMinutes = 0;
      stage.linkedSupplierIds?.forEach(sid => {
           const s = suppliers.find(x => x.id === sid);
           if(s) s.items.forEach(i => !i.isExcluded && (stageMinutes += (i.quantity * (i.timeMinutes || 0))));
      });
      const stageHours = stageMinutes / 60;
      const stageTotalHours = stageHours + (stage.manualLaborHours || 0);
      const stageCapacity = (stage.workDayHours || 10) * (stage.installersCount || 1);
      const stageDuration = stage.calcMethod === 'TIME' 
        ? (stageCapacity > 0 ? Math.ceil(stageTotalHours / stageCapacity) : 0)
        : (stage.palletSpotsPerDay > 0 ? Math.ceil(stage.palletSpots / stage.palletSpotsPerDay) : 0);

      // --- Custom Items Handlers inside Stage ---
      const addCustomItem = () => updateStage(stage.id, { customItems: [...stage.customItems, { id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unitPrice: 0 }] });
      const removeCustomItem = (idx: number) => updateStage(stage.id, { customItems: stage.customItems.filter((_, i) => i !== idx) });
      
      const updateCustomItem = (idx: number, field: keyof CustomInstallationItem, value: any) => {
          const newItems = [...stage.customItems];
          const item = newItems[idx];
          
          // Special handling for Quantity Manual Override
          if (field === 'quantity' && item.linkedSources && item.linkedSources.length > 0 && item.isAutoQuantity) {
              item.isAutoQuantity = false; // Break the auto-sync link if manually edited
          }

          newItems[idx] = { ...item, [field]: value };
          updateStage(stage.id, { customItems: newItems });
      };

      const toggleLinkItem = (idx: number, option: LinkOption) => {
          const newItems = [...stage.customItems];
          const item = newItems[idx];
          
          let currentSources = item.linkedSources || [];
          
          // Check if already linked
          const exists = currentSources.some(s => s.id === option.id && s.type === option.type);
          
          if (exists) {
              // Remove
              currentSources = currentSources.filter(s => !(s.id === option.id && s.type === option.type));
          } else {
              // Add
              currentSources = [...currentSources, { id: option.id, type: option.type }];
          }

          const newTotalQty = calculateTotalLinkedQty(currentSources);
          
          // Update description if it's the first link and description is empty
          let desc = item.description;
          if (currentSources.length > 0 && (!desc || desc === '')) {
              desc = currentSources.length === 1 
                  ? (option.type === 'ITEM' ? `Montaż: ${option.label}` : `Montaż elementów: ${option.label}`)
                  : `Montaż (wiele elementów)`;
          }

          newItems[idx] = {
              ...item,
              linkedSources: currentSources,
              quantity: newTotalQty,
              isAutoQuantity: true, // Auto enable sync
              description: desc
          };
          updateStage(stage.id, { customItems: newItems });
      };

      const handleUnlinkAll = (idx: number) => {
          const newItems = [...stage.customItems];
          newItems[idx] = {
              ...newItems[idx],
              linkedSources: [],
              isAutoQuantity: false
          };
          updateStage(stage.id, { customItems: newItems });
      };

      const handleSyncItem = (idx: number) => {
          const item = stage.customItems[idx];
          if (!item.linkedSources || item.linkedSources.length === 0) return;

          const newQty = calculateTotalLinkedQty(item.linkedSources);
          const newItems = [...stage.customItems];
          newItems[idx] = { ...item, quantity: newQty, isAutoQuantity: true };
          updateStage(stage.id, { customItems: newItems });
      };


      return (
          <div key={stage.id} className={`bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg mb-4 relative shadow-sm transition-all ${isExcluded ? 'opacity-50 grayscale' : ''}`}>
               {isExcluded && <div className="absolute top-0 right-0 left-0 bg-red-500 text-white text-xs font-bold text-center py-0.5 rounded-t-lg z-10">ETAP WYKLUCZONY Z WARIANTU</div>}
               
               {/* STAGE HEADER */}
               <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-t-lg border-b dark:border-zinc-700">
                   <div className="flex items-center gap-3 w-full max-w-md">
                       <button 
                           onClick={() => toggleStageCollapse(stage.id)} 
                           className="bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 p-1 rounded transition-colors text-zinc-600 dark:text-zinc-300"
                       >
                           {isCollapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                       </button>
                       <span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-500 font-bold px-2 py-1 rounded text-xs">#{index + 1}</span>
                       <div className="relative group flex-1">
                            <input 
                                    type="text" 
                                    className="font-bold text-zinc-800 dark:text-zinc-100 bg-transparent outline-none border-b-2 border-transparent focus:border-yellow-400 hover:border-zinc-200 dark:hover:border-zinc-600 px-1 py-0.5 rounded transition-all w-full pr-8"
                                    value={stage.name}
                                    onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                                    placeholder="Nazwa Etapu (np. Antresola)"
                                    onClick={(e) => e.stopPropagation()}
                            />
                            <Edit2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
                       </div>
                   </div>
                   <div className="flex items-center gap-4">
                       <div className="text-right">
                           <span className="text-xs text-zinc-400 uppercase font-bold">Koszt Etapu</span>
                           <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{stageCost.toFixed(2)} PLN</div>
                       </div>
                       <button onClick={() => removeStage(stage.id)} className="text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
                   </div>
               </div>

               {/* STAGE CONTENT (COLLAPSIBLE) */}
               {!isCollapsed && (
                   <div className="p-4 animate-slideUp">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Col 1: Suppliers Linking */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded border border-zinc-100 dark:border-zinc-700">
                                <div className="text-xs font-bold text-zinc-500 mb-2 flex items-center gap-2">
                                    <Combine size={14}/> Powiązani Dostawcy (ORM)
                                </div>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {suppliers.map(s => {
                                        const isLinked = stage.linkedSupplierIds?.includes(s.id);
                                        const linkedElsewhere = !isLinked && stages.some(os => os.linkedSupplierIds?.includes(s.id));
                                        
                                        return (
                                            <button 
                                                    key={s.id}
                                                    onClick={() => toggleSupplierInStage(stage.id, s.id)}
                                                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex justify-between items-center border transition-colors ${
                                                        isLinked 
                                                        ? 'bg-blue-100 border-blue-200 text-blue-800 font-bold' 
                                                        : linkedElsewhere 
                                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent opacity-50' 
                                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-yellow-400'
                                                    }`}
                                            >
                                                <span className="truncate">{s.customTabName || s.name}</span>
                                                {isLinked && <CheckLink size={12}/>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Col 2 & 3: Method & Details */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex gap-2 mb-2">
                                    <button onClick={() => updateStage(stage.id, { calcMethod: 'PALLETS' })} className={`flex-1 py-1 text-xs font-bold rounded border transition-colors ${stage.calcMethod === 'PALLETS' ? 'bg-yellow-100 border-yellow-300 text-yellow-900' : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600'}`}>Miejsca Paletowe</button>
                                    <button onClick={() => updateStage(stage.id, { calcMethod: 'TIME' })} className={`flex-1 py-1 text-xs font-bold rounded border transition-colors ${stage.calcMethod === 'TIME' ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600'}`}>Roboczogodziny (ORM)</button>
                                    <button onClick={() => updateStage(stage.id, { calcMethod: 'BOTH' })} className={`flex-1 py-1 text-xs font-bold rounded border transition-colors ${stage.calcMethod === 'BOTH' ? 'bg-purple-100 border-purple-300 text-purple-900' : 'bg-white dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600'}`}>Łączona (Palety + Czas)</button>
                                </div>

                                {(stage.calcMethod === 'PALLETS' || stage.calcMethod === 'BOTH') && (
                                    <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                                        {stage.calcMethod === 'BOTH' && <div className="col-span-3 text-[10px] font-bold text-yellow-600 uppercase border-b border-yellow-100 mb-1">Część 1: Miejsca Paletowe</div>}
                                        <div><label className="block text-[10px] font-bold text-zinc-500 uppercase">Ilość Miejsc</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.palletSpots} onChange={(e) => updateStage(stage.id, { palletSpots: parseFloat(e.target.value) || 0 })} /></div>
                                        <div><label className="block text-[10px] font-bold text-zinc-500 uppercase">Wydajność (szt/dzień)</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.palletSpotsPerDay} onChange={(e) => updateStage(stage.id, { palletSpotsPerDay: parseFloat(e.target.value) || 0 })} /></div>
                                        <div><label className="block text-[10px] font-bold text-zinc-500 uppercase">Cena / Miejsce</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.palletSpotPrice} onChange={(e) => updateStage(stage.id, { palletSpotPrice: parseFloat(e.target.value) || 0 })} /></div>
                                    </div>
                                )}

                                {(stage.calcMethod === 'TIME' || stage.calcMethod === 'BOTH') && (
                                    <div className="grid grid-cols-4 gap-3 animate-fadeIn">
                                        {stage.calcMethod === 'BOTH' && <div className="col-span-4 text-[10px] font-bold text-blue-600 uppercase border-b border-blue-100 mb-1 mt-2">Część 2: Roboczogodziny</div>}
                                        <div className="col-span-4 bg-blue-50 dark:bg-blue-900/20 p-2 rounded flex justify-between items-center text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                            <span>ORM: <strong>{stageHours.toFixed(1)}h</strong></span>
                                            <span>+ Manual: <input type="number" className="w-16 p-1 text-center border rounded bg-white dark:bg-zinc-800 ml-1" value={stage.manualLaborHours} onChange={(e) => updateStage(stage.id, { manualLaborHours: parseFloat(e.target.value) || 0 })} /> h</span>
                                            <span>= <strong>{stageTotalHours.toFixed(1)}h</strong></span>
                                        </div>
                                        <div><label className="block text-[10px] font-bold text-zinc-500 uppercase">Osoby</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.installersCount} onChange={(e) => updateStage(stage.id, { installersCount: parseFloat(e.target.value) || 0 })} /></div>
                                        <div><label className="block text-[10px] font-bold text-zinc-500 uppercase">h/Dzień</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.workDayHours} onChange={(e) => updateStage(stage.id, { workDayHours: parseFloat(e.target.value) || 0 })} /></div>
                                        <div className="col-span-2"><label className="block text-[10px] font-bold text-zinc-500 uppercase">Stawka (osobodzień)</label><input type="number" className="w-full p-2 border rounded text-sm bg-white dark:bg-zinc-800" value={stage.manDayRate} onChange={(e) => updateStage(stage.id, { manDayRate: parseFloat(e.target.value) || 0 })} /></div>
                                    </div>
                                )}
                                
                                <div className="text-right text-xs text-zinc-500">Estymowany czas: <strong className="text-zinc-800 dark:text-zinc-200">{stageDuration} dni</strong></div>
                            </div>
                        </div>

                        {/* --- EQUIPMENT FOR THIS STAGE --- */}
                        <div className="mt-4 pt-4 border-t dark:border-zinc-700">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2"><Truck size={12}/> Sprzęt dla etapu</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Forklift */}
                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-700">
                                        <div className="flex justify-between mb-2"><span className="text-xs font-semibold">Wózek Widłowy</span></div>
                                        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 font-bold uppercase mb-1">
                                            <div>Stawka dzienna</div>
                                            <div>Ilość Dni</div>
                                            <div>Koszt Transportu</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" placeholder="0.00" className="p-1 border rounded text-xs" value={stage.forkliftDailyRate} onChange={e => updateStage(stage.id, { forkliftDailyRate: parseFloat(e.target.value) || 0 })} />
                                            <div className="relative">
                                                <input type="number" placeholder="0" className={`p-1 border rounded text-xs w-full ${stage.forkliftDays !== stageDuration ? 'border-orange-300' : ''}`} value={stage.forkliftDays} onChange={e => updateStage(stage.id, { forkliftDays: parseFloat(e.target.value) || 0 })} />
                                                {stage.forkliftDays !== stageDuration && stageDuration > 0 && (
                                                    <button onClick={() => updateStage(stage.id, { forkliftDays: stageDuration })} className="absolute right-1 top-1 text-blue-500 hover:text-blue-700" title="Sync"><RefreshCw size={10}/></button>
                                                )}
                                            </div>
                                            <input type="number" placeholder="0.00" className="p-1 border rounded text-xs" value={stage.forkliftTransportPrice} onChange={e => updateStage(stage.id, { forkliftTransportPrice: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                    </div>
                                    {/* Scissor Lift */}
                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-zinc-100 dark:border-zinc-700">
                                        <div className="flex justify-between mb-2"><span className="text-xs font-semibold">Podnośnik</span></div>
                                        <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 font-bold uppercase mb-1">
                                            <div>Stawka dzienna</div>
                                            <div>Ilość Dni</div>
                                            <div>Koszt Transportu</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" placeholder="0.00" className="p-1 border rounded text-xs" value={stage.scissorLiftDailyRate} onChange={e => updateStage(stage.id, { scissorLiftDailyRate: parseFloat(e.target.value) || 0 })} />
                                            <div className="relative">
                                                <input type="number" placeholder="0" className={`p-1 border rounded text-xs w-full ${stage.scissorLiftDays !== stageDuration ? 'border-orange-300' : ''}`} value={stage.scissorLiftDays} onChange={e => updateStage(stage.id, { scissorLiftDays: parseFloat(e.target.value) || 0 })} />
                                                {stage.scissorLiftDays !== stageDuration && stageDuration > 0 && (
                                                    <button onClick={() => updateStage(stage.id, { scissorLiftDays: stageDuration })} className="absolute right-1 top-1 text-blue-500 hover:text-blue-700" title="Sync"><RefreshCw size={10}/></button>
                                                )}
                                            </div>
                                            <input type="number" placeholder="0.00" className="p-1 border rounded text-xs" value={stage.scissorLiftTransportPrice} onChange={e => updateStage(stage.id, { scissorLiftTransportPrice: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                    </div>
                                </div>
                        </div>

                        {/* --- CUSTOM ITEMS FOR THIS STAGE --- */}
                        <div className="mt-4 pt-2 border-t dark:border-zinc-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2"><Settings size={12}/> Dodatki / Inne</h4>
                                    <button onClick={addCustomItem} className="text-[10px] bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded flex items-center gap-1"><Plus size={10}/> Dodaj</button>
                                </div>
                                
                                {stage.customItems.map((item, idx) => {
                                    const linkedCount = item.linkedSources?.length || 0;
                                    const isLinked = linkedCount > 0;
                                    const isAuto = !!item.isAutoQuantity;
                                    
                                    return (
                                    <div key={item.id} className={`flex gap-2 items-center mb-1 relative ${item.isExcluded ? 'opacity-50' : ''}`}>
                                        <div className="relative flex-1">
                                            <input 
                                                type="text" 
                                                className={`w-full p-1 border rounded text-xs ${isLinked ? 'pl-6' : ''}`}
                                                value={item.description} 
                                                onChange={e => updateCustomItem(idx, 'description', e.target.value)} 
                                                placeholder="Opis..." 
                                            />
                                            {isLinked && (
                                                <button 
                                                    onClick={() => handleUnlinkAll(idx)}
                                                    className="absolute left-1 top-1/2 -translate-y-1/2 text-blue-500 hover:text-red-500"
                                                    title={`Połączono z ${linkedCount} elementami. Kliknij aby odłączyć.`}
                                                >
                                                    <Link size={12} />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Quantity Input with Link Logic */}
                                        <div className="relative w-20">
                                             <input 
                                                type="number" 
                                                className={`w-full p-1 border rounded text-xs text-center ${isAuto ? 'bg-blue-50 text-blue-800 font-bold' : ''}`} 
                                                value={item.quantity} 
                                                onChange={e => updateCustomItem(idx, 'quantity', parseFloat(e.target.value) || 0)} 
                                            />
                                            {isAuto && (
                                                 <Lock size={8} className="absolute right-1 top-1 text-blue-400" />
                                            )}
                                            {!isAuto && isLinked && (
                                                 <button 
                                                    onClick={() => handleSyncItem(idx)}
                                                    className="absolute right-1 top-1 text-orange-400 hover:text-blue-600"
                                                    title="Przywróć synchronizację ilości (Suma zaznaczonych)"
                                                 >
                                                     <RefreshCw size={8} />
                                                 </button>
                                            )}
                                        </div>

                                        <input type="number" className="w-20 p-1 border rounded text-xs text-right" value={item.unitPrice} onChange={e => updateCustomItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                                        
                                        {/* Link Button */}
                                        <div className="relative">
                                            <button 
                                                onClick={() => setLinkMenuOpen({ stageId: stage.id, itemIdx: idx })}
                                                className={`p-1 rounded text-zinc-400 hover:text-blue-500 ${linkMenuOpen?.stageId === stage.id && linkMenuOpen.itemIdx === idx ? 'bg-blue-100 text-blue-600' : ''}`}
                                                title="Wybierz elementy/grupy do zsumowania"
                                            >
                                                <Link size={14}/>
                                            </button>
                                            
                                            {/* Link Menu Dropdown */}
                                            {linkMenuOpen?.stageId === stage.id && linkMenuOpen.itemIdx === idx && (
                                                <div ref={linkMenuRef} className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-600 shadow-xl rounded z-50 w-80 max-h-80 overflow-y-auto flex flex-col">
                                                     <div className="p-2 border-b dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
                                                          <div className="relative">
                                                              <Search size={12} className="absolute left-2 top-2 text-zinc-400"/>
                                                              <input 
                                                                  type="text"
                                                                  autoFocus
                                                                  className="w-full pl-7 p-1 text-xs border rounded bg-zinc-50 dark:bg-zinc-900 focus:border-blue-400 outline-none"
                                                                  placeholder="Szukaj..."
                                                                  value={linkSearchTerm}
                                                                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                                                              />
                                                          </div>
                                                     </div>
                                                     
                                                     <div className="overflow-y-auto">
                                                        {filteredLinkOptions.map(opt => {
                                                            const isSelectedInCurrent = item.linkedSources?.some(s => s.id === opt.id && s.type === opt.type);
                                                            
                                                            // Global Validation Logic
                                                            let isDisabled = false;
                                                            let disabledReason = '';
                                                            
                                                            // Logic:
                                                            // 1. Group is disabled if:
                                                            //    - Group ID is already used as ORM in ANY stage or as LINK elsewhere.
                                                            //    - ANY item of this group is used individually elsewhere.
                                                            // 2. Item is disabled if:
                                                            //    - Item ID is already used.
                                                            //    - Parent Group ID is used elsewhere.
                                                            
                                                            if (opt.type === 'GROUP') {
                                                                if (usedGroups.has(opt.id) && !isSelectedInCurrent) {
                                                                    isDisabled = true;
                                                                    disabledReason = 'Grupa/Dostawca już wykorzystany (Montaż lub ORM)';
                                                                } else {
                                                                    // Check if any child item is used
                                                                    const supplier = suppliers.find(s => s.id === opt.id);
                                                                    if (supplier && supplier.items.some(i => usedItems.has(i.id))) {
                                                                         isDisabled = true;
                                                                         disabledReason = 'Część elementów z tej grupy jest już wykorzystana';
                                                                    }
                                                                }
                                                            } else {
                                                                // ITEM
                                                                if (usedItems.has(opt.id) && !isSelectedInCurrent) {
                                                                    isDisabled = true;
                                                                    disabledReason = 'Element już wykorzystany';
                                                                } else if (usedGroups.has(opt.supplierId)) {
                                                                    isDisabled = true;
                                                                     disabledReason = 'Cała grupa (Dostawca) jest już wykorzystana';
                                                                }
                                                            }
                                                            
                                                            // Can always deselect self
                                                            if (isSelectedInCurrent) isDisabled = false;

                                                            return (
                                                                <button
                                                                    key={`${opt.type}-${opt.id}`}
                                                                    className={`w-full text-left p-2 border-b last:border-0 text-xs flex justify-between items-center group transition-colors relative
                                                                        ${isSelectedInCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                                                                        ${isDisabled ? 'bg-zinc-50 dark:bg-zinc-800/80 cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700'}
                                                                    `}
                                                                    onClick={() => !isDisabled && toggleLinkItem(idx, opt)}
                                                                    disabled={isDisabled}
                                                                    title={disabledReason}
                                                                >
                                                                    <div className={`flex items-center gap-2 overflow-hidden ${isDisabled ? 'opacity-50' : ''}`}>
                                                                        <div className={`w-3 h-3 border rounded flex items-center justify-center shrink-0 ${isSelectedInCurrent ? 'bg-blue-500 border-blue-500' : 'border-zinc-300'}`}>
                                                                            {isSelectedInCurrent && <CheckSquare size={10} className="text-white"/>}
                                                                        </div>
                                                                        <div className="truncate">
                                                                            <div className="truncate font-medium text-zinc-700 dark:text-zinc-200">{opt.label}</div>
                                                                            {opt.subLabel && <div className="truncate text-[10px] text-zinc-400">{opt.subLabel}</div>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {isDisabled && <AlertCircle size={12} className="text-red-300"/>}
                                                                        <div className={`bg-zinc-100 text-zinc-600 px-1.5 rounded font-mono text-[10px] shrink-0 ml-2 ${isDisabled ? 'opacity-50' : 'group-hover:bg-blue-100 group-hover:text-blue-700'}`}>
                                                                            {opt.qty}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                        {filteredLinkOptions.length === 0 && (
                                                            <div className="p-4 text-center text-xs text-zinc-400 italic">Brak wyników.</div>
                                                        )}
                                                     </div>
                                                     <div className="p-2 border-t dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-right">
                                                         <button 
                                                            onClick={() => setLinkMenuOpen(null)}
                                                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold hover:bg-blue-700"
                                                         >
                                                             Gotowe
                                                         </button>
                                                     </div>
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={() => updateCustomItem(idx, 'isExcluded', !item.isExcluded)} className="text-zinc-400 hover:text-zinc-600">{item.isExcluded ? <EyeOff size={12}/> : <Eye size={12}/>}</button>
                                        <button onClick={() => removeCustomItem(idx)} className="text-zinc-300 hover:text-red-500"><Trash2 size={12}/></button>
                                    </div>
                                    );
                                })}
                        </div>
                   </div>
               )}
          </div>
      );
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-8 transition-colors relative z-10">
      <div 
          className="p-4 flex justify-between items-center cursor-pointer bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Wrench className="text-yellow-500" size={20} /> Koszty Montażu (Etapowe)
        </h2>
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {installationTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {offerCurrency}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
        </div>
      </div>
      
      {isOpen && (
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-900/10">
            {/* STAGES LIST */}
            {stages.map((stage, idx) => renderStage(stage, idx))}
            
            <div className="mt-4 flex justify-center">
                 <button 
                    onClick={addStage}
                    className="flex items-center gap-2 bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 px-4 py-2 rounded text-sm font-bold hover:opacity-90 shadow-sm"
                >
                    <Plus size={16}/> Dodaj Kolejny Etap
                </button>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase">Globalne Koszty Dodatkowe (Ryczałt Projektowy)</label>
                <input type="number" min="0" value={data.otherInstallationCosts} onChange={(e) => onChange({...data, otherInstallationCosts: parseFloat(e.target.value) || 0})} className="w-full max-w-xs p-2 border rounded bg-white dark:bg-zinc-800 text-sm font-mono" placeholder="0.00" />
            </div>
        </div>
      )}
    </div>
  );
};

const CheckLink = ({size}: {size: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
