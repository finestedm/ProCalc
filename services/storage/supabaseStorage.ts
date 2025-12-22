/// <reference types="vite/client" />
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { CalculationData } from '../../types';
import { ICalculationStorage, SavedCalculation, SavedLogisticsTransport } from './types';
import { ensureTransportData } from '../../services/calculationService';

export class SupabaseStorage implements ICalculationStorage {
    private supabase: SupabaseClient = supabase;
    private tableName = 'calculations';

    constructor() {
        // Client initialized via shared instance
    }

    async saveCalculation(data: any, summary: { totalCost: number, totalPrice: number }): Promise<string> {
        // [NEW] STRIP HISTORY TO REDUCE PAYLOAD SIZE
        const optimizedData = { ...data };

        const stripHistory = (state: any) => {
            if (!state) return;
            if (state.past) state.past = [];
            if (state.future) state.future = [];
            if (state.historyLog) state.historyLog = [];

            if (state.appState) {
                if (state.appState.past) state.appState.past = [];
                if (state.appState.future) state.appState.future = [];
                if (state.appState.historyLog) state.appState.historyLog = [];
            }
        };

        stripHistory(optimizedData);

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            throw new Error('User must be authenticated to save calculations');
        }

        const isProjectFile = optimizedData.appState !== undefined;
        const appState = isProjectFile ? optimizedData.appState : null;
        const mode = appState?.mode || 'INITIAL';
        const activeData = isProjectFile
            ? (mode === 'FINAL' ? appState.final : appState.initial)
            : optimizedData;

        const meta = activeData?.meta || {};
        const orderingParty = activeData?.orderingParty || {};
        const isLocked = appState?.isLocked || false;

        // Auto-sync logistics
        if (mode === 'FINAL' || mode === 'INITIAL') {
            const currentStage = appState?.stage || (optimizedData as any).stage;
            if (currentStage === 'OPENING') {
                const processed = ensureTransportData(activeData);
                if (processed.transport.length > (activeData.transport?.length || 0)) {
                    activeData.transport = processed.transport;
                }
            }
        }

        const payload = {
            user_id: user.id,
            specialist: meta.assistantPerson || '',
            specialist_id: meta.assistantPersonId || null,
            engineer: meta.salesPerson || '',
            engineer_id: meta.salesPersonId || null,
            customer_name: orderingParty.name || 'Unknown',
            project_id: meta.projectNumber || 'BezNumeru',
            order_date: meta.orderDate || null,
            close_date: meta.protocolDate || null,
            sales_person_1_id: meta.actualSalesPersonId || null,
            sales_person_2_id: meta.actualSalesPerson2Id || null,
            total_cost: summary.totalCost,
            total_price: summary.totalPrice,
            is_locked: isLocked,
            logistics_status: appState?.logisticsStatus || null,
            logistics_operator_id: null as string | null, // Will be filled below if existing
            project_stage: appState?.stage || (optimizedData as any).stage || 'DRAFT',
            project_notes: activeData?.projectNotes || ''
        };

        // Carry over logistics from latest version if exists
        if (payload.project_id && payload.project_id !== 'BezNumeru') {
            const { data: latest } = await this.supabase
                .from(this.tableName)
                .select('logistics_status, logistics_operator_id')
                .eq('project_id', payload.project_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latest) {
                if (!payload.logistics_status) payload.logistics_status = latest.logistics_status;
                payload.logistics_operator_id = latest.logistics_operator_id;
            }
        }
        const { data: insertedData, error } = await this.supabase
            .from(this.tableName)
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            throw new Error(error.message);
        }

        // Save heavy JSON to details table
        await this.supabase
            .from('calculations_details')
            .upsert({
                id: insertedData.id,
                calc: optimizedData
            });

        // Sync stages
        try {
            await this.syncInstallationStages(
                insertedData.id,
                activeData.installation?.stages || [],
                activeData.installation?.customTimelineItems || []
            );
        } catch (syncError) {
            console.error("Sync installation stages error", syncError);
        }

        return insertedData.id;
    }

    private async syncInstallationStages(calculationId: string, stages: any[], customItems: any[]): Promise<void> {
        await this.supabase
            .from('installation_stages')
            .delete()
            .eq('calculation_id', calculationId);

        if (stages.length === 0 && customItems.length === 0) return;

        const payload = [
            ...stages.map(s => ({
                calculation_id: calculationId,
                stage_id: s.id,
                name: s.name,
                start_date: s.startDate || null,
                end_date: s.endDate || null,
                progress: s.progress || 0,
                stage_type: 'STAGE'
            })),
            ...customItems.map(c => ({
                calculation_id: calculationId,
                stage_id: c.id,
                name: c.name,
                start_date: c.startDate || null,
                end_date: c.endDate || null,
                progress: 0,
                stage_type: 'CUSTOM'
            }))
        ];

        await this.supabase.from('installation_stages').insert(payload);
    }

    async getInstallationStages(calculationIds: string[]): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('installation_stages')
            .select('*')
            .in('calculation_id', calculationIds);

        if (error) return [];
        return data || [];
    }

    async getCalculations(): Promise<any[]> {
        let data: any[] | null = null;
        let error: any = null;

        // Try fetching with legacy 'calc' column first
        const { data: dataWithCalc, error: errorWithCalc } = await this.supabase
            .from(this.tableName)
            .select('id, created_at, specialist, specialist_id, engineer, engineer_id, customer_name, project_id, order_date, close_date, total_cost, total_price, is_locked, logistics_status, logistics_operator_id, project_stage, project_notes, user_id, sales_person_1_id, sales_person_2_id, calc, user:users!user_id(full_name), details:calculations_details(calc)')
            .order('created_at', { ascending: false });

        if (!errorWithCalc) {
            data = dataWithCalc;
        } else {
            // Fallback: If 'calc' column is missing, fetch without it
            console.warn("Legacy 'calc' column fetch failed, retrying without it:", errorWithCalc.message);
            const { data: dataWithoutCalc, error: errorWithoutCalc } = await this.supabase
                .from(this.tableName)
                .select('id, created_at, specialist, specialist_id, engineer, engineer_id, customer_name, project_id, order_date, close_date, total_cost, total_price, is_locked, logistics_status, logistics_operator_id, project_stage, project_notes, user_id, sales_person_1_id, sales_person_2_id, user:users!user_id(full_name), details:calculations_details(calc)')
                .order('created_at', { ascending: false });

            if (errorWithoutCalc) throw new Error(errorWithoutCalc.message);
            data = dataWithoutCalc;
        }

        return (data || []).map((item: any) => {
            // [MODIFIED] Handle both 1:1 (Object) and 1:N (Array) responses from Supabase
            const details = item.details;
            if (Array.isArray(details)) {
                if (details.length > 0 && details[0]?.calc) {
                    item.calc = details[0].calc;
                }
            } else if (details && typeof details === 'object' && details.calc) {
                // 1:1 relationship case
                item.calc = details.calc;
            }

            // Fallback: item.calc might already be set from main table

            delete item.details;
            return item;
        });
    }

    async getCalculationsMetadata(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('id, created_at, specialist, specialist_id, engineer, engineer_id, customer_name, project_id, order_date, close_date, total_cost, total_price, is_locked, logistics_status, logistics_operator_id, project_stage, project_notes, user_id, sales_person_1_id, sales_person_2_id, user:users!user_id(full_name)')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data || [];
    }

    async getCalculationById(id: string): Promise<any | null> {
        let data: any = null;

        // Try fetching with legacy 'calc' column
        const { data: dataWithCalc, error: errorWithCalc } = await this.supabase
            .from(this.tableName)
            .select('*, user:users!user_id(full_name), details:calculations_details(calc)')
            .eq('id', id)
            .single();

        if (!errorWithCalc) {
            data = dataWithCalc;
        } else {
            // Fallback
            const { data: dataWithoutCalc, error: errorWithoutCalc } = await this.supabase
                .from(this.tableName)
                .select('id, created_at, specialist, specialist_id, engineer, engineer_id, customer_name, project_id, order_date, close_date, total_cost, total_price, is_locked, logistics_status, logistics_operator_id, project_stage, project_notes, user_id, sales_person_1_id, sales_person_2_id, user:users!user_id(full_name), details:calculations_details(calc)')
                .eq('id', id)
                .single();
            if (errorWithoutCalc) return null;
            data = dataWithoutCalc;
        }

        if (data && (data as any).details && Array.isArray((data as any).details) && (data as any).details.length > 0 && (data as any).details[0].calc) {
            (data as any).calc = (data as any).details[0].calc;
            delete (data as any).details;
        }

        return data;
    }

    async deleteCalculation(id: string): Promise<void> {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    }

    async setLockState(id: string, isLocked: boolean): Promise<void> {
        const { data: calcRow } = await this.supabase
            .from(this.tableName)
            .select('project_id')
            .eq('id', id)
            .single();

        if (calcRow?.project_id) {
            await this.lockProject(calcRow.project_id, isLocked);
        }
    }

    async lockProject(projectId: string, isLocked: boolean): Promise<void> {
        if (!projectId || projectId === 'BezNumeru') return;
        const { error } = await this.supabase
            .from(this.tableName)
            .update({ is_locked: isLocked })
            .eq('project_id', projectId);
        if (error) throw new Error(error.message);
    }

    async isProjectLocked(projectId: string): Promise<boolean> {
        if (!projectId || projectId === 'BezNumeru') return false;
        const { data } = await this.supabase
            .from(this.tableName)
            .select('is_locked')
            .eq('project_id', projectId)
            .eq('is_locked', true)
            .limit(1);
        return data && data.length > 0;
    }

    async updateLogisticsStatus(id: string, status: 'PENDING' | 'PROCESSED' | null): Promise<void> {
        await this.supabase
            .from(this.tableName)
            .update({ logistics_status: status })
            .eq('id', id);
    }

    async updateLogisticsOperator(id: string, operatorId: string | null): Promise<void> {
        await this.supabase
            .from(this.tableName)
            .update({ logistics_operator_id: operatorId })
            .eq('id', id);
    }

    async createAccessRequest(calculationId: string, message?: string): Promise<void> {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User must be authenticated');

        await this.supabase
            .from('access_requests')
            .insert({
                calculation_id: calculationId,
                user_id: user.id,
                message: message || 'Prośba o odblokowanie edycji.',
                status: 'pending'
            });
    }

    async getPendingAccessRequests(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('access_requests')
            .select('*, user:users!user_id(full_name), calculation:calculations!calculation_id(project_id, customer_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
    }

    async updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
        const { data: request, error } = await this.supabase
            .from('access_requests')
            .update({ status })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw new Error(error.message);

        if (status === 'approved' && request) {
            const { data: calc } = await this.supabase.from(this.tableName).select('project_id').eq('id', request.calculation_id).single();
            if (calc?.project_id) {
                await this.lockProject(calc.project_id, false);
            }
        }
    }

    async updateCalculation(id: string, partialData: any): Promise<void> {
        const { data: current } = await this.supabase
            .from('calculations_details')
            .select('calc')
            .eq('id', id)
            .single();

        let baseCalc = current?.calc;
        if (!baseCalc) {
            const { data: fallback } = await this.supabase
                .from(this.tableName)
                .select('calc')
                .eq('id', id)
                .single();
            baseCalc = fallback?.calc;
        }

        if (!baseCalc) throw new Error("Calculation not found");

        const merged = { ...baseCalc, ...partialData };
        if (partialData.appState && baseCalc.appState) {
            merged.appState = { ...baseCalc.appState, ...partialData.appState };
        }

        await this.supabase
            .from('calculations_details')
            .upsert({ id, calc: merged });

        const metaPayload: any = {};
        if (partialData.total_price !== undefined) metaPayload.total_price = partialData.total_price;
        if (partialData.total_cost !== undefined) metaPayload.total_cost = partialData.total_cost;
        if (partialData.project_stage !== undefined) metaPayload.project_stage = partialData.project_stage;
        if (partialData.is_locked !== undefined) metaPayload.is_locked = partialData.is_locked;

        if (Object.keys(metaPayload).length > 0) {
            await this.supabase.from(this.tableName).update(metaPayload).eq('id', id);
        }
    }

    async getLogisticsTransports(projectNumbers?: string[]): Promise<SavedLogisticsTransport[]> {
        let query = this.supabase.from('logistics_transports').select('*');
        if (projectNumbers && projectNumbers.length > 0) {
            query = query.in('project_number', projectNumbers);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data as SavedLogisticsTransport[];
    }

    async saveLogisticsTransport(transport: Partial<SavedLogisticsTransport>): Promise<void> {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!transport.project_number || !transport.transport_id) {
            throw new Error("Missing PK fields for transport save");
        }
        const cleanedTransport = { ...transport };
        const dateFields = ['pickup_date', 'confirmed_delivery_date', 'loading_dates', 'delivery_date'];

        dateFields.forEach(field => {
            if ((cleanedTransport as any)[field] === '') {
                (cleanedTransport as any)[field] = null;
            }
        });

        const payload = {
            ...cleanedTransport,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };
        const { error } = await this.supabase
            .from('logistics_transports')
            .upsert(payload, { onConflict: 'project_number, transport_id' });
        if (error) throw new Error(error.message);
    }
}
