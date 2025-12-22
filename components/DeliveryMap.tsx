
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '../services/geocoding';

// Fix for default marker icons in Leaflet with Webpack/Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DeliveryPoint {
    projectId: string;
    projectNumber: string;
    customerName: string;
    address: string;
    deliveryDate: string;
    suppliers: string[];
}

interface Props {
    deliveries: DeliveryPoint[];
}

interface GeocodedPoint extends DeliveryPoint {
    position: [number, number];
}

// Component to handle auto-fitting the map to markers
const MapAutoFit: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
        }
    }, [positions, map]);
    return null;
};

export const DeliveryMap: React.FC<Props> = ({ deliveries }) => {
    const [points, setPoints] = useState<GeocodedPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [failedAddresses, setFailedAddresses] = useState<string[]>([]);

    useEffect(() => {
        const fetchCoords = async () => {
            setLoading(true);
            const newPoints: GeocodedPoint[] = [];
            const failed: string[] = [];

            // Process deliveries - uniquely by address to avoid redundant markers
            const uniqueAddresses = Array.from(new Set(deliveries.map(d => d.address as string))) as string[];

            for (const address of uniqueAddresses) {
                const coords = await geocodeAddress(address);
                if (coords) {
                    // Find all deliveries for this address
                    const matches = deliveries.filter(d => d.address === address);
                    matches.forEach(m => {
                        newPoints.push({
                            ...m,
                            position: coords
                        });
                    });
                } else {
                    failed.push(address);
                }
            }

            setPoints(newPoints);
            setFailedAddresses(failed);
            setLoading(false);
        };

        fetchCoords();
    }, [deliveries]);

    // Group points by position to show multiple deliveries in one marker if needed
    const groupedPoints = useMemo(() => {
        const groups: Record<string, GeocodedPoint[]> = {};
        points.forEach(p => {
            const key = `${p.position[0]},${p.position[1]}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return Object.values(groups);
    }, [points]);

    if (loading && points.length === 0) {
        return (
            <div className="h-[500px] w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-zinc-500 font-bold">Geokodowanie adresów...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="h-[600px] w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner relative z-0">
                <MapContainer
                    center={[52.237, 21.017]}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {groupedPoints.map((group, idx) => (
                        <Marker key={idx} position={group[0].position}>
                            <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                                <div className="p-1">
                                    {group.map((p, i) => (
                                        <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-zinc-100" : ""}>
                                            <div className="font-black text-amber-600 dark:text-amber-500 tracking-tighter uppercase">{p.projectNumber}</div>
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{p.customerName}</div>
                                            <div className="text-[11px] mt-1 font-mono font-bold">Dostawa: {p.deliveryDate || 'Brak daty'}</div>
                                            <div className="text-[9px] text-zinc-400 mt-1 italic">Dostawcy: {p.suppliers.join(', ')}</div>
                                        </div>
                                    ))}
                                </div>
                            </Tooltip>
                            <Popup>
                                <div className="max-w-[200px]">
                                    {group.map((p, i) => (
                                        <div key={i} className={i > 0 ? "mt-3 pt-3 border-t border-zinc-200" : ""}>
                                            <h3 className="font-black text-zinc-900 dark:text-white m-0 tracking-tighter uppercase">{p.projectNumber}</h3>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-tight m-0">{p.customerName}</p>
                                            <div className="mt-2 text-xs">
                                                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Adres:</span>
                                                <div className="text-zinc-800 dark:text-zinc-200 font-medium">{p.address}</div>
                                            </div>
                                            <div className="mt-1 text-xs">
                                                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Planowana dostawa:</span>
                                                <div className="text-amber-600 dark:text-amber-500 font-black font-mono">{p.deliveryDate}</div>
                                            </div>
                                            <div className="mt-1 text-xs">
                                                <span className="font-semibold text-zinc-500">Dostawcy:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {p.suppliers.map(s => (
                                                        <span key={s} className="bg-zinc-100 px-1 py-0.5 rounded text-[9px]">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    <MapAutoFit positions={points.map(p => p.position)} />
                </MapContainer>
            </div>

            {failedAddresses.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold text-xs mb-2">
                        <span>⚠️ Nie udało się zlokalizować {failedAddresses.length} adresów:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {failedAddresses.map((addr, i) => (
                            <span key={i} className="text-[10px] bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/50 px-2 py-1 rounded text-zinc-500">
                                {addr}
                            </span>
                        ))}
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2 italic">
                        Sugestia: Sprawdź czy miasto i ulica są poprawnie wpisane. Niektóre bardzo specyficzne adresy mogą wymagać korekty (np. usunięcia numeru lokalu).
                    </p>
                </div>
            )}
        </div>
    );
};
