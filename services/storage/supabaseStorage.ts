/// <reference types="vite/client" />
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { CalculationData } from '../../types';
import { ICalculationStorage, SavedCalculation } from './types';

export class SupabaseStorage implements ICalculationStorage {
    private supabase: SupabaseClient = supabase;
    private tableName = 'calculations';

    constructor() {
        // Client initialized via shared instance
    }

    async saveCalculation(data: any, summary: { totalCost: number, totalPrice: number }): Promise<string> {


        // Get current user
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            throw new Error('User must be authenticated to save calculations');
        }

        // Determine the source of metadata
        // If data is a ProjectFile (nested), we look inside appState
        // If data is flat CalculationData (from OfferGenerator), we use it directly
        const isProjectFile = data.appState !== undefined;
        const appState = isProjectFile ? data.appState : null;

        // Use current mode from appState if available, default to INITIAL
        const mode = appState?.mode || 'INITIAL';
        const activeData = isProjectFile
            ? (mode === 'FINAL' ? appState.final : appState.initial)
            : data;

        const meta = activeData?.meta || {};
        const orderingParty = activeData?.orderingParty || {};

        // Auto-detect project-wide lock if not explicitly set in appState (safety net)
        let isLocked = appState?.isLocked || false;
        if (!isLocked && meta.projectNumber && meta.projectNumber !== 'BezNumeru') {
            // Optional: could check DB here, but might be slow. We trust appState for now.
        }

        // Mapping to User's specific table columns
        const payload = {
            user_id: user.id, // Associate with current user
            specialist: meta.assistantPerson || '',
            specialist_id: meta.assistantPersonId || null,
            engineer: meta.salesPerson || '',
            engineer_id: meta.salesPersonId || null,
            customer_name: orderingParty.name || 'Unknown',
            project_id: meta.projectNumber || 'BezNumeru', // [NEW] Supporting the new column
            order_date: meta.orderDate || null,
            close_date: meta.protocolDate || null,
            sales_person_1_id: meta.actualSalesPersonId || null,
            sales_person_2_id: meta.actualSalesPerson2Id || null,
            total_cost: summary.totalCost,
            total_price: summary.totalPrice,
            is_locked: isLocked, // [NEW] Persist lock state
            logistics_status: appState?.logisticsStatus || null, // [NEW] Logistics Status
            calc: data // We still save the full object (ProjectFile or CalculationData) in the JSON column
        };

        const { data: insertedData, error } = await this.supabase
            .from(this.tableName)
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            throw new Error(error.message);
        }

        // [NEW] Enforce Project-Wide Lock Consistency
        if (isLocked && payload.project_id && payload.project_id !== 'BezNumeru') {
            // We don't await this to keep UI snappy, or we can catch errors silently
            this.lockProject(payload.project_id, true).catch(err =>
                console.error("Failed to propagate project lock", err)
            );
        }

        return insertedData.id;
    }

    async getCalculations(): Promise<SavedCalculation[]> {


        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*, user:users!user_id(full_name)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Fetch Error:', error);
            throw new Error(error.message);
        }

        return data as SavedCalculation[];
    }

    async deleteCalculation(id: string): Promise<void> {
        console.log('Attempting to delete calculation with ID:', id);

        const { error, count } = await this.supabase
            .from(this.tableName)
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            console.error('Supabase Delete Error:', error);
            throw new Error(error.message);
        }

        console.log('Supabase Delete Result - Count:', count);
    }

    // Lock a single calculation (Legacy - kept for compatibility)
    async setLockState(id: string, isLocked: boolean): Promise<void> {
        // 1. Fetch to get details
        const { data: calcRow, error: fetchError } = await this.supabase
            .from(this.tableName)
            .select('project_id')
            .eq('id', id)
            .single();

        if (fetchError || !calcRow) return; // Fail silently or log

        // Redirect to project lock
        await this.lockProject(calcRow.project_id, isLocked);
    }

    // PROJECT-WIDE LOCKING
    async lockProject(projectId: string, isLocked: boolean): Promise<void> {
        if (!projectId || projectId === 'BezNumeru') return;

        // Update ALL rows with this project_id
        const { error } = await this.supabase
            .from(this.tableName)
            .update({ is_locked: isLocked })
            .eq('project_id', projectId);

        if (error) {
            console.error('Lock Project Error:', error);
            throw new Error(error.message);
        }
    }

    async isProjectLocked(projectId: string): Promise<boolean> {
        if (!projectId || projectId === 'BezNumeru') return false;

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('is_locked')
            .eq('project_id', projectId)
            .eq('is_locked', true)
            .limit(1);

        if (error) {
            console.error("Check Lock Error", error);
            return false;
        }

        return data && data.length > 0;
    }

    async updateLogisticsStatus(id: string, status: 'PENDING' | 'PROCESSED' | null): Promise<void> {
        const { error } = await this.supabase
            .from(this.tableName)
            .update({ logistics_status: status })
            .eq('id', id);

        if (error) {
            throw new Error(error.message);
        }
    }

    // Access Requests
    async createAccessRequest(calculationId: string, message?: string): Promise<void> {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('User must be authenticated');

        const { error } = await this.supabase
            .from('access_requests')
            .insert({
                calculation_id: calculationId,
                user_id: user.id,
                message: message || 'Prośba o odblokowanie edycji.',
                status: 'pending'
            });

        if (error) {
            console.error('Supabase Create Access Request Error:', error);
            throw new Error(error.message);
        }
    }

    async getPendingAccessRequests(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('access_requests')
            .select('*, user:users!user_id(full_name), calculation:calculations!calculation_id(project_id, customer_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Get Access Requests Error:', error);
            throw new Error(error.message);
        }

        return data;
    }

    async updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
        // 1. Update the request status
        const { data: request, error: requestError } = await this.supabase
            .from('access_requests')
            .update({ status })
            .eq('id', requestId)
            .select()
            .single();

        if (requestError) {
            console.error('Supabase Update Access Request Status Error:', requestError);
            throw new Error(requestError.message);
        }

        // 2. If approved, unlock the PROJECT
        if (status === 'approved' && request) {
            // Need to fetch calculation to get project_id
            const { data: calc } = await this.supabase.from(this.tableName).select('project_id').eq('id', request.calculation_id).single();
            if (calc && calc.project_id) {
                await this.lockProject(calc.project_id, false);
            }
        }
    }

    async updateCalculation(id: string, partialData: any): Promise<void> {
        // ... (existing content)
        const { data: current, error: fetchError } = await this.supabase
            .from(this.tableName)
            .select('calc')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error(`Failed to fetch calculation for update: ${fetchError?.message}`);
        }

        const merged = { ...current.calc, ...partialData };
        if (partialData.appState && current.calc.appState) {
            merged.appState = { ...current.calc.appState, ...partialData.appState };
        }

        const { error } = await this.supabase
            .from(this.tableName)
            .update({ calc: merged })
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to update calculation: ${error.message}`);
        }
    }

    // LOGISTICS OVERRIDES
    async getLogisticsTransports(projectNumbers: string[]): Promise<any[]> {
        if (projectNumbers.length === 0) return [];
        const { data, error } = await this.supabase
            .from('logistics_transports')
            .select('*')
            .in('project_number', projectNumbers);

        if (error) {
            console.error('Fetch Logistics Transports Error:', error);
            throw new Error(error.message);
        }
        return data;
    }

    async saveLogisticsTransport(projectNumber: string, transportId: string, data: any): Promise<void> {
        const { data: { user } } = await this.supabase.auth.getUser();

        const payload = {
            project_number: projectNumber,
            transport_id: transportId,
            data: data,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };

        const { error } = await this.supabase
            .from('logistics_transports')
            .upsert(payload, { onConflict: 'project_number, transport_id' });

        if (error) {
            console.error('Save Logistics Transport Error:', error);
            throw new Error(error.message);
        }
    }
}
