


export enum Currency {
  PLN = 'PLN',
  EUR = 'EUR'
}

export enum CalculationMode {
  INITIAL = 'INITIAL',
  FINAL = 'FINAL'
}

export enum Language {
  PL = 'PL',
  EN = 'EN'
}

export enum SupplierStatus {
  TO_ORDER = 'TO_ORDER', // Do zamówienia
  ORDERED = 'ORDERED'    // Zamówione
}

export enum ViewMode {
  CALCULATOR = 'CALCULATOR',
  LOGISTICS = 'LOGISTICS',
  COMPARISON = 'COMPARISON',
  NOTES = 'NOTES',
  DOCUMENTS = 'DOCUMENTS'
}

export type ProjectStage = 'DRAFT' | 'OPENING' | 'FINAL';

export interface AddressData {
  name: string;
  street: string;
  city: string;
  zip: string;
  nip: string; 
  clientId: string;
  projectId: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

export interface ProjectMeta {
  orderNumber: string;
  orderDate: string;
  protocolDate: string;
  projectNumber: string;
  sapProjectNumber: string;
  salesPerson: string;
  assistantPerson: string;
}

export interface SupplierItem {
  id: string;
  itemDescription: string;
  componentNumber: string;
  quantity: number;
  weight: number; 
  unitPrice: number; // This is List Price if ORM
  timeMinutes?: number; // ORM Time from Column M
  isExcluded?: boolean; // What-if exclusion
}

export interface Supplier {
  id: string;
  groupId?: string; // ID used to group tabs visually (e.g. from same ORM file)
  name: string; // Official Vendor Name
  customTabName?: string; // Custom Display Name for Tab
  offerNumber: string;
  offerDate: string;
  deliveryDate: string;
  currency: Currency;
  discount: number;
  language: Language;
  items: SupplierItem[];
  isOrm?: boolean;
  status: SupplierStatus;
  isIncluded?: boolean; 
  notes?: string;
  finalCostOverride?: number; // For Final Calculation Mode
  finalVendorName?: string;   // Actual provider name on invoice
  isManualFinal?: boolean;    // Added manually in Final Calculation stage
  
  // Address Data for Orders
  street?: string;
  zip?: string;
  city?: string;
  nip?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

// --- SHEET TYPES ---
export interface SheetCell {
    value: string; // The raw input (e.g., "=A1*2" or "100")
    result?: number | string; // The calculated result
}

export interface SheetRow {
    id: string;
    cells: Record<string, SheetCell>; // Key is column ID (A, B, C...)
}

export interface SheetData {
    columns: string[]; // ['A', 'B', 'C'...]
    rows: SheetRow[];
    selectedCell?: { rowId: string, colId: string };
}

export interface OtherCostItem {
  id: string;
  description: string;
  price: number;
  currency: Currency;
  isExcluded?: boolean;       // What-if exclusion
  finalCostOverride?: number; // For Final Calculation Mode
  finalCurrency?: Currency;   // Currency of the final invoice
  finalVendorName?: string;
  attachedSheet?: SheetData; // If present, price is derived from this sheet
}

// --- SCRATCHPAD TYPE (Legacy support or simple view) ---
export interface ScratchpadRow {
    id: string;
    col1: string; // Description part 1
    col2: string; // Description part 2 / Qty
    col3: string; // Math / Notes
    val: string;  // Value column (intended for numbers)
    isChecked: boolean; // Visual marker
}

export interface TransportItem {
  id: string;
  supplierId?: string; 
  linkedSupplierIds?: string[]; // IDs of suppliers merged into this transport
  name?: string; 
  isOrmCalc: boolean;
  isSupplierOrganized: boolean; 
  isManualOverride?: boolean;
  trucksCount: number;
  manualStoredTrucks?: number; 
  pricePerTruck: number;
  totalPrice: number;
  currency: Currency;
  isExcluded?: boolean;       // What-if exclusion
  finalCostOverride?: number; // For Final Calculation Mode
  finalCurrency?: Currency;   // Currency of the final invoice
  finalVendorName?: string;
}

export interface LinkedSource {
  id: string;
  type: 'ITEM' | 'GROUP';
}

export interface CustomInstallationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  isExcluded?: boolean; 
  // Linking logic for auto-quantity
  linkedSources?: LinkedSource[]; // Array of linked sources
  isAutoQuantity?: boolean; // If true, quantity is strictly bound to source. If false, it was manually overridden.
}

export interface FinalInstallationItem {
  id: string;
  description: string;
  price: number;
  currency: Currency;
  vendorName: string;
  category: 'LABOR' | 'RENTAL';
}

export type InstallationCalcMethod = 'PALLETS' | 'TIME' | 'BOTH';

export interface InstallationStage {
  id: string;
  name: string; // e.g. "Etap 1 - Regały", "Etap 2 - Antresola"
  linkedSupplierIds: string[]; // Suppliers included in this stage
  calcMethod: InstallationCalcMethod;
  
  // Pallet Method Params
  palletSpots: number;
  palletSpotPrice: number;
  palletSpotsPerDay: number; 

  // Time Method Params
  workDayHours: number;
  installersCount: number;
  manDayRate: number;
  manualLaborHours: number; // Extra hours added manually

  // Equipment & Custom Items (Per Stage)
  forkliftDailyRate: number; 
  forkliftDays: number;      
  forkliftTransportPrice: number;
  forkliftProvider?: string;

  scissorLiftDailyRate: number; 
  scissorLiftDays: number;      
  scissorLiftTransportPrice: number;
  scissorLiftProvider?: string;

  customItems: CustomInstallationItem[];

  // Calculated properties (helpers)
  calculatedCost: number;
  calculatedDuration: number;

  // Variant Exclusion Flags
  isExcluded?: boolean;
}

export interface InstallationData {
  calcMethod?: InstallationCalcMethod; // Legacy/Global switch (kept for types compatibility if needed)
  
  stages: InstallationStage[]; 

  // Global fields (Legacy or General Ryczałt)
  otherInstallationCosts: number;
  
  finalCostOverride?: number; // Legacy global override (backwards compatibility)
  finalInstallationCosts?: FinalInstallationItem[]; // Granular final costs

  // Legacy fields (kept to avoid immediate breaking, though logic moves to stages)
  palletSpots: number; 
  palletSpotPrice: number;
  palletSpotsPerDay: number;
  workDayHours: number;
  installersCount: number;
  manDayRate: number;
  manualLaborHours: number;
  
  // Legacy global equipment fields (kept for type safety during migration)
  forkliftDailyRate: number; 
  forkliftDays: number;
  forkliftTransportPrice: number; 
  scissorLiftDailyRate: number; 
  scissorLiftDays: number;
  scissorLiftTransportPrice: number; 
  customItems: CustomInstallationItem[];
}

export interface ProjectTask {
  id: string;
  text: string;
  isCompleted: boolean;
}

// --- VARIANTS SYSTEM ---

export type VariantItemType = 'SUPPLIER_ITEM' | 'TRANSPORT' | 'OTHER' | 'INSTALLATION' | 'STAGE';
export type VariantStatus = 'NEUTRAL' | 'INCLUDED' | 'EXCLUDED';

export interface VariantItem {
    id: string; // The ID of the item in its respective list
    type: VariantItemType;
    originalDescription?: string; // Snapshot for display
}

export interface ProjectVariant {
    id: string;
    name: string;
    status: VariantStatus; // Logic State (Tri-state)
    items: VariantItem[];
}

export interface PaymentTerms {
  advance1Percent: number;
  advance1Days: number; // Days from order
  advance2Percent: number;
  advance2Days: number; // Days from order
  finalPaymentDays: number; // Days from invoice
}

export interface GlobalSettings {
    ormFeePercent: number; // e.g. 1.6
    truckLoadCapacity: number; // e.g. 22000 kg
    defaultSalesPerson?: string;
    defaultSupportPerson?: string;
}

export interface CalculationData {
  payer: AddressData;
  recipient: AddressData;
  orderingParty: AddressData;
  meta: ProjectMeta;
  suppliers: Supplier[];
  transport: TransportItem[];
  otherCosts: OtherCostItem[];
  otherCostsScratchpad?: ScratchpadRow[]; // Legacy field kept for compatibility
  installation: InstallationData;
  nameplateQty: number;
  tasks: ProjectTask[];
  projectNotes: string;
  variants: ProjectVariant[]; // Global list of variants
  paymentTerms?: PaymentTerms;
}

export interface AppState {
  initial: CalculationData;
  final: CalculationData;
  mode: CalculationMode;
  viewMode: ViewMode;
  exchangeRate: number;
  offerCurrency: Currency; 
  clientCurrency: Currency; 
  targetMargin: number;
  manualPrice: number | null;
  globalSettings: GlobalSettings;
}

export interface HistoryEntry {
  timestamp: number;
  state: AppState;
  description: string;
  changes?: string[]; // Detailed list of changes
}

export interface ProjectFile {
  version: string;
  timestamp: number;
  stage: ProjectStage;
  appState: AppState;
  historyLog: HistoryEntry[];
  past: AppState[];
  future: AppState[];
}

export const EMPTY_ADDRESS: AddressData = {
  name: '', street: '', city: '', zip: '', nip: '', clientId: '', projectId: '', email: '', phone: '', contactPerson: ''
};

export const EMPTY_META: ProjectMeta = {
  orderNumber: '', orderDate: '', protocolDate: '', projectNumber: '', sapProjectNumber: '', salesPerson: '', assistantPerson: ''
};

export const EMPTY_INSTALLATION: InstallationData = {
  calcMethod: 'PALLETS',
  stages: [],
  palletSpots: 0, 
  palletSpotPrice: 0, 
  palletSpotsPerDay: 0,
  workDayHours: 10,
  installersCount: 2,
  manDayRate: 0,
  manualLaborHours: 0,
  forkliftDailyRate: 0, 
  forkliftDays: 0,
  forkliftTransportPrice: 0, 
  scissorLiftDailyRate: 0, 
  scissorLiftDays: 0,
  scissorLiftTransportPrice: 0, 
  otherInstallationCosts: 0,
  customItems: [],
  finalInstallationCosts: []
};

export const EMPTY_PAYMENT_TERMS: PaymentTerms = {
  advance1Percent: 30,
  advance1Days: 7,
  advance2Percent: 0,
  advance2Days: 0,
  finalPaymentDays: 14
};

export const DEFAULT_SETTINGS: GlobalSettings = {
    ormFeePercent: 1.6,
    truckLoadCapacity: 22000,
    defaultSalesPerson: '',
    defaultSupportPerson: ''
};

export const EMPTY_CALCULATION: CalculationData = {
  payer: { ...EMPTY_ADDRESS },
  recipient: { ...EMPTY_ADDRESS },
  orderingParty: { ...EMPTY_ADDRESS },
  meta: { ...EMPTY_META },
  suppliers: [],
  transport: [],
  otherCosts: [],
  otherCostsScratchpad: [],
  installation: { ...EMPTY_INSTALLATION },
  nameplateQty: 0,
  tasks: [],
  projectNotes: '',
  variants: [],
  paymentTerms: { ...EMPTY_PAYMENT_TERMS }
};
