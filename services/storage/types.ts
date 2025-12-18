import { CalculationData } from '../../types';

// Matches the user's Supabase table structure
export interface SavedCalculation {
    id: string;
    created_at: string;
    specialist: string;
    engineer: string;
    customer_name: string;
    project_id: string; // [NEW] Added for project grouping
    order_date: string | null; // ISO Timestamp or YYYY-MM-DD
    close_date: string | null; // ISO Timestamp or YYYY-MM-DD
    total_cost: number;
    total_price: number;
    calc: CalculationData; // The JSON blob
}

export interface ICalculationStorage {
    // We pass calculated values solely for the "search columns" in the DB.
    // The full state is in 'data'.
    saveCalculation(data: CalculationData, summary: { totalCost: number, totalPrice: number }): Promise<string>;
    getCalculations(): Promise<SavedCalculation[]>;
    deleteCalculation(id: string): Promise<void>;
}
