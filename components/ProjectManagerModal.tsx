import React, { useState, useEffect } from 'react';
import { FolderOpen, FileJson, Save, Download, X, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react';
import { AppState, CalculationData, HistoryEntry, ProjectFile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  historyLog: HistoryEntry[];
  past: AppState[];
  future: AppState[];
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

export const ProjectManagerModal: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    appState, 
    historyLog, 
    past, 
    future,
    onLoadProject,
    showSnackbar,
    currentDirHandle,
    onSetDirHandle
}) => {
  const [files, setFiles] = useState<{name: string, handle: FileSystemFileHandle, date?: Date}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  }, [isOpen, currentDirHandle]);

  const connectToFolder = async () => {
      setErrorMsg(null);
      try {
          // @ts-ignore - API might not be in standard TS lib yet
          const handle = await window.showDirectoryPicker({
              mode: 'readwrite',
              startIn: 'desktop' // Browser doesn't allow forcing network path, user must pick once
          });
          onSetDirHandle(handle);
          await listFiles(handle);
          showSnackbar("Połączono z folderem");
      } catch (err: any) {
          console.error("Access denied or cancelled", err);
           if (err.name === 'SecurityError' && err.message.includes('Cross origin sub frames')) {
               setErrorMsg("Przeglądarka zablokowała dostęp do plików w tym oknie (iframe/podgląd). Otwórz aplikację w nowej, pełnej karcie przeglądarki, aby korzystać z tej funkcji.");
           }
      }
  };

  const listFiles = async (handle: FileSystemDirectoryHandle) => {
      setIsLoading(true);
      setErrorMsg(null);
      const jsonFiles: {name: string, handle: FileSystemFileHandle, date?: Date}[] = [];
      
      try {
          // @ts-ignore
          for await (const entry of handle.values()) {
              if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                   const fileHandle = entry as FileSystemFileHandle;
                   // Get metadata for sorting
                   const file = await fileHandle.getFile();
                   jsonFiles.push({
                       name: entry.name,
                       handle: fileHandle,
                       date: new Date(file.lastModified)
                   });
              }
          }
          // Sort by date desc
          jsonFiles.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
          setFiles(jsonFiles);
      } catch (e) {
          console.error("Error listing files", e);
          showSnackbar("Błąd odczytu listy plików");
      } finally {
          setIsLoading(false);
      }
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
          historyLog,
          past,
          future
      };

      try {
          const fileHandle = await currentDirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(fileData, null, 2));
          await writable.close();
          
          showSnackbar(`Zapisano: ${filename}`);
          await listFiles(currentDirHandle); // Refresh list
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <HardDrive className="text-yellow-500"/> Menedżer Projektów (Sieć/Lokalny)
            </h2>
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
                            Aby przeglądać i zapisywać projekty bezpośrednio, musisz wskazać folder docelowy. 
                            Przeglądarka zapamięta dostęp do czasu zamknięcia karty.
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
                    <div className="flex justify-between items-center mb-4 shrink-0">
                         <div className="flex items-center gap-2 text-sm text-zinc-500">
                             <span className="bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1 font-bold">
                                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Połączono
                             </span>
                             <span className="hidden sm:inline text-zinc-400 truncate max-w-[300px]" title={currentDirHandle.name}>
                                 {currentDirHandle.name}
                             </span>
                         </div>
                         <div className="flex gap-2">
                             <button 
                                onClick={() => listFiles(currentDirHandle)}
                                className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                                title="Odśwież listę"
                             >
                                 <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''}/>
                             </button>
                             <button 
                                onClick={handleSave}
                                className="bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded font-bold hover:opacity-90 flex items-center gap-2"
                             >
                                 <Save size={18}/> Zapisz Obecny Projekt
                             </button>
                         </div>
                    </div>

                    {/* File List */}
                    <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                        {files.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic">
                                {isLoading ? 'Wczytywanie listy...' : 'Brak plików .json w tym folderze.'}
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 sticky top-0 z-10 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-3 border-b dark:border-zinc-700">Nazwa Pliku</th>
                                        <th className="p-3 border-b dark:border-zinc-700 text-right">Data Modyfikacji</th>
                                        <th className="p-3 border-b dark:border-zinc-700 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                                    {files.map((file, idx) => (
                                        <tr 
                                            key={file.name} 
                                            className="hover:bg-yellow-50 dark:hover:bg-yellow-900/10 group transition-colors cursor-pointer animate-slideInRight"
                                            style={{ animationDelay: `${idx * 0.05}s` }}
                                            onClick={() => handleLoad(file.handle)}
                                        >
                                            <td className="p-3 flex items-center gap-3">
                                                <FileJson className="text-zinc-400 group-hover:text-yellow-600" size={20}/>
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white">
                                                    {file.name}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-xs text-zinc-500 font-mono">
                                                {file.date?.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleLoad(file.handle); }}
                                                    className="px-3 py-1 bg-zinc-100 hover:bg-yellow-400 hover:text-black dark:bg-zinc-800 dark:text-zinc-300 rounded text-xs font-bold transition-colors"
                                                >
                                                    Wczytaj
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};