
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
  AddressData
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
import { FloatingSummary } from './components/FloatingSummary';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ScrollSpy } from './components/ScrollSpy';
import { fetchEurRate } from './services/currencyService';
import { generateDiff } from './services/diffService';
import { Moon, Sun, History, Download, Upload, FilePlus, HardDrive, MousePointer2, X, Plus, Check, Trash2, Settings } from 'lucide-react';

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

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    initial: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
    final: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
    mode: CalculationMode.INITIAL,
    stage: 'DRAFT', // Initialize Stage
    viewMode: ViewMode.CALCULATOR,
    exchangeRate: 4.30, 
    offerCurrency: Currency.EUR, 
    clientCurrency: Currency.PLN, 
    targetMargin: 20,
    manualPrice: null,
    finalManualPrice: null,
    globalSettings: { ...DEFAULT_SETTINGS }
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showSupplierComparison, setShowSupplierComparison] = useState(false); // New State for Supplier Modal
  const [showHistory, setShowHistory] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
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
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {}
  });

  // Ref for Main Scroll Container
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, isDanger = false) => {
      setDialogConfig({
          isOpen: true,
          title,
          message,
          isDanger,
          onConfirm: () => {
              onConfirm();
              setDialogConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };
  
  const [past, setPast] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [snackbar, setSnackbar] = useState<{message: string, action?: () => void, actionLabel?: string} | null>(null);

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
              d.variants?.length || 0
          ].join('|');
      };
      return `${getDataHash(state.initial)}#${getDataHash(state.final)}`;
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = savedTheme === 'dark' || (!savedTheme && systemDark);
    
    setIsDarkMode(initialDark);
    if (initialDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const savedData = localStorage.getItem(STORAGE_KEY);
    let shouldUpdateRate = true;

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Determine if we should lock the rate (OPENING or FINAL stage/mode)
        const currentStage = parsed.stage || (parsed.appState ? parsed.appState.stage : 'DRAFT');
        const currentMode = parsed.mode || (parsed.appState ? parsed.appState.mode : CalculationMode.INITIAL);
        
        if (currentStage === 'OPENING' || currentStage === 'FINAL' || currentMode === CalculationMode.FINAL) {
            shouldUpdateRate = false;
        }

        if(parsed.initial && typeof parsed.initial.nameplateQty === 'undefined') parsed.initial.nameplateQty = 0;
        if(parsed.final && typeof parsed.final.nameplateQty === 'undefined') parsed.final.nameplateQty = 0;
        if(parsed.initial && typeof parsed.initial.installation.finalInstallationCosts === 'undefined') parsed.initial.installation.finalInstallationCosts = [];
        if(parsed.final && typeof parsed.final.installation.finalInstallationCosts === 'undefined') parsed.final.installation.finalInstallationCosts = [];
        if(parsed.initial && !parsed.initial.variants) parsed.initial.variants = [];
        if(parsed.final && !parsed.final.variants) parsed.final.variants = [];
        if(parsed.initial && !parsed.initial.otherCostsScratchpad) parsed.initial.otherCostsScratchpad = [];
        if(parsed.final && !parsed.final.otherCostsScratchpad) parsed.final.otherCostsScratchpad = [];
        if(parsed.finalManualPrice === undefined) parsed.finalManualPrice = null;
        if(parsed.stage === undefined) parsed.stage = 'DRAFT'; // Default stage for legacy
        
        // Init global settings if missing
        if(!parsed.appState?.globalSettings && !parsed.globalSettings) {
             // Handle migration if needed
        }

        const mergedState = { ...appState, ...parsed };
        setAppState(mergedState);
        lastSnapshot.current = mergedState; 
      } catch (e) {
        console.error("Failed to load save state", e);
      }
    } else {
        // First load defaults if no storage
        const defaultSettings = { ...DEFAULT_SETTINGS };
        const init = JSON.parse(JSON.stringify(EMPTY_CALCULATION));
        const fin = JSON.parse(JSON.stringify(EMPTY_CALCULATION));
        setAppState(prev => ({ ...prev, initial: init, final: fin, globalSettings: defaultSettings }));
    }
    
    setIsLoaded(true);

    // Only auto-update exchange rate if NOT locked (DRAFT stage)
    if (shouldUpdateRate) {
        fetchEurRate().then(rate => {
            if (rate) setAppState(prev => {
                // Safety check: if user switched to final mode or stage during fetch, abort update
                if (prev.mode === CalculationMode.FINAL || prev.stage === 'OPENING' || prev.stage === 'FINAL') return prev;
                return ({ ...prev, exchangeRate: rate });
            });
        });
    }
    
    // Request Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
  }, []);

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
          const today = new Date().toISOString().split('T')[0];
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

      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

      return () => {
          if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      };
  }, [appState, isLoaded]);

  // --- VALIDATION & AUTO-SAVE LOGIC ---

  const validateProject = (stage: ProjectStage): string[] => {
      const errors: string[] = [];
      const init = appState.initial;
      
      if (stage === 'OPENING' || stage === 'FINAL') {
          // Strict Metadata Requirements
          if (!init.meta.installationType) errors.push("Brak Typu Instalacji (Szczegóły Projektu).");
          if (!init.meta.invoiceText) errors.push("Brak Tekstu na Fakturze (Szczegóły Projektu).");

          // Common requirements for Opening & Final
          if (!init.meta.orderNumber) errors.push("Brak Numeru Zamówienia.");
          if (!init.meta.projectNumber) errors.push("Brak Numeru Projektu (CRM).");
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
          if (!init.meta.sapProjectNumber || init.meta.sapProjectNumber.length < 5) errors.push("Brak poprawnego numeru projektu SAP.");
          
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

  const handleSmartSave = async (stage: ProjectStage): Promise<boolean> => {
      // VALIDATION: Installation Type is required for ANY save
      if (!appState.initial.meta.installationType) {
          triggerConfirm(
              "Wymagane Dane",
              "Aby zapisać projekt, musisz wybrać 'Typ Instalacji' w Szczegółach Projektu.",
              () => {},
              true
          );
          return false;
      }

      if (!dirHandle) {
          triggerConfirm(
              "Wybierz folder projektów",
              "Aby zapisać projekt i przejść dalej, musisz wskazać folder roboczy w Menedżerze Projektów.",
              () => setShowProjectManager(true)
          );
          return false;
      }

      // Update State with current stage
      const newState = { ...appState, stage: stage };
      setAppState(newState);

      // Prepare Metadata for Folder Structure
      const clientName = appState.initial.orderingParty.name || 'Nieznany Klient';
      const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
      
      const safeClient = sanitizeName(clientName);
      const safeProject = sanitizeName(projectNum);

      // Construct filename
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
      const filename = `PROCALC_${safeProject}_${stage}_${timestamp}.json`;

      const fileData: ProjectFile = {
          version: '1.0',
          timestamp: Date.now(),
          stage: stage,
          appState: newState,
          historyLog: [], // Cleared to save space
          past: [], // Cleared to save space
          future: [] // Cleared to save space
      };

      try {
          // Drill down logic: Root -> Client -> Project
          // @ts-ignore
          let targetHandle = dirHandle;
          
          // Get/Create Client Folder
          // @ts-ignore
          targetHandle = await targetHandle.getDirectoryHandle(safeClient, { create: true });
          
          // Get/Create Project Folder
          // @ts-ignore
          targetHandle = await targetHandle.getDirectoryHandle(safeProject, { create: true });

          // Save File
          // @ts-ignore
          const fileHandle = await targetHandle.getFileHandle(filename, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(fileData, null, 2));
          await writable.close();
          
          showSnackbar(`Zapisano w: ${safeClient}/${safeProject}/${filename}`);
          return true;
      } catch (err) {
          console.error("Auto-save failed", err);
          showSnackbar("Błąd zapisu. Sprawdź uprawnienia do folderu.");
          return false;
      }
  };

  const processLogisticsHandover = async (): Promise<boolean> => {
      const errors = validateProject('OPENING');
      if (errors.length > 0) {
          triggerConfirm("Braki w Danych", "Nie można wysłać do logistyki:\n\n" + errors.join('\n'), () => {}, true);
          return false;
      }

      const saved = await handleSmartSave('OPENING');
      return saved;
  };

  const processFinalSettlement = async (): Promise<boolean> => {
      const errors = validateProject('FINAL');
      if (errors.length > 0) {
          triggerConfirm("Braki w Rozliczeniu", "Nie można zamknąć projektu:\n\n" + errors.join('\n'), () => {}, true);
          return false;
      }

      const saved = await handleSmartSave('FINAL');
      return saved;
  };

  // --- PICKING MODE LOGIC ---
  const handleVariantItemPick = (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => {
      if (!pickingVariantId) return;

      if (pickedItemsBuffer.some(i => i.id === item.id && i.type === item.type)) {
          showSnackbar("Ten element jest już wybrany (w koszyku).");
          return;
      }

      const dataKey = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
      const variants = appState[dataKey].variants;
      const targetVariant = variants.find(v => v.id === pickingVariantId);
      if (targetVariant && targetVariant.items.some(i => i.id === item.id && i.type === item.type)) {
          showSnackbar("Ten element jest już w wariancie.");
          return;
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
              label: item.label.length > 20 ? item.label.substring(0,20)+'...' : item.label,
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
      setPickedItemsBuffer([]);
  };

  const handleConfirmPicking = () => {
      if (!pickingVariantId || pickedItemsBuffer.length === 0) {
          setPickingVariantId(null);
          return;
      }

      setAppState(prev => {
          const newState = { ...prev };
          const dataKey = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
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
          }
          return newState;
      });

      showSnackbar(`Dodano ${pickedItemsBuffer.length} elementów do wariantu.`);
      setPickingVariantId(null);
      setPickedItemsBuffer([]);
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
      showSnackbar(`Cofnięto: ${changesText}`);
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
      showSnackbar(`Przywrócono stan z: ${new Date(entry.timestamp).toLocaleTimeString()}`);
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
      a.download = `procalc_${appState.initial.meta.projectNumber || 'projekt'}_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSnackbar("Projekt został pobrany");
  };

  const loadProjectFromObject = (parsed: any) => {
      try {
          // If loading full ProjectFile struct with 'appState' key
          if (parsed.appState) {
               if(parsed.appState.initial && !parsed.appState.initial.variants) parsed.appState.initial.variants = [];
               if(parsed.appState.final && !parsed.appState.final.variants) parsed.appState.final.variants = [];
               if(parsed.appState.initial && !parsed.appState.initial.otherCostsScratchpad) parsed.appState.initial.otherCostsScratchpad = [];
               if(parsed.appState.final && !parsed.appState.final.otherCostsScratchpad) parsed.appState.final.otherCostsScratchpad = [];
               if(parsed.appState.finalManualPrice === undefined) parsed.appState.finalManualPrice = null;
               if(!parsed.appState.globalSettings) parsed.appState.globalSettings = { ...DEFAULT_SETTINGS };
               
               // Restore stage from file root if available, otherwise appState
               const loadedStage = parsed.stage || parsed.appState.stage || 'DRAFT';
               
               setAppState({
                   ...parsed.appState,
                   stage: loadedStage
               });
               
               if (parsed.historyLog) setHistoryLog(parsed.historyLog);
               if (parsed.past) setPast(parsed.past);
               if (parsed.future) setFuture(parsed.future);
          } else {
               // Legacy flat load or direct appState
               const merged = { ...appState, ...parsed };
               if(merged.initial && !merged.initial.variants) merged.initial.variants = [];
               if(merged.initial && !merged.initial.otherCostsScratchpad) merged.initial.otherCostsScratchpad = [];
               if(merged.finalManualPrice === undefined) merged.finalManualPrice = null;
               if(!merged.globalSettings) merged.globalSettings = { ...DEFAULT_SETTINGS };
               if(!merged.stage) merged.stage = 'DRAFT';
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

              setAppState({
                initial: init,
                final: fin,
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
    { label: 'Ustawienia', icon: <Settings size={16}/>, onClick: () => setShowSettings(true) },
    { label: 'Nowy Projekt', icon: <FilePlus size={16}/>, onClick: handleNewProject, danger: true },
    { label: 'Otwórz Menedżer Projektów', icon: <HardDrive size={16}/>, onClick: () => setShowProjectManager(true) },
    { label: 'Pobierz Projekt (.json)', icon: <Download size={16}/>, onClick: handleExport },
    { label: 'Wczytaj Projekt (.json)', icon: <Upload size={16}/>, onClick: () => projectInputRef.current?.click() },
    { label: 'Historia Zmian', icon: <History size={16}/>, onClick: () => setShowHistory(true) },
    { label: 'Zmień Motyw', icon: isDarkMode ? <Sun size={16}/> : <Moon size={16}/>, onClick: toggleTheme },
  ];

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

  return (
    <div className="h-screen overflow-hidden bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors font-sans flex flex-col">
      <style>{`
        @keyframes flyToBasket {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          60% { opacity: 1; transform: translate(calc(var(--tx) * 0.5), calc(var(--ty) * 0.8)) scale(0.8); }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.1); opacity: 0; }
        }
      `}</style>

      <Header 
         appState={appState}
         setAppState={setAppState}
         onUndo={handleUndo}
         onRedo={handleRedo}
         canUndo={past.length > 0}
         canRedo={future.length > 0}
         onShowComparison={() => setShowComparison(true)}
         onShowProjectManager={() => setShowProjectManager(true)}
         onShowShortcuts={() => setShowShortcuts(true)}
         menuItems={menuItems}
         projectInputRef={projectInputRef}
         handleImport={handleImport}
         onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
      />

      {/* Main Layout - Modified to support Bottom Summary */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto w-full max-w-[1920px] mx-auto grid grid-cols-1 xl:grid-cols-12 items-start relative gap-0 scroll-smooth">
        
        {/* LEFT COLUMN (Forms) - Expanded */}
        {appState.viewMode === ViewMode.CALCULATOR && (
            <div className="xl:col-span-10 p-6 pb-32 relative">
                {/* ScrollSpy Removed from here, moved to Sidebar */}
                
                <div className="max-w-[1350px] mx-auto space-y-6">
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
                                />
                            </div>
                            <div className="lg:col-span-1" id="section-meta">
                                <ProjectMetaForm 
                                    data={data.meta} 
                                    mode={appState.mode} 
                                    onChange={(val) => updateCalculationData({ meta: val })} 
                                    isOpen={isHeaderFormsOpen}
                                    onToggle={() => setIsHeaderFormsOpen(!isHeaderFormsOpen)}
                                />
                            </div>
                        </div>

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
                            />
                        </div>

                        {/* MAIN FINANCIAL SUMMARY PLACED HERE AS FOOTER BLOCK */}
                        <div id="section-summary" className="mt-8 border-t-2 border-zinc-200 dark:border-zinc-800 pt-8">
                            <SummarySection 
                                appState={appState} 
                                onUpdateState={(updates) => setAppState(prev => ({ ...prev, ...updates }))}
                                data={data}
                            />
                        </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* FULL SCREEN MODES */}
        {appState.viewMode === ViewMode.LOGISTICS && (
            <div className="xl:col-span-12 animate-fadeIn p-6">
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
             <div className="xl:col-span-12 animate-fadeIn p-6">
                <div className="max-w-[1600px] mx-auto">
                    <ProjectNotesView 
                        data={data} 
                        onChange={(updates) => updateCalculationData(updates)}
                        onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                    />
                </div>
            </div>
        )}

        {appState.viewMode === ViewMode.DOCUMENTS && (
             <div className="xl:col-span-12 animate-fadeIn p-6">
                <div className="max-w-[1600px] mx-auto">
                    <DocumentsView 
                        data={data} 
                        onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                        onApproveOpening={processLogisticsHandover}
                        onApproveClosing={processFinalSettlement}
                        appState={appState}
                    />
                </div>
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
                            <X size={20}/>
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

      {/* Floating Summary - Only on small screens where main summary is scrolled out */}
      {!pickingVariantId && (
        <FloatingSummary data={data} appState={appState} />
      )}

      {/* PICKING MODE OVERLAY BAR */}
      {pickingVariantId && (
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 text-white p-4 z-[999] animate-slideUp flex flex-col md:flex-row items-center justify-between shadow-2xl border-t-2 border-amber-500 gap-4">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div className={`bg-amber-500 p-2 rounded-full text-black transition-transform duration-200 shrink-0 ${basketPulse ? 'scale-150' : ''}`}>
                      <MousePointer2 size={24} />
                  </div>
                  <div className="overflow-hidden flex-1">
                      <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-bold text-lg leading-none whitespace-nowrap font-mono">TRYB WYBIERANIA</h3>
                           <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700 font-mono">
                               {data.variants.find(v => v.id === pickingVariantId)?.name}
                           </span>
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
                      <X size={16}/> Anuluj
                  </button>
                   <button 
                      onClick={handleConfirmPicking}
                      disabled={pickedItemsBuffer.length === 0}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-6 py-2 rounded font-bold flex items-center gap-2 transition-colors text-sm shadow-lg shadow-amber-500/20"
                  >
                      <Check size={16}/> Zatwierdź ({pickedItemsBuffer.length})
                  </button>
              </div>
          </div>
      )}

      {/* Modals & Overlays */}
      
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
    </div>
  );
};

export default App;
