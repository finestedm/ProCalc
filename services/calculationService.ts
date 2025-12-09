


import { CalculationData, Currency, CalculationMode, InstallationStage, Supplier, CostBreakdown, EMPTY_PAYMENT_TERMS } from '../types';

export const formatNumber = (value: number, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) return '0,00';
    return value.toLocaleString('pl-PL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true
    });
};

export const formatCurrency = (value: number, currency: string): string => {
    return `${formatNumber(value, 2)} ${currency}`;
};

export const convert = (amount: number, from: Currency, to: Currency, rate: number) => {
    if (amount === 0) return 0;
    if (from === to) return amount;
    if (from === Currency.EUR && to === Currency.PLN) return amount * rate;
    if (from === Currency.PLN && to === Currency.EUR) return amount / rate;
    return amount;
};

// Helper to calculate cost of a single stage (without converting currency yet)
// Now returns Total Stage Cost including Equipment and Custom Items
export const calculateStageCost = (
    stage: InstallationStage, 
    data: { suppliers: Supplier[] }, 
    options: { ignoreExclusions?: boolean } = {}
): number => {
    const { ignoreExclusions = false } = options;

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
                // Check if supplier is active OR if we are ignoring exclusions
                if (supplier && (ignoreExclusions || supplier.isIncluded !== false)) {
                    supplier.items.forEach(i => {
                         // Check if item is active OR if we are ignoring exclusions
                         if (ignoreExclusions || !i.isExcluded) {
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
        if (!ignoreExclusions && i.isExcluded) return sum;
        return sum + (i.quantity * i.unitPrice);
    }, 0);

    return laborCost + forkliftCost + scissorLiftCost + customItemsCost;
};

export const calculateProjectCosts = (
    data: CalculationData, 
    rate: number, 
    targetCurrency: Currency,
    mode: CalculationMode = CalculationMode.INITIAL,
    ormFeePercent: number = 1.6,
    targetMargin?: number, // Optional, required for financing calc
    manualPrice?: number | null // Optional, overrides margin-based price
): CostBreakdown => {
    const isFinal = mode === CalculationMode.FINAL;
    let excludedTotal = 0;
    let ormFeeTotal = 0;
    const ormFeeRate = ormFeePercent / 100;

    // --- SUPPLIERS ---
    const suppliersTotal = data.suppliers.reduce((total, s) => {
        if (s.isIncluded === false) return total;
        
        let cost = 0;
        let supplierOrmFee = 0;

        if (isFinal && s.finalCostOverride !== undefined && s.finalCostOverride !== null) {
             cost = s.finalCostOverride;
             // Even in final mode, if it was an ORM supplier, we assume the fee applies to the final invoice amount
             if (s.isOrm) {
                 supplierOrmFee = cost * ormFeeRate;
             }
        } else {
            // Standard Calculation
            const sTotal = s.items.reduce((sum, i) => {
                const price = s.isOrm ? i.unitPrice * 0.5 : i.unitPrice;
                const value = i.quantity * price;

                // Check exclusion (Explicit flag only)
                if (i.isExcluded) {
                    const discountedValue = value * (1 - s.discount / 100);
                    
                    // If excluded, we save the Material Cost + The Fee that would have been applied
                    let itemExcludedValue = discountedValue;
                    if (s.isOrm) {
                        itemExcludedValue += discountedValue * ormFeeRate;
                    }
                    
                    // Apply extra markup to excluded value for consistency
                    const markupFactor = 1 + (s.extraMarkupPercent || 0) / 100;
                    itemExcludedValue *= markupFactor;
                    
                    excludedTotal += convert(itemExcludedValue, s.currency, targetCurrency, rate);
                    return sum; // Skip adding to current total
                }

                return sum + value;
            }, 0);
            
            // 1. Apply Discount
            const discountedCost = sTotal * (1 - s.discount / 100);
            
            // 2. Apply Extra Adjustment (Markup/Markdown)
            const markupFactor = 1 + (s.extraMarkupPercent || 0) / 100;
            cost = discountedCost * markupFactor;

            if (s.isOrm) {
                supplierOrmFee = cost * ormFeeRate;
            }
        }

        // Add ORM fee to total fee accumulator (converted to target currency)
        if (supplierOrmFee > 0) {
            ormFeeTotal += convert(supplierOrmFee, s.currency, targetCurrency, rate);
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
                 // Active Cost: Respects exclusions (If supplier is gone, we don't pay to install it)
                 const sCost = calculateStageCost(stage, data, { ignoreExclusions: false });
                 
                 if (stage.isExcluded) {
                     const excludedCost = calculateStageCost(stage, data, { ignoreExclusions: true });
                     excludedTotal += convert(excludedCost, Currency.PLN, targetCurrency, rate);
                     return sum;
                 }
                 return sum + sCost;
            }, 0);
        } else {
            // FALLBACK FOR LEGACY DATA
            const labor = inst.calcMethod === 'PALLETS' 
                ? inst.palletSpots * inst.palletSpotPrice 
                : 0; 
             
            const equipment = 
                (inst.forkliftDailyRate * inst.forkliftDays) + inst.forkliftTransportPrice +
                (inst.scissorLiftDailyRate * inst.scissorLiftDays) + inst.scissorLiftTransportPrice;
            
            const custom = inst.customItems.reduce((s, i) => s + (i.quantity*i.unitPrice), 0);
            
            stagesCost = labor + equipment + custom;
        }

        const installationPLN = stagesCost + inst.otherInstallationCosts;
        installationTotal = convert(installationPLN, Currency.PLN, targetCurrency, rate);
    }

    // --- FINANCING COSTS (NEW) ---
    // Only calculate if targetMargin is provided (avoids breaking simple usage)
    let financingCost = 0;
    const paymentTerms = data.paymentTerms || EMPTY_PAYMENT_TERMS;
    
    // Threshold: 14 days
    // Rate: 7.5% per annum
    const extraDays = Math.max(0, paymentTerms.finalPaymentDays - 14);
    
    if (extraDays > 0 && targetMargin !== undefined) {
        const baseCost = suppliersTotal + nameplateCost + transportTotal + otherTotal + installationTotal + ormFeeTotal;
        const interestAnnualRate = 0.075;
        const interestFactor = (interestAnnualRate * extraDays) / 365;
        const unpaidRatio = 1 - ((paymentTerms.advance1Percent + paymentTerms.advance2Percent) / 100);

        if (manualPrice !== null && manualPrice !== undefined) {
            // Case 1: Manual Price (Fixed Price)
            // Financing is calculated based on the fixed price's unpaid portion
            // F = P * R * I
            financingCost = manualPrice * unpaidRatio * interestFactor;
        } else {
            // Case 2: Target Margin (Price is dynamic)
            // P = C / (1 - M - R*I)
            // Where C = BaseCost, M = TargetMargin, R = UnpaidRatio, I = InterestFactor
            // Financing Cost F = P * R * I
            // Or simpler: F = P - C - (P * M) ... but we need P first.
            
            const marginDecimal = targetMargin / 100;
            const divisor = 1 - marginDecimal - (unpaidRatio * interestFactor);
            
            if (divisor > 0) {
                const projectedPrice = baseCost / divisor;
                financingCost = projectedPrice * unpaidRatio * interestFactor;
            } else {
                // Edge case: Divisor too small/negative (unrealistic inputs), fallback to 0 or base calculation to prevent crash
                financingCost = 0;
            }
        }
    }

    return {
        suppliers: suppliersTotal + nameplateCost,
        transport: transportTotal,
        other: otherTotal,
        installation: installationTotal,
        ormFee: ormFeeTotal,
        financing: financingCost,
        total: suppliersTotal + nameplateCost + transportTotal + otherTotal + installationTotal + ormFeeTotal + financingCost,
        excluded: excludedTotal
    };
};
