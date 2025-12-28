import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, StickyNote, ArrowRight, Clock, User, Briefcase, RefreshCw, Filter, Bell, MapPin, Truck, ChevronRight, ChevronDown, Shield, Scale, HardDrive, AlertCircle, Check, Mail, CheckCircle, Send, ShieldCheck, UserCheck, ExternalLink, UserMinus, UserPlus, PlusCircle, Undo, Activity, AlertTriangle, Tag, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { useAuth } from '../contexts/AuthContext';
import { CalculationData, AppState, CalculationMode, Currency, InstallationStage, Supplier } from '../types';
import { formatNumber, extractActiveData } from '../services/calculationService';
import { LogisticsHubView } from './LogisticsHubView';
import { OrderPreviewModal } from './OrderPreviewModal';
import { ProjectStatistics } from './ProjectStatistics';
import { useProjectData } from '../hooks/useProjectData';
import { lifecycleService } from '../services/lifecycleService';
import { ApprovalRequestModal } from './ApprovalRequestModal';
import { CorrectionRequestModal } from './CorrectionRequestModal';
import { notificationService } from '../services/notificationService';

interface Props {
    activeProject: CalculationData | null;
    onNewProject: () => void;
    onShowProjectManager: () => void;
    onShowComparison: () => void;
    onOpenProject: (data: any, stage: string, mode: CalculationMode) => void;
    onBack: () => void;
    onAction?: (action: string, meta?: any) => void;
    activeTab?: 'DASH' | 'LOGISTICS' | 'STATS';
    onTabChange?: (tab: 'DASH' | 'LOGISTICS' | 'STATS') => void;
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
    onOpenOrders: () => void;
}

const GanttRow: React.FC<GanttRowProps> = ({ project, isExpanded, onToggle, onOpen, onOpenOrders }) => {
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
                <div className="text-xs text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">
                    {project.tasks.length} zadań
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenOrders(); }}
                        className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                        title="Zamówienie (Email)"
                    >
                        <Mail size={14} strokeWidth={2.5} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpen(); }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Otwórz projekt"
                    >
                        <ArrowRight size={14} />
                    </button>
                </div>
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

export const DashboardView: React.FC<Props> = ({
    activeProject,
    onNewProject,
    onShowProjectManager,
    onShowComparison,
    onOpenProject,
    onBack,
    onAction,
    activeTab = 'DASH',
    onTabChange
}) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rawExperiments, setRawExperiments] = useState<SavedCalculation[]>([]);
    const [allMetadataCloud, setAllMetadataCloud] = useState<any[]>([]);

    // State for aggregated data
    const [events, setEvents] = useState<DashboardEvent[]>([]);
    const [notes, setNotes] = useState<ProjectNote[]>([]);
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [recentProjects, setRecentProjects] = useState<any[]>([]);
    const [managerInsights, setManagerInsights] = useState<ManagerInsights | null>(null);
    const [accessRequests, setAccessRequests] = useState<any[]>([]);
    const [lockedEdits, setLockedEdits] = useState<LockedEdit[]>([]);
    const [dashFeedTab, setDashFeedTab] = useState<'ACTIVITY' | 'MY_EDITS' | 'APPROVALS' | 'LOCKED_EDITS' | 'LOGISTICS' | 'CORRECTIONS'>('ACTIVITY');

    const pendingApprovals = useMemo(() => {
        if (profile?.role !== 'manager' && !profile?.is_admin) return [];
        return getLatestVersions(rawExperiments)
            .filter((p: any) => p.project_stage === 'PENDING_APPROVAL')
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [rawExperiments, profile]);
    const [requestActionError, setRequestActionError] = useState<string | null>(null);

    // Approval Modal State
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalProject, setApprovalProject] = useState<any>(null);
    const [approvalValidation, setApprovalValidation] = useState<any>(null);

    // Correction Modal State
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionProject, setCorrectionProject] = useState<any>(null);

    // Use prop if available, otherwise local state (fallback)
    const [localActiveTab, setLocalActiveTab] = useState<'DASH' | 'LOGISTICS' | 'STATS'>('DASH');
    const activeHubTab = onTabChange ? (activeTab as any) : localActiveTab;
    const setActiveHubTab = (tab: 'DASH' | 'LOGISTICS' | 'STATS') => {
        if (onTabChange) onTabChange(tab);
        else setLocalActiveTab(tab);
    };

    // --- STATISTICS STATE (Integrated from ProjectManager) ---
    const [statsFilters, setStatsFilters] = useState<Record<string, any>>({});
    const [statsActiveFilterPop, setStatsActiveFilterPop] = useState<string | null>(null);
    const statsData = useProjectData([], [], {}, rawExperiments, 'cloud');
    // Override filters in the hook if needed, or pass them to it.
    // Actually our useProjectData needs these to compute stats.
    // Let's ensure we use the hook correctly in Dashboard.

    // We need to pass statsFilters to useProjectData.
    // But DashboardView currently doesn't have a way to pass them into the hook easily if we just call it here.
    // Wait, useProjectData defines its own statsFilters state.
    // So we should use the one from the hook or pass it in.
    // Our useProjectData currently doesn't take filters as args, it manages them.
    // So we just use statsData.statsFilters etc.

    // Gantt State
    const [showDrafts, setShowDrafts] = useState(false);
    const [ganttData, setGanttData] = useState<GanttProject[]>([]);
    const [expandedGanttProjects, setExpandedGanttProjects] = useState<Record<string, boolean>>({});

    // Order Preview State
    const [previewSuppliers, setPreviewSuppliers] = useState<Supplier[] | null>(null);
    const [previewProject, setPreviewProject] = useState<CalculationData | null>(null);

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
                    return !p.is_archived; // [NEW] Filter archived
                }

                // Fallback: Name-based matching
                const normalizedUser = userName.trim().toLowerCase();
                const pEngineer = (p.engineer || '').trim().toLowerCase();
                const pSpecialist = (p.specialist || '').trim().toLowerCase();

                return (pEngineer === normalizedUser || pSpecialist === normalizedUser) && !p.is_archived; // [NEW] Filter
            });

            setAllMetadataCloud(allMetadata);
            setRawExperiments(myMetadata as any);

            // [NEW] Calculate "My Recent Edits" - Deduplicated & Latest Global
            const userEditedProjectIds = Array.from(new Set(
                allMetadata
                    .filter(p => p.user_id === profile?.id)
                    .map(p => p.project_id)
            ));

            const userRecent = userEditedProjectIds
                .map(pId => {
                    // Find the absolute latest version of this project ID globaly
                    const latestGlobal = allMetadata
                        .filter(p => p.project_id === pId)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                    return latestGlobal;
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 15) // Show slightly more since they are deduplicated
                .map(p => ({
                    ...p,
                    isForeignEdit: p.user_id !== profile?.id,
                    lastEditor: p.user?.full_name || 'Inny'
                }));

            setRecentProjects(userRecent);

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

    // [NEW] Relevant Corrections for the tab (more inclusive than rawExperiments)
    const relevantCorrections = React.useMemo(() => {
        const uniqueLatest = getLatestVersions(allMetadataCloud);
        return uniqueLatest.filter(p => {
            if (p.logistics_status !== 'CORRECTION') return false;

            // Manager/Logistics see everything
            if (profile?.role === 'manager' || profile?.role === 'logistics' || profile?.is_admin) return true;

            const currentUserId = profile?.id;
            const userName = (profile?.full_name || '').toLowerCase().trim();
            const pEng = (p.engineer || '').toLowerCase().trim();
            const pSpec = (p.specialist || '').toLowerCase().trim();

            return p.engineer_id === currentUserId ||
                p.specialist_id === currentUserId ||
                p.user_id === currentUserId ||
                p.sales_person_1_id === currentUserId ||
                (pEng !== '' && pEng === userName) ||
                (pSpec !== '' && pSpec === userName);
        });
    }, [allMetadataCloud, profile]);

    // Build Gantt effect removed - now handled in loadData sequentially


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

        // 1. Parse Activities (Metadata-based) - Deduplicated for corrections
        const groupedActivities: Record<string, ActivityEvent> = {};

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
                const isCorrection = p.logistics_status === 'CORRECTION';
                let actionText = isCorrection ? 'zgłosił prośbę o poprawkę' : 'zaktualizował kalkulację';

                const event: ActivityEvent = {
                    id: p.id,
                    userId: p.user_id,
                    userName: p.user?.full_name || 'Inny użytkownik',
                    projectId: p.id,
                    projectNumber: p.project_id || 'BezNumeru',
                    customerName: p.customer_name || 'Klient',
                    timestamp: new Date(p.created_at),
                    action: actionText
                };

                const key = isCorrection ? `CORR_${event.projectNumber}` : event.id;

                if (!groupedActivities[key] || event.timestamp > groupedActivities[key].timestamp) {
                    groupedActivities[key] = event;
                }
            }
        });

        newActivities.push(...Object.values(groupedActivities).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));

        // 1.5 Locked Edits (Using project_notes metadata column)
        if (isManager || profile?.role === 'logistics') {
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

    const handleLogisticsOperatorToggle = async (id: string, operatorId: string | null) => {
        try {
            await storageService.updateLogisticsOperator(id, operatorId);
            loadData();
        } catch (e) {
            console.error("Failed to update logistics operator", e);
            alert("Błąd przypisania operatora.");
        }
    };

    const handleOpenOrderPreview = async (row: SavedCalculation) => {
        try {
            const fullProject = await storageService.getCalculationById(row.id);
            if (!fullProject) return;

            const activeData = extractActiveData(fullProject.calc);
            if (!activeData) {
                alert("Nie udało się wyodrębnić danych kalkulacji.");
                return;
            }

            const suppliersToPreview = activeData.suppliers.filter((s: Supplier) => s.isIncluded !== false);

            if (suppliersToPreview.length === 0) {
                alert("Brak dostawców do wyświetlenia w tym projekcie.");
                return;
            }

            setPreviewSuppliers(suppliersToPreview);
            setPreviewProject(activeData);
        } catch (e: any) {
            console.error("Failed to open order preview", e);
            alert("Błąd podczas ładowania danych zamówienia.");
        }
    };

    // Filter for Logistics Queue - Split into Pending Approval and Others
    const categorizedLogisticsQueue = useMemo(() => {
        if (profile?.role !== 'logistics' && profile?.role !== 'manager' && !profile?.is_admin) {
            return { awaitingApproval: [], others: [] };
        }

        const allLatest = getLatestVersions(rawExperiments);

        // Sorting logic: 
        // 1. My projects first (p.logistics_operator_id === profile.id)
        // 2. "Gotowe" last (p.logistics_status === 'PROCESSED')
        // 3. Date DESC
        const sorted = allLatest.sort((a, b) => {
            const isAMine = a.logistics_operator_id === profile?.id;
            const isBMine = b.logistics_operator_id === profile?.id;

            if (isAMine && !isBMine) return -1;
            if (!isAMine && isBMine) return 1;

            const isAProcessed = a.logistics_status === 'PROCESSED';
            const isBProcessed = b.logistics_status === 'PROCESSED';

            if (!isAProcessed && isBProcessed) return -1;
            if (isAProcessed && !isBProcessed) return 1;

            const isACorrection = a.logistics_status === 'CORRECTION';
            const isBCorrection = b.logistics_status === 'CORRECTION';

            if (isACorrection && !isBCorrection) return -1;
            if (!isACorrection && isBCorrection) return 1;

            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return {
            awaitingApproval: sorted.filter(p => p.project_stage === 'PENDING_APPROVAL'),
            others: sorted.filter(p => p.project_stage !== 'PENDING_APPROVAL')
        };
    }, [rawExperiments, profile]);

    const handleRequestApprovalTrigger = async (project: any) => {
        try {
            const fullProject = await storageService.getCalculationById(project.id);
            if (!fullProject || !fullProject.calc) throw new Error("Could not load project data");

            const fullFile = fullProject.calc as any;
            const appState = fullFile.appState as AppState;

            if (!appState) throw new Error("Invalid project state");

            const validation = lifecycleService.evaluateAutoApproval(
                appState.initial,
                appState.exchangeRate,
                appState.offerCurrency,
                appState.targetMargin,
                appState.manualPrice
            );

            setApprovalProject(appState);
            setApprovalValidation(validation);
            setShowApprovalModal(true);
        } catch (e) {
            console.error("Failed to prepare approval request", e);
            alert("Nie udało się przygotować prośby o akceptację.");
        }
    };

    const handleConfirmApproval = (message: string, forceManual: boolean) => {
        if (!onAction) return;
        onAction('REQUEST_APPROVAL', {
            message,
            forceManual,
            projectState: approvalProject
        });
        setShowApprovalModal(false);
    };

    const handleRequestCorrectionTrigger = (project: any) => {
        setCorrectionProject(project);
        setShowCorrectionModal(true);
    };

    const handleConfirmCorrection = async (points: string[]) => {
        if (!correctionProject) return;

        setLoading(true);
        try {
            const projId = correctionProject.id;
            const logName = profile?.full_name || 'Logistyk';

            // 1. Fetch FULL project data to create a new version
            const fullProject = await storageService.getCalculationById(projId);
            if (!fullProject || !fullProject.calc) throw new Error("Could not load project data");

            const activeData = extractActiveData(fullProject.calc);
            const projectNumber = activeData.meta?.projectNumber || 'BezNumeru';

            // 2. Prepare correction items
            const newCorrectionItems: any[] = points.map((p, idx) => ({
                id: `corr-${Date.now()}-${idx}`,
                text: p,
                status: 'pending',
                requestedBy: logName,
                timestamp: new Date().toISOString()
            }));

            // 3. Update notes and state
            const currentNotes = activeData.projectNotes || '';
            const timestampStr = new Date().toLocaleString('pl-PL');
            const summary = points.join('; ');
            const newNote = `\n[${timestampStr}] LISTA POPRAWEK (od: ${logName}):\n${points.map(p => `- ${p}`).join('\n')}`;

            activeData.projectNotes = currentNotes + newNote;

            const root = fullProject.calc as any;
            const state = root.appState || root;

            if (state && typeof state === 'object') {
                state.logisticsStatus = 'CORRECTION';
                state.correctionItems = newCorrectionItems; // Set the checklist
                state.historyLog = [
                    ...(state.historyLog || []),
                    {
                        date: new Date().toISOString(),
                        user: logName,
                        action: `Zgłoszono listę poprawek (${points.length} pkt): ${summary.slice(0, 50)}...`
                    }
                ];
            }

            // 4. Save as NEW version
            await storageService.saveCalculation(fullProject.calc, {
                totalCost: fullProject.total_cost,
                totalPrice: fullProject.total_price
            });

            // 5. Send notifications
            const recipients = new Set<string>();
            if (fullProject.engineer_id) recipients.add(fullProject.engineer_id);
            if (fullProject.specialist_id) recipients.add(fullProject.specialist_id);
            if (fullProject.user_id) recipients.add(fullProject.user_id);
            if (fullProject.sales_person_1_id) recipients.add(fullProject.sales_person_1_id);

            for (const uid of recipients) {
                await notificationService.markNotificationsAsRead(uid, `%Prośba o Poprawkę [${projectNumber}]%`);

                await notificationService.sendNotification(
                    uid,
                    `Prośba o Poprawkę [${projectNumber}]`,
                    `${logName} prosi o ${points.length} poprawek. Sprawdź listę w dashboardzie.`,
                    'warning',
                    `/project/${projId}`
                );
            }

            // 5. Refresh data
            await loadData();
            alert("Prośba o poprawkę została wysłana (utworzono nową wersję).");
        } catch (e) {
            console.error("Failed to process correction request", e);
            alert("Błąd podczas wysyłania prośby o poprawkę.");
        } finally {
            setLoading(false);
        }

        setShowCorrectionModal(false);
        setCorrectionProject(null);
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

            {/* Dashboard KPI Summary Section */}
            {activeHubTab === 'DASH' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="premium-card p-5 hover-lift">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                                <Briefcase size={20} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Aktywne Projekty</span>
                        </div>
                        <div className="text-3xl font-black text-zinc-900 dark:text-white mb-1 font-mono">
                            {rawExperiments.length}
                        </div>
                        <p className="text-xs text-zinc-500">Wszystkie Twoje otwarte kalkulacje</p>
                    </div>

                    <div className="premium-card p-5 hover-lift">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                                <Clock size={20} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Oczekujące</span>
                        </div>
                        <div className="text-3xl font-black text-blue-600 mb-1 font-mono">
                            {rawExperiments.filter(p => p.project_stage === 'PENDING_APPROVAL').length}
                        </div>
                        <p className="text-xs text-zinc-500">Projekty wysłane do akceptacji</p>
                    </div>

                    <div className="premium-card p-5 hover-lift">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                <CheckCircle size={20} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Zatwierdzone</span>
                        </div>
                        <div className="text-3xl font-black text-emerald-600 mb-1 font-mono">
                            {rawExperiments.filter(p => p.project_stage === 'APPROVED' || p.project_stage === 'FINAL').length}
                        </div>
                        <p className="text-xs text-zinc-500">Gotowe do realizacji</p>
                    </div>

                    <div className="premium-card p-5 hover-lift">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                                <Truck size={20} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Logistyka</span>
                        </div>
                        <div className="text-3xl font-black text-purple-600 mb-1 font-mono">
                            {getLatestVersions(rawExperiments).filter(p => p.logistics_status === 'PENDING').length}
                        </div>
                        <p className="text-xs text-zinc-500">Projekty w kolejce transportowej</p>
                    </div>
                </div>
            )}

            {/* Hub Actions */}
            <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
                <div>
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-white flex items-center gap-4 tracking-tight">
                        <div className="p-2 bg-amber-500 text-black rounded-xl">
                            <Briefcase size={28} />
                        </div>
                        Pulpit Sterowniczy
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2">
                        <User size={14} className="text-amber-500" />
                        Użytkownik: <strong className="text-zinc-800 dark:text-zinc-200">{profile?.full_name || '👤 Użytkownik'}</strong>
                    </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <button
                        onClick={onNewProject}
                        className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl shadow-lg shadow-amber-500/10 transition-all flex items-center gap-2 hover-lift uppercase text-xs tracking-wider"
                    >
                        <PlusCircle size={18} /> Nowy Projekt
                    </button>

                    <button
                        onClick={onShowProjectManager}
                        className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-black rounded-xl hover:opacity-90 transition-all flex items-center gap-2 hover-lift uppercase text-xs tracking-wider shadow-lg shadow-zinc-500/10"
                    >
                        <HardDrive size={18} /> Menedżer
                    </button>

                    <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
                        <button
                            onClick={() => setActiveHubTab('DASH')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeHubTab === 'DASH' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                        >
                            Pulpit
                        </button>
                        {(profile?.role === 'manager' || profile?.is_admin) && (
                            <button
                                onClick={() => setActiveHubTab('STATS')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeHubTab === 'STATS' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                            >
                                Statystyki
                            </button>
                        )}
                        {(profile?.role === 'manager' || profile?.role === 'logistics' || profile?.is_admin) && (
                            <button
                                onClick={() => setActiveHubTab('LOGISTICS')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeHubTab === 'LOGISTICS' ? 'bg-blue-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                            >
                                Logistyka
                            </button>
                        )}
                    </div>

                    {activeProject && (
                        <>
                            <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>
                            <button
                                onClick={onBack}
                                className="px-6 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
                            >
                                <ArrowRight size={18} /> Powrót
                            </button>
                            <button
                                onClick={onShowComparison}
                                className="px-6 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
                            >
                                <Scale size={18} /> Porównaj
                            </button>
                        </>
                    )}

                    <button
                        onClick={loadData}
                        className="p-3 text-zinc-400 hover:text-amber-500 transition-all hover:rotate-180 duration-500"
                        title="Odśwież dane"
                    >
                        <RefreshCw size={22} />
                    </button>
                </div>
            </div>

            {/* HUB CONTENT */}
            {activeHubTab === 'STATS' && (profile?.role === 'manager' || profile?.is_admin) && (
                <div className="animate-fadeIn h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mt-6 min-h-[600px]">
                    <ProjectStatistics
                        statistics={statsData.statistics}
                        statsFilters={statsData.statsFilters}
                        setStatsFilters={statsData.setStatsFilters}
                        activeFilterPop={statsActiveFilterPop}
                        setActiveFilterPop={setStatsActiveFilterPop}
                        totalFiles={statsData.statistics.totalFiles}
                    />
                </div>
            )}

            {activeHubTab === 'DASH' && (
                <>
                    {/* QUICK STATS & ACTIVITY */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        <div className="lg:col-span-3 premium-card overflow-hidden">
                            <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex gap-6 overflow-x-auto no-scrollbar">
                                    <button
                                        onClick={() => setDashFeedTab('ACTIVITY')}
                                        className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${dashFeedTab === 'ACTIVITY' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        <Activity size={14} /> Globalna Aktywność
                                    </button>

                                    {/* [NEW] Poprawki Tab for Specialists/Engineers */}
                                    {(profile?.role === 'specialist' || profile?.role === 'specialist_manager' || profile?.role === 'manager') && (
                                        <button
                                            onClick={() => setDashFeedTab('CORRECTIONS')}
                                            className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${dashFeedTab === 'CORRECTIONS' ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-400 hover:text-red-500/70'}`}
                                        >
                                            <AlertTriangle size={14} /> Poprawki
                                            {relevantCorrections.length > 0 && (
                                                <span className="w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full text-[9px] font-black animate-pulse shadow-sm">
                                                    {relevantCorrections.length}
                                                </span>
                                            )}
                                        </button>
                                    )}

                                    {(profile?.role === 'engineer' || profile?.role === 'specialist' || profile?.role === 'logistics' || profile?.role === 'manager') && (
                                        <button
                                            onClick={() => setDashFeedTab('MY_EDITS')}
                                            className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${dashFeedTab === 'MY_EDITS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            <Clock size={14} /> Moje Edycje
                                        </button>
                                    )}
                                    {(profile?.role === 'manager' || profile?.is_admin) && (
                                        <button
                                            onClick={() => setDashFeedTab('APPROVALS')}
                                            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all pb-2 ${dashFeedTab === 'APPROVALS' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            <ShieldCheck size={14} /> Akceptacje {pendingApprovals.length > 0 && <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-black leading-none">{pendingApprovals.length}</span>}
                                        </button>
                                    )}
                                    {(profile?.role === 'manager' || profile?.role === 'logistics' || profile?.is_admin) && lockedEdits.length > 0 && (
                                        <button
                                            onClick={() => setDashFeedTab('LOCKED_EDITS')}
                                            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all pb-2 ${dashFeedTab === 'LOCKED_EDITS' ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            <Shield size={14} /> Blokady
                                        </button>
                                    )}
                                    {(profile?.role === 'manager' || profile?.role === 'logistics' || profile?.is_admin) && (
                                        <button
                                            onClick={() => setDashFeedTab('LOGISTICS')}
                                            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all pb-2 ${dashFeedTab === 'LOGISTICS' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        >
                                            <Truck size={14} /> Logistyka {(getLatestVersions(rawExperiments).filter(p => p.logistics_status === 'PENDING').length > 0) && <span className="bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-black leading-none">{getLatestVersions(rawExperiments).filter(p => p.logistics_status === 'PENDING').length}</span>}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto min-h-[300px]">
                                {dashFeedTab === 'ACTIVITY' && (
                                    <div className="bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {activities.length === 0 ? (
                                                <div className="text-zinc-400 text-sm py-12 italic text-center">Brak nowych powiadomień.</div>
                                            ) : (
                                                activities.map(activity => {
                                                    const isCorrection = activity.action.includes('poprawkę');
                                                    return (
                                                        <div
                                                            key={activity.id}
                                                            className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group ${isCorrection ? 'bg-red-500/10 dark:bg-red-500/20 border-l-4 border-red-500 shadow-sm' : ''}`}
                                                        >
                                                            <div className="flex gap-4">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isCorrection ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold'}`}>
                                                                    {isCorrection ? <AlertCircle size={20} className="animate-pulse" /> : String(activity.userName).charAt(0)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isCorrection ? 'text-red-600 animate-pulse' : 'text-zinc-400'}`}>
                                                                                {isCorrection ? 'Wymagana Poprawka' : 'Aktualizacja'}
                                                                            </span>
                                                                            <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate tracking-tight">
                                                                                {activity.userName}
                                                                            </h4>
                                                                        </div>
                                                                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase font-bold">
                                                                            {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: pl })}
                                                                        </span>
                                                                    </div>
                                                                    <p className={`text-xs mt-1 ${isCorrection ? 'text-red-700 dark:text-red-400 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                                                        {activity.action} projekt <span className={`font-mono font-black ${isCorrection ? 'text-red-600 underline' : 'text-zinc-900 dark:text-white'}`}>{activity.projectNumber}</span>
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-2.5">
                                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter flex items-center gap-1">
                                                                            <Tag size={10} /> {activity.customerName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleProjectClick(activity)}
                                                                    className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isCorrection ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg shadow-zinc-500/10'}`}
                                                                >
                                                                    <ArrowUpRight size={16} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}

                                {dashFeedTab === 'APPROVALS' && (
                                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2">
                                        <thead className="bg-amber-500/5 dark:bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest border-b border-amber-500/10">
                                            <tr>
                                                <th className="px-6 py-4">Projekt / Klient</th>
                                                <th className="px-6 py-4">Inżynier</th>
                                                <th className="px-6 py-4">Notatka</th>
                                                <th className="px-6 py-4 text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-500/5 dark:divide-amber-500/10">
                                            {pendingApprovals.length === 0 ? (
                                                <tr><td colSpan={4} className="text-zinc-400 text-sm py-12 italic text-center">Brak projektów oczekujących na akceptację.</td></tr>
                                            ) : (
                                                pendingApprovals.map((p: any) => (
                                                    <tr key={p.id} className="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 transition-all group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-mono font-black text-xs tracking-tighter ${p.project_id === 'BezNumeru' ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                                                                        {p.project_id === 'BezNumeru' ? '⚠️ BRAK NUMERU' : p.project_id}
                                                                    </span>
                                                                    <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">OCZEKUJE</span>
                                                                </div>
                                                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{p.customer_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black">
                                                                    {(p.user?.full_name || p.specialist || '?').charAt(0)}
                                                                </div>
                                                                <span className="font-bold text-zinc-700 dark:text-zinc-300 tracking-tight">{p.user?.full_name || p.specialist || 'Nieznany'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-xs text-zinc-500 italic max-w-[250px] truncate" title={p.project_notes}>
                                                                {p.project_notes || '—'}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => handleProjectClick(p)}
                                                                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-black shadow-lg shadow-amber-500/10 transition-all hover-lift uppercase tracking-widest"
                                                            >
                                                                Recenzja
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}

                                {dashFeedTab === 'MY_EDITS' && (
                                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2">
                                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-400 font-black uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-6 py-4">Projekt / Klient</th>
                                                <th className="px-6 py-4">Ostatnia edycja</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {recentProjects.length === 0 ? (
                                                <tr><td colSpan={4} className="text-zinc-400 text-sm py-12 italic text-center">Brak ostatnich projektów.</td></tr>
                                            ) : (
                                                recentProjects.map(p => (
                                                    <tr key={p.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-500/5 transition-all group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-black text-xs tracking-tighter text-zinc-900 dark:text-white">{p.project_id}</span>
                                                                    {p.isForeignEdit && (
                                                                        <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">ZMIANA: {p.lastEditor}</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{p.customer_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 font-mono tracking-tight">{new Date(p.created_at).toLocaleDateString()}</span>
                                                                <span className="text-[10px] text-zinc-400 font-mono italic">{new Date(p.created_at).toLocaleTimeString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap gap-1.5 focus-within:">
                                                                {p.latestOperatorId && (
                                                                    <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">LOGISTYKA</span>
                                                                )}
                                                                {p.project_stage === 'PENDING_APPROVAL' && (
                                                                    <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">DO AKCEPTACJI</span>
                                                                )}
                                                                {p.project_stage === 'OPENING' && (
                                                                    <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">REALIZACJA</span>
                                                                )}
                                                                {(p.project_stage === 'APPROVED' || p.project_stage === 'FINAL') && (
                                                                    <span className="text-[10px] bg-zinc-900 dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">ZATWIERDZONY</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => handleProjectClick(p)}
                                                                className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-black shadow-lg shadow-zinc-500/10 transition-all hover-lift uppercase tracking-widest"
                                                            >
                                                                Wgląd
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}

                                {dashFeedTab === 'LOCKED_EDITS' && (
                                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2">
                                        <thead className="bg-red-500/5 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400 font-black uppercase tracking-widest border-b border-red-500/10">
                                            <tr>
                                                <th className="px-6 py-4">Użytkownik</th>
                                                <th className="px-6 py-4">Projekt / Klient</th>
                                                <th className="px-6 py-4">Data Próby</th>
                                                <th className="px-6 py-4">Powód</th>
                                                <th className="px-6 py-4 text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-500/5 dark:divide-red-500/10">
                                            {lockedEdits.length === 0 ? (
                                                <tr><td colSpan={5} className="text-zinc-400 text-sm py-12 italic text-center">Brak zapisanych edycji zablokowanych projektów.</td></tr>
                                            ) : (
                                                lockedEdits.map(edit => (
                                                    <tr key={edit.id} className="hover:bg-red-500/5 dark:hover:bg-red-500/10 transition-all group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-black text-red-600">
                                                                    {edit.userName.charAt(0)}
                                                                </div>
                                                                <span className="font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{edit.userName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-mono font-black text-xs tracking-tighter text-zinc-900 dark:text-white">{edit.projectNumber}</span>
                                                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{edit.customerName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 font-mono tracking-tight">{new Date(edit.timestamp).toLocaleDateString()}</span>
                                                                <span className="text-[10px] text-zinc-400 font-mono italic">{new Date(edit.timestamp).toLocaleTimeString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs text-red-700 dark:text-red-400 italic font-medium max-w-[200px] truncate bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded" title={edit.reason}>
                                                                "{edit.reason}"
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => handleProjectClick(edit.handle)}
                                                                className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-black shadow-lg shadow-zinc-500/10 transition-all hover-lift uppercase tracking-widest"
                                                            >
                                                                Rewizja
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}

                                {dashFeedTab === 'CORRECTIONS' && (
                                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2">
                                        <thead className="bg-red-500/5 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400 font-black uppercase tracking-widest border-b border-red-500/10">
                                            <tr>
                                                <th className="px-6 py-4">Projekt / Status</th>
                                                <th className="px-6 py-4">Klient</th>
                                                <th className="px-6 py-4">Najnowsza Notatka</th>
                                                <th className="px-6 py-4 text-right">Akcja</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-500/5 dark:divide-red-500/10">
                                            {relevantCorrections.length === 0 ? (
                                                <tr><td colSpan={4} className="text-zinc-400 text-sm py-12 italic text-center">Brak projektów wymagających poprawki.</td></tr>
                                            ) : (
                                                relevantCorrections
                                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                    .map(p => {
                                                        const notes = p.project_notes || '';
                                                        const lines = notes.trim().split('\n');
                                                        const lastNote = lines[lines.length - 1] || 'Brak szczegółów';

                                                        const root = (p as any).calc;
                                                        const state = root?.appState || root;
                                                        const items = state?.correctionItems || [];
                                                        const resolved = items.filter((i: any) => i.status === 'resolved').length;
                                                        const total = items.length;

                                                        return (
                                                            <tr key={p.id} className="hover:bg-red-500/5 dark:hover:bg-red-500/10 transition-all group bg-red-500/[0.02]">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-xs font-mono font-black tracking-tighter text-red-600">
                                                                            {p.project_id || 'NOWY'}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm w-fit animate-pulse">
                                                                                WYMAGA POPRAWKI
                                                                            </span>
                                                                            {total > 0 && (
                                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm w-fit ${resolved === total ? 'bg-emerald-600 text-white' : 'bg-red-100 dark:bg-red-900/40 text-red-600'}`}>
                                                                                    {resolved} / {total} PKT
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-black text-zinc-900 dark:text-white leading-tight tracking-tight uppercase text-xs">
                                                                        {p.customer_name || 'Nieznany klient'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-xs text-red-800 dark:text-red-300 italic font-medium max-w-[300px] line-clamp-2 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-500/10 shadow-inner" title={lastNote}>
                                                                        {items.length > 0 ? (
                                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                                {items.slice(0, 2).map((it: any) => (
                                                                                    <li key={it.id} className={it.status === 'resolved' ? 'line-through opacity-50' : ''}>
                                                                                        {it.text.slice(0, 40)}{it.text.length > 40 ? '...' : ''}
                                                                                    </li>
                                                                                ))}
                                                                                {total > 2 && <li>...</li>}
                                                                            </ul>
                                                                        ) : (
                                                                            <span>"{lastNote}"</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        onClick={() => handleProjectClick(p)}
                                                                        className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest flex items-center gap-2 ml-auto"
                                                                    >
                                                                        <AlertTriangle size={14} /> Napraw
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                            )}
                                        </tbody>
                                    </table>
                                )}

                                {dashFeedTab === 'LOGISTICS' && (
                                    <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden mt-2">
                                        <thead className="bg-blue-500/5 dark:bg-blue-500/10 text-xs text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest border-b border-blue-500/10">
                                            <tr>
                                                <th className="px-6 py-4">Status / Projekt</th>
                                                <th className="px-6 py-4">Klient</th>
                                                <th className="px-6 py-4">Inżynier</th>
                                                <th className="px-6 py-4">Data</th>
                                                <th className="px-6 py-4 text-right">Akcje</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-500/5 dark:divide-blue-500/10">
                                            {(categorizedLogisticsQueue.awaitingApproval.length === 0 && categorizedLogisticsQueue.others.length === 0) ? (
                                                <tr><td colSpan={5} className="text-zinc-400 text-sm py-12 italic text-center">Brak projektów w kolejce.</td></tr>
                                            ) : (
                                                [...categorizedLogisticsQueue.awaitingApproval, ...categorizedLogisticsQueue.others].map(p => (
                                                    <tr key={p.id} className={`hover:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-all group ${p.project_stage === 'PENDING_APPROVAL' ? 'bg-amber-500/5' : ''} ${p.logistics_status === 'CORRECTION' ? 'bg-red-500/10 dark:bg-red-500/20 border-l-4 border-red-500' : ''} ${p.logistics_status === 'PROCESSED' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-mono font-black tracking-tighter text-blue-600 dark:text-blue-400">
                                                                        {p.project_id || 'NOWY'}
                                                                    </span>
                                                                    {p.project_stage === 'PENDING_APPROVAL' ? (
                                                                        <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">OCZEKUJE</span>
                                                                    ) : p.logistics_status === 'CORRECTION' ? (
                                                                        <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm animate-pulse">POPRAWKA</span>
                                                                    ) : (
                                                                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">{p.project_stage || 'OPENING'}</span>
                                                                    )}
                                                                </div>
                                                                {p.logistics_operator_id && (
                                                                    <span className="text-[9px] text-zinc-400 mt-1 uppercase font-black tracking-widest flex items-center gap-1">
                                                                        <UserCheck size={10} className="text-emerald-500" /> {p.operator?.full_name || 'PRZYPISANY'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-black text-zinc-900 dark:text-white leading-tight tracking-tight uppercase text-xs">
                                                                {p.customer_name || 'Nieznany klient'}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-black">
                                                                    {(p.engineer || '?').charAt(0)}
                                                                </div>
                                                                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-bold tracking-tight uppercase">{p.engineer}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 font-mono tracking-tight">
                                                                    {new Date(p.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-1 items-center">
                                                                <button
                                                                    onClick={() => handleProjectClick(p)}
                                                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg transition-all active:scale-90"
                                                                    title="Podgląd"
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </button>

                                                                <button
                                                                    onClick={() => handleRequestCorrectionTrigger(p)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all active:scale-90"
                                                                    title="Zgłoś błąd / Poprawkę"
                                                                >
                                                                    <AlertCircle size={16} />
                                                                </button>
                                                                {p.logistics_operator_id === profile?.id ? (
                                                                    <button
                                                                        onClick={() => handleLogisticsOperatorToggle(p.id, null)}
                                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all active:scale-90"
                                                                        title="Zrezygnuj"
                                                                    >
                                                                        <UserMinus size={16} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleLogisticsOperatorToggle(p.id, profile?.id || null)}
                                                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all active:scale-90"
                                                                        title="Przypisz do mnie"
                                                                    >
                                                                        <UserPlus size={16} />
                                                                    </button>
                                                                )}
                                                                {p.logistics_status !== 'PROCESSED' && p.project_stage !== 'PENDING_APPROVAL' && (
                                                                    <button
                                                                        onClick={() => handleLogisticsStatusToggle(p.id, 'PROCESSED')}
                                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all active:scale-90"
                                                                        title="Gotowe"
                                                                    >
                                                                        <Check size={18} strokeWidth={3} />
                                                                    </button>
                                                                )}
                                                                {p.logistics_status === 'PROCESSED' && (
                                                                    <button
                                                                        onClick={() => handleLogisticsStatusToggle(p.id, 'PENDING')}
                                                                        className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded-lg transition-all active:scale-90"
                                                                        title="Cofnij"
                                                                    >
                                                                        <Undo size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleOpenOrderPreview(p as any)}
                                                                    className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-amber-600 rounded-lg transition-all active:scale-90"
                                                                    title="Email"
                                                                >
                                                                    <Mail size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
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



                    {/* MANAGER DASHBOARD SECTION */}
                    {
                        profile?.role === 'manager' && managerInsights && (
                            <div className="space-y-6 mb-12 animate-fadeIn">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Shield className="text-purple-500" size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">Panel Zarządzania</h2>
                                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Analityka i Nadzór Portfela</p>
                                    </div>
                                </div>

                                {(profile?.role === 'manager' || profile?.is_admin) && pendingApprovals.length > 0 && (
                                    <div className="premium-card bg-amber-500/5 border border-amber-500/20 p-5 flex items-center justify-between mb-8 group overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-8 bg-amber-500/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-amber-500/10 transition-all"></div>
                                        <div className="flex items-center gap-5 relative">
                                            <div className="w-12 h-12 bg-amber-500 text-black rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                                                <Clock size={24} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">Oczekujące Akceptacje</h3>
                                                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-0.5 uppercase tracking-wide">Pozostało {pendingApprovals.length} ofert do weryfikacji</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setDashFeedTab('APPROVALS');
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-black shadow-lg shadow-amber-500/10 transition-all hover-lift uppercase tracking-widest relative"
                                        >
                                            Przejdź do Recenzji
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* 1. PIPELINE SUMMARY */}
                                    <div className="premium-card p-6 flex flex-col h-full">
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <RefreshCw size={14} className="text-blue-500" /> Lejek Projektowy
                                        </h3>
                                        <div className="space-y-6 flex-1">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xs font-black text-zinc-500 uppercase tracking-tighter">SZKICE (DRAFT)</span>
                                                    <span className="text-sm font-mono font-black text-zinc-900 dark:text-white">{managerInsights.pipeline.draft}</span>
                                                </div>
                                                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-zinc-400 rounded-full transition-all duration-1000" style={{ width: `${(managerInsights.pipeline.draft / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xs font-black text-blue-500 uppercase tracking-tighter">W REALIZACJI</span>
                                                    <span className="text-sm font-mono font-black text-blue-500">{managerInsights.pipeline.opening}</span>
                                                </div>
                                                <div className="h-1.5 bg-blue-500/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${(managerInsights.pipeline.opening / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-xs font-black text-emerald-500 uppercase tracking-tighter">ZATWIERDZONE</span>
                                                    <span className="text-sm font-mono font-black text-emerald-500">{managerInsights.pipeline.final}</span>
                                                </div>
                                                <div className="h-1.5 bg-emerald-500/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(managerInsights.pipeline.final / (managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final || 1)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                            <span className="text-xs text-zinc-400 uppercase font-black tracking-widest">Suma Portfela</span>
                                            <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                                                {managerInsights.pipeline.draft + managerInsights.pipeline.opening + managerInsights.pipeline.final}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. TOP PERFORMANCE (INSIGHTS) */}
                                    <div className="premium-card p-6">
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Scale size={14} className="text-emerald-500" /> Najwyższa Rentowność
                                        </h3>
                                        <div className="space-y-3">
                                            {managerInsights.topMarginProjects.length === 0 ? (
                                                <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-50">
                                                    <AlertCircle size={24} className="text-zinc-400" />
                                                    <p className="text-zinc-400 text-xs font-bold uppercase">Brak projektów {'>'} 30%</p>
                                                </div>
                                            ) : (
                                                managerInsights.topMarginProjects.map((p, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all group">
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter uppercase">{p.number}</div>
                                                            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate uppercase tracking-tight">{p.customer}</div>
                                                        </div>
                                                        <div className="text-right ml-4">
                                                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">+{p.margin}%</div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. WORKLOAD BOTTLENECKS */}
                                    <div className="premium-card p-6 flex flex-col h-full">
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <User size={14} className="text-orange-500" /> Aktywność Zespołu
                                        </h3>
                                        <div className="space-y-4 flex-1">
                                            {managerInsights.userPerformance.slice(0, 5).map((u, i) => (
                                                <div key={i} className="space-y-1.5 group">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-black">{u.userName.charAt(0)}</div>
                                                            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-tight">{u.userName}</div>
                                                        </div>
                                                        <div className="text-xs font-black text-zinc-400 uppercase">{u.activeProjects} AKTYWNYCH</div>
                                                    </div>
                                                    <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${u.activeProjects > 3 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (u.activeProjects / 5) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                            <button className="w-full py-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all flex items-center justify-center gap-2">
                                                Zarzadzaj Obciążeniem <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* EMPLOYEE PERFORMANCE TABLE */}
                                <div className="premium-card overflow-hidden">
                                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                            <Briefcase size={16} className="text-zinc-500" /> Wydajność Operacyjna
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-400 font-black uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
                                                <tr>
                                                    <th className="px-6 py-4">Inżynier / Specjalista</th>
                                                    <th className="px-6 py-4 text-right">Projekty</th>
                                                    <th className="px-6 py-4 text-right">Wartość Sumaryczna</th>
                                                    <th className="px-6 py-4 text-right">Śr. Marża</th>
                                                    <th className="px-6 py-4 text-center">Load</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                {managerInsights.userPerformance.map((u, i) => (
                                                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black">
                                                                    {u.userName.charAt(0)}
                                                                </div>
                                                                <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-tight text-xs">{u.userName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-xs font-black text-zinc-500">{u.projectCount}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-xs font-black text-zinc-900 dark:text-white">{formatNumber(u.totalValue)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`px-2 py-1 rounded-md font-black text-xs uppercase tracking-tighter ${u.avgMargin > 20 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                                                {Math.round(u.avgMargin)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex justify-center">
                                                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${u.activeProjects > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'}`}></div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

                        {/* COLUMN 1: CALENDAR / AGENDA */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="premium-card overflow-hidden flex flex-col h-[580px]">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
                                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <Calendar size={18} className="text-amber-500" /> Terminarz
                                    </h2>
                                    <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">NADCHODZĄCE</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                                    {events.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2 opacity-50">
                                            <Calendar size={32} strokeWidth={1} />
                                            <p className="text-xs font-black uppercase">Brak wydarzeń</p>
                                        </div>
                                    ) : (
                                        events.map((evt) => (
                                            <div key={evt.id} className={`p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-amber-500/30 transition-all hover-lift group relative overflow-hidden bg-white dark:bg-zinc-900/50`}>
                                                <div className="flex justify-between items-start mb-2 relative z-10">
                                                    <span className="font-mono font-black text-xs text-zinc-900 dark:text-white tracking-tighter">{evt.date.toLocaleDateString()}</span>
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 group-hover:border-amber-500/50 group-hover:text-amber-500 transition-colors">{evt.type}</span>
                                                </div>
                                                <div className="font-black text-xs text-zinc-800 dark:text-zinc-200 mb-1 uppercase tracking-tight relative z-10">{evt.title}</div>
                                                <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-1 truncate relative z-10">
                                                    <Briefcase size={10} />
                                                    {evt.projectNumber} | {evt.customer}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: GANTT CHART (REPLACES RECENT) */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="premium-card overflow-hidden flex flex-col h-[580px]">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
                                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={18} className="text-blue-500" /> Harmonogram Montaży
                                    </h2>
                                    <label className="flex items-center gap-2 text-xs font-black uppercase text-zinc-400 cursor-pointer select-none hover:text-blue-500 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={showDrafts}
                                            onChange={e => setShowDrafts(e.target.checked)}
                                            className="w-3 h-3 rounded border-zinc-300 text-blue-500 focus:ring-blue-500 bg-transparent"
                                        />
                                        Drafty
                                    </label>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {ganttData.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2 opacity-50 p-8 text-center">
                                            <Clock size={32} strokeWidth={1} />
                                            <p className="text-xs font-black uppercase">Brak zaplanowanych prac</p>
                                            {!showDrafts && <span className="text-[10px] font-bold">WŁĄCZ DRAFTY ABY WIDZIEĆ PROJEKTY ROBOCZE</span>}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {ganttData.map(proj => (
                                                <div key={proj.projectId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                    <GanttRow
                                                        project={proj}
                                                        isExpanded={!!expandedGanttProjects[proj.projectId]}
                                                        onToggle={() => setExpandedGanttProjects(prev => ({ ...prev, [proj.projectId]: !prev[proj.projectId] }))}
                                                        onOpen={() => handleProjectClick(proj.handle)}
                                                        onOpenOrders={() => handleOpenOrderPreview(proj.handle)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: STICKY NOTES */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="premium-card overflow-hidden flex flex-col h-[580px] bg-zinc-50/30 dark:bg-black/10">
                                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
                                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <StickyNote size={18} className="text-yellow-500" /> Notatki Projektowe
                                    </h2>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                                    {notes.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2 opacity-50 uppercase text-xs font-black">
                                            Brak aktywnych notatek
                                        </div>
                                    ) : (
                                        notes.map(note => (
                                            <div key={note.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30 p-5 rounded-xl shadow-sm relative group hover:shadow-md transition-all hover-lift">
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRight size={14} className="text-yellow-600 dark:text-yellow-500 cursor-pointer" />
                                                </div>
                                                <div className="text-xs font-black uppercase text-yellow-700 dark:text-yellow-500 mb-3 truncate pr-6 tracking-widest font-mono">
                                                    {note.projectNumber} | {note.customer}
                                                </div>
                                                <div className="text-[13px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap max-h-32 overflow-hidden text-ellipsis font-medium leading-relaxed font-mono">
                                                    {note.text}
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-yellow-200/40 dark:border-yellow-800/20 text-[10px] font-black text-yellow-600/50 dark:text-yellow-500/40 uppercase tracking-tighter font-mono">
                                                    DODANO: {note.date.toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}

            {activeHubTab === 'LOGISTICS' && (
                <div className="animate-fadeIn">
                    <LogisticsHubView onOpenProject={onOpenProject} onAction={onAction} />
                </div>
            )}

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

            {showApprovalModal && approvalValidation && (
                <ApprovalRequestModal
                    isOpen={showApprovalModal}
                    onClose={() => setShowApprovalModal(false)}
                    onConfirm={handleConfirmApproval}
                    autoValidation={approvalValidation}
                />
            )}

            {showCorrectionModal && correctionProject && (
                <CorrectionRequestModal
                    isOpen={showCorrectionModal}
                    onClose={() => setShowCorrectionModal(false)}
                    onConfirm={handleConfirmCorrection}
                    projectNumber={correctionProject.project_id || 'BezNumeru'}
                />
            )}
        </div>
    );
};


