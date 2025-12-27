

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
  DOCUMENTS = 'DOCUMENTS',
  DASHBOARD = 'DASHBOARD'
}

export type ProjectStage = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'OPENING' | 'FINAL';

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
  salesPerson: string; // Now "Inżynier"
  salesPersonId?: string; // [NEW] DB ID
  assistantPerson: string; // Now "Specjalista"
  assistantPersonId?: string; // [NEW] DB ID
  actualSalesPerson?: string; // "Handlowiec 1"
  actualSalesPersonId?: string; // [NEW] DB ID
  actualSalesPersonPercentage?: number; // % share
  actualSalesPerson2?: string; // "Handlowiec 2"
  actualSalesPerson2Id?: string; // [NEW] DB ID
  actualSalesPerson2Percentage?: number; // % share
  installationType?: string;
  invoiceText?: string;
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
  extraMarkupPercent?: number; // New field for manual +/- adjustment
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

export interface TruckDetail {
  id: string;
  loadingDates?: string;       // Can be "YYYY-MM-DD" or "YYYY-MM-DD - YYYY-MM-DD"
  deliveryDate?: string;
  driverInfo?: string;         // Name, Phone
  registrationNumbers?: string; // Car, Trailer
  transportCompany?: string;   // [NEW]
  notes?: string;
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

  // Logistics Hub Fields
  confirmedDeliveryDate?: string; // For Vendor-organized
  pickupDate?: string;           // For Logistics-organized
  weight?: number;               // Current total weight
  ldm?: number;                  // Loading meters
  carrier?: string;              // Carrier company name
  confirmedPrice?: number;       // [NEW] Actual cost from logistician
  transitTime?: string;          // e.g. "2 days"

  // Multi-truck support
  trucks?: TruckDetail[];
  isStale?: boolean;
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
  parentId?: string; // For hierarchical grouping
  isCollapsed?: boolean; // UI state for grouping
  itemUnitPrices?: Record<string, number>; // Map of Source ID -> Assembly Price Per Unit (for packages)
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
  // Flags for UI visibility
  hasForklift?: boolean;
  hasScissorLift?: boolean;

  forkliftDailyRate: number;
  forkliftDays: number;
  forkliftStartOffset?: number; // Days after stage start
  forkliftTransportPrice: number;
  forkliftProvider?: string;

  scissorLiftDailyRate: number;
  scissorLiftDays: number;
  scissorLiftStartOffset?: number; // Days after stage start
  scissorLiftTransportPrice: number;
  scissorLiftProvider?: string;

  customItems: CustomInstallationItem[];

  // Calculated properties (helpers)
  calculatedCost: number;
  calculatedDuration: number;

  // Variant Exclusion Flags
  isExcluded?: boolean;

  // Scheduling (Gantt)
  startDate?: string;
  endDate?: string;
}

export interface CustomTimelineItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
  type: 'finish-to-start'; // Extensible for later
}

export interface InstallationData {
  calcMethod?: InstallationCalcMethod; // Legacy/Global switch (kept for types compatibility if needed)

  stages: InstallationStage[];
  customTimelineItems: CustomTimelineItem[]; // Manual items on Gantt
  dependencies: Dependency[]; // Links between stages/items

  // Global fields (Legacy or General Ryczałt)
  otherInstallationCosts: number;

  finalCostOverride?: number; // Legacy global override (backwards compatibility)
  finalInstallationCosts?: FinalInstallationItem[]; // Granular final costs

  // Planning Dates (Logistics)
  plannedStart?: string;
  plannedEnd?: string;

  // Legacy fields (kept for type safety during migration)
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
  dueDate?: string; // YYYY-MM-DD
  linkedItemId?: string; // ID of the Gantt row (Stage, Supplier, etc.)
  linkedItemType?: string; // Type of linked item
  reminderShown?: boolean; // Track if notification was triggered
}

// --- VARIANTS SYSTEM ---

export type VariantItemType = 'SUPPLIER_ITEM' | 'TRANSPORT' | 'OTHER' | 'INSTALLATION' | 'STAGE' | 'CUSTOM_INSTALLATION_ITEM';
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
  // Hierarchy Support
  parentId?: string;
  isCollapsed?: boolean;
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

// A subset of CalculationData that changes between scenarios/tabs
export interface CalculationScenario {
  id: string;
  name: string;
  // Specific Fields
  suppliers: Supplier[];
  transport: TransportItem[];
  otherCosts: OtherCostItem[];
  otherCostsScratchpad: ScratchpadRow[];
  installation: InstallationData;
  nameplateQty: number;
  tasks: ProjectTask[];
  projectNotes: string;
  variants: ProjectVariant[];
  paymentTerms: PaymentTerms;
}

// [NEW] Approval Request Context
export interface ApprovalRequest {
  requesterId?: string;
  requesterName?: string;
  requestDate: string;
  reasons: string[];
  message?: string;
}

export interface AppState {
  initial: CalculationData;
  final: CalculationData;
  scenarios: CalculationScenario[]; // List of available initial scenarios
  activeScenarioId: string; // ID of the currently active initial scenario
  mode: CalculationMode;
  stage: ProjectStage; // Added Stage Tracking
  approvalRequest?: ApprovalRequest; // [NEW] Store approval context
  viewMode: ViewMode;
  exchangeRate: number;
  offerCurrency: Currency;
  clientCurrency: Currency;
  targetMargin: number;
  manualPrice: number | null; // For Initial Calculation override
  finalManualPrice: number | null; // For Final Calculation override
  globalSettings: GlobalSettings;
  activeHubTab?: 'DASH' | 'LOGISTICS';
  isLocked?: boolean; // [NEW] Controls editability of Initial Calculation
  activeCalculationId?: string; // [NEW] ID of the cloud-saved calculation
  logisticsStatus?: 'PENDING' | 'PROCESSED' | null; // [NEW] Status for logistics
  logistics_operator_id?: string | null; // [NEW] User ID of the logistician who took over
}

export interface HistoryEntry {
  timestamp: number;
  state: AppState;
  description: string;
  changes?: string[]; // Detailed list of changes
}

export interface ProjectFile {
  id?: string; // [NEW] Cloud ID for persistence
  version: string;
  timestamp: number;
  stage: ProjectStage;
  appState: AppState;
  historyLog: HistoryEntry[];
  past: AppState[];
  future: AppState[];
}

// Cost Breakdown including new Financing field
export interface CostBreakdown {
  suppliers: number;
  transport: number;
  other: number;
  installation: number;
  ormFee: number;
  financing: number; // New Field: Koszty finansowania
  total: number;
  excluded: number;
}

export const EMPTY_ADDRESS: AddressData = {
  name: '', street: '', city: '', zip: '', nip: '', clientId: '', projectId: '', email: '', phone: '', contactPerson: ''
};

export const EMPTY_META: ProjectMeta = {
  orderNumber: '', orderDate: '', protocolDate: '', projectNumber: '', sapProjectNumber: '', salesPerson: '', assistantPerson: '', actualSalesPerson: '', actualSalesPersonPercentage: 100, actualSalesPerson2: '', actualSalesPerson2Percentage: 0,
  installationType: '', invoiceText: ''
};

export const EMPTY_INSTALLATION: InstallationData = {
  calcMethod: 'PALLETS',
  stages: [], // Default empty stages
  customTimelineItems: [],
  dependencies: [],
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