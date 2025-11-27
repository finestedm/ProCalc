import { GoogleGenAI, SchemaType } from "@google/genai";
import { CalculationData, Currency, SupplierItem } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateInvoiceSummary = async (data: CalculationData, totalCost: number, currency: Currency): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Brak klucza API. Skonfiguruj process.env.API_KEY.";

  const supplierSummary = data.suppliers.map(s => {
    const itemsList = s.items.map(i => `  - ${i.itemDescription} (Nr: ${i.componentNumber}, Waga: ${i.weight}kg): ${i.quantity} szt.`).join('\n');
    return `Dostawca ${s.name} (Oferta: ${s.offerNumber}):\n${itemsList}`;
  }).join('\n\n');

  const otherCostsSummary = data.otherCosts.length > 0 
    ? "Inne koszty:\n" + data.otherCosts.map(c => `  - ${c.description}: ${c.price} ${c.currency}`).join('\n')
    : "Brak innych kosztów";

  const prompt = `
    Jesteś asystentem handlowca. Przygotuj profesjonalną treść na fakturę oraz krótkie podsumowanie menedżerskie projektu w języku polskim na podstawie poniższych danych.
    
    Dane projektu:
    Numer projektu: ${data.meta.projectNumber}
    Zleceniodawca: ${data.orderingParty.name} (NIP: ${data.orderingParty.nip})
    Data zamówienia: ${data.meta.orderDate}
    
    Elementy dostawców:
    ${supplierSummary}

    Inne koszty:
    ${otherCostsSummary}
    
    Instalacja:
    - Miejsca paletowe: ${data.installation.palletSpots}
    
    Całkowita cena sprzedaży: ${totalCost.toFixed(2)} ${currency}
    
    Format odpowiedzi:
    1. Proponowana treść faktury (krótko i zwięźle).
    2. Notatka wewnętrzna (ryzyka, uwagi, całkowita waga elementów jeśli podano).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Nie udało się wygenerować opisu.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Błąd podczas generowania opisu AI.";
  }
};

export const extractDataFromOffer = async (base64Data: string, mimeType: string): Promise<{ items: SupplierItem[], currency: string, discount: number, name?: string, offerNumber?: string }> => {
    const ai = getClient();
    if (!ai) throw new Error("Brak klucza API");

    const prompt = `
        Przeanalizuj ten dokument (ofertę handlową). 
        1. Wyciągnij listę pozycji (items) zawierającą: opis (itemDescription), numer katalogowy/komponentu (componentNumber), ilość (quantity), wagę jednostkową w kg (weight, jeśli brak to 0), cenę jednostkową (unitPrice).
        2. Określ walutę oferty (currency) jako "PLN" lub "EUR".
        3. Znajdź całkowity rabat (discount) w procentach (jeśli jest podany dla całości).
        4. Znajdź nazwę dostawcy (name) i numer oferty (offerNumber).
        
        Zwróć dane w formacie JSON zgodnym ze schematem.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
            }
        });

        const text = response.text;
        if (!text) throw new Error("Pusta odpowiedź AI");
        
        // Basic cleanup if markdown ticks are present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Map AI result to SupplierItem type with IDs
        const items: SupplierItem[] = (data.items || []).map((i: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            itemDescription: i.itemDescription || '',
            componentNumber: String(i.componentNumber || ''),
            quantity: parseFloat(i.quantity) || 0,
            weight: parseFloat(i.weight) || 0,
            unitPrice: parseFloat(i.unitPrice) || 0
        }));

        return {
            items,
            currency: data.currency || 'PLN',
            discount: parseFloat(data.discount) || 0,
            name: data.name,
            offerNumber: data.offerNumber
        };

    } catch (error) {
        console.error("AI Extraction Error:", error);
        throw error;
    }
};