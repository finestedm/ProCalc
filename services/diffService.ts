
import { AppState, CalculationData, CalculationMode } from '../types';

export const generateDiff = (oldState: AppState, newState: AppState): string[] => {
    const changes: string[] = [];

    // 1. Compare Global Settings
    if (oldState.exchangeRate !== newState.exchangeRate) {
        changes.push(`Zmiana kursu EUR: ${oldState.exchangeRate} -> ${newState.exchangeRate}`);
    }
    if (oldState.targetMargin !== newState.targetMargin) {
        changes.push(`Zmiana marży: ${oldState.targetMargin}% -> ${newState.targetMargin}%`);
    }
    if (oldState.manualPrice !== newState.manualPrice) {
        if (newState.manualPrice === null) changes.push("Wyłączono ręczną cenę (powrót do marży)");
        else changes.push(`Zmiana ceny ręcznej: ${newState.manualPrice}`);
    }
    if (oldState.offerCurrency !== newState.offerCurrency) {
        changes.push(`Zmiana waluty oferty: ${oldState.offerCurrency} -> ${newState.offerCurrency}`);
    }

    // Helper to compare CalculationData
    const compareData = (oldD: CalculationData, newD: CalculationData, labelPrefix: string) => {
        
        // Metadata
        if (oldD.meta.projectNumber !== newD.meta.projectNumber) changes.push(`${labelPrefix}Zmiana nr projektu: ${newD.meta.projectNumber}`);
        if (oldD.nameplateQty !== newD.nameplateQty) changes.push(`${labelPrefix}Zmiana ilości tabliczek: ${oldD.nameplateQty} -> ${newD.nameplateQty}`);

        // Suppliers
        newD.suppliers.forEach(newS => {
            const oldS = oldD.suppliers.find(s => s.id === newS.id);
            if (!oldS) {
                changes.push(`${labelPrefix}Dodano dostawcę: ${newS.name}`);
            } else {
                if (oldS.discount !== newS.discount) changes.push(`${labelPrefix}Rabat dostawcy ${newS.name}: ${oldS.discount}% -> ${newS.discount}%`);
                if (oldS.extraMarkupPercent !== newS.extraMarkupPercent) changes.push(`${labelPrefix}Korekta dostawcy ${newS.name}: ${oldS.extraMarkupPercent || 0}% -> ${newS.extraMarkupPercent || 0}%`);
                if (oldS.deliveryDate !== newS.deliveryDate) changes.push(`${labelPrefix}Zmiana daty dostawy ${newS.name}: ${newS.deliveryDate}`);
                if (oldS.notes !== newS.notes) changes.push(`${labelPrefix}Zmiana uwag dla ${newS.name}`);
                if (oldS.isIncluded !== newS.isIncluded) changes.push(`${labelPrefix}${newS.isIncluded ? 'Włączono' : 'Wyłączono'} dostawcę: ${newS.name}`);
                
                // Items
                if (oldS.items.length !== newS.items.length) {
                    const diff = newS.items.length - oldS.items.length;
                    changes.push(`${labelPrefix}Dostawca ${newS.name}: ${diff > 0 ? 'Dodano' : 'Usunięto'} pozycje (${Math.abs(diff)})`);
                } else {
                    // Check deeply for specific item changes (simplified: check totals)
                    // Checking every field might be too verbose, checking descriptions and quantities
                    newS.items.forEach((newItem, idx) => {
                        const oldItem = oldS.items.find(i => i.id === newItem.id);
                        if(oldItem) {
                            if(oldItem.quantity !== newItem.quantity) changes.push(`${labelPrefix}Zmiana ilości [${newItem.itemDescription || 'element'}]: ${oldItem.quantity} -> ${newItem.quantity}`);
                            if(oldItem.unitPrice !== newItem.unitPrice) changes.push(`${labelPrefix}Zmiana ceny [${newItem.itemDescription || 'element'}]: ${oldItem.unitPrice} -> ${newItem.unitPrice}`);
                            if(oldItem.isExcluded !== newItem.isExcluded) changes.push(`${labelPrefix}${newItem.isExcluded ? 'Wyłączono' : 'Włączono'} element: ${newItem.itemDescription}`);
                        }
                    });
                }
            }
        });
        if (oldD.suppliers.length > newD.suppliers.length) {
            changes.push(`${labelPrefix}Usunięto dostawcę`);
        }

        // Transport
        if (oldD.transport.length !== newD.transport.length) {
             changes.push(`${labelPrefix}Zmiana w liście transportów`);
        } else {
            newD.transport.forEach(newT => {
                const oldT = oldD.transport.find(t => t.id === newT.id);
                if (oldT) {
                    if (oldT.trucksCount !== newT.trucksCount) changes.push(`${labelPrefix}Zmiana ilości aut: ${oldT.trucksCount} -> ${newT.trucksCount}`);
                    if (oldT.pricePerTruck !== newT.pricePerTruck) changes.push(`${labelPrefix}Zmiana ceny transp.: ${oldT.pricePerTruck} -> ${newT.pricePerTruck}`);
                    if (oldT.currency !== newT.currency) changes.push(`${labelPrefix}Zmiana waluty transp.: ${oldT.currency} -> ${newT.currency}`);
                }
            });
        }

        // Other Costs
        if (oldD.otherCosts.length !== newD.otherCosts.length) {
             const diff = newD.otherCosts.length - oldD.otherCosts.length;
             changes.push(`${labelPrefix}${diff > 0 ? 'Dodano' : 'Usunięto'} inne koszty`);
        } else {
            newD.otherCosts.forEach(newC => {
                const oldC = oldD.otherCosts.find(c => c.id === newC.id);
                if (oldC) {
                    if (oldC.price !== newC.price) changes.push(`${labelPrefix}Zmiana kosztu [${newC.description}]: ${oldC.price} -> ${newC.price}`);
                    if (oldC.description !== newC.description) changes.push(`${labelPrefix}Zmiana opisu kosztu: ${newC.description}`);
                }
            });
        }

        // Installation
        if (oldD.installation.stages.length !== newD.installation.stages.length) {
            changes.push(`${labelPrefix}Zmiana liczby etapów montażu`);
        } else {
            newD.installation.stages.forEach(newSt => {
                const oldSt = oldD.installation.stages.find(s => s.id === newSt.id);
                if (oldSt) {
                    if (oldSt.palletSpots !== newSt.palletSpots) changes.push(`${labelPrefix}Zmiana m.p. [${newSt.name}]: ${oldSt.palletSpots} -> ${newSt.palletSpots}`);
                    if (oldSt.palletSpotPrice !== newSt.palletSpotPrice) changes.push(`${labelPrefix}Zmiana stawki m.p. [${newSt.name}]: ${oldSt.palletSpotPrice} -> ${newSt.palletSpotPrice}`);
                    
                    if(oldSt.installersCount !== newSt.installersCount) changes.push(`${labelPrefix}Zmiana ekipy [${newSt.name}]: ${oldSt.installersCount} -> ${newSt.installersCount}`);
                    if(oldSt.workDayHours !== newSt.workDayHours) changes.push(`${labelPrefix}Zmiana godzin [${newSt.name}]: ${oldSt.workDayHours} -> ${newSt.workDayHours}`);
                    if(oldSt.manDayRate !== newSt.manDayRate) changes.push(`${labelPrefix}Zmiana stawki roboczogodziny [${newSt.name}]: ${oldSt.manDayRate} -> ${newSt.manDayRate}`);
                    
                    if(oldSt.forkliftDays !== newSt.forkliftDays) changes.push(`${labelPrefix}Zmiana dni wózka [${newSt.name}]: ${oldSt.forkliftDays} -> ${newSt.forkliftDays}`);
                    if(oldSt.scissorLiftDays !== newSt.scissorLiftDays) changes.push(`${labelPrefix}Zmiana dni podnośnika [${newSt.name}]: ${oldSt.scissorLiftDays} -> ${newSt.scissorLiftDays}`);
                }
            });
        }
        
        // Variants
        if ((oldD.variants?.length || 0) !== (newD.variants?.length || 0)) {
            changes.push(`${labelPrefix}Zmiana w liście wariantów`);
        }
    };

    // Determine which data changed based on mode
    // We only diff the ACTIVE data set usually, but let's check both or active based on current state
    if (newState.mode === CalculationMode.INITIAL) {
        compareData(oldState.initial, newState.initial, "");
    } else {
        compareData(oldState.final, newState.final, "[Final] ");
    }

    return changes.length > 0 ? changes : ["Drobne zmiany danych"];
};
