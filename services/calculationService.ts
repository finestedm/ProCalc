




import { CalculationData, Currency, CalculationMode, InstallationStage } from '../types';

export const convert = (amount: number, from: Currency, to: Currency, rate: number) => {
    if (amount === 0) return 0;
    if (from === to) return amount;
    if (from === Currency.EUR && to === Currency.PLN) return amount * rate;
    if (from === Currency.PLN && to === Currency.EUR) return amount / rate;
    return amount;
};

export interface CostBreakdown {
    suppliers: number;
    transport: number;
    other: number;
    installation: number;
    total: number;
    excluded: number; // Value of excluded items (What-If)
}

// Helper to calculate cost of a single stage (without converting currency yet)
// Now returns Total Stage Cost including Equipment and Custom Items
export const calculateStageCost = (stage: InstallationStage, data: CalculationData): number => {
    if (stage.isExcluded) return 0;

    let laborCost = 0;

    // Pallet Calculation part
    if (stage.calcMethod === 'PALLETS' || stage.calcMethod === 'BOTH') {
        laborCost += stage.palletSpots * stage.palletSpotPrice;
    }

    // Time Calculation part
    if (stage.calcMethod === 'TIME' || stage.calcMethod === 'BOTH') {
        let totalMinutes = 0;
        
        // Sum ORM minutes from linked suppliers
        if (stage.linkedSupplierIds && stage.linkedSupplierIds.length > 0) {
            stage.linkedSupplierIds.forEach(suppId => {
                const supplier = data.suppliers.find(s => s.id === suppId);
                if (supplier && supplier.isIncluded !== false) {
                    supplier.items.forEach(i => {
                         if (!i.isExcluded) {
                             totalMinutes += (i.quantity * (i.timeMinutes || 0));
                         }
                    });
                }
            });
        }

        const totalHours = (totalMinutes / 60) + (stage.manualLaborHours || 0);
        const dailyCap = (stage.workDayHours || 10) * (stage.installersCount || 1);
        const days = dailyCap > 0 ? Math.ceil(totalHours / dailyCap) : 0;
        
        // Cost = Days * People * RatePerPersonPerDay
        laborCost += days * (stage.installersCount || 1) * (stage.manDayRate || 0);
    }

    // Equipment Costs (Per Stage)
    const forkliftCost = (stage.forkliftDailyRate * stage.forkliftDays) + stage.forkliftTransportPrice;
    const scissorLiftCost = (stage.scissorLiftDailyRate * stage.scissorLiftDays) + stage.scissorLiftTransportPrice;

    // Custom Items (Per Stage)
    const customItemsCost = stage.customItems.reduce((sum, i) => {
        if (i.isExcluded) return sum;
        return sum + (i.quantity * i.unitPrice);
    }, 0);

    return laborCost + forkliftCost + scissorLiftCost + customItemsCost;
};

export const calculateProjectCosts = (
    data: CalculationData, 
    rate: number, 
    targetCurrency: Currency,
    mode: CalculationMode = CalculationMode.INITIAL
): CostBreakdown => {
    const isFinal = mode === CalculationMode.FINAL;
    let excludedTotal = 0;

    // --- SUPPLIERS ---
    const suppliersTotal = data.suppliers.reduce((total, s) => {
        if (s.isIncluded === false) return total;
        
        let cost = 0;
        if (isFinal && s.finalCostOverride !== undefined && s.finalCostOverride !== null) {
             cost = s.finalCostOverride;
        } else {
            // Standard Calculation
            const sTotal = s.items.reduce((sum, i) => {
                const price = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
                const value = i.quantity * price;

                // Check exclusion (Explicit flag only)
                if (i.isExcluded) {
                    const discountedValue = value * (1 - s.discount / 100);
                    excludedTotal += convert(discountedValue, s.currency, targetCurrency, rate);
                    return sum; // Skip
                }

                return sum + value;
            }, 0);
            cost = sTotal * (1 - s.discount / 100);
        }

        return total + convert(cost, s.currency, targetCurrency, rate);
    }, 0);

    // Nameplate (19 PLN fixed)
    const nameplateCost = convert((data.nameplateQty || 0) * 19, Currency.PLN, targetCurrency, rate);
    
    // --- TRANSPORT ---
    const transportTotal = data.transport.reduce((sum, item) => {
        // Exclude if linked single supplier is excluded
        if (item.supplierId) {
            const supplier = data.suppliers.find(s => s.id === item.supplierId);
            if (supplier && supplier.isIncluded === false) return sum;
        }
        
        // Exclude Consolidated if all linked suppliers are excluded
        if (item.linkedSupplierIds && item.linkedSupplierIds.length > 0) {
            // Check if at least ONE linked supplier is included
            const hasActiveSupplier = item.linkedSupplierIds.some(id => {
                const s = data.suppliers.find(sup => sup.id === id);
                return s && s.isIncluded !== false;
            });
            if (!hasActiveSupplier) return sum;
        }

        let cost = 0;
        let currency = item.currency;

        if (isFinal && item.finalCostOverride !== undefined && item.finalCostOverride !== null) {
            cost = item.finalCostOverride;
            if (item.finalCurrency) currency = item.finalCurrency;
        } else {
            cost = item.totalPrice;
        }
        
        const value = convert(cost, currency, targetCurrency, rate);

        if (item.isExcluded) {
            excludedTotal += value;
            return sum;
        }

        return sum + value;
    }, 0);

    // --- OTHER COSTS ---
    const otherTotal = data.otherCosts.reduce((total, c) => {
        let cost = 0;
        let currency = c.currency;

        if (isFinal && c.finalCostOverride !== undefined && c.finalCostOverride !== null) {
            cost = c.finalCostOverride;
            if (c.finalCurrency) currency = c.finalCurrency;
        } else {
            cost = c.price;
        }
        
        const value = convert(cost, currency, targetCurrency, rate);

        if (c.isExcluded) {
            excludedTotal += value;
            return total;
        }

        return total + value;
    }, 0);

    // --- INSTALLATION ---
    let installationTotal = 0;
    
    if (isFinal && data.installation.finalInstallationCosts && data.installation.finalInstallationCosts.length > 0) {
        installationTotal = data.installation.finalInstallationCosts.reduce((sum, item) => {
            return sum + convert(item.price, item.currency, targetCurrency, rate);
        }, 0);
    } 
    else if (isFinal && data.installation.finalCostOverride !== undefined && data.installation.finalCostOverride !== null) {
        installationTotal = convert(data.installation.finalCostOverride, Currency.PLN, targetCurrency, rate);
    } 
    else {
        const inst = data.installation;
        
        // Sum Stages (which now include Equipment and Custom Items)
        let stagesCost = 0;

        if (inst.stages && inst.stages.length > 0) {
            stagesCost = inst.stages.reduce((sum, stage) => {
                 const sCost = calculateStageCost(stage, data);
                 if (stage.isExcluded) {
                     excludedTotal += convert(sCost, Currency.PLN, targetCurrency, rate);
                     return sum;
                 }
                 return sum + sCost;
            }, 0);
        } else {
            // FALLBACK FOR LEGACY DATA
            // If no stages, we assume old structure. 
            // In a real migration, this shouldn't happen often as app creates default stage.
            // Simplified fallback:
            const labor = inst.calcMethod === 'PALLETS' 
                ? inst.palletSpots * inst.palletSpotPrice 
                : 0; // Simplified time fallback
             
            const equipment = 
                (inst.forkliftDailyRate * inst.forkliftDays) + inst.forkliftTransportPrice +
                (inst.scissorLiftDailyRate * inst.scissorLiftDays) + inst.scissorLiftTransportPrice;
            
            const custom = inst.customItems.reduce((s, i) => s + (i.quantity*i.unitPrice), 0);
            
            stagesCost = labor + equipment + custom;
        }

        const installationPLN = stagesCost + inst.otherInstallationCosts;
        installationTotal = convert(installationPLN, Currency.PLN, targetCurrency, rate);
    }

    return {
        suppliers: suppliersTotal + nameplateCost,
        transport: transportTotal,
        other: otherTotal,
        installation: installationTotal,
        total: suppliersTotal + nameplateCost + transportTotal + otherTotal + installationTotal,
        excluded: excludedTotal
    };
};