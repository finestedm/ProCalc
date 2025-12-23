
import React, { useState } from 'react';
import { Calendar, Clock, Layers, Users, User, Target, TrendingUp, BarChart3, Trophy, PieChart, RefreshCw, X, Maximize2, Minimize2 } from 'lucide-react';
import { SALES_PEOPLE, SUPPORT_PEOPLE } from '../services/employeesDatabase';
import { formatNumber } from '../services/calculationService';

interface ProjectStatisticsProps {
    statistics: any;
    statsFilters: Record<string, any>;
    setStatsFilters: (val: any) => void;
    activeFilterPop: string | null;
    setActiveFilterPop: (val: string | null) => void;
    totalFiles: number;
}

export const ProjectStatistics: React.FC<ProjectStatisticsProps> = ({
    statistics,
    statsFilters,
    setStatsFilters,
    activeFilterPop,
    setActiveFilterPop,
    totalFiles
}) => {
    const { totalProjects, globalValue, avgValue, chartData, topClients, stageDistribution, avgDuration, avgMargin, avgVersions, engineerStats, specialistStats } = statistics;
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

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

    const Card = ({ id, title, icon: Icon, children, className = "" }: { id: string, title: string, icon: any, children: React.ReactNode, className?: string }) => {
        const isExpanded = expandedCard === id;

        const content = (
            <div className={`bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col ${isExpanded ? 'w-full h-full max-w-5xl max-h-[80vh]' : ''} ${className}`}>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Icon size={16} className="text-amber-500" /> {title}
                    </h3>
                    <button
                        onClick={() => setExpandedCard(isExpanded ? null : id)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                    >
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
                <div className={`flex-1 ${isExpanded ? 'overflow-auto' : ''}`}>
                    {children}
                </div>
            </div>
        );

        if (isExpanded) {
            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="animate-scaleIn w-full flex justify-center">
                        {content}
                    </div>
                </div>
            );
        }

        return content;
    };

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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 w-fit rounded-lg text-blue-600 mb-2"><Target size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{totalProjects}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Projektów</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 w-fit rounded-lg text-green-600 mb-2"><TrendingUp size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(globalValue, 0)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Wartość Całk. (EUR)</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 w-fit rounded-lg text-purple-600 mb-2"><BarChart3 size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatNumber(avgValue, 0)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Średnia Wartość</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 w-fit rounded-lg text-emerald-600 mb-2"><TrendingUp size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgMargin.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Średnia Marża</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 w-fit rounded-lg text-orange-600 mb-2"><Clock size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgDuration.toFixed(1)} <span className="text-sm font-normal">dni</span></div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Czas Trwania</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-700 w-fit rounded-lg text-zinc-600 mb-2"><Layers size={20} /></div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{avgVersions.toFixed(1)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Śr. Liczba Wersji</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card id="top-clients" title="Top Klienci (EUR)" icon={Trophy}>
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
                </Card>

                <Card id="top-engineers" title="Top Inżynierowie (EUR)" icon={Users}>
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
                </Card>

                <Card id="top-specialists" title="Top Specjaliści (EUR)" icon={User}>
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
                </Card>

                <Card id="stages" title="Etapy Projektów" icon={PieChart}>
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
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                <Card id="monthly-activity" title="Aktywność Miesięczna (Wartość EUR)" icon={Calendar}>
                    <div className="h-48 relative group mt-4">
                        {chartData.length > 0 ? (
                            <div className="w-full h-full flex flex-col">
                                <div className="flex-1 relative">
                                    {/* Grid Lines */}
                                    {[0, 25, 50, 75, 100].map(val => (
                                        <div key={val} className="absolute w-full border-t border-zinc-100 dark:border-zinc-800/50" style={{ bottom: `${val}%` }}>
                                            <span className="absolute -left-1 text-[8px] text-zinc-400 -translate-x-full -translate-y-1/2 font-mono">
                                                {formatNumber((maxChartValue * val) / 100, 0)}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="absolute inset-0 flex items-end justify-between px-2">
                                        {chartData.map((d: any) => (
                                            <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full relative group/month cursor-default">
                                                {/* Grouped Bars Container */}
                                                <div className="flex items-end justify-center gap-0.5 w-full h-full pb-1">
                                                    <div className="w-1.5 md:w-2 lg:w-3 bg-zinc-300 dark:bg-zinc-600 rounded-t-sm transition-all group-hover/month:opacity-60" style={{ height: `${(d.offers / maxChartValue) * 100}%` }}></div>
                                                    <div className="w-1.5 md:w-2 lg:w-3 bg-blue-400 rounded-t-sm transition-all group-hover/month:opacity-60" style={{ height: `${(d.opened / maxChartValue) * 100}%` }}></div>
                                                    <div className="w-1.5 md:w-2 lg:w-3 bg-purple-500 rounded-t-sm transition-all group-hover/month:scale-y-105" style={{ height: `${(d.closed / maxChartValue) * 100}%` }}></div>
                                                </div>

                                                {/* Common Tooltip */}
                                                <div className="absolute opacity-0 group-hover/month:opacity-100 transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 rounded-lg -top-24 pointer-events-none z-50 whitespace-nowrap shadow-2xl scale-95 group-hover/month:scale-100">
                                                    <div className="text-[10px] font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-700 pb-1 mb-1">{d.month}</div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                                                        <div className="w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-sm"></div>
                                                        <span>Oferty: <span className="font-bold font-mono text-zinc-900 dark:text-white">{formatNumber(d.offers, 0)}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                                                        <div className="w-2 h-2 bg-blue-400 rounded-sm"></div>
                                                        <span>Otwarte: <span className="font-bold font-mono text-zinc-900 dark:text-white">{formatNumber(d.opened, 0)}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                                                        <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
                                                        <span>Zamknięte: <span className="font-bold font-mono text-zinc-900 dark:text-white">{formatNumber(d.closed, 0)}</span></span>
                                                    </div>
                                                </div>

                                                {/* Label */}
                                                <div className="absolute -bottom-6 text-[9px] text-zinc-400 font-bold whitespace-nowrap -rotate-45 origin-top-left translate-x-1">
                                                    {d.month.split('.')[0]}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-4 justify-center mt-10 shrink-0">
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold"><div className="w-2.5 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-sm"></div> Oferty</div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold"><div className="w-2.5 h-2.5 bg-blue-400 rounded-sm"></div> Realizacja</div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold"><div className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></div> Zamknięte</div>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 italic">Brak danych historycznych</div>
                        )}
                    </div>
                </Card>

                <Card id="margin-trend" title="Trend Marży (%)" icon={TrendingUp}>
                    <div className="h-48 relative group mt-4">
                        {chartData.length > 0 ? (
                            <div className="w-full h-full flex flex-col">
                                <div className="flex-1 relative">
                                    {/* Grid Lines */}
                                    {[0, 25, 50, 75, 100].map(val => (
                                        <div key={val} className="absolute w-full border-t border-zinc-100 dark:border-zinc-800/50" style={{ bottom: `${val}%` }}>
                                            <span className="absolute -left-1 text-[8px] text-zinc-400 -translate-x-full -translate-y-1/2 font-mono">
                                                {val === 0 ? '0%' : val === 100 ? '40%+' : `${(val / 100) * 40}%`}
                                            </span>
                                        </div>
                                    ))}

                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                                        {/* Helper to draw SVG lines */}
                                        {(() => {
                                            const stage = statsFilters.stage;
                                            const getPoints = (key: string) => chartData.map((d: any, i: number) => {
                                                const x = (i / (chartData.length - 1)) * 100;
                                                const val = d[key] || 0;
                                                const y = 100 - Math.min(100, (val / 40) * 100);
                                                return { x, y, val };
                                            });

                                            const drawLine = (key: string, color: string) => {
                                                const pts = getPoints(key);
                                                if (pts.length < 2) return null;
                                                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                                return <path key={key} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />;
                                            };

                                            if (stage === 'DRAFT') return drawLine('offersMargin', '#71717a'); // Zinc
                                            if (stage === 'OPENING') return drawLine('openedMargin', '#60a5fa'); // Blue
                                            if (stage === 'FINAL') return drawLine('closedMargin', '#10b981'); // Emerald

                                            // No filter: Compare Opened vs Closed
                                            return (
                                                <>
                                                    {drawLine('openedMargin', '#60a5fa')}
                                                    {drawLine('closedMargin', '#10b981')}
                                                </>
                                            );
                                        })()}
                                    </svg>

                                    {/* Interactive Hover Areas */}
                                    <div className="absolute inset-0 flex items-stretch">
                                        {chartData.map((d: any, i: number) => {
                                            const stage = statsFilters.stage;
                                            const hasOffers = d.offersMargin > 0;
                                            const hasOpened = d.openedMargin > 0;
                                            const hasClosed = d.closedMargin > 0;

                                            return (
                                                <div key={d.month} className="flex-1 group/point relative flex justify-center">
                                                    {/* Vertical Hover Indicator */}
                                                    <div className="absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-700 opacity-0 group-hover/point:opacity-100 transition-opacity" />

                                                    {/* Points */}
                                                    {(!stage || stage === 'DRAFT') && hasOffers && (
                                                        <div className="absolute w-2 h-2 bg-white border-2 border-zinc-500 rounded-full z-10" style={{ bottom: `${(d.offersMargin / 40) * 100}%`, transform: 'translateY(50%)' }} />
                                                    )}
                                                    {(!stage || stage === 'OPENING') && hasOpened && (
                                                        <div className="absolute w-2 h-2 bg-white border-2 border-blue-400 rounded-full z-10" style={{ bottom: `${(d.openedMargin / 40) * 100}%`, transform: 'translateY(50%)' }} />
                                                    )}
                                                    {(!stage || stage === 'FINAL') && hasClosed && (
                                                        <div className="absolute w-2 h-2 bg-white border-2 border-emerald-500 rounded-full z-10" style={{ bottom: `${(d.closedMargin / 40) * 100}%`, transform: 'translateY(50%)' }} />
                                                    )}

                                                    {/* Tooltip Content */}
                                                    <div className="absolute opacity-0 group-hover/point:opacity-100 transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 rounded-lg -top-24 pointer-events-none z-50 whitespace-nowrap shadow-2xl scale-95 group-hover/point:scale-100">
                                                        <div className="text-[10px] font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-700 pb-1 mb-1">{d.month}</div>
                                                        {(!stage || stage === 'DRAFT') && hasOffers && (
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <div className="w-2 h-2 rounded-full bg-zinc-400" />
                                                                <span className="text-zinc-500">Oferty: <span className="font-bold text-zinc-900 dark:text-white">{d.offersMargin.toFixed(1)}%</span></span>
                                                            </div>
                                                        )}
                                                        {(!stage || stage === 'OPENING') && hasOpened && (
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                                                <span className="text-zinc-500">Otwarcie: <span className="font-bold text-blue-600 dark:text-blue-400">{d.openedMargin.toFixed(1)}%</span></span>
                                                            </div>
                                                        )}
                                                        {(!stage || stage === 'FINAL') && hasClosed && (
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                <span className="text-zinc-500">Zamknięcie: <span className="font-bold text-emerald-600 dark:text-emerald-400">{d.closedMargin.toFixed(1)}%</span></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-4 justify-center mt-10 shrink-0">
                                    {(!statsFilters.stage || statsFilters.stage === 'DRAFT') && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
                                            <div className="w-3 h-0.5 bg-zinc-400"></div> Marża Ofertowa
                                        </div>
                                    )}
                                    {(!statsFilters.stage || statsFilters.stage === 'OPENING') && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
                                            <div className="w-3 h-0.5 bg-blue-400"></div> Marża Realizacji (Otwarcie)
                                        </div>
                                    )}
                                    {(!statsFilters.stage || statsFilters.stage === 'FINAL') && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
                                            <div className="w-3 h-0.5 bg-emerald-500"></div> Marża Zrealizowana (Zamknięcie)
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 italic">Brak danych historycznych</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
