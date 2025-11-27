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
  VariantItem
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
import { fetchEurRate } from './services/currencyService';
import { Moon, Sun, History, Download, Upload, FilePlus, HardDrive, MousePointer2, X, Plus, Check, Trash2 } from 'lucide-react';

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

    // Calculate destination (Bottom Left, where the basket icon is roughly located)
    // Assuming icon is at roughly left: 30px, bottom: 30px
    const targetX = 30; 
    const targetY = window.innerHeight - 30;
    
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    return (
        <div 
            className="fixed z-[9999] pointer-events-none bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-yellow-600 flex items-center gap-1"
            style={{ 
                left: startX, 
                top: startY,
                // We use CSS variables for the transform destination
                '--tx': `${deltaX}px`,
                '--ty': `${deltaY}px`,
                animation: 'flyToBasket 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
            } as React.CSSProperties}
        >
            <Plus size={12} strokeWidth={3} /> {label}
        </div>
    );
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    initial: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
    final: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
    mode: CalculationMode.INITIAL,
    viewMode: ViewMode.CALCULATOR,
    exchangeRate: 4.30, 
    offerCurrency: Currency.EUR, 
    clientCurrency: Currency.PLN, 
    targetMargin: 20,
    manualPrice: null
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  
  // --- VISUAL PICKING MODE STATE ---
  const [pickingVariantId, setPickingVariantId] = useState<string | null>(null);
  const [pickedItemsBuffer, setPickedItemsBuffer] = useState<VariantItem[]>([]); // Staging area
  const [flyingParticles, setFlyingParticles] = useState<FlyingParticleProps[]>([]);
  const [basketPulse, setBasketPulse] = useState(false);

  // File System Handle State (Persisted during session)
  const [dirHandle, setDirHandle] = useState<any>(null);

  // --- Dialog State ---
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
  
  // --- History Management (Undo/Redo) ---
  const [past, setPast] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  
  // Snackbar State
  const [snackbar, setSnackbar] = useState<{message: string, action?: () => void, actionLabel?: string} | null>(null);

  const lastSnapshot = useRef<AppState>(appState);
  const isUndoRedoOperation = useRef(false);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const getHistoryState = (state: AppState) => {
    const { viewMode, ...dataState } = state; 
    return dataState;
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
        if(parsed.initial && typeof parsed.initial.nameplateQty === 'undefined') parsed.initial.nameplateQty = 0;
        if(parsed.final && typeof parsed.final.nameplateQty === 'undefined') parsed.final.nameplateQty = 0;
        if(parsed.initial && typeof parsed.initial.installation.finalInstallationCosts === 'undefined') parsed.initial.installation.finalInstallationCosts = [];
        if(parsed.final && typeof parsed.final.installation.finalInstallationCosts === 'undefined') parsed.final.installation.finalInstallationCosts = [];
        if(parsed.initial && !parsed.initial.variants) parsed.initial.variants = [];
        if(parsed.final && !parsed.final.variants) parsed.final.variants = [];

        const mergedState = { ...appState, ...parsed };
        setAppState(mergedState);
        lastSnapshot.current = mergedState; 
      } catch (e) {
        console.error("Failed to load save state", e);
      }
    }
    
    setIsLoaded(true);

    fetchEurRate().then(rate => {
      if (rate) setAppState(prev => ({ ...prev, exchangeRate: rate }));
    });
  }, []);

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

      historyTimeoutRef.current = setTimeout(() => {
          const currentDataState = getHistoryState(appState);
          const lastDataState = getHistoryState(lastSnapshot.current);

          if (JSON.stringify(currentDataState) !== JSON.stringify(lastDataState)) {
              setPast(prev => {
                  const newPast = [...prev, lastSnapshot.current];
                  return newPast.slice(-50); 
              });
              
              const now = new Date();
              setHistoryLog(prev => [{
                  timestamp: now.getTime(),
                  state: lastSnapshot.current,
                  description: `Zmiana: ${now.toLocaleTimeString()}`
              }, ...prev].slice(0, 50));

              setFuture([]);
              lastSnapshot.current = appState;
          } else {
              lastSnapshot.current = appState;
          }
      }, 1000);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

      return () => {
          if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      };
  }, [appState, isLoaded]);

  // --- PICKING MODE LOGIC ---
  
  const handleVariantItemPick = (item: { id: string, type: VariantItemType, label: string }, origin?: {x: number, y: number}) => {
      if (!pickingVariantId) return;

      // Check if already in buffer
      if (pickedItemsBuffer.some(i => i.id === item.id && i.type === item.type)) {
          showSnackbar("Ten element jest już wybrany (w koszyku).");
          return;
      }

      // Check if already in the existing variant
      const dataKey = appState.mode === CalculationMode.INITIAL ? 'initial' : 'final';
      const variants = appState[dataKey].variants;
      const targetVariant = variants.find(v => v.id === pickingVariantId);
      if (targetVariant && targetVariant.items.some(i => i.id === item.id && i.type === item.type)) {
          showSnackbar("Ten element jest już w wariancie.");
          return;
      }

      // Add to buffer
      setPickedItemsBuffer(prev => [...prev, {
          id: item.id,
          type: item.type,
          originalDescription: item.label
      }]);

      // Trigger Animation
      if (origin) {
          const pid = Date.now();
          setFlyingParticles(prev => [...prev, { 
              id: pid, 
              startX: origin.x, 
              startY: origin.y, 
              label: item.label.length > 20 ? item.label.substring(0,20)+'...' : item.label,
              onComplete: (id) => {
                  setFlyingParticles(p => p.filter(x => x.id !== id));
                  // Trigger basket pulse
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

      // Commit changes to AppState
      setAppState(prev => {
          const newState = { ...prev };
          const dataKey = prev.mode === CalculationMode.INITIAL ? 'initial' : 'final';
          const variants = [...newState[dataKey].variants]; // Shallow copy of array
          
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
      if (past.length === 0) return;
      const previousState = past[past.length - 1];
      const newPast = past.slice(0, -1);
      isUndoRedoOperation.current = true; 
      setFuture(prev => [appState, ...prev]);
      setPast(newPast);
      setAppState(previousState);
      showSnackbar("Cofnięto zmianę");
  };

  const handleRedo = () => {
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
          appState,
          historyLog,
          past,
          future
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
          if (parsed.appState) {
               if(parsed.appState.initial && !parsed.appState.initial.variants) parsed.appState.initial.variants = [];
               if(parsed.appState.final && !parsed.appState.final.variants) parsed.appState.final.variants = [];

               setAppState(parsed.appState);
               if (parsed.historyLog) setHistoryLog(parsed.historyLog);
               if (parsed.past) setPast(parsed.past);
               if (parsed.future) setFuture(parsed.future);
          } else {
               const merged = { ...appState, ...parsed };
                if(merged.initial && !merged.initial.variants) merged.initial.variants = [];
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
              setAppState({
                initial: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
                final: JSON.parse(JSON.stringify(EMPTY_CALCULATION)),
                mode: CalculationMode.INITIAL,
                viewMode: ViewMode.CALCULATOR,
                exchangeRate: appState.exchangeRate, 
                offerCurrency: Currency.EUR, 
                clientCurrency: Currency.PLN, 
                targetMargin: 20,
                manualPrice: null
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
    { label: 'Nowy Projekt', icon: <FilePlus size={16}/>, onClick: handleNewProject, danger: true },
    { label: 'Otwórz Menedżer Projektów', icon: <HardDrive size={16}/>, onClick: () => setShowProjectManager(true) },
    { label: 'Pobierz Projekt (.json)', icon: <Download size={16}/>, onClick: handleExport },
    { label: 'Wczytaj Projekt (.json)', icon: <Upload size={16}/>, onClick: () => projectInputRef.current?.click() },
    { label: 'Historia Zmian', icon: <History size={16}/>, onClick: () => setShowHistory(true) },
    { label: 'Zmień Motyw', icon: isDarkMode ? <Sun size={16}/> : <Moon size={16}/>, onClick: toggleTheme },
  ];

  if (!isLoaded) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 font-sans">Ładowanie...</div>;

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors font-sans selection:bg-yellow-200 dark:selection:bg-yellow-900 flex flex-col">
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
         menuItems={menuItems}
         projectInputRef={projectInputRef}
         handleImport={handleImport}
      />

      {/* Main Layout - Clean light background, refined padding */}
      <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto p-4 md:px-6 md:pb-6 md:pt-3 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start pt-6">
        
        {/* LEFT COLUMN (Forms) */}
        {appState.viewMode === ViewMode.CALCULATOR && (
            <div className="xl:col-span-9 space-y-6 animate-slideInRight pb-24">
                {/* If in Final Mode, show Comparison Header or specific Final View */}
                {isFinal ? (
                    <FinalCalculationView 
                        data={appState.final}
                        initialData={appState.initial}
                        onChange={(updated) => updateCalculationData(updated)}
                        exchangeRate={appState.exchangeRate}
                        offerCurrency={appState.offerCurrency}
                    />
                ) : (
                    <>
                    <CustomerSection 
                        data={{ payer: data.payer, recipient: data.recipient, orderingParty: data.orderingParty }} 
                        onChange={(field, val) => updateCalculationData({ [field]: val })} 
                    />
                    
                    <ProjectMetaForm data={data.meta} mode={appState.mode} onChange={(val) => updateCalculationData({ meta: val })} />

                    <SuppliersSection 
                        suppliers={data.suppliers} 
                        transport={data.transport}
                        installation={data.installation}
                        onChange={(val) => updateCalculationData({ suppliers: val })}
                        onBatchChange={handleBatchUpdate}
                        onOpenComparison={() => setAppState(prev => ({...prev, viewMode: ViewMode.COMPARISON }))}
                        exchangeRate={appState.exchangeRate}
                        offerCurrency={appState.offerCurrency}
                        nameplateQty={data.nameplateQty}
                        onNameplateChange={(qty) => updateCalculationData({ nameplateQty: qty })}
                        onConfirm={triggerConfirm}
                        // PICKING PROPS
                        isPickingMode={!!pickingVariantId}
                        onPick={handleVariantItemPick}
                    />
                    
                    <TransportSection 
                        transport={data.transport} 
                        suppliers={data.suppliers}
                        onChange={(val) => updateCalculationData({ transport: val })} 
                        exchangeRate={appState.exchangeRate}
                        offerCurrency={appState.offerCurrency}
                         // PICKING PROPS
                        isPickingMode={!!pickingVariantId}
                        onPick={handleVariantItemPick}
                    />

                    <OtherCostsSection 
                        costs={data.otherCosts} 
                        onChange={(val) => updateCalculationData({ otherCosts: val })} 
                        exchangeRate={appState.exchangeRate}
                        offerCurrency={appState.offerCurrency}
                         // PICKING PROPS
                        isPickingMode={!!pickingVariantId}
                        onPick={handleVariantItemPick}
                    />

                    <InstallationSection 
                        data={data.installation} 
                        suppliers={data.suppliers}
                        onChange={(val) => updateCalculationData({ installation: val })}
                        exchangeRate={appState.exchangeRate}
                        offerCurrency={appState.offerCurrency}
                         // PICKING PROPS
                        isPickingMode={!!pickingVariantId}
                        onPick={handleVariantItemPick}
                    />
                    
                    {/* VARIANTS SECTION - Moved to Bottom (Only in Initial Mode) */}
                    <VariantsSection 
                            data={data}
                            onChange={(updated) => updateCalculationData(updated)}
                            exchangeRate={appState.exchangeRate}
                            offerCurrency={appState.offerCurrency}
                            onConfirm={triggerConfirm}
                            onEnterPickingMode={(id) => setPickingVariantId(id)}
                    />

                    <SummarySection 
                        appState={appState} 
                        onUpdateState={(updates) => setAppState(prev => ({ ...prev, ...updates }))}
                        data={data}
                    />
                    </>
                )}
            </div>
        )}

        {/* FULL SCREEN MODES */}
        {appState.viewMode === ViewMode.LOGISTICS && (
            <div className="xl:col-span-12 animate-slideInRight">
                 <LogisticsView data={data} onUpdateSupplier={(id, updates) => {
                     const updatedSuppliers = data.suppliers.map(s => s.id === id ? { ...s, ...updates } : s);
                     updateCalculationData({ suppliers: updatedSuppliers });
                 }}/>
            </div>
        )}

        {appState.viewMode === ViewMode.COMPARISON && (
            <div className="xl:col-span-12 animate-slideInRight">
                <ComparisonView 
                    suppliers={data.suppliers} 
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}
        
        {appState.viewMode === ViewMode.NOTES && (
             <div className="xl:col-span-12 animate-slideInRight">
                <ProjectNotesView 
                    data={data} 
                    onChange={(updates) => updateCalculationData(updates)}
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}

        {appState.viewMode === ViewMode.DOCUMENTS && (
             <div className="xl:col-span-12 animate-slideInRight">
                <DocumentsView 
                    data={data} 
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}

        {/* RIGHT COLUMN (Summary & Navigation) - Hidden on mobile/tablet (xl:block) */}
        {appState.viewMode === ViewMode.CALCULATOR && (
            <div className="hidden xl:block xl:col-span-3 space-y-6 sticky top-0">
                <SidePanel 
                    appState={appState} 
                    onUndo={handleUndo} 
                    onRedo={handleRedo}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                />
            </div>
        )}

      </main>

      {/* RENDER FLYING PARTICLES */}
      {flyingParticles.map(p => (
          <FlyingParticle key={p.id} {...p} />
      ))}

      {/* Floating Summary - Visible ONLY on small screens (xl:hidden) */}
      {!pickingVariantId && (
        <FloatingSummary data={data} appState={appState} />
      )}

      {/* PICKING MODE OVERLAY BAR */}
      {pickingVariantId && (
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 text-white p-4 z-[999] animate-slideUp flex flex-col md:flex-row items-center justify-between shadow-2xl border-t-2 border-yellow-500 gap-4">
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div className={`bg-yellow-500 p-2 rounded-full text-black transition-transform duration-200 shrink-0 ${basketPulse ? 'scale-150' : ''}`}>
                      <MousePointer2 size={24} />
                  </div>
                  <div className="overflow-hidden flex-1">
                      <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-bold text-lg leading-none whitespace-nowrap">Tryb Wybierania</h3>
                           <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                               {data.variants.find(v => v.id === pickingVariantId)?.name}
                           </span>
                      </div>
                      
                      {/* Picked Items Horizontal Scroll List */}
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
                      className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm"
                  >
                      <X size={16}/> Anuluj
                  </button>
                   <button 
                      onClick={handleConfirmPicking}
                      disabled={pickedItemsBuffer.length === 0}
                      className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm shadow-lg shadow-yellow-500/20"
                  >
                      <Check size={16}/> Zatwierdź ({pickedItemsBuffer.length})
                  </button>
              </div>
          </div>
      )}

      {/* Modals & Overlays */}
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

      {/* Global Confirmation Dialog */}
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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 animate-slideUp z-[100]">
              <span>{snackbar.message}</span>
              {snackbar.action && (
                  <button onClick={snackbar.action} className="text-yellow-500 font-bold hover:text-yellow-400 text-sm">
                      {snackbar.actionLabel || 'OK'}
                  </button>
              )}
          </div>
      )}
    </div>
  );
};

export default App;