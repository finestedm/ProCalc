
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FolderOpen, FileJson, Save, X, RefreshCw, AlertTriangle, HardDrive, Search, User, Hash, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { AppState, ProjectFile } from '../types';

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
  const [searchTerm, setSearchTerm] = useState('');
  
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
                  
                  // Extract data safely
                  const initial = json.appState?.initial || json.initial;
                  const final = json.appState?.final || json.final;
                  const mode = json.appState?.mode || 'INITIAL';
                  
                  // Use Final data if mode is Final, else Initial
                  const targetData = mode === 'FINAL' && final ? final : initial;
                  
                  // Try to find total value
                  // Note: Calculating total value exactly is complex without the service, 
                  // we'll try to find a saved total or estimate it.
                  // For now, let's look for ordering party and project number
                  
                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: {
                          clientName: targetData?.orderingParty?.name || '-',
                          projectNumber: targetData?.meta?.projectNumber || '-',
                          scanned: true
                      }
                  }));

              } catch (err) {
                  // If parse fails
                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: { scanned: true, clientName: 'Błąd pliku' }
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
      
      const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `PROCALC_${projectNum}_${timestamp}.json`;

      const fileData: ProjectFile = {
          version: '1.0',
          timestamp: Date.now(),
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

  // Filter Logic
  const filteredFiles = useMemo(() => {
      if (!searchTerm) return files;
      const lowerTerm = searchTerm.toLowerCase();
      
      return files.filter(f => {
          const meta = fileMetadata[f.name];
          const matchesName = f.name.toLowerCase().includes(lowerTerm);
          const matchesClient = meta?.clientName?.toLowerCase().includes(lowerTerm);
          const matchesProject = meta?.projectNumber?.toLowerCase().includes(lowerTerm);
          
          return matchesName || matchesClient || matchesProject;
      });
  }, [files, searchTerm, fileMetadata]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
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
                            Aplikacja przeskanuje pliki, aby umożliwić wyszukiwanie.
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
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0">
                         {/* Search Bar */}
                         <div className="relative w-full md:max-w-md">
                             <Search className="absolute left-3 top-2.5 text-zinc-400" size={18}/>
                             <input 
                                type="text" 
                                placeholder="Szukaj: Klient, Nr Projektu, Nazwa pliku..." 
                                className="w-full pl-10 p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:border-yellow-400 outline-none text-sm shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                             />
                         </div>

                         <div className="flex gap-2 w-full md:w-auto">
                             <button 
                                onClick={() => listFiles(currentDirHandle)}
                                className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                                title="Odśwież i przeskanuj ponownie"
                             >
                                 <RefreshCw size={18} className={isLoading || isScanning ? 'animate-spin' : ''}/>
                             </button>
                             <button 
                                onClick={handleSave}
                                className="flex-1 md:flex-none bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg font-bold hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
                             >
                                 <Save size={18}/> Zapisz Projekt
                             </button>
                         </div>
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

                    {/* File List */}
                    <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 shadow-inner custom-scrollbar">
                        {files.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic">
                                {isLoading ? <Loader2 className="animate-spin mb-2" size={24}/> : <FileJson size={32} className="mb-2 opacity-50"/>}
                                {isLoading ? 'Wczytywanie listy...' : 'Brak plików .json w tym folderze.'}
                            </div>
                        ) : filteredFiles.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic">
                                Brak wyników dla "{searchTerm}".
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 sticky top-0 z-10 text-[10px] uppercase font-bold tracking-wider backdrop-blur-sm">
                                    <tr>
                                        <th className="p-3 border-b dark:border-zinc-700 pl-4">Nazwa Pliku</th>
                                        <th className="p-3 border-b dark:border-zinc-700 w-1/4"><div className="flex items-center gap-1"><Hash size={12}/> Nr Projektu</div></th>
                                        <th className="p-3 border-b dark:border-zinc-700 w-1/4"><div className="flex items-center gap-1"><User size={12}/> Klient</div></th>
                                        <th className="p-3 border-b dark:border-zinc-700 w-32 text-right"><div className="flex items-center justify-end gap-1"><Calendar size={12}/> Data</div></th>
                                        <th className="p-3 border-b dark:border-zinc-700 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredFiles.map((file, idx) => {
                                        const meta = fileMetadata[file.name];
                                        return (
                                            <tr 
                                                key={file.name} 
                                                className="hover:bg-yellow-50 dark:hover:bg-yellow-900/10 group transition-colors cursor-pointer"
                                                onClick={() => handleLoad(file.handle)}
                                            >
                                                <td className="p-3 pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-zinc-400 group-hover:text-yellow-600 transition-colors">
                                                            <FileJson size={18}/>
                                                        </div>
                                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white truncate max-w-[250px]">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                                                    {meta ? (
                                                        <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{meta.projectNumber}</span>
                                                    ) : (
                                                        <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse"></div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                                                    {meta ? (
                                                        <span className="truncate block max-w-[200px]">{meta.clientName}</span>
                                                    ) : (
                                                        <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse"></div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right text-xs text-zinc-500 font-mono">
                                                    {file.date.toLocaleDateString()} <span className="text-zinc-300">|</span> {file.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </td>
                                                <td className="p-3 text-right pr-4">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleLoad(file.handle); }}
                                                        className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-yellow-400 hover:text-yellow-600 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:border-yellow-500 dark:text-zinc-300 rounded text-xs font-bold transition-all shadow-sm"
                                                    >
                                                        Wczytaj
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="text-right text-[10px] text-zinc-400 mt-2 px-1">
                        Wyświetlono {filteredFiles.length} z {files.length} plików.
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
