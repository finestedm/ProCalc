import React, { useState, useEffect, useRef } from 'react';
import {
    AppState,
    CalculationMode,
    Currency,
    EMPTY_CALCULATION,
    CalculationData,
    ViewMode,
    Supplier,
    TransportItem,
    HistoryEntry,
    ProjectFile,
    VariantItemType,
    VariantItem,
    DEFAULT_SETTINGS,
    ProjectStage,
    AddressData,
    CustomInstallationItem,
    CalculationScenario,
    EMPTY_PAYMENT_TERMS
} from './types';
import { CustomerSection } from './components/CustomerSection';
import { ProjectMetaForm } from './components/ProjectMetaForm';
import { SuppliersSection } from './components/SuppliersSection';
import { TransportSection } from './components/TransportSection';
import { InstallationSection } from './components/InstallationSection';
import { SummarySection } from './components/SummarySection';
import { OtherCostsSection } from './components/OtherCostsSection';
import { SidePanel } from './components/SidePanel';
import { LogisticsView } from './components/LogisticsView';
import { ComparisonView } from './components/ComparisonView';
import { CalculationComparisonView } from './components/CalculationComparisonView';
import { HistoryModal } from './components/HistoryModal';
import { ProjectNotesView } from './components/ProjectNotesView';
import { FinalCalculationView } from './components/FinalCalculationView';
import { VariantsSection } from './components/VariantsSection';
import { DocumentsView } from './components/DocumentsView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Header } from './components/Header';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { QuickStartModal } from './components/QuickStartModal';
import { PackageCreationModal } from './components/PackageCreationModal';
import { ScenarioTabs } from './components/ScenarioTabs';
import { ScenarioManagerModal } from './components/ScenarioManagerModal';
import { ScrollSpy } from './components/ScrollSpy';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { DashboardView } from './components/DashboardView';
import { ProfileEditModal } from './components/ProfileEditModal';
import { UnlockRequestModal } from './components/UnlockRequestModal';
import { RestoreSessionModal } from './components/RestoreSessionModal';
import { fetchEurRate } from './services/currencyService';
import { generateDiff } from './services/diffService';
import { storageService } from './services/storage';
import { useAuth } from './contexts/AuthContext';
import { calculateProjectCosts, ensureTransportData } from './services/calculationService';
import { toISODateString } from './services/dateUtils';
import { Moon, Sun, History, Download, Upload, FilePlus, HardDrive, MousePointer2, X, Plus, Check, Trash2, Settings, Shield, AlertCircle, User, Keyboard, LogOut } from 'lucide-react';

const STORAGE_KEY = 'procalc_data_v1';
const THEME_KEY = 'procalc_theme';

// --- ANIMATION HELPER COMPONENT ---
interface FlyingParticleProps {
    id: number;
    startX: number;
    startY: number;
    label: string;
    onComplete: (id: number) => void;
}

const FlyingParticle: React.FC<FlyingParticleProps> = ({ id, startX, startY, label, onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(() => onComplete(id), 800); // Match animation duration
        return () => clearTimeout(timer);
    }, [id, onComplete]);

    const targetX = 30;
    const targetY = window.innerHeight - 30;

    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    return (
        <div
            className="fixed z-[9999] pointer-events-none bg-zinc-900 text-white dark:bg-white dark:text-black text-[10px] font-mono font-bold px-2 py-1 shadow-sm border border-zinc-500 flex items-center gap-1"
            style={{
                left: startX,
                top: startY,
                '--tx': `${deltaX}px`,
                '--ty': `${deltaY}px`,
                animation: 'flyToBasket 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
            } as React.CSSProperties}
        >
            <Plus size={10} strokeWidth={3} /> {label}
        </div>
    );
};

// --- FUZZY MATCHING HELPERS ---

const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const normalizeForComparison = (name: string): string => {
    return name.toLowerCase()
        // Remove legal suffixes
        .replace(/sp\.? z o\.?o\.?/g, '')
        .replace(/spółka z o\.?o\.?/g, '')
        .replace(/s\.?a\.?/g, '')
        .replace(/spółka akcyjna/g, '')
        .replace(/sp\.?k\.?/g, '')
        .replace(/sp\.?j\.?/g, '')
        .replace(/gmbh/g, '')
        // Remove special chars and spaces to compare core name
        .replace(/[^a-z0-9]/g, '');
};

// --- SCENARIO DATA HELPERS ---
const extractScenarioData = (data: CalculationData, id: string, name: string): CalculationScenario => {
    return {
        id,
        name,
        suppliers: data.suppliers,
        transport: data.transport,
        otherCosts: data.otherCosts,
        otherCostsScratchpad: data.otherCostsScratchpad || [],
        installation: data.installation,
        nameplateQty: data.nameplateQty,
        tasks: data.tasks,
        projectNotes: data.projectNotes,
        variants: data.variants,
        paymentTerms: data.paymentTerms || EMPTY_PAYMENT_TERMS
    };
};

const mergeScenarioData = (globalSource: CalculationData, scenario: CalculationScenario): CalculationData => {
    return {
        ...globalSource, // Keep global fields (payer, meta, etc.)
        suppliers: scenario.suppliers,
        transport: scenario.transport,
        otherCosts: scenario.otherCosts,
        otherCostsScratchpad: scenario.otherCostsScratchpad,
        installation: scenario.installation,
        nameplateQty: scenario.nameplateQty,
        tasks: scenario.tasks,
        projectNotes: scenario.projectNotes,
        variants: scenario.variants,
        paymentTerms: scenario.paymentTerms
    };
};

const App: React.FC = () => {
    // Authentication
    const { user, profile, loading: authLoading, signOut } = useAuth();

    const [appState, setAppState] = useState<AppState>({
        initial: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
        final: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
        scenarios: [],
        activeScenarioId: 'default',
        mode: CalculationMode.INITIAL,
        stage: 'DRAFT', // Initialize Stage
        viewMode: ViewMode.DASHBOARD,
        exchangeRate: 4.30,
        offerCurrency: Currency.EUR,
        clientCurrency: Currency.PLN,
        targetMargin: 20,
        manualPrice: null,
        finalManualPrice: null,
        globalSettings: { ...DEFAULT_SETTINGS },
        activeHubTab: 'DASH'
    });

    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [showSupplierComparison, setShowSupplierComparison] = useState(false); // New State for Supplier Modal
    const [showHistory, setShowHistory] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showProjectManager, setShowProjectManager] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showQuickStart, setShowQuickStart] = useState(false);
    const [showPackageModal, setShowPackageModal] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showScenarioManager, setShowScenarioManager] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [lastSessionData, setLastSessionData] = useState<any>(null);
    const [pendingSave, setPendingSave] = useState<{ stage: ProjectStage, reason?: string, isLogistics?: boolean } | null>(null);

    // Package Editing State
    const [editingPackageItem, setEditingPackageItem] = useState<CustomInstallationItem | null>(null);

    // Synchronized state for top forms
    const [isHeaderFormsOpen, setIsHeaderFormsOpen] = useState(true);

    // Mobile Sidebar State
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    const [pickingVariantId, setPickingVariantId] = useState<string | null>(null);
    const [pickedItemsBuffer, setPickedItemsBuffer] = useState<VariantItem[]>([]);
    const [flyingParticles, setFlyingParticles] = useState<FlyingParticleProps[]>([]);
    const [basketPulse, setBasketPulse] = useState(false);

    const [dirHandle, setDirHandle] = useState<any>(null);

    const [dialogConfig, setDialogConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isDanger?: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        neutralLabel?: string;
        onConfirm: () => void;
        onNeutral?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // Ref for Main Scroll Container
    const mainScrollRef = useRef<HTMLDivElement>(null);

    const triggerConfirm = (
        title: string,
        message: string,
        onConfirm: () => void,
        isDanger = false,
        options?: { confirmLabel?: string, cancelLabel?: string, neutralLabel?: string, onNeutral?: () => void }
    ) => {
        setDialogConfig({
            isOpen: true,
            title,
            message,
            isDanger,
            confirmLabel: options?.confirmLabel,
            cancelLabel: options?.cancelLabel,
            neutralLabel: options?.neutralLabel,
            onNeutral: options?.onNeutral ? () => {
                options.onNeutral!();
                setDialogConfig(prev => ({ ...prev, isOpen: false }));
            } : undefined,
            onConfirm: () => {
                onConfirm();
                setDialogConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const [past, setPast] = useState<AppState[]>([]);
    const [future, setFuture] = useState<AppState[]>([]);
    const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
    const [snackbar, setSnackbar] = useState<{ message: string, action?: () => void, actionLabel?: string } | null>(null);

    const lastSnapshot = useRef<AppState>(appState);
    const isUndoRedoOperation = useRef(false);
    const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const projectInputRef = useRef<HTMLInputElement>(null);

    const getHistoryState = (state: AppState) => {
        const { viewMode, ...dataState } = state;
        return dataState;
    };

    // Helper to detect structural changes (Add/Remove items) which should trigger instant snapshots
    const getStructureHash = (state: AppState) => {
        const getDataHash = (d: CalculationData) => {
            return [
                d.suppliers.length,
                d.suppliers.map(s => s.items.length).join('-'),
                d.transport.length,
                d.otherCosts.length,
                d.installation.stages.length,
                d.installation.customTimelineItems?.length || 0,
                d.tasks?.length || 0,
                d.variants?.length || 0,
                // Track items within variants and hierarchy to ensure instant undo for variant edits
                d.variants?.map(v => v.items.length).join('-'),
                d.variants?.map(v => v.parentId || 'root').join('-'),
                // Track global installation items
                d.installation.customItems.length
            ].join('|');
        };
        return `${getDataHash(state.initial)}#${getDataHash(state.final)}`;
    };

    const applyLoadedData = (parsed: any) => {
        let shouldUpdateRate = true;
        if (parsed) {
            // Determine if we should lock the rate (OPENING or FINAL stage/mode)
            const currentStage = parsed.stage || (parsed.appState ? parsed.appState.stage : 'DRAFT');
            const currentMode = parsed.mode || (parsed.appState ? parsed.appState.mode : CalculationMode.INITIAL);

            if (currentStage === 'OPENING' || currentStage === 'FINAL' || currentMode === CalculationMode.FINAL) {
                shouldUpdateRate = false;
            }

            if (parsed.initial && typeof parsed.initial.nameplateQty === 'undefined') parsed.initial.nameplateQty = 0;
            if (parsed.final && typeof parsed.final.nameplateQty === 'undefined') parsed.final.nameplateQty = 0;
            if (parsed.initial && typeof parsed.initial.installation.finalInstallationCosts === 'undefined') parsed.initial.installation.finalInstallationCosts = [];
            if (parsed.final && typeof parsed.final.installation.finalInstallationCosts === 'undefined') parsed.final.installation.finalInstallationCosts = [];
            if (parsed.initial && !parsed.initial.variants) parsed.initial.variants = [];
            if (parsed.final && !parsed.final.variants) parsed.final.variants = [];
            if (parsed.initial && !parsed.initial.otherCostsScratchpad) parsed.initial.otherCostsScratchpad = [];
            if (parsed.final && !parsed.final.otherCostsScratchpad) parsed.final.otherCostsScratchpad = [];
            if (parsed.finalManualPrice === undefined) parsed.finalManualPrice = null;
            if (parsed.stage === undefined) parsed.stage = 'DRAFT'; // Default stage for legacy

            // Scenario backward compatibility
            if (!parsed.scenarios || parsed.scenarios.length === 0) {
                const defaultScenario = extractScenarioData(parsed.initial || EMPTY_CALCULATION, 'default', 'Wariant Główny');
                parsed.scenarios = [defaultScenario];
                parsed.activeScenarioId = 'default';
            }

            const mergedState = { ...appState, ...parsed };
            setAppState(mergedState);
            lastSnapshot.current = mergedState;
        } else {
            // First load defaults if no storage
            const defaultSettings = { ...DEFAULT_SETTINGS };
            const init = JSON.parse(JSON.stringify(EMPTY_CALCULATION));
            const fin = JSON.parse(JSON.stringify(EMPTY_CALCULATION));

            // Init default scenario
            const defaultScenario = extractScenarioData(init, 'default', 'Wariant Główny');

            setAppState(prev => ({
                ...prev,
                initial: init,
                final: fin,
                globalSettings: defaultSettings,
                scenarios: [defaultScenario],
                activeScenarioId: 'default'
            }));

            // No saved data -> Suggest Quick Start via Snackbar
            setSnackbar({
                message: "Witaj! Czy chcesz skonfigurować nowy projekt?",
                action: () => setShowQuickStart(true),
                actionLabel: "SZYBKI START"
            });
            setTimeout(() => setSnackbar(null), 10000);
        }

        // Only auto-update exchange rate if NOT locked (DRAFT stage)
        if (shouldUpdateRate) {
            fetchEurRate().then(rate => {
                if (rate) setAppState(prev => {
                    if (prev.mode === CalculationMode.FINAL || prev.stage === 'OPENING' || prev.stage === 'FINAL') return prev;
                    return ({ ...prev, exchangeRate: rate });
                });
            });
        }
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialDark = savedTheme === 'dark' || (!savedTheme && systemDark);

        setIsDarkMode(initialDark);
        if (initialDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);

                // [NEW] Intelligent Session Detection
                // We check if the saved data has any actual content (customer name or items)
                const hasContent =
                    (parsed.initial?.orderingParty?.name && parsed.initial.orderingParty.name !== '') ||
                    (parsed.initial?.suppliers?.length > 0) ||
                    (parsed.initial?.meta?.projectNumber && parsed.initial.meta.projectNumber !== '');

                if (hasContent) {
                    setLastSessionData(parsed);
                    setShowRestoreModal(true);
                } else {
                    // It's empty-ish, just load it silenty
                    applyLoadedData(parsed);
                }
            } catch (e) {
                console.error("Failed to load save state", e);
            }
        } else {
            applyLoadedData(null);
        }

        setIsLoaded(true);

        // Request Notification Permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    // --- SESSION RESTORATION HANDLERS ---
    const handleRestoreSession = () => {
        if (lastSessionData) {
            applyLoadedData(lastSessionData);
        }
        setShowRestoreModal(false);
        setLastSessionData(null);
    };

    const handleDiscardSession = () => {
        // Just start fresh (already handled by applyLoadedData(null))
        applyLoadedData(null);
        setShowRestoreModal(false);
        setLastSessionData(null);
    };

    // --- SCENARIO MANAGEMENT LOGIC ---
    const handleAddScenario = () => {
        setAppState(prev => {
            const newId = Math.random().toString(36).substr(2, 9);
            // Clone current ACTIVE data for new scenario to start with
            const newScenario = extractScenarioData(prev.initial, newId, `Wariant ${prev.scenarios.length + 1}`);

            const updatedScenarios = prev.scenarios.map(s =>
                s.id === prev.activeScenarioId
                    ? extractScenarioData(prev.initial, s.id, s.name)
                    : s
            );

            return {
                ...prev,
                scenarios: [...updatedScenarios, newScenario],
                activeScenarioId: newId,
            };
        });
        showSnackbar("Dodano nowy wariant (skopiowano z obecnego)");
    };

    const handleAddEmptyScenario = () => {
        setAppState(prev => {
            const newId = Math.random().toString(36).substr(2, 9);
            const newScenario = extractScenarioData(
                JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
                newId,
                `Wariant Pusty ${prev.scenarios.length + 1}`
            );

            const updatedScenarios = prev.scenarios.map(s =>
                s.id === prev.activeScenarioId
                    ? extractScenarioData(prev.initial, s.id, s.name)
                    : s
            );

            return {
                ...prev,
                scenarios: [...updatedScenarios, newScenario],
                activeScenarioId: newId,
                initial: mergeScenarioData(prev.initial, newScenario)
            };
        });
        showSnackbar("Dodano nowy pusty wariant");
    };

    const handleClearScenarioData = (id: string) => {
        setAppState(prev => {
            const empty = JSON.parse(JSON.stringify(EMPTY_CALCULATION));
            const updatedScenarios = prev.scenarios.map(s => {
                if (s.id === id) {
                    return {
                        ...s,
                        suppliers: [],
                        transport: [],
                        otherCosts: [],
                        otherCostsScratchpad: [],
                        installation: empty.installation,
                        tasks: [],
                        variants: []
                    };
                }
                // If it's not the active one, we assume its stored data is current or handled by App sync
                // NOTE: If we clear a non-active scenario, we just update the list array.
                // If we clear the ACTIVE scenario, we must also update `prev.initial`.
                return s;
            });

            let newInitial = prev.initial;
            if (id === prev.activeScenarioId) {
                const target = updatedScenarios.find(s => s.id === id)!;
                newInitial = mergeScenarioData(prev.initial, target);
            }

            return {
                ...prev,
                scenarios: updatedScenarios,
                initial: newInitial
            };
        });
        showSnackbar("Wyczyszczono dane wariantu");
    };

    const handleCopyModules = (targetId: string, sourceId: string, modules: string[]) => {
        setAppState(prev => {
            const source = prev.scenarios.find(s => s.id === sourceId);
            // If source is active, use current appState.initial as source of truth
            const sourceData = (sourceId === prev.activeScenarioId)
                ? extractScenarioData(prev.initial, sourceId, source!.name)
                : source;

            if (!sourceData) return prev;

            // Deep copy source data using JSON
            const dataToCopy = JSON.parse(JSON.stringify(sourceData));

            const updatedScenarios = prev.scenarios.map(s => {
                if (s.id === targetId) {
                    const updated = { ...s };
                    if (modules.includes('suppliers')) updated.suppliers = dataToCopy.suppliers;
                    if (modules.includes('transport')) updated.transport = dataToCopy.transport;
                    if (modules.includes('installation')) updated.installation = dataToCopy.installation;
                    if (modules.includes('otherCosts')) {
                        updated.otherCosts = dataToCopy.otherCosts;
                        updated.otherCostsScratchpad = dataToCopy.otherCostsScratchpad;
                    }
                    if (modules.includes('variants')) updated.variants = dataToCopy.variants;
                    return updated;
                }
                return s;
            });

            let newInitial = prev.initial;
            if (targetId === prev.activeScenarioId) {
                const target = updatedScenarios.find(s => s.id === targetId)!;
                newInitial = mergeScenarioData(prev.initial, target);
            }

            return {
                ...prev,
                scenarios: updatedScenarios,
                initial: newInitial
            };
        });
        showSnackbar("Skopiowano wybrane moduły");
    };

    const handleSwitchScenario = (id: string) => {
        setAppState(prev => {
            if (prev.activeScenarioId === id) return prev;

            // 1. Save current state to old scenario in list
            const updatedScenarios = prev.scenarios.map(s =>
                s.id === prev.activeScenarioId
                    ? extractScenarioData(prev.initial, s.id, s.name)
                    : s
            );

            // 2. Load new scenario data
            const targetScenario = updatedScenarios.find(s => s.id === id);
            if (!targetScenario) return prev; // Error safety

            const newInitial = mergeScenarioData(prev.initial, targetScenario);

            return {
                ...prev,
                scenarios: updatedScenarios,
                activeScenarioId: id,
                initial: newInitial
            };
        });
    };

    const updateScenariosList = (newScenarios: CalculationScenario[]) => {
        setAppState(prev => ({ ...prev, scenarios: newScenarios }));
    };

    const handleDeleteScenario = (id: string) => {
        setAppState(prev => {
            // Prevent deleting the last one
            if (prev.scenarios.length <= 1) {
                showSnackbar("Musi pozostać przynajmniej jeden wariant.");
                return prev;
            }

            const newScenarios = prev.scenarios.filter(s => s.id !== id);

            // If we deleted the active one, switch to the first available
            if (prev.activeScenarioId === id) {
                const nextScenario = newScenarios[0];
                const newInitial = mergeScenarioData(prev.initial, nextScenario);
                return {
                    ...prev,
                    scenarios: newScenarios,
                    activeScenarioId: nextScenario.id,
                    initial: newInitial
                };
            }

            return { ...prev, scenarios: newScenarios };
        });
    };

    const handleRenameScenario = (id: string, name: string) => {
        setAppState(prev => ({
            ...prev,
            scenarios: prev.scenarios.map(s => s.id === id ? { ...s, name } : s)
        }));
    };

    const handleDuplicateScenario = (id: string) => {
        setAppState(prev => {
            const source = prev.scenarios.find(s => s.id === id);
            if (!source) return prev;

            // If source is active, take data from `initial` state to be most up to date
            const sourceData = source.id === prev.activeScenarioId
                ? extractScenarioData(prev.initial, source.id, source.name)
                : source;

            const newId = Math.random().toString(36).substr(2, 9);
            const newScenario = { ...sourceData, id: newId, name: `${source.name} (Kopia)` };

            // If we are duplicating active, ensure we save active first
            const updatedScenarios = prev.scenarios.map(s =>
                s.id === prev.activeScenarioId
                    ? extractScenarioData(prev.initial, s.id, s.name)
                    : s
            );

            return {
                ...prev,
                scenarios: [...updatedScenarios, newScenario],
                activeScenarioId: newId,
                initial: mergeScenarioData(prev.initial, newScenario) // Switch to copy
            };
        });
        showSnackbar("Zduplikowano wariant");
    };

    // --- END SCENARIO LOGIC ---

    // --- BROWSER TAB TITLE UPDATE ---
    useEffect(() => {
        if (!isLoaded) return;
        const activeData = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
        const projectNum = activeData.meta.projectNumber;
        const clientName = activeData.orderingParty.name;

        if (projectNum || clientName) {
            const parts = [];
            if (projectNum) parts.push(projectNum);
            if (clientName) parts.push(clientName);
            document.title = `${parts.join(' ')} | JH WE-Calc`;
        } else {
            document.title = 'JH WE-Calc - Kalkulator Ceny Projektu';
        }
    }, [appState.initial.meta.projectNumber, appState.initial.orderingParty.name, appState.final.meta.projectNumber, appState.final.orderingParty.name, appState.mode, isLoaded]);

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleGlobalKeys = (e: KeyboardEvent) => {
            // Check if user is typing in an input field
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // 1. Navigation (Alt + Shift + Number) - Works everywhere, avoids browser conflict
            if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
                if (e.code === 'Digit1') setAppState(prev => ({ ...prev, viewMode: ViewMode.CALCULATOR }));
                if (e.code === 'Digit2') setAppState(prev => ({ ...prev, viewMode: ViewMode.LOGISTICS }));
                if (e.code === 'Digit3') setAppState(prev => ({ ...prev, viewMode: ViewMode.NOTES }));
                if (e.code === 'Digit4') setAppState(prev => ({ ...prev, viewMode: ViewMode.DOCUMENTS }));
            }

            // 2. Actions (Alt + Letter) - Ensure no shift to distinguish
            if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                if (e.code === 'KeyQ') setAppState(prev => ({ ...prev, mode: CalculationMode.INITIAL }));
                if (e.code === 'KeyW') setAppState(prev => ({ ...prev, mode: CalculationMode.FINAL }));

                if (e.code === 'KeyC') setShowComparison(true);
                if (e.code === 'KeyT') toggleTheme();
                if (e.key === '/' || e.key === '?') setShowShortcuts(true); // Help

                if (e.code === 'KeyS') setShowMobileSidebar(prev => !prev);
            }

            // 3. App Control (Ctrl + Letter)
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                if (isTyping) return; // Allow native input undo
                e.preventDefault();
                handleUndo(); // Always try to undo, handle logic inside
                return;
            }

            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
                if (isTyping) return;
                e.preventDefault();
                if (future.length > 0) handleRedo();
                return;
            }

            // Save: Ctrl+S
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (dirHandle) {
                    handleSmartSave(appState.stage);
                } else {
                    setShowProjectManager(true);
                    showSnackbar("Otwórz Menedżera, aby zapisać projekt.");
                }
                return;
            }

            // Open Manager: Ctrl+O
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                setShowProjectManager(true);
                return;
            }

            // Export: Ctrl+E
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                handleExport();
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [past, future, appState, dirHandle]); // Ensure deps are fresh for handlers

    // --- NOTIFICATION SYSTEM ---
    useEffect(() => {
        const checkTasks = () => {
            if (!("Notification" in window) || Notification.permission !== "granted") return;

            const mode = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            const tasks = appState[mode].tasks || [];
            const today = toISODateString(new Date());
            let updated = false;

            const newTasks = tasks.map(task => {
                if (!task.isCompleted && task.dueDate && !task.reminderShown) {
                    if (task.dueDate <= today) {
                        new Notification("Przypomnienie ProCalc", {
                            body: `Zadanie: ${task.text}`,
                            icon: '/favicon.ico'
                        });
                        updated = true;
                        return { ...task, reminderShown: true };
                    }
                }
                return task;
            });

            if (updated) {
                setAppState(prev => ({
                    ...prev,
                    [mode]: {
                        ...prev[mode],
                        tasks: newTasks
                    }
                }));
            }
        };

        const interval = setInterval(checkTasks, 60000); // Check every minute
        // Initial check after load
        if (isLoaded) checkTasks();

        return () => clearInterval(interval);
    }, [appState, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;

        if (isUndoRedoOperation.current) {
            isUndoRedoOperation.current = false;
            lastSnapshot.current = appState;
            return;
        }

        if (historyTimeoutRef.current) {
            clearTimeout(historyTimeoutRef.current);
        }

        // Smart Debouncing Logic
        const isStructuralChange = getStructureHash(lastSnapshot.current) !== getStructureHash(appState);
        // Instant (0ms) for structural changes (delete/add), reduced delay (500ms) for typing
        const delay = isStructuralChange ? 0 : 500;

        historyTimeoutRef.current = setTimeout(() => {
            const currentDataState = getHistoryState(appState);
            const lastDataState = getHistoryState(lastSnapshot.current);

            if (JSON.stringify(currentDataState) !== JSON.stringify(lastDataState)) {
                const changes = generateDiff(lastSnapshot.current, appState);
                const description = changes.length === 1 ? changes[0] : `${changes.length} zmian`;

                setPast(prev => {
                    const newPast = [...prev, lastSnapshot.current];
                    return newPast.slice(-50);
                });

                const now = new Date();
                setHistoryLog(prev => [{
                    timestamp: now.getTime(),
                    state: lastSnapshot.current,
                    description: description,
                    changes: changes
                }, ...prev].slice(0, 50));

                setFuture([]);
                lastSnapshot.current = appState;
            } else {
                lastSnapshot.current = appState;
            }
        }, delay);

        // ALSO: Sync current state to scenarios list on every update if it's active
        // This ensures if we switch tabs, we have latest data
        setAppState(prev => {
            if (prev.mode !== CalculationMode.INITIAL) return prev;

            // Check if active scenario in list is outdated compared to current initial
            const activeInList = prev.scenarios.find(s => s.id === prev.activeScenarioId);
            if (!activeInList) return prev;

            // Simple check if sync needed (deep compare might be expensive, but necessary for consistency)
            // We can rely on `lastSnapshot` diff logic or just update blindly here since it's a setter
            // Optimized: Update only if `scenarios` state doesn't match `initial` state for active ID

            // Actually, updating `scenarios` array on every keystroke in `initial` might cause re-renders.
            // Strategy: `scenarios` array is the storage. `initial` is the view.
            // We sync strictly when switching tabs or saving. 
            // BUT: If user saves project, we need scenarios up to date.
            // So let's keep them synced.

            const updatedScenarios = prev.scenarios.map(s =>
                s.id === prev.activeScenarioId
                    ? extractScenarioData(prev.initial, s.id, s.name)
                    : s
            );

            if (JSON.stringify(updatedScenarios) === JSON.stringify(prev.scenarios)) return prev;

            return { ...prev, scenarios: updatedScenarios };
        });

        // [NEW] DEBOUNCED LOCAL STORAGE SAVE
        const saveTimer = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        }, 1000); // 1s debounce

        return () => {
            clearTimeout(saveTimer);
            if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        };
    }, [appState, isLoaded]);

    // --- VALIDATION & AUTO-SAVE LOGIC ---

    const validateProject = (stage: ProjectStage): string[] => {
        const errors: string[] = [];
        const init = appState.initial;

        if (stage === 'OPENING' || stage === 'FINAL') {
            // Strict Metadata Requirements
            if (!init.meta.installationType) errors.push("Brak Typu Projektu (Szczegóły Projektu).");
            if (!init.meta.invoiceText) errors.push("Brak Tekstu na Fakturze (Szczegóły Projektu).");

            // Common requirements for Opening & Final
            if (!init.meta.orderNumber) errors.push("Brak Numeru Zamówienia.");
            if (!init.meta.projectNumber) errors.push("Brak Numeru Projektu (CRM).");
            if (!/^\d{8}$/.test(init.meta.projectNumber)) errors.push("Numer Projektu (CRM) musi składać się z dokładnie 8 cyfr.");

            if (!init.meta.orderDate) errors.push("Brak Daty Zamówienia.");

            if (!init.meta.salesPerson) errors.push("Brak Handlowca (Wymagane z listy).");
            if (!init.meta.assistantPerson) errors.push("Brak Wsparcia Sprzedaży (Wymagane z listy).");

            // Strict Customer Data Validation
            const checkAddress = (addr: AddressData, type: string) => {
                if (!addr.name) errors.push(`Brak nazwy (${type}).`);
                if (!addr.street) errors.push(`Brak ulicy (${type}).`);
                if (!addr.zip) errors.push(`Brak kodu pocztowego (${type}).`);
                if (!addr.city) errors.push(`Brak miasta (${type}).`);
                if (!addr.nip) errors.push(`Brak NIP (${type}).`);
            };

            checkAddress(init.payer, "Płatnik");
            checkAddress(init.recipient, "Odbiorca");
            checkAddress(init.orderingParty, "Zamawiający");

            if (!init.payer.clientId) errors.push("Brak ID Klienta (Wymagane do realizacji).");

            // Check suppliers
            init.suppliers.forEach(s => {
                if (s.isIncluded !== false && !s.isOrm) {
                    if ((!s.street || !s.nip) && (s.name === 'Inny Dostawca' || s.name === 'Nowy Dostawca')) {
                        errors.push(`Dostawca "${s.customTabName || s.name}" wymaga uzupełnienia danych adresowych.`);
                    }
                }
            });
        }

        if (stage === 'FINAL') {
            // Strict SAP format: 46120 + 5 digits = 10 digits total
            if (!/^46120\d{5}$/.test(init.meta.sapProjectNumber)) {
                errors.push("Niepoprawny numer SAP (Musi zaczynać się od 46120 i mieć 10 cyfr).");
            }

            // Check if any final costs are entered (Basic check)
            const hasFinalData =
                appState.final.suppliers.some(s => s.finalCostOverride !== undefined) ||
                appState.final.transport.some(t => t.finalCostOverride !== undefined) ||
                appState.final.otherCosts.some(c => c.finalCostOverride !== undefined) ||
                (appState.final.installation.finalInstallationCosts && appState.final.installation.finalInstallationCosts.length > 0);

            if (!hasFinalData) errors.push("Brak wprowadzonych kosztów rzeczywistych (Faktur) w Rozliczeniu Końcowym.");
        }

        return errors;
    };

    const sanitizeName = (name: string): string => {
        return name.replace(/[^a-zA-Z0-9 \-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').trim() || 'Nieznany';
    };

    const handleSmartSave = async (stage: ProjectStage, reasonArg?: string | any, isLogistics?: boolean, stateOverride?: AppState): Promise<boolean> => {
        // VALIDATION: Installation Type is required for ANY save
        if (!appState.initial.meta.installationType) {
            triggerConfirm(
                "Wymagane Dane",
                "Aby zapisać projekt, musisz wybrać 'Typ Projektu' w Szczegółach Projektu.",
                () => { },
                true
            );
            return false;
        }

        // --- LOCK CHECK (Project Wide) ---
        // Only check if we are not already providing a reason
        const canBypass = profile?.is_admin || profile?.role === 'manager' || profile?.role === 'logistics';
        const projectNumForLog = appState.initial.meta.projectNumber || 'BezNumeru';

        // Ensure we only treat a STRING as a valid reason.
        const reason = typeof reasonArg === 'string' ? reasonArg : undefined;

        if (!reason) {
            // CHECK LOCAL STATE FIRST (Faster/Safer) or REMOTE
            const isLocalLocked = appState.isLocked === true;
            let isRemoteLocked = false;

            console.log(`[App] handleSmartSave check for ${projectNumForLog}. Local: ${isLocalLocked}, BypassAuth: ${canBypass}`);

            if (!isLocalLocked) {
                isRemoteLocked = await storageService.isProjectLocked(projectNumForLog);
                console.log(`[App] Remote lock check: ${isRemoteLocked}`);
            }

            if (isLocalLocked || isRemoteLocked) {
                // [NEW] Logistics Takeover Check
                const isLogisticsTakeover = !!appState.logistics_operator_id;
                const isMyTakeover = appState.logistics_operator_id === profile?.id;

                if (isLogisticsTakeover && !isMyTakeover && !canBypass) {
                    triggerConfirm(
                        "Projekt Przejęty przez Logistykę",
                        "Ten projekt został przypisany do konkretnego logistyka. Tylko osoba przypisana (lub administrator) może zapisywać zmiany.",
                        () => { },
                        true
                    );
                    return false;
                }

                console.log("[App] Project is locked. Showing prompt.");
                // If locked, we MUST ask for reason.
                setPendingSave({ stage, isLogistics });
                setShowUnlockModal(true);
                return false;
            }
        }

        // --- PREPARE DATA FOR SAVE (Shared for both Local and Cloud) ---
        // Update State with current stage
        // Use override if provided, otherwise current appState
        const sourceState = stateOverride || appState;
        const newState = { ...sourceState, stage: stage };

        // If Logistics Handover, set status AND lock
        if (isLogistics) {
            newState.logisticsStatus = 'PENDING';
            newState.isLocked = true; // [NEW] Auto-lock on send
        }

        // If we have a reason, maybe append to notes?
        if (reason) {
            const noteEntry = `[${new Date().toLocaleString()}] Aktualizacja ZABLOKOWANEJ kalkulacji przez ${profile?.full_name || 'Użytkownika'}: ${reason}\n`;
            newState.initial.projectNotes = (newState.initial.projectNotes || '') + noteEntry;
        }

        // Don't set state immediately if we are just checking... actually we should update stage.
        // But let's follow performSave pattern which updates state.

        const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
        const safeProject = sanitizeName(projectNum);

        // Construct filename / data
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
        const filename = `PROCALC_${safeProject}_${stage}_${timestamp}.json`;

        const fileData: ProjectFile = {
            version: '1.0',
            timestamp: Date.now(),
            stage: stage,
            appState: newState,
            historyLog: [],
            past: [],
            future: []
        };

        // --- CLOUD SAVE LOGIC ---
        const saveToCloud = async () => {
            // Calculate summary stats for DB
            const data = fileData.appState.mode === CalculationMode.FINAL ? fileData.appState.final : fileData.appState.initial;
            const rate = fileData.appState.exchangeRate;
            const currency = fileData.appState.offerCurrency;
            const costs = calculateProjectCosts(data, rate, currency, fileData.appState.mode, fileData.appState.globalSettings.ormFeePercent, fileData.appState.targetMargin, fileData.appState.manualPrice);

            let totalPrice = 0;
            if (fileData.appState.manualPrice !== null) {
                totalPrice = fileData.appState.manualPrice;
            } else {
                const marginDecimal = fileData.appState.targetMargin / 100;
                totalPrice = costs.total / (1 - marginDecimal);
            }

            // Convert to PLN if needed, but storage expects number. 
            // Ideally we save raw values. The DB has total_cost / total_price columns.
            try {
                const newId = await storageService.saveCalculation(fileData as any, {
                    totalCost: costs.total,
                    totalPrice: totalPrice
                });

                // Update state with the new cloud ID
                setAppState(prev => ({ ...prev, activeCalculationId: newId }));
                return true;
            } catch (e: any) {
                console.error("Cloud save failed", e);
                showSnackbar(`Błąd zapisu w chmurze: ${e.message || e}`);
                return false;
            }
        };


        // --- LOCAL SAVE CHECK ---
        if (!dirHandle) {
            // [MODIFIED] Fallback to Cloud check instead of blocking
            const cloudSuccess = await saveToCloud();
            if (cloudSuccess) {
                setAppState(newState); // Update saved stage
                // showSnackbar("Zapisano w chmurze (Brak dostępu do dysku).");
                return true;
            } else {
                triggerConfirm("Błąd Zapisu", "Nie udał się zapis w chmurze. Sprawdź konsolę lub spróbuj ponownie.", () => { }, true);
                return false;
            }
        }

        // If Local Folder IS selected -> Proceed with Local Save Logic (and we can double save to cloud if we want, but let's stick to Local primary + Cloud sync if desired)
        // For now, keep original logic for local parsing which is robust (fuzzy matching folders)

        // Check for fuzzy match on client folder
        const clientName = appState.initial.orderingParty.name || 'Nieznany Klient';
        const safeClient = sanitizeName(clientName);

        try {
            // @ts-ignore
            const rootHandle = dirHandle;
            const normalizedTarget = normalizeForComparison(clientName);
            let fuzzyMatch: { name: string, distance: number } | null = null;

            // @ts-ignore
            for await (const entry of rootHandle.values()) {
                if (entry.kind === 'directory') {
                    const normalizedEntry = normalizeForComparison(entry.name);

                    // Exact match
                    if (normalizedEntry === normalizedTarget) {
                        // We need to pass fileData to performSave or let it recreate it? 
                        // performSave recreates it. That's fine.
                        return await performSave(stage, entry.name);
                    }

                    // Fuzzy check
                    const dist = levenshteinDistance(normalizedEntry, normalizedTarget);
                    const threshold = normalizedTarget.length > 8 ? 2 : 1;

                    if (dist <= threshold) {
                        fuzzyMatch = { name: entry.name, distance: dist };
                        break;
                    }
                }
            }

            if (fuzzyMatch) {
                triggerConfirm(
                    "Weryfikacja Klienta",
                    `Znaleziono istniejący folder o podobnej nazwie: "${fuzzyMatch.name}"\n\nTwój wpis: "${clientName}" (${safeClient})\n\nCzy chcesz zapisać w ISTNIEJĄCYM folderze, czy utworzyć nowy dla innego klienta?`,
                    () => performSave(stage, fuzzyMatch!.name),
                    false,
                    {
                        confirmLabel: `Tak, użyj "${fuzzyMatch.name}"`,
                        neutralLabel: `Nie, utwórz "${safeClient}"`,
                        onNeutral: () => performSave(stage, safeClient),
                        cancelLabel: "Anuluj"
                    }
                );
                return false;
            }

            // No match found -> New Client
            return await performSave(stage, safeClient);

        } catch (err) {
            console.error("Auto-save pre-check failed", err);
            // If local check fails, try cloud?
            const cloudSuccess = await saveToCloud();
            if (cloudSuccess) {
                setAppState(newState);
                showSnackbar("Zapisano w chmurze (Błąd folderu lokalnego)");
                return true;
            }

            showSnackbar("Błąd sprawdzania folderów i zapisu w chmurze.");
            return false;
        }
    };

    // Kept for Internal Local Storage usage
    const performSave = async (stage: ProjectStage, targetClientFolderName: string): Promise<boolean> => {
        // Update State
        const newState = { ...appState, stage: stage };
        setAppState(newState);

        const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
        const safeProject = sanitizeName(projectNum);

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
        const filename = `PROCALC_${safeProject}_${stage}_${timestamp}.json`;

        const fileData: ProjectFile = {
            version: '1.0',
            timestamp: Date.now(),
            stage: stage,
            appState: newState,
            historyLog: [],
            past: [],
            future: []
        };

        try {
            // @ts-ignore
            const rootHandle = dirHandle;
            // @ts-ignore
            let targetHandle = await rootHandle.getDirectoryHandle(targetClientFolderName, { create: true });
            // @ts-ignore
            targetHandle = await targetHandle.getDirectoryHandle(safeProject, { create: true });
            // @ts-ignore
            const fileHandle = await targetHandle.getFileHandle(filename, { create: true });
            // @ts-ignore
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(fileData, null, 2));
            await writable.close();

            // Also SYNC to Cloud silently if possible? 
            // Yes, good practice to sync.
            const data = newState.mode === CalculationMode.FINAL ? newState.final : newState.initial;
            const rate = newState.exchangeRate;
            const currency = newState.offerCurrency;
            const costs = calculateProjectCosts(data, rate, currency, newState.mode, newState.globalSettings.ormFeePercent, newState.targetMargin, newState.manualPrice);

            let totalPrice = 0;
            if (newState.manualPrice !== null) {
                totalPrice = newState.manualPrice;
            } else {
                const marginDecimal = newState.targetMargin / 100;
                totalPrice = costs.total / (1 - marginDecimal);
            }

            try {
                await storageService.saveCalculation(fileData as any, {
                    totalCost: costs.total,
                    totalPrice: totalPrice
                });
            } catch (e) {
                console.warn("Silent cloud sync failed during local save", e);
            }

            showSnackbar(`Zapisano w: ${targetClientFolderName}/${safeProject}`);
            return true;
        } catch (err) {
            console.error("Save failed", err);
            showSnackbar("Błąd zapisu pliku.");
            return false;
        }
    };

    const processLogisticsHandover = async (): Promise<boolean> => {
        const errors = validateProject('OPENING');
        if (errors.length > 0) {
            triggerConfirm("Braki w Danych", "Nie można wysłać do logistyki:\n\n" + errors.join('\n'), () => { }, true);
            return false;
        }

        // [NEW] Automation: Ensure Transport Data Exists BEFORE saving
        let stateToSave = appState;
        const mode = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
        const currentData = appState[mode];
        const updatedData = ensureTransportData(currentData);

        // Check if transport was actually modified (simple length check or deep compare)
        // ensureTransportData only adds new items, so comparison is easier
        if (updatedData.transport.length > currentData.transport.length) {
            stateToSave = {
                ...appState,
                [mode]: updatedData
            };
            // Also update UI state immediately
            setAppState(stateToSave);
            showSnackbar("Automatycznie utworzono karty transportowe dla dostawców.");
        }

        // Pass the updated state to save function
        const saved = await handleSmartSave('OPENING', undefined, true, stateToSave);
        return saved;
    };

    const processFinalSettlement = async (): Promise<boolean> => {
        const errors = validateProject('FINAL');
        if (errors.length > 0) {
            triggerConfirm("Braki w Rozliczeniu", "Nie można zamknąć projektu:\n\n" + errors.join('\n'), () => { }, true);
            return false;
        }

        const saved = await handleSmartSave('FINAL', undefined, true);
        return saved;
    };

    // --- PICKING MODE LOGIC ---
    const handleVariantItemPick = (item: { id: string, type: VariantItemType, label: string }, origin?: { x: number, y: number }) => {
        if (!pickingVariantId) return;

        if (pickedItemsBuffer.some(i => i.id === item.id && i.type === item.type)) {
            showSnackbar("Ten element jest już wybrany (w koszyku).");
            return;
        }

        if (pickingVariantId !== 'GLOBAL_INSTALLATION') {
            const dataKey = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            const variants = appState[dataKey].variants;
            const targetVariant = variants.find(v => v.id === pickingVariantId);
            if (targetVariant && targetVariant.items.some(i => i.id === item.id && i.type === item.type)) {
                showSnackbar("Ten element jest już w wariancie.");
                return;
            }
        }

        setPickedItemsBuffer(prev => [...prev, {
            id: item.id,
            type: item.type,
            originalDescription: item.label
        }]);

        if (origin) {
            const pid = Date.now();
            setFlyingParticles(prev => [...prev, {
                id: pid,
                startX: origin.x,
                startY: origin.y,
                label: item.label.length > 20 ? item.label.substring(0, 20) + '...' : item.label,
                onComplete: (id) => {
                    setFlyingParticles(p => p.filter(x => x.id !== id));
                    setBasketPulse(true);
                    setTimeout(() => setBasketPulse(false), 300);
                }
            }]);
        }
    };

    const handleRemovePickedItem = (index: number) => {
        setPickedItemsBuffer(prev => prev.filter((_, i) => i !== index));
    };

    const handleCancelPicking = () => {
        setPickingVariantId(null);
        // If we were editing a package, we should return to the modal instead of dropping everything
        if (editingPackageItem) {
            setShowPackageModal(true);
        } else {
            setPickedItemsBuffer([]);
        }
    };

    const handleConfirmPicking = () => {
        if (!pickingVariantId || pickedItemsBuffer.length === 0) {
            setPickingVariantId(null);
            return;
        }

        // Check if we are in "Add more to package" mode
        if (editingPackageItem) {
            setShowPackageModal(true);
            setPickingVariantId(null);
            return;
        }

        // Check if we should open the Package Creation Modal
        // Only for Global Installation and if multiple items are selected
        if (pickingVariantId === 'GLOBAL_INSTALLATION' && pickedItemsBuffer.length > 1) {
            setShowPackageModal(true);
            return;
        }

        // Default behavior (Add separately)
        addItemsSeparately();
    };

    const addItemsSeparately = () => {
        setAppState(prev => {
            const newState = { ...prev };
            const dataKey = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';

            if (pickingVariantId === 'GLOBAL_INSTALLATION') {
                const activeData = newState[dataKey];
                const suppliers = activeData.suppliers;

                const newCustomItems: CustomInstallationItem[] = pickedItemsBuffer.map(picked => {
                    let qty = 1;
                    // Try to determine quantity from source if possible
                    if (picked.type === 'SUPPLIER_ITEM') {
                        if (picked.id.startsWith('group_supp_')) {
                            const sId = picked.id.replace('group_supp_', '');
                            const s = suppliers.find(sup => sup.id === sId);
                            if (s) qty = s.items.reduce((sum, i) => sum + i.quantity, 0);
                        } else {
                            for (const s of suppliers) {
                                const found = s.items.find(i => i.id === picked.id);
                                if (found) { qty = found.quantity; break; }
                            }
                        }
                    }

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        description: picked.originalDescription || 'Nowa Pozycja',
                        quantity: qty,
                        unitPrice: 0,
                        isAutoQuantity: true,
                        linkedSources: [{
                            id: picked.id.replace('group_supp_', ''),
                            type: (picked.id.startsWith('group_supp_') ? 'GROUP' : 'ITEM') as 'GROUP' | 'ITEM'
                        }]
                    };
                });

                activeData.installation.customItems = [
                    ...activeData.installation.customItems,
                    ...newCustomItems
                ];

                showSnackbar(`Dodano ${pickedItemsBuffer.length} pozycji do montażu globalnego.`);

            } else {
                // Handle Variant Items
                const variants = [...newState[dataKey].variants];
                const variantIndex = variants.findIndex(v => v.id === pickingVariantId);
                if (variantIndex !== -1) {
                    const updatedVariant = { ...variants[variantIndex] };
                    updatedVariant.items = [...updatedVariant.items, ...pickedItemsBuffer];
                    variants[variantIndex] = updatedVariant;

                    newState[dataKey] = {
                        ...newState[dataKey],
                        variants: variants
                    };
                    showSnackbar(`Dodano ${pickedItemsBuffer.length} elementów do wariantu.`);
                }
            }
            return newState;
        });

        setPickingVariantId(null);
        setPickedItemsBuffer([]);
        setShowPackageModal(false);
    };

    const handleCreatePackage = (packageName: string, totalPrice: number, individualPrices: Record<string, number>) => {
        setAppState(prev => {
            const newState = { ...prev };
            const dataKey = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            const activeData = newState[dataKey];

            // Create one consolidated item
            const packageItem: CustomInstallationItem = {
                id: Math.random().toString(36).substr(2, 9),
                description: packageName,
                quantity: 1,
                unitPrice: totalPrice,
                isAutoQuantity: false, // Explicit package
                linkedSources: pickedItemsBuffer.map(picked => ({
                    id: picked.id.replace('group_supp_', ''),
                    type: (picked.id.startsWith('group_supp_') ? 'GROUP' : 'ITEM') as 'GROUP' | 'ITEM'
                })),
                itemUnitPrices: individualPrices
            };

            activeData.installation.customItems = [
                ...activeData.installation.customItems,
                packageItem
            ];

            return newState;
        });

        showSnackbar("Utworzono pakiet montażowy.");
        setPickingVariantId(null);
        setPickedItemsBuffer([]);
        setShowPackageModal(false);
    };

    const handleEditPackage = (item: CustomInstallationItem) => {
        // Reconstruct buffer items for modal from linkedSources
        if (!item.linkedSources || item.linkedSources.length === 0) return;

        setEditingPackageItem(item);

        const activeData = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
        const suppliers = activeData.suppliers;

        const itemsForModal: VariantItem[] = item.linkedSources.map(src => {
            let label = `Element ${src.id} `;

            if (src.type === 'GROUP') {
                const s = suppliers.find(sup => sup.id === src.id);
                if (s) label = `DOSTAWCA: ${s.customTabName || s.name} `;
            } else {
                // Item
                for (const s of suppliers) {
                    const i = s.items.find(it => it.id === src.id);
                    if (i) {
                        label = `[Mat] ${i.itemDescription} `;
                        break;
                    }
                }
            }

            return {
                id: src.type === 'GROUP' ? `group_supp_${src.id} ` : src.id,
                type: src.type === 'GROUP' ? 'SUPPLIER_ITEM' : 'SUPPLIER_ITEM', // Modal expects VariantType
                originalDescription: label
            };
        });

        setPickedItemsBuffer(itemsForModal);
        setShowPackageModal(true);
    };

    const handleUpdatePackage = (packageName: string, totalPrice: number, individualPrices: Record<string, number>) => {
        if (!editingPackageItem) return;

        setAppState(prev => {
            const newState = { ...prev };
            const dataKey = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            const activeData = newState[dataKey];

            const newItems = activeData.installation.customItems.map(i => {
                if (i.id === editingPackageItem.id) {
                    return {
                        ...i,
                        description: packageName,
                        unitPrice: totalPrice,
                        // We must update linkedSources as well because we might have added items!
                        linkedSources: pickedItemsBuffer.map(picked => ({
                            id: picked.id.replace('group_supp_', ''),
                            type: (picked.id.startsWith('group_supp_') ? 'GROUP' : 'ITEM') as 'GROUP' | 'ITEM'
                        })),
                        itemUnitPrices: individualPrices
                    };
                }
                return i;
            });

            activeData.installation.customItems = newItems;
            return newState;
        });

        showSnackbar("Zaktualizowano pakiet montażowy.");
        setEditingPackageItem(null);
        setPickedItemsBuffer([]);
        setShowPackageModal(false);
    };

    const handleModalClose = () => {
        setShowPackageModal(false);
        setEditingPackageItem(null);
        // Only clear buffer if we are not in picking mode to avoid losing selection if canceled
        if (!pickingVariantId && !editingPackageItem) {
            setPickedItemsBuffer([]);
        }
    };

    const handleAddMoreToPackage = (currentName: string, currentPrices: Record<string, number>) => {
        // Temporarily update the editing item with current form values so they persist
        if (editingPackageItem) {
            setEditingPackageItem({
                ...editingPackageItem,
                description: currentName,
                itemUnitPrices: currentPrices
            });
        }
        setShowPackageModal(false);
        setPickingVariantId('GLOBAL_INSTALLATION');
    };

    const handleUndo = () => {
        // 0. Force Blur to ensure inputs commit their values and listen to props
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        // 1. Clear any pending snapshot timer to stop overwrite
        if (historyTimeoutRef.current) {
            clearTimeout(historyTimeoutRef.current);
        }

        const currentHash = JSON.stringify(getHistoryState(appState));
        const lastSnapshotHash = JSON.stringify(getHistoryState(lastSnapshot.current));

        // Case A: Uncommitted Changes exist (User typed "10", timer pending)
        // Action: Revert to lastSnapshot. Do not pop history.
        if (currentHash !== lastSnapshotHash) {
            setAppState(lastSnapshot.current);
            showSnackbar("Cofnięto wprowadzanie");
            return;
        }

        // Case B: No uncommitted changes. Standard Undo.
        if (past.length === 0) return;
        const previousState = past[past.length - 1];
        const newPast = past.slice(0, -1);

        const historyTip = historyLog[0];
        const changesText = historyTip?.changes && historyTip.changes.length > 0
            ? (historyTip.changes.length === 1 ? historyTip.changes[0] : `${historyTip.changes.length} zmian`)
            : 'Cofnięto zmianę';

        isUndoRedoOperation.current = true;
        setFuture(prev => [appState, ...prev]);
        setPast(newPast);
        setAppState(previousState);

        setHistoryLog(prev => prev.slice(1));
        showSnackbar(`Cofnięto: ${changesText} `);
    };

    const handleRedo = () => {
        // 0. Force Blur
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        if (historyTimeoutRef.current) {
            clearTimeout(historyTimeoutRef.current);
        }

        if (future.length === 0) return;
        const nextState = future[0];
        const newFuture = future.slice(1);

        isUndoRedoOperation.current = true;
        setPast(prev => [...prev, appState]);
        setFuture(newFuture);
        setAppState(nextState);
        showSnackbar("Przywrócono zmianę");
    };

    const handleHistoryRestore = (entry: HistoryEntry) => {
        isUndoRedoOperation.current = true;
        setPast(prev => [...prev, appState]);
        setFuture([]);
        setAppState(entry.state);
        showSnackbar(`Przywrócono stan z: ${new Date(entry.timestamp).toLocaleTimeString()} `);
    };

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        if (newMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
    };

    const updateCalculationData = (updates: Partial<CalculationData>) => {
        setAppState(prev => {
            const key = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            return { ...prev, [key]: { ...prev[key], ...updates } };
        });
    };

    const handleBatchUpdate = (updates: { suppliers: Supplier[], transport: TransportItem[] }) => {
        setAppState(prev => {
            const key = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
            return {
                ...prev,
                [key]: {
                    ...prev[key],
                    suppliers: updates.suppliers,
                    transport: updates.transport
                }
            };
        });
    };

    const handleExport = () => {
        const fileData: ProjectFile = {
            version: '1.0',
            timestamp: Date.now(),
            stage: appState.stage, // Export with current stage
            appState,
            historyLog: [], // Cleared to save space
            past: [], // Cleared to save space
            future: [] // Cleared to save space
        };

        const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `procalc_${appState.initial.meta.projectNumber || 'projekt'}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSnackbar("Projekt został pobrany");
    };

    const loadProjectFromObject = async (parsed: any) => {
        try {
            // [NEW] Fetch Logistics Overrides first if project has a number
            let logisticsOverrides: any[] = [];
            const pnum = parsed.appState?.initial?.meta?.projectNumber || parsed.initial?.meta?.projectNumber || parsed.project_id;

            if (pnum && pnum !== 'BezNumeru') {
                try {
                    logisticsOverrides = await storageService.getLogisticsTransports([pnum]);
                } catch (e) {
                    console.error("Failed to fetch logistics overrides", e);
                }
            }

            const mergeLogistics = (data: CalculationData) => {
                if (!data || !data.transport) return data;
                if (logisticsOverrides.length === 0) return data;

                // 1. Sync transport items
                const updatedTransport = data.transport.map(t => {
                    const override = logisticsOverrides.find(o => o.transport_id === t.id);
                    return override ? { ...t, ...override.data } : t;
                });

                // 2. [NEW] Force Supplier date sync from synced transport
                let updatedSuppliers = data.suppliers ? [...data.suppliers] : [];
                updatedTransport.forEach(t => {
                    const targetDate = t.isSupplierOrganized ? t.confirmedDeliveryDate : t.pickupDate;
                    if (targetDate) {
                        const linkedIds = t.isSupplierOrganized && t.supplierId
                            ? [t.supplierId]
                            : (t.linkedSupplierIds || []);

                        updatedSuppliers = updatedSuppliers.map(s => {
                            if (linkedIds.includes(s.id)) {
                                return { ...s, deliveryDate: targetDate };
                            }
                            return s;
                        });
                    }
                });

                return { ...data, transport: updatedTransport, suppliers: updatedSuppliers };
            };

            // If loading full ProjectFile struct with 'appState' key
            if (parsed.appState) {
                // Apply overrides to both initial and final
                if (parsed.appState.initial) parsed.appState.initial = mergeLogistics(parsed.appState.initial);
                if (parsed.appState.final) parsed.appState.final = mergeLogistics(parsed.appState.final);

                // Apply to scenarios too
                if (parsed.appState.scenarios) {
                    parsed.appState.scenarios = parsed.appState.scenarios.map((s: any) => ({
                        ...s,
                        transport: mergeLogistics({ transport: s.transport } as any).transport
                    }));
                }

                if (parsed.appState.initial && !parsed.appState.initial.variants) parsed.appState.initial.variants = [];
                if (parsed.appState.final && !parsed.appState.final.variants) parsed.appState.final.variants = [];
                if (parsed.appState.initial && !parsed.appState.initial.otherCostsScratchpad) parsed.appState.initial.otherCostsScratchpad = [];
                if (parsed.appState.final && !parsed.appState.final.otherCostsScratchpad) parsed.appState.final.otherCostsScratchpad = [];
                if (parsed.appState.finalManualPrice === undefined) parsed.appState.finalManualPrice = null;
                if (!parsed.appState.globalSettings) parsed.appState.globalSettings = { ...DEFAULT_SETTINGS };

                // Restore stage from file root if available, otherwise appState
                const loadedStage = parsed.stage || parsed.appState.stage || 'DRAFT';

                // Restore Scenarios
                if (!parsed.appState.scenarios || parsed.appState.scenarios.length === 0) {
                    const def = extractScenarioData(parsed.appState.initial || EMPTY_CALCULATION, 'default', 'Wariant Główny');
                    parsed.appState.scenarios = [def];
                    parsed.appState.activeScenarioId = 'default';
                }

                // [NEW] Ownership Warning Check
                if (profile?.full_name) {
                    const sales = parsed.appState.initial?.meta?.salesPerson;
                    const assistant = parsed.appState.initial?.meta?.assistantPerson;
                    const isOwner = (sales && sales === profile.full_name) || (assistant && assistant === profile.full_name);

                    // If user is NOT admin/logistics and NOT owner (sales/assistant), warn them.
                    if (!profile.is_admin && profile.role !== 'logistics' && !isOwner && (sales || assistant)) {
                        showSnackbar("UWAGA: Otwierasz kalkulację przypisaną do innego użytkownika.");
                    }
                }

                setAppState({
                    ...parsed.appState,
                    stage: loadedStage,
                    isLocked: parsed.appState.isLocked || false, // Ensure lock state is applied
                    activeCalculationId: parsed.id || parsed.appState.activeCalculationId // Restore cloud ID
                });

                if (parsed.historyLog) setHistoryLog(parsed.historyLog);
                if (parsed.past) setPast(parsed.past);
                if (parsed.future) setFuture(parsed.future);
            } else {
                // Legacy flat load or direct appState
                // Handle merging here too if needed, but cloud saves usually use the ProjectFile struct above.
                if (parsed.initial) parsed.initial = mergeLogistics(parsed.initial);
                if (parsed.final) parsed.final = mergeLogistics(parsed.final);

                const merged = { ...appState, ...parsed };
                if (merged.initial && !merged.initial.variants) merged.initial.variants = [];
                if (merged.initial && !merged.initial.otherCostsScratchpad) merged.initial.otherCostsScratchpad = [];
                if (merged.finalManualPrice === undefined) merged.finalManualPrice = null;
                if (!merged.globalSettings) merged.globalSettings = { ...DEFAULT_SETTINGS };
                if (!merged.stage) merged.stage = 'DRAFT';

                // Setup default scenario if missing
                if (!merged.scenarios || merged.scenarios.length === 0) {
                    const def = extractScenarioData(merged.initial || EMPTY_CALCULATION, 'default', 'Wariant Główny');
                    merged.scenarios = [def];
                    merged.activeScenarioId = 'default';
                }

                setAppState(merged);
            }
            showSnackbar("Projekt wczytany pomyślnie");
        } catch (err) {
            console.error(err);
            showSnackbar("Błąd struktury pliku projektu.");
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const parsed = JSON.parse(text);
                loadProjectFromObject(parsed);
            } catch (err) {
                console.error(err);
                alert("Błąd odczytu pliku projektu. Upewnij się, że to poprawny plik JSON.");
            }
        };
        reader.readAsText(file);
        if (projectInputRef.current) projectInputRef.current.value = '';
    };

    // --- QUICK START HANDLER ---
    const handleQuickStartApply = (qsData: { projectNumber: string, clientName: string, salesPerson: string, assistantPerson: string, installationType: string, currency: Currency }) => {
        setAppState(prev => {
            const newInit = { ...prev.initial };
            const newFinal = { ...prev.final };

            // Apply to both initial and final
            newInit.meta.projectNumber = qsData.projectNumber;
            newFinal.meta.projectNumber = qsData.projectNumber;

            newInit.meta.salesPerson = qsData.salesPerson;
            newFinal.meta.salesPerson = qsData.salesPerson;

            newInit.meta.assistantPerson = qsData.assistantPerson;
            newFinal.meta.assistantPerson = qsData.assistantPerson;

            newInit.meta.installationType = qsData.installationType;
            newFinal.meta.installationType = qsData.installationType;

            newInit.orderingParty.name = qsData.clientName;
            newFinal.orderingParty.name = qsData.clientName;

            return {
                ...prev,
                offerCurrency: qsData.currency,
                initial: newInit,
                final: newFinal
            };
        });
        setShowQuickStart(false);
        showSnackbar("Dane projektu zaktualizowane!");
    };

    const handleNewProject = () => {
        triggerConfirm(
            "Nowy Projekt",
            "Czy na pewno chcesz wyczyścić wszystkie dane? Niezapisane zmiany zostaną utracone.",
            () => {
                const init = JSON.parse(JSON.stringify(EMPTY_CALCULATION));
                const fin = JSON.parse(JSON.stringify(EMPTY_CALCULATION));

                // Apply Default Users
                if (appState.globalSettings.defaultSalesPerson) {
                    init.meta.salesPerson = appState.globalSettings.defaultSalesPerson;
                    fin.meta.salesPerson = appState.globalSettings.defaultSalesPerson;
                }
                if (appState.globalSettings.defaultSupportPerson) {
                    init.meta.assistantPerson = appState.globalSettings.defaultSupportPerson;
                    fin.meta.assistantPerson = appState.globalSettings.defaultSupportPerson;
                }

                // Auto-fill based on User Role (overrides defaults if match, or fills empty)
                // Logic: Engineer -> Sales Person, Specialist -> Assistant Person
                if (profile?.full_name) {
                    if (profile.role === 'engineer' && !init.meta.salesPerson) {
                        init.meta.salesPerson = profile.full_name;
                        fin.meta.salesPerson = profile.full_name;
                    } else if (profile.role === 'specialist' && !init.meta.assistantPerson) {
                        init.meta.assistantPerson = profile.full_name;
                        fin.meta.assistantPerson = profile.full_name;
                    }
                }

                // Reset Scenarios
                const defaultScenario = extractScenarioData(init, 'default', 'Wariant Główny');

                setAppState({
                    initial: init,
                    final: fin,
                    scenarios: [defaultScenario],
                    activeScenarioId: 'default',
                    mode: CalculationMode.INITIAL,
                    stage: 'DRAFT',
                    viewMode: ViewMode.CALCULATOR,
                    exchangeRate: appState.exchangeRate,
                    offerCurrency: Currency.EUR,
                    clientCurrency: Currency.PLN,
                    targetMargin: 20,
                    manualPrice: null,
                    finalManualPrice: null,
                    globalSettings: appState.globalSettings
                });
                setPast([]);
                setFuture([]);
                setHistoryLog([]);
                showSnackbar("Utworzono nowy projekt");

                // Trigger Quick Start
                setShowQuickStart(true);
            },
            true
        );
    };

    const showSnackbar = (message: string, action?: () => void, actionLabel?: string) => {
        setSnackbar({ message, action, actionLabel });
        setTimeout(() => setSnackbar(null), 3000);
    };

    const data = appState.mode === CalculationMode.INITIAL ? appState.initial : appState.final;
    const isFinal = appState.mode === CalculationMode.FINAL;

    const menuItems = [
        { label: 'Edytuj Profil', icon: <User size={16} />, onClick: () => setShowProfileEdit(true) },
        { label: 'Ustawienia', icon: <Settings size={16} />, onClick: () => setShowSettings(true) },
        { label: 'Skróty Klawiszowe', icon: <Keyboard size={16} />, onClick: () => setShowShortcuts(true) },
        { label: 'Nowy Projekt', icon: <FilePlus size={16} />, onClick: handleNewProject, danger: true },
        { label: 'Otwórz Menedżer Projektów', icon: <HardDrive size={16} />, onClick: () => setShowProjectManager(true) },
        ...(profile?.is_admin ? [{ label: 'Panel Administratora', icon: <Shield size={16} />, onClick: () => setShowAdminPanel(true) }] : []),
        { label: 'Pobierz Projekt (.json)', icon: <Download size={16} />, onClick: handleExport },
        { label: 'Wczytaj Projekt (.json)', icon: <Upload size={16} />, onClick: () => projectInputRef.current?.click() },
        { label: 'Historia Zmian', icon: <History size={16} />, onClick: () => setShowHistory(true) },
        { label: 'Zmień Motyw', icon: isDarkMode ? <Sun size={16} /> : <Moon size={16} />, onClick: toggleTheme },
        { label: 'Wyloguj Się', icon: <LogOut size={16} />, onClick: () => signOut(), danger: true },
    ];

    // --- BROWSER HISTORY SYNC ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state) {
                // Restore View & Tab
                setAppState(prev => ({
                    ...prev,
                    viewMode: event.state.viewMode || prev.viewMode,
                    activeHubTab: event.state.activeHubTab || prev.activeHubTab
                }));

                // [Optional] If we have a projectNumber, we could trigger a reload here 
                // if the current project is different. But for now, we rely on the fact 
                // that the state contains the last loaded project.
            }
        };

        window.addEventListener('popstate', handlePopState);

        // Initial state
        if (!window.history.state) {
            const currentPNum = appState.initial.meta.projectNumber || '';
            window.history.replaceState({
                viewMode: appState.viewMode,
                activeHubTab: appState.activeHubTab,
                projectNumber: currentPNum
            }, '');
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Sync viewMode/tab/project changes to history
    useEffect(() => {
        const currentState = window.history.state;
        const currentPNum = appState.initial.meta.projectNumber || '';

        const hasViewChanged = currentState?.viewMode !== appState.viewMode;
        const hasTabChanged = currentState?.activeHubTab !== appState.activeHubTab;
        const hasProjectChanged = currentState?.projectNumber !== currentPNum;

        if (hasViewChanged || hasTabChanged || hasProjectChanged) {
            window.history.pushState({
                viewMode: appState.viewMode,
                activeHubTab: appState.activeHubTab,
                projectNumber: currentPNum
            }, '');
        }
    }, [appState.viewMode, appState.activeHubTab, appState.initial.meta.projectNumber]);

    if (!isLoaded) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-sm">Wczytywanie systemu...</div>;

    const scrollSpySections = [
        { id: 'section-customer', label: 'Dane Klienta' },
        { id: 'section-meta', label: 'Szczegóły' },
        { id: 'section-suppliers', label: 'Dostawcy' },
        { id: 'section-transport', label: 'Transport' },
        { id: 'section-installation', label: 'Montaż' },
        { id: 'section-other', label: 'Inne Koszty' },
        { id: 'section-variants', label: 'Warianty' },
        { id: 'section-summary', label: 'Podsumowanie' },
    ];

    // CALCULATE TOTAL PALLET SPOTS FOR IBL
    const totalPalletSpots = data.installation.stages.reduce((sum, stage) => {
        if (stage.isExcluded) return sum;
        return sum + (stage.palletSpots || 0);
    }, 0);

    // CALCULATE READ-ONLY STATE
    // CALCULATE READ-ONLY STATE
    // [REVERTED] Admin/Manager/Logistics can bypass lock. Others respects lock.
    // --- LOCKING LOGIC ---
    const handleToggleLock = async () => {
        const currentProjectNum = appState.initial.meta.projectNumber;
        if (!currentProjectNum) {
            showSnackbar("Nie można zablokować projektu bez numeru.");
            return;
        }

        const newLockState = !appState.isLocked;

        try {
            // Update DB immediately
            await storageService.lockProject(currentProjectNum, newLockState);

            // Update Local State
            setAppState(prev => ({ ...prev, isLocked: newLockState }));

            showSnackbar(newLockState ? "Projekt został ZABLOKOWANY (Globalnie)" : "Projekt został ODBLOKOWANY");
        } catch (e) {
            console.error("Lock toggle failed", e);
            showSnackbar("Błąd zmiany statusu blokady.");
        }
    };



    const isLogisticsTakeover = !!appState.logistics_operator_id;
    const isMyTakeover = appState.logistics_operator_id === profile?.id;
    const canBypassLock = profile?.is_admin || profile?.role === 'logistics' || profile?.role === 'manager';

    // In case of logistics takeover, it's a HARD LOCK for specialists/engineers.
    // In case of normal lock, it's a soft lock (edit allowed, but asks for reason on save).
    const isReadOnly = isLogisticsTakeover && !canBypassLock && !isMyTakeover;


    return (
        <div className="h-screen overflow-hidden bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors font-sans flex flex-col">
            <style>{`
        @keyframes flyToBasket {
            0 % { transform: translate(0, 0) scale(1); opacity: 1; }
            60 % { opacity: 1; transform: translate(calc(var(--tx) * 0.5), calc(var(--ty) * 0.8)) scale(0.8);
        }
        100 % { transform: translate(var(--tx), var(--ty)) scale(0.1); opacity: 0;
    }
}
`}</style>

            {/* Authentication Loading State */}
            {authLoading && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-white text-xl font-bold">Ładowanie ProCalc...</p>
                    </div>
                </div>
            )}

            {/* Authentication Modal - Show if not authenticated */}
            {!authLoading && !user && (
                <AuthModal isOpen={true} onClose={() => { }} />
            )}

            {/* Error State - Authenticated but no profile (e.g. migration missing) */}
            {!authLoading && user && !profile && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-zinc-900 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 max-w-md text-center border border-zinc-700">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">
                            Błąd profilu
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            Nie udało się załadować profilu użytkownika. Prawdopodobnie migracja bazy danych nie została wykonana.
                        </p>
                        <button
                            onClick={() => signOut()}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                        >
                            Wyloguj się
                        </button>
                    </div>
                </div>
            )}

            {/* Pending Approval Message - Show if authenticated but not approved */}
            {!authLoading && user && profile && !profile.approved && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 max-w-md text-center">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield size={40} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
                            Oczekiwanie na zatwierdzenie
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                            Twoje konto zostało utworzone, ale wymaga zatwierdzenia przez administratora.
                        </p>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                <strong>Email:</strong> {user.email}
                            </p>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Skontaktuj się z administratorem, aby uzyskać dostęp.
                        </p>
                    </div>
                </div>
            )}

            {/* Main App - Only show if authenticated AND approved */}
            {!authLoading && user && profile?.approved && (
                <>
                    <Header
                        appState={appState}
                        setAppState={setAppState}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={past.length > 0 && appState.viewMode !== ViewMode.DASHBOARD}
                        canRedo={future.length > 0 && appState.viewMode !== ViewMode.DASHBOARD}
                        showUndoRedo={appState.viewMode !== ViewMode.DASHBOARD} // Pass prop if Header supports it, otherwise rely on conditional rendering/logic inside Header
                        onShowComparison={() => setShowComparison(true)}
                        onShowProjectManager={() => setShowProjectManager(true)}
                        onShowShortcuts={() => setShowShortcuts(true)}
                        onShowAdminPanel={() => setShowAdminPanel(true)}
                        menuItems={menuItems}
                        projectInputRef={projectInputRef}
                        handleImport={handleImport}
                        onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
                        onToggleLock={handleToggleLock}
                    />

                    {/* Main Layout - Modified to support Bottom Summary */}
                    <main ref={mainScrollRef} className="flex-1 overflow-y-auto w-full grid grid-cols-1 xl:grid-cols-12 items-start relative gap-0 scroll-smooth">

                        {/* LEFT COLUMN (Forms) - Expanded */}
                        {appState.viewMode === ViewMode.CALCULATOR && (
                            <div className="xl:col-span-10 p-1 md:p-6 pb-20 md:pb-32 relative">
                                {/* ScrollSpy Removed from here, moved to Sidebar */}

                                <div className="max-w-[1920px] mx-auto space-y-6 px-4 md:px-6">
                                    {isFinal ? (
                                        <FinalCalculationView
                                            data={appState.final}
                                            initialData={appState.initial}
                                            onChange={(updated) => updateCalculationData(updated)}
                                            exchangeRate={appState.exchangeRate}
                                            offerCurrency={appState.offerCurrency}
                                            manualPrice={appState.manualPrice}
                                            finalManualPrice={appState.finalManualPrice}
                                            targetMargin={appState.targetMargin}
                                            onUpdateState={(updates) => setAppState(prev => ({ ...prev, ...updates }))}
                                            onApprove={processFinalSettlement}
                                        />
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                <div className="lg:col-span-2" id="section-customer">
                                                    <CustomerSection
                                                        data={{ payer: data.payer, recipient: data.recipient, orderingParty: data.orderingParty }}
                                                        onChange={(field, val) => updateCalculationData({ [field]: val })}
                                                        isOpen={isHeaderFormsOpen}
                                                        onToggle={() => setIsHeaderFormsOpen(!isHeaderFormsOpen)}
                                                        readOnly={isReadOnly}
                                                    />
                                                </div>
                                                <div className="lg:col-span-1" id="section-meta">
                                                    <ProjectMetaForm
                                                        data={data.meta}
                                                        mode={appState.mode}
                                                        onChange={(val) => updateCalculationData({ meta: val })}
                                                        isOpen={isHeaderFormsOpen}
                                                        onToggle={() => setIsHeaderFormsOpen(!isHeaderFormsOpen)}
                                                        readOnly={isReadOnly}
                                                    />
                                                </div>
                                            </div>

                                            {/* SCENARIO TABS */}
                                            <ScenarioTabs
                                                scenarios={appState.scenarios}
                                                activeId={appState.activeScenarioId}
                                                onSwitch={handleSwitchScenario}
                                                onAdd={handleAddScenario}
                                                onManage={() => setShowScenarioManager(true)}
                                                readOnly={isReadOnly}
                                            />

                                            <div id="section-suppliers">
                                                <SuppliersSection
                                                    suppliers={data.suppliers}
                                                    transport={data.transport}
                                                    installation={data.installation}
                                                    onChange={(val) => updateCalculationData({ suppliers: val })}
                                                    onBatchChange={handleBatchUpdate}
                                                    onOpenComparison={() => setShowSupplierComparison(true)}
                                                    exchangeRate={appState.exchangeRate}
                                                    offerCurrency={appState.offerCurrency}
                                                    nameplateQty={data.nameplateQty}
                                                    onNameplateChange={(qty) => updateCalculationData({ nameplateQty: qty })}
                                                    onConfirm={triggerConfirm}
                                                    isPickingMode={!!pickingVariantId}
                                                    onPick={handleVariantItemPick}
                                                    readOnly={isReadOnly}
                                                />
                                            </div>

                                            <div id="section-transport">
                                                <TransportSection
                                                    transport={data.transport}
                                                    suppliers={data.suppliers}
                                                    onChange={(val) => updateCalculationData({ transport: val })}
                                                    exchangeRate={appState.exchangeRate}
                                                    offerCurrency={appState.offerCurrency}
                                                    isPickingMode={!!pickingVariantId}
                                                    onPick={handleVariantItemPick}
                                                    truckLoadCapacity={appState.globalSettings.truckLoadCapacity}
                                                />
                                            </div>

                                            <div id="section-installation">
                                                <InstallationSection
                                                    data={data.installation}
                                                    suppliers={data.suppliers}
                                                    onChange={(val) => updateCalculationData({ installation: val })}
                                                    exchangeRate={appState.exchangeRate}
                                                    offerCurrency={appState.offerCurrency}
                                                    isPickingMode={!!pickingVariantId}
                                                    onPick={handleVariantItemPick}
                                                    onEnterPickingMode={(id) => setPickingVariantId(id)}
                                                    onEditPackage={handleEditPackage}
                                                    readOnly={isReadOnly}
                                                />
                                            </div>

                                            <div id="section-other">
                                                <OtherCostsSection
                                                    costs={data.otherCosts}
                                                    scratchpad={data.otherCostsScratchpad || []}
                                                    onChange={(costs) => updateCalculationData({ otherCosts: costs })}
                                                    onScratchpadChange={(sp) => updateCalculationData({ otherCostsScratchpad: sp })}
                                                    exchangeRate={appState.exchangeRate}
                                                    offerCurrency={appState.offerCurrency}
                                                    isPickingMode={!!pickingVariantId}
                                                    onPick={handleVariantItemPick}
                                                    totalPalletSpots={totalPalletSpots}
                                                    readOnly={isReadOnly}
                                                />
                                            </div>

                                            <div id="section-variants">
                                                <VariantsSection
                                                    data={data}
                                                    onChange={(updated) => updateCalculationData(updated)}
                                                    exchangeRate={appState.exchangeRate}
                                                    offerCurrency={appState.offerCurrency}
                                                    onConfirm={triggerConfirm}
                                                    onEnterPickingMode={(id) => setPickingVariantId(id)}
                                                    ormFeePercent={appState.globalSettings.ormFeePercent}
                                                />
                                            </div>

                                            {/* MAIN FINANCIAL SUMMARY PLACED HERE AS FOOTER BLOCK */}
                                            <div id="section-summary" className="mt-8 border-t-2 border-zinc-200 dark:border-zinc-800 pt-8">
                                                <SummarySection
                                                    appState={appState}
                                                    onUpdateState={(updates) => setAppState(prev => ({ ...prev, ...updates }))}
                                                    data={data}
                                                    readOnly={isReadOnly}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* FULL SCREEN MODES */}
                        {appState.viewMode === ViewMode.LOGISTICS && (
                            <div className="xl:col-span-12 animate-fadeIn p-1 md:p-6">
                                <div className="max-w-[1600px] mx-auto">
                                    <LogisticsView
                                        data={{
                                            // MERGE INITIAL AND FINAL DATA FOR LOGISTICS VIEW
                                            // Base on initial (plan), override with final (reality) where applicable
                                            ...data,
                                            meta: {
                                                ...data.meta,
                                                // Ensure protocol date from final calc is visible even if we started with initial
                                                protocolDate: appState.final.meta.protocolDate || appState.initial.meta.protocolDate
                                            }
                                        }}
                                        onChange={(updatedData) => {
                                            // Logic to update the CORRECT data source based on current mode
                                            const key = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
                                            setAppState(prev => ({
                                                ...prev,
                                                [key]: {
                                                    ...prev[key],
                                                    ...updatedData
                                                }
                                            }));
                                        }}
                                        onUpdateTransport={async (tid, fields) => {
                                            const key = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
                                            const currentData = appState[key];
                                            const t = currentData.transport.find(x => x.id === tid);
                                            if (!t) return;

                                            // 1. Validation & Propagation
                                            const current = t;
                                            const updated = { ...current, ...fields };

                                            // Validation: Delivery date cannot be before loading date
                                            const finalPickup = fields.pickupDate || current.pickupDate;
                                            const finalDelivery = fields.confirmedDeliveryDate || current.confirmedDeliveryDate;

                                            if (finalPickup && finalDelivery && new Date(finalDelivery) < new Date(finalPickup)) {
                                                if (fields.confirmedDeliveryDate) {
                                                    updated.confirmedDeliveryDate = finalPickup;
                                                } else if (fields.pickupDate) {
                                                    updated.pickupDate = finalDelivery;
                                                }
                                            }

                                            // Propagation: Update all trucks when summary dates change
                                            if (fields.confirmedDeliveryDate || fields.pickupDate) {
                                                updated.trucks = updated.trucks?.map(truck => ({
                                                    ...truck,
                                                    loadingDates: updated.pickupDate || truck.loadingDates,
                                                    deliveryDate: updated.confirmedDeliveryDate || truck.deliveryDate
                                                }));
                                            }

                                            // 2. Update local state
                                            const updatedTransport = currentData.transport.map(x => x.id === tid ? updated : x);
                                            setAppState(prev => ({
                                                ...prev,
                                                [key]: { ...prev[key], transport: updatedTransport }
                                            }));

                                            // 3. Persistent Save to Centralized Logistics Table
                                            const pnum = currentData.meta.projectNumber;
                                            if (pnum && pnum !== 'BezNumeru') {
                                                try {
                                                    await storageService.saveLogisticsTransport({
                                                        project_number: pnum,
                                                        transport_id: tid,
                                                        data: updated,
                                                        delivery_date: updated.isSupplierOrganized ? updated.confirmedDeliveryDate : updated.pickupDate,
                                                        pickup_date: updated.pickupDate,
                                                        carrier: updated.carrier,
                                                        supplier_id: updated.supplierId
                                                    });
                                                } catch (err) {
                                                    console.error("Failed to save logistics override from individual view:", err);
                                                }
                                            }
                                        }}
                                        readOnly={isReadOnly}
                                    />
                                </div>
                            </div>
                        )}

                        {/* NOTE: ViewMode.COMPARISON is deprecated in UI flow, replaced by Modal below, but kept for legacy check */}
                        {appState.viewMode === ViewMode.COMPARISON && (
                            <div className="xl:col-span-12 animate-fadeIn p-6">
                                <div className="p-10 text-center text-zinc-500">Deprecated View. Please restart app.</div>
                            </div>
                        )}

                        {appState.viewMode === ViewMode.NOTES && (
                            <div className="xl:col-span-12 animate-fadeIn p-1 md:p-6">
                                <div className="max-w-[1600px] mx-auto">
                                    <ProjectNotesView
                                        data={data}
                                        onChange={(updates) => updateCalculationData(updates)}
                                        onBack={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.CALCULATOR }))}
                                    />
                                </div>
                            </div>
                        )}

                        {appState.viewMode === ViewMode.DOCUMENTS && (
                            <div className="xl:col-span-12 animate-fadeIn p-1 md:p-6">
                                <div className="max-w-[1600px] mx-auto">
                                    <DocumentsView
                                        data={data}
                                        onBack={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.CALCULATOR }))}
                                        onApproveOpening={processLogisticsHandover}
                                        onApproveClosing={processFinalSettlement}
                                        appState={appState}
                                    />
                                </div>
                            </div>
                        )}

                        {appState.viewMode === ViewMode.DASHBOARD && (
                            <div className="xl:col-span-12 animate-fadeIn bg-zinc-50 dark:bg-zinc-950 min-h-screen">
                                <DashboardView
                                    activeProject={data.meta.projectNumber || data.orderingParty.name ? data : null}
                                    onNewProject={handleNewProject}
                                    onShowProjectManager={() => setShowProjectManager(true)}
                                    onShowComparison={() => setShowComparison(true)}
                                    onBack={() => setAppState(prev => ({ ...prev, viewMode: ViewMode.CALCULATOR }))}
                                    activeTab={appState.activeHubTab}
                                    onTabChange={(tab) => setAppState(prev => ({ ...prev, activeHubTab: tab }))}
                                    onOpenProject={(data, stage, mode) => {
                                        loadProjectFromObject(data);
                                    }}
                                />
                            </div>
                        )}

                        {/* RIGHT COLUMN (Stats Only + ScrollSpy) - Narrower - Desktop View */}
                        {appState.viewMode === ViewMode.CALCULATOR && (
                            <div className="hidden xl:flex xl:col-span-2 sticky top-0 h-screen border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">

                                {/* SCROLL SPY STRIP - HIDDEN IN FINAL MODE */}
                                {!isFinal && <ScrollSpy sections={scrollSpySections} containerRef={mainScrollRef} />}

                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <div className="space-y-8">
                                        <SidePanel
                                            appState={appState}
                                            onUndo={handleUndo}
                                            onRedo={handleRedo}
                                            canUndo={past.length > 0}
                                            canRedo={future.length > 0}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mobile Sidebar Overlay */}
                        {showMobileSidebar && appState.viewMode === ViewMode.CALCULATOR && (
                            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm xl:hidden" onClick={() => setShowMobileSidebar(false)}>
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-950 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto animate-slideInRight"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Podsumowanie</h2>
                                        <button onClick={() => setShowMobileSidebar(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <SidePanel
                                        appState={appState}
                                        onUndo={handleUndo}
                                        onRedo={handleRedo}
                                        canUndo={past.length > 0}
                                        canRedo={future.length > 0}
                                    />
                                </div>
                            </div>
                        )}

                    </main>

                    {/* RENDER FLYING PARTICLES */}
                    {flyingParticles.map(p => (
                        <FlyingParticle key={p.id} {...p} />
                    ))}

                    {/* PICKING MODE OVERLAY BAR */}
                    {pickingVariantId && (
                        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 text-white p-4 z-[999] animate-slideUp flex flex-col md:flex-row items-center justify-between shadow-2xl border-t-2 border-amber-500 gap-4">
                            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                <div className={`bg - amber - 500 p - 2 rounded - full text - black transition - transform duration - 200 shrink - 0 ${basketPulse ? 'scale-150' : ''} `}>
                                    <MousePointer2 size={24} />
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg leading-none whitespace-nowrap font-mono">TRYB WYBIERANIA</h3>
                                        {pickingVariantId === 'GLOBAL_INSTALLATION' ? (
                                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded border border-purple-500 font-mono">
                                                Montaż Globalny
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700 font-mono">
                                                {data.variants.find(v => v.id === pickingVariantId)?.name}
                                            </span>
                                        )}
                                    </div>

                                    {pickedItemsBuffer.length === 0 ? (
                                        <p className="text-sm text-zinc-400">Kliknij element w interfejsie aby dodać go do koszyka.</p>
                                    ) : (
                                        <div className="flex gap-2 overflow-x-auto pb-1 items-center mask-gradient-right no-scrollbar">
                                            {pickedItemsBuffer.map((item, idx) => (
                                                <div key={idx} className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 flex items-center gap-2 shrink-0 animate-scaleIn text-xs">
                                                    <span className="truncate max-w-[150px]">{item.originalDescription}</span>
                                                    <button
                                                        onClick={() => handleRemovePickedItem(idx)}
                                                        className="text-zinc-400 hover:text-red-400 p-0.5"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleCancelPicking}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors text-sm"
                                >
                                    <X size={16} /> Anuluj
                                </button>
                                <button
                                    onClick={handleConfirmPicking}
                                    disabled={pickedItemsBuffer.length === 0}
                                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-6 py-2 rounded font-bold flex items-center gap-2 transition-colors text-sm shadow-lg shadow-amber-500/20"
                                >
                                    <Check size={16} /> Zatwierdź ({pickedItemsBuffer.length})
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modals & Overlays */}

                    {/* QUICK START MODAL */}
                    <QuickStartModal
                        isOpen={showQuickStart}
                        onClose={() => setShowQuickStart(false)}
                        onApply={handleQuickStartApply}
                        defaultSalesPerson={appState.globalSettings.defaultSalesPerson}
                        defaultSupportPerson={appState.globalSettings.defaultSupportPerson}
                        currentUserRole={profile?.role}
                        currentUserName={profile?.full_name}
                    />

                    {/* SCENARIO MANAGER MODAL */}
                    <ScenarioManagerModal
                        isOpen={showScenarioManager}
                        onClose={() => setShowScenarioManager(false)}
                        scenarios={appState.scenarios}
                        activeId={appState.activeScenarioId}
                        onReorder={updateScenariosList}
                        onRename={handleRenameScenario}
                        onDelete={handleDeleteScenario}
                        onDuplicate={handleDuplicateScenario}
                        onAddEmpty={handleAddEmptyScenario}
                        onClearData={handleClearScenarioData}
                        onCopyModules={handleCopyModules}
                    />

                    {/* PACKAGE CREATION MODAL */}
                    <PackageCreationModal
                        isOpen={showPackageModal}
                        onClose={handleModalClose}
                        items={pickedItemsBuffer}
                        suppliers={appState.mode === CalculationMode.INITIAL ? appState.initial.suppliers : appState.final.suppliers}
                        onCreatePackage={handleCreatePackage}
                        onUpdatePackage={handleUpdatePackage}
                        onAddSeparately={!editingPackageItem ? addItemsSeparately : undefined}
                        isEditing={!!editingPackageItem}
                        initialName={editingPackageItem?.description}
                        initialPrices={editingPackageItem?.itemUnitPrices}
                        onAddMore={(name, prices) => {
                            // Update state so we don't lose edits, hide modal, enter picking mode
                            if (editingPackageItem) {
                                setEditingPackageItem({ ...editingPackageItem, description: name, itemUnitPrices: prices });
                            }
                            setShowPackageModal(false);
                            setPickingVariantId('GLOBAL_INSTALLATION');
                        }}
                    />

                    {/* SUPPLIER COMPARISON MODAL */}
                    {showSupplierComparison && (
                        <ComparisonView
                            suppliers={data.suppliers}
                            onClose={() => setShowSupplierComparison(false)}
                        />
                    )}

                    {showComparison && (
                        <CalculationComparisonView
                            initial={appState.initial}
                            final={appState.final}
                            appState={appState}
                            onClose={() => setShowComparison(false)}
                        />
                    )}

                    {showHistory && (
                        <HistoryModal
                            historyLog={historyLog}
                            onRestore={handleHistoryRestore}
                            onClose={() => setShowHistory(false)}
                        />
                    )}

                    {showProjectManager && (
                        <ProjectManagerModal
                            isOpen={showProjectManager}
                            onClose={() => setShowProjectManager(false)}
                            appState={appState}
                            historyLog={historyLog}
                            past={past}
                            future={future}
                            onLoadProject={loadProjectFromObject}
                            showSnackbar={showSnackbar}
                            currentDirHandle={dirHandle}
                            onSetDirHandle={setDirHandle}
                        />
                    )}

                    {showSettings && (
                        <SettingsModal
                            isOpen={showSettings}
                            onClose={() => setShowSettings(false)}
                            settings={appState.globalSettings}
                            onSave={(newSettings) => setAppState(prev => ({ ...prev, globalSettings: newSettings }))}
                        />
                    )}

                    {showShortcuts && (
                        <ShortcutsModal
                            isOpen={showShortcuts}
                            onClose={() => setShowShortcuts(false)}
                        />
                    )}

                    <ConfirmDialog
                        isOpen={dialogConfig.isOpen}
                        title={dialogConfig.title}
                        message={dialogConfig.message}
                        onConfirm={dialogConfig.onConfirm}
                        onCancel={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                        onNeutral={dialogConfig.onNeutral}
                        confirmLabel={dialogConfig.confirmLabel}
                        cancelLabel={dialogConfig.cancelLabel}
                        neutralLabel={dialogConfig.neutralLabel}
                        isDanger={dialogConfig.isDanger}
                    />

                    {/* Snackbar */}
                    {snackbar && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white px-6 py-3 rounded shadow-xl flex items-center gap-4 animate-slideUp z-[100] text-sm font-medium">
                            <span>{snackbar.message}</span>
                            {snackbar.action && (
                                <button onClick={snackbar.action} className="text-amber-500 font-bold hover:text-amber-400 text-xs uppercase tracking-wide">
                                    {snackbar.actionLabel || 'OK'}
                                </button>
                            )}
                        </div>
                    )}

                    {showAdminPanel && (
                        <AdminPanel
                            isOpen={showAdminPanel}
                            onClose={() => setShowAdminPanel(false)}
                        />
                    )}

                    <RestoreSessionModal
                        isOpen={showRestoreModal}
                        onRestore={handleRestoreSession}
                        onDiscard={handleDiscardSession}
                        projectName={lastSessionData?.initial?.orderingParty?.name || lastSessionData?.initial?.meta?.projectNumber}
                    />

                    <ProfileEditModal
                        isOpen={showProfileEdit}
                        onClose={() => setShowProfileEdit(false)}
                    />

                    <UnlockRequestModal
                        isOpen={showUnlockModal}
                        onClose={() => {
                            setShowUnlockModal(false);
                            setPendingSave(null);
                        }}
                        onConfirm={(reason) => {
                            if (pendingSave) {
                                handleSmartSave(pendingSave.stage, reason, pendingSave.isLogistics);
                                setShowUnlockModal(false);
                                setPendingSave(null);
                            }
                        }}
                    />
                </>
            )}
        </div>
    );
};

export default App;