
import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Calendar, ArrowRight, Package, Link as LinkIcon, ExternalLink, Filter, ChevronDown, ChevronRight, HardDrive, Shield, User, Clock, Check, RefreshCw } from 'lucide-react';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, AppState, CalculationMode, Currency, InstallationStage, TransportItem } from '../types';
import { formatNumber } from '../services/calculationService';

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
}

export const LogisticsHubView: React.FC<Props> = ({ onOpenProject }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [allOpeningProjects, setAllOpeningProjects] = useState<SavedCalculation[]>([]);
    const [logisticsTransports, setLogisticsTransports] = useState<any[]>([]); // Overrides from Supabase
    const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
    const [projectOrder, setProjectOrder] = useState<string[]>([]); // Array of project IDs

    const canEditCarrier = profile?.role === 'logistics' || profile?.role === 'manager' || profile?.is_admin;

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

            // 2. FETCH OVERRIDES for these projects
            const pids = opening.map(o => o.project_id).filter(id => id && id !== 'BezNumeru');
            const overrides = await storageService.getLogisticsTransports(pids);
            setLogisticsTransports(overrides);

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

    // Aggregate Orders from all projects
    const allOrders = useMemo(() => {
        const orders: LogisticsOrder[] = [];
        allOpeningProjects.forEach(p => {
            const pid = p.id;
            const pnum = p.project_id || 'BezNumeru';
            if (hiddenProjectIds.has(pid)) return;

            const data = p.calc as CalculationData;
            if (data.transport && data.transport.length > 0) {
                data.transport.forEach(t => {
                    // MERGE WITH OVERRIDES
                    const override = logisticsTransports.find(o => o.project_number === pnum && o.transport_id === t.id);
                    const mergedTransport = override ? { ...t, ...override.data } : t;

                    // 1. Resolve Best Date for Display/Gantt
                    let displayDate = mergedTransport.isSupplierOrganized
                        ? mergedTransport.confirmedDeliveryDate
                        : mergedTransport.pickupDate;

                    if (!displayDate) {
                        // Fallback to linked suppliers if it's a combined transport
                        if (mergedTransport.linkedSupplierIds && mergedTransport.linkedSupplierIds.length > 0) {
                            const dates = mergedTransport.linkedSupplierIds
                                .map(sid => data.suppliers.find(s => s.id === sid)?.deliveryDate)
                                .filter(d => d && d !== 'ASAP');
                            if (dates.length > 0) displayDate = dates[0];
                        } else if (mergedTransport.supplierId) {
                            displayDate = data.suppliers.find(s => s.id === mergedTransport.supplierId)?.deliveryDate;
                        }
                    }

                    const vendor = mergedTransport.finalVendorName || (mergedTransport.supplierId ? (data.suppliers.find(s => s.id === mergedTransport.supplierId)?.name || 'Nieznany') : 'Konsolidacja');
                    orders.push({
                        projectId: pid,
                        projectNumber: pnum,
                        customerName: p.customer_name || 'Klient',
                        vendorName: vendor,
                        displayDate: displayDate || '',
                        transport: mergedTransport,
                        originalProject: p
                    });
                });
            }
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

            // 1. Get current merged data to persist it accurately
            const data = project.calc as CalculationData;
            const originalTransport = data.transport.find(t => t.id === transportId);
            const override = logisticsTransports.find(o => o.project_number === pnum && o.transport_id === transportId);

            const currentData = override ? { ...originalTransport, ...override.data } : originalTransport;
            const updatedData = { ...currentData, ...fields };

            // 2. Save to logistics_transports ONLY
            await storageService.saveLogisticsTransport(pnum, transportId, updatedData);

            // 3. Update local state
            setLogisticsTransports(prev => {
                const existingIdx = prev.findIndex(o => o.project_number === pnum && o.transport_id === transportId);
                if (existingIdx >= 0) {
                    const next = [...prev];
                    next[existingIdx] = { ...next[existingIdx], data: updatedData };
                    return next;
                } else {
                    return [...prev, { project_number: pnum, transport_id: transportId, data: updatedData }];
                }
            });
        } catch (e) {
            console.error("Hub update failed", e);
            alert("Błąd zapisu danych transportu.");
        }
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
                                return (
                                    <tr key={`${order.projectId}-${t.id}-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-zinc-900 dark:text-white text-sm">{order.projectNumber}</div>
                                                {combinations[`${order.vendorName}|${t.isSupplierOrganized ? t.confirmedDeliveryDate : t.pickupDate}`] && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-black animate-pulse" title="Potencjalny transport łączony (Ten sam dostawca i data!)">
                                                        <LinkIcon size={10} /> LINKED
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">{order.customerName}</div>
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
                                                    <label className="text-[9px] font-bold text-zinc-400 block">WAGA (KG):</label>
                                                    <input
                                                        type="number"
                                                        className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-full focus:border-blue-500 outline-none"
                                                        value={t.weight || 0}
                                                        onChange={(e) => handleUpdateTransport(order.projectId, t.id, { weight: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-zinc-400 block">LDM / Auta:</label>
                                                    <input
                                                        type="number" step="0.1"
                                                        className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-full focus:border-blue-500 outline-none"
                                                        value={t.ldm || 0}
                                                        onChange={(e) => handleUpdateTransport(order.projectId, t.id, { ldm: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {canEditCarrier ? (
                                                <div className="space-y-2">
                                                    <input
                                                        placeholder="Firma transportowa"
                                                        className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-full focus:border-blue-500 outline-none"
                                                        value={t.carrier || ''}
                                                        onChange={(e) => handleUpdateTransport(order.projectId, t.id, { carrier: e.target.value })}
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            placeholder="Cena"
                                                            type="number"
                                                            className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-1/2 focus:border-blue-500 outline-none"
                                                            value={t.finalCostOverride || t.totalPrice}
                                                            onChange={(e) => handleUpdateTransport(order.projectId, t.id, { finalCostOverride: parseFloat(e.target.value) || 0 })}
                                                        />
                                                        <input
                                                            placeholder="Czas (dni)"
                                                            className="bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs w-1/2 focus:border-blue-500 outline-none"
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

const LogisticsGanttChart: React.FC<GanttProps> = ({ orders }) => {
    // Generate 6 weeks timeline from today
    const timeline = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        // Go back 1 week
        start.setDate(start.getDate() - 7);

        const dates: Date[] = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, []);

    const projectGroups = useMemo(() => {
        const groups: Record<string, LogisticsOrder[]> = {};
        orders.forEach(o => {
            if (!groups[o.projectId]) groups[o.projectId] = [];
            groups[o.projectId].push(o);
        });
        return groups;
    }, [orders]);

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2">
                    <Calendar size={18} className="text-blue-500" />
                    Oś Czasu Transportów
                </h2>
                <div className="text-[10px] text-zinc-400 font-bold uppercase">Skala: 6 Tygodni</div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[1400px]">
                    {/* Header: Months/Weeks? Let's just do Days with Week markers */}
                    <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="w-[300px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-2 text-[10px] font-bold text-zinc-400 uppercase">Projekt / Klient</div>
                        <div className="flex-1 flex overflow-hidden">
                            {timeline.map((date, i) => {
                                const isToday = date.toDateString() === new Date().toDateString();
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                return (
                                    <div key={i} className={`flex-1 min-w-[30px] border-r border-zinc-100 dark:border-zinc-800 p-1 text-center flex flex-col items-center justify-center ${isToday ? 'bg-blue-500/10' : ''} ${isWeekend ? 'bg-zinc-100/30 dark:bg-zinc-800/20' : ''}`}>
                                        <span className="text-[8px] text-zinc-400 font-mono">{date.getDate()}</span>
                                        <span className={`text-[7px] font-bold ${isToday ? 'text-blue-500' : 'text-zinc-500'}`}>
                                            {['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'][date.getDay()]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Rows */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Object.entries(projectGroups).map(([projectId, group]: [string, LogisticsOrder[]]) => {
                            const first = group[0];
                            return (
                                <div key={projectId} className="flex hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <div className="w-[300px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-3 flex flex-col justify-center">
                                        <div className="font-bold text-xs text-zinc-900 dark:text-white truncate">{first.projectNumber}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">{first.customerName}</div>
                                    </div>
                                    <div className="flex-1 flex relative h-12">
                                        {/* Background Grid */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {timeline.map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-zinc-50 dark:border-zinc-800/50"></div>
                                            ))}
                                        </div>

                                        {/* Transport Bars */}
                                        {group.map((order, idx) => {
                                            const dateStr = order.displayDate;
                                            if (!dateStr || dateStr === 'ASAP') return null;

                                            // Robust parsing for DD.MM.YYYY or YYYY-MM-DD
                                            let d: Date | null = null;
                                            if (dateStr.includes('.')) {
                                                const parts = dateStr.split('.');
                                                if (parts.length === 3) {
                                                    // Handle DD.MM.YYYY
                                                    d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                                }
                                            } else {
                                                d = new Date(dateStr);
                                            }

                                            if (!d || isNaN(d.getTime())) return null;
                                            d.setHours(0, 0, 0, 0);

                                            // Find index in timeline
                                            const dayIdx = timeline.findIndex(td => td.getTime() === d.getTime());
                                            if (dayIdx === -1) return null;

                                            const color = order.transport.isSupplierOrganized ? 'bg-amber-500' : 'bg-blue-500';
                                            const offset = 4 + (idx % 3) * 12; // Stagger if multiple transports on same project

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`absolute h-8 rounded-lg ${color} shadow-lg shadow-blue-500/20 border-2 border-white dark:border-zinc-800 flex items-center justify-center group cursor-pointer z-10 transition-all hover:scale-110 hover:z-20 px-2`}
                                                    style={{
                                                        left: `${(dayIdx / timeline.length) * 100}%`,
                                                        width: `${(1 / timeline.length) * 100}%`,
                                                        top: `${offset}px`,
                                                        minWidth: '32px'
                                                    }}
                                                    title={`${order.vendorName}: ${dateStr}`}
                                                >
                                                    <Truck size={12} className="text-white" />
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] text-left">
                                                        <div className="text-[10px] font-bold text-white mb-1">{order.vendorName}</div>
                                                        <div className="text-[8px] text-zinc-400 font-mono">
                                                            {order.displayDate} • {order.transport.weight || 0} kg
                                                        </div>
                                                        <div className="text-[8px] text-blue-400 mt-1 uppercase font-bold">
                                                            {order.projectNumber} | {order.customerName}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Today Line */}
                                        <div
                                            className="absolute top-0 bottom-0 border-l-2 border-red-500 z-30 pointer-events-none"
                                            style={{ left: `${(timeline.findIndex(d => d.toDateString() === new Date().toDateString()) / timeline.length) * 100}%` }}
                                        >
                                            <div className="bg-red-500 text-white text-[8px] font-bold px-1 rounded-r">DZIŚ</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
