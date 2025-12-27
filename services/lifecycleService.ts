import { CalculationData, Currency, CalculationMode } from '../types';
import { calculateProjectCosts } from '../services/calculationService';

export interface ApprovalResult {
    approved: boolean;
    reasons: string[];
}

export const STAGE_LABELS: Record<string, string> = {
    'DRAFT': 'SZKIC',
    'PENDING_APPROVAL': 'DO AKCEPTACJI',
    'APPROVED': 'ZATWIERDZONY',
    'OPENING': 'REALIZACJA',
    'FINAL': 'ZAMKNIĘTY',
    'ARCHIVED': 'ARCHIWUM'
};

export const STAGE_COLORS: Record<string, string> = {
    'DRAFT': 'bg-zinc-500',
    'PENDING_APPROVAL': 'bg-amber-500',
    'APPROVED': 'bg-emerald-600',
    'OPENING': 'bg-blue-600',
    'FINAL': 'bg-purple-600',
    'ARCHIVED': 'bg-zinc-800'
};

export const lifecycleService = {
    evaluateAutoApproval: (
        data: CalculationData,
        exchangeRate: number,
        offerCurrency: Currency,
        targetMargin: number,
        manualPrice: number | null
    ): ApprovalResult => {
        const reasons: string[] = [];
        let passed = true;

        // condition 1: Advance payment >= 50%
        const terms = data.paymentTerms;
        const totalAdvance = (terms?.advance1Percent || 0) + (terms?.advance2Percent || 0);
        if (totalAdvance < 50) {
            passed = false;
            reasons.push(`Zaliczka wynosi ${totalAdvance}% (wymagane min. 50%)`);
        }

        // condition 2: Total Value < 100,000 EUR
        // Calculate Total Cost first
        const costs = calculateProjectCosts(
            data,
            exchangeRate,
            offerCurrency,
            CalculationMode.INITIAL,
            1.6, // Default ORM Fee
            targetMargin,
            manualPrice // Pass manualPrice for correct financing calc if applicable
        );

        const totalCost = costs.total;

        // Calculate Final Price & Effective Margin
        let finalPrice = 0;
        let effectiveMargin = 0;

        if (manualPrice !== null && manualPrice !== undefined) {
            // Case A: Manual Price
            finalPrice = manualPrice;
            // Margin = (Price - Cost) / Price
            if (finalPrice > 0) {
                effectiveMargin = ((finalPrice - totalCost) / finalPrice) * 100;
            } else {
                effectiveMargin = -100; // Zero price = Loss
            }
        } else {
            // Case B: Target Margin
            // Price = Cost / (1 - Margin%)
            effectiveMargin = targetMargin;
            const marginDecimal = targetMargin / 100;
            if (marginDecimal < 1) {
                finalPrice = totalCost / (1 - marginDecimal);
            } else {
                finalPrice = totalCost; // specific edge case
            }
        }

        // Convert Price to EUR for threshold check

        // Convert Price to EUR for threshold check
        let finalPriceEUR = 0;
        if (offerCurrency === Currency.EUR) {
            finalPriceEUR = finalPrice;
        } else {
            finalPriceEUR = finalPrice / (exchangeRate || 4.3);
        }

        if (finalPriceEUR >= 100000) {
            passed = false;
            reasons.push(`Wartość projektu > 100,000 EUR (${finalPriceEUR.toFixed(0)} EUR)`);
        }

        // condition 3: Final Payment Term <= 14 days
        if ((terms?.finalPaymentDays || 0) > 14) {
            passed = false;
            reasons.push(`Termin płatności końcowej > 14 dni (${terms?.finalPaymentDays} dni)`);
        }

        // condition 4: Margin >= 7%
        if (effectiveMargin < 7) {
            passed = false;
            reasons.push(`Marża < 7% (${effectiveMargin.toFixed(1)}%)`);
        }

        return {
            approved: passed,
            reasons
        };
    }
};
