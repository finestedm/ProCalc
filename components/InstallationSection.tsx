
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InstallationData, CustomInstallationItem, Currency, Supplier, InstallationStage, LinkedSource, VariantItemType } from '../types';
import { Wrench, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Link, Search, X, Box, Package, Clock, Users, Combine, Info, RefreshCw, Settings, Truck, Edit2, Lock, Unlock, CheckSquare, Square, AlertCircle, Calendar, Play, Copy, ListPlus, MousePointer2, CornerDownRight, FolderOpen, GripVertical, Archive, Edit3 } from 'lucide-react';
import { convert, calculateStageCost, formatCurrency, formatNumber } from '../services/calculationService';
import { SmartInput } from './SmartInput';
import { EmptyState } from './EmptyState';

interface Props {
  data: InstallationData;
  onChange: (data: InstallationData) => void;
  exchangeRate: number;
  offerCurrency: Currency;
  suppliers: Supplier[];
  isPickingMode?: boolean;
  onPick?: (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => void;
  onEnterPickingMode?: (targetId: string) => void;
  onEditPackage?: (item: CustomInstallationItem) => void;
}

interface LinkOption {
    id: string;
    type: 'GROUP' | 'ITEM';
    label: string;
    subLabel?: string;
    qty: number;
    supplierId: string;
}

interface SearchResult {
    id: string;
    type: 'GROUP' | 'ITEM';
    label: string;
    description: string;
    qty: number;
    supplierId: string;
    isGroup: boolean;
}

export const InstallationSection: React.FC<Props> = ({ 
    data, onChange, exchangeRate, offerCurrency, suppliers,
    isPickingMode, onPick, onEnterPickingMode, onEditPackage
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [linkMenuOpen, setLinkMenuOpen] = useState<{stageId: string, itemIdx: number} | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number, left: number } | null>(null);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const linkMenuRef = useRef<HTMLDivElement>(null);

  // Global Items Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchDropdownPosition, setSearchDropdownPosition] = useState<{ top: number, left: number, width: number } | null>(null);

  // Drag and Drop State for Global Items
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'top' | 'middle' | 'bottom' | null>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (linkMenuRef.current && !linkMenuRef.current.contains(event.target as Node)) {
              setLinkMenuOpen(null);
          }
      };
      if (linkMenuOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [linkMenuOpen]);

  useEffect(() => {
      const handleScroll = (event: Event) => {
          if (linkMenuRef.current) {
               const target = event.target as Node;
               if (target === linkMenuRef.current || linkMenuRef.current.contains(target)) return; 
          }
          if (linkMenuOpen) setLinkMenuOpen(null);
      };

      if (linkMenuOpen) {
          window.addEventListener('scroll', handleScroll, true);
          window.addEventListener('resize', handleScroll);
      }
      return () => {
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', handleScroll);
      };
  }, [linkMenuOpen]);

  useEffect(() => {
    if (linkMenuOpen) setLinkSearchTerm('');
  }, [linkMenuOpen]);

  // Global Search Click Outside
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
      if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const updateSearchDropdownPosition = () => {
      if (searchInputRef.current) {
          const rect = searchInputRef.current.getBoundingClientRect();
          setSearchDropdownPosition({
              top: rect.bottom + 5,
              left: rect.left,
              width: rect.width
          });
      }
  };

  useEffect(() => {
      if (showDropdown) {
          updateSearchDropdownPosition();
          window.addEventListener('scroll', updateSearchDropdownPosition, true);
          window.addEventListener('resize', updateSearchDropdownPosition);
      }
      return () => {
          window.removeEventListener('scroll', updateSearchDropdownPosition, true);
          window.removeEventListener('resize', updateSearchDropdownPosition);
      };
  }, [showDropdown, searchTerm]);

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
          name: `Etap Montażu ${stages.length + 1}`,
          linkedSupplierIds: [],
          calcMethod: 'PALLETS',
          palletSpots: 0,
          palletSpotPrice: 0,
          palletSpotsPerDay: 0,
          workDayHours: 10,
          installersCount: 2,
          manDayRate: 0,
          manualLaborHours: 0,
          hasForklift: false,
          forkliftDailyRate: 0,
          forkliftDays: 0,
          forkliftTransportPrice: 0,
          hasScissorLift: false,
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

  // --- GLOBAL CUSTOM ITEMS HANDLERS ---
  const addGlobalCustomItem = () => {
      const newItem: CustomInstallationItem = {
          id: Math.random().toString(36).substr(2, 9),
          description: '',
          quantity: 1,
          unitPrice: 0
      };
      onChange({ ...data, customItems: [...data.customItems, newItem] });
  };

  const removeGlobalCustomItem = (id: string) => {
      // Remove item and promote its children to root (or delete them? Let's promote)
      const children = data.customItems.filter(i => i.parentId === id);
      const remainingItems = data.customItems.filter(i => i.id !== id);
      
      // Promote children to root
      const updatedItems = remainingItems.map(i => {
          if (i.parentId === id) return { ...i, parentId: undefined };
          return i;
      });
      
      onChange({ ...data, customItems: updatedItems });
  };

  const updateGlobalCustomItem = (id: string, field: keyof CustomInstallationItem, value: any) => {
      const newItems = data.customItems.map(item => {
          if (item.id === id) {
              const updated = { ...item, [field]: value };
              if (field === 'quantity' && updated.linkedSources && updated.linkedSources.length > 0 && updated.isAutoQuantity) {
                  updated.isAutoQuantity = false;
              }
              return updated;
          }
          return item;
      });
      onChange({ ...data, customItems: newItems });
  };

  // Global Items Linking/Syncing
  const handleUnlinkGlobalItem = (id: string) => {
      const newItems = data.customItems.map(item => 
          item.id === id ? { ...item, linkedSources: [], isAutoQuantity: false, itemUnitPrices: undefined } : item
      );
      onChange({ ...data, customItems: newItems });
  };

  const handleSyncGlobalItem = (id: string) => {
      const item = data.customItems.find(i => i.id === id);
      if (!item || !item.linkedSources || item.linkedSources.length === 0) return;
      const newQty = calculateTotalLinkedQty(item.linkedSources);
      
      const newItems = data.customItems.map(i => 
          i.id === id ? { ...i, quantity: newQty, isAutoQuantity: true } : i
      );
      onChange({ ...data, customItems: newItems });
  };

  const toggleGlobalItemCollapse = (id: string) => {
      const newItems = data.customItems.map(item => 
          item.id === id ? { ...item, isCollapsed: !item.isCollapsed } : item
      );
      onChange({ ...data, customItems: newItems });
  };

  // --- DRAG AND DROP HANDLERS FOR GLOBAL ITEMS ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      e.stopPropagation();
      setDraggedItemId(id);
      e.dataTransfer.effectAllowed = 'move';
      // Create ghost image logic if needed
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedItemId || draggedItemId === id) return;

      const draggedItem = data.customItems.find(i => i.id === draggedItemId);
      const targetItem = data.customItems.find(i => i.id === id);
      
      // Prevent circular nesting
      if (targetItem?.parentId === draggedItemId) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const hoverY = e.clientY - rect.top;
      const height = rect.height;
      
      // Define drop zones: 25% top (move above), 50% middle (group inside), 25% bottom (move below)
      if (hoverY < height * 0.25) {
          setDragPosition('top');
      } else if (hoverY > height * 0.75) {
          setDragPosition('bottom');
      } else {
          // Cannot group into something that is already a child (max 1 level depth for UI simplicity)
          // Actually, let's allow moving 'into' only if target is root.
          if (!targetItem?.parentId) {
              setDragPosition('middle');
          } else {
              // If target is child, middle hover behaves like top/bottom depending on exact split
              setDragPosition(hoverY < height * 0.5 ? 'top' : 'bottom');
          }
      }
      setDragOverItemId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedItemId || draggedItemId === targetId) {
          setDraggedItemId(null);
          setDragOverItemId(null);
          setDragPosition(null);
          return;
      }

      let newItems = [...data.customItems];
      const draggedIndex = newItems.findIndex(i => i.id === draggedItemId);
      const targetIndex = newItems.findIndex(i => i.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;

      const draggedItem = { ...newItems[draggedIndex] };
      const targetItem = newItems[targetIndex];

      if (dragPosition === 'middle') {
          // GROUPING: Make dragged item a child of target
          draggedItem.parentId = targetItem.id;
          newItems.splice(draggedIndex, 1); // Remove from old pos
          // Append to end or find where children of target end?
          // Simplest is to just update property, sorting handles display
          newItems.push(draggedItem);
      } else {
          // REORDERING
          // Remove dragged item first
          newItems.splice(draggedIndex, 1);
          
          // Recalculate target index because removal might shift it
          const adjustedTargetIndex = newItems.findIndex(i => i.id === targetId);
          
          // Update parentId to match target's level
          draggedItem.parentId = targetItem.parentId;

          if (dragPosition === 'top') {
              newItems.splice(adjustedTargetIndex, 0, draggedItem);
          } else {
              newItems.splice(adjustedTargetIndex + 1, 0, draggedItem);
          }
      }

      onChange({ ...data, customItems: newItems });
      setDraggedItemId(null);
      setDragOverItemId(null);
      setDragPosition(null);
  };

  const handleDragEnd = () => {
      setDraggedItemId(null);
      setDragOverItemId(null);
      setDragPosition(null);
  };

  // --- TREE BUILDING ---
  const rootGlobalItems = useMemo(() => {
      const roots = data.customItems.filter(i => !i.parentId);
      // Map children to roots for easy access
      const itemsWithChildren = roots.map(root => {
          const children = data.customItems.filter(i => i.parentId === root.id);
          return { root, children };
      });
      return itemsWithChildren;
  }, [data.customItems]);


  // --- GLOBAL SEARCH ---
  const getGlobalSearchItems = (term: string): SearchResult[] => {
      if (!term) return [];
      const lower = term.toLowerCase();
      const results: SearchResult[] = [];

      suppliers.forEach(s => {
          if(s.isIncluded === false) return;
          
          // Match Group
          if (s.name.toLowerCase().includes(lower) || (s.customTabName && s.customTabName.toLowerCase().includes(lower))) {
              const qty = s.items.reduce((sum, i) => sum + i.quantity, 0);
              results.push({
                  id: s.id,
                  type: 'GROUP',
                  label: `Dostawca: ${s.customTabName || s.name}`,
                  description: `Suma elementów: ${qty}`,
                  qty,
                  supplierId: s.id,
                  isGroup: true
              });
          }

          // Match Items
          s.items.forEach(i => {
              if (i.itemDescription.toLowerCase().includes(lower) || i.componentNumber.toLowerCase().includes(lower)) {
                  results.push({
                      id: i.id,
                      type: 'ITEM',
                      label: `${i.itemDescription}`,
                      description: `${s.customTabName || s.name} | ${i.quantity} szt.`,
                      qty: i.quantity,
                      supplierId: s.id,
                      isGroup: false
                  });
              }
          });
      });

      return results;
  };

  const handleAddItemFromSearch = (result: SearchResult) => {
      const desc = result.type === 'ITEM' ? `Montaż: ${result.label}` : `Montaż elementów: ${result.label.replace('Dostawca: ', '')}`;
      const newItem: CustomInstallationItem = {
          id: Math.random().toString(36).substr(2, 9),
          description: desc,
          quantity: result.qty,
          unitPrice: 0,
          isAutoQuantity: true,
          linkedSources: [{ id: result.id, type: result.type }]
      };
      
      onChange({ ...data, customItems: [...data.customItems, newItem] });
      setSearchTerm('');
      setShowDropdown(false);
  };

  const searchResults = getGlobalSearchItems(searchTerm);

  // Calculation Logic for Header
  let totalProjectCostPLN = data.otherInstallationCosts;
  
  // Stages cost
  stages.forEach(stage => {
      if (!stage.isExcluded) {
        totalProjectCostPLN += calculateStageCost(stage, { ...data, suppliers });
      }
  });

  // Global Custom Items Cost
  data.customItems.forEach(item => {
      if (!item.isExcluded) {
          totalProjectCostPLN += item.quantity * item.unitPrice;
      }
  });

  const installationTotal = convert(totalProjectCostPLN, Currency.PLN, offerCurrency, exchangeRate);

  const getLinkOptions = (): LinkOption[] => {
      const options: LinkOption[] = [];
      suppliers.forEach(s => {
          if(s.isIncluded === false) return;
          const supplierTotalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);
          
          options.push({
              id: s.id,
              type: 'GROUP',
              label: `Dostawca: ${s.customTabName || s.name}`,
              subLabel: `Suma elementów: ${supplierTotalQty}`,
              qty: supplierTotalQty,
              supplierId: s.id
          });

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

  const getGlobalUsage = () => {
      const usedGroups = new Set<string>();
      const usedItems = new Set<string>();

      stages.forEach(s => {
          s.linkedSupplierIds?.forEach(id => usedGroups.add(id));
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

  const filteredLinkOptions = getLinkOptions().filter(opt => {
      if (!linkSearchTerm) return true;
      const lower = linkSearchTerm.toLowerCase();
      return (
          opt.label.toLowerCase().includes(lower) || 
          (opt.subLabel && opt.subLabel.toLowerCase().includes(lower))
      );
  });

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

  const handleStagePick = (e: React.MouseEvent, stage: InstallationStage) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('select')) return;

      if (isPickingMode && onPick) {
          onPick({
              id: stage.id,
              type: 'STAGE',
              label: `[Etap] ${stage.name}`
          }, { x: e.clientX, y: e.clientY });
      }
  };

  const handleGlobalItemPick = (e: React.MouseEvent, item: CustomInstallationItem) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) return;

      // Handle Double Click to Edit Package
      if (e.detail === 2 && item.linkedSources && item.linkedSources.length > 0 && onEditPackage) {
          onEditPackage(item);
          return;
      }

      if (isPickingMode && onPick) {
          onPick({
              id: item.id,
              type: 'CUSTOM_INSTALLATION_ITEM',
              label: `[Dodatek Globalny] ${item.description}`
          }, { x: e.clientX, y: e.clientY });
      }
  };

  const renderGlobalItemRow = (item: CustomInstallationItem, depth: number = 0, isLastChild: boolean = false) => {
      const linkedCount = item.linkedSources?.length || 0;
      const isLinked = linkedCount > 0;
      const isAuto = !!item.isAutoQuantity;
      const hasChildren = data.customItems.some(i => i.parentId === item.id);
      
      const isDragged = draggedItemId === item.id;
      const isDragOver = dragOverItemId === item.id;
      
      const pickingClass = isPickingMode 
        ? "cursor-crosshair hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:ring-1 hover:ring-inset hover:ring-amber-400"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50";

      // Calculate Sum for Parent (Visual only)
      let displayPrice = item.unitPrice;
      let displayQty = item.quantity;
      
      if (hasChildren) {
          const children = data.customItems.filter(i => i.parentId === item.id);
          displayPrice = children.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
          displayQty = 1; // Groups are usually 1 unit of a package
      }

      return (
          <div 
            key={item.id} 
            className={`
                group relative flex gap-2 items-center p-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-colors
                ${item.isExcluded ? 'opacity-50 grayscale' : ''}
                ${isDragged ? 'opacity-30' : ''}
                ${pickingClass}
            `}
            draggable={!isPickingMode}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDrop={(e) => handleDrop(e, item.id)}
            onDragEnd={handleDragEnd}
            onClick={(e) => handleGlobalItemPick(e, item)}
            style={{ paddingLeft: `${(depth * 20) + 8}px` }}
          >
              {/* Drop Indicators */}
              {isDragOver && dragPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-50"></div>}
              {isDragOver && dragPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-50"></div>}
              {isDragOver && dragPosition === 'middle' && <div className="absolute inset-0 border-2 border-blue-500 bg-blue-50/20 z-50 pointer-events-none rounded"></div>}

              {/* Hierarchy Visuals */}
              {depth > 0 && (
                  <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-6 text-zinc-300">
                      <CornerDownRight size={14} className="stroke-[1.5]"/>
                  </div>
              )}

              {/* Drag Handle */}
              {!isPickingMode && (
                  <div className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500">
                      <GripVertical size={14}/>
                  </div>
              )}

              {/* Parent Toggle */}
              {hasChildren ? (
                  <button 
                      onClick={(e) => { e.stopPropagation(); toggleGlobalItemCollapse(item.id); }}
                      className="text-zinc-500 hover:text-zinc-800 p-0.5"
                  >
                      {item.isCollapsed ? <FolderOpen size={14}/> : <ChevronDown size={14}/>}
                  </button>
              ) : (
                  // Spacer for non-parents to align text
                  <div className="w-4"></div>
              )}

              <div className="relative flex-1 group/input">
                  <input 
                      type="text" 
                      className={`w-full p-1.5 border-0 bg-transparent text-xs font-medium outline-none focus:ring-1 focus:ring-amber-300 rounded-sm transition-all ${isLinked ? 'pl-7' : ''} ${hasChildren ? 'font-bold text-zinc-800 dark:text-zinc-100' : ''}`}
                      value={item.description} 
                      onChange={e => updateGlobalCustomItem(item.id, 'description', e.target.value)} 
                      placeholder={hasChildren ? "Nazwa Grupy/Pakietu..." : "Opis pozycji..."}
                  />
                  {isLinked && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center">
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleUnlinkGlobalItem(item.id); }}
                              className="text-cyan-500 hover:text-red-500"
                              title={`Połączono z ${linkedCount} elementami. Kliknij aby odłączyć.`}
                          >
                              <Link size={12} />
                          </button>
                          {onEditPackage && (
                              <button 
                                  onClick={(e) => { e.stopPropagation(); onEditPackage(item); }}
                                  className="ml-1 text-zinc-300 hover:text-purple-500 opacity-0 group-hover/input:opacity-100 transition-opacity"
                                  title="Edytuj szczegóły pakietu"
                              >
                                  <Edit3 size={12} />
                              </button>
                          )}
                      </div>
                  )}
              </div>

              {/* Quantity */}
              <div className="relative w-16">
                  {hasChildren ? (
                      <div className="text-center text-xs text-zinc-400 font-mono py-1.5">
                          {childrenCount(item.id)} poz.
                      </div>
                  ) : (
                      <>
                        <input 
                            type="number" 
                            className={`w-full p-1.5 border-0 rounded-sm text-xs text-center outline-none focus:ring-1 focus:ring-amber-300 ${isAuto ? 'bg-cyan-50 text-cyan-700 font-bold' : 'bg-zinc-50 dark:bg-zinc-800'}`} 
                            value={item.quantity} 
                            onChange={e => updateGlobalCustomItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} 
                        />
                        {isAuto && (
                            <Lock size={8} className="absolute right-1 top-2 text-cyan-300" />
                        )}
                        {!isAuto && isLinked && (
                            <button 
                                onClick={() => handleSyncGlobalItem(item.id)}
                                className="absolute right-1 top-2 text-orange-400 hover:text-cyan-600"
                                title="Przywróć synchronizację ilości"
                            >
                                <RefreshCw size={8} />
                            </button>
                        )}
                      </>
                  )}
              </div>

              {/* Price */}
              {hasChildren ? (
                  <div className="w-20 p-1.5 text-right text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {formatNumber(displayPrice)}
                  </div>
              ) : (
                  <SmartInput 
                      className="w-20 p-1.5 border-0 bg-zinc-50 dark:bg-zinc-800 rounded-sm text-xs text-right outline-none focus:ring-1 focus:ring-amber-300" 
                      value={item.unitPrice} 
                      onChange={val => updateGlobalCustomItem(item.id, 'unitPrice', val)} 
                  />
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 pl-2 border-l border-zinc-100 dark:border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                      onClick={() => updateGlobalCustomItem(item.id, 'isExcluded', !item.isExcluded)} 
                      className={`p-1.5 rounded transition-colors ${item.isExcluded ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-300 hover:text-amber-500'}`}
                      title={item.isExcluded ? "Przywróć" : "Wyklucz"}
                  >
                      {item.isExcluded ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                  <button 
                      onClick={() => removeGlobalCustomItem(item.id)} 
                      className="text-zinc-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      title="Usuń"
                  >
                      <Trash2 size={14}/>
                  </button>
              </div>
          </div>
      );
  };

  const childrenCount = (parentId: string) => data.customItems.filter(i => i.parentId === parentId).length;

  const renderStage = (stage: InstallationStage, index: number) => {
      const stageCost = calculateStageCost(stage, { ...data, suppliers });
      const isExcluded = stage.isExcluded;
      const isCollapsed = collapsedStages.has(stage.id);
      
      let stageMinutes = 0;
      stage.linkedSupplierIds?.forEach(sid => {
           const s = suppliers.find(x => x.id === sid);
           if(s) s.items.forEach(i => !i.isExcluded && (stageMinutes += (i.quantity * (i.timeMinutes || 0))));
      });
      const stageHours = stageMinutes / 60;
      const stageTotalHours = stageHours + (stage.manualLaborHours || 0);
      const stageCapacity = (stage.workDayHours || 10) * (stage.installersCount || 1);
      
      const timeBasedDuration = stageCapacity > 0 ? Math.ceil(stageTotalHours / stageCapacity) : 0;
      const palletBasedDuration = stage.palletSpotsPerDay > 0 ? Math.ceil(stage.palletSpots / stage.palletSpotsPerDay) : 0;

      let stageDuration = 0;
      if (stage.calcMethod === 'TIME') {
          stageDuration = timeBasedDuration;
      } else {
          if (stage.palletSpots > 0 && stage.palletSpotsPerDay > 0) {
              stageDuration = palletBasedDuration;
          } else {
              stageDuration = timeBasedDuration;
          }
      }

      const addCustomItem = () => updateStage(stage.id, { customItems: [...stage.customItems, { id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unitPrice: 0 }] });
      const removeCustomItem = (idx: number) => updateStage(stage.id, { customItems: stage.customItems.filter((_, i) => i !== idx) });
      
      const updateCustomItem = (idx: number, field: keyof CustomInstallationItem, value: any) => {
          const newItems = [...stage.customItems];
          const item = newItems[idx];
          if (field === 'quantity' && item.linkedSources && item.linkedSources.length > 0 && item.isAutoQuantity) {
              item.isAutoQuantity = false; 
          }
          newItems[idx] = { ...item, [field]: value };
          updateStage(stage.id, { customItems: newItems });
      };

      const toggleLinkItem = (idx: number, option: LinkOption) => {
          const newItems = [...stage.customItems];
          const item = newItems[idx];
          let currentSources = item.linkedSources || [];
          const exists = currentSources.some(s => s.id === option.id && s.type === option.type);
          if (exists) {
              currentSources = currentSources.filter(s => !(s.id === option.id && s.type === option.type));
          } else {
              currentSources = [...currentSources, { id: option.id, type: option.type }];
          }
          const newTotalQty = calculateTotalLinkedQty(currentSources);
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
              isAutoQuantity: true, 
              description: desc
          };
          updateStage(stage.id, { customItems: newItems });
      };

      const handleUnlinkAll = (idx: number) => {
          const newItems = [...stage.customItems];
          newItems[idx] = { ...newItems[idx], linkedSources: [], isAutoQuantity: false };
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

      const handleForkliftOffsetChange = (newOffset: number) => {
          const newDays = Math.max(0, stageDuration - newOffset);
          updateStage(stage.id, { forkliftStartOffset: newOffset, forkliftDays: newDays });
      };

      const handleScissorOffsetChange = (newOffset: number) => {
          const newDays = Math.max(0, stageDuration - newOffset);
          updateStage(stage.id, { scissorLiftStartOffset: newOffset, scissorLiftDays: newDays });
      };

      // Equipment Visibility State (Legacy Support + Explicit Toggle)
      const hasForklift = stage.hasForklift ?? (stage.forkliftDays > 0 || stage.forkliftDailyRate > 0);
      const hasScissorLift = stage.hasScissorLift ?? (stage.scissorLiftDays > 0 || stage.scissorLiftDailyRate > 0);

      return (
          <div 
            key={stage.id} 
            className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm mb-4 relative shadow-sm transition-all overflow-hidden
                ${isExcluded ? 'opacity-50 grayscale' : ''}
                ${isPickingMode ? 'hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-crosshair hover:animate-pulse-border' : ''}
            `}
            onClick={(e) => handleStagePick(e, stage)}
          >
               {isExcluded && <div className="absolute top-0 right-0 left-0 bg-red-500 text-white text-[10px] font-bold text-center py-0.5 z-10">ETAP WYKLUCZONY Z WARIANTU</div>}
               
               <div className="flex justify-between items-center p-4 bg-zinc-50/50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                   <div className="flex items-center gap-3 w-full max-w-md">
                       <button 
                           onClick={(e) => { e.stopPropagation(); toggleStageCollapse(stage.id); }} 
                           className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded-sm transition-colors text-zinc-500 dark:text-zinc-300"
                       >
                           {isCollapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                       </button>
                       <span className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 font-bold px-2 py-0.5 text-[10px]">#{index + 1}</span>
                       <div className="relative group flex-1">
                            <input 
                                    type="text" 
                                    className="font-bold text-base text-zinc-800 dark:text-zinc-100 bg-transparent outline-none border-0 focus:ring-0 px-0 transition-all w-full"
                                    value={stage.name}
                                    onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                                    placeholder="Nazwa Etapu (np. Antresola)"
                                    onClick={(e) => e.stopPropagation()}
                            />
                            <Edit2 size={12} className="absolute -right-4 top-1/2 -translate-y-1/2 text-zinc-400 opacity-0 group-hover/opacity-100 transition-opacity pointer-events-none"/>
                       </div>
                   </div>
                   <div className="flex items-center gap-4">
                       <div className="text-right">
                           <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Koszt Etapu</span>
                           <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-sm">{formatNumber(stageCost)} PLN</div>
                       </div>
                       <button onClick={(e) => { e.stopPropagation(); removeStage(stage.id); }} className="text-zinc-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                   </div>
               </div>

               <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
                   <div className="overflow-hidden">
                        <div className="p-4">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3 border border-zinc-100 dark:border-zinc-800">
                                    <div className="text-[10px] font-bold text-zinc-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                                        <Combine size={12}/> Powiązani Dostawcy (ORM)
                                    </div>
                                    <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {suppliers.length === 0 && <div className="text-xs text-zinc-400 italic p-2">Brak dostawców.</div>}
                                        {suppliers.map(s => {
                                            const isLinked = stage.linkedSupplierIds?.includes(s.id);
                                            const linkedElsewhere = !isLinked && stages.some(os => os.linkedSupplierIds?.includes(s.id));
                                            
                                            return (
                                                <button 
                                                        key={s.id}
                                                        onClick={() => toggleSupplierInStage(stage.id, s.id)}
                                                        className={`w-full text-left px-2 py-1.5 text-[11px] flex justify-between items-center transition-all ${
                                                            isLinked 
                                                            ? 'bg-white border border-cyan-200 text-cyan-800 font-bold shadow-sm' 
                                                            : linkedElsewhere 
                                                                ? 'bg-transparent text-zinc-400 border border-transparent opacity-60' 
                                                                : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    <span className="truncate">{s.customTabName || s.name}</span>
                                                    {isLinked && <CheckLink size={12} className="text-cyan-500"/>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm">
                                        <button onClick={() => updateStage(stage.id, { calcMethod: 'PALLETS' })} className={`flex-1 py-1.5 text-[10px] font-bold transition-all rounded-sm ${stage.calcMethod === 'PALLETS' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>Miejsca Paletowe</button>
                                        <button onClick={() => updateStage(stage.id, { calcMethod: 'TIME' })} className={`flex-1 py-1.5 text-[10px] font-bold transition-all rounded-sm ${stage.calcMethod === 'TIME' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>Roboczogodziny</button>
                                        <button onClick={() => updateStage(stage.id, { calcMethod: 'BOTH' })} className={`flex-1 py-1.5 text-[10px] font-bold transition-all rounded-sm ${stage.calcMethod === 'BOTH' ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>Łączona</button>
                                    </div>

                                    {(stage.calcMethod === 'PALLETS' || stage.calcMethod === 'BOTH') && (
                                        <div className="grid grid-cols-3 gap-3 animate-fadeIn bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 p-3">
                                            {stage.calcMethod === 'BOTH' && <div className="col-span-3 text-[10px] font-bold text-amber-600 uppercase border-b border-amber-100 pb-1 mb-1">Część 1: Miejsca Paletowe</div>}
                                            <div><label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Ilość Miejsc</label><input type="number" className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400" value={stage.palletSpots} onChange={(e) => updateStage(stage.id, { palletSpots: parseFloat(e.target.value) || 0 })} /></div>
                                            <div><label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Wydajność (szt/dzień)</label><input type="number" className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400" value={stage.palletSpotsPerDay} onChange={(e) => updateStage(stage.id, { palletSpotsPerDay: parseFloat(e.target.value) || 0 })} /></div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Cena / Miejsce</label>
                                                <SmartInput className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400" value={stage.palletSpotPrice} onChange={(val) => updateStage(stage.id, { palletSpotPrice: val })} />
                                            </div>
                                        </div>
                                    )}

                                    {(stage.calcMethod === 'TIME' || stage.calcMethod === 'BOTH') && (
                                        <div className="grid grid-cols-4 gap-3 animate-fadeIn bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 p-3">
                                            {stage.calcMethod === 'BOTH' && <div className="col-span-4 text-[10px] font-bold text-cyan-600 uppercase border-b border-cyan-100 pb-1 mb-1">Część 2: Roboczogodziny</div>}
                                            <div className="col-span-4 bg-cyan-50 dark:bg-cyan-900/20 p-2 flex justify-between items-center text-xs text-cyan-800 dark:text-cyan-300 border border-cyan-100 dark:border-cyan-800/50">
                                                <span>ORM: <strong>{stageHours.toFixed(1)}h</strong></span>
                                                <span className="flex items-center">+ Manual: <input type="number" className="w-12 p-0.5 text-center border-0 bg-white dark:bg-zinc-950 ml-1 focus:ring-1 focus:ring-cyan-300 outline-none text-xs" value={stage.manualLaborHours} onChange={(e) => updateStage(stage.id, { manualLaborHours: parseFloat(e.target.value) || 0 })} /> h</span>
                                                <span>= <strong>{stageTotalHours.toFixed(1)}h</strong></span>
                                            </div>
                                            <div><label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Osoby</label><input type="number" className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-cyan-400" value={stage.installersCount} onChange={(e) => updateStage(stage.id, { installersCount: parseFloat(e.target.value) || 0 })} /></div>
                                            <div><label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">h/Dzień</label><input type="number" className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-cyan-400" value={stage.workDayHours} onChange={(e) => updateStage(stage.id, { workDayHours: parseFloat(e.target.value) || 0 })} /></div>
                                            <div className="col-span-2">
                                                <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Stawka (osobodzień)</label>
                                                <SmartInput className="w-full p-2 border-0 rounded-none text-xs bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-cyan-400" value={stage.manDayRate} onChange={(val) => updateStage(stage.id, { manDayRate: val })} />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="text-right text-[10px] text-zinc-500">Estymowany czas: <strong className="text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-1">{stageDuration} dni</strong></div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Truck size={12}/> Sprzęt dla etapu</h4>
                                        <div className="flex gap-2">
                                            {!hasForklift && (
                                                <button onClick={() => updateStage(stage.id, { hasForklift: true, forkliftDays: 1 })} className="text-[10px] bg-white border border-zinc-200 hover:border-amber-400 hover:text-amber-600 px-2 py-1 rounded flex items-center gap-1 transition-all">
                                                    <Plus size={10}/> Dodaj Wózek
                                                </button>
                                            )}
                                            {!hasScissorLift && (
                                                <button onClick={() => updateStage(stage.id, { hasScissorLift: true, scissorLiftDays: 1 })} className="text-[10px] bg-white border border-zinc-200 hover:border-amber-400 hover:text-amber-600 px-2 py-1 rounded flex items-center gap-1 transition-all">
                                                    <Plus size={10}/> Dodaj Podnośnik
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {hasForklift && (
                                            <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3 border border-zinc-100 dark:border-zinc-800 relative group animate-fadeIn">
                                                <button 
                                                    onClick={() => updateStage(stage.id, { hasForklift: false, forkliftDays: 0, forkliftDailyRate: 0, forkliftTransportPrice: 0 })} 
                                                    className="absolute top-2 right-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Usuń Wózek"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                                <div className="flex justify-between mb-2"><span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Wózek Widłowy</span></div>
                                                <div className="grid grid-cols-4 gap-2 text-[9px] text-zinc-400 font-bold uppercase mb-0.5">
                                                    <div>Stawka dzienna</div>
                                                    <div>Ilość Dni</div>
                                                    <div>Start (+dni)</div>
                                                    <div>Koszt Transportu</div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <SmartInput placeholder="0.00" className="p-1.5 border-0 text-xs bg-white dark:bg-zinc-800" value={stage.forkliftDailyRate} onChange={val => updateStage(stage.id, { forkliftDailyRate: val })} />
                                                    <div className="relative">
                                                        <input type="number" placeholder="0" className={`p-1.5 border-0 text-xs w-full bg-white dark:bg-zinc-800 ${stage.forkliftDays !== Math.max(0, stageDuration - (stage.forkliftStartOffset || 0)) ? 'ring-1 ring-orange-300' : ''}`} value={stage.forkliftDays} onChange={e => updateStage(stage.id, { forkliftDays: parseFloat(e.target.value) || 0 })} />
                                                        {stage.forkliftDays !== stageDuration && stageDuration > 0 && (
                                                            <button onClick={() => updateStage(stage.id, { forkliftDays: stageDuration })} className="absolute right-1 top-1 text-blue-500 hover:text-blue-700 p-0.5" title="Sync"><RefreshCw size={10}/></button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Calendar size={10} className="absolute left-1.5 top-2 text-zinc-400 pointer-events-none"/>
                                                        <input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            className="p-1.5 pl-5 border-0 text-xs w-full bg-white dark:bg-zinc-800 text-zinc-500" 
                                                            value={stage.forkliftStartOffset || 0} 
                                                            onChange={e => handleForkliftOffsetChange(parseFloat(e.target.value) || 0)} 
                                                            title="Opóźnienie względem startu etapu (dni)"
                                                        />
                                                    </div>
                                                    <SmartInput placeholder="0.00" className="p-1.5 border-0 text-xs bg-white dark:bg-zinc-800" value={stage.forkliftTransportPrice} onChange={val => updateStage(stage.id, { forkliftTransportPrice: val })} />
                                                </div>
                                            </div>
                                        )}

                                        {hasScissorLift && (
                                            <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3 border border-zinc-100 dark:border-zinc-800 relative group animate-fadeIn">
                                                <button 
                                                    onClick={() => updateStage(stage.id, { hasScissorLift: false, scissorLiftDays: 0, scissorLiftDailyRate: 0, scissorLiftTransportPrice: 0 })} 
                                                    className="absolute top-2 right-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Usuń Podnośnik"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                                <div className="flex justify-between mb-2"><span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Podnośnik</span></div>
                                                <div className="grid grid-cols-4 gap-2 text-[9px] text-zinc-400 font-bold uppercase mb-0.5">
                                                    <div>Stawka dzienna</div>
                                                    <div>Ilość Dni</div>
                                                    <div>Start (+dni)</div>
                                                    <div>Koszt Transportu</div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <SmartInput placeholder="0.00" className="p-1.5 border-0 text-xs bg-white dark:bg-zinc-800" value={stage.scissorLiftDailyRate} onChange={val => updateStage(stage.id, { scissorLiftDailyRate: val })} />
                                                    <div className="relative">
                                                        <input type="number" placeholder="0" className={`p-1.5 border-0 text-xs w-full bg-white dark:bg-zinc-800 ${stage.scissorLiftDays !== Math.max(0, stageDuration - (stage.scissorLiftStartOffset || 0)) ? 'ring-1 ring-orange-300' : ''}`} value={stage.scissorLiftDays} onChange={e => updateStage(stage.id, { scissorLiftDays: parseFloat(e.target.value) || 0 })} />
                                                        {stage.scissorLiftDays !== stageDuration && stageDuration > 0 && (
                                                            <button onClick={() => updateStage(stage.id, { scissorLiftDays: stageDuration })} className="absolute right-1 top-1 text-blue-500 hover:text-blue-700 p-0.5" title="Sync"><RefreshCw size={10}/></button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <Calendar size={10} className="absolute left-1.5 top-2 text-zinc-400 pointer-events-none"/>
                                                        <input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            className="p-1.5 pl-5 border-0 text-xs w-full bg-white dark:bg-zinc-800 text-zinc-500" 
                                                            value={stage.scissorLiftStartOffset || 0} 
                                                            onChange={e => handleScissorOffsetChange(parseFloat(e.target.value) || 0)} 
                                                            title="Opóźnienie względem startu etapu (dni)"
                                                        />
                                                    </div>
                                                    <SmartInput placeholder="0.00" className="p-1.5 border-0 text-xs bg-white dark:bg-zinc-800" value={stage.scissorLiftTransportPrice} onChange={val => updateStage(stage.id, { scissorLiftTransportPrice: val })} />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {!hasForklift && !hasScissorLift && (
                                            <div className="col-span-1 md:col-span-2 p-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-sm text-xs text-zinc-400 italic">
                                                Brak sprzętu w tym etapie. Dodaj wózek lub podnośnik przyciskiem powyżej.
                                            </div>
                                        )}
                                    </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Settings size={12}/> Dodatki (W Etapie)</h4>
                                        <button onClick={addCustomItem} className="text-[10px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-2 py-1 flex items-center gap-1 transition-colors font-bold"><Plus size={10}/> Dodaj</button>
                                    </div>
                                    
                                    {stage.customItems.map((item, idx) => {
                                        const linkedCount = item.linkedSources?.length || 0;
                                        const isLinked = linkedCount > 0;
                                        const isAuto = !!item.isAutoQuantity;
                                        
                                        return (
                                        <div key={item.id} className={`flex gap-2 items-center mb-1.5 relative ${item.isExcluded ? 'opacity-50' : ''}`}>
                                            <div className="relative flex-1">
                                                <input 
                                                    type="text" 
                                                    className={`w-full p-1.5 border-0 rounded-none text-xs bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-cyan-300 transition-all ${isLinked ? 'pl-7' : ''}`}
                                                    value={item.description} 
                                                    onChange={e => updateCustomItem(idx, 'description', e.target.value)} 
                                                    placeholder="Opis..." 
                                                />
                                                {isLinked && (
                                                    <button 
                                                        onClick={() => handleUnlinkAll(idx)}
                                                        className="absolute left-1.5 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-red-500"
                                                        title={`Połączono z ${linkedCount} elementami. Kliknij aby odłączyć.`}
                                                    >
                                                        <Link size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <div className="relative w-16">
                                                <input 
                                                    type="number" 
                                                    className={`w-full p-1.5 border-0 rounded-none text-xs text-center outline-none ${isAuto ? 'bg-cyan-50 text-cyan-700 font-bold' : 'bg-zinc-50 dark:bg-zinc-800'}`} 
                                                    value={item.quantity} 
                                                    onChange={e => updateCustomItem(idx, 'quantity', parseFloat(e.target.value) || 0)} 
                                                />
                                                {isAuto && (
                                                    <Lock size={8} className="absolute right-1 top-2 text-cyan-300" />
                                                )}
                                                {!isAuto && isLinked && (
                                                    <button 
                                                        onClick={() => handleSyncItem(idx)}
                                                        className="absolute right-1 top-2 text-orange-400 hover:text-cyan-600"
                                                        title="Przywróć synchronizację ilości (Suma zaznaczonych)"
                                                    >
                                                        <RefreshCw size={8} />
                                                    </button>
                                                )}
                                            </div>

                                            <SmartInput className="w-16 p-1.5 border-0 rounded-none text-xs text-right bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-cyan-300" value={item.unitPrice} onChange={val => updateCustomItem(idx, 'unitPrice', val)} />
                                            
                                            <div className="relative">
                                                <button 
                                                    onClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setDropdownPos({ top: rect.bottom + 5, left: Math.max(10, rect.right - 320) });
                                                        setLinkMenuOpen({ stageId: stage.id, itemIdx: idx });
                                                    }}
                                                    className={`p-1.5 text-zinc-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors ${linkMenuOpen?.stageId === stage.id && linkMenuOpen.itemIdx === idx ? 'bg-cyan-100 text-cyan-600' : ''}`}
                                                    title="Wybierz elementy/grupy do zsumowania"
                                                >
                                                    <Link size={14}/>
                                                </button>
                                                
                                                {linkMenuOpen?.stageId === stage.id && linkMenuOpen.itemIdx === idx && dropdownPos && (
                                                    <div 
                                                        ref={linkMenuRef} 
                                                        className="fixed bg-white dark:bg-zinc-800 border dark:border-zinc-600 shadow-xl rounded-none z-[9999] w-72 max-h-80 overflow-y-auto flex flex-col"
                                                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                                                        onClick={(e) => e.stopPropagation()} 
                                                    >
                                                        <div className="p-2 border-b dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
                                                            <div className="relative">
                                                                <Search size={10} className="absolute left-2 top-2 text-zinc-400"/>
                                                                <input 
                                                                    type="text" 
                                                                    autoFocus
                                                                    className="w-full pl-6 p-1 text-xs border-0 rounded-none bg-zinc-100 dark:bg-zinc-900 focus:ring-1 focus:ring-cyan-400 outline-none"
                                                                    placeholder="Szukaj..."
                                                                    value={linkSearchTerm}
                                                                    onChange={(e) => setLinkSearchTerm(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="overflow-y-auto">
                                                            {filteredLinkOptions.map(opt => {
                                                                const isSelectedInCurrent = item.linkedSources?.some(s => s.id === opt.id && s.type === opt.type);
                                                                
                                                                // Logic allowing reuse of items (multiple variants support)
                                                                let isUsedElsewhere = false;
                                                                
                                                                if (opt.type === 'GROUP') {
                                                                    if (usedGroups.has(opt.id) && !isSelectedInCurrent) {
                                                                        isUsedElsewhere = true;
                                                                    } else {
                                                                        const supplier = suppliers.find(s => s.id === opt.id);
                                                                        if (supplier && supplier.items.some(i => usedItems.has(i.id))) {
                                                                            isUsedElsewhere = true;
                                                                        }
                                                                    }
                                                                } else {
                                                                    if (usedItems.has(opt.id) && !isSelectedInCurrent) {
                                                                        isUsedElsewhere = true;
                                                                    } else if (usedGroups.has(opt.supplierId)) {
                                                                        isUsedElsewhere = true;
                                                                    }
                                                                }

                                                                return (
                                                                    <button
                                                                        key={`${opt.type}-${opt.id}`}
                                                                        className={`w-full text-left p-2 border-b last:border-0 text-xs flex justify-between items-center group transition-colors relative
                                                                            ${isSelectedInCurrent ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}
                                                                            hover:bg-zinc-50 dark:hover:bg-zinc-700
                                                                        `}
                                                                        onClick={() => toggleLinkItem(idx, opt)}
                                                                        title={isUsedElsewhere ? "Ten element jest użyty w innym etapie, ale możesz go wybrać ponownie dla wariantu." : ""}
                                                                    >
                                                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                            <div className={`w-3 h-3 border flex items-center justify-center shrink-0 ${isSelectedInCurrent ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-300'}`}>
                                                                                {isSelectedInCurrent && <CheckSquare size={8} className="text-white"/>}
                                                                            </div>
                                                                            <div className="truncate flex-1">
                                                                                <div className="truncate font-medium text-zinc-700 dark:text-zinc-200">{opt.label}</div>
                                                                                {opt.subLabel && <div className="truncate text-[9px] text-zinc-400">{opt.subLabel}</div>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {isUsedElsewhere && !isSelectedInCurrent && (
                                                                                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0">
                                                                                    <Copy size={8}/> Użyte
                                                                                </div>
                                                                            )}
                                                                            <div className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 font-mono text-[9px] shrink-0 ml-2 group-hover:bg-cyan-100 group-hover:text-cyan-700">
                                                                                {opt.qty}
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                            {filteredLinkOptions.length === 0 && (
                                                                <div className="p-3 text-center text-xs text-zinc-400 italic">Brak wyników.</div>
                                                            )}
                                                        </div>
                                                        <div className="p-2 border-t dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-right">
                                                            <button 
                                                                onClick={() => setLinkMenuOpen(null)}
                                                                className="text-[10px] bg-cyan-600 text-white px-3 py-1 font-bold hover:bg-cyan-700 shadow-sm"
                                                            >
                                                                Gotowe
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <button onClick={() => updateCustomItem(idx, 'isExcluded', !item.isExcluded)} className="text-zinc-400 hover:text-zinc-600">{item.isExcluded ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                                            <button onClick={() => removeCustomItem(idx)} className="text-zinc-300 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                        );
                                    })}
                            </div>
                        </div>
                   </div>
               </div>
          </div>
      );
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-6 transition-colors relative z-10">
      <div 
          className="p-4 bg-white dark:bg-zinc-900 flex justify-between items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-sm text-amber-600 dark:text-amber-500">
                <Wrench size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-mono uppercase tracking-tight">Montaż (Etapy)</h2>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    Prace instalacyjne i sprzęt
                    <span className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-sm">{stages.length} etapów</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none mb-1">Suma</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-lg">
                    {formatCurrency(installationTotal, offerCurrency)}
                </span>
             </div>
             <button className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20}/>
            </button>
        </div>
      </div>
      
      <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
            <div className="p-4 pt-0 border-t border-transparent">
                
                {stages.length === 0 && (
                    <div className="py-8">
                        <EmptyState 
                            icon={Wrench}
                            title="Brak Etapów Montażu"
                            description="Projekt nie zawiera jeszcze kosztów montażu. Dodaj pierwszy etap, aby rozpocząć kalkulację prac i sprzętu."
                            action={{
                                label: "Dodaj Pierwszy Etap",
                                onClick: addStage,
                                icon: Plus
                            }}
                        />
                    </div>
                )}

                {stages.map((stage, idx) => renderStage(stage, idx))}
                
                {stages.length > 0 && (
                    <div className="mt-2 flex justify-center">
                        <button 
                            onClick={addStage}
                            className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 px-4 py-2 text-xs font-bold transition-all"
                        >
                            <Plus size={14}/> Dodaj Kolejny Etap
                        </button>
                    </div>
                )}

                {/* NEW SECTION: GLOBAL CUSTOM ITEMS */}
                <div className="mt-6 pt-4 border-t-2 border-zinc-200 dark:border-zinc-700">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-200 dark:border-zinc-700 rounded-sm mb-4">
                        <div className="flex justify-between items-center mb-3 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                            <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase flex items-center gap-2">
                                <ListPlus size={14} className="text-amber-500"/> Dodatkowe Pozycje Montażowe (Globalne)
                            </h4>
                        </div>

                        {/* Search and Picking Toolbar */}
                        <div className="flex gap-2 items-center relative mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-zinc-400" size={14}/>
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-none text-xs outline-none focus:border-amber-400 dark:bg-zinc-900 dark:text-white transition-all font-mono bg-white" 
                                    placeholder="Szukaj elementów do montażu..." 
                                    value={searchTerm} 
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                />
                            </div>
                            {onEnterPickingMode && (
                                <button 
                                    onClick={() => onEnterPickingMode('GLOBAL_INSTALLATION')}
                                    className="bg-amber-400 hover:bg-amber-500 text-black px-3 py-2 rounded-none transition-colors shadow-sm flex items-center gap-2 font-bold text-[10px] uppercase whitespace-nowrap"
                                    title="Wybierz elementy myszką z innych sekcji"
                                >
                                    <MousePointer2 size={14} /> Tryb Wybierania
                                </button>
                            )}
                        </div>

                        {/* Search Dropdown */}
                        {showDropdown && searchTerm && searchDropdownPosition && (
                            <div 
                                ref={dropdownRef}
                                className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-sm max-h-80 overflow-y-auto z-[9999] flex flex-col"
                                style={{
                                    top: searchDropdownPosition.top,
                                    left: searchDropdownPosition.left,
                                    width: searchDropdownPosition.width
                                }}
                            >
                                {searchResults.length === 0 ? (
                                    <div className="p-4 text-xs text-zinc-400 text-center">Brak wyników.</div>
                                ) : (
                                    searchResults.map((res, i) => (
                                        <button 
                                            key={`${res.id}-${i}`} 
                                            onClick={() => handleAddItemFromSearch(res)} 
                                            className="w-full text-left p-2 text-xs border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex justify-between items-center"
                                        >
                                            <div>
                                                <div className="font-bold text-zinc-700 dark:text-zinc-200">
                                                    {res.label}
                                                </div>
                                                {res.description && <div className="text-[9px] text-zinc-500 mt-0.5">{res.description}</div>}
                                            </div>
                                            <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{res.qty} szt.</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        <div className="space-y-0 mb-3 border border-zinc-100 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 overflow-hidden">
                            {data.customItems.length === 0 && (
                                <div className="text-xs text-zinc-400 italic text-center py-6 bg-zinc-50 dark:bg-zinc-900/50">
                                    <Archive size={24} className="mx-auto mb-2 opacity-20"/>
                                    Brak globalnych pozycji montażowych. Dodaj przez wyszukiwanie lub ręcznie.
                                </div>
                            )}

                            {/* Render Tree Structure */}
                            {rootGlobalItems.map(({root, children}, idx) => (
                                <React.Fragment key={root.id}>
                                    {renderGlobalItemRow(root, 0)}
                                    {!root.isCollapsed && children.map(child => renderGlobalItemRow(child, 1, false))}
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button 
                                onClick={addGlobalCustomItem} 
                                className="text-[10px] bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-1 rounded-sm flex items-center gap-1 transition-colors font-bold shadow-sm"
                            >
                                <Plus size={10}/> Dodaj pusty wiersz
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-3 border border-zinc-100 dark:border-zinc-800">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-500 mb-0.5 uppercase">Globalne Koszty Dodatkowe (Ryczałt Projektowy)</label>
                            <p className="text-[9px] text-zinc-400">Koszty nieprzypisane do konkretnego etapu (np. dojazd koordynatora).</p>
                        </div>
                        <SmartInput 
                            className="w-24 p-2 border-0 bg-white dark:bg-zinc-800 text-right font-bold focus:ring-1 focus:ring-amber-400 outline-none text-sm" 
                            value={data.otherInstallationCosts} 
                            onChange={(val) => onChange({...data, otherInstallationCosts: val})} 
                            placeholder="0.00" 
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const CheckLink = ({size, className}: {size: number, className?: string}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>;
