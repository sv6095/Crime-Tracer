// src/hooks/useStations.ts
import { useEffect, useState } from "react";
import { DK_POLICE_STATIONS } from "@/constants/stations";
import { getApiBaseUrl } from "@/lib/apiConfig";

/**
 * Frontend Station type.
 * Make sure DK_POLICE_STATIONS roughly matches this shape.
 */
export interface Station {
  id: number | string;
  name: string;
  address: string;
  city?: string;
  pincode?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  jurisdiction?: string;
}

/**
 * Normalize whatever the backend returns into our Station type.
 * This is defensive so even if field names differ a bit, it won't crash.
 */
function normalizeStation(raw: any): Station {
  return {
    id: raw.id ?? raw.station_id ?? raw.code ?? raw.name,
    name: raw.name ?? raw.station_name ?? "",
    address: raw.address ?? raw.full_address ?? "",
    city: raw.city ?? raw.district ?? "",
    pincode: raw.pincode ?? raw.zip ?? "",
    phone: raw.contact_phone ?? raw.phone ?? raw.mobile ?? undefined,
    latitude: raw.latitude ?? raw.lat ?? undefined,
    longitude: raw.longitude ?? raw.lng ?? raw.long ?? undefined,
    jurisdiction: raw.jurisdiction ?? undefined,
  };
}

/**
 * Main hook to get the list of police stations.
 * - Starts with local DK_POLICE_STATIONS.
 * - If VITE_API_URL is set and /stations/ exists, overrides with server data.
 */
export function useStations() {
  const [stations, setStations] = useState<Station[]>(
    DK_POLICE_STATIONS as Station[]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = getApiBaseUrl();

    // If no backend base URL is configured, just use local constants
    if (!apiBase) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Build the URL with normalized base
    const url = `${apiBase}/api/stations/`;

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch stations: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) return;

        const normalized = data.map(normalizeStation);
        if (normalized.length > 0) {
          setStations(normalized);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching stations:", err);
        setError("Unable to load stations from server. Using local list.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { stations, isLoading, error };
}

/** --- Auto-detect station based on user location (optional) --- */

const EARTH_RADIUS_KM = 6371;

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * useAutoDetectStation
 * - Tries to use browser geolocation.
 * - Picks nearest station (by lat/lng) if coordinates available.
 *
 * Signature is flexible so your existing StationSelector.tsx
 * can either call:
 *    useAutoDetectStation()
 * or
 *    useAutoDetectStation(stations)
 */
export function useAutoDetectStation(
  initialStations?: Station[],
  options?: { autoStart?: boolean }
) {
  const {
    stations: fetchedStations,
    isLoading: stationsLoading,
    error,
  } = useStations();

  const stations =
    initialStations && initialStations.length
      ? initialStations
      : fetchedStations;

  const [detectedStation, setDetectedStation] = useState<Station | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const autoStart = options?.autoStart ?? false;

  useEffect(() => {
    if (!autoStart) return;

    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported in this browser.");
      return;
    }

    setDetecting(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        const withCoords = stations.filter(
          (s) =>
            typeof s.latitude === "number" &&
            typeof s.longitude === "number"
        );

        if (!withCoords.length) {
          setDetecting(false);
          return;
        }

        let best: Station | null = null;
        let bestDist = Infinity;

        for (const s of withCoords) {
          const dist = haversineDistanceKm(
            coords.latitude,
            coords.longitude,
            s.latitude as number,
            s.longitude as number
          );
          if (dist < bestDist) {
            bestDist = dist;
            best = s;
          }
        }

        setDetectedStation(best);
        setDetecting(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocationError("Unable to access location.");
        setDetecting(false);
      }
    );
  }, [autoStart, stations]);

  return {
    stations,
    detectedStation,
    detecting,
    stationsLoading,
    error,
    locationError,
  };
}
