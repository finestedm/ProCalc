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
    is_locked: boolean; // [NEW] Locking mechanism
    calc: CalculationData; // The JSON blob
    user_id: string; // [NEW] ID of the user who saved it
    user?: {
        full_name: string;
    };
}

export interface AccessRequest {
    id: string;
    calculation_id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'rejected';
    message?: string;
    created_at: string;
    user?: {
        full_name: string;
    };
    calculation?: {
        project_id: string;
        customer_name: string;
    };
}

export interface ICalculationStorage {
    // We pass calculated values solely for the "search columns" in the DB.
    // The full state is in 'data'.
    saveCalculation(data: CalculationData, summary: { totalCost: number, totalPrice: number }): Promise<string>;
    getCalculations(): Promise<SavedCalculation[]>;
    deleteCalculation(id: string): Promise<void>;
    setLockState(id: string, isLocked: boolean): Promise<void>;

    // Access Requests
    createAccessRequest(calculationId: string, message?: string): Promise<void>;
    getPendingAccessRequests(): Promise<AccessRequest[]>;
    updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void>;
}
