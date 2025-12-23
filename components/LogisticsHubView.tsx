import React, { useState, useEffect, useMemo } from 'react';
import { Truck, ExternalLink, ChevronDown, ChevronRight, RefreshCw, Save, Undo, Redo, Search, Calendar as CalendarIcon, Mail, Map as MapIcon, UserPlus, UserCheck, Lock, Trash2, PlusCircle } from 'lucide-react';
import { DatePickerInput } from './DatePickerInput';
import { DeliveryMap } from './DeliveryMap';
import { storageService } from '../services/storage';
import { SavedCalculation, SavedLogisticsTransport } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, CalculationMode, TransportItem, TruckDetail, Supplier, Language, Currency } from '../types';
import { GanttChart } from './GanttChart';
import { OrderPreviewModal } from './OrderPreviewModal';

import { toISODateString, toEuropeanDateString } from '../services/dateUtils';
import { extractActiveData } from '../services/calculationService';

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

// Helper to extract clean address for map/gantt
const getGeocodingAddress = (addr: any) => {
    if (!addr) return null;
    // Exclude 'name' from geocoding string to avoid confusing the search engine with person names
    const parts = [addr.street, addr.zip, addr.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
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
    contactPerson?: string;
    contactEmail?: string;
    isStale?: boolean;
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

    const [previewSuppliers, setPreviewSuppliers] = useState<Supplier[] | null>(null);
    const [previewProject, setPreviewProject] = useState<CalculationData | null>(null);
    const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
    const [assigningSuppliersKey, setAssigningSuppliersKey] = useState<string | null>(null);

    const handleOpenOrderPreview = (row: HubRow) => {
        const item = row.transportData;
        const activeData = extractActiveData(row.originalProject.calc);

        if (!activeData) {
            alert("Nie udało się wyodrębnić danych kalkulacji.");
            return;
        }

        // Find suppliers linked to this transport
        const linkedIds = item.linkedSupplierIds || [];
        if (item.supplierId) linkedIds.push(item.supplierId);

        const suppliersToPreview = (activeData.suppliers || []).filter(s => linkedIds.includes(s.id));

        if (suppliersToPreview.length === 0) {
            alert("Ten transport nie jest powiązany z żadnym dostawcą w kalkulacji.");
            return;
        }

        setPreviewProject(activeData);
        setPreviewSuppliers(suppliersToPreview);
    };

    const handleSendDeliveryConfirmation = (row: HubRow) => {
        if (!row.contactEmail) {
            alert("Brak adresu email osoby kontaktowej klienta dla tego projektu.");
            return;
        }

        const transportName = row.transportData.name || 'Transport';
        const subject = encodeURIComponent(`Informacja o dostawie - [${row.projectNumber}] ${transportName}`);
        const body = encodeURIComponent(
            `Dzień dobry ${row.contactPerson || ''},\n\n` +
            `Informujemy o zbliżającej się dostawie dla projektu ${row.projectNumber}:\n` +
            `- Ilość naczep: ${row.transportData.trucksCount || 0}\n` +
            `- Łączna waga: ${row.suggestedWeight || 0} kg\n` +
            `- Spodziewana data dostawy: ${row.deliveryDate || 'Nie ustalono'}\n\n` +
            `Pozdrawiamy,\n` +
            `Zespół Logistyki`
        );
        window.location.href = `mailto:${row.contactEmail}?subject=${subject}&body=${body}`;
    };

    const handleTakeOverProject = async (project: SavedCalculation) => {
        if (!profile?.id) return;
        if (project.logistics_operator_id && String(project.logistics_operator_id) === String(profile.id)) {
            // Already taken over by me - maybe unlock?
            if (confirm("Jesteś już operatorem tego projektu. Czy chcesz go ODDAĆ (odblokować dla specjalistów)?")) {
                try {
                    await storageService.updateLogisticsOperator(project.id, null);
                    await storageService.lockProject(project.id, false);
                    loadData();
                } catch (e) {
                    alert("Błąd zmiany statusu.");
                }
            }
            return;
        }

        if (confirm("Czy chcesz przejąć ten projekt? Zostanie on ZABLOKOWANY do edycji dla specjalistów/inżynierów.")) {
            try {
                await storageService.updateLogisticsOperator(project.id, profile.id);
                await storageService.lockProject(project.id, true);
                loadData();
            } catch (e) {
                alert("Błąd przejmowania projektu.");
            }
        }
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
    const [showOnlyMine, setShowOnlyMine] = useState(false);

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
            const validTransportKeys = new Set<string>();

            // 3a. Start with what's in the relational DB
            savedTransports.forEach(st => {
                const key = `${st.project_number}|${st.transport_id}`;
                const tItem = { ...st.data };
                if (!tItem.trucks) tItem.trucks = [];
                initialState[key] = tItem;
            });

            // 3b. Add transports from project blobs that aren't in Relational DB yet
            // AND track which ones are currently valid (present in latest project version)
            projectList.forEach(p => {
                const pNum = p.project_id || 'BezNumeru';
                const calc = p.calc as CalculationData;
                const appState = (calc as any).appState;
                const activeData = appState ? (appState.mode === 'FINAL' ? appState.final : appState.initial) : calc;

                if (activeData.transport) {
                    activeData.transport.forEach((t: TransportItem) => {
                        const key = `${pNum}|${t.id}`;
                        validTransportKeys.add(key);
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

            // Store valid keys for stale detection
            (window as any)._validTransportKeys = validTransportKeys;

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

    const handleDeleteTransport = (projectNumber: string, transportId: string) => {
        const key = `${projectNumber}|${transportId}`;
        /* [TIP] We don't delete from localState immediately to avoid UI jumps if user undoes, 
           but for simplicity let's just delete and track in deletedKeys */
        if (confirm(`Czy na pewno chcesz usunąć ten transport (${transportId})?`)) {
            const nextState = { ...localState };
            delete nextState[key];
            setLocalState(nextState);
            setDeletedKeys(prev => new Set(prev).add(key));

            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(nextState);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    };

    const handleAddTransport = (project: SavedCalculation) => {
        const pNum = project.project_id || 'BezNumeru';
        const newId = `manual-${Math.random().toString(36).substr(2, 5)}`;
        const key = `${pNum}|${newId}`;

        const newItem: TransportItem = {
            id: newId,
            name: 'Nowy Transport',
            trucksCount: 1,
            trucks: [{
                id: Math.random().toString(36).substr(2, 9),
                loadingDates: '',
                deliveryDate: '',
                driverInfo: '',
                registrationNumbers: ''
            }],
            pickupDate: '',
            confirmedDeliveryDate: '',
            isSupplierOrganized: false,
            isOrmCalc: false,
            pricePerTruck: 0,
            totalPrice: 0,
            currency: Currency.EUR
        };

        const nextState = { ...localState, [key]: newItem };
        updateState(nextState);
        setExpandedGroups(prev => new Set(prev).add(key));
    };

    const handleToggleSupplierLink = (projectNumber: string, transportId: string, supplierId: string) => {
        const key = `${projectNumber}|${transportId}`;
        const current = localState[key];
        if (!current) return;

        let linked = [...(current.linkedSupplierIds || [])];
        if (current.supplierId) linked.push(current.supplierId);
        linked = Array.from(new Set(linked)); // Clean duplicates

        if (linked.includes(supplierId)) {
            linked = linked.filter(id => id !== supplierId);
        } else {
            linked.push(supplierId);
        }

        const nextState = {
            ...localState,
            [key]: {
                ...current,
                supplierId: undefined, // Always use linkedSupplierIds for multi-link
                linkedSupplierIds: linked
            }
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

            // Handle deletions
            const deleteTasks = Array.from(deletedKeys).map(async (keyStr) => {
                const [pNum, tId] = (keyStr as string).split('|');
                await storageService.deleteLogisticsTransport(pNum, tId);
            });
            await Promise.all(deleteTasks);
            setDeletedKeys(new Set());

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

            // Robust "My Projects" filter check
            const isAssignedToMe = project.logistics_operator_id && profile?.id && String(project.logistics_operator_id) === String(profile.id);
            if (showOnlyMine && !isAssignedToMe) return;
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
                name: `[${pNum}] ${project.customer_name || 'Klient'} — ${tItem.name || 'Transport'}`,
                projectNumber: pNum, // Attach project metadata
                contactPerson: recipient?.contactPerson,
                contactEmail: recipient?.email,
                city: recipient?.city,
                address: getGeocodingAddress(recipient),
                isStale: !(window as any)._validTransportKeys?.has(key)
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
    }, [projects, localState, hiddenProjectIds, showOnlyMine, profile]);

    const deliveryMapData = useMemo(() => {
        const data: any[] = [];
        const projMap = new Map<string, SavedCalculation>(projects.map(p => [p.project_id || 'BezNumeru', p]));

        const entries = Object.entries(localState) as [string, TransportItem][];
        entries.forEach(([key, tItem]) => {
            const [pNum] = key.split('|');
            const project = projMap.get(pNum);
            if (!project || hiddenProjectIds.has(project.id)) return;

            const currentUserId = profile?.id;
            const isAssignedToMe = project.logistics_operator_id && currentUserId && String(project.logistics_operator_id) === String(currentUserId);
            if (showOnlyMine && !isAssignedToMe) return;

            const activeData = extractActiveData(project.calc);
            if (!activeData) return;

            // Try different address sources (Recipient is priority, then Ordering Party, then Payer)
            const address = getGeocodingAddress(activeData.recipient);

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
    }, [projects, localState, hiddenProjectIds, showOnlyMine, profile]);

    // --- DISPLAY MODEL ---
    const gridRows = useMemo(() => {
        const projMap = new Map<string, SavedCalculation>(projects.map(p => [p.project_id || 'BezNumeru', p]));
        const projectGroups: Record<string, HubRow[]> = {};

        const entries = Object.entries(localState) as [string, TransportItem][];
        entries.forEach(([key, tItem]) => {
            const [pNum, tId] = key.split('|');
            const project = projMap.get(pNum);

            if (!project || hiddenProjectIds.has(project.id)) return;

            const currentUserId = profile?.id;
            const isAssignedToMe = project.logistics_operator_id && currentUserId && String(project.logistics_operator_id) === String(currentUserId);
            if (showOnlyMine && !isAssignedToMe) return;

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

            const activeData = extractActiveData(project.calc);

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
                suggestedWeight: calculateSuggestedWeight(calcData, tItem),
                contactPerson: activeData?.recipient?.contactPerson,
                contactEmail: activeData?.recipient?.email,
                isStale: !(window as any)._validTransportKeys?.has(key)
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
    }, [projects, localState, hiddenProjectIds, filterText, expandedGroups, collapsedProjects, showOnlyMine, profile]);

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
        <div className="p-6 bg-zinc-50 dark:bg-zinc-950 min-h-screen animate-fadeIn">
            <div className="flex justify-between items-end mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tighter uppercase">
                        <div className="p-2 bg-amber-500 text-zinc-950 rounded-lg shadow-glow">
                            <Truck size={32} strokeWidth={2.5} />
                        </div>
                        Globalny Hub Logistyczny
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Flota • Kierowcy • Terminy Dostaw</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 mr-2 shadow-sm">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 disabled:opacity-20 transition-colors"
                            title="Cofnij (Undo)"
                        >
                            <Undo size={16} />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 disabled:opacity-20 transition-colors"
                            title="Ponów (Redo)"
                        >
                            <Redo size={16} />
                        </button>
                    </div>

                    <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 mr-4 shadow-sm">
                        <button
                            onClick={() => setShowGantt(!showGantt)}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showGantt ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                        >
                            <CalendarIcon size={14} /> Wykres
                        </button>
                        <button
                            onClick={() => setShowMap(!showMap)}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showMap ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                        >
                            <MapIcon size={14} /> Mapa
                        </button>
                    </div>

                    <button
                        onClick={loadData}
                        className="p-2.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        title="Odśwież dane z serwera"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg font-black uppercase text-[11px] tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-70 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Zapisywanie...' : 'Zapisz Hub'}
                    </button>
                </div>
            </div>

            <div className="mb-8 flex gap-6 flex-wrap items-end bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Search size={10} /> Panel Filtrów
                    </span>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            placeholder="Szukaj projektu / klienta..."
                            className="pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs w-72 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Moje Przypisania</span>
                    <button
                        onClick={() => setShowOnlyMine(!showOnlyMine)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-2 flex items-center gap-2 ${showOnlyMine
                            ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-cyan-500/30'
                            }`}
                    >
                        <Truck size={14} /> Moje Projekty
                    </button>
                </div>

                <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden md:block" />

                <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Aktywne Projekty (Widoczność)</span>
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
                                    : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 shadow-sm'
                                    }`}
                            >
                                {p.project_id || 'Bez Numeru'}
                            </button>
                        ))}
                    </div>
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
                                <th className="px-4 py-4 w-12 text-center">Ind</th>
                                <th className="px-4 py-4">Projekt / Klient</th>
                                <th className="px-4 py-4">Dostawca / Typ Transp.</th>
                                <th className="px-4 py-4">Data Załadunku</th>
                                <th className="px-4 py-4">Data Dostawy</th>
                                <th className="px-4 py-4" colSpan={3}>
                                    <div className="flex items-center gap-2">
                                        <Truck size={10} /> Szczegóły Auta (Kierowca / Rejestracja / Firma / Notatki)
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-right">Koszt / Waga</th>
                                <th className="px-4 py-4 text-right w-32">Opcje</th>
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
                                        <tr key={row.id} className="bg-zinc-100/50 dark:bg-zinc-800/40 border-l-4 border-l-zinc-300 dark:border-l-zinc-700 group">
                                            <td className="px-4 py-2 text-center">
                                                <button onClick={() => toggleProjectCollapse(row.projectNumber)} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded shadow-sm transition-all text-zinc-500">
                                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="font-black text-[13px] text-zinc-900 dark:text-white uppercase tracking-tighter leading-none mb-0.5">{row.projectNumber}</div>
                                                <div className="text-[10px] font-bold text-zinc-400 truncate max-w-[200px] leading-tight uppercase tracking-wide">{row.customerName}</div>
                                            </td>
                                            <td className="px-4 py-2" colSpan={5}>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">{row.vendorName}</span>
                                                    </div>
                                                    {isCollapsed && (
                                                        <span className="text-[10px] bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400 font-mono font-bold">
                                                            ∑ {row.suggestedWeight.toLocaleString()} KG
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right" colSpan={3}>
                                                <div className="text-right">
                                                    <div className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 font-mono bg-white dark:bg-zinc-900 inline-block px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                                        {row.price > 0 ? row.price.toLocaleString() : '-'} {row.currency}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <button
                                                    onClick={() => handleAddTransport(row.originalProject)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-bold text-[9px] uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-500/10"
                                                >
                                                    <PlusCircle size={12} /> Dodaj
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }

                                if (isGroup) {
                                    const tItem = row.transportData;
                                    const isExpanded = expandedGroups.has(row.id);
                                    const isSuppLayer = row.isSupplierOrganized;

                                    return (
                                        <tr key={row.id} className={`transition-all group border-l-4 ${row.isStale ? 'opacity-50 grayscale-[0.5]' : ''} ${isSuppLayer
                                            ? 'bg-amber-50/20 dark:bg-amber-900/5 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 border-amber-500'
                                            : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-cyan-500'
                                            }`}>
                                            <td className="px-4 py-4 text-center">
                                                <button onClick={() => toggleExpand(row.id)} className={`p-1.5 rounded transition-all ${isExpanded ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4 pl-12 relative">
                                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-px ${isSuppLayer ? 'bg-amber-300 dark:bg-amber-800' : 'bg-cyan-300 dark:bg-cyan-800'}`}></div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[11px] font-black text-zinc-950 dark:text-zinc-50 tracking-tight">{row.projectNumber}</div>
                                                    {row.isStale && (
                                                        <span className="text-[8px] font-black bg-white/50 text-zinc-500 border border-zinc-200 px-1 rounded uppercase tracking-tighter">Nieaktualne</span>
                                                    )}
                                                    {row.id.includes('|manual-') && (
                                                        <span className="text-[8px] font-black bg-cyan-100 text-cyan-700 px-1 rounded uppercase tracking-tighter shadow-sm">Logistyka</span>
                                                    )}
                                                </div>
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase truncate max-w-[150px]">{row.customerName}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className={`font-black text-xs truncate max-w-[150px] uppercase tracking-tight ${isSuppLayer ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'}`}>{row.vendorName}</div>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isSuppLayer ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700'}`}>
                                                        {isSuppLayer ? 'Dostawca' : 'JH Logistyka'}
                                                    </span>
                                                    <button
                                                        onClick={() => setAssigningSuppliersKey(assigningSuppliersKey === row.id ? null : row.id)}
                                                        className="text-[8px] font-bold text-zinc-400 hover:text-zinc-600 uppercase tracking-tighter border border-zinc-200 px-1 rounded hover:bg-zinc-50 transition-colors"
                                                    >
                                                        {assigningSuppliersKey === row.id ? 'Zamknij' : 'Powiąż'}
                                                    </button>
                                                </div>
                                                {assigningSuppliersKey === row.id && (
                                                    <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 animate-fadeInLow">
                                                        <div className="text-[8px] font-bold text-zinc-400 uppercase mb-1">Dostępni dostawcy:</div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(row.originalProject.calc as CalculationData).suppliers?.map(s => {
                                                                const isLinked = (tItem.linkedSupplierIds || []).includes(s.id) || tItem.supplierId === s.id;
                                                                return (
                                                                    <button
                                                                        key={s.id}
                                                                        onClick={() => handleToggleSupplierLink(row.projectNumber, row.transportId, s.id)}
                                                                        className={`text-[8px] px-1.5 py-0.5 rounded border transition-all ${isLinked
                                                                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-amber-500/50'
                                                                            }`}
                                                                    >
                                                                        {s.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <DatePickerInput
                                                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-28 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                                                    value={tItem.pickupDate || ''}
                                                    onChange={(val) => handleUpdateTransport(row.projectNumber, row.transportId, { pickupDate: val })}
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <DatePickerInput
                                                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs w-28 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                                                    value={tItem.confirmedDeliveryDate || ''}
                                                    onChange={(val) => handleUpdateTransport(row.projectNumber, row.transportId, { confirmedDeliveryDate: val })}
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-xs text-zinc-400 italic" colSpan={3}>
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <Truck size={14} className={isSuppLayer ? 'text-amber-500' : 'text-cyan-500'} />
                                                    <span className="font-bold text-[10px] uppercase tracking-wide">{tItem.trucksCount} aut(a)</span>
                                                    <span className="mx-1">|</span>
                                                    <span className="text-[9px]">Rozwiń do edycji szczegółów</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="text-right mr-2 flex flex-col items-end gap-1">
                                                    <div className="text-[9px] text-zinc-400 font-mono font-bold uppercase">Sugerowana: {tItem.totalPrice > 0 ? tItem.totalPrice.toLocaleString() : '-'} {tItem.currency}</div>
                                                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 p-1 rounded border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                                        <input
                                                            type="number"
                                                            placeholder="Cena"
                                                            className="bg-transparent text-right px-1.5 py-0.5 text-[11px] w-20 font-black outline-none text-zinc-900 dark:text-zinc-100"
                                                            value={tItem.confirmedPrice || ''}
                                                            onChange={(e) => handleUpdateTransport(row.projectNumber, row.transportId, { confirmedPrice: parseFloat(e.target.value) || 0 })}
                                                        />
                                                        <span className="text-[9px] font-black text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 ml-1 pl-1">{tItem.currency}</span>
                                                    </div>
                                                    <div className="text-[10px] font-black text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded-sm">{row.suggestedWeight?.toLocaleString()} KG</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex justify-end gap-1 items-center">
                                                    <button onClick={() => handleDeleteTransport(row.projectNumber, row.transportId)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-lg transition-all border border-transparent active:scale-95" title="Usuń transport">
                                                        <Trash2 size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <button onClick={() => handleTakeOverProject(row.originalProject)} className={`p-2 rounded-lg transition-all border active:scale-95 shadow-sm ${row.originalProject.logistics_operator_id ? 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-900/30 dark:border-purple-800' : 'text-zinc-400 hover:text-purple-600 border-transparent hover:bg-purple-50'}`} title={row.originalProject.logistics_operator_id ? "Projekt przejęty" : "Przejmij projekt"}>
                                                        {row.originalProject.logistics_operator_id ? <UserCheck size={16} strokeWidth={2.5} /> : <UserPlus size={16} strokeWidth={2.5} />}
                                                    </button>
                                                    <button onClick={() => handleOpenOrderPreview(row)} className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-500 rounded-lg transition-all border border-transparent active:scale-95 shadow-sm" title="Zamówienie (Email)">
                                                        <Mail size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <button onClick={() => handleSendDeliveryConfirmation(row)} className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-500 rounded-lg transition-all border border-transparent active:scale-95 shadow-sm" title="Potwierdzenie Dostawy (Email)">
                                                        <Mail size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <button onClick={() => handleOpenProjectWithSync(row.originalProject)} className="p-2 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-cyan-600 dark:text-cyan-500 rounded-lg transition-all border border-transparent active:scale-95 shadow-sm" title="Otwórz projekt">
                                                        <ExternalLink size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                } else {
                                    const truck = row.truckData;
                                    const isSuppLayer = row.isSupplierOrganized;
                                    if (!truck) return null;
                                    return (
                                        <tr key={row.id} className={`bg-zinc-50/30 dark:bg-zinc-900/20 border-l-4 transition-colors ${isSuppLayer ? 'border-amber-400/50' : 'border-cyan-400/50'}`}>
                                            <td className="px-4 py-2 text-center text-zinc-300">
                                                <div className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto"></div>
                                            </td>
                                            <td className="px-4 py-2 text-center" colSpan={2}>
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded shadow-sm border inline-flex items-center gap-1 ${isSuppLayer
                                                    ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800'
                                                    : 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-900/20 dark:border-cyan-800'}`}>
                                                    <Truck size={10} /> {row.vendorName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <DatePickerInput className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-28 outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono" value={truck.loadingDates || ''} onChange={(val) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { loadingDates: val })} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <DatePickerInput className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-28 outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono" value={truck.deliveryDate || ''} onChange={(val) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { deliveryDate: val })} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-[10px] font-medium" value={truck.driverInfo || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { driverInfo: e.target.value })} placeholder="Imię Nazwisko / Telefon" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-28 uppercase font-mono outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-[10px]" value={truck.registrationNumbers || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { registrationNumbers: e.target.value })} placeholder="NUMER REJ." />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-[10px]" value={truck.transportCompany || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { transportCompany: e.target.value })} placeholder="Nazwa firmy transportowej" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-[10px]" value={truck.notes || ''} onChange={(e) => handleUpdateTruck(row.projectNumber, row.transportId, truck.id, { notes: e.target.value })} placeholder="Notatki dodatkowe..." />
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
            {previewSuppliers && previewProject && (
                <OrderPreviewModal
                    suppliers={previewSuppliers}
                    data={previewProject}
                    onClose={() => {
                        setPreviewSuppliers(null);
                        setPreviewProject(null);
                    }}
                />
            )}
        </div>
    );
};
