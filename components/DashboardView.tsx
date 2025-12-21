import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, StickyNote, ArrowRight, Clock, User, Briefcase, RefreshCw, Filter, Bell, MapPin, Truck, ChevronRight, ChevronDown, Shield, Scale, HardDrive, AlertCircle, Check } from 'lucide-react';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, AppState, CalculationMode, Currency, InstallationStage } from '../types';
import { formatNumber } from '../services/calculationService';
import { LogisticsHubView } from './LogisticsHubView';

interface Props {
    activeProject: CalculationData | null;
    onNewProject: () => void;
    onShowProjectManager: () => void;
    onShowComparison: () => void;
    onOpenProject: (data: any, stage: string, mode: CalculationMode) => void;
    onBack: () => void;
}

interface DashboardEvent {
    id: string;
    date: Date;
    title: string;
    type: 'PROTOCOL' | 'DELIVERY' | 'INSTALLATION' | 'DEADLINE';
    projectId: string; // ID from DB
    projectNumber: string; // Display number
    customer: string;
}

interface ProjectNote {
    id: string;
    projectId: string;
    projectNumber: string;
    customer: string;
    text: string;
    date: Date;
}

interface ActivityEvent {
    id: string;
    userId: string;
    userName: string;
    projectId: string;
    projectNumber: string;
    customerName: string;
    timestamp: Date;
    action: string;
}

interface LockedEdit {
    id: string;
    projectId: string;
    projectNumber: string;
    customerName: string;
    userName: string;
    reason: string;
    timestamp: Date;
    handle: SavedCalculation;
}

interface UserPerformance {
    userName: string;
    projectCount: number;
    totalValue: number;
    avgMargin: number;
    activeProjects: number;
}

interface PipelineStats {
    draft: number;
    opening: number;
    final: number;
}

interface ManagerInsights {
    userPerformance: UserPerformance[];
    pipeline: PipelineStats;
    topMarginProjects: { number: string; customer: string; margin: number }[];
}

// Gantt specific interfaces
interface GanttTask {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    type: 'STAGE' | 'CUSTOM' | 'DEADLINE';
    progress: number;
}

interface GanttProject {
    projectId: string; // DB ID
    projectNumber: string;
    customer: string;
    stage: string;
    tasks: GanttTask[];
    minDate: Date;
    maxDate: Date;
    handle: SavedCalculation; // Reference to open it
}

interface GanttRowProps {
    project: GanttProject;
    isExpanded: boolean;
    onToggle: () => void;
    onOpen: () => void;
}

const GanttRow: React.FC<GanttRowProps> = ({ project, isExpanded, onToggle, onOpen }) => {
    return (
        <div className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
            <div
                className="p-3 flex items-center gap-3 cursor-pointer"
                onClick={onToggle}
            >
                <div className="text-zinc-400">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">
                            {project.projectNumber}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${project.stage === 'FINAL' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                            project.stage === 'OPENING' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                            {project.stage}
                        </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{project.customer}</div>
                </div>

                {/* Mini Timeline Summary? Just show count */}
                <div className="text-[10px] text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">
                    {project.tasks.length} zadań
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Otwórz projekt"
                >
                    <ArrowRight size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4">
                    <div className="relative h-24 bg-zinc-50 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <div className="absolute inset-0 flex">
                            {[0, 25, 50, 75, 100].map(p => (
                                <div key={p} className="h-full w-px bg-zinc-200/50 dark:bg-zinc-700/50" style={{ position: 'absolute', left: `${p}%` }}></div>
                            ))}
                        </div>

                        {project.tasks.map((task, idx) => {
                            const totalSpan = project.maxDate.getTime() - project.minDate.getTime();
                            if (totalSpan <= 0) return null;

                            const startPct = ((task.startDate.getTime() - project.minDate.getTime()) / totalSpan) * 100;
                            const durationPct = Math.max(1, ((task.endDate.getTime() - task.startDate.getTime()) / totalSpan) * 100);

                            let colorClass = 'bg-blue-500';
                            if (task.type === 'DEADLINE') colorClass = 'bg-red-500';
                            if (task.type === 'CUSTOM') colorClass = 'bg-emerald-500';

                            if (task.type === 'DEADLINE') {
                                return (
                                    <div
                                        key={idx}
                                        className="absolute top-0 bottom-0 flex flex-col justify-center items-center group z-10"
                                        style={{ left: `${startPct}%`, width: '4px' }}
                                    >
                                        <div className="w-1 h-full bg-red-400 group-hover:bg-red-600"></div>
                                        <div className="absolute -top-1 opacity-100 bg-red-600 text-white text-[8px] px-1 rounded whitespace-nowrap z-20 shadow-lg">
                                            {task.startDate.toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={idx}
                                    className={`absolute h-4 rounded-full ${colorClass} opacity-80 hover:opacity-100 transition-all cursor-help z-0`}
                                    style={{
                                        left: `${startPct}%`,
                                        width: `${durationPct}%`,
                                        top: `${15 + (idx % 3) * 25}%` // Stagger vertical pos to avoid overlap
                                    }}
                                    title={`${task.name}: ${task.startDate.toLocaleDateString()} - ${task.endDate.toLocaleDateString()}`}
                                >
                                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-white font-bold drop-shadow-md truncate w-full px-1">
                                        {task.name}
                                    </span>
                                </div>
                            );
                        })}

                        <div className="absolute bottom-1 left-1 text-[9px] text-zinc-400 font-mono">
                            {project.minDate.toLocaleDateString()}
                        </div>
                        <div className="absolute bottom-1 right-1 text-[9px] text-zinc-400 font-mono">
                            {project.maxDate.toLocaleDateString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const DashboardView: React.FC<Props> = ({ activeProject, onNewProject, onShowProjectManager, onShowComparison, onOpenProject, onBack }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rawExperiments, setRawExperiments] = useState<SavedCalculation[]>([]);

    // State for aggregated data
    const [events, setEvents] = useState<DashboardEvent[]>([]);
    const [notes, setNotes] = useState<ProjectNote[]>([]);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [recentProjects, setRecentProjects] = useState<any[]>([]);
    const [managerInsights, setManagerInsights] = useState<ManagerInsights | null>(null);
    const [accessRequests, setAccessRequests] = useState<any[]>([]);
    const [lockedEdits, setLockedEdits] = useState<LockedEdit[]>([]);
    const [requestActionError, setRequestActionError] = useState<string | null>(null);
    const [logisticsViewMode, setLogisticsViewMode] = useState<'PENDING' | 'PROCESSED'>('PENDING');
    const [activeHubTab, setActiveHubTab] = useState<'DASH' | 'LOGISTICS'>('DASH');

    // Gantt State
    const [showDrafts, setShowDrafts] = useState(false);
    const [ganttData, setGanttData] = useState<GanttProject[]>([]);
    const [expandedGanttProjects, setExpandedGanttProjects] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // [NEW] Use metadata fetch instead of heavy getCalculations()
            const allMetadata = await storageService.getCalculationsMetadata();

            // FILTERING LOGIC (Metadata-based)
            const myMetadata = allMetadata.filter(p => {
                const currentUserId = profile?.id;
                const userName = profile?.full_name || '';
                const userRole = profile?.role || 'specialist';

                if (!currentUserId) return false;

                // Manager and Logistics see everything
                if (userRole === 'manager' || userRole === 'logistics') return true;

                // ID-based matching (Cleaned up, no calc fallback needed for modern saves)
                if (p.engineer_id === currentUserId || p.specialist_id === currentUserId ||
                    p.sales_person_1_id === currentUserId || p.sales_person_2_id === currentUserId ||
                    p.user_id === currentUserId) {
                    return true;
                }

                // Fallback: Name-based matching
                const normalizedUser = userName.trim().toLowerCase();
                const pEngineer = (p.engineer || '').trim().toLowerCase();
                const pSpecialist = (p.specialist || '').trim().toLowerCase();

                return pEngineer === normalizedUser || pSpecialist === normalizedUser;
            });

            setRecentProjects(myMetadata.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));

            // [NEW] Fetch relational stages for Gantt/Events
            const metaIds = myMetadata.map(m => m.id);
            const stages = metaIds.length > 0 ? await storageService.getInstallationStages(metaIds) : [];

            parseAggregatedData(myMetadata, allMetadata, stages);
            buildGanttData(myMetadata, stages);

            if (profile?.role === 'manager' || profile?.role === 'logistics') {
                const requests = await storageService.getPendingAccessRequests();
                setAccessRequests(requests);
            }

        } catch (e) {
            console.error("Failed to load dashboard data", e);
        } finally {
            setLoading(false);
        }
    };

    // Build Gantt effect removed - now handled in loadData sequentially

    const getLatestVersions = (projects: any[]): any[] => {
        const groups: Record<string, any> = {};

        projects.forEach(p => {
            let key = p.project_id || `ID_${p.id}`;
            if (key === 'BezNumeru') key = `ID_${p.id}`;

            if (!groups[key] || new Date(p.created_at).getTime() > new Date(groups[key].created_at).getTime()) {
                groups[key] = p;
            }
        });

        return Object.values(groups);
    };

    const buildGanttData = (metadata: any[], allStages: any[]) => {
        const uniqueLatest = getLatestVersions(metadata);
        const ganttRows: GanttProject[] = [];

        uniqueLatest.forEach(p => {
            const stage = p.project_stage || 'DRAFT';
            if (!showDrafts && stage === 'DRAFT') return;

            const projectNumber = p.project_id || '???';
            const customer = p.customer_name || 'Klient';

            // Extract stages for THIS project from the flat global array
            const myStages = allStages.filter(s => s.calculation_id === p.id);
            const tasks: GanttTask[] = myStages.map(s => ({
                id: s.stage_id,
                name: s.name,
                startDate: new Date(s.start_date),
                endDate: new Date(s.end_date),
                type: s.stage_type === 'CUSTOM' ? 'CUSTOM' : 'STAGE',
                progress: s.progress || 0
            }));

            // Protocol Deadline (from metadata!)
            if (p.close_date) {
                const d = new Date(p.close_date);
                if (!isNaN(d.getTime())) {
                    tasks.push({
                        id: 'protocol',
                        name: 'Odbiór Końcowy',
                        startDate: d,
                        endDate: d,
                        type: 'DEADLINE',
                        progress: 0
                    });
                }
            }

            if (tasks.length === 0) return;

            const min = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
            const max = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));
            min.setDate(min.getDate() - 2);
            max.setDate(max.getDate() + 2);

            ganttRows.push({
                projectId: p.id,
                projectNumber,
                customer,
                stage,
                tasks: tasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
                minDate: min,
                maxDate: max,
                handle: p as any // We use metadata as handle, but opening logic handles it
            });
        });

        setGanttData(ganttRows);
    };

    const parseAggregatedData = (rawMetadata: any[], allMetadata: any[], stages: any[]) => {
        const newEvents: DashboardEvent[] = [];
        const newNotes: ProjectNote[] = [];
        const newActivities: ActivityEvent[] = [];

        const isManager = profile?.role === 'manager';
        const currentUserId = profile?.id;

        // 1. Parse Activities (Metadata-based)
        allMetadata.forEach(p => {
            if (p.user_id === currentUserId) return;

            let isRelevant = isManager;
            if (!isRelevant) {
                const userName = (profile?.full_name || '').trim().toLowerCase();
                const pEngineer = (p.engineer || '').trim().toLowerCase();
                const pSpecialist = (p.specialist || '').trim().toLowerCase();
                isRelevant = pEngineer === userName || pSpecialist === userName;
            }

            if (isRelevant) {
                newActivities.push({
                    id: p.id,
                    userId: p.user_id,
                    userName: p.user?.full_name || 'Inny użytkownik',
                    projectId: p.id,
                    projectNumber: p.project_id || 'BezNumeru',
                    customerName: p.customer_name || 'Klient',
                    timestamp: new Date(p.created_at),
                    action: 'zaktualizował kalkulację'
                });
            }
        });

        // 1.5 Locked Edits (Using project_notes metadata column)
        if (isManager) {
            const newLockedEdits: LockedEdit[] = [];
            const marker = "Aktualizacja ZABLOKOWANEJ kalkulacji";

            allMetadata.forEach(p => {
                const notes = p.project_notes || '';
                if (notes.includes(marker)) {
                    const lines = notes.split('\n');
                    lines.forEach(line => {
                        if (line.includes(marker)) {
                            const reasonPart = line.split(marker)[1] || '';
                            const cleanReason = reasonPart.replace(/^[:\s\-]+/, '').trim();

                            newLockedEdits.push({
                                id: `${p.id}-${newLockedEdits.length}`,
                                projectId: p.id,
                                projectNumber: p.project_id || 'BezNumeru',
                                customerName: p.customer_name || 'Klient',
                                userName: p.user?.full_name || 'Użytkownik',
                                reason: cleanReason || 'Brak uzasadnienia',
                                timestamp: new Date(p.created_at),
                                handle: p as any
                            });
                        }
                    });
                }
            });
            newLockedEdits.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setLockedEdits(newLockedEdits.slice(0, 10));
        }

        // 2. Manager-Specific Insights (Metadata-based)
        if (isManager) {
            const userMap: Record<string, UserPerformance> = {};
            const pipeline: PipelineStats = { draft: 0, opening: 0, final: 0 };
            const marginProjects: { number: string; customer: string; margin: number }[] = [];

            const latestAll = getLatestVersions(allMetadata);

            latestAll.forEach(p => {
                const stage = p.project_stage || 'DRAFT';
                if (stage === 'DRAFT') pipeline.draft++;
                else if (stage === 'OPENING') pipeline.opening++;
                else if (stage === 'FINAL') pipeline.final++;

                const engineer = (p.engineer || 'Nieprzypisany').trim();
                if (!userMap[engineer]) {
                    userMap[engineer] = { userName: engineer, projectCount: 0, totalValue: 0, avgMargin: 0, activeProjects: 0 };
                }

                const stats = userMap[engineer];
                stats.projectCount++;
                if (stage !== 'FINAL') stats.activeProjects++;

                const val = p.total_price || 0;
                const cost = p.total_cost || 0;
                const margin = val > 0 ? ((val - cost) / val) * 100 : 0;

                stats.totalValue += val;
                stats.avgMargin += margin;

                if (margin > 30 && stage !== 'FINAL') {
                    marginProjects.push({
                        number: p.project_id || '???',
                        customer: p.customer_name || 'Klient',
                        margin: Math.round(margin)
                    });
                }
            });

            Object.values(userMap).forEach(s => {
                if (s.projectCount > 0) s.avgMargin = s.avgMargin / s.projectCount;
            });

            setManagerInsights({
                userPerformance: Object.values(userMap).sort((a, b) => b.totalValue - a.totalValue),
                pipeline,
                topMarginProjects: marginProjects.sort((a, b) => b.margin - a.margin).slice(0, 5)
            });
        }

        // 3. Events & Upcoming notes (Metadata and Relational Stages)
        const latestMetadata = getLatestVersions(rawMetadata);
        latestMetadata.forEach(p => {
            const projectNumber = p.project_id || '???';
            const customer = p.customer_name || 'Klient';

            // Protocol Date
            if (p.close_date) {
                newEvents.push({
                    id: `proto-${p.id}`,
                    date: new Date(p.close_date),
                    title: 'Termin Protokołu',
                    type: 'PROTOCOL',
                    projectId: p.id,
                    projectNumber,
                    customer
                });
            }

            // Installation Stages (from the relational flat array)
            const myStages = stages.filter(s => s.calculation_id === p.id);
            myStages.forEach((stage: any, idx: number) => {
                if (stage.start_date) {
                    newEvents.push({
                        id: `inst-start-${p.id}-${idx}`,
                        date: new Date(stage.start_date),
                        title: `Start: ${stage.name}`,
                        type: 'INSTALLATION',
                        projectId: p.id,
                        projectNumber,
                        customer
                    });
                }
                if (stage.end_date) {
                    newEvents.push({
                        id: `inst-end-${p.id}-${idx}`,
                        date: new Date(stage.end_date),
                        title: `Koniec: ${stage.name}`,
                        type: 'INSTALLATION',
                        projectId: p.id,
                        projectNumber,
                        customer
                    });
                }
            });

            // Project Notes
            if (p.project_notes && p.project_notes.trim().length > 0) {
                newNotes.push({
                    id: `note-${p.id}`,
                    projectId: p.id,
                    projectNumber,
                    customer,
                    text: p.project_notes,
                    date: new Date(p.created_at)
                });
            }
        });

        newEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        setEvents(newEvents);
        setNotes(newNotes);
        setActivities(newActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10));
    };

    const handleProjectClick = async (saved: any) => {
        setLoading(true);
        try {
            const fullProject = await storageService.getCalculationById(saved.id);
            if (!fullProject) throw new Error("Could not find project data");

            let fullFile = fullProject.calc as any;
            if (!fullFile && (fullProject as any).details?.calc) {
                fullFile = (fullProject as any).details.calc;
            }

            console.log('[DashboardView] Loading project:', saved.id);
            console.log('[DashboardView] FullProject from DB:', fullProject);
            console.log('[DashboardView] Extracted calc data:', fullFile);

            if (!fullFile || Object.keys(fullFile).length === 0) {
                console.error('[DashboardView] Critical: Calc data is empty/null');
                alert("Błąd: Dane kalkulacji są niekompletne (pusty obiekt JSON).");
                return;
            }

            if (fullFile.appState) {
                const dataToLoad = {
                    ...fullFile,
                    id: fullProject.id
                };
                onOpenProject(dataToLoad, fullFile.stage || 'DRAFT', fullFile.appState.mode || CalculationMode.INITIAL);
            } else {
                onOpenProject(fullFile, 'DRAFT', CalculationMode.INITIAL);
            }
        } catch (e) {
            console.error("Failed to open project", e);
            alert("Błąd podczas otwierania projektu.");
        } finally {
            setLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'PROTOCOL': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
            case 'INSTALLATION': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'DELIVERY': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
        }
    };
    const handleAccessRequestAction = async (requestId: string, status: 'approved' | 'rejected') => {
        try {
            setRequestActionError(null);
            await storageService.updateAccessRequestStatus(requestId, status);
            // Refresh requests
            const updated = await storageService.getPendingAccessRequests();
            setAccessRequests(updated);
            // Also reload project data if approved because lock state changed
            if (status === 'approved') {
                loadData();
            }
        } catch (e: any) {
            console.error("Failed to update access request", e);
            setRequestActionError(e.message || "Nie udało się zaktualizować prośby.");
        }
    };

    const handleLogisticsStatusToggle = async (id: string, newStatus: 'PENDING' | 'PROCESSED' | null) => {
        try {
            await storageService.updateLogisticsStatus(id, newStatus);
            loadData(); // Reload to refresh list
        } catch (e) {
            console.error("Logistics update failed", e);
            alert("Błąd aktualizacji statusu logistyki.");
        }
    };

    // Filter for Logistics Queue
    const logisticsQueue = useMemo(() => {
        if (profile?.role !== 'logistics') return [];
        // Flatten all versions, get meaningful ones (e.g. latest of each project that needs action)
        // Or show ALL items that are PENDING?
        // Usually we want the Latest version to be the one we act on.
        const allLatest = getLatestVersions(rawExperiments); // Assuming rawExperiments has filtered data?
        // Wait, rawExperiments is filtered by "My Projects". Logistics sees ALL PENDING usually.
        // We need to ensure `rawExperiments` for Logistics includes EVERYTHING or we fetch separately.
        // In loadData, I changed "Manager sees everything". Logistics should also see everything likely.

        return allLatest.filter(p => p.logistics_status === logisticsViewMode);
    }, [rawExperiments, logisticsViewMode, profile]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin text-amber-500"><RefreshCw size={32} /></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1920px] mx-auto animate-fadeIn pb-32">

            {/* Hub Actions */}
            <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                        <Briefcase className="text-amber-500" size={32} />
                        Twój Pulpit
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Witaj, <strong className="text-zinc-800 dark:text-zinc-200">{profile?.full_name || 'Użytkowniku'}</strong>.
                        Masz <span className="font-bold text-amber-500">{rawExperiments.length}</span> aktywnych projektów.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={onNewProject}
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={18} className="animate-spin-slow" /> Nowy Projekt
                    </button>

                    <button
                        onClick={onShowProjectManager}
                        className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
                    >
                        <HardDrive size={18} /> Menedżer Projektów
                    </button>

                    {(profile?.role === 'manager' || profile?.role === 'logistics' || profile?.is_admin) && (
                        <button
                            onClick={() => setActiveHubTab(activeHubTab === 'DASH' ? 'LOGISTICS' : 'DASH')}
                            className={`px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 border-2 ${activeHubTab === 'LOGISTICS'
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                }`}
                        >
                            <Truck size={18} /> {activeHubTab === 'LOGISTICS' ? 'Wróć do Pulpitu' : 'Centrum Logistyki'}
                        </button>
                    )}

                    {activeProject && (
                        <>
                            <div className="h-8 w-px bg-zinc-200 dark:border-zinc-800 mx-2 hidden md:block"></div>
                            <button
                                onClick={onBack}
                                className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold transition-all flex items-center gap-2"
                            >
                                <ArrowRight size={18} /> Wróć do Kalkulacji
                            </button>
                            <button
                                onClick={onShowComparison}
                                className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold transition-all flex items-center gap-2"
                            >
                                <Scale size={18} /> Porównaj
                            </button>
                        </>
                    )}

                    <button
                        onClick={loadData}
                        className="p-2.5 text-zinc-400 hover:text-amber-500 transition-colors"
                        title="Odśwież dane"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* HUB CONTENT */}
            {activeHubTab === 'DASH' && (
                <>
                    {/* QUICK STATS & ACTIVITY */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                <Bell size={18} className="text-amber-500" />
                                <h2 className="font-bold text-zinc-800 dark:text-zinc-200">Ostatnia Aktywność</h2>
                            </div>
                            {activities.length === 0 ? (
                                <p className="text-zinc-400 text-sm py-4 italic">Brak nowych powiadomień.</p>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map(act => (
                                        <div key={act.id} className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-xs">
                                                    {act.userName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                                        <strong className="text-zinc-900 dark:text-white">{act.userName}</strong> {act.action} projektu <span className="font-mono text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{act.projectNumber}</span>
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500">{act.customerName}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-zinc-400">{act.timestamp.toLocaleString()}</p>
                                                <button
                                                    onClick={() => {
                                                        const saved = rawExperiments.find(p => p.id === act.projectId);
                                                        if (saved) handleProjectClick(saved);
                                                        else {
                                                            // This might be a version strictly from allProjects not myProjects filters
                                                            // but activities filter already ensures it's "my project"
                                                            storageService.getCalculations().then(all => {
                                                                const p = all.find(x => x.id === act.projectId);
                                                                if (p) handleProjectClick(p);
                                                            });
                                                        }
                                                    }}
                                                    className="text-[10px] font-bold text-blue-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Zobacz
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="lg:col-span-1 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Witaj ponownie!</h3>
                                <p className="text-white/80 text-sm mt-1">Sprawdź co zmieniło się w Twoich projektach od ostatniej wizyty.</p>
                            </div>
                            <div className="mt-8">
                                <div className="text-4xl font-bold">{activities.length}</div>
                                <div className="text-xs uppercase tracking-wider font-bold opacity-80">Nowych powiadomień</div>
                            </div>
                        </div>
                    </div>

                    {/* EDITS ON LOCKED CALCULATIONS (MANAGER) */}
                    {profile?.role === 'manager' && lockedEdits.length > 0 && (
                        <div className="mb-8 p-6 bg-amber-50 dark:bg-zinc-900 rounded-xl border-2 border-amber-200 dark:border-amber-900/50">
                            <div className="flex items-center gap-3 mb-4">
                                <Shield className="text-amber-600" size={24} />
                                <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400">Edycje Zablokowanych Kalkulacji</h2>
                                <span className="text-[10px] bg-amber-200 dark:bg-amber-900 px-2 py-1 rounded-full font-bold ml-auto">
                                    LOG ZMIAN (OSTATNIE 10)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {lockedEdits.map(edit => (
                                    <div key={edit.id} className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                <User size={14} className="text-zinc-400" />
                                                {edit.userName}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 font-mono italic">
                                                {edit.timestamp.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 flex items-center gap-2">
                                            <span className="bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-bold text-zinc-800 dark:text-zinc-200">
                                                {edit.projectNumber}
                                            </span>
                                            <span className="truncate max-w-[150px]">{edit.customerName}</span>
                                        </div>
                                        <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg text-[11px] mb-4 border-l-4 border-amber-400 text-zinc-700 dark:text-zinc-300">
                                            <p className="font-bold text-[9px] uppercase text-amber-600 mb-1">Powód edycji:</p>
                                            "{edit.reason}"
                                        </div>
                                        <button
                                            onClick={() => handleProjectClick(edit.handle)}
                                            className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                        >
                                            <ArrowRight size={14} /> Przejrzyj Zmiany
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LOGISTICS QUEUE */}
                    {profile?.role === 'logistics' && (
                        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <Truck className="text-blue-600 dark:text-blue-400" size={28} />
                                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Kolejka Logistyczna</h2>
                                </div>
                                <div className="flex bg-white dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                                    <button
                                        onClick={() => setLogisticsViewMode('PENDING')}
                                        className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${logisticsViewMode === 'PENDING' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-zinc-500 hover:text-zinc-900'}`}
                                    >
                                        Do Przetworzenia ({getLatestVersions(rawExperiments).filter(p => p.logistics_status === 'PENDING').length})
                                    </button>
                                    <button
                                        onClick={() => setLogisticsViewMode('PROCESSED')}
                                        className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${logisticsViewMode === 'PROCESSED' ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-zinc-900'}`}
                                    >
                                        Przetworzone
                                    </button>
                                </div>
                            </div>

                            {logisticsQueue.length === 0 ? (
                                <div className="text-center py-12 text-zinc-400">
                                    <Truck size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>Brak projektów w tej kategorii.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {logisticsQueue.map(p => (
                                        <div key={p.id} className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                                                        {p.project_id || 'Nowy'}
                                                    </span>
                                                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg leading-tight">
                                                        {p.customer_name || 'Nieznany klient'}
                                                    </h3>
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        Handlowiec: {p.engineer}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-mono text-zinc-400 block mb-1">
                                                        {new Date(p.created_at).toLocaleDateString()}
                                                    </span>
                                                    {(p.calc as any).stage && (
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700">
                                                            {(p.calc as any).stage}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="border-t border-zinc-100 dark:border-zinc-700 my-3 pt-3 flex justify-between items-center">
                                                <button
                                                    onClick={() => handleProjectClick(p)}
                                                    className="text-sm font-bold text-zinc-600 hover:text-blue-500 flex items-center gap-1"
                                                >
                                                    Podgląd <ArrowRight size={14} />
                                                </button>

                                                {logisticsViewMode === 'PENDING' ? (
                                                    <button
                                                        onClick={() => handleLogisticsStatusToggle(p.id, 'PROCESSED')}
                                                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors flex items-center gap-2"
                                                    >
                                                        <Check size={14} /> Oznacz jako Przetworzone
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleLogisticsStatusToggle(p.id, 'PENDING')}
                                                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-300 rounded text-xs font-bold transition-colors flex items-center gap-2"
                                                    >
                                                        Przywróć do Kolejki
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MANAGER DASHBOARD SECTION */}
                    {profile?.role === 'manager' && managerInsights && (
                        <div className="space-y-6 mb-8 animate-fadeIn">
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="text-purple-500" size={24} />
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider font-mono">Panel Zarządzania</h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* 1. PIPELINE SUMMARY */}
                                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                                        <RefreshCw size={14} /> Lejek Projektowy
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 font-bold">
                                                <span>SZKICE</span>
                                                <span className="text-zinc-400">{managerInsights.pipeline.draft}</span>
                                            </div>
                                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-zinc-400" style={{ width: `${(managerInsights.pipeline.draft / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 font-bold">
                                                <span>REALIZACJA</span>
                                                <span className="text-blue-500">{managerInsights.pipeline.opening}</span>
                                            </div>
                                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${(managerInsights.pipeline.opening / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 font-bold">
                                                <span>ZAMKNIĘTE</span>
                                                <span className="text-purple-500">{managerInsights.pipeline.final}</span>
                                            </div>
                                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500" style={{ width: `${(managerInsights.pipeline.final / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-end">
                                            <span className="text-[10px] text-zinc-400 uppercase font-bold">Suma wszystkich ofert</span>
                                            <span className="text-2xl font-black text-zinc-900 dark:text-white leading-none">
                                                {managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. TOP PERFORMANCE (INSIGHTS) */}
                                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                                        <Scale size={14} className="text-green-500" /> Najlepsze Marże (Aktywne)
                                    </h3>
                                    <div className="space-y-3">
                                        {managerInsights.topMarginProjects.length === 0 ? (
                                            <p className="text-zinc-400 text-xs italic py-4">Brak rentownych projektów powyżej 30%.</p>
                                        ) : (
                                            managerInsights.topMarginProjects.map((p, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/20">
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-bold text-green-700 dark:text-green-400 font-mono truncate">{p.number}</div>
                                                        <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{p.customer}</div>
                                                    </div>
                                                    <div className="text-right ml-2 shrink-0">
                                                        <div className="text-lg font-black text-green-600 dark:text-green-400">+{p.margin}%</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 3. WORKLOAD BOTTLENECKS */}
                                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                                        <User size={14} className="text-orange-500" /> Obciążenie Zespołu
                                    </h3>
                                    <div className="space-y-3">
                                        {managerInsights.userPerformance.slice(0, 5).map((u, i) => (
                                            <div key={i} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{u.userName}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[10px] uppercase font-bold text-zinc-400">{u.activeProjects} active</div>
                                                    <div className="w-20 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${u.activeProjects > 3 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (u.activeProjects / 5) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                        <button className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                            Pełny raport obciążenia →
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* EMPLOYEE PERFORMANCE TABLE */}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 text-sm">
                                        <Briefcase size={16} /> Wyniki Pracowników
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3">Inżynier / Specjalista</th>
                                                <th className="px-4 py-3 text-right">Wersje</th>
                                                <th className="px-4 py-3 text-right">Potencjał (PLN)</th>
                                                <th className="px-4 py-3 text-right">Śr. Marża</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {managerInsights.userPerformance.map((u, i) => (
                                                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-zinc-800 dark:text-zinc-200">{u.userName}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{u.projectCount}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold">{formatNumber(u.totalValue)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${u.avgMargin > 20 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {Math.round(u.avgMargin)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex justify-center">
                                                            <div className={`w-2 h-2 rounded-full ${u.activeProjects > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-300'}`}></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

                        {/* COLUMN 1: CALENDAR / AGENDA */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                                    <h2 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                        <Calendar size={18} className="text-amber-500" />
                                        Terminarz
                                    </h2>
                                    <span className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Nadchodzące</span>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                                    {events.length === 0 ? (
                                        <div className="p-8 text-center text-zinc-400">Brak nadchodzących wydarzeń</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {events.map((evt) => (
                                                <div key={evt.id} className={`p-3 rounded border ${getTypeColor(evt.type)} border-l-4 transition-transform hover:scale-[1.01] cursor-default`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-sm">{evt.date.toLocaleDateString()}</span>
                                                        <span className="text-[10px] uppercase font-bold opacity-70 border border-current px-1 rounded">{evt.type}</span>
                                                    </div>
                                                    <div className="font-bold text-sm mb-0.5">{evt.title}</div>
                                                    <div className="text-xs opacity-80 flex items-center gap-1 truncate">
                                                        <Briefcase size={10} />
                                                        {evt.projectNumber} | {evt.customer}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: GANTT CHART (REPLACES RECENT) */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-[580px]">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
                                    <h2 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                        <Clock size={18} className="text-blue-500" />
                                        Harmonogram Montaży
                                    </h2>
                                    <label className="flex items-center gap-2 text-[10px] text-zinc-500 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showDrafts}
                                            onChange={e => setShowDrafts(e.target.checked)}
                                            className="rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        Pokaż Drafty
                                    </label>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {ganttData.length === 0 ? (
                                        <div className="p-12 text-center text-zinc-400 flex flex-col items-center gap-2">
                                            <Calendar size={32} className="opacity-20" />
                                            <p>Brak zaplanowanych montaży.</p>
                                            {!showDrafts && <span className="text-xs">Zaznacz "Pokaż Drafty" aby zobaczyć projekty robocze.</span>}
                                        </div>
                                    ) : (
                                        <div>
                                            {ganttData.map(proj => (
                                                <GanttRow
                                                    key={proj.projectId}
                                                    project={proj}
                                                    isExpanded={!!expandedGanttProjects[proj.projectId]}
                                                    onToggle={() => setExpandedGanttProjects(prev => ({ ...prev, [proj.projectId]: !prev[proj.projectId] }))}
                                                    onOpen={() => handleProjectClick(proj.handle)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: STICKY NOTES */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <h2 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                        <StickyNote size={18} className="text-yellow-500" />
                                        Notatki Projektowe
                                    </h2>
                                </div>
                                <div className="p-4 bg-zinc-100/50 dark:bg-black/20 h-[500px] overflow-y-auto custom-scrollbar">
                                    {notes.length === 0 ? (
                                        <div className="text-center text-zinc-400 mt-10">Brak notatek w projektach</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {notes.map(note => (
                                                <div key={note.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 p-4 rounded shadow-sm relative group hover:shadow-md transition-shadow">
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ArrowRight size={14} className="text-yellow-600 dark:text-yellow-500 cursor-pointer" />
                                                    </div>
                                                    <div className="text-xs font-bold uppercase text-yellow-700 dark:text-yellow-500 mb-2 truncate pr-4">
                                                        {note.projectNumber} | {note.customer}
                                                    </div>
                                                    <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap max-h-32 overflow-hidden text-ellipsis font-medium leading-relaxed font-handwriting">
                                                        {note.text}
                                                    </div>
                                                    <div className="mt-2 text-[10px] text-yellow-600/60 dark:text-yellow-500/50 text-right">
                                                        {note.date.toLocaleDateString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}

            {activeHubTab === 'LOGISTICS' && (
                <div className="animate-fadeIn">
                    <LogisticsHubView onOpenProject={onOpenProject} />
                </div>
            )}
        </div>
    );
};


