import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, StickyNote, ArrowRight, Clock, User, Briefcase, RefreshCw, Filter, Bell, MapPin, Truck, ChevronRight, ChevronDown, Shield, Scale, HardDrive, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, AppState, CalculationMode, Currency, InstallationStage } from '../types';
import { formatNumber } from '../services/calculationService';

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

export const DashboardView: React.FC<Props> = ({ activeProject, onNewProject, onShowProjectManager, onShowComparison, onOpenProject, onBack }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rawExperiments, setRawExperiments] = useState<SavedCalculation[]>([]);

    // State for aggregated data
    const [events, setEvents] = useState<DashboardEvent[]>([]);
    const [notes, setNotes] = useState<ProjectNote[]>([]);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [recentProjects, setRecentProjects] = useState<SavedCalculation[]>([]);
    const [managerInsights, setManagerInsights] = useState<ManagerInsights | null>(null);
    const [accessRequests, setAccessRequests] = useState<any[]>([]);
    const [requestActionError, setRequestActionError] = useState<string | null>(null);

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
            const allProjects = await storageService.getCalculations();

            // FILTERING LOGIC:
            // Show projects where user is Engineer or Specialist, OR if user is Manager (Admin)
            // Also normalize names for better matching
            const myProjects = allProjects.filter(p => {
                const userName = profile?.full_name || '';
                const userRole = profile?.role || 'specialist';

                if (!userName) return false;

                // Manager sees everything
                if (userRole === 'manager') return true;

                const normalizedUser = userName.trim().toLowerCase();
                const pEngineer = (p.engineer || '').trim().toLowerCase();
                const pSpecialist = (p.specialist || '').trim().toLowerCase();

                // Check classic columns
                if (pEngineer === normalizedUser || pSpecialist === normalizedUser) return true;

                // Also check inside JSON metadata
                const fullFile = p.calc as any;
                const data = fullFile.appState?.initial || fullFile.appState?.final || fullFile;
                const meta = data.meta || {};

                const mSales = (meta.salesPerson || '').trim().toLowerCase();
                const mAssist = (meta.assistantPerson || '').trim().toLowerCase();

                return (mSales === normalizedUser || mAssist === normalizedUser);
            });

            setRawExperiments(myProjects);
            setRecentProjects(myProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));

            parseAggregatedData(myProjects, allProjects);

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

    // Re-calculate Gantt when toggle changes or data loads
    useEffect(() => {
        if (rawExperiments.length > 0) {
            buildGanttData(rawExperiments);
        }
    }, [rawExperiments, showDrafts]);

    const getLatestVersions = (projects: SavedCalculation[]): SavedCalculation[] => {
        const groups: Record<string, SavedCalculation> = {};

        projects.forEach(p => {
            // Group Key: Use project_id from DB column if available, else try metadata
            let key = p.project_id;
            const fullFile = p.calc as any;
            if (!key || key === 'BezNumeru') {
                const data = fullFile.appState?.initial || fullFile.appState?.final || fullFile;
                key = data.meta?.projectNumber || 'UNKNOWN';
            }

            // If still unknown, use customer + created_at approximation or just unique ID (fallback)
            if (key === 'UNKNOWN' || key === 'Bez Projektu') {
                key = `ID_${p.id}`;
            }

            if (!groups[key]) {
                groups[key] = p;
            } else {
                // Determine newer
                if (new Date(p.created_at).getTime() > new Date(groups[key].created_at).getTime()) {
                    groups[key] = p;
                }
            }
        });

        return Object.values(groups);
    };

    const buildGanttData = (projects: SavedCalculation[]) => {
        const uniqueLatest = getLatestVersions(projects);

        const ganttRows: GanttProject[] = [];

        uniqueLatest.forEach(p => {
            const fullFile = p.calc as any;
            const stage = fullFile.stage || 'DRAFT';

            // Filter Drafts
            if (!showDrafts && stage === 'DRAFT') return;

            const mode = fullFile.appState?.mode || CalculationMode.INITIAL;
            const data = fullFile.appState ? (mode === CalculationMode.FINAL ? fullFile.appState.final : fullFile.appState.initial) : fullFile;

            // Safe extraction
            if (!data) return;

            const projectNumber = p.project_id || data.meta?.projectNumber || '???';
            const customer = p.customer_name || data.orderingParty?.name || 'Klient';

            const tasks: GanttTask[] = [];

            // 1. Installation Stages
            const stages = data.installation?.stages || [];
            stages.forEach((s: InstallationStage) => {
                if (s.startDate && s.endDate) {
                    tasks.push({
                        id: s.id,
                        name: s.name,
                        startDate: new Date(s.startDate),
                        endDate: new Date(s.endDate),
                        type: 'STAGE',
                        progress: 0
                    });
                }
            });

            // 2. Custom Timeline Items
            const customTimeline = data.installation?.customTimelineItems || [];
            customTimeline.forEach((c: any) => {
                if (c.startDate && c.endDate) {
                    tasks.push({
                        id: c.id,
                        name: c.name,
                        startDate: new Date(c.startDate),
                        endDate: new Date(c.endDate),
                        type: 'CUSTOM',
                        progress: 0
                    });
                }
            });

            // 3. Protocol / Deadline
            if (data.meta?.protocolDate) {
                try {
                    const d = new Date(data.meta.protocolDate);
                    // Verify valid date
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
                } catch (e) { }
            }

            // Determine min/max for the project row
            // Default to today if no tasks
            let min = new Date();
            let max = new Date();
            max.setDate(max.getDate() + 30); // Default 30 day view?

            if (tasks.length > 0) {
                // Calc min/max for zoom (per project, but we render properly later)
                min = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
                max = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));

                // Add buffer
                min.setDate(min.getDate() - 2);
                max.setDate(max.getDate() + 2);
            } else {
                // For empty projects, maybe use CreatedAt -> +1 month?
                min = new Date(p.created_at);
                max = new Date(p.created_at);
                max.setDate(max.getDate() + 30);
            }

            ganttRows.push({
                projectId: p.id,
                projectNumber,
                customer,
                stage,
                tasks: tasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
                minDate: min,
                maxDate: max,
                handle: p
            });
        });

        // initial expand all
        const initialExpand: Record<string, boolean> = {};
        ganttRows.forEach(r => initialExpand[r.projectId] = true);
        setExpandedGanttProjects(initialExpand);

        setGanttData(ganttRows);
    };

    const parseAggregatedData = (rawProjects: SavedCalculation[], allProjects: SavedCalculation[]) => {
        const newEvents: DashboardEvent[] = [];
        const newNotes: ProjectNote[] = [];
        const newActivities: ActivityEvent[] = [];

        const isManager = profile?.role === 'manager';
        const currentUserId = profile?.id;
        const currentUserName = (profile?.full_name || '').trim().toLowerCase();

        // 1. Parse Activities
        allProjects.forEach(p => {
            // Is it saved by someone else? (For workers)
            // For managers, we show EVERYTHING except their own saves as "activity"
            if (p.user_id === currentUserId) return;

            let isRelevant = isManager; // Managers see all activities

            if (!isRelevant) {
                // Workers only see their projects
                const pEngineer = (p.engineer || '').trim().toLowerCase();
                const pSpecialist = (p.specialist || '').trim().toLowerCase();
                isRelevant = pEngineer === currentUserName || pSpecialist === currentUserName;

                if (!isRelevant) {
                    const fullFile = p.calc as any;
                    const data = fullFile.appState?.initial || fullFile.appState?.final || fullFile;
                    if (data) {
                        const meta = data.meta || {};
                        const mSales = (meta.salesPerson || '').trim().toLowerCase();
                        const mAssist = (meta.assistantPerson || '').trim().toLowerCase();
                        isRelevant = mSales === currentUserName || mAssist === currentUserName;
                    }
                }
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

        // 2. Manager-Specific Insights
        if (isManager) {
            const userMap: Record<string, UserPerformance> = {};
            const pipeline: PipelineStats = { draft: 0, opening: 0, final: 0 };
            const marginProjects: { number: string; customer: string; margin: number }[] = [];

            // Use only Latest Versions for stats to avoid inflation
            const latestAll = getLatestVersions(allProjects);

            latestAll.forEach(p => {
                const fullFile = p.calc as any;
                const stage = fullFile.stage || 'DRAFT';
                const isFinalMode = fullFile.appState?.mode === 'FINAL';
                const data = isFinalMode ? fullFile.appState?.final : fullFile.appState?.initial;

                // Pipeline update
                if (stage === 'DRAFT') pipeline.draft++;
                else if (stage === 'OPENING') pipeline.opening++;
                else if (stage === 'FINAL') pipeline.final++;

                // User Performance update
                const engineer = (p.engineer || 'Nieprzypisany').trim();
                const specialist = (p.specialist || '').trim();

                // Track engineer mainly for performance
                if (!userMap[engineer]) {
                    userMap[engineer] = { userName: engineer, projectCount: 0, totalValue: 0, avgMargin: 0, activeProjects: 0 };
                }

                const stats = userMap[engineer];
                stats.projectCount++;
                if (stage !== 'FINAL') stats.activeProjects++;

                // Value and Margin
                if (data) {
                    const val = p.total_price || 0;
                    const cost = p.total_cost || 0;
                    const margin = val > 0 ? ((val - cost) / val) * 100 : 0;

                    stats.totalValue += val;
                    // Exponential average or simple sum for later division
                    stats.avgMargin += margin;

                    // High margin tracker
                    if (margin > 30 && stage !== 'FINAL') {
                        marginProjects.push({
                            number: p.project_id || '???',
                            customer: p.customer_name || 'Klient',
                            margin: Math.round(margin)
                        });
                    }
                }
            });

            // Finalize averages
            Object.values(userMap).forEach(s => {
                if (s.projectCount > 0) s.avgMargin = s.avgMargin / s.projectCount;
            });

            setManagerInsights({
                userPerformance: Object.values(userMap).sort((a, b) => b.totalValue - a.totalValue),
                pipeline,
                topMarginProjects: marginProjects.sort((a, b) => b.margin - a.margin).slice(0, 5)
            });
        }

        // For events/notes we iterate ALL known projects or just latest?
        // Usually dashboard shows aggregated info from everything, but duplication is bad.
        // Let's use Latest Unique logic for Events too to avoid 5 reminders for same project versions.
        const uniqueParams = getLatestVersions(rawProjects);

        uniqueParams.forEach(p => {
            const fullFile = p.calc as any;
            const data = fullFile.appState?.initial || fullFile.appState?.final || fullFile;
            if (!data) return;

            const meta = data.meta || {};
            const projectNumber = p.project_id || meta.projectNumber || '???';
            const customer = p.customer_name || 'Klient';

            // 1. Protocol Date (Deadline)
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

            // 2. Installation Stages Dates
            const install = data.installation;
            if (install && install.stages) {
                install.stages.forEach((stage: any, idx: number) => {
                    if (stage.startDate) {
                        newEvents.push({
                            id: `inst-start-${p.id}-${idx}`,
                            date: new Date(stage.startDate),
                            title: `Start: ${stage.name}`,
                            type: 'INSTALLATION',
                            projectId: p.id,
                            projectNumber,
                            customer
                        });
                    }
                    if (stage.endDate) {
                        newEvents.push({
                            id: `inst-end-${p.id}-${idx}`,
                            date: new Date(stage.endDate),
                            title: `Koniec: ${stage.name}`,
                            type: 'INSTALLATION',
                            projectId: p.id,
                            projectNumber,
                            customer
                        });
                    }
                });
            }

            // 4. Notes
            const noteText = data.projectNotes;
            if (noteText && noteText.trim().length > 0) {
                newNotes.push({
                    id: `note-${p.id}`,
                    projectId: p.id,
                    projectNumber,
                    customer,
                    text: noteText,
                    date: new Date(p.created_at)
                });
            }
        });

        // Filter out past events (optional, but usually dashboard shows upcoming)
        // const now = new Date();
        // now.setHours(0,0,0,0);
        // const upcoming = newEvents.filter(e => e.date >= now);

        // Sort events by date
        newEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        setEvents(newEvents);
        setNotes(newNotes);

        // Sort activities by timestamp desc
        newActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(newActivities.slice(0, 10)); // Keep top 10
    };

    const handleProjectClick = (saved: SavedCalculation) => {
        // cast to any to access appState
        const fullFile = saved.calc as any;

        if (fullFile.appState) {
            // [NEW] Inject the database ID so that sub-components (like RequestAccessModal) 
            // know which calculation to reference.
            const dataToLoad = {
                ...fullFile,
                id: saved.id
            };
            onOpenProject(dataToLoad, fullFile.stage || 'DRAFT', fullFile.appState.mode || CalculationMode.INITIAL);
        } else {
            // Fallback for flat files
            onOpenProject(fullFile, 'DRAFT', CalculationMode.INITIAL);
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

            {/* ACCESS REQUESTS (MANAGER/LOGISTICS) */}
            {(profile?.role === 'manager' || profile?.role === 'logistics') && accessRequests.length > 0 && (
                <div className="mb-8 p-6 bg-red-50 dark:bg-zinc-900 rounded-xl border-2 border-red-200 dark:border-red-900/50 animate-pulse-slow">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="text-red-500" size={24} />
                        <h2 className="text-xl font-bold text-red-700 dark:text-red-400">Prośby o dostęp do edycji</h2>
                        {requestActionError && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded ml-auto font-bold animate-pulse">
                                BŁĄD: {requestActionError}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accessRequests.map(req => (
                            <div key={req.id} className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-red-100 dark:border-red-800/50 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-zinc-900 dark:text-white">{req.user?.full_name}</div>
                                    <div className="text-[10px] text-zinc-400 font-mono">{new Date(req.created_at).toLocaleString()}</div>
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                                    Projekt: <span className="font-bold">{req.calculation?.project_id}</span> | {req.calculation?.customer_name}
                                </div>
                                {req.message && (
                                    <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded text-[11px] italic mb-4 border-l-2 border-red-300">
                                        "{req.message}"
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAccessRequestAction(req.id, 'rejected')}
                                        className="flex-1 py-2 text-xs font-bold text-zinc-500 hover:text-red-500 transition-colors"
                                    >
                                        Odrzuć
                                    </button>
                                    <button
                                        onClick={() => handleAccessRequestAction(req.id, 'approved')}
                                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-all shadow-md shadow-red-500/20"
                                    >
                                        <Shield size={14} /> Odblokuj
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
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
        </div >
    );
};

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
}

