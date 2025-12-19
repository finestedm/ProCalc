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

        // Mapping to User's specific table columns
        const payload = {
            user_id: user.id, // Associate with current user
            specialist: meta.assistantPerson || '',
            engineer: meta.salesPerson || '',
            customer_name: orderingParty.name || 'Unknown',
            project_id: meta.projectNumber || 'BezNumeru', // [NEW] Supporting the new column
            order_date: meta.orderDate || null,
            close_date: meta.protocolDate || null,
            total_cost: summary.totalCost,
            total_price: summary.totalPrice,
            is_locked: appState?.isLocked || false, // [NEW] Persist lock state
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

        if (count === 0) {
            console.warn('No rows were deleted. This might be due to RLS policies or an incorrect ID.');
        }
    }

    async setLockState(id: string, isLocked: boolean): Promise<void> {
        // 1. Fetch the current calculation to get the JSON blob
        const { data: calcRow, error: fetchError } = await this.supabase
            .from(this.tableName)
            .select('calc')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Supabase Fetch for Lock Error:', fetchError);
            throw new Error(fetchError.message);
        }

        // 2. Update the JSON blob's lock state
        const updatedCalc = { ...calcRow.calc };
        if (updatedCalc.appState) {
            updatedCalc.appState.isLocked = isLocked;
        } else {
            // If it's a flat CalculationData, it might not have appState.
            // But usually we save ProjectFile which has appState.
            updatedCalc.isLocked = isLocked;
        }

        // 3. Update both the column and the JSON blob
        const { error: updateError } = await this.supabase
            .from(this.tableName)
            .update({
                is_locked: isLocked,
                calc: updatedCalc
            })
            .eq('id', id);

        if (updateError) {
            console.error('Supabase Lock Error:', updateError);
            throw new Error(updateError.message);
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

        // 2. If approved, unlock the calculation
        if (status === 'approved' && request) {
            await this.setLockState(request.calculation_id, false);
        }
    }
}
