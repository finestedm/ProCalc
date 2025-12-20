
import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Calendar, ArrowRight, Package, Link as LinkIcon, ExternalLink, Filter, ChevronDown, ChevronRight, HardDrive, Shield, User, Clock, Check, RefreshCw, ChevronLeft, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, AppState, CalculationMode, Currency, InstallationStage, TransportItem, TruckDetail } from '../types';
import { formatNumber } from '../services/calculationService';
import { getWeekNumber } from '../services/dateUtils';

interface Props {
    onOpenProject: (data: any, stage: string, mode: CalculationMode) => void;
}

interface LogisticsOrder {
    projectId: string;
    projectNumber: string;
    customerName: string;
    vendorName: string;
    displayDate: string; // [NEW] Resolved date for Gantt
    transport: TransportItem;
    originalProject: SavedCalculation;
    suggestedWeight: number;
}

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

export const LogisticsHubView: React.FC<Props> = ({ onOpenProject }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [allOpeningProjects, setAllOpeningProjects] = useState<SavedCalculation[]>([]);
    const [logisticsTransports, setLogisticsTransports] = useState<any[]>([]); // Overrides from Supabase
    const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
    const [projectOrder, setProjectOrder] = useState<string[]>([]); // Array of project IDs
    const [expandedTransports, setExpandedTransports] = useState<Set<string>>(new Set());

    const canEditCarrier = profile?.role === 'logistics' || profile?.role === 'manager' || profile?.is_admin;

    const toggleExpand = (id: string) => {
        setExpandedTransports(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const all = await storageService.getCalculations();

            // 1. GROUP BY project_id and PICK LATEST
            const latestProjectsMap: Record<string, SavedCalculation> = {};

            all.forEach(p => {
                const pid = p.project_id || 'BezNumeru';
                const fullFile = p.calc as any;
                if (fullFile.stage !== 'OPENING') return;

                if (!latestProjectsMap[pid] || new Date(p.created_at) > new Date(latestProjectsMap[pid].created_at)) {
                    latestProjectsMap[pid] = p;
                }
            });

            const opening = Object.values(latestProjectsMap);
            setAllOpeningProjects(opening);

            // 2. FETCH ALL RELATIONAL TRANSPORTS
            // We fetch all because we want a limitless Hub view.
            const transports = await storageService.getLogisticsTransports();
            setLogisticsTransports(transports);

            // Re-sync order if first time
            if (projectOrder.length === 0) {
                setProjectOrder(opening.map(p => p.id));
            }
        } catch (e) {
            console.error("Failed to load Hub data", e);
        } finally {
            setLoading(false);
        }
    };

    // Aggregate Orders from Relation Table
    const allOrders = useMemo(() => {
        const orders: LogisticsOrder[] = [];

        // Map for fast project lookup
        const projectMap = new Map<string, SavedCalculation>();
        allOpeningProjects.forEach(p => {
            if (p.project_id) projectMap.set(p.project_id, p);
        });

        logisticsTransports.forEach((lt: any) => { // SavedLogisticsTransport
            // 1. Find Parent Project
            const p = projectMap.get(lt.project_number);

            // If we have a project but it's hidden, skip
            if (p && hiddenProjectIds.has(p.id)) return;

            // If we assume untracked projects shouldn't show up, we skip if !p
            if (!p) return;

            const data = p.calc as CalculationData;
            const t = lt.data as TransportItem;

            // Resolve Vendor Name
            let vendor = 'Nieznany';
            if (t.isSupplierOrganized && t.supplierId) {
                vendor = data.suppliers?.find(s => s.id === t.supplierId)?.name || 'Dostawca';
            } else if (t.name) {
                vendor = t.name;
            } else {
                vendor = 'Transport Własny'
            }

            // Resolve Display Date
            // Prefer the top-level column if available (it should be), else fallback to data
            const dDate = lt.delivery_date || lt.pickup_date || (t.isSupplierOrganized ? t.confirmedDeliveryDate : t.pickupDate) || '';

            const suggestedWeight = calculateSuggestedWeight(data, t);

            orders.push({
                projectId: p.id,
                projectNumber: lt.project_number,
                customerName: p.customer_name || 'Klient',
                vendorName: vendor,
                displayDate: dDate,
                transport: t,
                originalProject: p, // Keep for "Open Project"
                suggestedWeight
            });
        });

        return orders;
    }, [allOpeningProjects, hiddenProjectIds, logisticsTransports]);

    // Combinations Logic: Group by [Vendor + Date]
    const combinations = useMemo(() => {
        const groups: Record<string, LogisticsOrder[]> = {};
        allOrders.forEach(order => {
            const date = order.transport.isSupplierOrganized ? order.transport.confirmedDeliveryDate : order.transport.pickupDate;
            if (!date) return;
            const key = `${order.vendorName}|${date}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(order);
        });
        // Keep only groups > 1
        return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 1));
    }, [allOrders]);

    const handleUpdateTransport = async (projectId: string, transportId: string, fields: Partial<TransportItem>) => {
        try {
            const project = allOpeningProjects.find(p => p.id === projectId);
            if (!project) return;
            const pnum = project.project_id || 'BezNumeru';
            if (pnum === 'BezNumeru') return alert("Tylko projekty z numerem mogą mieć zapisywane nadrzędne dane logistyczne.");

            // 1. Get current data for correct merge
            // We find the current transport state from our Relational List
            const existingEntry = logisticsTransports.find(o => o.project_number === pnum && o.transport_id === transportId);

            // Construct updated data
            const currentData = existingEntry ? existingEntry.data : {};
            const updatedData = { ...currentData, ...fields };

            // 2. Save using Relational API
            await storageService.saveLogisticsTransport({
                project_number: pnum,
                transport_id: transportId,
                data: updatedData,
                // We should also update top-level columns if related fields change
                delivery_date: updatedData.isSupplierOrganized ? updatedData.confirmedDeliveryDate : updatedData.pickupDate,
                pickup_date: updatedData.pickupDate,
                carrier: updatedData.carrier,
                supplier_id: updatedData.supplierId
            });

            // 3. Update local state
            setLogisticsTransports(prev => {
                const existingIdx = prev.findIndex(o => o.project_number === pnum && o.transport_id === transportId);
                if (existingIdx >= 0) {
                    const next = [...prev];
                    const oldItem = next[existingIdx];
                    next[existingIdx] = {
                        ...oldItem,
                        data: updatedData,
                        delivery_date: updatedData.isSupplierOrganized ? updatedData.confirmedDeliveryDate : updatedData.pickupDate
                    };
                    return next;
                } else {
                    return [...prev, { project_number: pnum, transport_id: transportId, data: updatedData, delivery_date: updatedData.confirmedDeliveryDate }];
                }
            });
        } catch (e) {
            console.error("Hub update failed", e);
            alert("Błąd zapisu danych transportu.");
        }
    };

    const handleUpdateTruckCount = async (projectId: string, transportId: string, count: number) => {
        const order = allOrders.find(o => o.projectId === projectId && o.transport.id === transportId);
        if (!order) return;

        const currentTrucks = order.transport.trucks || [];
        let newTrucks = [...currentTrucks];

        if (count > currentTrucks.length) {
            // Add mystery trucks
            for (let i = currentTrucks.length; i < count; i++) {
                newTrucks.push({
                    id: Math.random().toString(36).substr(2, 7),
                    loadingDates: '',
                    deliveryDate: order.transport.confirmedDeliveryDate || '',
                    driverInfo: '',
                    registrationNumbers: ''
                });
            }
        } else if (count < currentTrucks.length) {
            // Remove
            newTrucks = newTrucks.slice(0, count);
        }

        handleUpdateTransport(projectId, transportId, { trucksCount: count, trucks: newTrucks });
    };

    const handleUpdateTruckDetail = (projectId: string, transportId: string, truckId: string, fields: any) => {
        const order = allOrders.find(o => o.projectId === projectId && o.transport.id === transportId);
        if (!order) return;

        const updatedTrucks = (order.transport.trucks || []).map(t =>
            t.id === truckId ? { ...t, ...fields } : t
        );

        handleUpdateTransport(projectId, transportId, { trucks: updatedTrucks });
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-zinc-400">Ładowanie Hubu Logistycznego...</div>;

    return (
        <div className="p-6 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <Truck className="text-blue-500" size={36} />
                        Globalny Hub Logistyczny
                    </h1>
                    <p className="text-zinc-500 mt-2">Zarządzaj transportami i terminami wszystkich otwartych projektów w jednym miejscu.</p>
                </div>
                <button onClick={loadData} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <RefreshCw size={20} className="text-zinc-400" />
                </button>
            </div>

            {/* PROJECT VISIBILITY TOGGLE */}
            <div className="mb-6 flex gap-2 flex-wrap bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm items-center">
                <Filter size={16} className="text-zinc-400 mr-2" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase mr-4">Projekty widoczne:</span>
                {allOpeningProjects.map(p => (
                    <button
                        key={p.id}
                        onClick={() => {
                            const newHidden = new Set(hiddenProjectIds);
                            if (newHidden.has(p.id)) newHidden.delete(p.id);
                            else newHidden.add(p.id);
                            setHiddenProjectIds(newHidden);
                        }}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${hiddenProjectIds.has(p.id)
                            ? 'bg-zinc-100 border-zinc-200 text-zinc-400'
                            : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                            }`}
                    >
                        {p.project_id || 'Bez Numeru'}
                    </button>
                ))}
            </div>


            {/* GANTT CHART SECTION */}
            <div className="mb-8">
                <LogisticsGanttChart orders={allOrders} />
            </div>

            {/* ORDERS TABLE */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2">
                        <Package size={18} className="text-blue-500" />
                        Aktywne Dostawy ({allOrders.length})
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-4 py-3">Projekt / Klient</th>
                                <th className="px-4 py-3">Dostawca / Typ</th>
                                <th className="px-4 py-3">Termin Odbioru / Dostawy</th>
                                <th className="px-4 py-3">Parametry (Waga/LDM)</th>
                                <th className="px-4 py-3">Przewoźnik / Cena</th>
                                <th className="px-4 py-3 text-right">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {allOrders.map((order, idx) => {
                                const t = order.transport;
                                const rowId = `${order.projectId}-${t.id}`;
                                return (
                                    <React.Fragment key={`${rowId}-${idx}`}>
                                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group border-b border-zinc-100 dark:border-zinc-800">
                                            <td className="px-4 py-4">
                                                <div className="inline-block align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-zinc-900 dark:text-white text-sm">{order.projectNumber}</div>
                                                        <button
                                                            onClick={() => toggleExpand(rowId)}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all border ${expandedTransports.has(rowId)
                                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-blue-500 hover:text-blue-500'}`}
                                                        >
                                                            {expandedTransports.has(rowId) ? 'Zwiń' : 'Szczegóły Aut'}
                                                        </button>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500">{order.customerName}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-zinc-800 dark:text-zinc-200 text-xs text-blue-600">{order.vendorName}</div>
                                                <div className="text-[9px] uppercase font-bold text-zinc-400 mt-1">
                                                    {t.isSupplierOrganized ? 'Dostawca' : 'Logistyka'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {t.isSupplierOrganized ? (
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase text-zinc-400 block">Dostawa Potwierdzona:</label>
                                                        <input
                                                            type="date"
                                                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-full"
                                                            value={t.confirmedDeliveryDate || ''}
                                                            onChange={(e) => handleUpdateTransport(order.projectId, t.id, { confirmedDeliveryDate: e.target.value })}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] uppercase text-zinc-400 block">Data Odbioru:</label>
                                                        <input
                                                            type="date"
                                                            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs w-full"
                                                            value={t.pickupDate || ''}
                                                            onChange={(e) => handleUpdateTransport(order.projectId, t.id, { pickupDate: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[9px] font-bold text-zinc-400 block">WAGA (KG):</label>
                                                            {order.suggestedWeight > 0 && Math.abs((t.weight || 0) - order.suggestedWeight) > 1 && (
                                                                <button
                                                                    onClick={() => {
                                                                        const weight = order.suggestedWeight;
                                                                        const tCap = 22000;
                                                                        const suggestedTrucks = Math.ceil(weight / tCap);
                                                                        handleUpdateTransport(order.projectId, t.id, { weight });
                                                                        if (!t.trucksCount || t.trucksCount === 0) {
                                                                            handleUpdateTruckCount(order.projectId, t.id, suggestedTrucks);
                                                                        }
                                                                    }}
                                                                    className="text-[8px] bg-blue-500 text-white px-1 rounded hover:bg-blue-600 transition-colors"
                                                                    title={`Sugerowana waga z list materiałowych: ${order.suggestedWeight} kg. Kliknij aby zastosować i przeliczyć auta.`}
                                                                >
                                                                    Zastosuj {order.suggestedWeight}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="number"
                                                            className={`bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-full focus:border-blue-500 outline-none font-bold ${t.weight === 0 || !t.weight ? 'text-zinc-400 italic' : ''}`}
                                                            value={t.weight || 0}
                                                            onChange={(e) => handleUpdateTransport(order.projectId, t.id, { weight: parseFloat(e.target.value) || 0 })}
                                                            placeholder={order.suggestedWeight > 0 ? `${order.suggestedWeight}` : '0'}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[9px] font-bold text-zinc-400 block tracking-tight">ILOŚĆ AUT:</label>
                                                            {t.weight && t.weight > 0 && (
                                                                <span className="text-[8px] text-zinc-400">
                                                                    Sugerowane: {Math.ceil(t.weight / 22000)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-full focus:border-blue-500 outline-none font-bold text-blue-600"
                                                                value={t.trucksCount || 0}
                                                                onChange={(e) => handleUpdateTruckCount(order.projectId, t.id, parseInt(e.target.value) || 0)}
                                                            />
                                                            {t.weight && t.weight > 0 && t.trucksCount !== Math.ceil(t.weight / 22000) && (
                                                                <button
                                                                    onClick={() => handleUpdateTruckCount(order.projectId, t.id, Math.ceil(t.weight! / 22000))}
                                                                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-500 transition-colors"
                                                                    title="Zastosuj sugerowaną liczbę aut"
                                                                >
                                                                    <RefreshCw size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {canEditCarrier ? (
                                                    <div className="space-y-1">
                                                        <input
                                                            placeholder="Firma transportowa"
                                                            className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-[11px] w-full focus:border-blue-500 outline-none"
                                                            value={t.carrier || ''}
                                                            onChange={(e) => handleUpdateTransport(order.projectId, t.id, { carrier: e.target.value })}
                                                        />
                                                        <div className="flex gap-2">
                                                            <input
                                                                placeholder="Cena"
                                                                type="number"
                                                                className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-[11px] w-1/2 focus:border-blue-500 outline-none"
                                                                value={t.finalCostOverride || t.totalPrice}
                                                                onChange={(e) => handleUpdateTransport(order.projectId, t.id, { finalCostOverride: parseFloat(e.target.value) || 0 })}
                                                            />
                                                            <input
                                                                placeholder="Czas (dni)"
                                                                className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-[11px] w-1/2 focus:border-blue-500 outline-none"
                                                                value={t.transitTime || ''}
                                                                onChange={(e) => handleUpdateTransport(order.projectId, t.id, { transitTime: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs">
                                                        <div className="font-bold">{t.carrier || 'Brak przewoźnika'}</div>
                                                        <div className="text-zinc-500">{t.transitTime || 'Czas nieustalony'}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    onClick={() => onOpenProject(order.originalProject.calc, 'OPENING', (order.originalProject.calc as any).appState?.mode || 'INITIAL')}
                                                    className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-500 transition-all shadow-sm"
                                                    title="Otwórz projekt"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                        {/* EXPANDED SECTION: TRUCK DETAILS */}
                                        {expandedTransports.has(rowId) && (
                                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/10">
                                                <td colSpan={6} className="px-12 py-6">
                                                    <div className="border-l-4 border-blue-500 pl-6 space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                                <Truck size={14} className="text-blue-500" />
                                                                Szczegóły logistyczne naczep ({t.trucks?.length || 0})
                                                            </h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                            {(t.trucks || []).map((truck, tIdx) => (
                                                                <div key={truck.id} className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group/truck">
                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-400 opacity-30 group-hover/truck:opacity-100 transition-opacity" />
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded uppercase flex items-center gap-1">
                                                                            <Truck size={10} />
                                                                            Auta #{tIdx + 1}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-zinc-400 uppercase block flex items-center gap-1">
                                                                                <Calendar size={10} />
                                                                                Załadunek (np. 20-22.03):
                                                                            </label>
                                                                            <input
                                                                                className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs w-full p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                                                value={truck.loadingDates || ''}
                                                                                placeholder="Wpisz zakres dat..."
                                                                                onChange={(e) => handleUpdateTruckDetail(order.projectId, t.id, truck.id, { loadingDates: e.target.value })}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[9px] font-black text-zinc-400 uppercase block flex items-center gap-1">
                                                                                <Calendar size={10} className="text-blue-500" />
                                                                                Data Dostawy:
                                                                            </label>
                                                                            <input
                                                                                type="date"
                                                                                className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs w-full p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                                                value={truck.deliveryDate || ''}
                                                                                onChange={(e) => handleUpdateTruckDetail(order.projectId, t.id, truck.id, { deliveryDate: e.target.value })}
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2 space-y-1">
                                                                            <label className="text-[9px] font-black text-zinc-400 uppercase block flex items-center gap-1">
                                                                                <User size={10} />
                                                                                Kierowca / Nr Rejestracyjne:
                                                                            </label>
                                                                            <div className="flex gap-2">
                                                                                <input
                                                                                    placeholder="Imię, Nazwisko, Tel."
                                                                                    className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs w-full p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                                                    value={truck.driverInfo || ''}
                                                                                    onChange={(e) => handleUpdateTruckDetail(order.projectId, t.id, truck.id, { driverInfo: e.target.value })}
                                                                                />
                                                                                <input
                                                                                    placeholder="Nr Ciągnika / Naczepy"
                                                                                    className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs w-full p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                                                                                    value={truck.registrationNumbers || ''}
                                                                                    onChange={(e) => handleUpdateTruckDetail(order.projectId, t.id, truck.id, { registrationNumbers: e.target.value })}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-span-2 space-y-1">
                                                                            <label className="text-[9px] font-black text-zinc-400 uppercase block">Notatki:</label>
                                                                            <textarea
                                                                                rows={2}
                                                                                className="bg-zinc-50 dark:bg-zinc-800 border-none text-xs w-full p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                                                                value={truck.notes || ''}
                                                                                placeholder="Dodatkowe informacje (np. wymagany pas, awizacja...)"
                                                                                onChange={(e) => handleUpdateTruckDetail(order.projectId, t.id, truck.id, { notes: e.target.value })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: LOGISTICS GANTT CHART ---

interface GanttProps {
    orders: LogisticsOrder[];
}

const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

const LogisticsGanttChart: React.FC<GanttProps> = ({ orders }) => {
    const [viewStartDate, setViewStartDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 7);
        return d;
    });
    const [daysToShow, setDaysToShow] = useState(42);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    const toggleProject = (id: string) => {
        const next = new Set(expandedProjects);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedProjects(next);
    };

    const parseDateStr = (dateStr: string) => {
        if (!dateStr || dateStr === 'ASAP') return null;
        let d: Date | null = null;
        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3) d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
            d = new Date(dateStr);
        }
        if (d && !isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            return d;
        }
        return null;
    };

    useEffect(() => {
        if (orders.length === 0) return;
        let minTs = Infinity;
        let maxTs = -Infinity;
        orders.forEach(o => {
            const d = parseDateStr(o.displayDate);
            if (d) {
                const ts = d.getTime();
                if (ts < minTs) minTs = ts;
                if (ts > maxTs) maxTs = ts;
            }
        });
        if (minTs !== Infinity && maxTs !== -Infinity) {
            const minDate = new Date(minTs);
            minDate.setDate(minDate.getDate() - 3);
            const maxDate = new Date(maxTs);
            maxDate.setDate(maxDate.getDate() + 7);
            const diffDays = Math.ceil(Math.abs(maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
            setViewStartDate(minDate);
            setDaysToShow(Math.max(diffDays, 14));
        }
    }, [orders.length]);

    const timeline = useMemo(() => {
        const dates: Date[] = [];
        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(viewStartDate);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, [viewStartDate, daysToShow]);

    const weeksHeader = useMemo(() => {
        const weeks: { weekNo: number; year: number; colspan: number }[] = [];
        let current: { weekNo: number; year: number; colspan: number } | null = null;
        timeline.forEach(date => {
            const wn = getWeekNumber(date);
            const y = date.getFullYear();
            if (!current || current.weekNo !== wn || current.year !== y) {
                if (current) weeks.push(current);
                current = { weekNo: wn, year: y, colspan: 1 };
            } else current.colspan++;
        });
        if (current) weeks.push(current);
        return weeks;
    }, [timeline]);

    const projectGroups = useMemo(() => {
        const groups: Record<string, LogisticsOrder[]> = {};
        orders.forEach(o => {
            if (!groups[o.projectId]) groups[o.projectId] = [];
            groups[o.projectId].push(o);
        });
        return groups;
    }, [orders]);

    const getGanttBarStyle = (date: Date) => {
        const idx = timeline.findIndex(td => isSameDay(td, date));
        if (idx === -1) return null;
        return {
            left: `${(idx / timeline.length) * 100}%`,
            width: `${(1 / timeline.length) * 100}%`,
            minWidth: '24px'
        };
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden relative">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2">
                    <Calendar size={18} className="text-blue-500" />
                    Oś Czasu Projektów i Naczep
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setDaysToShow(p => Math.max(14, p - 7))} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"><ZoomIn size={14} /></button>
                    <button onClick={() => setDaysToShow(p => Math.min(180, p + 7))} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"><ZoomOut size={14} /></button>
                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 ml-2">
                        <button onClick={() => setViewStartDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"><ChevronLeft size={14} /></button>
                        <span className="px-2 text-[10px] font-bold text-zinc-500 w-24 text-center">{timeline[0].toLocaleDateString()}</span>
                        <button onClick={() => setViewStartDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"><ChevronRight size={14} /></button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                        <div className="flex">
                            <div className="w-[280px] shrink-0 border-r border-zinc-200 dark:border-zinc-800"></div>
                            <div className="flex-1 flex">
                                {weeksHeader.map((w, i) => (
                                    <div key={i} className="border-r border-zinc-200 dark:border-zinc-700 p-1 text-center bg-zinc-100/50 dark:bg-zinc-800/50" style={{ flexGrow: w.colspan, flexBasis: 0 }}>
                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter">CW {w.weekNo}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex">
                            <div className="w-[280px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Projekt / Transport / Auto</div>
                            <div className="flex-1 flex">
                                {timeline.map((date, i) => {
                                    const isToday = isSameDay(date, new Date());
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    return (
                                        <div key={i} className={`flex-1 min-w-[30px] border-r border-zinc-100 dark:border-zinc-800 p-1 text-center flex flex-col items-center justify-center ${isToday ? 'bg-blue-500/10' : ''} ${isWeekend ? 'bg-zinc-100/20 dark:bg-zinc-800/10' : ''}`}>
                                            <span className="text-[9px] text-zinc-400 font-mono">{date.getDate()}</span>
                                            <span className={`text-[7px] font-black uppercase ${isToday ? 'text-blue-500' : 'text-zinc-500'}`}>{['Nd', 'Pn', 'Wt', 'Sr', 'Cz', 'Pt', 'So'][date.getDay()]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Object.entries(projectGroups).map(([projectId, group]) => {
                            const first = group[0];
                            const isExpanded = expandedProjects.has(first.projectId);
                            return (
                                <React.Fragment key={projectId}>
                                    <div className={`flex group/row transition-colors ${isExpanded ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/10'}`}>
                                        <div className="w-[280px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-3">
                                            <button onClick={() => toggleProject(first.projectId)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-400">
                                                {isExpanded ? <ChevronDown size={14} className="text-blue-500" /> : <ChevronRight size={14} />}
                                            </button>
                                            <div className="overflow-hidden">
                                                <div className="font-black text-xs text-zinc-900 dark:text-white truncate">{first.projectNumber}</div>
                                                <div className="text-[10px] text-zinc-500 truncate uppercase font-bold tracking-tighter">{first.customerName}</div>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex relative h-14">
                                            <div className="absolute inset-0 flex pointer-events-none">
                                                {timeline.map((_, i) => <div key={i} className="flex-1 border-r border-zinc-50 dark:border-zinc-800/30"></div>)}
                                            </div>
                                            {!isExpanded && group.map((order, idx) => {
                                                const d = parseDateStr(order.displayDate);
                                                if (!d) return null;
                                                const style = getGanttBarStyle(d);
                                                if (!style) return null;
                                                const color = order.transport.isSupplierOrganized ? 'bg-amber-500' : 'bg-blue-500';
                                                return (
                                                    <div key={idx} className={`absolute h-8 rounded-lg ${color} shadow-lg border-2 border-white dark:border-zinc-800 z-10 flex items-center justify-center`} style={{ ...style, top: '12px' }}>
                                                        <Truck size={12} className="text-white" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {isExpanded && group.map((order, oIdx) => {
                                        const truckGroups: Record<string, TruckDetail[]> = {};
                                        (order.transport.trucks || []).forEach(truck => {
                                            const key = `${truck.loadingDates}|${truck.deliveryDate}`;
                                            if (!truckGroups[key]) truckGroups[key] = [];
                                            truckGroups[key].push(truck);
                                        });

                                        return (
                                            <React.Fragment key={`${order.transport.id}-${oIdx}`}>
                                                <div className="flex bg-zinc-100/30 dark:bg-zinc-800/10 border-b border-zinc-50 dark:border-zinc-800/30">
                                                    <div className="w-[280px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 pl-10 pr-3 py-2 flex items-center gap-2">
                                                        <div className="w-1 h-6 bg-blue-500/30 rounded-full" />
                                                        <div className="overflow-hidden">
                                                            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">{order.vendorName}</div>
                                                            <div className="text-[8px] text-zinc-400 uppercase font-black">{order.transport.isSupplierOrganized ? 'Dostawca' : 'Logistyka'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 relative h-10">
                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                            {timeline.map((_, i) => <div key={i} className="flex-1 border-r border-zinc-50/50 dark:border-zinc-800/20"></div>)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {Object.entries(truckGroups).map(([key, trucks], gIdx) => {
                                                    const loadingStr = trucks[0].loadingDates || '';
                                                    const deliveryStr = trucks[0].deliveryDate || '';
                                                    const loadDate = parseDateStr(loadingStr.split('-')[0].trim());
                                                    const delivDate = parseDateStr(deliveryStr) || parseDateStr(order.displayDate);

                                                    return (
                                                        <div key={gIdx} className="flex hover:bg-zinc-50/80 dark:hover:bg-zinc-800/10 transition-colors">
                                                            <div className="w-[280px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 pl-16 pr-3 py-1 flex items-center gap-2">
                                                                <div className="text-[10px] text-zinc-500 italic truncate">
                                                                    {trucks.length > 1 ? `${trucks.length} aut` : `Auto #${oIdx * 10 + gIdx + 1}`}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 relative h-8">
                                                                <div className="absolute inset-0 flex pointer-events-none">
                                                                    {timeline.map((_, i) => <div key={i} className="flex-1 border-r border-zinc-50/50 dark:border-zinc-800/20"></div>)}
                                                                </div>
                                                                
                                                                {loadDate && (
                                                                    <div className="absolute h-4 top-2 bg-amber-400/80 rounded shadow-sm border border-white dark:border-zinc-800 z-10 flex items-center justify-center" style={getGanttBarStyle(loadDate) || {}} title={`Załadunek: ${loadingStr}`}>
                                                                        <div className="text-[7px] font-black text-amber-900 px-1">IN</div>
                                                                    </div>
                                                                )}

                                                                {delivDate && (
                                                                    <div className="absolute h-5 top-1.5 bg-green-500 rounded shadow-md border-2 border-white dark:border-zinc-800 z-20 flex items-center justify-center px-1" style={getGanttBarStyle(delivDate) || {}} title={`Dostawa: ${deliveryStr}`}>
                                                                        <Truck size={10} className="text-white" />
                                                                        {trucks.length > 1 && <span className="text-[8px] font-black text-white ml-0.5">x{trucks.length}</span>}
                                                                    </div>
                                                                )}

                                                                {loadDate && delivDate && !isSameDay(loadDate, delivDate) && (
                                                                    <div className="absolute h-[1px] bg-zinc-300 dark:bg-zinc-600 top-4 z-0 pointer-events-none" style={{ left: `${(timeline.findIndex(d => isSameDay(d, loadDate)) / timeline.length) * 100}%`, width: `${((timeline.findIndex(d => isSameDay(d, delivDate)) - timeline.findIndex(d => isSameDay(d, loadDate))) / timeline.length) * 100}%` }} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
            {/* Today Line */}
            {timeline.some(d => isSameDay(d, new Date())) && (
                <div 
                    className="absolute top-0 bottom-0 border-l-2 border-red-500 z-50 pointer-events-none"
                    style={{ left: `calc(280px + ${(timeline.findIndex(d => isSameDay(d, new Date())) / timeline.length) * 100}%)` }}
                >
                    <div className="bg-red-500 text-white text-[8px] font-bold px-1 rounded-r">DZIŚ</div>
                </div>
            )}
        </div>
    );
};
