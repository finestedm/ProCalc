/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CalculationData } from '../../types';
import { ICalculationStorage, SavedCalculation } from './types';

export class SupabaseStorage implements ICalculationStorage {
    private supabase: SupabaseClient | null = null;
    private tableName = 'calculations';

    constructor() {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } else {
            console.warn('Supabase credentials not found. Storage will not work.');
        }
    }

    async saveCalculation(data: any, summary: { totalCost: number, totalPrice: number }): Promise<string> {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized. Database connection missing.');
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
            specialist: meta.assistantPerson || '',
            engineer: meta.salesPerson || '',
            customer_name: orderingParty.name || 'Unknown',
            project_id: meta.projectNumber || 'BezNumeru', // [NEW] Supporting the new column
            order_date: meta.orderDate || null,
            close_date: meta.protocolDate || null,
            total_cost: summary.totalCost,
            total_price: summary.totalPrice,
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
        if (!this.supabase) return [];

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase Fetch Error:', error);
            throw new Error(error.message);
        }

        return data as SavedCalculation[];
    }

    async deleteCalculation(id: string): Promise<void> {
        if (!this.supabase) throw new Error('Supabase client not initialized');

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
}
