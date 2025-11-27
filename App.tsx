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
  ProjectFile
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
import { fetchEurRate } from './services/currencyService';
import { Moon, Sun, History, Download, Upload, FilePlus } from 'lucide-react';

const STORAGE_KEY = 'procalc_data_v1';
const THEME_KEY = 'procalc_theme';

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const text = ev.target?.result as string;
              const parsed = JSON.parse(text);

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
    { label: 'Pobierz Projekt (.json)', icon: <Download size={16}/>, onClick: handleExport },
    { label: 'Wczytaj Projekt (.json)', icon: <Upload size={16}/>, onClick: () => projectInputRef.current?.click() },
    { label: 'Historia Zmian', icon: <History size={16}/>, onClick: () => setShowHistory(true) },
    { label: isDarkMode ? 'Tryb Jasny' : 'Tryb Ciemny', icon: isDarkMode ? <Sun size={16}/> : <Moon size={16}/>, onClick: toggleTheme },
  ];

  if (!isLoaded) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 font-sans">Ładowanie...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors font-sans selection:bg-yellow-200 dark:selection:bg-yellow-900">
      
      <Header 
         appState={appState}
         setAppState={setAppState}
         onUndo={handleUndo}
         onRedo={handleRedo}
         canUndo={past.length > 0}
         canRedo={future.length > 0}
         onShowComparison={() => setShowComparison(true)}
         menuItems={menuItems}
         projectInputRef={projectInputRef}
         handleImport={handleImport}
      />

      {/* Main Layout */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (Forms) */}
        <div className={`xl:col-span-9 space-y-6 ${appState.viewMode !== ViewMode.CALCULATOR ? 'hidden xl:block opacity-50 pointer-events-none h-0 overflow-hidden' : ''}`}>
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
               />
               
               <TransportSection 
                  transport={data.transport} 
                  suppliers={data.suppliers}
                  onChange={(val) => updateCalculationData({ transport: val })} 
                  exchangeRate={appState.exchangeRate}
                  offerCurrency={appState.offerCurrency}
               />

               <OtherCostsSection 
                  costs={data.otherCosts} 
                  onChange={(val) => updateCalculationData({ otherCosts: val })} 
                  exchangeRate={appState.exchangeRate}
                  offerCurrency={appState.offerCurrency}
               />

               <InstallationSection 
                  data={data.installation} 
                  suppliers={data.suppliers}
                  onChange={(val) => updateCalculationData({ installation: val })}
                  exchangeRate={appState.exchangeRate}
                  offerCurrency={appState.offerCurrency}
               />
               
               {/* VARIANTS SECTION - Moved to Bottom (Only in Initial Mode) */}
               <VariantsSection 
                    data={data}
                    onChange={(updated) => updateCalculationData(updated)}
                    exchangeRate={appState.exchangeRate}
                    offerCurrency={appState.offerCurrency}
                    onConfirm={triggerConfirm}
               />

               <SummarySection 
                  appState={appState} 
                  onUpdateState={(updates) => setAppState(prev => ({ ...prev, ...updates }))}
                  data={data}
               />
             </>
           )}
        </div>

        {/* FULL SCREEN MODES */}
        {appState.viewMode === ViewMode.LOGISTICS && (
            <div className="xl:col-span-12 animate-fadeIn">
                 <LogisticsView data={data} onUpdateSupplier={(id, updates) => {
                     const updatedSuppliers = data.suppliers.map(s => s.id === id ? { ...s, ...updates } : s);
                     updateCalculationData({ suppliers: updatedSuppliers });
                 }}/>
            </div>
        )}

        {appState.viewMode === ViewMode.COMPARISON && (
            <div className="xl:col-span-12 animate-fadeIn">
                <ComparisonView 
                    suppliers={data.suppliers} 
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}
        
        {appState.viewMode === ViewMode.NOTES && (
             <div className="xl:col-span-12 animate-fadeIn">
                <ProjectNotesView 
                    data={data} 
                    onChange={(updates) => updateCalculationData(updates)}
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}

        {appState.viewMode === ViewMode.DOCUMENTS && (
             <div className="xl:col-span-12 animate-fadeIn">
                <DocumentsView 
                    data={data} 
                    onBack={() => setAppState(prev => ({...prev, viewMode: ViewMode.CALCULATOR}))} 
                />
            </div>
        )}

        {/* RIGHT COLUMN (Summary & Navigation) */}
        {appState.viewMode === ViewMode.CALCULATOR && (
            <div className="xl:col-span-3 space-y-6">
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