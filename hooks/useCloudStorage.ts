
import { useState } from 'react';
import { storageService } from '../services/storage';
import { SavedCalculation } from '../services/storage/types';
import { Currency, CalculationMode } from '../types';
import { ProjectMetadata, DirectoryItem } from './useFileSystem';

export const useCloudStorage = (showSnackbar: (msg: string) => void) => {
    const [cloudData, setCloudData] = useState<SavedCalculation[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadCloudData = async (
        setPathStack: (val: any) => void,
        setCurrentViewItems: (val: any) => void,
        setSearchIndex: (val: any) => void,
        setFileMetadata: (val: any) => void
    ) => {
        setIsLoading(true);
        try {
            const data = await storageService.getCalculationsMetadata();
            setCloudData(data as SavedCalculation[]);
            setPathStack([{ name: 'Chmura (Supabase)', handle: 'CLOUD_ROOT' }]);

            const metaUpdate: Record<string, ProjectMetadata> = {};
            data.forEach(item => {
                const currency = Currency.EUR;
                const rate = 4.3;
                const stage = item.project_stage || 'DRAFT';
                const valOriginal = item.total_price || 0;
                const projNum = item.project_id || 'Bez Projektu';
                const displayName = `${stage} - ${new Date(item.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;

                metaUpdate[displayName] = {
                    clientName: item.customer_name,
                    isLocked: item.is_locked,
                    projectNumber: projNum,
                    scanned: true,
                    stage: stage,
                    salesPerson: item.engineer,
                    assistantPerson: item.specialist,
                    valueOriginal: valOriginal,
                    currencyOriginal: currency as Currency,
                    valuePLN: valOriginal * rate,
                    valueEUR: valOriginal,
                    costPLN: (item.total_cost || 0) * rate,
                    timestamp: new Date(item.created_at).getTime(),
                    orderDate: item.order_date || undefined,
                    protocolDate: item.close_date || undefined
                };
            });
            setFileMetadata((prev: any) => ({ ...prev, ...metaUpdate }));

            const cloudIndex: DirectoryItem[] = data.map(d => {
                const currency = 'EUR';
                const stage = d.project_stage || 'DRAFT';
                const valOriginal = d.total_price || 0;
                const displayName = `${stage} - ${new Date(d.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;

                return {
                    kind: 'file',
                    name: displayName,
                    handle: { kind: 'file', name: `cloud-id:${d.id}`, cloudData: d } as any,
                    date: new Date(d.created_at),
                    size: 0,
                    path: [d.customer_name || 'Inni', d.project_id || 'Bez Projektu']
                };
            });
            setSearchIndex(cloudIndex);

            // Build initial view (level 0)
            buildCloudView(data as SavedCalculation[], [], setCurrentViewItems);

        } catch (e) {
            console.error(e);
            showSnackbar("Błąd pobierania danych z chmury");
        } finally {
            setIsLoading(false);
        }
    };

    const buildCloudView = (data: SavedCalculation[], currentPath: string[], setCurrentViewItems: (items: DirectoryItem[]) => void) => {
        const items: DirectoryItem[] = [];
        const level = currentPath.length;

        if (level === 0) {
            const clients = Array.from(new Set(data.map(d => d.customer_name || 'Inni')));
            clients.sort().forEach(client => {
                items.push({ kind: 'directory', name: client, handle: { kind: 'directory', name: client } as any });
            });
        } else if (level === 1) {
            const client = currentPath[0];
            const clientData = data.filter(d => (d.customer_name || 'Inni') === client);
            const projects = Array.from(new Set(clientData.map(d => d.project_id || 'Bez Projektu')));
            projects.sort().forEach(proj => {
                items.push({ kind: 'directory', name: proj, handle: { kind: 'directory', name: proj } as any });
            });
        } else if (level === 2) {
            const client = currentPath[0];
            const project = currentPath[1];
            const projectData = data.filter(d =>
                (d.customer_name || 'Inni') === client &&
                (d.project_id || 'Bez Projektu') === project
            );
            projectData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            projectData.forEach(d => {
                const currency = 'EUR';
                const stage = d.project_stage || 'DRAFT';
                const valOriginal = d.total_price || 0;
                const displayName = `${stage} - ${new Date(d.created_at).toLocaleDateString()} (${valOriginal.toLocaleString()} ${currency})`;
                const vHandle: any = { kind: 'file', name: `cloud-id:${d.id}`, cloudData: d };

                items.push({
                    kind: 'file',
                    name: displayName,
                    handle: vHandle,
                    date: new Date(d.created_at),
                    size: 0
                });
            });
        }

        setCurrentViewItems(items);
    };

    return {
        cloudData,
        isLoading,
        loadCloudData,
        buildCloudView
    };
};
