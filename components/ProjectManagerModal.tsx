import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FolderOpen, FileJson, Save, X, RefreshCw, AlertTriangle, HardDrive, Search, User, Hash, PenLine, Filter, Trash2, ListFilter, BarChart3, TrendingUp, Users, PieChart, Layers, Calendar, Clock, Trophy, Target, Folder, ChevronRight, Home, ArrowUpLeft, Globe, ScanLine, Check, ArrowUpDown, ChevronUp, ChevronDown, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { AppState, ProjectFile, Currency, CalculationMode } from '../types';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';
import { calculateProjectCosts, convert, formatNumber } from '../services/calculationService';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { Cloud, Database } from 'lucide-react';

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
    valueEUR: number;
    costPLN: number; // Added for correct margin calculation
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
    const [pathStack, setPathStack] = useState<{ name: string, handle: FileSystemDirectoryHandle | 'CLOUD_ROOT' | string }[]>([]);
    const [currentViewItems, setCurrentViewItems] = useState<DirectoryItem[]>([]);

    // Source State
    const [source, setSource] = useState<'local' | 'cloud'>('cloud');
    const [cloudData, setCloudData] = useState<SavedCalculation[]>([]);

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
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | string[], name: string, type: 'local' | 'cloud', path?: string[] } | null>(null);
    const [loadConfirm, setLoadConfirm] = useState<{ handle: any, name: string } | null>(null);

    // Filtering & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState<'global' | 'local'>('global');

    const [filenameSuffix, setFilenameSuffix] = useState('');
    const [viewType, setViewType] = useState<'folders' | 'table'>('table');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [tableFilters, setTableFilters] = useState<Record<string, any>>({});
    const [statsFilters, setStatsFilters] = useState<Record<string, any>>({});


    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [activeFilterPop, setActiveFilterPop] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Initial load logic
    useEffect(() => {
        if (isOpen) {
            if (source === 'local' && currentDirHandle) {
                if (pathStack.length === 0) {
                    setPathStack([{ name: 'Katalog Główny', handle: currentDirHandle }]);
                    loadDirectoryContents(currentDirHandle);
                }
            } else if (source === 'cloud') {
                loadCloudData();
            }
        }
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [isOpen, source, currentDirHandle]);

    // --- CLOUD LOGIC ---
    const loadCloudData = async () => {
        setIsLoading(true);
        try {
            const data = await storageService.getCalculations();
            setCloudData(data);
            setPathStack([{ name: 'Chmura (Supabase)', handle: 'CLOUD_ROOT' }]);
            buildCloudView(data, []);
            // Populate metadata immediately for cloud items
            const metaUpdate: Record<string, ProjectMetadata> = {};
            data.forEach(item => {
                // We use the ID as the key for metadata in cloud mode
                const safeCalc = item.calc as any;
                const appState = safeCalc.appState;
                const currency = appState?.offerCurrency || Currency.PLN;
                const rate = appState?.exchangeRate || 4.3; // Fallback rate
                const stage = safeCalc.stage || 'DRAFT';

                const valOriginal = item.total_price || 0;
                const valEUR = currency === Currency.PLN ? valOriginal / rate : valOriginal;

                // Consistent Project ID extraction
                const projNum = item.project_id || appState?.initial?.meta?.projectNumber || safeCalc.meta?.projectNumber || 'Bez Projektu';

                // MATCHING KEY: Must match the name used in searchIndex/buildCloudView
                const displayName = `${stage} - ${new Date(item.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;

                metaUpdate[displayName] = {
                    clientName: item.customer_name,
                    projectNumber: projNum,
                    scanned: true,
                    stage: stage,
                    salesPerson: item.engineer,
                    assistantPerson: item.specialist,
                    valueOriginal: valOriginal,
                    currencyOriginal: currency as Currency,
                    valuePLN: currency === Currency.EUR ? valOriginal * rate : valOriginal,
                    valueEUR: valEUR,
                    costPLN: currency === Currency.EUR ? (item.total_cost || 0) * rate : (item.total_cost || 0),
                    timestamp: new Date(item.created_at).getTime(),
                    orderDate: item.order_date || undefined,
                    protocolDate: item.close_date || undefined
                };
            });
            setFileMetadata(prev => ({ ...prev, ...metaUpdate }));

            // Populate SearchIndex for Statistics/Search in Cloud Mode
            const cloudIndex: DirectoryItem[] = data.map(d => {
                const safeCalc = d.calc as any;
                const appState = safeCalc.appState;
                const currency = appState?.offerCurrency || 'PLN';
                const stage = safeCalc.stage || 'DRAFT';
                const valOriginal = d.total_price || 0;

                const displayName = `${stage} - ${new Date(d.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;

                return {
                    kind: 'file',
                    name: displayName,
                    handle: {
                        kind: 'file',
                        name: `cloud-id:${d.id}`,
                        cloudData: d
                    } as any,
                    date: new Date(d.created_at),
                    size: 0,
                    path: [d.customer_name || 'Inni', d.project_id || safeCalc.appState?.initial?.meta?.projectNumber || safeCalc.meta?.projectNumber || 'Bez Projektu']
                };
            });
            setSearchIndex(cloudIndex);

        } catch (e) {
            console.error(e);
            showSnackbar("Błąd pobierania danych z chmury");
        } finally {
            setIsLoading(false);
        }
    };

    const buildCloudView = (data: SavedCalculation[], currentPath: string[]) => {
        // Grouping Strategy: Client -> Project -> Files
        const items: DirectoryItem[] = [];
        const level = currentPath.length;

        if (level === 0) {
            // Level 0: List Clients
            const clients = Array.from(new Set(data.map(d => d.customer_name || 'Inni')));
            clients.sort().forEach(client => {
                items.push({ kind: 'directory', name: client, handle: { kind: 'directory', name: client } as any });
            });
        } else if (level === 1) {
            // Level 1: List Projects for selected Client
            const client = currentPath[0];
            const clientData = data.filter(d => (d.customer_name || 'Inni') === client);
            // Use project_id column if available, fallback to metadata inside JSON
            const projects = Array.from(new Set(clientData.map(d => d.project_id || (d.calc as any).appState?.initial?.meta?.projectNumber || (d.calc as any).meta?.projectNumber || 'Bez Projektu')));
            projects.sort().forEach(proj => {
                items.push({ kind: 'directory', name: proj, handle: { kind: 'directory', name: proj } as any });
            });
        } else if (level === 2) {
            // Level 2: List Versions (Files)
            const client = currentPath[0];
            const project = currentPath[1];
            const projectData = data.filter(d =>
                (d.customer_name || 'Inni') === client &&
                (d.project_id || (d.calc as any).appState?.initial?.meta?.projectNumber || (d.calc as any).meta?.projectNumber || 'Bez Projektu') === project
            );

            projectData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            projectData.forEach(d => {
                const safeCalc = d.calc as any;
                const appState = safeCalc.appState;
                const currency = appState?.offerCurrency || 'PLN';
                const stage = safeCalc.stage || 'DRAFT';
                const valOriginal = d.total_price || 0;

                const displayName = `${stage} - ${new Date(d.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;

                // Virtual File Handle
                const vHandle: any = {
                    kind: 'file',
                    name: `cloud-id:${d.id}`, // Magic string to identify cloud loading
                    cloudData: d
                };

                items.push({
                    kind: 'file',
                    name: displayName, // Display name in list
                    handle: vHandle,
                    date: new Date(d.created_at),
                    size: 0
                });
            });
        }

        setCurrentViewItems(items);
    };

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
            const filesToParse = items.filter(i => i.kind === 'file') as unknown as { name: string, handle: FileSystemFileHandle }[];
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

        if (source === 'cloud') {
            const newName = folder.name;
            // Construct new path based on stack
            // Stack[0] is Root. Stack[1] is Client. Stack[2] is Project.
            const currentCloudPath = pathStack.slice(1).map(p => p.name);
            const nextPath = [...currentCloudPath, newName];

            setPathStack(prev => [...prev, { name: newName, handle: 'CLOUD_VIRTUAL' }]);
            buildCloudView(cloudData, nextPath);
        } else {
            const handle = folder.handle as FileSystemDirectoryHandle;
            setPathStack(prev => [...prev, { name: folder.name, handle }]);
            loadDirectoryContents(handle);
        }
        setSearchTerm('');
    };

    const navigateUp = () => {
        if (pathStack.length <= 1) return;
        const newStack = pathStack.slice(0, -1);
        setPathStack(newStack);

        if (source === 'cloud') {
            const nextPath = newStack.slice(1).map(p => p.name);
            buildCloudView(cloudData, nextPath);
        } else {
            // @ts-ignore
            loadDirectoryContents(newStack[newStack.length - 1].handle);
        }
        setSearchTerm('');
    };

    const navigateToCrumb = (index: number) => {
        if (index === pathStack.length - 1) return;
        const newStack = pathStack.slice(0, index + 1);
        setPathStack(newStack);

        if (source === 'cloud') {
            const nextPath = newStack.slice(1).map(p => p.name);
            buildCloudView(cloudData, nextPath);
        } else {
            // @ts-ignore
            loadDirectoryContents(newStack[newStack.length - 1].handle);
        }
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
        const jsonFilesToParse: { name: string, handle: FileSystemFileHandle }[] = [];

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
    const scanFilesContent = async (fileList: { name: string, handle: FileSystemFileHandle }[], isFullScan: boolean) => {
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
                    let valueEUR = 0;
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
                        const valueEURCalculated = convert(valueOriginal, currency, Currency.EUR, rate);

                        // Guard against NaN
                        if (isNaN(valuePLN)) valuePLN = 0;
                        if (isNaN(valueOriginal)) valueOriginal = 0;

                        valueEUR = convert(valueOriginal, currency, Currency.EUR, rate);
                        const costPLN = convert(costs.total, currency, Currency.PLN, rate);

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
                                valueEUR,
                                costPLN,
                                timestamp: file.lastModified,
                                orderDate,
                                protocolDate
                            }
                        }));

                    } catch (e) {
                        console.warn("Cost calc failed for", fileEntry.name, e);
                        // Fallback metadata if calc fails but parsing succeeded
                        setFileMetadata(prev => ({
                            ...prev,
                            [fileEntry.name]: {
                                clientName,
                                projectNumber,
                                stage,
                                scanned: true,
                                salesPerson,
                                assistantPerson,
                                valueOriginal: 0,
                                currencyOriginal: currency,
                                valuePLN: 0,
                                valueEUR: 0,
                                costPLN: 0,
                                timestamp: file.lastModified,
                                orderDate,
                                protocolDate
                            }
                        }));
                    }

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
        const mode = appState.mode;
        const activeData = mode === CalculationMode.FINAL ? appState.final : appState.initial;

        // Robust Name Resolution: Try Active Data first, then fallback to Initial, then Default
        let clientName = activeData?.orderingParty?.name;
        if (!clientName || clientName.trim() === '') clientName = appState.initial.orderingParty.name;
        if (!clientName || clientName.trim() === '') clientName = 'Nieznany Klient';

        let projectNum = activeData?.meta?.projectNumber;
        if (!projectNum || projectNum.trim() === '') projectNum = appState.initial.meta.projectNumber;
        if (!projectNum || projectNum.trim() === '') projectNum = 'BezNumeru';

        const safeClient = sanitizeName(clientName);
        const safeProject = sanitizeName(projectNum);

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const timestamp = new Date(now.getTime() - offset).toISOString().slice(0, 19).replace('T', '_').replace(/[:]/g, '-');

        // Prepare File Data (Full Project State)
        const fileData: ProjectFile = {
            version: '1.0',
            timestamp: Date.now(),
            stage: 'DRAFT',
            appState,
            historyLog: [],
            past: [],
            future: []
        };

        if (source === 'cloud') {
            setIsLoading(true);
            try {
                // Calculate Metadata for DB Columns
                const mode = appState.mode;
                const activeData = mode === CalculationMode.FINAL ? appState.final : appState.initial;
                const rate = appState.exchangeRate || 4.3;
                const currency = appState.offerCurrency || Currency.EUR;
                const ormFee = appState.globalSettings.ormFeePercent || 1.6;
                const margin = appState.targetMargin;
                const manualPrice = appState.manualPrice;
                const finalManualPrice = appState.finalManualPrice;

                // Calculate Costs/Price
                const costs = calculateProjectCosts(activeData, rate, currency, mode, ormFee, margin, manualPrice);

                // Determine Total Price (Logic matched with SummarySection)
                let finalPrice = 0;
                const activeManualPrice = mode === CalculationMode.FINAL ? finalManualPrice : manualPrice;

                if (activeManualPrice !== null && activeManualPrice !== undefined) {
                    finalPrice = activeManualPrice;
                } else {
                    const marginDecimal = margin / 100;
                    finalPrice = marginDecimal >= 1
                        ? (costs.total > 0 ? costs.total * 999 : 0)
                        : costs.total / (1 - marginDecimal);
                }

                // We save the FULL ProjectFile structure into the JSON column
                // Cast to any because our storage service assumes CalculationData, but Supabase JSON column is flexible.
                await storageService.saveCalculation(fileData as any, {
                    totalCost: costs.total,
                    totalPrice: finalPrice
                });

                showSnackbar(`Zapisano w chmurze: ${clientName}/${projectNum}`);
                setFilenameSuffix('');

                // Reload to show new file
                loadCloudData();

            } catch (e) {
                console.error(e);
                showSnackbar("Błąd zapisu do chmury");
            } finally {
                setIsLoading(false);
            }
            return; // Stop here, don't execute disk logic
        }

        // --- DISK SAVE LOGIC ---
        // Force save to ROOT structure, NOT just current view
        // We always want to maintain Client -> Project structure
        if (!pathStack || pathStack.length === 0 || !pathStack[0].handle) {
            showSnackbar("Błąd: Brak dostępu do katalogu głównego.");
            return;
        }

        const rootHandle = pathStack[0].handle;

        let filename = `PROCALC_${safeProject}_DRAFT_${timestamp}`;
        if (filenameSuffix.trim()) {
            const safeSuffix = sanitizeName(filenameSuffix);
            filename += `_${safeSuffix}`;
        }
        filename += '.json';



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

    const handleLoad = async (fileHandle: FileSystemFileHandle | any) => {
        // Check if current project is "dirty" or has data
        const currentMeta = appState.mode === CalculationMode.FINAL ? appState.final?.meta : appState.initial?.meta;
        const currentClient = appState.mode === CalculationMode.FINAL ? appState.final?.orderingParty?.name : appState.initial?.orderingParty?.name;

        const isProjectOpen = (currentMeta?.projectNumber && currentMeta.projectNumber !== '-') ||
            (currentClient && currentClient !== '-' && currentClient !== 'Nieznany Klient');

        if (isProjectOpen && !loadConfirm) {
            setLoadConfirm({ handle: fileHandle, name: fileHandle.name || fileHandle.cloudData?.project_id || 'Wybrany projekt' });
            return;
        }

        try {
            if (fileHandle.cloudData) {
                // ... (existing cloud load logic)
                const cloudItem = fileHandle.cloudData as SavedCalculation;
                const rawJson = cloudItem.calc as any;

                if (rawJson.appState) {
                    onLoadProject(rawJson);
                } else {
                    const wrapped: ProjectFile = {
                        version: '1.0',
                        timestamp: Date.now(),
                        stage: 'DRAFT',
                        appState: {
                            initial: rawJson,
                            final: rawJson,
                            scenarios: [],
                            activeScenarioId: 'default',
                            mode: CalculationMode.INITIAL,
                            stage: 'DRAFT',
                            viewMode: 'CALCULATOR',
                            exchangeRate: 4.3,
                            offerCurrency: Currency.EUR,
                            clientCurrency: Currency.PLN,
                            targetMargin: 20,
                            manualPrice: null,
                            finalManualPrice: null,
                            globalSettings: { ormFeePercent: 1.6, truckLoadCapacity: 22000 }
                        } as any,
                        historyLog: [],
                        past: [],
                        future: []
                    };
                    onLoadProject(wrapped);
                }
            } else {
                // Disk Load
                const file = await fileHandle.getFile();
                const text = await file.text();
                const data = JSON.parse(text);
                onLoadProject(data);
            }
            onClose();
            setLoadConfirm(null);
        } catch (err) {
            console.error(err);
            showSnackbar("Błąd odczytu/parsowania pliku");
            setLoadConfirm(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm) return;

        try {
            if (deleteConfirm.type === 'cloud') {
                const idsToDelete = Array.isArray(deleteConfirm.id) ? deleteConfirm.id : [deleteConfirm.id];

                // Delete all targeted IDs
                await Promise.all(idsToDelete.map(id => storageService.deleteCalculation(id)));

                showSnackbar(`Usunięto ${idsToDelete.length > 1 ? 'grupę kalkulacji' : 'kalkulację'} z chmury: ${deleteConfirm.name}`);

                // Proactive state update
                setCloudData(prev => prev.filter(d => !idsToDelete.includes(d.id)));
                setSearchIndex(prev => prev.filter(i => {
                    const handle = i.handle as any;
                    return !(handle && handle.cloudData && idsToDelete.includes(handle.cloudData.id));
                }));

                // Fallback: full reload
                loadCloudData();
            } else {
                const idsToDelete = Array.isArray(deleteConfirm.id) ? deleteConfirm.id : [deleteConfirm.id];
                const rootHandle = pathStack[0].handle;
                if (!rootHandle || rootHandle === 'CLOUD_ROOT') return;

                let targetDir = rootHandle as FileSystemDirectoryHandle;

                // If path exists, navigate to the correct subdirectory
                if (deleteConfirm.path && deleteConfirm.path.length > 0) {
                    for (const folderName of deleteConfirm.path) {
                        targetDir = await targetDir.getDirectoryHandle(folderName);
                    }
                } else {
                    // Fallback to active directory if no path provide
                    const activeDir = pathStack[pathStack.length - 1].handle;
                    if (activeDir && typeof activeDir !== 'string') {
                        targetDir = activeDir as FileSystemDirectoryHandle;
                    }
                }

                // Delete all targeted files
                await Promise.all(idsToDelete.map(name => targetDir.removeEntry(name)));

                showSnackbar(`Usunięto ${idsToDelete.length > 1 ? 'pliki' : 'plik'}: ${deleteConfirm.name}`);

                // Proactive state update for local
                setSearchIndex(prev => prev.filter(item => {
                    if (item.kind !== 'file') return true;
                    if (!idsToDelete.includes(item.name)) return true;
                    // If path matches, it's the specific file
                    if (deleteConfirm.path && item.path) {
                        return !item.path.every((p, idx) => p === deleteConfirm.path![idx]);
                    }
                    return false;
                }));

                setCurrentViewItems(prev => prev.filter(item => !idsToDelete.includes(item.name)));

                // Reload current view
                const currentViewHandle = pathStack[pathStack.length - 1].handle;
                if (currentViewHandle && typeof currentViewHandle !== 'string') {
                    loadDirectoryContents(currentViewHandle);
                }
            }
        } catch (err) {
            console.error(err);
            showSnackbar("Nie udało się usunąć elementu");
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

    const tableData = useMemo(() => {
        let raw: any[] = [];
        if (source === 'cloud') {
            raw = cloudData.map(d => {
                const safeCalc = d.calc as any;
                const appState = safeCalc.appState;
                const currency = appState?.offerCurrency || Currency.EUR;
                const rate = appState?.exchangeRate || 4.3;
                const valueEUR = currency === Currency.EUR ? d.total_price : d.total_price / rate;
                const margin = d.total_price > 0 ? (1 - (d.total_cost / d.total_price)) * 100 : 0;
                return {
                    id: d.id,
                    project_id: d.project_id || safeCalc.appState?.initial?.meta?.projectNumber || safeCalc.meta?.projectNumber || 'Unknown',
                    customer: d.customer_name || 'Inni',
                    price: valueEUR,
                    cost: currency === Currency.EUR ? d.total_cost : d.total_cost / rate,
                    margin,
                    engineer: d.engineer || '-',
                    specialist: d.specialist || '-',
                    stage: safeCalc.stage || 'DRAFT',
                    date: new Date(d.created_at),
                    open_date: d.order_date ? new Date(d.order_date) : null,
                    close_date: d.close_date ? new Date(d.close_date) : null,
                    raw: d
                };
            });
        } else {
            // Local files from searchIndex
            raw = searchIndex.filter(i => i.kind === 'file').map(i => {
                const meta = fileMetadata[i.name];
                const valuePLN = meta?.valuePLN || 0;
                const costPLN = meta?.costPLN || 0;
                const margin = valuePLN > 0 ? (1 - (costPLN / valuePLN)) * 100 : 0;
                return {
                    id: i.name,
                    project_id: meta?.projectNumber || 'Unknown',
                    customer: meta?.clientName || 'Inny',
                    price: meta?.valueEUR || 0,
                    margin,
                    engineer: meta?.salesPerson || '-',
                    specialist: meta?.assistantPerson || '-',
                    stage: meta?.stage || 'DRAFT',
                    date: i.date || new Date(),
                    open_date: meta?.orderDate ? new Date(meta.orderDate) : null,
                    close_date: meta?.protocolDate ? new Date(meta.protocolDate) : null,
                    handle: i.handle,
                    raw: i
                };
            });
        }

        // Apply Column Filters
        let filtered = raw.filter((item: any) => {
            return Object.entries(tableFilters).every(([key, value]) => {
                if (!value) return true;

                // Price & Margin Range Filters
                if (key === 'price' || key === 'margin') {
                    const { min, max } = value as { min?: string, max?: string };
                    const itemVal = Number(item[key]);
                    if (min && itemVal < Number(min)) return false;
                    if (max && itemVal > Number(max)) return false;
                    return true;
                }

                // Date Range Filters
                if (key === 'open_date' || key === 'close_date') {
                    const { from, to } = value as { from?: string, to?: string };
                    const itemDate = item[key] as Date | null;
                    if (!itemDate) return !from && !to;
                    const itemTime = itemDate.getTime();
                    if (from && itemTime < new Date(from).setHours(0, 0, 0, 0)) return false;
                    if (to && itemTime > new Date(to).setHours(23, 59, 59, 999)) return false;
                    return true;
                }

                // Multi-select for Engineer & Specialist
                if (key === 'engineer' || key === 'specialist') {
                    const selected = value as string[];
                    if (selected.length === 0) return true;
                    return selected.includes(item[key]);
                }

                // Stage Select
                if (key === 'stage') {
                    return item.stage === value;
                }

                // Default string match
                const itemVal = String(item[key] || '').toLowerCase();
                return itemVal.includes(String(value).toLowerCase());
            });
        });

        // Apply Global Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter((item: any) =>
                String(item.project_id || '').toLowerCase().includes(lowerTerm) ||
                String(item.customer || '').toLowerCase().includes(lowerTerm) ||
                String(item.engineer || '').toLowerCase().includes(lowerTerm) ||
                String(item.specialist || '').toLowerCase().includes(lowerTerm)
            );
        }

        // Apply Sorting
        filtered.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal instanceof Date && bVal instanceof Date) {
                return sortConfig.direction === 'asc'
                    ? aVal.getTime() - bVal.getTime()
                    : bVal.getTime() - aVal.getTime();
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortConfig.direction === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortConfig.direction === 'asc'
                ? (Number(aVal) || 0) - (Number(bVal) || 0)
                : (Number(bVal) || 0) - (Number(aVal) || 0);
        });

        // Grouping Logic
        const groups: Record<string, any[]> = {};
        filtered.forEach(item => {
            const pid = item.project_id || 'Unknown';
            if (!groups[pid]) groups[pid] = [];
            groups[pid].push(item);
        });

        // Convert to list of Master Rows (Latest version) with sub-items
        const grouped = Object.entries(groups).map(([pid, items]) => {
            // Sort items within group by date desc to ensure latest is first
            items.sort((a, b) => b.date.getTime() - a.date.getTime());
            return {
                ...items[0], // Latest version as Master
                versions: items.slice(0), // Keep all versions (including the latest one as the first)
                isGroup: items.length > 1
            };
        });

        // Final sort of groups based on sortConfig
        grouped.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal instanceof Date && bVal instanceof Date) {
                return sortConfig.direction === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
            }
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortConfig.direction === 'asc' ? (Number(aVal) || 0) - (Number(bVal) || 0) : (Number(bVal) || 0) - (Number(aVal) || 0);
        });

        return grouped;
    }, [cloudData, searchIndex, fileMetadata, source, tableFilters, searchTerm, sortConfig]);


    // --- STATISTICS CALCULATION ---
    const statistics = useMemo(() => {
        const allFiles = searchIndex.filter(i => i.kind === 'file') as unknown as { name: string, handle: FileSystemFileHandle, date: Date, size: number, path: string[] }[];

        const monthlyStats: Record<string, { offers: number, opened: number, closed: number }> = {};

        const projectGroups: Record<string, {
            latestFile: ProjectMetadata,
            versionCount: number,
            draftFile?: ProjectMetadata,
            openingFile?: ProjectMetadata,
            finalFile?: ProjectMetadata
        }> = {};

        // Filter Logic for Stats - Aligned with Table View
        const filesToAnalyze = allFiles.filter(f => {
            const meta = fileMetadata[f.name];
            if (!meta || meta.projectNumber === 'ERR' || meta.projectNumber === '-') return false;

            // Apply Global Search
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                const matchesSearch =
                    String(meta.projectNumber || '').toLowerCase().includes(lowerTerm) ||
                    String(meta.clientName || '').toLowerCase().includes(lowerTerm) ||
                    String(meta.salesPerson || '').toLowerCase().includes(lowerTerm) ||
                    String(meta.assistantPerson || '').toLowerCase().includes(lowerTerm);
                if (!matchesSearch) return false;
            }

            // Apply Column Filters (statsFilters)
            return Object.entries(statsFilters).every(([key, value]) => {
                if (!value) return true;

                if (key === 'stage') {
                    return meta.stage === value;
                }
                if (key === 'engineer') {
                    const selected = value as string[];
                    return selected.length === 0 || selected.includes(meta.salesPerson || '');
                }
                if (key === 'specialist') {
                    const selected = value as string[];
                    return selected.length === 0 || selected.includes(meta.assistantPerson || '');
                }
                if (key === 'price' || key === 'margin') {
                    const { min, max } = value as { min?: string, max?: string };
                    const itemVal = key === 'price' ? meta.valueEUR : (meta.valuePLN > 0 ? (1 - (meta.costPLN / meta.valuePLN)) * 100 : 0);
                    if (min && itemVal < Number(min)) return false;
                    if (max && itemVal > Number(max)) return false;
                    return true;
                }
                if (key === 'open_date' || key === 'close_date') {
                    const { from, to } = value as { from?: string, to?: string };
                    const dateStr = key === 'open_date' ? meta.orderDate : meta.protocolDate;
                    if (!dateStr) return !from && !to;
                    const itemTime = new Date(dateStr).getTime();
                    if (from && itemTime < new Date(from).setHours(0, 0, 0, 0)) return false;
                    if (to && itemTime > new Date(to).setHours(23, 59, 59, 999)) return false;
                    return true;
                }
                if (key === 'date') {
                    const { from, to } = value as { from?: string, to?: string };
                    const itemTime = new Date(meta.timestamp).getTime();
                    if (from && itemTime < new Date(from).setHours(0, 0, 0, 0)) return false;
                    if (to && itemTime > new Date(to).setHours(23, 59, 59, 999)) return false;
                    return true;
                }
                return true;
            });
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
            globalValue += isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR;

            const cName = latestFile.clientName || 'Inny';
            clientStats[cName] = (clientStats[cName] || 0) + (isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR);

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
                monthlyStats[m].offers += isNaN(offerSource.valueEUR) ? 0 : offerSource.valueEUR;
            }

            // 2. Opened (In Progress) - Bucket strictly by Order Date
            if (startDateStr) {
                const m = startDateStr.slice(0, 7);
                initMonth(m);
                // Use opening file value if possible, else latest
                const val = openingFile ? openingFile.valueEUR : latestFile.valueEUR;
                monthlyStats[m].opened += isNaN(val) ? 0 : val;
            }

            // 3. Closed (Finished) - Bucket strictly by Protocol Date
            if (endDateStr && finalFile) {
                const m = endDateStr.slice(0, 7);
                initMonth(m);
                monthlyStats[m].closed += isNaN(finalFile.valueEUR) ? 0 : finalFile.valueEUR;
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
    }, [searchIndex, fileMetadata, statsFilters, searchTerm]);

    // --- RENDER STATISTICS VIEW ---
    const renderStatistics = () => {
        const { totalProjects, globalValue, avgValue, chartData, topClients, stageDistribution, avgDuration, totalFiles } = statistics;
        const maxChartValue = Math.max(1, ...chartData.map(d => Math.max(d.offers, d.opened, d.closed)));
        const maxClientValue = topClients.length > 0 ? topClients[0][1] : 1;

        const updateFilter = (key: string, value: any) => {
            setStatsFilters(prev => ({ ...prev, [key]: value }));
        };

        const FilterButton = ({ colKey, label, icon: Icon }: { colKey: string, label: string, icon: any }) => (
            <div className="relative">
                <button
                    onClick={() => setActiveFilterPop(activeFilterPop === colKey ? null : colKey)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${statsFilters[colKey] ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'}`}
                >
                    <Icon size={14} className={statsFilters[colKey] ? 'text-amber-500' : 'text-zinc-400'} />
                    {label}
                    {statsFilters[colKey] && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>}
                </button>

                {activeFilterPop === colKey && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 p-3 animate-scaleIn">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-700">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Filtruj: {label}</span>
                            <button onClick={() => setActiveFilterPop(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors"><X size={12} /></button>
                        </div>

                        {colKey === 'stage' ? (
                            <select
                                className="w-full p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-400"
                                value={statsFilters[colKey] || ''}
                                onChange={(e) => updateFilter(colKey, e.target.value)}
                            >
                                <option value="">Wszystkie Etapy</option>
                                <option value="DRAFT">Szkic (DRAFT)</option>
                                <option value="OPENING">Realizacja (OPENING)</option>
                                <option value="FINAL">Zamknięte (FINAL)</option>
                            </select>
                        ) : (colKey === 'date' || colKey === 'open_date') ? (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="date"
                                    className="w-full p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-400"
                                    value={statsFilters[colKey]?.from || ''}
                                    onChange={(e) => updateFilter(colKey, { ...statsFilters[colKey], from: e.target.value })}
                                />
                                <input
                                    type="date"
                                    className="w-full p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-400"
                                    value={statsFilters[colKey]?.to || ''}
                                    onChange={(e) => updateFilter(colKey, { ...statsFilters[colKey], to: e.target.value })}
                                />
                            </div>
                        ) : (colKey === 'engineer' || colKey === 'specialist') ? (
                            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                                {(colKey === 'engineer' ? SALES_PEOPLE : SUPPORT_PEOPLE).map(p => (
                                    <label key={p} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                                            checked={(statsFilters[colKey] || []).includes(p)}
                                            onChange={(e) => {
                                                const current = statsFilters[colKey] || [];
                                                const next = e.target.checked ? [...current, p] : current.filter((x: string) => x !== p);
                                                updateFilter(colKey, next);
                                            }}
                                        />
                                        <span className="text-zinc-700 dark:text-zinc-300">{p}</span>
                                    </label>
                                ))}
                            </div>
                        ) : null}

                        {statsFilters[colKey] && (
                            <button
                                onClick={() => updateFilter(colKey, undefined)}
                                className="w-full mt-3 py-2 bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-500 hover:text-red-500 transition-all"
                            >
                                Wyczyść filtr
                            </button>
                        )}
                    </div>
                )}
            </div>
        );

        return (
            <div className="p-6 h-full overflow-auto custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col gap-8">
                {/* Stats Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative z-40">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mr-2 hidden lg:block">Filtruj Statystyki:</div>
                    <FilterButton colKey="date" label="Data Utworzenia" icon={Calendar} />
                    <FilterButton colKey="open_date" label="Data Otwarcia" icon={Clock} />
                    <FilterButton colKey="stage" label="Etap" icon={Layers} />
                    <FilterButton colKey="engineer" label="Inżynier" icon={Users} />
                    <FilterButton colKey="specialist" label="Specjalista" icon={User} />

                    {Object.keys(statsFilters).length > 0 && (
                        <button
                            onClick={() => setStatsFilters({})}
                            className="ml-auto text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase pr-2"
                        >
                            Resetuj Wszystkie
                        </button>
                    )}
                </div>

                <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                        <span className="font-bold">Analiza:</span> {totalFiles} plików (w podfolderach)
                    </div>
                    <button
                        onClick={() => currentDirHandle && startRecursiveScan(currentDirHandle)}
                        className={`px-3 py-1.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-xs font-bold flex items-center gap-2 transition-colors ${isScanning ? 'animate-pulse cursor-wait' : ''}`}
                    >
                        <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
                        {isScanning ? 'Skanowanie...' : 'Skanuj Pełną Strukturę'}
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><Target size={20} /></div>
                        </div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">{totalProjects}</div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Projektów</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600"><TrendingUp size={20} /></div>
                        </div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(globalValue, 0)}</div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Wartość Całk. (EUR)</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600"><BarChart3 size={20} /></div>
                        </div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(avgValue, 0)}</div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Średnia Wartość</div>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Clock size={20} /></div>
                        </div>
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgDuration.toFixed(1)} <span className="text-sm font-normal">dni</span></div>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Czas Trwania</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Clients */}
                    <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <Trophy size={16} className="text-yellow-500" /> Top Klienci (Wartość EUR)
                        </h3>
                        <div className="space-y-3">
                            {topClients.map(([name, val], idx) => (
                                <div key={name} className="relative">
                                    <div className="flex justify-between text-xs mb-1 relative z-10">
                                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{idx + 1}. {name}</span>
                                        <span className="font-mono">{formatNumber(val, 0)} EUR</span>
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
                            <PieChart size={16} className="text-blue-500" /> Etapy Projektów
                        </h3>
                        <div className="flex items-end justify-around h-32 gap-2">
                            <div className="flex flex-col items-center gap-2 w-1/3 group">
                                <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:scale-110 transition-transform">{stageDistribution.DRAFT}</div>
                                <div className="w-full bg-zinc-300 dark:bg-zinc-600 rounded-t-lg transition-all hover:bg-zinc-400" style={{ height: `${totalProjects ? (stageDistribution.DRAFT / totalProjects) * 100 : 0}%`, minHeight: '4px' }}></div>
                                <div className="text-[10px] font-bold text-zinc-400 uppercase">Szkic</div>
                            </div>
                            <div className="flex flex-col items-center gap-2 w-1/3 group">
                                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">{stageDistribution.OPENING}</div>
                                <div className="w-full bg-blue-400 rounded-t-lg transition-all hover:bg-blue-500" style={{ height: `${totalProjects ? (stageDistribution.OPENING / totalProjects) * 100 : 0}%`, minHeight: '4px' }}></div>
                                <div className="text-[10px] font-bold text-blue-500 uppercase">Otwarte</div>
                            </div>
                            <div className="flex flex-col items-center gap-2 w-1/3 group">
                                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">{stageDistribution.FINAL}</div>
                                <div className="w-full bg-purple-500 rounded-t-lg transition-all hover:bg-purple-600" style={{ height: `${totalProjects ? (stageDistribution.FINAL / totalProjects) * 100 : 0}%`, minHeight: '4px' }}></div>
                                <div className="text-[10px] font-bold text-purple-500 uppercase">Zamknięte</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monthly Trend Chart */}
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                        <Calendar size={16} className="text-zinc-500" /> Aktywność Miesięczna (Wartość EUR)
                    </h3>
                    <div className="h-40 flex items-end gap-2 relative">
                        {chartData.map((d) => (
                            <div key={d.month} className="flex-1 flex flex-col justify-end gap-0.5 group relative h-full">
                                {/* Bars */}
                                <div className="w-full bg-purple-500 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.closed / maxChartValue) * 80}%` }} title={`Zamknięte: ${formatNumber(d.closed, 0)}`}></div>
                                <div className="w-full bg-blue-400 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.opened / maxChartValue) * 80}%` }} title={`Otwarte: ${formatNumber(d.opened, 0)}`}></div>
                                <div className="w-full bg-zinc-300 dark:bg-zinc-600 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.offers / maxChartValue) * 80}%` }} title={`Oferty: ${formatNumber(d.offers, 0)}`}></div>

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

    const renderTableView = () => {
        const toggleSort = (key: string) => {
            setSortConfig(prev => ({
                key,
                direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
            }));
        };

        const updateFilter = (key: string, value: string) => {
            setTableFilters(prev => ({ ...prev, [key]: value }));
        };

        const SortIcon = ({ field }: { field: string }) => {
            if (sortConfig.key !== field) return <ArrowUpDown size={12} className="opacity-30" />;
            return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-amber-500" /> : <ChevronDown size={12} className="text-amber-500" />;
        };

        return (
            <div className="h-full flex flex-col animate-fadeIn">
                <div className="overflow-auto flex-1 custom-scrollbar relative">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-800 shadow-sm">
                            <tr>
                                {[
                                    { key: 'project_id', label: 'Nr Projektu', width: '12%' },
                                    { key: 'customer', label: 'Klient', width: '15%' },
                                    { key: 'stage', label: 'Etap', width: '8%' },
                                    { key: 'price', label: 'Cena (EUR)', width: '10%' },
                                    { key: 'margin', label: 'Marża', width: '8%' },
                                    { key: 'engineer', label: 'Inżynier', width: '11%' },
                                    { key: 'specialist', label: 'Specjalista', width: '11%' },
                                    { key: 'open_date', label: 'Otwarcia', width: '11%' },
                                    { key: 'close_date', label: 'Zamknięcia', width: '11%' },
                                    { key: 'date', label: 'Utworzenia', width: '8%' }
                                ].map(col => (
                                    <th key={col.key} className="p-2 border-b border-zinc-200 dark:border-zinc-700 align-top relative" style={{ width: col.width }}>
                                        <div
                                            className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-500 cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors mb-1 group/header"
                                            onClick={() => toggleSort(col.key)}
                                        >
                                            {col.label} <SortIcon field={col.key} />
                                            <button
                                                className={`p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 ml-auto opacity-0 group-hover/header:opacity-100 transition-opacity ${tableFilters[col.key] ? 'opacity-100 text-amber-500' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveFilterPop(activeFilterPop === col.key ? null : col.key);
                                                }}
                                            >
                                                <Filter size={10} />
                                            </button>
                                        </div>

                                        {/* Expandable Filter Popover */}
                                        {activeFilterPop === col.key && (
                                            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-xl z-50 p-2 animate-scaleIn" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-700">
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Filtruj: {col.label}</span>
                                                    <button onClick={() => setActiveFilterPop(null)} className="text-zinc-400 hover:text-zinc-600"><X size={10} /></button>
                                                </div>

                                                {col.key === 'stage' ? (
                                                    <select
                                                        className="w-full p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                        value={tableFilters[col.key] || ''}
                                                        onChange={(e) => updateFilter(col.key, e.target.value)}
                                                        autoFocus
                                                    >
                                                        <option value="">Wszystkie</option>
                                                        <option value="DRAFT">DRAFT</option>
                                                        <option value="OPENING">OPENING</option>
                                                        <option value="FINAL">FINAL</option>
                                                    </select>
                                                ) : (col.key === 'price' || col.key === 'margin') ? (
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="Min"
                                                            className="w-1/2 p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                            value={tableFilters[col.key]?.min || ''}
                                                            onChange={(e) => updateFilter(col.key, { ...tableFilters[col.key], min: e.target.value })}
                                                            autoFocus
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Max"
                                                            className="w-1/2 p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                            value={tableFilters[col.key]?.max || ''}
                                                            onChange={(e) => updateFilter(col.key, { ...tableFilters[col.key], max: e.target.value })}
                                                        />
                                                    </div>
                                                ) : (col.key === 'open_date' || col.key === 'close_date') ? (
                                                    <div className="flex flex-col gap-1">
                                                        <input
                                                            type="date"
                                                            className="w-full p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                            value={tableFilters[col.key]?.from || ''}
                                                            onChange={(e) => updateFilter(col.key, { ...tableFilters[col.key], from: e.target.value })}
                                                        />
                                                        <input
                                                            type="date"
                                                            className="w-full p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                            value={tableFilters[col.key]?.to || ''}
                                                            onChange={(e) => updateFilter(col.key, { ...tableFilters[col.key], to: e.target.value })}
                                                        />
                                                    </div>
                                                ) : (col.key === 'engineer' || col.key === 'specialist') ? (
                                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                        {(col.key === 'engineer' ? SALES_PEOPLE : SUPPORT_PEOPLE).map(p => (
                                                            <label key={p} className="flex items-center gap-2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-[10px]">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(tableFilters[col.key] || []).includes(p)}
                                                                    onChange={(e) => {
                                                                        const current = tableFilters[col.key] || [];
                                                                        const next = e.target.checked ? [...current, p] : current.filter((x: string) => x !== p);
                                                                        updateFilter(col.key, next);
                                                                    }}
                                                                />
                                                                {p}
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        placeholder="Filtruj..."
                                                        className="w-full p-1 text-[9px] border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-amber-400"
                                                        value={tableFilters[col.key] || ''}
                                                        onChange={(e) => updateFilter(col.key, e.target.value)}
                                                        autoFocus
                                                    />
                                                )}

                                                {tableFilters[col.key] && (
                                                    <button
                                                        onClick={() => updateFilter(col.key, undefined)}
                                                        className="w-full mt-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-[9px] font-bold text-zinc-500 transition-colors"
                                                    >
                                                        Wyczyść filtr
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tableData.map((project, idx) => {
                                const isExpanded = expandedGroups[project.project_id];

                                return (
                                    <React.Fragment key={project.project_id}>
                                        <tr
                                            className="hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors group"
                                            onClick={() => {
                                                if (project.isGroup) {
                                                    setExpandedGroups(prev => ({ ...prev, [project.project_id]: !prev[project.project_id] }));
                                                } else {
                                                    if (source === 'cloud') handleLoad({ cloudData: project.raw });
                                                    else handleLoad(project.handle);
                                                }
                                            }}
                                        >
                                            <td className="p-2 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                {project.isGroup && (
                                                    <div className="text-amber-500">
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </div>
                                                )}
                                                {project.project_id}
                                                {project.isGroup && !isExpanded && (
                                                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-zinc-400">
                                                        {project.versions.length}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">{project.customer}</td>
                                            <td className="p-2">
                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border ${project.stage === 'FINAL' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                    project.stage === 'OPENING' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                    }`}>
                                                    {project.stage}
                                                </span>
                                            </td>
                                            <td className="p-2 text-xs font-mono text-right font-bold text-zinc-800 dark:text-zinc-200 pr-4">{formatNumber(project.price, 0)}</td>
                                            <td className={`p-2 text-xs font-mono text-right font-bold pr-4 ${project.margin < 5 ? 'text-red-500' : 'text-green-600'}`}>{project.margin.toFixed(1)}%</td>
                                            <td className="p-2 text-xs text-zinc-500 dark:text-zinc-400">{project.engineer}</td>
                                            <td className="p-2 text-xs text-zinc-500 dark:text-zinc-400">{project.specialist}</td>
                                            <td className="p-2 text-[10px] text-zinc-500 font-mono">{project.open_date?.toLocaleDateString() || '-'}</td>
                                            <td className="p-2 text-[10px] text-zinc-500 font-mono">{project.close_date?.toLocaleDateString() || '-'}</td>
                                            <td className="p-2 text-[9px] text-zinc-400 font-mono relative">
                                                <span className="opacity-50">{project.date.toLocaleDateString()}</span>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {deleteConfirm?.id === project.id ? (
                                                        <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-red-200 rounded p-0.5 shadow-lg" onClick={e => e.stopPropagation()}>
                                                            <button onClick={handleDeleteConfirm} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Check size={10} /></button>
                                                            <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-100 text-zinc-400 rounded hover:bg-zinc-200"><X size={10} /></button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // If it's a group, we want to delete ALL versions
                                                                const deleteId = project.isGroup
                                                                    ? project.versions.map((v: any) => v.id)
                                                                    : project.id;
                                                                const deleteName = project.project_id;
                                                                const path = project.raw?.path || [];
                                                                setDeleteConfirm({ id: deleteId, name: deleteName, type: source, path });
                                                            }}
                                                            className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                                            title={project.isGroup ? "Usuń grupę" : "Usuń"}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && project.versions.map((version, vIdx) => (
                                            <tr
                                                key={`${project.project_id}-v-${vIdx}`}
                                                className="bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-amber-50/50 dark:hover:bg-amber-900/5 cursor-pointer transition-colors border-l-2 border-amber-400 group"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (source === 'cloud') handleLoad({ cloudData: version.raw });
                                                    else handleLoad(version.handle);
                                                }}
                                            >
                                                <td className="p-2 pl-10 text-[10px] font-mono text-zinc-500 italic">Wersja {project.versions.length - vIdx}</td>
                                                <td className="p-2 text-xs text-zinc-400 italic">{version.customer}</td>
                                                <td className="p-2">
                                                    <span className={`px-1 py-0.5 rounded text-[9px] opacity-70 border ${version.stage === 'FINAL' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                        version.stage === 'OPENING' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-zinc-50 text-zinc-400 border-zinc-100'
                                                        }`}>
                                                        {version.stage}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-[11px] font-mono text-right text-zinc-500 pr-4">{formatNumber(version.price, 0)}</td>
                                                <td className="p-2 text-[11px] font-mono text-right text-zinc-500 pr-4">{version.margin.toFixed(1)}%</td>
                                                <td className="p-2 text-[11px] text-zinc-400">{version.engineer}</td>
                                                <td className="p-2 text-[11px] text-zinc-400">{version.specialist}</td>
                                                <td className="p-2 text-[9px] text-zinc-400 font-mono">{version.open_date?.toLocaleDateString() || '-'}</td>
                                                <td className="p-2 text-[9px] text-zinc-400 font-mono">{version.close_date?.toLocaleDateString() || '-'}</td>
                                                <td className="p-2 text-[9px] text-zinc-400 font-mono italic relative">
                                                    <span className="opacity-40">{version.date.toLocaleDateString()}</span>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {deleteConfirm?.id === version.id ? (
                                                            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-red-200 rounded p-0.5 shadow-lg" onClick={e => e.stopPropagation()}>
                                                                <button onClick={handleDeleteConfirm} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Check size={10} /></button>
                                                                <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-100 text-zinc-400 rounded hover:bg-zinc-200"><X size={10} /></button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const filename = version.id; // version.id is already the filename/id
                                                                    const path = version.raw?.path || [];
                                                                    setDeleteConfirm({ id: version.id, name: filename, type: source, path });
                                                                }}
                                                                className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                                                title="Usuń wersję"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {tableData.length === 0 && (
                        <div className="p-12 text-center text-zinc-400 italic">Brak wyników spełniających kryteria.</div>
                    )}
                </div>
            </div>
        );
    };

    const handleGlobalJumpToFolder = (item: DirectoryItem) => {
        if (item.kind === 'directory' && currentDirHandle) {
            const handle = item.handle as FileSystemDirectoryHandle;
            setPathStack([{ name: 'Katalog Główny', handle: currentDirHandle }, { name: item.name, handle }]);
            loadDirectoryContents(handle);
            setSearchTerm('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div
                className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-scaleIn border border-zinc-200 dark:border-zinc-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 rounded-lg">
                            <HardDrive size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                Menedżer Projektów
                                {activeTab === 'stats' && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Statystyki</span>}
                            </h2>

                            {/* Breadcrumbs */}
                            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1 overflow-hidden">
                                <button onClick={() => navigateToCrumb(0)} className="hover:text-amber-500 transition-colors flex items-center gap-1"><Home size={10} /> Root</button>
                                {pathStack.slice(1).map((crumb, idx) => (
                                    <React.Fragment key={idx}>
                                        <ChevronRight size={10} />
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
                                <FolderOpen size={14} /> Pliki
                            </button>
                            <button
                                onClick={() => setActiveTab('stats')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                            >
                                <BarChart3 size={14} /> Statystyki
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* ERROR BANNER */}
                {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 justify-center">
                        <AlertTriangle size={14} /> {errorMsg}
                    </div>
                )}

                {/* SCAN PROGRESS */}
                {isScanning && (
                    <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-300 animate-pulse" style={{ width: `${scanProgress}%` }}></div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex flex-1 flex-col overflow-hidden">

                    {/* Universal Toolbar */}
                    <div className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-2 flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <button onClick={navigateUp} disabled={pathStack.length <= 1} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 disabled:opacity-30">
                                <ArrowUpLeft size={16} />
                            </button>
                            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                            <div className="flex bg-zinc-200 dark:bg-zinc-700 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewType('folders')}
                                    className={`p-1 rounded transition-colors ${viewType === 'folders' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    title="Widok Folderów"
                                >
                                    <LayoutGrid size={14} />
                                </button>
                                <button
                                    onClick={() => setViewType('table')}
                                    className={`p-1 rounded transition-colors ${viewType === 'table' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    title="Widok Tabeli"
                                >
                                    <TableIcon size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Search & Source Switcher in Toolbar */}
                        <div className="flex items-center gap-2 flex-1 max-w-xl">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-2.5 top-2.5 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder={searchScope === 'global' ? "Szukaj w całej bazie..." : "Szukaj tutaj..."}
                                    className="w-full pl-8 py-2 pr-16 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <div className="absolute right-1 top-1 flex gap-0.5">
                                    <button
                                        onClick={() => setSearchScope('global')}
                                        className={`px-1.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${searchScope === 'global' ? 'bg-zinc-900 text-white dark:bg-zinc-300 dark:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                                    >
                                        Global
                                    </button>
                                    <button
                                        onClick={() => setSearchScope('local')}
                                        className={`px-1.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${searchScope === 'local' ? 'bg-zinc-900 text-white dark:bg-zinc-300 dark:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                                    >
                                        Folder
                                    </button>
                                </div>
                            </div>

                            <div className="flex bg-zinc-200 dark:bg-zinc-700 p-0.5 rounded-lg shrink-0">
                                <button
                                    onClick={() => setSource('cloud')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors flex items-center gap-1.5 ${source === 'cloud' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                >
                                    <Cloud size={12} /> Chmura
                                </button>
                                <button
                                    onClick={() => setSource('local')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors flex items-center gap-1.5 ${source === 'local' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                                >
                                    <HardDrive size={12} /> Dysk
                                </button>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-3 shrink-0">
                            {viewType === 'table' && (
                                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest hidden lg:block bg-zinc-100 dark:bg-zinc-700/50 px-2 py-1 rounded">
                                    Grupowanie aktywne
                                </div>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={(!currentDirHandle && source === 'local')}
                                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95"
                            >
                                <Save size={16} /> {source === 'cloud' ? 'Zapisz w Chmurze' : 'Zapisz na Dysku'}
                            </button>
                        </div>
                    </div>


                    {activeTab === 'stats' ? renderStatistics() : (viewType === 'table' ? renderTableView() : (
                        <>
                            {/* REMOVED: Toolbar in File View was here, now moved above switch */}

                            {/* FILE LIST */}
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {source === 'local' && !currentDirHandle && (
                                    <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                                        <FolderOpen size={48} className="mb-4 opacity-20" />
                                        <p>Nie wybrano folderu roboczego.</p>
                                        <button onClick={connectToFolder} className="mt-4 text-blue-500 font-bold hover:underline">Wybierz Folder</button>
                                    </div>
                                )}

                                {((source === 'local' && currentDirHandle) || source === 'cloud') && displayItems.length === 0 && !isLoading && (
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
                                            className="group flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer animate-fadeIn"
                                            style={{ animationDelay: `${idx * 30}ms` }}
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
                                                    {isDirectory ? <Folder size={20} fill="currentColor" fillOpacity={0.2} /> : <FileJson size={20} />}
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
                                                            <span className="flex items-center gap-1"><Calendar size={10} /> {item.date?.toLocaleDateString()}</span>
                                                            {meta?.scanned && (
                                                                <>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className="flex items-center gap-1 font-bold text-zinc-600 dark:text-zinc-400">{meta.clientName}</span>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className="flex items-center gap-1 font-mono">{meta.projectNumber}</span>
                                                                    <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></span>
                                                                    <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] border ${meta.stage === 'FINAL' ? 'bg-purple-100 text-purple-700 border-purple-200' :
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

                                                {deleteConfirm?.id === (source === 'cloud' ? (item.handle as any).cloudData?.id : item.name) ? (
                                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 p-1 rounded" onClick={(e) => e.stopPropagation()}>
                                                        <span className="text-[10px] text-red-600 font-bold">Usunąć?</span>
                                                        <button onClick={handleDeleteConfirm} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 size={12} /></button>
                                                        <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300"><X size={12} /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (source === 'cloud') {
                                                                const cloudItem = (item.handle as any).cloudData;
                                                                setDeleteConfirm({ id: cloudItem.id, name: item.name, type: 'cloud' });
                                                            } else {
                                                                setDeleteConfirm({ id: item.name, name: item.name, type: 'local', path: item.path });
                                                            }
                                                        }}
                                                        className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Usuń plik"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ))}
                </div>
                {/* Load Confirmation Modal */}
                {loadConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fadeIn p-4">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-zinc-200 dark:border-zinc-700 animate-scaleIn">
                            <div className="flex items-center gap-3 text-amber-500 mb-4">
                                <AlertTriangle size={24} />
                                <h3 className="text-lg font-bold">Wczytać projekt?</h3>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                Obecna kalkulacja zostanie zastąpiona danymi z pliku:
                                <span className="block mt-2 font-mono text-zinc-900 dark:text-zinc-100 font-bold break-all">
                                    {loadConfirm.name}
                                </span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleLoad(loadConfirm.handle)}
                                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    Tak, wczytaj
                                </button>
                                <button
                                    onClick={() => setLoadConfirm(null)}
                                    className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold transition-colors"
                                >
                                    Anuluj
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};