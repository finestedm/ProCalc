
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, RefreshCw, HardDrive, Search, User, BarChart3, Home, ArrowUpLeft, LayoutGrid, Table as TableIcon, Cloud, Unlock } from 'lucide-react';
import { AppState, ProjectFile, Currency, CalculationMode } from '../types';
import { calculateProjectCosts } from '../services/calculationService';
import { storageService } from '../services/storage';
import { UnlockRequestModal } from './UnlockRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { useFileSystem } from '../hooks/useFileSystem';
import { useCloudStorage } from '../hooks/useCloudStorage';
import { useProjectData } from '../hooks/useProjectData';
import { ProjectTableView } from './ProjectTableView';
import { ProjectFolderView } from './ProjectFolderView';

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

export const ProjectManagerModal: React.FC<Props> = ({
    isOpen,
    onClose,
    appState,
    onLoadProject,
    showSnackbar,
    currentDirHandle,
    onSetDirHandle
}) => {
    const { profile } = useAuth();

    // --- MODAL STATE ---
    const [source, setSource] = useState<'local' | 'cloud'>('cloud');
    const [viewType, setViewType] = useState<'folders' | 'table'>('table');
    const [activeFilterPop, setActiveFilterPop] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
    const [loadConfirm, setLoadConfirm] = useState<any>(null);
    const [showUnlockModal, setShowUnlockModal] = useState(false);

    // --- CUSTOM HOOKS ---
    const fs = useFileSystem(currentDirHandle, onSetDirHandle, showSnackbar);
    const cloud = useCloudStorage(showSnackbar);
    const data = useProjectData(fs.currentViewItems, fs.searchIndex, fs.fileMetadata, cloud.cloudData, source);

    useEffect(() => {
        if (isOpen) {
            if (source === 'local' && currentDirHandle) {
                if (fs.pathStack.length === 0) {
                    fs.setPathStack([{ name: 'Katalog Główny', handle: currentDirHandle }]);
                    fs.loadDirectoryContents(currentDirHandle);
                }
            } else if (source === 'cloud') {
                cloud.loadCloudData(fs.setPathStack, fs.setCurrentViewItems, fs.setSearchIndex, fs.setFileMetadata);
            }
        }
    }, [isOpen, source, currentDirHandle]);

    const handleSave = async (reasonArg?: string | any) => {
        const projectNum = appState.initial.meta.projectNumber || 'BezNumeru';
        const reason = typeof reasonArg === 'string' ? reasonArg : undefined;

        let isRemoteLocked = false;
        try {
            if (!appState.isLocked && projectNum !== 'BezNumeru') {
                isRemoteLocked = await storageService.isProjectLocked(projectNum);
            }
        } catch (e) {
            console.warn("[ProjectManagerModal] Failed to check remote lock", e);
        }

        const effectiveLocked = appState.isLocked || isRemoteLocked;
        if (!reason && effectiveLocked) {
            setShowUnlockModal(true);
            return;
        }

        performSave(reason);
    };

    const performSave = async (reason?: string) => {
        const mode = appState.mode;
        const activeData = mode === CalculationMode.FINAL ? appState.final : appState.initial;
        const clientName = activeData?.orderingParty?.name || appState.initial.orderingParty.name || 'Nieznany Klient';
        const projectNum = activeData?.meta?.projectNumber || appState.initial.meta.projectNumber || 'BezNumeru';

        const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9 \-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').trim() || 'Nieznany';
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];

        const fileData: ProjectFile = {
            version: '1.0',
            timestamp: Date.now(),
            stage: appState.stage || 'DRAFT',
            appState,
            historyLog: [],
            past: [],
            future: []
        };

        if (reason) {
            const noteEntry = `[${new Date().toLocaleString()}] Aktualizacja ZABLOKOWANEJ kalkulacji przez ${profile?.full_name || 'Użytkownika'}: ${reason}\n`;
            if (appState.mode === CalculationMode.INITIAL) {
                fileData.appState.initial.projectNotes = (fileData.appState.initial.projectNotes || '') + noteEntry;
            }
        }

        fs.setIsLoading(true);
        try {
            if (source === 'cloud') {
                const costs = calculateProjectCosts(activeData as any, appState.exchangeRate || 4.3, appState.offerCurrency || Currency.EUR, mode, appState.globalSettings.ormFeePercent || 1.6, appState.targetMargin, appState.manualPrice);
                const activeManualPrice = mode === CalculationMode.FINAL ? appState.finalManualPrice : appState.manualPrice;
                const finalPrice = activeManualPrice !== null ? activeManualPrice : (costs.total / (1 - (appState.targetMargin / 100)));

                await storageService.saveCalculation(fileData as any, { totalCost: costs.total, totalPrice: finalPrice });
                showSnackbar(`Zapisano w chmurze: ${projectNum}`);
                cloud.loadCloudData(fs.setPathStack, fs.setCurrentViewItems, fs.setSearchIndex, fs.setFileMetadata);
            } else {
                const root = fs.pathStack[0].handle as any;
                const clientDir = await root.getDirectoryHandle(sanitize(clientName), { create: true });
                const projectDir = await clientDir.getDirectoryHandle(sanitize(projectNum), { create: true });
                const filename = `PROCALC_${sanitize(projectNum)}_${timestamp}.json`;
                const fileHandle = await projectDir.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(fileData, null, 2));
                await writable.close();
                showSnackbar(`Zapisano lokalnie: ${filename}`);
                const current = fs.pathStack[fs.pathStack.length - 1].handle;
                if (typeof current !== 'string') fs.loadDirectoryContents(current);
            }
        } catch (e) {
            console.error(e);
            showSnackbar("Błąd zapisu projektu");
        } finally {
            fs.setIsLoading(false);
        }
    };

    const handleLoad = async (item: any) => {
        const handle = item.handle || item;
        // Improved detection: source modal state OR specific fields in item
        const isCloud = source === 'cloud' || !!item.cloudData || (typeof handle === 'string' && handle.startsWith('cloud-id:'));

        if (!loadConfirm && ((appState.initial.meta.projectNumber && appState.initial.meta.projectNumber !== '-') || (appState.initial.orderingParty.name && appState.initial.orderingParty.name !== '-'))) {
            setLoadConfirm(item);
            return;
        }

        fs.setIsLoading(true);
        try {
            if (isCloud) {
                // If it's a cloud item from tableData, the ID is in item.id
                // If it's a handle-based cloud item, it's handle.split(':')[1]
                const id = item.cloudData?.id || item.id || (typeof handle === 'string' ? handle.split(':')[1] : null);
                if (!id) throw new Error("Cloud ID not found");

                const fullProject = await storageService.getCalculationById(id);
                if (fullProject) {
                    const fullFile = fullProject.calc || (fullProject as any).details?.calc;
                    const wrapped = (fullFile as any).appState ? { ...fullFile, id: fullProject.id } : { version: '1.0', timestamp: Date.now(), appState: { initial: fullFile, mode: CalculationMode.INITIAL, isLocked: fullProject.is_locked || false } };
                    if (wrapped.appState) wrapped.appState.isLocked = fullProject.is_locked || false;
                    onLoadProject(wrapped);
                }
            } else {
                if (typeof handle.getFile !== 'function') {
                    throw new Error("Invalid file handle");
                }
                const file = await handle.getFile();
                onLoadProject(JSON.parse(await file.text()));
            }
            onClose();
            setLoadConfirm(null);
        } catch (err) {
            console.error(err);
            showSnackbar("Błąd odczytu projektu");
        } finally {
            fs.setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            if (deleteConfirm.type === 'cloud') {
                const ids = Array.isArray(deleteConfirm.id) ? deleteConfirm.id : [deleteConfirm.id];
                await Promise.all(ids.map(id => storageService.deleteCalculation(id)));
                cloud.loadCloudData(fs.setPathStack, fs.setCurrentViewItems, fs.setSearchIndex, fs.setFileMetadata);
            } else {
                const ids = Array.isArray(deleteConfirm.id) ? deleteConfirm.id : [deleteConfirm.id];
                let dir = fs.pathStack[0].handle as any;
                if (deleteConfirm.path) for (const p of deleteConfirm.path) dir = await dir.getDirectoryHandle(p);
                await Promise.all(ids.map(id => dir.removeEntry(id)));
                const current = fs.pathStack[fs.pathStack.length - 1].handle;
                if (typeof current !== 'string') fs.loadDirectoryContents(current);
            }
            showSnackbar("Usunięto pomyślnie");
        } catch (err) {
            console.error(err);
            showSnackbar("Błąd usuwania elementu");
        } finally {
            setDeleteConfirm(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-500/20">
                            <LayoutGrid size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                Zarządzanie Projektami
                                {fs.isLoading && <RefreshCw size={16} className="animate-spin text-amber-500" />}
                            </h2>
                            <p className="text-xs text-zinc-500 font-medium tracking-wide">PRZEGLĄDAJ ARCHIWUM PROJEKTÓW</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={24} />
                    </button>
                </div>

                {/* Sub-header Controls */}
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button onClick={() => setSource('local')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${source === 'local' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                            <HardDrive size={18} /> Lokalny Dysk
                        </button>
                        <button onClick={() => setSource('cloud')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${source === 'cloud' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                            <Cloud size={18} /> Chmura Cloud
                        </button>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white dark:bg-zinc-700 text-amber-600 shadow-sm`}>
                            <Search size={18} /> Przeglądarka Projektów
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 bg-zinc-50/30 dark:bg-zinc-900/10">
                        {/* Toolbar */}
                        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <button onClick={() => fs.navigateToCrumb(0)} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:text-amber-500 transition-colors shadow-sm">
                                    <Home size={18} />
                                </button>
                                <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 shadow-sm overflow-hidden max-w-md">
                                    {fs.pathStack.map((crumb, idx) => (
                                        <React.Fragment key={idx}>
                                            {idx > 0 && <span className="text-zinc-300">/</span>}
                                            <button onClick={() => fs.navigateToCrumb(idx)} className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-amber-600 transition-colors truncate px-1">
                                                {crumb.name}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>
                                {fs.pathStack.length > 1 && (
                                    <button onClick={fs.navigateUp} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 hover:bg-zinc-200 transition-colors">
                                        <ArrowUpLeft size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 flex-1 max-w-xl">
                                <div className="relative flex-1 group">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Szukaj projektu, klienta, inżyniera..."
                                        className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                                        value={data.searchTerm}
                                        onChange={(e) => data.setSearchTerm(e.target.value)}
                                    />
                                    {data.searchTerm && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                            <button onClick={() => data.setSearchScope(data.searchScope === 'global' ? 'local' : 'global')} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors ${data.searchScope === 'global' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                {data.searchScope === 'global' ? 'Globalnie' : 'Aktualny'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                    <button onClick={() => setViewType('folders')} className={`p-1.5 rounded-lg transition-all ${viewType === 'folders' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}><LayoutGrid size={18} /></button>
                                    <button onClick={() => setViewType('table')} className={`p-1.5 rounded-lg transition-all ${viewType === 'table' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}><TableIcon size={18} /></button>
                                </div>
                            </div>
                        </div>

                        {/* View Content */}
                        <div className="flex-1 overflow-auto p-6 scroll-smooth custom-scrollbar">
                            {viewType === 'table' ? (
                                <ProjectTableView
                                    tableData={data.tableData}
                                    sortConfig={data.sortConfig}
                                    setSortConfig={data.setSortConfig}
                                    tableFilters={data.tableFilters}
                                    setTableFilters={data.setTableFilters}
                                    expandedGroups={data.expandedGroups}
                                    setExpandedGroups={data.setExpandedGroups}
                                    activeFilterPop={activeFilterPop}
                                    setActiveFilterPop={setActiveFilterPop}
                                    onLoad={handleLoad}
                                    onDelete={(item) => setDeleteConfirm(item)}
                                    deleteConfirm={deleteConfirm}
                                    setDeleteConfirm={setDeleteConfirm}
                                    source={source}
                                />
                            ) : (
                                <ProjectFolderView
                                    displayItems={data.displayItems}
                                    fileMetadata={fs.fileMetadata}
                                    onNavigate={fs.navigateDown}
                                    onLoad={handleLoad}
                                    onDelete={(item) => setDeleteConfirm({ id: item.name, name: item.name, type: source, path: item.path })}
                                    deleteConfirm={deleteConfirm}
                                    setDeleteConfirm={setDeleteConfirm}
                                    isLoading={fs.isLoading}
                                    source={source}
                                    currentDirHandle={currentDirHandle}
                                    connectToFolder={fs.connectToFolder}
                                    searchScope={data.searchScope}
                                    searchIndex={fs.searchIndex}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => handleSave()} disabled={fs.isLoading} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                            <Save size={18} /> ZAPISZ AKTUALNY PROJEKT
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                        <div className="flex items-center gap-2">
                            <button onClick={() => fs.navigateToCrumb(0)} className="hover:text-amber-500 transition-colors">Katalog Główny</button>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${source === 'cloud' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}></div>
                        <span className={source === 'cloud' ? 'text-green-600' : 'text-blue-600'}>{source === 'cloud' ? 'Cloud Sync Online' : 'Local Disk Mode'}</span>
                    </div>
                </div>
            </div>

            {/* Overlays */}
            {loadConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-scaleIn border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><RefreshCw className="text-amber-500" size={20} /> Załadować projekt?</h3>
                        <p className="text-zinc-500 text-sm mb-6">Niezapisane zmiany w obecnie otwartym projekcie zostaną utracone. Czy kontynuować ładowanie <span className="font-bold text-zinc-800 dark:text-zinc-200">{(loadConfirm.name || loadConfirm.cloudData?.project_id)}</span>?</p>
                        <div className="flex gap-3">
                            <button onClick={() => { handleLoad(loadConfirm); setLoadConfirm(null); }} className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/10">Tak, ładuj</button>
                            <button onClick={() => setLoadConfirm(null)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 transition-colors">Anuluj</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirm && typeof deleteConfirm.id === 'string' && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-scaleIn border border-red-100 dark:border-red-900/10">
                        <h3 className="text-lg font-bold mb-2 text-red-600 flex items-center gap-2"><X size={20} /> Potwierdź usunięcie</h3>
                        <p className="text-zinc-500 text-sm mb-6">Czy na pewno chcesz trwale usunąć <span className="font-bold text-zinc-800 dark:text-zinc-200">{deleteConfirm.name}</span>? Tej operacji nie można cofnąć.</p>
                        <div className="flex gap-3">
                            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/10">Usuń trwale</button>
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 transition-colors">Anuluj</button>
                        </div>
                    </div>
                </div>
            )}

            {showUnlockModal && (
                <UnlockRequestModal
                    isOpen={showUnlockModal}
                    onClose={() => setShowUnlockModal(false)}
                    onConfirm={(reason) => { setShowUnlockModal(false); performSave(reason); }}
                    projectNumber={(appState.mode === CalculationMode.FINAL ? appState.final?.meta?.projectNumber : appState.initial?.meta?.projectNumber) || 'Unknown'}
                />
            )}
        </div>
    );
};

export default ProjectManagerModal;