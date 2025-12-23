
import React from 'react';
import { Folder, FileJson, Calendar, Trash2, X } from 'lucide-react';
import { formatNumber } from '../services/calculationService';
import { DirectoryItem, ProjectMetadata } from '../hooks/useFileSystem';

interface ProjectFolderViewProps {
    displayItems: DirectoryItem[];
    fileMetadata: Record<string, ProjectMetadata>;
    onNavigate: (item: DirectoryItem) => void;
    onLoad: (item: DirectoryItem) => void;
    onDelete: (item: DirectoryItem) => void;
    deleteConfirm: any;
    setDeleteConfirm: (val: any) => void;
    isLoading: boolean;
    source: 'local' | 'cloud';
    currentDirHandle: any;
    connectToFolder: () => void;
    searchScope: 'global' | 'local';
    searchIndex: any[];
}

export const ProjectFolderView: React.FC<ProjectFolderViewProps> = ({
    displayItems,
    fileMetadata,
    onNavigate,
    onLoad,
    onDelete,
    deleteConfirm,
    setDeleteConfirm,
    isLoading,
    source,
    currentDirHandle,
    connectToFolder,
    searchScope,
    searchIndex
}) => {
    return (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {source === 'local' && !currentDirHandle && (
                <div className="p-12 text-center text-zinc-400 flex flex-col items-center">
                    <Folder size={48} className="mb-4 opacity-20" />
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
                        onClick={() => isDirectory ? onNavigate(item) : onLoad(item)}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${isDirectory ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                {isDirectory ? <Folder size={20} fill="currentColor" fillOpacity={0.2} /> : <FileJson size={20} />}
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate pr-4">
                                    {item.name}
                                </div>
                                {item.path && item.path.length > 0 && (
                                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <Folder size={8} /> {item.path.join(' / ')}
                                    </div>
                                )}

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
                                    <button onClick={() => onDelete(item)} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Trash2 size={12} /></button>
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
    );
};
