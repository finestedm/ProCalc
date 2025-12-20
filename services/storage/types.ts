import { CalculationData } from '../../types';

// Matches the user's Supabase table structure
export interface SavedCalculation {
    id: string;
    created_at: string;
    specialist: string;
    engineer: string;
    engineer_id: string | null; // [NEW] Link to users.id
    customer_name: string;
    project_id: string; // [NEW] Added for project grouping
    order_date: string | null; // ISO Timestamp or YYYY-MM-DD
    close_date: string | null; // ISO Timestamp or YYYY-MM-DD
    total_cost: number;
    total_price: number;
    specialist_id: string | null; // [NEW] Link to users.id
    sales_person_1_id: string | null;
    sales_person_2_id: string | null;
    is_locked: boolean; // [NEW] Locking mechanism
    logistics_status: 'PENDING' | 'PROCESSED' | null; // [NEW] Logistics processing status
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
    lockProject(projectId: string, isLocked: boolean): Promise<void>;
    isProjectLocked(projectId: string): Promise<boolean>;
    updateLogisticsStatus(id: string, status: 'PENDING' | 'PROCESSED' | null): Promise<void>;

    // Access Requests
    createAccessRequest(calculationId: string, message?: string): Promise<void>;
    getPendingAccessRequests(): Promise<AccessRequest[]>;
    updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void>;

    /**
     * Partially updates the 'calc' JSONB column by merging new data.
     * Useful for real-time logistics updates without full appState save.
     */
    updateCalculation(id: string, partialData: any): Promise<void>;

    // Logistics Overrides
    getLogisticsTransports(projectNumbers: string[]): Promise<any[]>;
    saveLogisticsTransport(projectNumber: string, transportId: string, data: any): Promise<void>;
}
