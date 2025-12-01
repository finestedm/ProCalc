
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FolderOpen, FileJson, Save, X, RefreshCw, AlertTriangle, HardDrive, Search, User, Hash, Calendar, DollarSign, Loader2, PenLine, Filter, Trash2, ListFilter } from 'lucide-react';
import { AppState, ProjectFile } from '../types';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  historyLog: any[];
  past: any[];
  future: any[];
  onLoadProject: (data: any) => void;
  showSnackbar: (msg: string) => void;
  currentDirHandle: any; 
  onSetDirHandle: (handle: any) => void;
}

// Interfaces for File System Access API
interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile: () => Promise<File>;
    createWritable: () => Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    values: () => AsyncIterableIterator<FileSystemHandle>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
    removeEntry: (name: string) => Promise<void>;
}

interface FileSystemWritableFileStream extends WritableStream {
    write: (data: any) => Promise<void>;
    close: () => Promise<void>;
}

// Metadata extracted from file content
interface ProjectMetadata {
    clientName?: string;
    projectNumber?: string;
    totalValue?: string;
    currency?: string;
    scanned: boolean;
    stage?: string;
    salesPerson?: string;
    assistantPerson?: string;
}

export const ProjectManagerModal: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    appState, 
    onLoadProject,
    showSnackbar,
    currentDirHandle,
    onSetDirHandle
}) => {
  const [files, setFiles] = useState<{name: string, handle: FileSystemFileHandle, date: Date, size: number}[]>([]);
  const [fileMetadata, setFileMetadata] = useState<Record<string, ProjectMetadata>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Deletion State
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filenameSuffix, setFilenameSuffix] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // New Filters
  const [filterStage, setFilterStage] = useState('');
  const [filterSales, setFilterSales] = useState('');
  const [filterSupport, setFilterSupport] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const targetPathHint = "\\\\WAW1S03030\\Departments\\PION_SL\\Projekty manualne (SL1)_PROJEKTY_SL - testowy\\PROCALC";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initial load if handle exists
  useEffect(() => {
      if (isOpen && currentDirHandle) {
          listFiles(currentDirHandle);
      }
      return () => {
          if (abortControllerRef.current) abortControllerRef.current.abort();
      };
  }, [isOpen, currentDirHandle]);

  const connectToFolder = async () => {
      setErrorMsg(null);
      try {
          // @ts-ignore
          const handle = await window.showDirectoryPicker({
              mode: 'readwrite',
              startIn: 'desktop'
          });
          onSetDirHandle(handle);
          await listFiles(handle);
          showSnackbar("Połączono z folderem");
      } catch (err: any) {
          console.error("Access denied or cancelled", err);
           if (err.name === 'SecurityError' && err.message.includes('Cross origin sub frames')) {
               setErrorMsg("Przeglądarka zablokowała dostęp do plików w tym oknie. Otwórz aplikację w pełnej karcie.");
           }
      }
  };

  const listFiles = async (handle: FileSystemDirectoryHandle) => {
      // Stop previous scan if running
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      setIsLoading(true);
      setIsScanning(false);
      setScanProgress(0);
      setErrorMsg(null);
      setFileMetadata({}); // Reset metadata

      const jsonFiles: {name: string, handle: FileSystemFileHandle, date: Date, size: number}[] = [];
      
      try {
          // @ts-ignore
          for await (const entry of handle.values()) {
              if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                   const fileHandle = entry as FileSystemFileHandle;
                   const file = await fileHandle.getFile();
                   jsonFiles.push({
                       name: entry.name,
                       handle: fileHandle,
                       date: new Date(file.lastModified),
                       size: file.size
                   });
              }
          }
          // Sort by date desc initially
          jsonFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
          setFiles(jsonFiles);
          
          // Start background scan
          scanFilesContent(jsonFiles);

      } catch (e) {
          console.error("Error listing files", e);
          showSnackbar("Błąd odczytu listy plików");
      } finally {
          setIsLoading(false);
      }
  };

  // Background scanner to extract metadata
  const scanFilesContent = async (fileList: {name: string, handle: FileSystemFileHandle}[]) => {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      setIsScanning(true);
      let processed = 0;

      // Process in chunks to not freeze UI
      const CHUNK_SIZE = 3; 
      
      for (let i = 0; i < fileList.length; i += CHUNK_SIZE) {
          if (signal.aborted) break;

          const chunk = fileList.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(async (fileEntry) => {
              try {
                  const file = await fileEntry.handle.getFile();
                  const text = await file.text();
                  const json = JSON.parse(text);
                  
                  // Safe Data Extraction Logic
                  const initial = json.appState?.initial || json.initial;
                  const final = json.appState?.final || json.final;
                  const stage = json.stage;
                  
                  const clientName = initial?.orderingParty?.name || final?.orderingParty?.name || '-';
                  const projectNumber = initial?.meta?.projectNumber || final?.meta?.projectNumber || '-';
                  
                  // Extract People
                  const salesPerson = initial?.meta?.salesPerson || final?.meta?.salesPerson;
                  const assistantPerson = initial?.meta?.assistantPerson || final?.meta?.assistantPerson;

                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: {
                          clientName: clientName,
                          projectNumber: projectNumber,
                          stage: stage,
                          scanned: true,
                          salesPerson,
                          assistantPerson
                      }
                  }));

              } catch (err) {
                  // If parse fails
                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: { scanned: true, clientName: 'Błąd pliku', projectNumber: 'ERR' }
                  }));
              }
          }));

          processed += chunk.length;
          setScanProgress(Math.min(100, Math.round((processed / fileList.length) * 100)));
          
          // Yield to main thread
          await new Promise(resolve => setTimeout(resolve, 10));
      }
      setIsScanning(false);
  };

  const handleSave = async () => {
      if (!currentDirHandle) return;
      
      // Always use INITIAL project number for identity to keep grouped
      const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
      
      // Use local time to ensure uniqueness per second and match App.tsx logic
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
      
      let filename = `PROCALC_${projectNum}_DRAFT_${timestamp}`;
      if (filenameSuffix.trim()) {
          const safeSuffix = filenameSuffix.replace(/[^a-zA-Z0-9-_ ]/g, '');
          filename += `_${safeSuffix}`;
      }
      filename += '.json';

      const fileData: ProjectFile = {
          version: '1.0',
          timestamp: Date.now(),
          stage: 'DRAFT',
          appState,
          historyLog: [],
          past: [],
          future: []
      };

      try {
          const fileHandle = await currentDirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(fileData, null, 2));
          await writable.close();
          
          showSnackbar(`Zapisano: ${filename}`);
          setFilenameSuffix(''); // Reset suffix after save
          // Reload list to see new file
          listFiles(currentDirHandle); 
      } catch (err) {
          console.error(err);
          showSnackbar("Błąd zapisu pliku");
      }
  };

  const handleLoad = async (fileHandle: FileSystemFileHandle) => {
      try {
          const file = await fileHandle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);
          onLoadProject(data);
          onClose();
      } catch (err) {
          console.error(err);
          showSnackbar("Błąd odczytu/parsowania pliku");
      }
  };

  const handleDeleteFile = async () => {
      if (!currentDirHandle || !deleteConfirm) return;
      
      try {
          await currentDirHandle.removeEntry(deleteConfirm);
          showSnackbar(`Usunięto plik: ${deleteConfirm}`);
          await listFiles(currentDirHandle); // Refresh
      } catch (err) {
          console.error(err);
          showSnackbar("Nie udało się usunąć pliku");
      } finally {
          setDeleteConfirm(null);
      }
  };

  // Grouping & Filtering Logic - 2 Levels
  const groupedHierarchy = useMemo(() => {
      // 1. Filter
      let filtered = files;
      const lowerTerm = searchTerm.toLowerCase();
      
      filtered = files.filter(f => {
          const meta = fileMetadata[f.name];
          
          // Text Filter
          let matchesText = true;
          if (searchTerm) {
              const matchesName = f.name.toLowerCase().includes(lowerTerm);
              const matchesClient = meta?.clientName?.toLowerCase().includes(lowerTerm);
              const matchesProject = meta?.projectNumber?.toLowerCase().includes(lowerTerm);
              matchesText = matchesName || matchesClient || matchesProject;
          }

          // Date Filter
          let matchesDate = true;
          const fileDate = f.date.setHours(0,0,0,0);
          if (dateFrom) {
              const dFrom = new Date(dateFrom).setHours(0,0,0,0);
              if (fileDate < dFrom) matchesDate = false;
          }
          if (dateTo) {
              const dTo = new Date(dateTo).setHours(23,59,59,999);
              if (f.date.getTime() > dTo) matchesDate = false;
          }

          // Advanced Filters
          let matchesStage = true;
          if (filterStage && meta?.stage !== filterStage) matchesStage = false;

          let matchesSales = true;
          if (filterSales && meta?.salesPerson !== filterSales) matchesSales = false;

          let matchesSupport = true;
          if (filterSupport && meta?.assistantPerson !== filterSupport) matchesSupport = false;

          return matchesText && matchesDate && matchesStage && matchesSales && matchesSupport;
      });

      // 2. Group by CLIENT -> PROJECT
      const clientGroups: Record<string, Record<string, typeof files>> = {};

      filtered.forEach(f => {
          const meta = fileMetadata[f.name];
          const clientName = (meta?.clientName && meta.clientName !== '-' && meta.clientName !== 'Błąd pliku') 
              ? meta.clientName 
              : 'Pozostali Klienci';
          
          const projectNum = (meta?.projectNumber && meta.projectNumber !== '-' && meta.projectNumber !== 'BRAK') 
              ? meta.projectNumber 
              : 'Inne Projekty';

          if (!clientGroups[clientName]) {
              clientGroups[clientName] = {};
          }
          if (!clientGroups[clientName][projectNum]) {
              clientGroups[clientName][projectNum] = [];
          }
          clientGroups[clientName][projectNum].push(f);
      });

      // 3. Flatten
      const result = Object.entries(clientGroups).map(([clientName, projectsMap]) => {
          const projects = Object.entries(projectsMap).map(([projectNum, files]) => {
              files.sort((a, b) => b.date.getTime() - a.date.getTime());
              return { projectNum, files };
          });

          projects.sort((a, b) => {
              const dateA = a.files[0]?.date.getTime() || 0;
              const dateB = b.files[0]?.date.getTime() || 0;
              return dateB - dateA;
          });

          return { clientName, projects };
      });

      result.sort((a, b) => {
          const dateA = a.projects[0]?.files[0]?.date.getTime() || 0;
          const dateB = b.projects[0]?.files[0]?.date.getTime() || 0;
          return dateB - dateA;
      });

      return result;

  }, [files, searchTerm, dateFrom, dateTo, filterStage, filterSales, filterSupport, fileMetadata]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700 relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* DELETE CONFIRMATION OVERLAY */}
        {deleteConfirm && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-red-200 dark:border-red-800 p-6 max-w-md w-full animate-scaleIn">
                    <div className="flex items-center gap-3 text-red-600 dark:text-red-500 mb-4">
                        <AlertTriangle size={24} />
                        <h3 className="text-lg font-bold">Potwierdź usunięcie</h3>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-6">
                        Czy na pewno chcesz trwale usunąć plik: <br/>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white block mt-1 break-all bg-zinc-100 dark:bg-zinc-800 p-2 rounded">{deleteConfirm}</span>
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setDeleteConfirm(null)}
                            className="px-4 py-2 rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 text-sm font-bold"
                        >
                            Anuluj
                        </button>
                        <button 
                            onClick={handleDeleteFile}
                            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm"
                        >
                            Usuń trwale
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <div className="flex flex-col">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    <HardDrive className="text-yellow-500"/> Menedżer Projektów
                </h2>
                {currentDirHandle && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Połączono</span>
                        <span className="text-xs text-zinc-400 truncate max-w-[400px]" title={currentDirHandle.name}>{currentDirHandle.name}</span>
                    </div>
                )}
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
            
            {!currentDirHandle ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-full">
                        <FolderOpen size={64} className="text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-200">Wskaż folder projektów</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-lg mx-auto">
                            Wybierz folder sieciowy lub lokalny, w którym przechowywane są pliki `.json`. 
                            Aplikacja przeskanuje pliki, aby umożliwić wyszukiwanie i grupowanie.
                        </p>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded text-sm text-blue-800 dark:text-blue-300 font-mono max-w-2xl break-all">
                        Zalecana ścieżka:<br/>
                        {targetPathHint}
                    </div>

                    {errorMsg && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded text-sm text-red-600 dark:text-red-300 max-w-lg flex items-start gap-2 text-left">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                            {errorMsg}
                        </div>
                    )}

                    <button 
                        onClick={connectToFolder}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white dark:text-black font-bold py-3 px-8 rounded-lg shadow-md transition-transform active:scale-95 flex items-center gap-2"
                    >
                        <FolderOpen size={20}/> Połącz z folderem
                    </button>
                </div>
            ) : (
                <div className="flex flex-col h-full animate-fadeIn">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-2 mb-4 shrink-0 bg-white dark:bg-zinc-900 z-10">
                         {/* Primary Bar */}
                         <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                             {/* Filters Group */}
                             <div className="flex flex-col sm:flex-row gap-2 w-full xl:max-w-3xl">
                                 <div className="relative flex-1">
                                     <Search className="absolute left-3 top-2.5 text-zinc-400" size={16}/>
                                     <input 
                                        type="text" 
                                        placeholder="Szukaj: Klient, Projekt, Plik..." 
                                        className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 focus:border-yellow-400 outline-none text-sm shadow-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                     />
                                 </div>
                                 <button 
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-3 py-2 border rounded-lg flex items-center gap-2 text-sm font-bold transition-colors ${showFilters ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'}`}
                                 >
                                     <ListFilter size={16}/> Filtry
                                 </button>
                             </div>

                             {/* Actions Group */}
                             <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                                 <div className="relative flex-1 sm:flex-none">
                                    <PenLine className="absolute left-3 top-2.5 text-zinc-400" size={16}/>
                                    <input 
                                        type="text" 
                                        placeholder="Dopisek (np. v2)"
                                        className="w-full sm:w-32 pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 focus:border-yellow-400 outline-none text-sm h-[38px]"
                                        value={filenameSuffix}
                                        onChange={(e) => setFilenameSuffix(e.target.value)}
                                        maxLength={20}
                                    />
                                 </div>
                                 
                                 <button 
                                    onClick={handleSave}
                                    className="bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-bold hover:opacity-90 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap text-sm h-[38px]"
                                 >
                                     <Save size={16}/> Zapisz
                                 </button>

                                 <button 
                                    onClick={() => listFiles(currentDirHandle)}
                                    className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 h-[38px] w-[38px] flex items-center justify-center"
                                    title="Odśwież i przeskanuj ponownie"
                                 >
                                     <RefreshCw size={16} className={isLoading || isScanning ? 'animate-spin' : ''}/>
                                 </button>
                             </div>
                         </div>

                         {/* Expanded Filters */}
                         {showFilters && (
                             <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 animate-slideUp">
                                 <div className="flex gap-2 items-center md:col-span-2 lg:col-span-1">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Data:</span>
                                    <input 
                                        type="date" 
                                        className="p-1 border rounded text-xs bg-white dark:bg-zinc-900"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                        type="date" 
                                        className="p-1 border rounded text-xs bg-white dark:bg-zinc-900"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                 </div>
                                 <div>
                                     <select 
                                        className="w-full p-1.5 border rounded text-xs bg-white dark:bg-zinc-900"
                                        value={filterStage}
                                        onChange={(e) => setFilterStage(e.target.value)}
                                     >
                                         <option value="">Wszystkie Etapy</option>
                                         <option value="DRAFT">Draft</option>
                                         <option value="OPENING">Opening</option>
                                         <option value="FINAL">Final</option>
                                     </select>
                                 </div>
                                 <div>
                                     <input 
                                        list="filter-sales-list"
                                        placeholder="Handlowiec..."
                                        className="w-full p-1.5 border rounded text-xs bg-white dark:bg-zinc-900"
                                        value={filterSales}
                                        onChange={(e) => setFilterSales(e.target.value)}
                                     />
                                     <datalist id="filter-sales-list">
                                         {SALES_PEOPLE.map((p, i) => <option key={i} value={p} />)}
                                     </datalist>
                                 </div>
                                 <div>
                                     <input 
                                        list="filter-support-list"
                                        placeholder="Wsparcie..."
                                        className="w-full p-1.5 border rounded text-xs bg-white dark:bg-zinc-900"
                                        value={filterSupport}
                                        onChange={(e) => setFilterSupport(e.target.value)}
                                     />
                                     <datalist id="filter-support-list">
                                         {SUPPORT_PEOPLE.map((p, i) => <option key={i} value={p} />)}
                                     </datalist>
                                 </div>
                                 {(dateFrom || dateTo || filterStage || filterSales || filterSupport) && (
                                     <button 
                                        onClick={() => { setDateFrom(''); setDateTo(''); setFilterStage(''); setFilterSales(''); setFilterSupport(''); }}
                                        className="text-xs text-red-500 hover:underline md:col-span-4 text-right"
                                     >
                                         Wyczyść filtry
                                     </button>
                                 )}
                             </div>
                         )}
                    </div>

                    {/* Scanning Progress Bar */}
                    {isScanning && (
                        <div className="mb-2 shrink-0">
                            <div className="flex justify-between text-[10px] text-zinc-400 uppercase font-bold mb-1">
                                <span>Indeksowanie plików...</span>
                                <span>{scanProgress}%</span>
                            </div>
                            <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {/* Hierarchy List */}
                    <div className="flex-1 overflow-y-auto rounded-lg bg-transparent custom-scrollbar space-y-6 pr-2 pb-4">
                        {files.length === 0 && !isLoading && (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <FileJson size={32} className="mb-2 opacity-50"/>
                                Brak plików .json w tym folderze.
                            </div>
                        )}
                        
                        {groupedHierarchy.length === 0 && files.length > 0 && (
                             <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                Brak wyników dla obecnych filtrów.
                            </div>
                        )}

                        {groupedHierarchy.map(clientGroup => (
                            <div key={clientGroup.clientName} className="animate-fadeIn">
                                {/* LEVEL 1: CLIENT HEADER */}
                                <div className="flex items-center gap-3 mb-2 sticky top-0 bg-zinc-100 dark:bg-black/90 backdrop-blur-sm z-10 py-2 border-b-2 border-zinc-300 dark:border-zinc-700">
                                    <div className="bg-zinc-800 dark:bg-zinc-100 text-white dark:text-black p-1.5 rounded-md shadow-sm">
                                        <User size={16} />
                                    </div>
                                    <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                                        {clientGroup.clientName}
                                    </h3>
                                    <span className="text-xs text-zinc-400 font-normal">({clientGroup.projects.length} projekty)</span>
                                </div>

                                <div className="space-y-4 pl-2 border-l-2 border-zinc-200 dark:border-zinc-800 ml-3">
                                    {clientGroup.projects.map(projectGroup => (
                                        <div key={projectGroup.projectNum} className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                            {/* LEVEL 2: PROJECT HEADER */}
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-600 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                                                        <Hash size={12} className="text-zinc-400"/>
                                                        {projectGroup.projectNum}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                                    {projectGroup.files.length} wersji
                                                </div>
                                            </div>

                                            {/* LEVEL 3: FILES TABLE */}
                                            <table className="w-full text-left border-collapse">
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                    {projectGroup.files.map(file => {
                                                        const meta = fileMetadata[file.name];
                                                        let statusColor = 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300';
                                                        let statusLabel = 'DRAFT';
                                                        
                                                        if (meta?.stage === 'OPENING') {
                                                            statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-900';
                                                            statusLabel = 'OPENING';
                                                        } else if (meta?.stage === 'FINAL') {
                                                            statusColor = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900';
                                                            statusLabel = 'FINAL';
                                                        }

                                                        return (
                                                            <tr 
                                                                key={file.name} 
                                                                className="hover:bg-yellow-50 dark:hover:bg-yellow-900/10 group transition-colors cursor-pointer"
                                                                onClick={() => handleLoad(file.handle)}
                                                            >
                                                                <td className="p-2 pl-4 w-24 align-top">
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded shadow-sm ${statusColor}`}>
                                                                        {statusLabel}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 align-top">
                                                                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white break-all leading-snug">
                                                                        {file.name}
                                                                    </div>
                                                                    {/* Show metadata preview in advanced view mode implicitly */}
                                                                    <div className="text-[10px] text-zinc-400 mt-0.5 flex gap-2">
                                                                        {meta?.salesPerson && <span>H: {meta.salesPerson}</span>}
                                                                        {meta?.assistantPerson && <span>W: {meta.assistantPerson}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-right text-xs text-zinc-500 font-mono w-48 whitespace-nowrap align-top">
                                                                    {file.date.toLocaleDateString()} <span className="text-zinc-300 mx-1">|</span> {file.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </td>
                                                                <td className="p-2 pr-4 w-24 align-top flex justify-end gap-2">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.name); }}
                                                                        className="p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Usuń plik"
                                                                    >
                                                                        <Trash2 size={14}/>
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleLoad(file.handle); }}
                                                                        className="px-3 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-yellow-400 hover:text-yellow-600 dark:hover:border-yellow-500 dark:text-zinc-300 rounded text-xs font-bold transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        Wczytaj
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
