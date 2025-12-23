
import { useState, useRef, useEffect } from 'react';
import { Currency, CalculationMode } from '../types';
import { calculateProjectCosts, convert } from '../services/calculationService';

// Interfaces for File System Access API
export interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile: () => Promise<File>;
    createWritable: () => Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    values: () => AsyncIterableIterator<FileSystemHandle>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
    removeEntry: (name: string) => Promise<void>;
}

export interface FileSystemWritableFileStream extends WritableStream {
    write: (data: any) => Promise<void>;
    close: () => Promise<void>;
}

export interface ProjectMetadata {
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
    isLocked?: boolean;
    valueOriginal: number;
    currencyOriginal: Currency;
    valuePLN: number;
    valueEUR: number;
    costPLN: number;
    timestamp: number;
}

export interface DirectoryItem {
    kind: 'file' | 'directory';
    name: string;
    handle: FileSystemHandle;
    date?: Date;
    size?: number;
    path?: string[];
}

export const useFileSystem = (initialDirHandle: FileSystemDirectoryHandle | null, onSetDirHandle: (handle: any) => void, showSnackbar: (msg: string) => void) => {
    const [pathStack, setPathStack] = useState<{ name: string, handle: FileSystemDirectoryHandle | string }[]>([]);
    const [currentViewItems, setCurrentViewItems] = useState<DirectoryItem[]>([]);
    const [searchIndex, setSearchIndex] = useState<DirectoryItem[]>([]);
    const [fileMetadata, setFileMetadata] = useState<Record<string, ProjectMetadata>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    const connectToFolder = async () => {
        try {
            // @ts-ignore
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'desktop'
            });
            onSetDirHandle(handle);
            setPathStack([{ name: 'Katalog Główny', handle }]);
            loadDirectoryContents(handle);
            setSearchIndex([]);
            setFileMetadata({});
            showSnackbar("Połączono z folderem");
        } catch (err: any) {
            console.error("Access denied or cancelled", err);
            if (err.name === 'SecurityError' && err.message.includes('Cross origin sub frames')) {
                throw new Error("Przeglądarka zablokowała dostęp do plików w tym oknie. Otwórz aplikację w pełnej karcie.");
            }
        }
    };

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

            items.sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
                if (a.kind === 'directory') return a.name.localeCompare(b.name);
                return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
            });

            setCurrentViewItems(items);
            const filesToParse = items.filter(i => i.kind === 'file') as unknown as { name: string, handle: FileSystemFileHandle }[];
            if (filesToParse.length > 0) {
                scanFilesContent(filesToParse, false);
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
    };

    const navigateUp = () => {
        if (pathStack.length <= 1) return;
        const newStack = pathStack.slice(0, -1);
        setPathStack(newStack);
        const lastHandle = newStack[newStack.length - 1].handle;
        if (typeof lastHandle !== 'string') {
            loadDirectoryContents(lastHandle);
        }
    };

    const navigateToCrumb = (index: number) => {
        if (index === pathStack.length - 1) return;
        const newStack = pathStack.slice(0, index + 1);
        setPathStack(newStack);
        const lastHandle = newStack[newStack.length - 1].handle;
        if (typeof lastHandle !== 'string') {
            loadDirectoryContents(lastHandle);
        }
    };

    const startRecursiveScan = async (rootHandle: FileSystemDirectoryHandle) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();

        setIsLoading(true);
        setIsScanning(true);
        setScanProgress(0);
        setSearchIndex([]);

        const allEntries: DirectoryItem[] = [];
        const jsonFilesToParse: { name: string, handle: FileSystemFileHandle }[] = [];

        try {
            const scanDir = async (dir: FileSystemDirectoryHandle, currentPath: string[]) => {
                // @ts-ignore
                for await (const entry of dir.values()) {
                    if (entry.kind === 'directory') {
                        allEntries.push({ kind: 'directory', name: entry.name, handle: entry, path: currentPath });
                        await scanDir(entry as FileSystemDirectoryHandle, [...currentPath, entry.name]);
                    } else if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = entry as FileSystemFileHandle;
                        const file = await fileHandle.getFile();
                        allEntries.push({ kind: 'file', name: entry.name, handle: fileHandle, date: new Date(file.lastModified), size: file.size, path: currentPath });
                        jsonFilesToParse.push({ name: entry.name, handle: fileHandle });
                    }
                }
            };

            await scanDir(rootHandle, []);
            setSearchIndex(allEntries);
            scanFilesContent(jsonFilesToParse, true);

        } catch (e) {
            console.error("Error deep scanning", e);
            showSnackbar("Błąd skanowania struktury");
            setIsScanning(false);
        } finally {
            setIsLoading(false);
        }
    };

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

                        const costs = calculateProjectCosts(activeData as any, rate, currency, mode, ormFee, margin, manualPrice);

                        if (manualPrice || finalManualPrice) {
                            valueOriginal = finalManualPrice || manualPrice;
                        } else {
                            const marginDecimal = (margin || 20) / 100;
                            const totalCost = costs.total;
                            valueOriginal = marginDecimal >= 1 ? 0 : totalCost / (1 - marginDecimal);
                        }

                        valuePLN = convert(valueOriginal, currency, Currency.PLN, rate);
                        valueEUR = convert(valueOriginal, currency, Currency.EUR, rate);
                        const costPLN = convert(costs.total, currency, Currency.PLN, rate);

                        setFileMetadata(prev => ({
                            ...prev,
                            [fileEntry.name]: {
                                clientName, projectNumber, stage, scanned: true, salesPerson, assistantPerson,
                                valueOriginal, currencyOriginal: currency, valuePLN, valueEUR, costPLN,
                                timestamp: file.lastModified, orderDate, protocolDate, isLocked: json.appState?.isLocked
                            }
                        }));
                    } catch (e) {
                        setFileMetadata(prev => ({
                            ...prev,
                            [fileEntry.name]: {
                                clientName, projectNumber, stage, scanned: true, salesPerson, assistantPerson,
                                valueOriginal: 0, currencyOriginal: currency, valuePLN: 0, valueEUR: 0, costPLN: 0,
                                timestamp: file.lastModified, orderDate, protocolDate, isLocked: json.appState?.isLocked
                            }
                        }));
                    }
                } catch (err) {
                    setFileMetadata(prev => ({
                        ...prev, [fileEntry.name]: { scanned: true, clientName: 'Błąd pliku', projectNumber: 'ERR', valueOriginal: 0, currencyOriginal: Currency.PLN, valuePLN: 0, timestamp: 0 } as any
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

    return {
        pathStack, setPathStack,
        currentViewItems, setCurrentViewItems,
        searchIndex, setSearchIndex,
        fileMetadata, setFileMetadata,
        isLoading, setIsLoading,
        isScanning, setIsScanning,
        scanProgress, setScanProgress,
        connectToFolder,
        loadDirectoryContents,
        navigateDown,
        navigateUp,
        navigateToCrumb,
        startRecursiveScan,
        scanFilesContent
    };
};
