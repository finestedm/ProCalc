import React, { useState, useEffect, useMemo } from 'react';
import { Truck, ExternalLink, ChevronDown, ChevronRight, RefreshCw, Save, Undo, Redo, Search, Calendar as CalendarIcon, Mail, Map as MapIcon } from 'lucide-react';
import { DatePickerInput } from './DatePickerInput';
import { DeliveryMap } from './DeliveryMap';
import { storageService } from '../services/storage';
import { SavedCalculation, SavedLogisticsTransport } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, CalculationMode, TransportItem, TruckDetail, Supplier, Language } from '../types';
import { GanttChart } from './GanttChart';

import { toISODateString, toEuropeanDateString } from '../services/dateUtils';

interface Props {
    onOpenProject: (data: any, stage: string, mode: CalculationMode) => void;
}

// Helper to calculate suggested weight
const calculateSuggestedWeight = (data: CalculationData, transport: TransportItem) => {
    const supplierIds = transport.isSupplierOrganized && transport.supplierId
        ? [transport.supplierId]
        : transport.linkedSupplierIds || [];

    let totalWeight = 0;
    supplierIds.forEach(sid => {
        const supplier = data.suppliers?.find(s => s.id === sid);
        if (supplier) {
            supplier.items.forEach(item => {
                if (!item.isExcluded) {
                    totalWeight += (item.weight || 0) * (item.quantity || 0);
                }
            });
        }
    });
    return Math.round(totalWeight);
};

// Flattened row for the datagrid
interface HubRow {
    id: string; // Composite ID
    type: 'PROJECT' | 'GROUP' | 'TRUCK';
    parentId?: string; // For TRUCK or GROUP (project) rows

    // Data References
    projectId: string;
    projectNumber: string;
    transportId: string;

    // Display Fields
    customerName: string;
    vendorName: string;
    isSupplierOrganized: boolean;

    // Editable Fields (Synced to TransportItem or TruckDetail)
    loadingDate: string; // Unified field (loadingDates or similar)
    deliveryDate: string;
    driverInfo: string;
    regNumber: string;
    price: number;
    currency: string;
    comments: string;

    // Meta
    originalProject: SavedCalculation; // For "Open Project"
    transportData: TransportItem; // Reference to full object
    truckData?: TruckDetail; // Reference to specific truck if type=TRUCK
    suggestedWeight?: number;
}

export const LogisticsHubView: React.FC<Props> = ({ onOpenProject }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Core Data
    const [projects, setProjects] = useState<SavedCalculation[]>([]);

    // Local State for Edits (The Source of Truth for the UI)
    // We Map: Key = `${projectNumber}|${transportId}` -> TransportItem
    const [localState, setLocalState] = useState<Record<string, TransportItem>>({});

    const handleSendMail = (row: HubRow) => {
        const tItem = row.transportData;
        const calcData = row.originalProject.calc as CalculationData;
        const recipient = calcData?.recipient;
        if (!recipient?.email) {
            alert("Brak adresu email osoby kontaktowej klienta.");
            return;
        }
        const subject = encodeURIComponent(`Informacja o dostawie - ${row.projectNumber}`);
        const body = encodeURIComponent(
            `Dzień dobry ${recipient.contactPerson || ''},\n\n` +
            `Informujemy o zbliżającej się dostawie:\n` +
            `- Ilość naczep: ${tItem.trucksCount || 0}\n` +
            `- Łączna waga: ${calculateSuggestedWeight(calcData, tItem)} kg\n` +
            `- Spodziewana data dostawy: ${toEuropeanDateString(tItem.confirmedDeliveryDate || tItem.pickupDate)}\n\n` +
            `Pozdrawiamy,\n` +
            `Zespół Logistyki`
        );
        window.location.href = `mailto:${recipient.email}?subject=${subject}&body=${body}`;
    };

    // History for Undo/Redo
    const [history, setHistory] = useState<Record<string, TransportItem>[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // UI State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
    const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
    const [filterText, setFilterText] = useState('');
    const [showGantt, setShowGantt] = useState(true);
    const [showMap, setShowMap] = useState(false);

    // --- LOAD DATA ---
    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Projects
            const allProjects = await storageService.getCalculations();

            // Filter detailed: Group by project_id, pick latest OPENING
            const latestProjectsMap: Record<string, SavedCalculation> = {};
            allProjects.forEach(p => {
                // [MODIFIED] Use ID fallback to avoid collapsing "BezNumeru" projects together
                const pid = p.project_id || p.id;

                let fullFile = p.calc as any;
                if (!fullFile && (p as any).details?.calc) {
                    fullFile = (p as any).details.calc;
                }

                if (!fullFile) {
                    return;
                }

                // [MODIFIED] Prefer DB column for stage source of truth
                const stage = p.project_stage || fullFile.stage || fullFile.appState?.stage;
                if (stage !== 'OPENING') return;

                if (!latestProjectsMap[pid] || new Date(p.created_at) > new Date(latestProjectsMap[pid].created_at)) {
                    latestProjectsMap[pid] = p;
                }
            });
            const projectList = Object.values(latestProjectsMap);
            setProjects(projectList);

            // 2. Get Relational Transports
            const savedTransports = await storageService.getLogisticsTransports();

            // 3. Initialize Local State
            const initialState: Record<string, TransportItem> = {};

            // 3a. Start with what's in the relational DB
            savedTransports.forEach(st => {
                const key = `${st.project_number}|${st.transport_id}`;
                const tItem = { ...st.data };
                if (!tItem.trucks) tItem.trucks = [];
                initialState[key] = tItem;
            });

            // 3b. Add transports from project blobs that aren't in Relational DB yet
            projectList.forEach(p => {
                const pNum = p.project_id || 'BezNumeru';
                const calc = p.calc as CalculationData;
                const appState = (calc as any).appState;
                const activeData = appState ? (appState.mode === 'FINAL' ? appState.final : appState.initial) : calc;

                if (activeData.transport) {
                    activeData.transport.forEach((t: TransportItem) => {
                        const key = `${pNum}|${t.id}`;
                        if (!initialState[key]) {
                            const tItem = { ...t };
                            if (!tItem.trucks) tItem.trucks = [];
                            initialState[key] = tItem;
                        }
                    });
                }
            });

            setLocalState(initialState);
            setHistory([initialState]);
            setHistoryIndex(0);

        } catch (e) {
            console.error("Hub Load Error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // --- UNDO / REDO ---
    const updateState = (newState: Record<string, TransportItem>) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newState);
        if (newHistory.length > 50) newHistory.shift();

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLocalState(newState);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setLocalState(history[historyIndex - 1]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setLocalState(history[historyIndex + 1]);
        }
    };

    // --- UPDATE HANDLERS ---

    const handleUpdateTransport = (projectNumber: string, transportId: string, updates: Partial<TransportItem>) => {
        const key = `${projectNumber}|${transportId}`;
        const current = localState[key];
        if (!current) return;

        const updated = { ...current, ...updates };

        // 1. Validation: Delivery date cannot be before loading date
        const finalPickup = updates.pickupDate || current.pickupDate;
        const finalDelivery = updates.confirmedDeliveryDate || current.confirmedDeliveryDate;

        if (finalPickup && finalDelivery && new Date(finalDelivery) < new Date(finalPickup)) {
            if (updates.confirmedDeliveryDate) {
                updated.confirmedDeliveryDate = finalPickup;
            } else if (updates.pickupDate) {
                updated.pickupDate = finalDelivery;
            }
        }

        // 2. Propagation: Update all trucks when summary dates change
        if (updates.confirmedDeliveryDate || updates.pickupDate) {
            updated.trucks = updated.trucks?.map(t => ({
                ...t,
                loadingDates: updated.pickupDate || t.loadingDates,
                deliveryDate: updated.confirmedDeliveryDate || t.deliveryDate
            }));
        }

        const nextState = { ...localState, [key]: updated };
        updateState(nextState);
    };

    const handleUpdateTruck = (projectNumber: string, transportId: string, truckId: string, updates: Partial<TruckDetail>) => {
        const key = `${projectNumber}|${transportId}`;
        const current = localState[key];
        if (!current) return;

        const newTrucks = (current.trucks || []).map(t => {
            if (t.id !== truckId) return t;
            const updated = { ...t, ...updates };

            // Validation: Delivery date cannot be before loading date
            if (updated.loadingDates && updated.deliveryDate && new Date(updated.deliveryDate) < new Date(updated.loadingDates)) {
                if (updates.deliveryDate) updated.deliveryDate = updated.loadingDates;
                else if (updates.loadingDates) updated.loadingDates = updated.deliveryDate;
            }
            return updated;
        });

        const nextState = { ...localState, [key]: { ...current, trucks: newTrucks } };
        updateState(nextState);
    };

    const handleUpdateTruckCount = (projectNumber: string, transportId: string, newCount: number) => {
        const key = `${projectNumber}|${transportId}`;
        const current = localState[key];
        if (!current) return;

        let newTrucks = [...(current.trucks || [])];
        if (newCount > newTrucks.length) {
            for (let i = newTrucks.length; i < newCount; i++) {
                newTrucks.push({
                    id: Math.random().toString(36).substr(2, 9),
                    loadingDates: current.pickupDate || '',
                    deliveryDate: current.confirmedDeliveryDate || '',
                    driverInfo: '',
                    registrationNumbers: ''
                });
            }
        } else {
            newTrucks = newTrucks.slice(0, newCount);
        }

        const nextState = {
            ...localState,
            [key]: { ...current, trucksCount: newCount, trucks: newTrucks }
        };
        updateState(nextState);
    };

    // --- SAVE LOGIC ---
    const handleSave = async () => {
        setSaving(true);
        try {
            const entries = Object.entries(localState) as [string, TransportItem][];
            const tasks = entries.map(async ([key, item]) => {
                const [pNum, tId] = key.split('|');

                await storageService.saveLogisticsTransport({
                    project_number: pNum,
                    transport_id: tId,
                    data: item,
                    delivery_date: item.isSupplierOrganized ? item.confirmedDeliveryDate : item.pickupDate,
                    pickup_date: item.pickupDate,
                    carrier: item.carrier,
                    supplier_id: item.supplierId
                });
            });

            await Promise.all(tasks);
            // Alert removed as per user request
        } catch (e) {
            console.error("Save failed", e);
            alert("Błąd zapisu!");
        } finally {
            setSaving(false);
        }
    };

    // --- OPEN PROJECT LOGIC ---
    const handleOpenProjectWithSync = (originalProject: SavedCalculation) => {
        const pNum = originalProject.project_id || 'BezNumeru';
        if (pNum === 'BezNumeru') {
            onOpenProject(originalProject.calc, 'OPENING', (originalProject.calc as any).appState?.mode || 'INITIAL');
            return;
        }

        const projectData = JSON.parse(JSON.stringify(originalProject.calc));
        const activeData = projectData.appState ? projectData.appState.initial : projectData;

        // Forced Sync Logic: Merge Transport Items AND Propagate dates to Suppliers
        if (activeData.transport) {
            activeData.transport = activeData.transport.map((t: TransportItem) => {
                const key = `${pNum}|${t.id}`;
                const override = localState[key];
                if (override) {
                    const merged = { ...t, ...override };

                    // Propagate date to linked suppliers
                    const targetDate = merged.isSupplierOrganized ? merged.confirmedDeliveryDate : merged.pickupDate;
                    if (targetDate && activeData.suppliers) {
                        const linkedIds = merged.isSupplierOrganized && merged.supplierId
                            ? [merged.supplierId]
                            : (merged.linkedSupplierIds || []);

                        activeData.suppliers = activeData.suppliers.map((s: Supplier) => {
                            if (linkedIds.includes(s.id)) {
                                return { ...s, deliveryDate: targetDate };
                            }
                            return s;
                        });
                    }
                    return merged;
                }
                return t;
            });
        }

        onOpenProject(projectData, 'OPENING', (projectData.appState as any)?.mode || 'INITIAL');
    };

    // --- GANTT AGGREGATION ---
    const ganttData = useMemo(() => {
        const allSuppliers: Supplier[] = [];
        const allTransport: TransportItem[] = [];
        let combinedMeta = { projectNumber: 'HUB', customerName: 'Wszystkie Projekty', orderDate: new Date().toISOString() };

        const projMap = new Map<string, SavedCalculation>(projects.map(p => [p.project_id || 'BezNumeru', p]));

        const entries = Object.entries(localState) as [string, TransportItem][];
        entries.forEach(([key, tItem]) => {
            const [pNum] = key.split('|');
            const project = projMap.get(pNum);
            if (!project || hiddenProjectIds.has(project.id)) return;

            const calcData = project.calc as CalculationData;
            const appState = (calcData as any).appState;
            const activeData = (appState ? (appState.mode === 'FINAL' ? appState.final : appState.initial) : calcData) as CalculationData;
            const projectSuppliers = activeData.suppliers || [];

            // Apply override logic for Gantt too
            // [MODIFIED] Always include the direct supplierId for single transports
            const linkedIds = tItem.linkedSupplierIds || [];
            if (tItem.supplierId) {
                linkedIds.push(tItem.supplierId);
            }

            const targetDate = tItem.isSupplierOrganized ? tItem.confirmedDeliveryDate : tItem.pickupDate;

            const processedSuppliers = projectSuppliers.filter(s => linkedIds.includes(s.id)).map(s => {
                return {
                    ...s,
                    name: `[${pNum}] ${s.name}`,
                    deliveryDate: targetDate ? targetDate : s.deliveryDate
                };
            });

            const recipient = activeData.recipient;
            allSuppliers.push(...processedSuppliers);
            allTransport.push({
                ...tItem,
                name: `[${pNum}] ${tItem.name || 'Transport'}`,
                projectNumber: pNum, // Attach project metadata
                contactPerson: recipient?.contactPerson,
                contactEmail: recipient?.email
            } as any);
        });

        // [NEW] Sort by Project Number then by date
        allTransport.sort((a, b) => {
            if ((a as any).projectNumber !== (b as any).projectNumber) {
                return ((a as any).projectNumber || '').localeCompare((b as any).projectNumber || '');
            }
            const da = a.confirmedDeliveryDate || a.pickupDate || '9999-99-99';
            const db = b.confirmedDeliveryDate || b.pickupDate || '9999-99-99';
            return da.localeCompare(db);
        });

        // Re-order suppliers to match their transport order if possible
        // (GanttChart will match them via processed IDs anyway, but sorting transport is primary)

        // Use earliest order date found as base
        const orderDates = projects.map(p => (p.calc as any).meta?.orderDate).filter(Boolean);
        if (orderDates.length > 0) {
            combinedMeta.orderDate = orderDates.sort()[0];
        }

        return {
            suppliers: allSuppliers,
            transport: allTransport,
            meta: combinedMeta,
            installation: { stages: [] } // Hub gantt focuses on delivery for now
        };
    }, [projects, localState, hiddenProjectIds]);

    const deliveryMapData = useMemo(() => {
        const data: any[] = [];
        const projMap = new Map<string, SavedCalculation>(projects.map(p => [p.project_id || 'BezNumeru', p]));

        const entries = Object.entries(localState) as [string, TransportItem][];
        entries.forEach(([key, tItem]) => {
            const [pNum] = key.split('|');
            const project = projMap.get(pNum);
            if (!project || hiddenProjectIds.has(project.id)) return;

            // Robust data extraction
            const rawCalc = project.calc as any;
            if (!rawCalc) return;

            let activeData: CalculationData | null = null;

            // Case 1: Wrapped in ProjectFile (appState)
            if (rawCalc.appState) {
                const mode = rawCalc.appState.mode || 'INITIAL';
                activeData = mode === 'FINAL' ? rawCalc.appState.final : rawCalc.appState.initial;
            }
            // Case 2: Wrapped in AppState directly
            else if (rawCalc.initial || rawCalc.final) {
                const mode = rawCalc.mode || 'INITIAL';
                activeData = mode === 'FINAL' ? rawCalc.final : rawCalc.initial;
            }
            // Case 3: CalculationData directly
            else if (rawCalc.recipient || rawCalc.orderingParty || rawCalc.payer) {
                activeData = rawCalc;
            }

            if (!activeData) return;

            // Try different address sources (Recipient is priority, then Ordering Party, then Payer)
            const getAddr = (addr: any) => {
                if (!addr) return null;
                // Exclude 'name' from geocoding string to avoid confusing the search engine with person names
                const parts = [addr.street, addr.zip, addr.city].filter(Boolean);
                return parts.length > 0 ? parts.join(', ') : null;
            };

            const address = getAddr(activeData.recipient);

            if (!address) return;

            const targetDate = tItem.isSupplierOrganized ? tItem.confirmedDeliveryDate : tItem.pickupDate;

            // Get supplier names
            const linkedIds = tItem.linkedSupplierIds || [];
            if (tItem.supplierId) linkedIds.push(tItem.supplierId);
            const suppliers = (activeData.suppliers || [])
                .filter((s: any) => linkedIds.includes(s.id))
                .map((s: any) => s.name);

            data.push({
                projectId: project.id,
                projectNumber: pNum,
                customerName: project.customer_name || activeData.orderingParty?.name || activeData.recipient?.name || 'Klient',
                address,
                deliveryDate: targetDate ? toEuropeanDateString(targetDate) : 'Nie ustalono',
                suppliers: suppliers.length > 0 ? suppliers : ['Własny']
            });
        });
        return data;
    }, [projects, localState, hiddenProjectIds]);

    // --- DISPLAY MODEL ---
    const gridRows = useMemo(() => {
        const projMap = new Map<string, SavedCalculation>(projects.map(p => [p.project_id || 'BezNumeru', p]));
        const projectGroups: Record<string, HubRow[]> = {};

        const entries = Object.entries(localState) as [string, TransportItem][];
        entries.forEach(([key, tItem]) => {
            const [pNum, tId] = key.split('|');
            const project = projMap.get(pNum);

            if (!project || hiddenProjectIds.has(project.id)) return;
            if (filterText && !pNum.toLowerCase().includes(filterText.toLowerCase()) &&
                !(project.customer_name || '').toLowerCase().includes(filterText.toLowerCase())) return;

            const calcData = project.calc as CalculationData;
            let vendor = 'Nieznany';
            if (tItem.isSupplierOrganized && tItem.supplierId) {
                vendor = calcData.suppliers?.find(s => s.id === tItem.supplierId)?.name || 'Dostawca';
            } else if (tItem.name) {
                vendor = tItem.name;
            } else {
                vendor = 'Transport Własny';
            }

            if (!projectGroups[pNum]) projectGroups[pNum] = [];

            projectGroups[pNum].push({
                id: key,
                type: 'GROUP',
                projectId: project.id,
                projectNumber: pNum,
                transportId: tId,
                customerName: project.customer_name || 'Klient',
                vendorName: vendor,
                isSupplierOrganized: tItem.isSupplierOrganized,
                loadingDate: tItem.pickupDate || '',
                deliveryDate: tItem.isSupplierOrganized ? tItem.confirmedDeliveryDate || '' : tItem.pickupDate || '',
                driverInfo: '',
                regNumber: '',
                price: tItem.confirmedPrice || tItem.totalPrice,
                currency: tItem.currency,
                comments: '',
                originalProject: project,
                transportData: tItem,
                suggestedWeight: calculateSuggestedWeight(calcData, tItem)
            });
        });

        const finalRows: HubRow[] = [];

        // Sort projects alphabetically
        const sortedProjectNumbers = Object.keys(projectGroups).sort((a, b) => a.localeCompare(b));

        sortedProjectNumbers.forEach(pNum => {
            const transports = projectGroups[pNum].sort((a, b) => {
                const da = a.deliveryDate || a.loadingDate || '9999-99-99';
                const db = b.deliveryDate || b.loadingDate || '9999-99-99';
                return da.localeCompare(db);
            });

            const isCollapsed = collapsedProjects.has(pNum);
            const firstT = transports[0];

            // Add Project Summary Row
            finalRows.push({
                ...firstT,
                id: `PROJECT|${pNum}`,
                type: 'PROJECT',
                vendorName: `${transports.length} transport(y)`,
                price: transports.reduce((sum, t) => sum + (t.transportData.confirmedPrice || t.transportData.totalPrice), 0),
                suggestedWeight: transports.reduce((sum, t) => sum + (t.suggestedWeight || 0), 0)
            });

            if (!isCollapsed) {
                transports.forEach(tRow => {
                    finalRows.push(tRow);
                    if (expandedGroups.has(tRow.id)) {
                        (tRow.transportData.trucks || []).forEach((truck, idx) => {
                            finalRows.push({
                                id: `${tRow.id}|${truck.id}`,
                                type: 'TRUCK',
                                parentId: tRow.id,
                                projectId: tRow.projectId,
                                projectNumber: pNum,
                                transportId: tRow.transportId,
                                customerName: '',
                                vendorName: `Auto #${idx + 1}`,
                                isSupplierOrganized: tRow.isSupplierOrganized,
                                loadingDate: truck.loadingDates || '',
                                deliveryDate: truck.deliveryDate || '',
                                driverInfo: truck.driverInfo || '',
                                regNumber: truck.registrationNumbers || '',
                                price: 0,
                                currency: tRow.currency,
                                comments: truck.notes || '',
                                originalProject: tRow.originalProject,
                                transportData: tRow.transportData,
                                truckData: truck
                            });
                        });
                    }
                });
            }
        });

        return finalRows;
    }, [projects, localState, hiddenProjectIds, filterText, expandedGroups, collapsedProjects]);

    const toggleExpand = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            const isExpanding = !next.has(id);

            if (isExpanding) {
                // Auto-initialize trucks if they don't exist but trucksCount > 0
                const [pNum, tId] = id.split('|');
                const tItem = localState[id];

                if (tItem && tItem.trucksCount > 0 && (!tItem.trucks || tItem.trucks.length < tItem.trucksCount)) {
                    let newTrucks = [...(tItem.trucks || [])];
                    for (let i = newTrucks.length; i < tItem.trucksCount; i++) {
                        newTrucks.push({
                            id: Math.random().toString(36).substr(2, 9),
                            loadingDates: tItem.pickupDate || '',
                            deliveryDate: tItem.confirmedDeliveryDate || '',
                            driverInfo: '',
                            registrationNumbers: ''
                        });
                    }

                    // Update localState immediately
                    setLocalState(curr => ({
                        ...curr,
                        [id]: { ...tItem, trucks: newTrucks }
                    }));
                }

                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const toggleProjectCollapse = (pNum: string) => {
        setCollapsedProjects(prev => {
            const next = new Set(prev);
            if (next.has(pNum)) next.delete(pNum);
            else next.add(pNum);
            return next;
        });
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-400">Ładowanie Hubu Logistycznego...</div>;

    return (
        <div className="p-6 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <Truck className="text-blue-500" size={36} />
                        Globalny Hub Logistyczny
                    </h1>
                    <p className="text-zinc-500 mt-2">Zarządzaj flotą, kierowcami i terminami dla wszystkich projektów.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-colors"
                        title="Cofnij (Undo)"
                    >
                        <Undo size={20} />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-colors"
                        title="Ponów (Redo)"
                    >
                        <Redo size={20} />
                    </button>
                    <div className="w-4" />
                    <button
                        onClick={() => setShowGantt(!showGantt)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs ${showGantt ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-white dark:bg-zinc-900 border border-zinc-200 text-zinc-500'}`}
                    >
                        <CalendarIcon size={18} /> {showGantt ? 'Ukryj Wykres' : 'Pokaż Wykres'}
                    </button>
                    <button
                        onClick={() => setShowMap(!showMap)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs ${showMap ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white dark:bg-zinc-900 border border-zinc-200 text-zinc-500'}`}
                    >
                        <MapIcon size={18} /> {showMap ? 'Ukryj Mapę' : 'Pokaż Mapę'}
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
                        title="Odśwież dane z serwera"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 disabled:opacity-70 transition-all"
                    >
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                    </button>
                </div>
            </div>

            <div className="mb-6 flex gap-4 flex-wrap items-center">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        placeholder="Szukaj projektu / klienta..."
                        className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                </div>

                <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700 mx-2" />

                <div className="flex gap-2 flex-wrap">
                    {projects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => {
                                const newHidden = new Set(hiddenProjectIds);
                                if (newHidden.has(p.id)) newHidden.delete(p.id);
                                else newHidden.add(p.id);
                                setHiddenProjectIds(newHidden);
                            }}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${hiddenProjectIds.has(p.id)
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-400'
                                : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                                }`}
                        >
                            {p.project_id || 'Bez Numeru'}
                        </button>
                    ))}
                </div>
            </div>

            {/* GANTT SECTION */}
            {showGantt && (ganttData.suppliers.length > 0 || ganttData.transport.length > 0) && (
                <div className="mb-8 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                            <CalendarIcon size={14} /> Harmonogram Dostaw (Globalny)
                        </span>
                    </div>
                    <div className="flex-1 min-h-[400px]">
                        <GanttChart
                            suppliers={ganttData.suppliers}
                            transport={ganttData.transport}
                            meta={ganttData.meta as any}
                            installation={ganttData.installation as any}
                            onUpdateInstallation={() => { }}
                            onUpdateSupplier={() => { }}
                            readOnly={true}
                            canEditPlanning={profile?.role === 'logistics'}
                            expandedGroupsProp={expandedGroups}
                            onToggleGroup={toggleExpand}
                        />
                    </div>
                </div>
            )}

            {/* MAP SECTION */}
            {showMap && (
                <div className="mb-8 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                            <MapIcon size={14} /> Mapa Miejsc Docelowych Dostaw
                        </span>
                        <div className="text-[10px] text-zinc-400 font-medium">
                            {deliveryMapData.length > 0 ? `Pokazano ${deliveryMapData.length} lokalizacji` : 'Brak lokalizacji do wyświetlenia'}
                        </div>
                    </div>
                    <div className="p-4">
                        {deliveryMapData.length > 0 ? (
                            <DeliveryMap deliveries={deliveryMapData} />
                        ) : (
                            <div className="h-[200px] flex flex-col items-center justify-center text-zinc-400 gap-2 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-lg">
                                <Search size={24} />
                                <p className="text-sm">Nie znaleziono projektów z danymi adresowymi do wyświetlenia na mapie.</p>
                                <p className="text-[10px]">Upewnij się, że odbiorca projektu ma wpisane miasto lub ulicę.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DATAGRID */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-4 py-3 w-10"></th>
                                <th className="px-4 py-3">Projekt / Klient</th>
                                <th className="px-4 py-3">Dostawca / Typ</th>
                                <th className="px-4 py-3">Data Załadunku</th>
                                <th className="px-4 py-3">Data Dostawy</th>
                                <th className="px-4 py-3">Kierowca / Dane</th>
                                <th className="px-4 py-3">Rejestracja</th>
                                <th className="px-4 py-3 w-32">Firma Transp.</th>
                                <th className="px-4 py-3 w-32">Komentarz</th>
                                <th className="px-4 py-3 text-right">Opcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {gridRows.map((row) => {
                                const isProject = row.type === 'PROJECT';
                                const isGroup = row.type === 'GROUP';
                                const isTruck = row.type === 'TRUCK';

                                if (isProject) {
                                    const isCollapsed = collapsedProjects.has(row.projectNumber);
                                    return (
                                        <tr key={row.id} className="bg-zinc-100/80 dark:bg-zinc-800/80 border-l-4 border-l-zinc-400 group">
                                            <td className="px-4 py-1.5 text-center">
                                                <button onClick={() => toggleProjectCollapse(row.projectNumber)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-600">
                                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-1.5">
                                                <div className="font-black text-[12px] text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">{row.projectNumber}</div>
                                                <div className="text-[9px] font-bold text-zinc-500 truncate max-w-[200px] leading-tight">{row.customerName}</div>
                                            </td>
                                            <td className="px-4 py-1.5" colSpan={5}>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{row.vendorName}</span>
                                                    {isCollapsed && (
                                                        <span className="text-[9px] bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400 font-mono">
                                                            Suma: {row.suggestedWeight.toLocaleString()} kg
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-1.5 text-right" colSpan={3}>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 font-mono">
                                                        {row.price > 0 ? row.price.toLocaleString() : '-'} {row.currency}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                if (isGroup) {
                                    const tItem = row.transportData;
                                    const isExpanded = expandedGroups.has(row.id);
                                    const isSuppLayer = row.isSupplierOrganized;

                                    return (
                                        <tr key={row.id} className={`transition-colors group border-l-4 border-zinc-200 dark:border-zinc-700 ${isSuppLayer
                                            ? 'bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50/60 dark:hover:bg-amber-900/20'
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                                            }`}>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => toggleExpand(row.id)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400">
                                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 pl-12 relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-px bg-zinc-300 dark:bg-zinc-600"></div>
                                                <div className="text-[11px] font-bold text-zinc-400">{row.projectNumber}</div>
                                                <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">{row.customerName}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`font-bold text-xs truncate max-w-[150px] ${isSuppLayer ? 'text-amber-600' : 'text-blue-600'}`}>{row.vendorName}</div>
                                                <div className="flex gap-2 items-center mt-1 text-[9px] uppercase font-bold text-zinc-400">
                                                    {isSuppLayer ? 'Dostawca' : 'JH Logistyka'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <DatePickerInput
                                                    className="bg-transparent border-b border-zinc-200 dark:border-zinc-800 px-1 py-0.5 text-xs w-28 outline-none focus:border-blue-500"
                                                    value={tItem.pickupDate || ''}
                                                    onChange={(val) => handleUpdateTransport(row.projectNumber, row.transportId, { pickupDate: val })}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <DatePickerInput
                                                    className="bg-transparent border-b border-zinc-200 dark:border-zinc-800 px-1 py-0.5 text-xs w-28 outline-none focus:border-blue-500"
                                                    value={tItem.confirmedDeliveryDate || ''}
                                                    onChange={(val) => handleUpdateTransport(row.projectNumber, row.transportId, { confirmedDeliveryDate: val })}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-zinc-400 italic" colSpan={3}>
                                                <div className="flex items-center gap-2 opacity-50">
                                                    <Truck size={12} /> {tItem.trucksCount} aut(a) - rozwiń do edycji
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="text-right mr-2 flex flex-col items-end">
                                                    <div className="text-[9px] text-zinc-400 font-mono italic">Sugerowana: {tItem.totalPrice > 0 ? tItem.totalPrice.toLocaleString() : '-'} {tItem.currency}</div>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="Cena potw."
                                                            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] w-20 font-bold outline-none focus:border-blue-500"
                                                            value={tItem.confirmedPrice || ''}
                                                            onChange={(e) => handleUpdateTransport(row.projectNumber, row.transportId, { confirmedPrice: parseFloat(e.target.value) || 0 })}
                                                        />
                                                        <span className="text-[10px] font-bold">{tItem.currency}</span>
                                                    </div>
                                                    <div className="text-[9px] text-zinc-400 font-mono italic mt-0.5">{row.suggestedWeight?.toLocaleString()} kg</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1 items-center">
                                                    <button onClick={() => handleSendMail(row)} className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600 rounded-lg border border-transparent hover:border-amber-200" title="Wyślij powiadomienie">
                                                        <Mail size={16} />
                                                    </button>
                                                    <button onClick={() => handleOpenProjectWithSync(row.originalProject)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg border border-transparent hover:border-blue-200" title="Otwórz projekt">
                                                        <ExternalLink size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                } else {
                                    const truck = row.truckData;
                                    if (!truck) return null;
                                    return (
                                        <tr key={row.id} className="bg-zinc-50/50 dark:bg-zinc-900/30 border-l-4 border-l-blue-400">
                                            <td className="px-4 py-2 text-center">
                                                <button onClick={() => handleUpdateTruckCount(row.projectNumber, row.transportId, Math.max(0, row.transportData.trucksCount - 1))} className="text-red-400 hover:text-red-600 text-[10px] uppercase font-bold px-2">Usuń</button>
                                            </td>
                                            <td className="px-4 py-2 text-center" colSpan={2}>
                                                <span className="text-[10px] font-bold text-blue-500 uppercase bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                                    <Truck size={10} /> {row.vendorName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <DatePickerInput className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-28 outline-none" value={truck.loadingDates || ''} onChange={(val) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { loadingDates: val })} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <DatePickerInput className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-28 outline-none" value={truck.deliveryDate || ''} onChange={(val) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { deliveryDate: val })} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-full outline-none" value={truck.driverInfo || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { driverInfo: e.target.value })} placeholder="Kierowca / Tel" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-28 uppercase font-mono outline-none" value={truck.registrationNumbers || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { registrationNumbers: e.target.value })} placeholder="Rejestracja" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-full outline-none" value={truck.transportCompany || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { transportCompany: e.target.value })} placeholder="Firma" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-full outline-none" value={truck.notes || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { notes: e.target.value })} placeholder="Komentarz" />
                                            </td>
                                            <td className="px-4 py-2 text-right"></td>
                                        </tr>
                                    );
                                }
                            })}
                            {gridRows.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-zinc-400">Brak danych.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
