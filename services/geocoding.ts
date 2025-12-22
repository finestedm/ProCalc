
interface GeocodeResult {
    lat: number;
    lon: number;
    display_name: string;
}

const CACHE_KEY = 'procalc_geocoding_cache';

const getCache = (): Record<string, [number, number]> => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    try {
        return JSON.parse(cached);
    } catch (e) {
        return {};
    }
};

const setCache = (address: string, coords: [number, number]) => {
    const cache = getCache();
    cache[address] = coords;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 */
export const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    if (!address || address.trim().length === 0) return null;

    const cache = getCache();
    if (cache[address]) {
        return cache[address];
    }

    const fetchCoords = async (q: string) => {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'pl,en',
                    'User-Agent': 'ProCalc-Logistics-Hub'
                }
            });

            if (!response.ok) return null;
            const data: GeocodeResult[] = await response.json();
            if (data && data.length > 0) {
                return [parseFloat(data[0].lat.toString()), parseFloat(data[0].lon.toString())] as [number, number];
            }
        } catch (e) {
            console.error('Geocoding fetch error:', e);
        }
        return null;
    };

    // 1. Try full address
    let coords = await fetchCoords(address);

    // 2. Fallback: If address has a number (e.g. "andaluzja 19"), try without the number
    if (!coords && /\d+/.test(address)) {
        const withoutNumber = address.replace(/\s\d+([a-zA-Z])?(\/\d+)?/, '').trim();
        if (withoutNumber !== address) {
            console.log(`Fallback: Trying geocoding without number: "${withoutNumber}"`);
            coords = await fetchCoords(withoutNumber);
        }
    }

    // 3. Fallback: Try just the city (if address has a comma)
    if (!coords && address.includes(',')) {
        const parts = address.split(',');
        const cityOnly = parts[parts.length - 1].trim();
        if (cityOnly.length > 2) {
            console.log(`Fallback: Trying geocoding with city only: "${cityOnly}"`);
            coords = await fetchCoords(cityOnly);
        }
    }

    if (coords) {
        setCache(address, coords);
        return coords;
    }

    console.warn('Geocoding failed for address after fallbacks:', address);
    return null;
};
