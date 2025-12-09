

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FolderOpen, FileJson, Save, X, RefreshCw, AlertTriangle, HardDrive, Search, User, Hash, PenLine, Filter, Trash2, ListFilter, BarChart3, TrendingUp, Users, PieChart, Layers, Calendar, Clock, Trophy, Target, Folder, ChevronRight, Home, ArrowUpLeft, Globe, ScanLine } from 'lucide-react';
import { AppState, ProjectFile, Currency, CalculationMode } from '../types';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';
import { calculateProjectCosts, convert, formatNumber } from '../services/calculationService';

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
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
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
    orderDate?: string;
    protocolDate?: string;
    
    // Calculated fields for stats
    valueOriginal: number;
    currencyOriginal: Currency;
    valuePLN: number;
    timestamp: number;
}

interface DirectoryItem {
    kind: 'file' | 'directory';
    name: string;
    handle: FileSystemHandle;
    date?: Date;
    size?: number;
    path?: string[]; // Added to track folder structure
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
  // Navigation State
  const [pathStack, setPathStack] = useState<{name: string, handle: FileSystemDirectoryHandle}[]>([]);
  const [currentViewItems, setCurrentViewItems] = useState<DirectoryItem[]>([]);
  
  // Index State (For Statistics / Global Search)
  // Stores both files and directories found during recursive scan
  const [searchIndex, setSearchIndex] = useState<DirectoryItem[]>([]);
  
  const [fileMetadata, setFileMetadata] = useState<Record<string, ProjectMetadata>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'stats'>('files');
  
  // Deletion State
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'global' | 'local'>('global');
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filenameSuffix, setFilenameSuffix] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced Filters
  const [filterStage, setFilterStage] = useState('');
  const [filterSales, setFilterSales] = useState('');
  const [filterSupport, setFilterSupport] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

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
          // Initialize path stack if empty
          if (pathStack.length === 0) {
              setPathStack([{ name: 'Katalog Główny', handle: currentDirHandle }]);
              loadDirectoryContents(currentDirHandle);
          }
      }
      return () => {
          if (abortControllerRef.current) abortControllerRef.current.abort();
      };
  }, [isOpen, currentDirHandle]);

  // Trigger stat scan when switching to stats tab
  useEffect(() => {
      if (activeTab === 'stats' && searchIndex.length === 0 && !isScanning && currentDirHandle) {
          startRecursiveScan(currentDirHandle);
      }
  }, [activeTab]);

  // Auto-trigger recursive scan if searching globally and no index exists
  useEffect(() => {
      if (searchTerm.length > 0 && searchScope === 'global' && searchIndex.length === 0 && !isScanning && currentDirHandle) {
          startRecursiveScan(currentDirHandle);
      }
  }, [searchTerm, searchScope]);

  const connectToFolder = async () => {
      setErrorMsg(null);
      try {
          // @ts-ignore
          const handle = await window.showDirectoryPicker({
              mode: 'readwrite',
              startIn: 'desktop'
          });
          onSetDirHandle(handle);
          setPathStack([{ name: 'Katalog Główny', handle }]);
          loadDirectoryContents(handle);
          // Reset deep scan on new connection
          setSearchIndex([]); 
          setFileMetadata({});
          showSnackbar("Połączono z folderem");
      } catch (err: any) {
          console.error("Access denied or cancelled", err);
           if (err.name === 'SecurityError' && err.message.includes('Cross origin sub frames')) {
               setErrorMsg("Przeglądarka zablokowała dostęp do plików w tym oknie. Otwórz aplikację w pełnej karcie.");
           }
      }
  };

  // --- NAVIGATION LOGIC (SHALLOW) ---

  const loadDirectoryContents = async (dirHandle: FileSystemDirectoryHandle) => {
      setIsLoading(true);
      const items: DirectoryItem[] = [];
      
      try {
          // @ts-ignore
          for await (const entry of dirHandle.values()) {
              if (entry.kind === 'directory') {
                  items.push({ kind: 'directory', name: entry.name, handle: entry });
              } else if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                  const fileHandle = entry as FileSystemFileHandle;
                  const file = await fileHandle.getFile(); 
                  items.push({ kind: 'file', name: entry.name, handle: fileHandle, date: new Date(file.lastModified), size: file.size });
              }
          }
          
          // Sort: Folders first (A-Z), then Files (Date Desc)
          items.sort((a, b) => {
              if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
              if (a.kind === 'directory') return a.name.localeCompare(b.name);
              // Files by date desc
              return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
          });

          setCurrentViewItems(items);
          
          // Auto-parse JSONs in current view for metadata display
          // Type casting safety hack
          const filesToParse = items.filter(i => i.kind === 'file') as unknown as {name: string, handle: FileSystemFileHandle}[];
          if (filesToParse.length > 0) {
              scanFilesContent(filesToParse, false); // False = append to metadata, don't replace
          }

      } catch (e) {
          console.error("Error reading directory", e);
          showSnackbar("Błąd odczytu katalogu");
      } finally {
          setIsLoading(false);
      }
  };

  const navigateDown = (folder: DirectoryItem) => {
      if (folder.kind !== 'directory') return;
      const handle = folder.handle as FileSystemDirectoryHandle;
      setPathStack(prev => [...prev, { name: folder.name, handle }]);
      loadDirectoryContents(handle);
      setSearchTerm(''); // Clear search on nav
  };

  const navigateUp = () => {
      if (pathStack.length <= 1) return;
      const newStack = pathStack.slice(0, -1);
      setPathStack(newStack);
      loadDirectoryContents(newStack[newStack.length - 1].handle);
      setSearchTerm('');
  };

  const navigateToCrumb = (index: number) => {
      if (index === pathStack.length - 1) return;
      const newStack = pathStack.slice(0, index + 1);
      setPathStack(newStack);
      loadDirectoryContents(newStack[newStack.length - 1].handle);
      setSearchTerm('');
  };

  // --- STATISTICS / SEARCH LOGIC (RECURSIVE) ---

  const startRecursiveScan = async (rootHandle: FileSystemDirectoryHandle) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      setIsLoading(true);
      setIsScanning(true);
      setScanProgress(0);
      setSearchIndex([]); // Clear index

      const allEntries: DirectoryItem[] = [];
      const jsonFilesToParse: {name: string, handle: FileSystemFileHandle}[] = [];
      
      try {
          // Recursive scanner
          const scanDir = async (dir: FileSystemDirectoryHandle, currentPath: string[]) => {
              // @ts-ignore
              for await (const entry of dir.values()) {
                  if (entry.kind === 'directory') {
                      // Add directory to index
                      allEntries.push({
                          kind: 'directory',
                          name: entry.name,
                          handle: entry,
                          path: currentPath
                      });
                      await scanDir(entry as FileSystemDirectoryHandle, [...currentPath, entry.name]);
                  } else if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                      const fileHandle = entry as FileSystemFileHandle;
                      const file = await fileHandle.getFile();
                      const fileEntry: DirectoryItem = {
                          kind: 'file',
                          name: entry.name,
                          handle: fileHandle,
                          date: new Date(file.lastModified),
                          size: file.size,
                          path: currentPath
                      };
                      allEntries.push(fileEntry);
                      jsonFilesToParse.push({ name: entry.name, handle: fileHandle });
                  }
              }
          };

          await scanDir(rootHandle, []);
          
          setSearchIndex(allEntries);
          
          // Start content scan for metadata
          scanFilesContent(jsonFilesToParse, true);

      } catch (e) {
          console.error("Error deep scanning", e);
          showSnackbar("Błąd skanowania struktury");
          setIsScanning(false);
      } finally {
          setIsLoading(false);
      }
  };

  // Metadata Extraction
  const scanFilesContent = async (fileList: {name: string, handle: FileSystemFileHandle}[], isFullScan: boolean) => {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      if (isFullScan) setIsScanning(true);
      let processed = 0;
      const CHUNK_SIZE = 5; 
      
      for (let i = 0; i < fileList.length; i += CHUNK_SIZE) {
          if (signal.aborted) break;

          const chunk = fileList.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(async (fileEntry) => {
              // Skip if already has metadata
              if (fileMetadata[fileEntry.name]) return;

              try {
                  const file = await fileEntry.handle.getFile();
                  const text = await file.text();
                  const json = JSON.parse(text);
                  
                  const initial = json.appState?.initial || json.initial;
                  const final = json.appState?.final || json.final;
                  const stage = json.stage;
                  const mode = json.appState?.mode || CalculationMode.INITIAL;
                  
                  const clientName = initial?.orderingParty?.name || final?.orderingParty?.name || '-';
                  const projectNumber = initial?.meta?.projectNumber || final?.meta?.projectNumber || '-';
                  const salesPerson = initial?.meta?.salesPerson || final?.meta?.salesPerson;
                  const assistantPerson = initial?.meta?.assistantPerson || final?.meta?.assistantPerson;
                  
                  // Extract dates for stats
                  const orderDate = initial?.meta?.orderDate || final?.meta?.orderDate;
                  const protocolDate = final?.meta?.protocolDate;

                  let valueOriginal = 0;
                  let valuePLN = 0;
                  const currency = json.appState?.offerCurrency || Currency.EUR;

                  try {
                      const activeData = mode === CalculationMode.FINAL ? final : initial;
                      const rate = json.appState?.exchangeRate || 4.3;
                      const ormFee = json.appState?.globalSettings?.ormFeePercent || 1.6;
                      const margin = json.appState?.targetMargin;
                      const manualPrice = json.appState?.manualPrice;
                      const finalManualPrice = json.appState?.finalManualPrice;
                      
                      // SANITIZATION: Fix missing fields to prevent NaN
                      if (activeData) {
                          if (!activeData.suppliers) activeData.suppliers = [];
                          if (!activeData.transport) activeData.transport = [];
                          if (!activeData.otherCosts) activeData.otherCosts = [];
                          if (!activeData.installation) activeData.installation = { stages: [], customItems: [], otherInstallationCosts: 0 };
                          
                          const inst = activeData.installation;
                          const ensureZero = (val: any) => (val === undefined || val === null || isNaN(val)) ? 0 : val;
                          
                          inst.palletSpots = ensureZero(inst.palletSpots);
                          inst.palletSpotPrice = ensureZero(inst.palletSpotPrice);
                          inst.forkliftDailyRate = ensureZero(inst.forkliftDailyRate);
                          inst.forkliftDays = ensureZero(inst.forkliftDays);
                          inst.forkliftTransportPrice = ensureZero(inst.forkliftTransportPrice);
                          inst.scissorLiftDailyRate = ensureZero(inst.scissorLiftDailyRate);
                          inst.scissorLiftDays = ensureZero(inst.scissorLiftDays);
                          inst.scissorLiftTransportPrice = ensureZero(inst.scissorLiftTransportPrice);
                          inst.otherInstallationCosts = ensureZero(inst.otherInstallationCosts);
                          
                          if (!inst.customItems) inst.customItems = [];
                          
                          // Ensure Suppliers item fields are numbers
                          activeData.suppliers.forEach((s: any) => {
                              if (!s.items) s.items = [];
                              s.items.forEach((item: any) => {
                                  item.quantity = ensureZero(item.quantity);
                                  item.unitPrice = ensureZero(item.unitPrice);
                              });
                          });
                      }

                      const costs = calculateProjectCosts(activeData, rate, currency, mode, ormFee, margin, manualPrice);
                      
                      if (manualPrice || finalManualPrice) {
                          valueOriginal = finalManualPrice || manualPrice;
                      } else {
                          const marginDecimal = (margin || 20) / 100;
                          const totalCost = costs.total; 
                          valueOriginal = marginDecimal >= 1 ? 0 : totalCost / (1 - marginDecimal);
                      }
                      
                      valuePLN = convert(valueOriginal, currency, Currency.PLN, rate);
                      
                      // Guard against NaN
                      if (isNaN(valuePLN)) valuePLN = 0;
                      if (isNaN(valueOriginal)) valueOriginal = 0;

                  } catch (e) {
                      console.warn("Cost calc failed for", fileEntry.name, e);
                  }

                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: {
                          clientName,
                          projectNumber,
                          stage,
                          scanned: true,
                          salesPerson,
                          assistantPerson,
                          valueOriginal,
                          currencyOriginal: currency,
                          valuePLN,
                          timestamp: file.lastModified,
                          orderDate,
                          protocolDate
                      }
                  }));

              } catch (err) {
                  setFileMetadata(prev => ({
                      ...prev,
                      [fileEntry.name]: { 
                          scanned: true, 
                          clientName: 'Błąd pliku', 
                          projectNumber: 'ERR',
                          valueOriginal: 0,
                          currencyOriginal: Currency.PLN,
                          valuePLN: 0,
                          timestamp: 0 
                      }
                  }));
              }
          }));

          processed += chunk.length;
          if (isFullScan) {
              setScanProgress(Math.min(100, Math.round((processed / fileList.length) * 100)));
          }
          await new Promise(resolve => setTimeout(resolve, 5));
      }
      if (isFullScan) setIsScanning(false);
  };

  const sanitizeName = (name: string): string => {
      return name.replace(/[^a-zA-Z0-9 \-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').trim() || 'Nieznany';
  };

  const handleSave = async () => {
      // Force save to ROOT structure, NOT just current view
      // We always want to maintain Client -> Project structure
      if (!pathStack || pathStack.length === 0 || !pathStack[0].handle) {
          showSnackbar("Błąd: Brak dostępu do katalogu głównego.");
          return;
      }

      const rootHandle = pathStack[0].handle;
      
      const clientName = appState.initial.orderingParty.name || 'Nieznany Klient';
      const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
      
      const safeClient = sanitizeName(clientName);
      const safeProject = sanitizeName(projectNum);

      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');
      
      let filename = `PROCALC_${safeProject}_DRAFT_${timestamp}`;
      if (filenameSuffix.trim()) {
          const safeSuffix = sanitizeName(filenameSuffix);
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
          // Drill down from root: Client -> Project
          // @ts-ignore
          let targetHandle = await rootHandle.getDirectoryHandle(safeClient, { create: true });
          // @ts-ignore
          targetHandle = await targetHandle.getDirectoryHandle(safeProject, { create: true });

          // @ts-ignore
          const fileHandle = await targetHandle.getFileHandle(filename, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(fileData, null, 2));
          await writable.close();
          
          showSnackbar(`Zapisano w: ${safeClient}/${safeProject}/${filename}`);
          setFilenameSuffix('');
          
          // If we are currently viewing the folder where we just saved, reload content
          const currentViewHandle = pathStack[pathStack.length - 1].handle;
          // Ideally we check if current view matches target, but simple reload is safe
          loadDirectoryContents(currentViewHandle);

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
      const activeDir = pathStack[pathStack.length - 1].handle;
      if (!activeDir || !deleteConfirm) return;
      try {
          await activeDir.removeEntry(deleteConfirm);
          showSnackbar(`Usunięto plik: ${deleteConfirm}`);
          loadDirectoryContents(activeDir);
      } catch (err) {
          console.error(err);
          showSnackbar("Nie udało się usunąć pliku");
      } finally {
          setDeleteConfirm(null);
      }
  };

  // --- DISPLAY LOGIC ---

  // Unified item list for display (mix of folders and files)
  const displayItems = useMemo(() => {
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          
          // Decide source based on scope
          // Global uses `searchIndex` (if populated), otherwise falls back to current view to avoid empty screen
          // Local uses `currentViewItems`
          const source = searchScope === 'global' && searchIndex.length > 0 ? searchIndex : currentViewItems;
          
          const matches = source.filter(item => {
              // Basic Name Match
              if (item.name.toLowerCase().includes(lowerTerm)) return true;
              
              // Folder Path Match (if present)
              if (item.path && item.path.some(p => p.toLowerCase().includes(lowerTerm))) return true;

              // Metadata Match (Files only)
              if (item.kind === 'file') {
                  const meta = fileMetadata[item.name];
                  if (meta) {
                      if (meta.clientName?.toLowerCase().includes(lowerTerm)) return true;
                      if (meta.projectNumber?.toLowerCase().includes(lowerTerm)) return true;
                  }
              }
              return false;
          });

          // SORTING / PRIORITY LOGIC
          // 1. Matching Folders (Directory > File)
          // 2. Matching Client Metadata (File)
          // 3. Matching Project Metadata (File)
          // 4. Matching Filename
          
          return matches.sort((a, b) => {
              const aName = a.name.toLowerCase();
              const bName = b.name.toLowerCase();
              const aIsDir = a.kind === 'directory';
              const bIsDir = b.kind === 'directory';
              
              const aMeta = fileMetadata[a.name];
              const bMeta = fileMetadata[b.name];

              // Priority 1: Folders matching name exactly or partially
              // Put folders first
              if (aIsDir && !bIsDir) return -1;
              if (!aIsDir && bIsDir) return 1;

              if (aIsDir && bIsDir) {
                  // Prefer exact matches or shorter paths (higher up)
                  const aDepth = a.path?.length || 0;
                  const bDepth = b.path?.length || 0;
                  if (aDepth !== bDepth) return aDepth - bDepth;
                  return aName.localeCompare(bName);
              }

              // Both are files
              // Priority 2: Client Name Match in Metadata
              const aClientMatch = aMeta?.clientName?.toLowerCase().includes(lowerTerm);
              const bClientMatch = bMeta?.clientName?.toLowerCase().includes(lowerTerm);
              
              if (aClientMatch && !bClientMatch) return -1;
              if (!aClientMatch && bClientMatch) return 1;

              // Priority 3: Project Number Match
              const aProjMatch = aMeta?.projectNumber?.toLowerCase().includes(lowerTerm);
              const bProjMatch = bMeta?.projectNumber?.toLowerCase().includes(lowerTerm);

              if (aProjMatch && !bProjMatch) return -1;
              if (!aProjMatch && bProjMatch) return 1;

              // Priority 4: Filename / Date
              return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
          });
      }
      
      // Default: Current Folder View
      return currentViewItems;
  }, [searchTerm, searchScope, currentViewItems, searchIndex, fileMetadata]);


  // --- STATISTICS CALCULATION ---
  const statistics = useMemo(() => {
      const allFiles = searchIndex.filter(i => i.kind === 'file') as unknown as {name: string, handle: FileSystemFileHandle, date: Date, size: number, path: string[]}[];
      
      const monthlyStats: Record<string, { offers: number, opened: number, closed: number }> = {};
      
      const projectGroups: Record<string, { 
          latestFile: ProjectMetadata, 
          versionCount: number,
          draftFile?: ProjectMetadata,
          openingFile?: ProjectMetadata,
          finalFile?: ProjectMetadata
      }> = {};

      // Filter Logic for Stats
      const filesToAnalyze = allFiles.filter(f => {
          const meta = fileMetadata[f.name];
          if (!meta || meta.projectNumber === 'ERR' || meta.projectNumber === '-') return false;
          
          // 1. Person Filters
          if (filterSales && meta.salesPerson !== filterSales) return false;
          if (filterSupport && meta.assistantPerson !== filterSupport) return false;
          
          // 2. Stage Filter (Fixed Logic)
          if (filterStage && meta.stage !== filterStage) return false;

          // 3. Date Filters (Fixed Logic)
          // Uses file timestamp (lastModified) which is consistent
          const fileTime = new Date(meta.timestamp).setHours(0,0,0,0);
          
          if (dateFrom) {
              const fromTime = new Date(dateFrom).setHours(0,0,0,0);
              if (fileTime < fromTime) return false;
          }
          if (dateTo) {
              const toTime = new Date(dateTo).setHours(23,59,59,999);
              if (fileTime > toTime) return false;
          }

          return true;
      });

      filesToAnalyze.forEach(f => {
          const meta = fileMetadata[f.name];
          if (!projectGroups[meta.projectNumber!]) {
              projectGroups[meta.projectNumber!] = { latestFile: meta, versionCount: 0 };
          }
          
          if (meta.timestamp > projectGroups[meta.projectNumber!].latestFile.timestamp) {
              projectGroups[meta.projectNumber!].latestFile = meta;
          }
          projectGroups[meta.projectNumber!].versionCount++;

          if (meta.stage === 'DRAFT') {
              if (!projectGroups[meta.projectNumber!].draftFile || meta.timestamp > projectGroups[meta.projectNumber!].draftFile!.timestamp) {
                  projectGroups[meta.projectNumber!].draftFile = meta;
              }
          } else if (meta.stage === 'OPENING') {
              if (!projectGroups[meta.projectNumber!].openingFile || meta.timestamp > projectGroups[meta.projectNumber!].openingFile!.timestamp) {
                  projectGroups[meta.projectNumber!].openingFile = meta;
              }
          } else if (meta.stage === 'FINAL') {
              if (!projectGroups[meta.projectNumber!].finalFile || meta.timestamp > projectGroups[meta.projectNumber!].finalFile!.timestamp) {
                  projectGroups[meta.projectNumber!].finalFile = meta;
              }
          }
      });

      const clientStats: Record<string, number> = {};
      const stageDistribution = { DRAFT: 0, OPENING: 0, FINAL: 0 };
      let totalProjects = 0;
      let globalValue = 0;
      let totalDurationDays = 0;
      let projectsWithDuration = 0;

      const initMonth = (m: string) => {
          if (!monthlyStats[m]) monthlyStats[m] = { offers: 0, opened: 0, closed: 0 };
      };

      Object.values(projectGroups).forEach((group) => {
          const { latestFile, draftFile, openingFile, finalFile } = group;
          
          totalProjects++;
          globalValue += isNaN(latestFile.valuePLN) ? 0 : latestFile.valuePLN;

          const cName = latestFile.clientName || 'Inny';
          clientStats[cName] = (clientStats[cName] || 0) + (isNaN(latestFile.valuePLN) ? 0 : latestFile.valuePLN);

          const stageKey = latestFile.stage as keyof typeof stageDistribution;
          if (stageDistribution[stageKey] !== undefined) {
              stageDistribution[stageKey]++;
          }

          // Consolidated Start/End Dates for Statistics
          // START = Order Date (from any file that has it, prioritizing final > opening > draft)
          const startDateStr = finalFile?.orderDate || openingFile?.orderDate || draftFile?.orderDate;
          // END = Protocol Date (from Final file only)
          const endDateStr = finalFile?.protocolDate;

          // Duration Calculation (Requires both specific dates)
          if (startDateStr && endDateStr) {
              const start = new Date(startDateStr);
              const end = new Date(endDateStr);
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  const diffMs = end.getTime() - start.getTime();
                  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                  totalDurationDays += diffDays;
                  projectsWithDuration++;
              }
          }

          // Monthly Chart Buckets
          
          // 1. Offers (Created) - Bucket by File Creation Timestamp of first Draft/Opening
          const offerSource = draftFile || openingFile;
          if (offerSource) {
              const m = new Date(offerSource.timestamp).toISOString().slice(0, 7);
              initMonth(m);
              monthlyStats[m].offers += isNaN(offerSource.valuePLN) ? 0 : offerSource.valuePLN;
          }

          // 2. Opened (In Progress) - Bucket strictly by Order Date
          if (startDateStr) {
              const m = startDateStr.slice(0, 7);
              initMonth(m);
              // Use opening file value if possible, else latest
              const val = openingFile ? openingFile.valuePLN : latestFile.valuePLN;
              monthlyStats[m].opened += isNaN(val) ? 0 : val;
          }

          // 3. Closed (Finished) - Bucket strictly by Protocol Date
          if (endDateStr && finalFile) {
              const m = endDateStr.slice(0, 7);
              initMonth(m);
              monthlyStats[m].closed += isNaN(finalFile.valuePLN) ? 0 : finalFile.valuePLN;
          }
      });

      const chartData = Object.entries(monthlyStats)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, stats]) => ({ month, ...stats }));

      const topClients = Object.entries(clientStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

      return {
          totalProjects,
          globalValue,
          avgValue: totalProjects > 0 ? globalValue / totalProjects : 0,
          avgDuration: projectsWithDuration > 0 ? totalDurationDays / projectsWithDuration : 0,
          chartData,
          topClients,
          stageDistribution,
          totalFiles: allFiles.length
      };
  }, [searchIndex, fileMetadata, filterSales, filterSupport, filterStage, dateFrom, dateTo]); 

  // --- RENDER STATISTICS VIEW ---
  const renderStatistics = () => {
      const { totalProjects, globalValue, avgValue, chartData, topClients, stageDistribution, avgDuration, totalFiles } = statistics;
      const maxChartValue = Math.max(1, ...chartData.map(d => Math.max(d.offers, d.opened, d.closed)));
      const maxClientValue = topClients.length > 0 ? topClients[0][1] : 1;

      return (
          <div className="space-y-6 animate-fadeIn p-4 overflow-y-auto h-full custom-scrollbar pb-20">
              
              {/* Stats Toolbar */}
              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                      <span className="font-bold">Analiza:</span> {totalFiles} plików (w podfolderach)
                  </div>
                  <button 
                      onClick={() => currentDirHandle && startRecursiveScan(currentDirHandle)}
                      className={`px-3 py-1.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-xs font-bold flex items-center gap-2 transition-colors ${isScanning ? 'animate-pulse cursor-wait' : ''}`}
                  >
                      <RefreshCw size={14} className={isScanning ? "animate-spin" : ""}/> 
                      {isScanning ? 'Skanowanie...' : 'Skanuj Pełną Strukturę'}
                  </button>
              </div>

              {/* Filter Notice */}
              {(filterSales || filterSupport || filterStage || dateFrom || dateTo) && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 rounded text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center gap-2">
                      <Filter size={12}/>
                      <span className="font-bold">Aktywne Filtry:</span>
                      {filterSales && <span className="bg-white dark:bg-zinc-800 px-1 rounded">{filterSales}</span>}
                      {filterSupport && <span className="bg-white dark:bg-zinc-800 px-1 rounded">{filterSupport}</span>}
                      {filterStage && <span className="bg-white dark:bg-zinc-800 px-1 rounded">{filterStage}</span>}
                      {(dateFrom || dateTo) && <span className="bg-white dark:bg-zinc-800 px-1 rounded">{dateFrom} - {dateTo}</span>}
                  </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><Target size={20}/></div>
                      </div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{totalProjects}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Projektów</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600"><TrendingUp size={20}/></div>
                      </div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(globalValue, 0)}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Wartość Całk. (PLN)</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600"><BarChart3 size={20}/></div>
                      </div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(avgValue, 0)}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Średnia Wartość</div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <div className="flex justify-between items-start mb-2">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Clock size={20}/></div>
                      </div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgDuration.toFixed(1)} <span className="text-sm font-normal">dni</span></div>
                      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Czas Trwania</div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Clients */}
                  <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                          <Trophy size={16} className="text-yellow-500"/> Top Klienci (Wartość)
                      </h3>
                      <div className="space-y-3">
                          {topClients.map(([name, val], idx) => (
                              <div key={name} className="relative">
                                  <div className="flex justify-between text-xs mb-1 relative z-10">
                                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{idx+1}. {name}</span>
                                      <span className="font-mono">{formatNumber(val, 0)} PLN</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(val / maxClientValue) * 100}%` }}></div>
                                  </div>
                              </div>
                          ))}
                          {topClients.length === 0 && <div className="text-xs text-zinc-400 italic">Brak danych</div>}
                      </div>
                  </div>

                  {/* Stage Distribution */}
                  <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                          <PieChart size={16} className="text-blue-500"/> Etapy Projektów
                      </h3>
                      <div className="flex items-end justify-around h-32 gap-2">
                          <div className="flex flex-col items-center gap-2 w-1/3 group">
                              <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:scale-110 transition-transform">{stageDistribution.DRAFT}</div>
                              <div className="w-full bg-zinc-300 dark:bg-zinc-600 rounded-t-lg transition-all hover:bg-zinc-400" style={{ height: `${totalProjects ? (stageDistribution.DRAFT/totalProjects)*100 : 0}%`, minHeight: '4px' }}></div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase">Szkic</div>
                          </div>
                          <div className="flex flex-col items-center gap-2 w-1/3 group">
                              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">{stageDistribution.OPENING}</div>
                              <div className="w-full bg-blue-400 rounded-t-lg transition-all hover:bg-blue-500" style={{ height: `${totalProjects ? (stageDistribution.OPENING/totalProjects)*100 : 0}%`, minHeight: '4px' }}></div>
                              <div className="text-[10px] font-bold text-blue-500 uppercase">Otwarte</div>
                          </div>
                          <div className="flex flex-col items-center gap-2 w-1/3 group">
                              <div className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">{stageDistribution.FINAL}</div>
                              <div className="w-full bg-purple-500 rounded-t-lg transition-all hover:bg-purple-600" style={{ height: `${totalProjects ? (stageDistribution.FINAL/totalProjects)*100 : 0}%`, minHeight: '4px' }}></div>
                              <div className="text-[10px] font-bold text-purple-500 uppercase">Zamknięte</div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                      <Calendar size={16} className="text-zinc-500"/> Aktywność Miesięczna (Wartość PLN)
                  </h3>
                  <div className="h-40 flex items-end gap-2 relative">
                      {chartData.map((d) => (
                          <div key={d.month} className="flex-1 flex flex-col justify-end gap-0.5 group relative h-full">
                              {/* Bars */}
                              <div className="w-full bg-purple-500 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.closed / maxChartValue) * 80}%` }} title={`Zamknięte: ${formatNumber(d.closed,0)}`}></div>
                              <div className="w-full bg-blue-400 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.opened / maxChartValue) * 80}%` }} title={`Otwarte: ${formatNumber(d.opened,0)}`}></div>
                              <div className="w-full bg-zinc-300 dark:bg-zinc-600 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.offers / maxChartValue) * 80}%` }} title={`Oferty: ${formatNumber(d.offers,0)}`}></div>
                              
                              {/* Label */}
                              <div className="text-[9px] text-zinc-400 -rotate-45 mt-2 origin-left translate-x-1">{d.month.slice(2)}</div>
                          </div>
                      ))}
                      {chartData.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 italic">Brak danych historycznych</div>}
                  </div>
                  <div className="flex gap-4 justify-center mt-6">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500"><div className="w-2 h-2 bg-zinc-300 dark:bg-zinc-600"></div> Oferty</div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500"><div className="w-2 h-2 bg-blue-400"></div> Realizacja</div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500"><div className="w-2 h-2 bg-purple-500"></div> Zamknięte</div>
                  </div>
              </div>
          </div>
      );
  };

  const handleGlobalJumpToFolder = (item: DirectoryItem) => {
      // Since we don't have the parent handle chain to build the stack, we just replace it 
      // with Root -> This Folder (effectively a "jump")
      if (item.kind === 'directory' && currentDirHandle) {
          // Note: Without traversing we can't truly build the stack unless we store handles in recursive scan.
          // But recursive scan stores handles!
          const handle = item.handle as FileSystemDirectoryHandle;
          // Reconstruct path for breadcrumbs string (visual only as we miss intermediate handles)
          // Actually, we can just push this folder as if it's direct child of root visually for now 
          // or ideally, we'd need to change how pathStack works.
          // Simple approach: Clear stack to Root, then load this folder content as current. 
          // Losing "Up" capability to immediate parent, but gaining navigation.
          setPathStack([{ name: 'Katalog Główny', handle: currentDirHandle }, { name: item.name, handle }]);
          loadDirectoryContents(handle);
          setSearchTerm('');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div 
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-slideUp border border-zinc-200 dark:border-zinc-700"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 rounded-lg">
                        <HardDrive size={24}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                            Menedżer Projektów
                            {activeTab === 'stats' && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Statystyki</span>}
                        </h2>
                        
                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1 overflow-hidden">
                            <button onClick={() => navigateToCrumb(0)} className="hover:text-amber-500 transition-colors flex items-center gap-1"><Home size={10}/> Root</button>
                            {pathStack.slice(1).map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    <ChevronRight size={10}/>
                                    <button 
                                        onClick={() => navigateToCrumb(idx + 1)}
                                        className="hover:text-amber-500 transition-colors truncate max-w-[100px]"
                                        title={crumb.name}
                                    >
                                        {crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-200 dark:bg-zinc-700 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('files')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${activeTab === 'files' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                        >
                            <FolderOpen size={14}/> Pliki
                        </button>
                        <button 
                            onClick={() => setActiveTab('stats')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                        >
                            <BarChart3 size={14}/> Statystyki
                        </button>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={24}/>
                    </button>
                </div>
            </div>

            {/* ERROR BANNER */}
            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-900/30 p-3 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 justify-center">
                    <AlertTriangle size={14}/> {errorMsg}
                </div>
            )}

            {/* SCAN PROGRESS */}
            {isScanning && (
                <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all duration-300 animate-pulse" style={{ width: `${scanProgress}%` }}></div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* SIDEBAR FILTERS (Visible in both tabs if toggled, or always in stats?) */}
                {(showFilters || activeTab === 'stats') && (
                    <div className="w-64 bg-zinc-50 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-700 p-4 overflow-y-auto shrink-0 flex flex-col gap-6">
                        <div>
                            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2"><Filter size={12}/> Filtrowanie</h3>
                            
                            {/* Search Scope Switcher */}
                            {activeTab === 'files' && (
                                <div className="flex bg-white dark:bg-zinc-800 p-1 rounded-md border border-zinc-200 dark:border-zinc-700 mb-3">
                                    <button 
                                        onClick={() => setSearchScope('global')}
                                        className={`flex-1 text-[10px] font-bold py-1 rounded-sm transition-colors ${searchScope === 'global' ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        title="Szukaj w całej strukturze (wymaga skanu)"
                                    >
                                        <Globe size={12} className="inline mr-1"/> Globalne
                                    </button>
                                    <button 
                                        onClick={() => setSearchScope('local')}
                                        className={`flex-1 text-[10px] font-bold py-1 rounded-sm transition-colors ${searchScope === 'local' ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                                        title="Szukaj tylko w bieżącym folderze"
                                    >
                                        <ScanLine size={12} className="inline mr-1"/> Folder
                                    </button>
                                </div>
                            )}

                            {/* Search Input */}
                            <div className="relative mb-3">
                                <Search className="absolute left-2.5 top-2.5 text-zinc-400" size={14}/>
                                <input 
                                    type="text" 
                                    placeholder={searchScope === 'global' ? "Szukaj w całej bazie..." : "Szukaj tutaj..."}
                                    className="w-full pl-8 p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-400"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Data (Od - Do)</label>
                                    <div className="flex gap-1">
                                        <input type="date" className="w-full p-1 text-[10px] border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                        <input type="date" className="w-full p-1 text-[10px] border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Etap Projektu</label>
                                    <select className="w-full p-1.5 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                                        <option value="">Wszystkie</option>
                                        <option value="DRAFT">Szkic (Draft)</option>
                                        <option value="OPENING">Otwarte (Realizacja)</option>
                                        <option value="FINAL">Zamknięte</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Handlowiec</label>
                                    <input list="filter-sales" className="w-full p-1.5 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700" value={filterSales} onChange={e => setFilterSales(e.target.value)} placeholder="Wszyscy" />
                                    <datalist id="filter-sales">{SALES_PEOPLE.map((p, i) => <option key={i} value={p}/>)}</datalist>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Wsparcie</label>
                                    <input list="filter-support" className="w-full p-1.5 text-xs border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700" value={filterSupport} onChange={e => setFilterSupport(e.target.value)} placeholder="Wszyscy" />
                                    <datalist id="filter-support">{SUPPORT_PEOPLE.map((p, i) => <option key={i} value={p}/>)}</datalist>
                                </div>
                            </div>
                        </div>

                        {activeTab === 'files' && (
                            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2"><Save size={12}/> Zapisz Obecny</h3>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        placeholder="Opcjonalny przyrostek nazwy..." 
                                        className="w-full p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-green-400"
                                        value={filenameSuffix}
                                        onChange={(e) => setFilenameSuffix(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleSave}
                                        disabled={!currentDirHandle}
                                        className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-colors flex justify-center items-center gap-2"
                                    >
                                        <Save size={14}/> Zapisz (DRAFT)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CONTENT LIST */}
                <div className="flex-1 bg-white dark:bg-zinc-900 overflow-y-auto custom-scrollbar relative">
                    
                    {activeTab === 'stats' ? renderStatistics() : (
                        <>
                            {/* Toolbar in File View */}
                            {!searchTerm && (
                                <div className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-2 flex items-center gap-2">
                                    <button onClick={navigateUp} disabled={pathStack.length <= 1} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-30">
                                        <ArrowUpLeft size={16}/>
                                    </button>
                                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                                    <button onClick={() => setShowFilters(!showFilters)} className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 ${showFilters ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-zinc-500'}`}>
                                        <ListFilter size={16}/>
                                    </button>
                                    {!currentDirHandle && (
                                        <button onClick={connectToFolder} className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-2">
                                            <FolderOpen size={14}/> Wybierz Folder Roboczy
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* FILE LIST */}
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {!currentDirHandle && (
                                    <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                                        <FolderOpen size={48} className="mb-4 opacity-20"/>
                                        <p>Nie wybrano folderu roboczego.</p>
                                        <button onClick={connectToFolder} className="mt-4 text-blue-500 font-bold hover:underline">Wybierz Folder</button>
                                    </div>
                                )}

                                {currentDirHandle && displayItems.length === 0 && !isLoading && (
                                    <div className="p-12 text-center text-zinc-400">
                                        <p>Folder jest pusty lub brak wyników wyszukiwania.</p>
                                        {searchScope === 'global' && searchIndex.length === 0 && (
                                            <p className="text-xs mt-2 text-zinc-500">Aby szukać globalnie, kliknij "Skanuj Pełną Strukturę" w zakładce Statystyki.</p>
                                        )}
                                    </div>
                                )}

                                {displayItems.map((item, idx) => {
                                    const meta = item.kind === 'file' ? fileMetadata[item.name] : null;
                                    const isDirectory = item.kind === 'directory';
                                    
                                    return (
                                        <div 
                                            key={`${item.name}-${idx}`} 
                                            className="group flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                            onClick={() => {
                                                if (isDirectory) {
                                                    // Standard nav or Jump nav
                                                    if (searchTerm) handleGlobalJumpToFolder(item);
                                                    else navigateDown(item);
                                                } else {
                                                    handleLoad(item.handle as FileSystemFileHandle);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`p-2 rounded-lg shrink-0 ${isDirectory ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                                    {isDirectory ? <Folder size={20} fill="currentColor" fillOpacity={0.2}/> : <FileJson size={20}/>}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate pr-4">
                                                        {item.name}
                                                    </div>
                                                    {/* Path Display in Search Mode */}
                                                    {searchTerm && item.path && item.path.length > 0 && (
                                                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                                            <Folder size={8} /> {item.path.join(' / ')}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Metadata Display */}
                                                    {!isDirectory && (
                                                        <div className="text-[10px] text-zinc-500 flex items-center gap-3 mt-0.5">
                                                            <span className="flex items-center gap-1"><Calendar size={10}/> {item.date?.toLocaleDateString()}</span>
                                                            {meta?.scanned && (
                                                                <>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className="flex items-center gap-1 font-bold text-zinc-600 dark:text-zinc-400">{meta.clientName}</span>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className="flex items-center gap-1 font-mono">{meta.projectNumber}</span>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] border ${
                                                                        meta.stage === 'FINAL' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                                                        meta.stage === 'OPENING' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                                                        'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                                    }`}>
                                                                        {meta.stage}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                {meta && meta.scanned && (
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{formatNumber(meta.valuePLN, 0)} PLN</div>
                                                        <div className="text-[9px] text-zinc-400">{meta.salesPerson || '-'}</div>
                                                    </div>
                                                )}
                                                
                                                {deleteConfirm === item.name ? (
                                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 p-1 rounded" onClick={(e) => e.stopPropagation()}>
                                                        <span className="text-[10px] text-red-600 font-bold">Usunąć?</span>
                                                        <button onClick={handleDeleteFile} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 size={12}/></button>
                                                        <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300"><X size={12}/></button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.name); }}
                                                        className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Usuń plik"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
