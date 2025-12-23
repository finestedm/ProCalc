
import React from 'react';
import { Calendar, Clock, Layers, Users, User, Target, TrendingUp, BarChart3, Trophy, PieChart, RefreshCw, X } from 'lucide-react';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';
import { formatNumber } from '../services/calculationService';

interface ProjectStatisticsProps {
    statistics: any;
    statsFilters: Record<string, any>;
    setStatsFilters: (val: any) => void;
    activeFilterPop: string | null;
    setActiveFilterPop: (val: string | null) => void;
    isScanning: boolean;
    startRecursiveScan: (handle: any) => void;
    currentDirHandle: any;
    totalFiles: number;
}

export const ProjectStatistics: React.FC<ProjectStatisticsProps> = ({
    statistics,
    statsFilters,
    setStatsFilters,
    activeFilterPop,
    setActiveFilterPop,
    isScanning,
    startRecursiveScan,
    currentDirHandle,
    totalFiles
}) => {
    const { totalProjects, globalValue, avgValue, chartData, topClients, stageDistribution, avgDuration, avgMargin, avgVersions, engineerStats, specialistStats } = statistics;
    const maxChartValue = Math.max(1, ...chartData.map((d: any) => Math.max(d.offers, d.opened, d.closed)));
    const maxClientValue = topClients.length > 0 ? topClients[0][1] : 1;
    const maxEngineerValue = engineerStats?.length > 0 ? engineerStats[0][1] : 1;
    const maxSpecialistValue = specialistStats?.length > 0 ? specialistStats[0][1] : 1;

    const updateFilter = (key: string, value: any) => {
        setStatsFilters((prev: any) => ({ ...prev, [key]: value }));
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
        <div className="p-6 h-full w-full overflow-auto custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col gap-8">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600"><TrendingUp size={20} /></div>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgMargin.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Średnia Marża</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Clock size={20} /></div>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgDuration.toFixed(1)} <span className="text-sm font-normal">dni</span></div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Czas Trwania</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-zinc-600"><Layers size={20} /></div>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgVersions.toFixed(1)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Liczba Wersji</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <Trophy size={16} className="text-yellow-500" /> Top Klienci (EUR)
                    </h3>
                    <div className="space-y-3">
                        {topClients.map(([name, val]: [string, number], idx: number) => (
                            <div key={name} className="relative">
                                <div className="flex justify-between text-[10px] mb-1 relative z-10">
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate pr-2">{idx + 1}. {name}</span>
                                    <span className="font-mono whitespace-nowrap">{formatNumber(val, 0)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(val / maxClientValue) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                        {topClients.length === 0 && <div className="text-xs text-zinc-400 italic">Brak danych</div>}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <Users size={16} className="text-amber-500" /> Top Inżynierowie (EUR)
                    </h3>
                    <div className="space-y-3">
                        {engineerStats?.map(([name, val]: [string, number], idx: number) => (
                            <div key={name} className="relative">
                                <div className="flex justify-between text-[10px] mb-1 relative z-10">
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate pr-2">{idx + 1}. {name}</span>
                                    <span className="font-mono whitespace-nowrap">{formatNumber(val, 0)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(val / (maxEngineerValue || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <User size={16} className="text-cyan-500" /> Top Specjaliści (EUR)
                    </h3>
                    <div className="space-y-3">
                        {specialistStats?.map(([name, val]: [string, number], idx: number) => (
                            <div key={name} className="relative">
                                <div className="flex justify-between text-[10px] mb-1 relative z-10">
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate pr-2">{idx + 1}. {name}</span>
                                    <span className="font-mono whitespace-nowrap">{formatNumber(val, 0)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(val / (maxSpecialistValue || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                        <Calendar size={16} className="text-zinc-500" /> Aktywność Miesięczna (Wartość EUR)
                    </h3>
                    <div className="h-40 flex items-end gap-2 relative">
                        {chartData.map((d: any) => (
                            <div key={d.month} className="flex-1 flex flex-col justify-end gap-0.5 group relative h-full">
                                <div className="w-full bg-purple-500 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.closed / maxChartValue) * 80}%` }} title={`Zamknięte: ${formatNumber(d.closed, 0)}`}></div>
                                <div className="w-full bg-blue-400 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.opened / maxChartValue) * 80}%` }} title={`Otwarte: ${formatNumber(d.opened, 0)}`}></div>
                                <div className="w-full bg-zinc-300 dark:bg-zinc-600 opacity-80 hover:opacity-100 transition-opacity rounded-t-sm" style={{ height: `${(d.offers / maxChartValue) * 80}%` }} title={`Oferty: ${formatNumber(d.offers, 0)}`}></div>
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

                <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                        <TrendingUp size={16} className="text-emerald-500" /> Trend Marży (%)
                    </h3>
                    <div className="h-40 relative group">
                        {chartData.length > 0 ? (
                            <div className="w-full h-full">
                                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    {/* Grid Lines */}
                                    {[0, 25, 50, 75, 100].map(val => (
                                        <line key={val} x1="0" y1={val} x2="100" y2={val} stroke="currentColor" strokeWidth="0.1" className="text-zinc-100 dark:text-zinc-700/50" />
                                    ))}

                                    {/* Area under the line */}
                                    <path
                                        d={`M 0 100 ${chartData.map((d: any, i: number) => {
                                            const x = (i / (chartData.length - 1)) * 100;
                                            const y = 100 - Math.min(100, (d.avgMargin / 40) * 80);
                                            return `L ${x} ${y}`;
                                        }).join(' ')} L 100 100 Z`}
                                        className="fill-emerald-500/5 dark:fill-emerald-500/10"
                                    />

                                    {/* The Line */}
                                    <path
                                        d={chartData.map((d: any, i: number) => {
                                            const x = (i / (chartData.length - 1)) * 100;
                                            const y = 100 - Math.min(100, (d.avgMargin / 40) * 80);
                                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                        }).join(' ')}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="text-emerald-500"
                                    />
                                </svg>

                                {/* Interactive Points Over the SVG */}
                                <div className="absolute inset-0 flex items-end justify-between">
                                    {chartData.map((d: any, i: number) => (
                                        <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full relative group/point">
                                            <div
                                                className="absolute w-2.5 h-2.5 bg-white border-2 border-emerald-500 rounded-full shadow-sm z-10 hover:scale-125 transition-transform cursor-pointer"
                                                style={{ bottom: `${Math.min(100, (d.avgMargin / 40) * 80)}%`, transform: 'translateY(50%)' }}
                                            />
                                            {/* Tooltip */}
                                            <div className="absolute opacity-0 group-hover/point:opacity-100 transition-opacity bg-zinc-800 text-white text-[10px] py-1 px-2 rounded-md -top-8 pointer-events-none z-30 whitespace-nowrap shadow-xl">
                                                {d.month}: <span className="text-emerald-400 font-bold">{d.avgMargin.toFixed(1)}%</span>
                                            </div>
                                            <div className="text-[9px] text-zinc-400 -rotate-45 mt-2 origin-left translate-x-1 absolute -bottom-8">{d.month.slice(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 italic">Brak danych historycznych</div>
                        )}
                    </div>
                    <div className="flex gap-4 justify-center mt-12">
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                            <div className="w-4 h-0.5 bg-emerald-400"></div> Średnia marża zrealizowana (linia trendu)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
