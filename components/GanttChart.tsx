
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Supplier, InstallationData, ProjectMeta, SupplierStatus, CustomTimelineItem, ProjectTask, InstallationStage, Dependency, TransportItem } from '../types';
import { Calendar, ZoomIn, ZoomOut, GripHorizontal, GripVertical, MousePointer2, Truck, Plus, Trash2, PenLine, Layers, ClipboardList, X, CheckSquare, Square, Flag, Wrench, ArrowUp, ArrowDown, RefreshCcw, Link2, Link, Car, Maximize2, Minimize2, ChevronRight, ChevronDown, Combine, ChevronLeft, LayoutGrid, Save, Clock, PanelLeft } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface Props {
  suppliers: Supplier[];
  installation: InstallationData;
  meta: ProjectMeta;
  transport?: TransportItem[];
  onUpdateInstallation: (updates: Partial<InstallationData>) => void;
  onUpdateSupplier: (supplierId: string, updates: Partial<Supplier>) => void;
  tasks?: ProjectTask[];
  onUpdateTasks?: (tasks: ProjectTask[]) => void;
}

// --- CONSTANTS ---
const HEADER_HEIGHT = 60; 
const ROW_HEIGHT = 60; // Reduced height
const CHROME_HEIGHT = 66; 
const DEFAULT_VISIBLE_ROWS = 4;

// --- DATE UTILS ---
const isValidDate = (d: any): boolean => d instanceof Date && !isNaN(d.getTime());

const addBusinessDays = (date: Date, days: number): Date => {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) {
            added++;
        }
    }
    return result;
};

const countBusinessDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    let curDate = new Date(startDate);
    while (curDate < endDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

const diffDays = (d1: Date, d2: Date) => Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const GanttChart: React.FC<Props> = ({ suppliers, installation, meta, transport = [], onUpdateInstallation, onUpdateSupplier, tasks = [], onUpdateTasks }) => {
  const [viewMode, setViewMode] = useState<'GANTT' | 'CALENDAR'>('GANTT');
  const [zoom, setZoom] = useState(1); // 1 = 40px per day
  const [isCompact, setIsCompact] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Drag State
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'DELIVERY' | 'STAGE_MOVE' | 'STAGE_RESIZE' | 'CUSTOM_MOVE' | 'CUSTOM_RESIZE' | 'RENTAL_MOVE' | null>(null);
  const [dragSubType, setDragSubType] = useState<string | null>(null); // To distinguish rental types
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [dragOriginalDate, setDragOriginalDate] = useState<Date | null>(null);
  const [dragOriginalEndDate, setDragOriginalEndDate] = useState<Date | null>(null); 

  // Connection State
  const [isConnecting, setIsConnecting] = useState<string | null>(null); // ID of source item
  const [connectMousePos, setConnectMousePos] = useState<{x: number, y: number} | null>(null);

  // Task Popover State
  const [activeTaskModal, setActiveTaskModal] = useState<{ id: string, type: string, top: number } | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  // Row Ordering State
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  
  // Group Expansion State
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Edit Item Popover State (Calendar)
  const [editPopover, setEditPopover] = useState<{ id: string, type: string, x: number, y: number, name: string } | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const toggleGroup = (groupId: string) => {
      const newSet = new Set(expandedGroups);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      setExpandedGroups(newSet);
  };

  // --- 1. PREPARE DATA ---
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const orderDate = meta.orderDate ? new Date(meta.orderDate) : new Date();
  if (isValidDate(orderDate)) orderDate.setHours(0,0,0,0);
  
  const protocolDate = meta.protocolDate ? new Date(meta.protocolDate) : null;
  if (isValidDate(protocolDate)) protocolDate?.setHours(0,0,0,0);

  // Generate Base Items (Grouped Logic)
  const generatedItems = useMemo(() => {
      const processedSupplierIds = new Set<string>();
      const items: any[] = [];

      // HELPER: Create Supplier Data Object
      const createSupplierData = (s: Supplier, isChild: boolean = false, parentId: string | null = null) => {
          let prodStart = new Date(orderDate);
          let prodEnd = new Date(prodStart);
          prodEnd.setDate(prodEnd.getDate() + 28); // Default 4 weeks
          
          let delStart: Date;
          let delEnd: Date;

          if (s.deliveryDate && s.deliveryDate !== 'ASAP') {
              const manualDate = new Date(s.deliveryDate);
              manualDate.setHours(0,0,0,0);
              if (isValidDate(manualDate)) {
                  delStart = manualDate;
                  delEnd = addBusinessDays(manualDate, 1);
              } else {
                  delStart = new Date(prodEnd);
                  delEnd = addBusinessDays(delStart, 1);
              }
          } else {
              delStart = new Date(prodEnd);
              delEnd = addBusinessDays(delStart, 1);
          }

          return {
              id: s.id,
              type: 'SUPPLIER',
              name: s.customTabName || s.name,
              isJH: !s.deliveryDate && !s.isOrm,
              status: s.status,
              start: prodStart,
              end: delEnd,
              prodStart,
              prodEnd,
              delStart,
              delEnd,
              isDateEstimated: s.deliveryDate === 'ASAP' || !s.deliveryDate,
              isChild,
              parentId
          };
      };

      // 1. MERGED GROUPS (From Transport)
      transport.forEach(t => {
          if (t.linkedSupplierIds && t.linkedSupplierIds.length > 1) {
              const linkedSuppliers = suppliers.filter(s => t.linkedSupplierIds?.includes(s.id));
              
              if (linkedSuppliers.length > 0) {
                  // Mark as processed
                  linkedSuppliers.forEach(s => processedSupplierIds.add(s.id));

                  // Create Group Item
                  const childrenItems = linkedSuppliers.map(s => createSupplierData(s, true, t.id));
                  
                  // Aggregate dates for Group
                  let minStart = childrenItems[0].start;
                  let maxDelEnd = childrenItems[0].delEnd;
                  let sharedDelStart = childrenItems[0].delStart; // Use first one, they should be synced
                  
                  childrenItems.forEach(c => {
                      if (c.start < minStart) minStart = c.start;
                      if (c.delEnd > maxDelEnd) maxDelEnd = c.delEnd;
                  });

                  items.push({
                      id: t.id,
                      type: 'TRANSPORT_GROUP',
                      name: t.name || 'Transport Zbiorczy',
                      start: minStart,
                      end: maxDelEnd,
                      delStart: sharedDelStart,
                      delEnd: addBusinessDays(sharedDelStart, 1),
                      prodStart: minStart,
                      prodEnd: sharedDelStart, // Visual approximation
                      isDateEstimated: childrenItems.some(c => c.isDateEstimated),
                      childIds: childrenItems.map(c => c.id)
                  });

                  // Add Children if Expanded (Gantt Only)
                  // For calendar we might want to just show the group or all, logic handles list flat
                  if (expandedGroups.has(t.id)) {
                      childrenItems.forEach(c => items.push(c));
                  }
              }
          }
      });

      // 2. REMAINING SUPPLIERS
      suppliers.forEach(s => {
          if (!processedSupplierIds.has(s.id)) {
              items.push(createSupplierData(s));
          }
      });

      // 3. INSTALLATION STAGES (Waterfall Logic)
      // Find the latest delivery date to act as anchor for first stage if no date set
      let maxDeliveryDate = orderDate;
      items.forEach(i => { if (i.delEnd > maxDeliveryDate) maxDeliveryDate = i.delEnd; });
      let nextStageStart = addBusinessDays(maxDeliveryDate, 1);

      installation.stages.forEach((stage, idx) => {
          if (stage.isExcluded) return;

          // Calculate Duration
          let durationDays = 1;
          if (stage.calcMethod === 'TIME' || stage.calcMethod === 'BOTH') {
              let totalMinutes = 0;
              if (stage.linkedSupplierIds) {
                  stage.linkedSupplierIds.forEach(sid => {
                      const sup = suppliers.find(s => s.id === sid);
                      if (sup) sup.items.forEach(i => !i.isExcluded && (totalMinutes += (i.quantity * (i.timeMinutes || 0))));
                  });
              }
              const totalHours = (totalMinutes / 60) + (stage.manualLaborHours || 0);
              const cap = (stage.workDayHours || 10) * (stage.installersCount || 1);
              durationDays = cap > 0 ? Math.ceil(totalHours / cap) : 1;
          } else {
              // Pallets
              const speed = stage.palletSpotsPerDay || 1;
              durationDays = Math.ceil(stage.palletSpots / speed);
          }
          if (durationDays < 1) durationDays = 1;

          let start: Date;
          let end: Date;

          if (stage.startDate) {
              start = new Date(stage.startDate);
              start.setHours(0,0,0,0);
          } else {
              start = new Date(nextStageStart);
          }

          if (stage.endDate) {
              end = new Date(stage.endDate);
              end.setHours(0,0,0,0);
          } else {
              end = addBusinessDays(start, durationDays);
          }

          // Advance cursor for next stage
          nextStageStart = addBusinessDays(end, 0); 

          // Prepare Rentals Data attached to Stage
          const rentals = [];
          if (stage.forkliftDays > 0) {
              const fOffset = stage.forkliftStartOffset || 0;
              const fStart = addBusinessDays(start, fOffset);
              const fEnd = addBusinessDays(fStart, stage.forkliftDays);
              rentals.push({
                  type: 'forklift',
                  start: fStart,
                  end: fEnd,
                  days: stage.forkliftDays,
                  offset: fOffset
              });
          }
          if (stage.scissorLiftDays > 0) {
              const sOffset = stage.scissorLiftStartOffset || 0;
              const sStart = addBusinessDays(start, sOffset);
              const sEnd = addBusinessDays(sStart, stage.scissorLiftDays);
              rentals.push({
                  type: 'scissor',
                  start: sStart,
                  end: sEnd,
                  days: stage.scissorLiftDays,
                  offset: sOffset
              });
          }

          items.push({
              id: stage.id,
              type: 'STAGE',
              name: stage.name || `Etap ${idx + 1}`,
              start: start,
              end: end,
              isJH: true,
              status: SupplierStatus.TO_ORDER,
              prodStart: start,
              prodEnd: end,
              delStart: start,
              delEnd: end,
              isDateEstimated: !stage.startDate,
              rentals: rentals 
          });
      });

      // 4. CUSTOM ITEMS
      (installation.customTimelineItems || []).forEach(item => {
          const start = item.startDate ? new Date(item.startDate) : new Date(orderDate);
          start.setHours(0,0,0,0);
          const end = item.endDate ? new Date(item.endDate) : addBusinessDays(start, 5);
          end.setHours(0,0,0,0);

          items.push({
              id: item.id,
              type: 'CUSTOM',
              name: item.name,
              start: start,
              end: end,
              isJH: true,
              status: SupplierStatus.TO_ORDER,
              prodStart: start,
              prodEnd: end,
              delStart: start,
              delEnd: end,
              isDateEstimated: false
          });
      });

      return items;
  }, [suppliers, orderDate, installation, transport, expandedGroups]);

  // Apply Custom Order
  const timelineItems = useMemo(() => {
      if (customOrder.length === 0) return generatedItems;

      const itemMap = new Map(generatedItems.map(i => [i.id, i]));
      const ordered: typeof generatedItems = [];
      const visited = new Set<string>();

      // 1. Add items in custom order
      customOrder.forEach(id => {
          const item = itemMap.get(id);
          if (item) {
              ordered.push(item);
              visited.add(id);
          }
      });

      // 2. Append new items (not in custom order) at the end
      generatedItems.forEach(item => {
          if (!visited.has(item.id)) {
              ordered.push(item);
          }
      });

      return ordered;
  }, [generatedItems, customOrder]);

  const moveRow = (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= timelineItems.length) return;

      // Initialize custom order if empty
      let currentOrder = customOrder.length > 0 ? [...customOrder] : generatedItems.map(i => i.id);
      
      // Sync length if items were added since last order save
      if (currentOrder.length !== timelineItems.length) {
          const currentSet = new Set(currentOrder);
          timelineItems.forEach(i => {
              if (!currentSet.has(i.id)) currentOrder.push(i.id);
          });
      }

      // Swap
      const temp = currentOrder[index];
      currentOrder[index] = currentOrder[newIndex];
      currentOrder[newIndex] = temp;
      
      setCustomOrder(currentOrder);
  };

  const resetOrder = () => {
      setCustomOrder([]);
  };

  // --- HEIGHT & RESIZING LOGIC ---
  const innerContentHeight = HEADER_HEIGHT + (timelineItems.length * ROW_HEIGHT);
  const totalContainerHeight = innerContentHeight + CHROME_HEIGHT;
  const initialVisibleRows = Math.min(timelineItems.length, DEFAULT_VISIBLE_ROWS);
  const initialContainerHeight = CHROME_HEIGHT + HEADER_HEIGHT + (initialVisibleRows * ROW_HEIGHT);
  
  const [containerHeight, setContainerHeight] = useState(initialContainerHeight);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
      if (containerHeight > totalContainerHeight + 50) {
          setContainerHeight(Math.max(200, totalContainerHeight + 20));
      }
  }, [timelineItems.length, totalContainerHeight]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startY = e.clientY;
      const startH = containerHeight;

      const onMouseMove = (moveEvent: MouseEvent) => {
          const deltaY = moveEvent.clientY - startY;
          setContainerHeight(Math.max(200, Math.min(startH + deltaY, totalContainerHeight + 100)));
      };

      const onMouseUp = () => {
          setIsResizing(false);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  // --- 2. SCALE & AXIS ---
  let minDate = new Date(orderDate);
  minDate.setDate(minDate.getDate() - 7);
  let maxDate = new Date(orderDate);
  maxDate.setDate(maxDate.getDate() + 60);

  timelineItems.forEach(i => {
      if (i.start < minDate) minDate = new Date(i.start);
      if (i.end > maxDate) maxDate = new Date(i.end);
  });
  if (protocolDate && protocolDate > maxDate) maxDate = new Date(protocolDate);
  maxDate.setDate(maxDate.getDate() + 14); 

  const BASE_PX_PER_DAY = 40;
  const pxPerDay = BASE_PX_PER_DAY * zoom;
  const totalDays = diffDays(minDate, maxDate);
  const chartWidth = totalDays * pxPerDay;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (sidebarRef.current) sidebarRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
  };

  useEffect(() => {
      const container = mainContainerRef.current;
      if (!container) return;
      const handleWheel = (e: WheelEvent) => {
          if (e.ctrlKey) {
              e.preventDefault();
              const direction = e.deltaY > 0 ? -1 : 1;
              setZoom(prev => Math.max(0.1, Math.min(2, prev + (direction * 0.1))));
          }
      };
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const dateToPx = (d: Date) => diffDays(minDate, d) * pxPerDay;
  
  // --- 3. ITEM ACTIONS ---

  const handleAddTemplate = (type: 'ASSEMBLY' | 'RENTAL' | 'CUSTOM') => {
      const newId = Math.random().toString(36).substr(2, 9);
      const sDate = new Date(orderDate).toISOString().split('T')[0];
      const eDate = new Date(orderDate.getTime() + 5*24*60*60*1000).toISOString().split('T')[0];

      if (type === 'CUSTOM') {
          const newItem: CustomTimelineItem = {
              id: newId,
              name: 'Zadanie Specjalne',
              startDate: sDate,
              endDate: eDate
          };
          onUpdateInstallation({ customTimelineItems: [...(installation.customTimelineItems || []), newItem] });
      } else {
          const newStage: InstallationStage = {
              id: newId,
              name: type === 'ASSEMBLY' ? 'Montaż Dodatkowy' : 'Wynajem Sprzętu',
              linkedSupplierIds: [],
              startDate: sDate,
              endDate: eDate,
              calcMethod: 'PALLETS',
              // Initialize with zeros
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
              calculatedDuration: 0,
              isExcluded: false
          };
          onUpdateInstallation({ stages: [...installation.stages, newStage] });
      }
  };

  const handleDeleteCustomRow = (id: string) => {
      onUpdateInstallation({ customTimelineItems: (installation.customTimelineItems || []).filter(i => i.id !== id) });
  };

  const updateCustomItemName = (id: string, name: string) => {
      const updated = (installation.customTimelineItems || []).map(i => i.id === id ? { ...i, name } : i);
      onUpdateInstallation({ customTimelineItems: updated });
  };

  const updateStageName = (id: string, name: string) => {
      const updated = installation.stages.map(s => s.id === id ? { ...s, name } : s);
      onUpdateInstallation({ stages: updated });
  };

  const handleMouseDownItem = (e: React.MouseEvent, id: string, type: typeof dragType, subType: string | null = null) => {
      e.stopPropagation();
      e.preventDefault();
      const item = timelineItems.find(i => i.id === id);
      if (!item) return;

      setIsDragging(id);
      setDragType(type);
      setDragSubType(subType);
      setDragStartX(e.clientX);
      setDragCurrentX(e.clientX);
      
      if (type === 'DELIVERY') {
          setDragOriginalDate(item.delStart);
      } else if (type === 'RENTAL_MOVE' && subType) {
          const rental = item.rentals?.find((r: any) => r.type === subType);
          if (rental) setDragOriginalDate(new Date(rental.start));
      } else {
          setDragOriginalDate(item.start);
          setDragOriginalEndDate(item.end);
      }
  };

  const handleConnectStart = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
      if (!scrollRect) return;
      
      setIsConnecting(id);
      setConnectMousePos({ x: e.clientX - scrollRect.left + scrollContainerRef.current!.scrollLeft, y: e.clientY - scrollRect.top + scrollContainerRef.current!.scrollTop });
  };

  const handleConnectEnd = (e: React.MouseEvent, targetId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isConnecting || isConnecting === targetId) {
          setIsConnecting(null);
          setConnectMousePos(null);
          return;
      }

      const targetItem = timelineItems.find(i => i.id === targetId);
      if (targetItem?.type === 'RENTAL_SUB') {
          setIsConnecting(null);
          setConnectMousePos(null);
          return;
      }

      const currentDeps = installation.dependencies || [];
      if (currentDeps.some(d => d.fromId === isConnecting && d.toId === targetId)) {
          setIsConnecting(null);
          setConnectMousePos(null);
          return;
      }

      const newDep: Dependency = {
          id: Math.random().toString(36).substr(2, 9),
          fromId: isConnecting,
          toId: targetId,
          type: 'finish-to-start'
      };
      
      const newDeps = [...currentDeps, newDep];
      propagateDateChanges(null, newDeps); 
      
      setIsConnecting(null);
      setConnectMousePos(null);
  };

  // --- DEPENDENCY CASCADE LOGIC ---
  const propagateDateChanges = (
      initialUpdates: Record<string, { start: string, end: string }> | null = null,
      dependenciesOverride: Dependency[] | null = null
  ) => {
      const activeDeps = dependenciesOverride || (installation.dependencies || []);
      
      const updatesMap = new Map<string, { start: string, end: string }>();
      
      if (initialUpdates) {
          Object.entries(initialUpdates).forEach(([id, val]) => updatesMap.set(id, val));
      }
      
      const getItemState = (id: string) => {
          if (updatesMap.has(id)) {
              const u = updatesMap.get(id)!;
              return { start: new Date(u.start), end: new Date(u.end) };
          }
          const item = timelineItems.find(i => i.id === id);
          if (!item) return null;
          
          if (item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP') return { start: item.delStart, end: item.delEnd };
          return { start: item.start, end: item.end };
      };

      const queue = initialUpdates ? Object.keys(initialUpdates) : [];
      
      if (!initialUpdates && dependenciesOverride) {
          const lastDep = dependenciesOverride[dependenciesOverride.length - 1];
          if(lastDep) queue.push(lastDep.fromId);
      }

      const visited = new Set<string>();

      while (queue.length > 0) {
          const sourceId = queue.shift()!;
          
          if (visited.has(sourceId)) continue; 
          visited.add(sourceId);

          const sState = getItemState(sourceId);
          if (!sState) continue;
          
          const sourceEnd = sState.end;

          const children = activeDeps.filter(d => d.fromId === sourceId);
          
          children.forEach(dep => {
              const targetId = dep.toId;
              const tState = getItemState(targetId);
              if (!tState) return;

              if (tState.start < sourceEnd) {
                  const duration = diffDays(tState.start, tState.end);
                  const newStart = new Date(sourceEnd);
                  const newEnd = addBusinessDays(newStart, duration);
                  
                  updatesMap.set(targetId, {
                      start: newStart.toISOString().split('T')[0],
                      end: newEnd.toISOString().split('T')[0]
                  });
                  
                  queue.push(targetId);
                  visited.delete(targetId); 
              }
          });
      }

      if (updatesMap.size > 0 || dependenciesOverride) {
          let newStages = [...installation.stages];
          let newCustom = [...(installation.customTimelineItems || [])];
          let supplierUpdates: Record<string, string> = {};
          
          updatesMap.forEach((val, id) => {
              const item = timelineItems.find(i => i.id === id);
              if (!item) return;

              if (item.type === 'STAGE') {
                  newStages = newStages.map(s => s.id === id ? { ...s, startDate: val.start, endDate: val.end } : s);
              } else if (item.type === 'CUSTOM') {
                  newCustom = newCustom.map(i => i.id === id ? { ...i, startDate: val.start, endDate: val.end } : i);
              } else if (item.type === 'SUPPLIER') {
                  supplierUpdates[id] = val.start;
              } else if (item.type === 'TRANSPORT_GROUP') {
                  // If Group moves, update all children suppliers
                  const t = transport.find(tr => tr.id === id);
                  if (t && t.linkedSupplierIds) {
                      t.linkedSupplierIds.forEach(sid => {
                          supplierUpdates[sid] = val.start;
                      });
                  }
              }
          });

          const installUpdates: any = { stages: newStages, customTimelineItems: newCustom };
          if (dependenciesOverride) installUpdates.dependencies = dependenciesOverride;
          
          onUpdateInstallation(installUpdates);
          Object.entries(supplierUpdates).forEach(([id, date]) => onUpdateSupplier(id, { deliveryDate: date }));
      } else if (dependenciesOverride) {
          onUpdateInstallation({ dependencies: dependenciesOverride });
      }
  };

  const removeDependency = (id: string) => {
      const newDeps = (installation.dependencies || []).filter(d => d.id !== id);
      onUpdateInstallation({ dependencies: newDeps });
  };

  useEffect(() => {
      if (isDragging || isConnecting) {
          const onMouseMove = (e: MouseEvent) => {
              if (isDragging) setDragCurrentX(e.clientX);
              if (isConnecting) {
                  const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
                  if (scrollRect) {
                      setConnectMousePos({ 
                          x: e.clientX - scrollRect.left + scrollContainerRef.current!.scrollLeft, 
                          y: e.clientY - scrollRect.top + scrollContainerRef.current!.scrollTop 
                      });
                  }
              }
          };
          const onMouseUp = (e: MouseEvent) => {
              if (isConnecting) {
                  setIsConnecting(null);
                  setConnectMousePos(null);
              }

              if (!isDragging) return;
              const deltaPx = e.clientX - dragStartX;
              const deltaDays = Math.round(deltaPx / pxPerDay);
              
              if (deltaDays !== 0) {
                  if (dragType === 'RENTAL_MOVE' && dragOriginalDate && dragSubType) {
                      const item = timelineItems.find(i => i.id === isDragging);
                      if (item && item.type === 'STAGE') {
                          const parentStage = installation.stages.find(s => s.id === item.id);
                          if (parentStage && parentStage.startDate) {
                              const newRentalStart = new Date(dragOriginalDate);
                              newRentalStart.setDate(newRentalStart.getDate() + deltaDays);
                              
                              const parentStart = new Date(parentStage.startDate);
                              const newOffset = countBusinessDays(parentStart, newRentalStart);
                              const fieldOffset = dragSubType === 'forklift' ? 'forkliftStartOffset' : 'scissorLiftStartOffset';
                              const validOffset = Math.max(0, newOffset);

                              const updatedStages = installation.stages.map(s => s.id === item.id ? { ...s, [fieldOffset]: validOffset } : s);
                              onUpdateInstallation({ stages: updatedStages });
                          }
                      }
                  } else {
                      // STANDARD MOVE (Stage, Custom, Supplier, Group)
                      const updates: Record<string, { start: string, end: string }> = {};

                      if (dragType === 'DELIVERY' && dragOriginalDate) {
                          const newDate = new Date(dragOriginalDate);
                          newDate.setDate(newDate.getDate() + deltaDays);
                          const sStr = newDate.toISOString().split('T')[0];
                          const eStr = addBusinessDays(newDate, 1).toISOString().split('T')[0];
                          updates[isDragging] = { start: sStr, end: eStr };

                      } else if ((dragType === 'STAGE_MOVE' || dragType === 'CUSTOM_MOVE') && dragOriginalDate && dragOriginalEndDate) {
                          const newStart = new Date(dragOriginalDate);
                          newStart.setDate(newStart.getDate() + deltaDays);
                          const newEnd = new Date(dragOriginalEndDate);
                          newEnd.setDate(newEnd.getDate() + deltaDays);
                          
                          updates[isDragging] = {
                              start: newStart.toISOString().split('T')[0],
                              end: newEnd.toISOString().split('T')[0]
                          };

                      } else if ((dragType === 'STAGE_RESIZE' || dragType === 'CUSTOM_RESIZE') && dragOriginalEndDate && dragOriginalDate) {
                          const newEnd = new Date(dragOriginalEndDate);
                          newEnd.setDate(newEnd.getDate() + deltaDays);
                          
                          if (newEnd >= dragOriginalDate) {
                              updates[isDragging] = {
                                  start: dragOriginalDate.toISOString().split('T')[0],
                                  end: newEnd.toISOString().split('T')[0]
                              };
                          }
                      }
                      
                      propagateDateChanges(updates);
                  }
              }
              
              setIsDragging(null);
              setDragType(null);
              setDragSubType(null);
              setDragOriginalDate(null);
              setDragOriginalEndDate(null);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          return () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
          };
      }
  }, [isDragging, dragOriginalDate, dragOriginalEndDate, dragStartX, pxPerDay, dragType, dragSubType, installation, isConnecting, timelineItems, transport]);

  const handleDateChange = (id: string, type: string, field: 'start' | 'end', val: string) => {
      const updates: Record<string, { start: string, end: string }> = {};
      const item = timelineItems.find(i => i.id === id);
      if(!item) return;

      if (type === 'STAGE' || type === 'CUSTOM') {
          const currentStart = item.start;
          const currentEnd = item.end;
          
          if(field === 'start') {
              updates[id] = { start: val, end: currentEnd.toISOString().split('T')[0] };
          } else {
              updates[id] = { start: currentStart.toISOString().split('T')[0], end: val };
          }
      } else {
          // Supplier or Group
          if (field === 'end') {
              // For delivery dates, setting end implies setting the specific date (deliveryDate)
              // which drives the 'start' of delivery visual. But input is usually for Delivery Date itself.
              // If user changes Delivery Date -> we map it to `start` of delivery visual block in `propagateDateChanges`.
              // But here `val` comes from an input type date.
              
              // Let's assume 'val' is the chosen Delivery Date.
              const d = new Date(val);
              const eStr = addBusinessDays(d, 1).toISOString().split('T')[0];
              updates[id] = { start: val, end: eStr };
          } else {
              // Changing start directly also maps to delivery date
              const d = new Date(val);
              const eStr = addBusinessDays(d, 1).toISOString().split('T')[0];
              updates[id] = { start: val, end: eStr };
          }
      }
      
      propagateDateChanges(updates);
  };

  // --- TASKS LOGIC ---
  const handleTaskClick = (e: React.MouseEvent, id: string, type: string) => {
      e.stopPropagation();
      if (activeTaskModal?.id === id) {
          setActiveTaskModal(null);
      } else {
          const rect = e.currentTarget.getBoundingClientRect();
          const containerRect = mainContainerRef.current?.getBoundingClientRect();
          const relativeTop = containerRect ? rect.top - containerRect.top : 0;
          
          setActiveTaskModal({ id, type, top: relativeTop });
      }
  };

  const addTaskToItem = () => {
      if (!newTaskText.trim() || !activeTaskModal || !onUpdateTasks) return;
      
      const newTask: ProjectTask = {
          id: Math.random().toString(36).substr(2, 9),
          text: newTaskText.trim(),
          isCompleted: false,
          linkedItemId: activeTaskModal.id,
          linkedItemType: activeTaskModal.type,
          dueDate: newTaskDate
      };
      
      onUpdateTasks([...tasks, newTask]);
      setNewTaskText('');
      setNewTaskDate('');
  };

  const toggleTask = (taskId: string) => {
      if (!onUpdateTasks) return;
      const updated = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
      onUpdateTasks(updated);
  };

  const handleGridDoubleClick = (e: React.MouseEvent, item: any) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const dayIndex = Math.floor(clickX / pxPerDay);
      const date = new Date(minDate);
      date.setDate(date.getDate() + dayIndex);
      
      const dateStr = date.toISOString().split('T')[0];

      const containerRect = mainContainerRef.current?.getBoundingClientRect();
      const relativeTop = containerRect ? rect.top - containerRect.top : 0;

      setNewTaskDate(dateStr);
      setNewTaskText('');
      setActiveTaskModal({ id: item.id, type: item.type, top: relativeTop });
  };

  // --- CALENDAR EDIT POPOVER ---
  const handleCalendarItemClick = (e: React.MouseEvent, item: any) => {
      e.stopPropagation();
      const range = getItemRange(item);
      
      // Calculate position relative to container to avoid clipping if possible, or fixed
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      
      setEditStart(range.start.toISOString().split('T')[0]);
      setEditEnd(range.end.toISOString().split('T')[0]);
      setEditPopover({
          id: item.id,
          type: item.type,
          x: rect.left,
          y: rect.bottom + 5,
          name: item.name
      });
  };

  const saveEditPopover = () => {
      if(!editPopover) return;
      // Use existing update logic
      // Note: handleDateChange handles specific field updates.
      // For stages/custom, we update both start and end.
      // For suppliers, updating 'end' (which is mapped to delivery date input in modal) drives the delivery date.
      
      if (editPopover.type === 'STAGE' || editPopover.type === 'CUSTOM') {
          const updates: Record<string, { start: string, end: string }> = {};
          updates[editPopover.id] = { start: editStart, end: editEnd };
          propagateDateChanges(updates);
      } else {
          // Supplier / Group -> Update Delivery Date based on 'editStart' (assuming popover shows Delivery Date as Start)
          // Actually, in calendar view, a supplier item IS the delivery.
          // So 'editStart' is the delivery date.
          handleDateChange(editPopover.id, editPopover.type, 'end', editStart);
      }
      setEditPopover(null);
  };

  // --- 4. RENDERERS ---

  const renderAxis = () => {
      const days = []; const weeks = []; const months = [];
      let currentDate = new Date(minDate); let i = 0;
      const showDays = pxPerDay >= 20; const showWeeks = pxPerDay >= 5;
      
      while (currentDate <= maxDate) {
          const left = i * pxPerDay;
          const isMonthStart = currentDate.getDate() === 1 || i === 0;
          const isWeekStart = currentDate.getDay() === 1;
          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

          if (showDays) days.push(<div key={`d-${i}`} className={`absolute bottom-0 h-5 border-l border-zinc-200 dark:border-zinc-800 text-[9px] pl-1 text-zinc-500 font-mono ${isWeekend ? 'bg-zinc-100 dark:bg-zinc-900/50' : ''}`} style={{ left, width: pxPerDay }}>{currentDate.getDate()}</div>);
          if (showWeeks && (isWeekStart || i === 0)) weeks.push(<div key={`w-${i}`} className={`absolute bottom-${showDays ? '5' : '0'} h-5 border-l border-zinc-300 dark:border-zinc-700 text-[9px] pl-1 font-bold text-zinc-400 bg-white/50 dark:bg-zinc-900/50 overflow-hidden whitespace-nowrap`} style={{ left, width: 7 * pxPerDay }}>W{getWeekNumber(currentDate)}</div>);
          if (isMonthStart) months.push(<div key={`m-${i}`} className="absolute top-0 h-5 border-l-2 border-zinc-300 dark:border-zinc-600 text-[10px] font-bold uppercase pl-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-sm z-10" style={{ left }}>{currentDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</div>);
          currentDate.setDate(currentDate.getDate() + 1); i++;
      }
      return <div className="h-[60px] sticky top-0 z-30 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-700 select-none overflow-hidden shadow-sm">{months}{weeks}{days}{renderMilestoneLabels()}</div>;
  };

  const renderMilestoneLabels = () => {
      const m = [];
      const orderX = dateToPx(orderDate);
      if (orderX >= 0) m.push(<div key="lbl-order" className="absolute top-0 transform -translate-x-1/2 z-50 pointer-events-none" style={{ left: orderX }}><div className="bg-green-100 text-green-800 border-green-300 border text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">Zamówienie</div><div className="w-px h-4 bg-green-400 mx-auto"></div></div>);
      if (protocolDate) {
          const protoX = dateToPx(protocolDate);
          if (protoX >= 0) m.push(<div key="lbl-proto" className="absolute top-0 transform -translate-x-1/2 z-50 pointer-events-none" style={{ left: protoX }}><div className="bg-purple-100 text-purple-800 border-purple-300 border text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">Protokół</div><div className="w-px h-4 bg-purple-400 mx-auto"></div></div>);
      }
      const todayX = dateToPx(today);
      if (todayX >= 0) m.push(<div key="lbl-today" className="absolute bottom-0 transform -translate-x-1/2 z-40" style={{ left: todayX }}><div className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 rounded-t-sm">Dziś</div></div>);
      return m;
  };

  const renderGrid = () => {
      const lines = [];
      let currentDate = new Date(minDate);
      let i = 0;
      const showDayGrid = pxPerDay >= 20;
      
      const isDark = document.documentElement.classList.contains('dark');

      while (currentDate <= maxDate) {
          const left = i * pxPerDay;
          if (currentDate.getDate() === 1) lines.push(<div key={`gl-m-${i}`} className="absolute top-0 bottom-0 w-[2px] bg-zinc-300 dark:bg-zinc-700 z-0" style={{ left }}></div>);
          else if (currentDate.getDay() === 1) lines.push(<div key={`gl-w-${i}`} className="absolute top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" style={{ left }}></div>);
          else if (showDayGrid) lines.push(<div key={`gl-d-${i}`} className="absolute top-0 bottom-0 w-px bg-zinc-100 dark:bg-zinc-800/50" style={{ left }}></div>);
          
          if (showDayGrid && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
              lines.push(
                  <div 
                    key={`bg-we-${i}`} 
                    className="absolute top-0 bottom-0 pointer-events-none" 
                    style={{ 
                        left, 
                        width: pxPerDay,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
                        backgroundImage: isDark 
                            ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.03) 5px, rgba(255,255,255,0.03) 10px)'
                            : 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)'
                    }}
                  ></div>
              );
          }
          currentDate.setDate(currentDate.getDate() + 1); i++;
      }
      return lines;
  };

  const renderMilestones = () => {
      const m = [];
      const orderX = dateToPx(orderDate);
      if (orderX >= 0) m.push(<div key="ms-order" className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-green-500/50 z-10 pointer-events-none" style={{ left: orderX }}></div>);
      if (protocolDate) {
          const protoX = dateToPx(protocolDate);
          if (protoX >= 0) m.push(<div key="ms-proto" className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-purple-500/50 z-10 pointer-events-none" style={{ left: protoX }}></div>);
      }
      const todayX = dateToPx(today);
      if (todayX >= 0) m.push(<div key="ms-today" className="absolute top-0 bottom-0 w-[2px] bg-red-500/30 z-20 pointer-events-none" style={{ left: todayX }}></div>);
      return m;
  };

  const renderDependencies = () => {
      if (!installation.dependencies) return null;
      
      return (
          <svg className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none overflow-visible">
              <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                      <polygon points="0 0, 6 2, 0 4" fill="#a1a1aa" />
                  </marker>
              </defs>
              {installation.dependencies.map(dep => {
                  const fromItem = timelineItems.find(i => i.id === dep.fromId);
                  const toItem = timelineItems.find(i => i.id === dep.toId);
                  
                  if (!fromItem || !toItem) return null;

                  const fromIdx = timelineItems.indexOf(fromItem);
                  const toIdx = timelineItems.indexOf(toItem);
                  
                  const x1 = dateToPx(fromItem.type === 'SUPPLIER' || fromItem.type === 'TRANSPORT_GROUP' ? fromItem.delEnd : fromItem.end);
                  const y1 = (fromIdx * ROW_HEIGHT) + HEADER_HEIGHT + (ROW_HEIGHT / 3); 
                  
                  const x2 = dateToPx(toItem.type === 'SUPPLIER' || toItem.type === 'TRANSPORT_GROUP' ? toItem.delStart : toItem.start);
                  const y2 = (toIdx * ROW_HEIGHT) + HEADER_HEIGHT + (ROW_HEIGHT / 3);

                  const c1x = x1 + 30;
                  const c2x = x2 - 30;
                  const path = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;

                  return (
                      <g key={dep.id} className="pointer-events-auto cursor-pointer group" onDoubleClick={() => removeDependency(dep.id)}>
                          <path d={path} stroke="#d4d4d8" strokeWidth="2" fill="none" className="group-hover:stroke-red-400 transition-colors" markerEnd="url(#arrowhead)"/>
                      </g>
                  );
              })}
              {isConnecting && connectMousePos && (
                  <path 
                      d={`M ${dateToPx(timelineItems.find(i => i.id === isConnecting)!.end)} ${(timelineItems.findIndex(i => i.id === isConnecting) * ROW_HEIGHT) + HEADER_HEIGHT + (ROW_HEIGHT / 3)} L ${connectMousePos.x} ${connectMousePos.y}`}
                      stroke="#fbbf24" 
                      strokeWidth="2" 
                      fill="none" 
                      strokeDasharray="5,5"
                  />
              )}
          </svg>
      );
  };

  // --- CALENDAR VIEW LOGIC ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const days = [];

      // Add padding days from prev month to start on Monday (1)
      const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 
      for (let i = firstDayOfWeek; i > 0; i--) {
          const d = new Date(firstDay);
          d.setDate(d.getDate() - i);
          days.push({ date: d, isCurrentMonth: false });
      }

      // Current month days
      for (let i = 1; i <= lastDay.getDate(); i++) {
          days.push({ date: new Date(year, month, i), isCurrentMonth: true });
      }

      // Padding days for next month to complete the row (grid of 7)
      const remaining = 7 - (days.length % 7);
      if (remaining < 7) {
          for (let i = 1; i <= remaining; i++) {
              const d = new Date(lastDay);
              d.setDate(d.getDate() + i);
              days.push({ date: d, isCurrentMonth: false });
          }
      }
      return days;
  };

  const getItemRange = (item: any) => {
      if (item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP') {
          return { start: item.delStart, end: item.delEnd };
      }
      return { start: item.start, end: item.end };
  };

  const renderSingleMonth = (baseDate: Date) => {
      const days = getDaysInMonth(baseDate);
      const weeks = [];
      for(let i=0; i<days.length; i+=7) {
          weeks.push(days.slice(i, i+7));
      }
      
      return (
          <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 overflow-hidden min-w-[300px] border-r border-zinc-200 dark:border-zinc-700">
              {/* Header */}
              <div className="p-2 text-center font-bold text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 shrink-0">
                  {baseDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
              </div>
              
              {/* Weekdays */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
                  {/* Week Num Header */}
                  <div className="w-6 py-1 text-center text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-wide border-r border-zinc-100 dark:border-zinc-800">
                      #
                  </div>
                  {/* Days Header */}
                  <div className="grid grid-cols-7 flex-1">
                      {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((day, i) => (
                          <div key={i} className="py-1 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wide border-r border-zinc-100 dark:border-zinc-800 last:border-0">
                              {day}
                          </div>
                      ))}
                  </div>
              </div>
              
              {/* Weeks */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {weeks.map((week, wIdx) => {
                      const weekStart = week[0].date;
                      const weekEnd = new Date(week[6].date);
                      weekEnd.setHours(23, 59, 59, 999); // End of Sunday

                      // 1. Find Items for this week
                      const weekItems = timelineItems.filter(item => {
                          const { start, end } = getItemRange(item);
                          return start < weekEnd && end > weekStart;
                      }).map(item => {
                          const { start, end } = getItemRange(item);
                          
                          // Calculate relative grid positions (1-based)
                          // weekStart is Monday 00:00
                          
                          const weekStartTs = weekStart.getTime();
                          const oneDayMs = 1000 * 60 * 60 * 24;
                          
                          // Days offset from Monday (0 to 6 usually, but can be negative if starts before, or > 6 if ends after)
                          const startDiff = Math.floor((start.getTime() - weekStartTs) / oneDayMs);
                          const endDiff = Math.ceil((end.getTime() - weekStartTs) / oneDayMs);
                          
                          // Clamp to 0-7 range for this week's grid (columns 1 to 7)
                          const gridColStart = Math.max(1, startDiff + 1);
                          const gridColEnd = Math.min(8, endDiff + 1);
                          
                          return {
                              ...item,
                              gridColStart,
                              gridColSpan: Math.max(1, gridColEnd - gridColStart),
                              isContinuesLeft: startDiff < 0,
                              isContinuesRight: endDiff > 7
                          };
                      });

                      // 2. Sort items: Start date ASC, then Duration DESC
                      weekItems.sort((a, b) => {
                          if (a.gridColStart !== b.gridColStart) return a.gridColStart - b.gridColStart;
                          return b.gridColSpan - a.gridColSpan;
                      });

                      // 3. Packing Algorithm (Simple Greedy)
                      const slots: number[] = []; // slots[row_index] = last_occupied_col_index
                      const itemSlots: number[] = []; // assigned row index for each item

                      weekItems.forEach(item => {
                          let placed = false;
                          for(let i=0; i<slots.length; i++) {
                              if (slots[i] < item.gridColStart) {
                                  // Found a row where this item fits after the last item
                                  slots[i] = item.gridColStart + item.gridColSpan - 1;
                                  itemSlots.push(i);
                                  placed = true;
                                  break;
                              }
                          }
                          if (!placed) {
                              // New row needed
                              slots.push(item.gridColStart + item.gridColSpan - 1);
                              itemSlots.push(slots.length - 1);
                          }
                      });

                      const rowCount = Math.max(1, slots.length);

                      return (
                          <div key={wIdx} className="flex border-b border-zinc-200 dark:border-zinc-800 min-h-[100px]">
                              {/* Week Number Column */}
                              <div className="w-6 bg-zinc-50/80 dark:bg-zinc-900/80 border-r border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-[9px] text-zinc-400 font-mono shrink-0 select-none">
                                  {getWeekNumber(week[0].date)}
                              </div>

                              {/* Grid Content */}
                              <div className="relative flex-1">
                                  {/* Background Grid */}
                                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none h-full">
                                      {week.map((day, dIdx) => {
                                          const isToday = day.date.toDateString() === new Date().toDateString();
                                          return (
                                              <div key={dIdx} className={`border-r border-zinc-100 dark:border-zinc-800 last:border-0 p-1 flex flex-col h-full ${!day.isCurrentMonth ? 'bg-zinc-50/50 dark:bg-zinc-900/30' : ''} ${isToday ? 'bg-amber-50/30' : ''}`}>
                                                  <span className={`text-[10px] font-bold ${isToday ? 'text-amber-600 bg-amber-100 px-1 rounded self-start' : !day.isCurrentMonth ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                      {day.date.getDate()}
                                                  </span>
                                              </div>
                                          );
                                      })}
                                  </div>

                                  {/* Events Layer (CSS Grid) */}
                                  <div 
                                      className="relative pt-6 px-1 pb-2 grid grid-cols-7 gap-y-1 gap-x-0 auto-rows-[22px] pointer-events-none"
                                      style={{ minHeight: `${24 + (rowCount * 26)}px` }} // Dynamic min height
                                  > 
                                      {weekItems.map((item, idx) => {
                                          const rowStart = itemSlots[idx] + 1; // 1-based
                                          
                                          let barColor = 'bg-blue-100 text-blue-700 border-blue-200';
                                          if (item.type === 'STAGE') barColor = 'bg-purple-100 text-purple-700 border-purple-200';
                                          if (item.type === 'CUSTOM') barColor = 'bg-zinc-100 text-zinc-700 border-zinc-200';
                                          if (item.type === 'TRANSPORT_GROUP') barColor = 'bg-blue-50 text-blue-600 border-blue-200 border-dashed';

                                          return (
                                              <div 
                                                  key={`${item.id}-${wIdx}`}
                                                  className={`
                                                      mx-0.5 rounded-sm px-1.5 flex items-center text-[9px] font-bold truncate border shadow-sm pointer-events-auto cursor-pointer hover:brightness-95 transition-all
                                                      ${barColor}
                                                      ${item.isContinuesLeft ? 'rounded-l-none border-l-0 ml-0 opacity-90' : ''}
                                                      ${item.isContinuesRight ? 'rounded-r-none border-r-0 mr-0 opacity-90' : ''}
                                                  `}
                                                  style={{
                                                      gridColumnStart: item.gridColStart,
                                                      gridColumnEnd: `span ${item.gridColSpan}`,
                                                      gridRowStart: rowStart
                                                  }}
                                                  onClick={(e) => handleCalendarItemClick(e, item)}
                                                  onDoubleClick={(e) => handleGridDoubleClick(e, item)}
                                                  title={`${item.name} (${item.type})`}
                                              >
                                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                                      {item.isContinuesLeft && <ChevronLeft size={8}/>}
                                                      <span className="truncate flex-1">{item.name}</span>
                                                      {item.isContinuesRight && <ChevronRight size={8} className="ml-auto flex-shrink-0"/>}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderMultiMonthCalendar = () => {
      const monthsToShow = 3;
      const months = [];
      for(let i=0; i<monthsToShow; i++) {
          const d = new Date(calendarDate);
          d.setDate(1); // Set to first of month to be safe
          d.setMonth(d.getMonth() + i);
          months.push(d);
      }

      return (
          <div className="flex h-full bg-zinc-50 dark:bg-zinc-900 overflow-x-auto overflow-y-hidden">
              {months.map(m => (
                  <div key={m.getTime()} className="flex-1 min-w-[300px] border-r border-zinc-200 dark:border-zinc-700 last:border-0 h-full">
                      {renderSingleMonth(m)}
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div 
        ref={mainContainerRef}
        className="bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 flex flex-col relative"
        style={{ height: viewMode === 'CALENDAR' ? '700px' : containerHeight }} 
    >
        {/* EDIT ITEM POPOVER (Calendar) */}
        {editPopover && (
            <div 
                className="absolute z-[110] bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-700 w-64 rounded-md p-3 animate-fadeIn flex flex-col gap-2"
                style={{ top: Math.min(editPopover.y, 600), left: Math.min(editPopover.x, window.innerWidth - 300) }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold truncate max-w-[180px]" title={editPopover.name}>{editPopover.name}</span>
                    <button onClick={() => setEditPopover(null)} className="hover:text-red-500"><X size={14}/></button>
                </div>
                <div className="space-y-2">
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Start</label>
                        <input type="date" className="w-full text-xs p-1 border rounded" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Koniec</label>
                        <input type="date" className="w-full text-xs p-1 border rounded" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                    </div>
                    <button onClick={saveEditPopover} className="w-full bg-blue-600 text-white text-xs py-1.5 rounded font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                        <Save size={12}/> Zapisz
                    </button>
                </div>
            </div>
        )}

        {/* TASK MODAL OVERLAY */}
        {activeTaskModal && (
            <div 
                className="absolute z-[100] bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-700 w-80 rounded-md overflow-hidden animate-fadeIn"
                style={{ top: Math.min(activeTaskModal.top, (viewMode === 'CALENDAR' ? 400 : containerHeight - 300)), left: 280 }}
            >
                <div className="bg-zinc-50 dark:bg-zinc-800 p-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300">Zadania dla etapu</h4>
                    <button onClick={() => setActiveTaskModal(null)} className="hover:text-red-500"><X size={14}/></button>
                </div>
                <div className="p-2 max-h-48 overflow-y-auto bg-zinc-50/50 dark:bg-black/20">
                    {tasks.filter(t => t.linkedItemId === activeTaskModal.id).length === 0 && (
                        <div className="text-xs text-zinc-400 text-center py-2 italic">Brak zadań.</div>
                    )}
                    {tasks.filter(t => t.linkedItemId === activeTaskModal.id).map(t => (
                        <div key={t.id} className="flex items-start gap-2 mb-2 text-xs">
                            <button onClick={() => toggleTask(t.id)} className={t.isCompleted ? "text-green-500" : "text-zinc-400"}>
                                {t.isCompleted ? <CheckSquare size={14}/> : <Square size={14}/>}
                            </button>
                            <div className="flex-1">
                                <div className={`${t.isCompleted ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{t.text}</div>
                                {t.dueDate && <div className="text-[9px] text-amber-600 font-mono mt-0.5">{t.dueDate}</div>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                    <input 
                        type="text" 
                        placeholder="Nowe zadanie..." 
                        className="w-full text-xs p-1 border rounded mb-1 bg-transparent dark:text-white" 
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-1">
                        <input 
                            type="date" 
                            className="text-[10px] p-1 border rounded bg-transparent dark:text-white"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                        />
                        <button 
                            onClick={addTaskToItem}
                            className="flex-1 bg-blue-600 text-white text-xs rounded font-bold hover:bg-blue-700 transition-colors"
                        >
                            Dodaj
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* TOP CONTROLS */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 shrink-0 h-[50px]">
            <div className="flex items-center gap-4">
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-0.5 rounded-md">
                    <button 
                        onClick={() => setViewMode('GANTT')} 
                        className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-colors ${viewMode === 'GANTT' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Harmonogram
                    </button>
                    <button 
                        onClick={() => setViewMode('CALENDAR')} 
                        className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-colors ${viewMode === 'CALENDAR' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        Kalendarz (3M)
                    </button>
                </div>

                {viewMode === 'GANTT' && (
                    <div className="flex items-center gap-2">
                        <DropdownMenu 
                            trigger={
                                <div className="text-[10px] bg-white border border-zinc-300 hover:bg-zinc-50 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer select-none">
                                    <Plus size={10}/> Dodaj pozycję
                                </div>
                            }
                            items={[
                                { label: 'Montaż / Robocizna', icon: <Wrench size={14}/>, onClick: () => handleAddTemplate('ASSEMBLY') },
                                { label: 'Własne Zadanie', icon: <PenLine size={14}/>, onClick: () => handleAddTemplate('CUSTOM') }
                            ]}
                            align="left"
                        />
                        <button 
                            onClick={() => setIsCompact(!isCompact)}
                            className={`text-[10px] border border-zinc-300 hover:bg-zinc-50 text-zinc-600 px-2 py-1 rounded flex items-center gap-1 transition-colors ${isCompact ? 'bg-zinc-200' : 'bg-white'}`}
                            title={isCompact ? "Widok Rozszerzony" : "Widok Kompaktowy"}
                        >
                            {isCompact ? <Maximize2 size={10}/> : <Minimize2 size={10}/>} {isCompact ? "Rozwiń" : "Zwiń"}
                        </button>
                        {customOrder.length > 0 && (
                            <button 
                                onClick={resetOrder}
                                className="text-[10px] bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                title="Resetuj kolejność"
                            >
                                <RefreshCcw size={10}/> Reset
                            </button>
                        )}
                        <button 
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`text-[10px] border border-zinc-300 hover:bg-zinc-50 text-zinc-600 px-2 py-1 rounded flex items-center gap-1 transition-colors ${!showSidebar ? 'bg-zinc-200' : 'bg-white'}`}
                            title={showSidebar ? "Ukryj listę" : "Pokaż listę"}
                        >
                            <PanelLeft size={10}/> {showSidebar ? "Ukryj" : "Pokaż"}
                        </button>
                    </div>
                )}

                {viewMode === 'CALENDAR' && (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
                            title="Poprzedni miesiąc"
                        >
                            <ChevronLeft size={14}/>
                        </button>
                        <span className="text-xs font-bold w-32 text-center text-zinc-600 dark:text-zinc-400">
                            Start: {calendarDate.toLocaleDateString('pl-PL', { month: 'long' })}
                        </span>
                        <button 
                            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
                            title="Następny miesiąc"
                        >
                            <ChevronRight size={14}/>
                        </button>
                        <button 
                            onClick={() => setCalendarDate(new Date())}
                            className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-200 transition-colors ml-2"
                        >
                            Dziś
                        </button>
                    </div>
                )}
            </div>
            
            {viewMode === 'GANTT' && (
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-400 mr-2 hidden sm:inline-block flex items-center gap-1"><MousePointer2 size={10} /> Ctrl+Scroll</span>
                    <button onClick={() => setZoom(Math.max(0.1, zoom - 0.2))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"><ZoomOut size={16}/></button>
                    <div className="w-16 h-1 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{ width: `${(zoom/2)*100}%` }}></div></div>
                    <button onClick={() => setZoom(Math.min(2, zoom + 0.2))} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"><ZoomIn size={16}/></button>
                </div>
            )}
        </div>

        {/* VIEW CONTENT */}
        {viewMode === 'CALENDAR' ? renderMultiMonthCalendar() : (
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* LEFT SIDEBAR */}
                {showSidebar && (
                    <div className="w-[300px] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0 z-20 overflow-hidden relative animate-slideInRight">
                        <div className="h-[60px] border-b border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center px-4 font-bold text-[10px] text-zinc-500 uppercase shrink-0">
                            Etap / Daty / Relacje
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <div ref={sidebarRef} className="w-full absolute top-0 left-0 right-0 will-change-transform">
                                {timelineItems.map((item, index) => {
                                    const activeTasks = tasks.filter(t => t.linkedItemId === item.id && !t.isCompleted).length;
                                    const incomingDeps = (installation.dependencies || []).filter(d => d.toId === item.id);
                                    
                                    const isGroup = item.type === 'TRANSPORT_GROUP';
                                    const isChild = item.isChild;
                                    const isExpanded = expandedGroups.has(item.id);

                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`border-b border-zinc-100 dark:border-zinc-800 px-2 flex flex-col justify-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 group relative ${isChild ? 'bg-zinc-50/50 dark:bg-zinc-900/30' : ''}`} 
                                            style={{ height: ROW_HEIGHT }}
                                        >
                                            <div className="flex justify-between items-center mb-1 gap-2">
                                                <div className="flex flex-col gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity w-4">
                                                    <button 
                                                        onClick={() => moveRow(index, 'up')}
                                                        disabled={index === 0}
                                                        className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20"
                                                    >
                                                        <ArrowUp size={10}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => moveRow(index, 'down')}
                                                        disabled={index === timelineItems.length - 1}
                                                        className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20"
                                                    >
                                                        <ArrowDown size={10}/>
                                                    </button>
                                                </div>

                                                {/* Toggle Expand for Groups */}
                                                {isGroup ? (
                                                    <button onClick={() => toggleGroup(item.id)} className="p-0.5 text-zinc-500">
                                                        {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                                    </button>
                                                ) : isChild ? (
                                                    <div className="w-3"></div> // Indent
                                                ) : null}

                                                <div className={`flex items-center gap-2 flex-1 min-w-0 ${isChild ? 'pl-2 border-l border-zinc-300 dark:border-zinc-700' : ''}`}>
                                                    {item.type === 'SUPPLIER' && !isChild && <Truck size={12} className="text-blue-500 shrink-0"/>}
                                                    {isChild && <Truck size={12} className="text-zinc-400 shrink-0"/>}
                                                    {isGroup && <Combine size={12} className="text-blue-600 shrink-0"/>}
                                                    {item.type === 'STAGE' && <Layers size={12} className="text-purple-500 shrink-0"/>}
                                                    {item.type === 'CUSTOM' && <PenLine size={12} className="text-zinc-500 shrink-0"/>}
                                                    
                                                    {item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP' ? (
                                                        <div className={`font-bold text-xs truncate ${isChild ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`} title={item.name}>{item.name}</div>
                                                    ) : (
                                                        <input 
                                                            type="text" 
                                                            className="font-bold text-xs text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-transparent hover:border-zinc-300 outline-none w-full"
                                                            value={item.name}
                                                            onChange={(e) => item.type === 'STAGE' ? updateStageName(item.id, e.target.value) : updateCustomItemName(item.id, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {/* TASK BUTTON */}
                                                    <button 
                                                        onClick={(e) => handleTaskClick(e, item.id, item.type)}
                                                        className={`p-1 rounded transition-colors relative ${activeTasks > 0 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100'}`}
                                                        title="Zadania / Notatki"
                                                    >
                                                        <ClipboardList size={12}/>
                                                        {activeTasks > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold">{activeTasks}</span>}
                                                    </button>

                                                    {item.type === 'CUSTOM' && (
                                                        <button onClick={() => handleDeleteCustomRow(item.id)} className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                    )}
                                                    {item.isDateEstimated && !isGroup && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="Data szacunkowa"></span>}
                                                </div>
                                            </div>
                                            
                                            {!isCompact && (
                                                <div className={`grid grid-cols-2 gap-2 text-[10px] mb-1 pl-6 transition-all duration-300`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-zinc-400 text-[9px] uppercase font-bold">{item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP' ? 'Produkcja' : 'Start'}</span>
                                                        {item.type !== 'SUPPLIER' && item.type !== 'TRANSPORT_GROUP' ? (
                                                            <input type="date" className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 w-full outline-none focus:border-amber-500 p-0 text-[10px] h-4" value={item.prodStart.toISOString().split('T')[0]} onChange={(e) => handleDateChange(item.id, item.type, 'start', e.target.value)} />
                                                        ) : <span className="text-zinc-500 font-mono">{item.prodStart.toLocaleDateString()}</span>}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-zinc-400 text-[9px] uppercase font-bold">{item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP' ? 'Dostawa' : 'Koniec'}</span>
                                                        <input type="date" className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 w-full outline-none focus:border-amber-500 p-0 text-[10px] h-4 font-bold" value={item.delStart.toISOString().split('T')[0]} onChange={(e) => handleDateChange(item.id, item.type, 'end', e.target.value)} disabled={isChild} />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* DEPENDENCY BADGES */}
                                            {incomingDeps.length > 0 && !isCompact && (
                                                <div className="flex flex-wrap gap-1 pl-6">
                                                    {incomingDeps.map(dep => {
                                                        const sourceItem = timelineItems.find(i => i.id === dep.fromId);
                                                        return (
                                                            <div key={dep.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[9px] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 group/badge">
                                                                <Link size={8} />
                                                                <span className="truncate max-w-[80px]">{sourceItem?.name || 'Nieznany'}</span>
                                                                <button 
                                                                    onClick={() => removeDependency(dep.id)}
                                                                    className="ml-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={8}/>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT SCROLLABLE CHART */}
                <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-900/50 relative custom-scrollbar" ref={scrollContainerRef} onScroll={handleScroll}>
                    <div style={{ width: chartWidth, minWidth: '100%', height: innerContentHeight }}>
                        {renderAxis()}
                        {renderDependencies()}
                        <div className="relative">
                            {renderGrid()}
                            {renderMilestones()}
                            {timelineItems.map((item) => {
                                const originalProdLeft = dateToPx(item.prodStart);
                                const originalDelLeft = dateToPx(item.delStart);
                                const prodWidth = Math.max(2, dateToPx(item.prodEnd) - originalProdLeft);
                                const delWidth = Math.max(10, dateToPx(item.delEnd) - originalDelLeft);
                                let renderProdLeft = originalProdLeft;
                                let renderDelLeft = originalDelLeft;
                                let renderProdWidth = prodWidth;

                                if (isDragging === item.id) {
                                    const deltaPx = dragCurrentX - dragStartX;
                                    if (dragType === 'DELIVERY') renderDelLeft += deltaPx;
                                    else if (dragType === 'STAGE_MOVE' || dragType === 'CUSTOM_MOVE') renderProdLeft += deltaPx;
                                    else if (dragType === 'STAGE_RESIZE' || dragType === 'CUSTOM_RESIZE') renderProdWidth = Math.max(20, renderProdWidth + deltaPx);
                                }

                                // 1. Calculate Effective Parent Dates for Rentals Logic
                                let effectiveParentStart = item.start;
                                let effectiveParentEnd = item.end;

                                if (isDragging === item.id) {
                                    const deltaPx = dragCurrentX - dragStartX;
                                    const deltaDays = Math.round(deltaPx / pxPerDay);
                                    
                                    if (dragType === 'STAGE_MOVE' || dragType === 'CUSTOM_MOVE') {
                                        const s = new Date(item.start); s.setDate(s.getDate() + deltaDays);
                                        const e = new Date(item.end); e.setDate(e.getDate() + deltaDays);
                                        effectiveParentStart = s;
                                        effectiveParentEnd = e;
                                    } else if (dragType === 'STAGE_RESIZE' || dragType === 'CUSTOM_RESIZE') {
                                        const e = new Date(item.end); e.setDate(e.getDate() + deltaDays);
                                        effectiveParentEnd = e;
                                    }
                                }

                                // STYLES
                                let barColor = 'bg-blue-400/80 border-blue-500'; // Default Supplier Blue
                                if (item.type === 'STAGE') barColor = 'bg-purple-500 border-purple-600';
                                if (item.type === 'CUSTOM') barColor = 'bg-zinc-500 border-zinc-600';
                                if (item.type === 'TRANSPORT_GROUP') barColor = 'bg-blue-600/20 border-blue-400 border-dashed';
                                if (item.isChild) barColor = 'bg-blue-300/50 border-blue-400/50';

                                const label = item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP' ? 'Produkcja' : item.name;

                                const itemTasks = tasks.filter(t => t.linkedItemId === item.id && t.dueDate);

                                return (
                                    <div 
                                        key={item.id} 
                                        className="relative border-b border-zinc-100 dark:border-zinc-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group" 
                                        style={{ height: ROW_HEIGHT }}
                                        onDoubleClick={(e) => handleGridDoubleClick(e, item)}
                                    >
                                        
                                        {/* Main Bar (Production / Stage / Custom / Group Prod) */}
                                        <div 
                                            className={`absolute top-2 h-5 border rounded shadow-sm flex items-center justify-between z-20 select-none overflow-visible ${barColor} ${item.type !== 'SUPPLIER' && item.type !== 'TRANSPORT_GROUP' ? 'cursor-grab active:cursor-grabbing' : ''}`} 
                                            style={{ left: renderProdLeft, width: renderProdWidth }}
                                            onMouseDown={(e) => {
                                                if (item.type !== 'SUPPLIER' && item.type !== 'TRANSPORT_GROUP') {
                                                    const dType = item.type === 'STAGE' ? 'STAGE_MOVE' : 'CUSTOM_MOVE';
                                                    handleMouseDownItem(e, item.id, dType);
                                                }
                                            }}
                                        >
                                            {/* CONNECTORS DOTS (Parent Items Only) */}
                                            {!item.isChild && (
                                                <>
                                                    <div 
                                                        className="absolute -left-1.5 w-3 h-3 bg-white border-2 border-zinc-400 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-amber-400 hover:scale-125 transition-all z-30"
                                                        onMouseUp={(e) => handleConnectEnd(e, item.id)}
                                                        title="Połącz (Upuść tutaj)"
                                                    ></div>
                                                    <div 
                                                        className="absolute -right-1.5 w-3 h-3 bg-white border-2 border-zinc-400 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 hover:bg-amber-400 hover:scale-125 transition-all z-30"
                                                        onMouseDown={(e) => handleConnectStart(e, item.id)}
                                                        title="Połącz (Przeciągnij)"
                                                    ></div>
                                                </>
                                            )}

                                            <span className={`text-[9px] font-bold ml-1 whitespace-nowrap px-1 truncate ${item.type === 'TRANSPORT_GROUP' ? 'text-zinc-500' : 'text-white'}`}>{label}</span>
                                            {item.type !== 'SUPPLIER' && item.type !== 'TRANSPORT_GROUP' && (
                                                <div 
                                                    className="w-3 h-full bg-black/20 hover:bg-black/40 cursor-ew-resize flex items-center justify-center transition-colors" 
                                                    onMouseDown={(e) => handleMouseDownItem(e, item.id, item.type === 'STAGE' ? 'STAGE_RESIZE' : 'CUSTOM_RESIZE')}
                                                >
                                                    <GripVertical size={8} className="text-white/70"/>
                                                </div>
                                            )}
                                            {item.type === 'CUSTOM' && <div className="absolute right-6 top-0.5 text-[7px] bg-black/30 text-white px-1 rounded">MAN</div>}
                                        </div>

                                        {/* RENTAL SUB-BARS (Attached to Stage) */}
                                        {item.rentals && item.rentals.map((rental: any, rIdx: number) => {
                                            let rStart;
                                            let rEnd;

                                            if (isDragging === item.id && dragType === 'RENTAL_MOVE' && dragSubType === rental.type) {
                                                const deltaPx = dragCurrentX - dragStartX;
                                                const deltaDays = Math.round(deltaPx / pxPerDay);
                                                rStart = new Date(rental.start); 
                                                rStart.setDate(rStart.getDate() + deltaDays);
                                                
                                                if (rStart < effectiveParentStart) rStart = new Date(effectiveParentStart);
                                                
                                                rEnd = addBusinessDays(rStart, rental.days);
                                            } else {
                                                rStart = addBusinessDays(effectiveParentStart, rental.offset);
                                                rEnd = addBusinessDays(rStart, rental.days);
                                            }

                                            if (rEnd > effectiveParentEnd) {
                                                rEnd = effectiveParentEnd;
                                            }

                                            const rentalStartPx = dateToPx(rStart);
                                            const rentalEndPx = dateToPx(rEnd);
                                            const rentalWidthPx = Math.max(5, rentalEndPx - rentalStartPx);

                                            const topOffset = 32 + (rIdx * 12); 

                                            return (
                                                <div
                                                    key={`${item.id}-rental-${rIdx}`}
                                                    className="absolute h-2.5 bg-amber-400 border border-amber-500 rounded-sm shadow-sm z-20 cursor-ew-resize hover:bg-amber-300"
                                                    style={{ left: rentalStartPx, width: rentalWidthPx, top: topOffset }}
                                                    onMouseDown={(e) => handleMouseDownItem(e, item.id, 'RENTAL_MOVE', rental.type)}
                                                    title={`${rental.type === 'forklift' ? 'Wózek' : 'Podnośnik'} (+${rental.offset} dni)`}
                                                >
                                                    <div className="absolute -left-full text-[8px] text-zinc-400 w-full text-right pr-1 opacity-0 group-hover:opacity-100 pointer-events-none">
                                                        {rental.type === 'forklift' ? 'Wózek' : 'Podn.'}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Delivery Bar (Suppliers & Transport Groups Only) */}
                                        {/* For Children suppliers in a group, we hide the delivery bar or make it ghosted to imply it's handled by parent */}
                                        {(item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP') && !item.isChild && (
                                            <div 
                                                className={`absolute bottom-4 h-4 rounded-sm shadow-sm flex items-center cursor-ew-resize z-20 select-none group/del overflow-visible ${item.type === 'TRANSPORT_GROUP' ? 'bg-blue-600 border border-blue-700' : 'bg-green-500 border border-green-600'}`}
                                                style={{ left: renderDelLeft, width: delWidth }} 
                                                onMouseDown={(e) => handleMouseDownItem(e, item.id, 'DELIVERY')} 
                                                title="Dostawa (Przesuń, aby zmienić)"
                                            >
                                                <div 
                                                    className="absolute -right-1.5 w-3 h-3 bg-white border-2 border-zinc-400 rounded-full cursor-crosshair opacity-0 group-hover/del:opacity-100 hover:bg-amber-400 hover:scale-125 transition-all z-30"
                                                    onMouseDown={(e) => handleConnectStart(e, item.id)}
                                                ></div>

                                                <div className="w-full h-full flex items-center justify-center pointer-events-none"><Truck size={10} className="text-white"/></div>
                                            </div>
                                        )}
                                        
                                        {/* Ghost Delivery Bar for Children to show alignment */}
                                        {item.isChild && (
                                            <div 
                                                className="absolute bottom-4 h-4 border border-blue-300/50 bg-blue-100/30 rounded-sm flex items-center z-10 pointer-events-none opacity-50"
                                                style={{ left: renderDelLeft, width: delWidth }} 
                                            ></div>
                                        )}

                                        {/* Connector Line for Suppliers */}
                                        {(item.type === 'SUPPLIER' || item.type === 'TRANSPORT_GROUP') && <div className="absolute top-4 border-l border-b border-zinc-400 dark:border-zinc-500 rounded-bl-md opacity-30 pointer-events-none" style={{ left: renderProdLeft + renderProdWidth, width: Math.max(0, renderDelLeft - (renderProdLeft + renderProdWidth) + 5), height: 14 }}></div>}
                                    
                                        {/* TASK MARKERS */}
                                        {itemTasks.map(task => {
                                            const tDate = new Date(task.dueDate!);
                                            tDate.setHours(0,0,0,0);
                                            if (tDate < minDate || tDate > maxDate) return null;
                                            
                                            const left = dateToPx(tDate);
                                            
                                            return (
                                                <div 
                                                    key={task.id}
                                                    className="absolute top-0 bottom-0 z-30 flex flex-col justify-center items-center group/marker"
                                                    style={{ left: left + (pxPerDay / 2) }}
                                                >
                                                    <div 
                                                        className={`w-3 h-3 rotate-45 border border-white dark:border-zinc-800 shadow-sm transition-transform hover:scale-125 cursor-pointer ${task.isCompleted ? 'bg-green-500' : 'bg-red-500'}`}
                                                        onClick={(e) => handleTaskClick(e, item.id, item.type)}
                                                    ></div>
                                                    
                                                    <div className="absolute bottom-full mb-1 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-zinc-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                                        {task.text}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* RESIZE HANDLE */}
        <div 
            className={`h-4 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700 flex justify-center items-center cursor-row-resize hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0 select-none ${isResizing ? 'bg-amber-100 dark:bg-amber-900/50' : ''}`}
            onMouseDown={handleResizeMouseDown}
        >
            <GripHorizontal size={14} className="text-zinc-400" />
        </div>
    </div>
  );
};
