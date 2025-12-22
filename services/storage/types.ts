import { CalculationData, TransportItem } from '../../types';

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
    logistics_operator_id: string | null; // [NEW] ID of the logistics operator assigned
    project_stage: string; // [NEW] For fast metadata listing
    project_notes: string; // [NEW] Dedicated column for fast notes access
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

// Metadata-only version of the calculation (no heavy JSON)
export interface SavedCalculationMetadata extends Omit<SavedCalculation, 'calc'> { }

export interface ICalculationStorage {
    // We pass calculated values solely for the "search columns" in the DB.
    // The full state is in 'data'.
    saveCalculation(data: any, summary: { totalCost: number, totalPrice: number }): Promise<string>;
    getCalculations(): Promise<SavedCalculation[]>;
    getCalculationsMetadata(): Promise<SavedCalculationMetadata[]>;
    getCalculationById(id: string): Promise<SavedCalculation | null>;
    deleteCalculation(id: string): Promise<void>;
    setLockState(id: string, isLocked: boolean): Promise<void>;
    lockProject(projectId: string, isLocked: boolean): Promise<void>;
    isProjectLocked(projectId: string): Promise<boolean>;
    updateLogisticsStatus(id: string, status: 'PENDING' | 'PROCESSED' | null): Promise<void>;
    updateLogisticsOperator(id: string, operatorId: string | null): Promise<void>;
    getInstallationStages(calculationIds: string[]): Promise<any[]>;

    // Access Requests
    createAccessRequest(calculationId: string, message?: string): Promise<void>;
    getPendingAccessRequests(): Promise<AccessRequest[]>;
    updateAccessRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void>;


    /**
     * Partially updates the 'calc' JSONB column by merging new data.
     * Useful for real-time logistics updates without full appState save.
     */
    updateCalculation(id: string, partialData: any): Promise<void>;

    // Logistics Transports (Relational)
    getLogisticsTransports(projectNumbers?: string[]): Promise<SavedLogisticsTransport[]>; // Nullable projectNumbers -> fetch all
    saveLogisticsTransport(transport: Partial<SavedLogisticsTransport>): Promise<void>;
}

export interface SavedLogisticsTransport {
    id?: string;
    project_number: string;
    transport_id: string;
    calc_id?: string;
    supplier_id?: string;
    carrier?: string;
    delivery_date?: string; // YYYY-MM-DD
    pickup_date?: string;   // YYYY-MM-DD
    data: TransportItem;
    updated_at?: string;
}
