
import React from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, Filter, X, Lock, ChevronRight, Trash2, Check, Archive } from 'lucide-react';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';
import { formatNumber } from '../services/calculationService';

interface ProjectTableViewProps {
    tableData: any[];
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    setSortConfig: (val: any) => void;
    tableFilters: Record<string, any>;
    setTableFilters: (val: any) => void;
    expandedGroups: any;
    setExpandedGroups: (val: any) => void;
    activeFilterPop: string | null;
    setActiveFilterPop: (val: string | null) => void;
    onLoad: (item: any) => void;
    onDelete: (item: any) => void;
    onArchive?: (item: any) => void; // [NEW]
    deleteConfirm: any;
    setDeleteConfirm: (val: any) => void;
    source: 'local' | 'cloud';
}

export const ProjectTableView: React.FC<ProjectTableViewProps> = ({
    tableData,
    sortConfig,
    setSortConfig,
    tableFilters,
    setTableFilters,
    expandedGroups,
    setExpandedGroups,
    activeFilterPop,
    setActiveFilterPop,
    onLoad,
    onDelete,
    onArchive, // [NEW]
    deleteConfirm,
    setDeleteConfirm,
    source
}) => {
    const toggleSort = (key: string) => {
        setSortConfig((prev: any) => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const updateFilter = (key: string, value: any) => {
        setTableFilters((prev: any) => ({ ...prev, [key]: value }));
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
                        {tableData.map((project) => {
                            const isExpanded = expandedGroups[project.project_id];
                            return (
                                <React.Fragment key={project.project_id}>
                                    <tr
                                        className="hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors group"
                                        onClick={() => {
                                            if (project.isGroup) {
                                                setExpandedGroups((prev: any) => ({ ...prev, [project.project_id]: !prev[project.project_id] }));
                                            } else {
                                                onLoad(project);
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
                                            {project.isLocked && <Lock size={12} className="text-red-500 shrink-0" title="Zablokowane" />}
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
                                                        <button onClick={() => onDelete(project)} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Check size={10} /></button>
                                                        <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-100 text-zinc-400 rounded hover:bg-zinc-200"><X size={10} /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const deleteId = project.isGroup ? project.versions.map((v: any) => v.id) : project.id;
                                                            setDeleteConfirm({ id: deleteId, name: project.project_id, type: source, path: project.raw?.path });
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                                        title={project.isGroup ? "Usuń grupę" : "Usuń"}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                                {source === 'cloud' && onArchive && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                                                        className={`p-1.5 transition-colors ${project.is_archived ? 'text-amber-500 hover:text-amber-600' : 'text-zinc-400 hover:text-amber-500'}`}
                                                        title={project.is_archived ? "Przywróć" : "Archiwizuj"}
                                                    >
                                                        <Archive size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {isExpanded && project.versions.map((version: any, vIdx: number) => (
                                        <tr
                                            key={`${project.project_id}-v-${vIdx}`}
                                            className="bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-amber-50/50 dark:hover:bg-amber-900/5 cursor-pointer transition-colors border-l-2 border-amber-400 group"
                                            onClick={(e) => { e.stopPropagation(); onLoad(version); }}
                                        >
                                            <td className="p-2 pl-10 text-[10px] font-mono text-zinc-500 italic flex items-center gap-1">
                                                Wersja {project.versions.length - vIdx}
                                                {version.isLocked && <Lock size={10} className="text-red-400 shrink-0" />}
                                            </td>
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
                                                            <button onClick={() => onDelete(version)} className="p-1 bg-red-600 text-white rounded hover:bg-red-700"><Check size={10} /></button>
                                                            <button onClick={() => setDeleteConfirm(null)} className="p-1 bg-zinc-100 text-zinc-400 rounded hover:bg-zinc-200"><X size={10} /></button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteConfirm({ id: version.id, name: version.id, type: source, path: version.raw?.path });
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
