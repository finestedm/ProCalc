
import { useState, useMemo } from 'react';
import { Currency, CalculationMode } from '../types';
import { calculateProjectCosts, convert } from '../services/calculationService';
import { FileSystemFileHandle, ProjectMetadata, DirectoryItem } from './useFileSystem';
import { SavedCalculation } from '../services/storage/types';

export const useProjectData = (
    currentViewItems: DirectoryItem[],
    searchIndex: DirectoryItem[],
    fileMetadata: Record<string, ProjectMetadata>,
    cloudData: SavedCalculation[],
    source: 'local' | 'cloud'
) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchScope, setSearchScope] = useState<'global' | 'local'>('global');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [tableFilters, setTableFilters] = useState<Record<string, any>>({});
    const [statsFilters, setStatsFilters] = useState<Record<string, any>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const displayItems = useMemo(() => {
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const searchSource = searchScope === 'global' && searchIndex.length > 0 ? searchIndex : currentViewItems;

            const matches = searchSource.filter(item => {
                if (item.name.toLowerCase().includes(lowerTerm)) return true;
                if (item.path && item.path.some(p => p.toLowerCase().includes(lowerTerm))) return true;
                if (item.kind === 'file') {
                    const meta = fileMetadata[item.name];
                    if (meta) {
                        if (meta.clientName?.toLowerCase().includes(lowerTerm)) return true;
                        if (meta.projectNumber?.toLowerCase().includes(lowerTerm)) return true;
                    }
                }
                return false;
            });

            return matches.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aIsDir = a.kind === 'directory';
                const bIsDir = b.kind === 'directory';
                const aMeta = fileMetadata[a.name];
                const bMeta = fileMetadata[b.name];

                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;

                if (aIsDir && bIsDir) {
                    const aDepth = a.path?.length || 0;
                    const bDepth = b.path?.length || 0;
                    if (aDepth !== bDepth) return aDepth - bDepth;
                    return aName.localeCompare(bName);
                }

                const aClientMatch = aMeta?.clientName?.toLowerCase().includes(lowerTerm);
                const bClientMatch = bMeta?.clientName?.toLowerCase().includes(lowerTerm);
                if (aClientMatch && !bClientMatch) return -1;
                if (!aClientMatch && bClientMatch) return 1;

                const aProjMatch = aMeta?.projectNumber?.toLowerCase().includes(lowerTerm);
                const bProjMatch = bMeta?.projectNumber?.toLowerCase().includes(lowerTerm);
                if (aProjMatch && !bProjMatch) return -1;
                if (!aProjMatch && bProjMatch) return 1;

                return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
            });
        }
        return currentViewItems;
    }, [searchTerm, searchScope, currentViewItems, searchIndex, fileMetadata]);

    const tableData = useMemo(() => {
        let raw: any[] = [];
        if (source === 'cloud') {
            raw = cloudData.map(d => {
                const margin = d.total_price > 0 ? (1 - (d.total_cost / d.total_price)) * 100 : 0;
                return {
                    id: d.id,
                    project_id: d.project_id || 'Unknown',
                    customer: d.customer_name || 'Inni',
                    price: d.total_price || 0,
                    cost: d.total_cost || 0,
                    margin,
                    engineer: d.engineer || '-',
                    specialist: d.specialist || '-',
                    stage: d.project_stage || 'DRAFT',
                    date: new Date(d.created_at),
                    open_date: d.order_date ? new Date(d.order_date) : null,
                    close_date: d.close_date ? new Date(d.close_date) : null,
                    isLocked: d.is_locked,
                    raw: d
                };
            });
        } else {
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
                    isLocked: meta?.isLocked,
                    handle: i.handle,
                    raw: i
                };
            });
        }

        let filtered = raw.filter((item: any) => {
            return Object.entries(tableFilters).every(([key, value]) => {
                if (!value) return true;
                if (key === 'price' || key === 'margin') {
                    const { min, max } = value as { min?: string, max?: string };
                    const itemVal = Number(item[key]);
                    if (min && itemVal < Number(min)) return false;
                    if (max && itemVal > Number(max)) return false;
                    return true;
                }
                if (key === 'open_date' || key === 'close_date') {
                    const { from, to } = value as { from?: string, to?: string };
                    const itemDate = item[key] as Date | null;
                    if (!itemDate) return !from && !to;
                    const itemTime = itemDate.getTime();
                    if (from && itemTime < new Date(from).setHours(0, 0, 0, 0)) return false;
                    if (to && itemTime > new Date(to).setHours(23, 59, 59, 999)) return false;
                    return true;
                }
                if (key === 'engineer' || key === 'specialist') {
                    const selected = value as string[];
                    return selected.length === 0 || selected.includes(item[key]);
                }
                if (key === 'stage') return item.stage === value;
                const itemVal = String(item[key] || '').toLowerCase();
                return itemVal.includes(String(value).toLowerCase());
            });
        });

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter((item: any) =>
                String(item.project_id || '').toLowerCase().includes(lowerTerm) ||
                String(item.customer || '').toLowerCase().includes(lowerTerm) ||
                String(item.engineer || '').toLowerCase().includes(lowerTerm) ||
                String(item.specialist || '').toLowerCase().includes(lowerTerm)
            );
        }

        filtered.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            const direction = sortConfig.direction === 'asc' ? 1 : -1;

            if (aVal instanceof Date && bVal instanceof Date) return (aVal.getTime() - bVal.getTime()) * direction;
            if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal) * direction;
            return ((Number(aVal) || 0) - (Number(bVal) || 0)) * direction;
        });

        const groups: Record<string, any[]> = {};
        filtered.forEach(item => {
            const pid = item.project_id || 'Unknown';
            if (!groups[pid]) groups[pid] = [];
            groups[pid].push(item);
        });

        const grouped = Object.entries(groups).map(([pid, items]) => {
            items.sort((a, b) => b.date.getTime() - a.date.getTime());
            return {
                ...items[0],
                isLocked: items.some(v => v.isLocked),
                versions: items,
                isGroup: items.length > 1
            };
        });

        grouped.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            const direction = sortConfig.direction === 'asc' ? 1 : -1;
            if (aVal instanceof Date && bVal instanceof Date) return (aVal.getTime() - bVal.getTime()) * direction;
            if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal) * direction;
            return ((Number(aVal) || 0) - (Number(bVal) || 0)) * direction;
        });

        return grouped;
    }, [cloudData, searchIndex, fileMetadata, source, tableFilters, searchTerm, sortConfig]);

    const statistics = useMemo(() => {
        const allFiles = searchIndex.filter(i => i.kind === 'file');
        const monthlyStats: Record<string, { offers: number, opened: number, closed: number, valueSum: number, costSum: number }> = {};
        const projectGroups: Record<string, any> = {};

        const filesToAnalyze = allFiles.filter(f => {
            const meta = fileMetadata[f.name];
            if (!meta || meta.projectNumber === 'ERR' || meta.projectNumber === '-') return false;

            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                if (!String(meta.projectNumber || '').toLowerCase().includes(lowerTerm) &&
                    !String(meta.clientName || '').toLowerCase().includes(lowerTerm) &&
                    !String(meta.salesPerson || '').toLowerCase().includes(lowerTerm) &&
                    !String(meta.assistantPerson || '').toLowerCase().includes(lowerTerm)) return false;
            }

            return Object.entries(statsFilters).every(([key, value]) => {
                if (!value) return true;
                if (key === 'stage') return meta.stage === value;
                if (key === 'engineer') return (value as string[]).length === 0 || (value as string[]).includes(meta.salesPerson || '');
                if (key === 'specialist') return (value as string[]).length === 0 || (value as string[]).includes(meta.assistantPerson || '');
                if (key === 'price' || key === 'margin') {
                    const { min, max } = value as { min?: string, max?: string };
                    const itemVal = key === 'price' ? meta.valueEUR : (meta.valuePLN > 0 ? (1 - (meta.costPLN / meta.valuePLN)) * 100 : 0);
                    if (min && itemVal < Number(min)) return false;
                    if (max && itemVal > Number(max)) return false;
                    return true;
                }
                if (key === 'open_date' || key === 'close_date' || key === 'date') {
                    const { from, to } = value as { from?: string, to?: string };
                    const dateStr = key === 'open_date' ? meta.orderDate : key === 'close_date' ? meta.protocolDate : meta.timestamp;
                    if (!dateStr) return !from && !to;
                    const itemTime = new Date(dateStr).getTime();
                    if (from && itemTime < new Date(from).setHours(0, 0, 0, 0)) return false;
                    if (to && itemTime > new Date(to).setHours(23, 59, 59, 999)) return false;
                    return true;
                }
                return true;
            });
        });

        filesToAnalyze.forEach(f => {
            const meta = fileMetadata[f.name];
            if (!projectGroups[meta.projectNumber!]) projectGroups[meta.projectNumber!] = { latestFile: meta, versionCount: 0 };
            if (meta.timestamp > projectGroups[meta.projectNumber!].latestFile.timestamp) projectGroups[meta.projectNumber!].latestFile = meta;
            projectGroups[meta.projectNumber!].versionCount++;
            if (meta.stage === 'DRAFT' && (!projectGroups[meta.projectNumber!].draftFile || meta.timestamp > projectGroups[meta.projectNumber!].draftFile.timestamp)) projectGroups[meta.projectNumber!].draftFile = meta;
            if (meta.stage === 'OPENING' && (!projectGroups[meta.projectNumber!].openingFile || meta.timestamp > projectGroups[meta.projectNumber!].openingFile.timestamp)) projectGroups[meta.projectNumber!].openingFile = meta;
            if (meta.stage === 'FINAL' && (!projectGroups[meta.projectNumber!].finalFile || meta.timestamp > projectGroups[meta.projectNumber!].finalFile.timestamp)) projectGroups[meta.projectNumber!].finalFile = meta;
        });

        const clientStats: Record<string, number> = {};
        const engineerStats: Record<string, number> = {};
        const specialistStats: Record<string, number> = {};
        const stageDistribution = { DRAFT: 0, OPENING: 0, FINAL: 0 };
        let totalProjects = 0, globalValue = 0, globalCost = 0, totalDurationDays = 0, projectsWithDuration = 0, totalVersions = 0;

        const initMonth = (m: string) => { if (!monthlyStats[m]) monthlyStats[m] = { offers: 0, opened: 0, closed: 0, valueSum: 0, costSum: 0 }; };

        Object.values(projectGroups).forEach((group: any) => {
            const { latestFile, draftFile, openingFile, finalFile, versionCount } = group;
            totalProjects++;
            totalVersions += versionCount;
            globalValue += isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR;
            globalCost += isNaN(latestFile.costPLN) ? 0 : convert(latestFile.costPLN, Currency.PLN, Currency.EUR, 4.3); // Rough conversion for margin

            const cName = latestFile.clientName || 'Inny';
            clientStats[cName] = (clientStats[cName] || 0) + (isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR);

            const eName = latestFile.salesPerson || '-';
            engineerStats[eName] = (engineerStats[eName] || 0) + (isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR);

            const sName = latestFile.assistantPerson || '-';
            specialistStats[sName] = (specialistStats[sName] || 0) + (isNaN(latestFile.valueEUR) ? 0 : latestFile.valueEUR);

            const stageKey = latestFile.stage as keyof typeof stageDistribution;
            if (stageDistribution[stageKey] !== undefined) stageDistribution[stageKey]++;

            const startDateStr = finalFile?.orderDate || openingFile?.orderDate || draftFile?.orderDate;
            const endDateStr = finalFile?.protocolDate;

            if (startDateStr && endDateStr) {
                const start = new Date(startDateStr), end = new Date(endDateStr);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    totalDurationDays += Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    projectsWithDuration++;
                }
            }

            const offerSource = draftFile || openingFile;
            if (offerSource) {
                const m = new Date(offerSource.timestamp).toISOString().slice(0, 7);
                initMonth(m);
                monthlyStats[m].offers += isNaN(offerSource.valueEUR) ? 0 : offerSource.valueEUR;
            }
            if (startDateStr) {
                const m = startDateStr.slice(0, 7);
                initMonth(m);
                monthlyStats[m].opened += isNaN(openingFile ? openingFile.valueEUR : latestFile.valueEUR) ? 0 : (openingFile ? openingFile.valueEUR : latestFile.valueEUR);
            }
            if (endDateStr && finalFile) {
                const m = endDateStr.slice(0, 7);
                initMonth(m);
                monthlyStats[m].closed += isNaN(finalFile.valueEUR) ? 0 : finalFile.valueEUR;
                monthlyStats[m].valueSum += isNaN(finalFile.valueEUR) ? 0 : finalFile.valueEUR;
                monthlyStats[m].costSum += isNaN(finalFile.costPLN) ? 0 : convert(finalFile.costPLN, Currency.PLN, Currency.EUR, 4.3);
            }
        });

        const avgMargin = globalValue > 0 ? (1 - (globalCost / globalValue)) * 100 : 0;

        return {
            totalProjects, globalValue,
            avgValue: totalProjects > 0 ? globalValue / totalProjects : 0,
            avgDuration: projectsWithDuration > 0 ? totalDurationDays / projectsWithDuration : 0,
            avgMargin,
            avgVersions: totalProjects > 0 ? totalVersions / totalProjects : 0,
            chartData: Object.entries(monthlyStats).sort((a, b) => a[0].localeCompare(b[0])).map(([month, s]) => ({
                month, ...s,
                avgMargin: s.valueSum > 0 ? (1 - (s.costSum / s.valueSum)) * 100 : 0
            })),
            topClients: Object.entries(clientStats).sort((a, b) => b[1] - a[1]).slice(0, 5),
            engineerStats: Object.entries(engineerStats).sort((a, b) => b[1] - a[1]).slice(0, 5),
            specialistStats: Object.entries(specialistStats).sort((a, b) => b[1] - a[1]).slice(0, 5),
            stageDistribution, totalFiles: allFiles.length
        };
    }, [searchIndex, fileMetadata, statsFilters, searchTerm]);

    return {
        searchTerm, setSearchTerm,
        searchScope, setSearchScope,
        sortConfig, setSortConfig,
        tableFilters, setTableFilters,
        statsFilters, setStatsFilters,
        expandedGroups, setExpandedGroups,
        displayItems,
        tableData,
        statistics
    };
};
