// src/hooks/usePublicApi.ts
// Industry-grade helper for victim public API calls (file complaint, etc.)
// - explicit token checks
// - careful mapping to backend schema
// - clear error handling + logging

import { getApiBaseUrl } from "@/lib/apiConfig";

export const API_BASE = getApiBaseUrl();

/** payload shape used by frontend forms */
export interface FileComplaintPayload {
  filer_name: string;
  phone?: string;
  email?: string;
  crime_type: string;
  description: string;
  station_id: string; // frontend station id (stringified)
  location?: { lat: number; lng: number } | null;
  attachments?: string[]; // IDs returned from upload endpoint (string)
}

/** Convert frontend payload -> backend complaint create body.
 *  Be defensive: parse numeric upload ids, coerce station_id to number/string
 */
function mapToBackendComplaintBody(payload: FileComplaintPayload) {
  // Normalize upload ids: backend accepts integer temporary upload IDs.
  const uploadIds =
    payload.attachments
      ?.map((id) => {
        if (typeof id === "number") return id;
        // Accept "123" or "file_123" where numeric part exists
        const parsed = parseInt(String(id).replace(/[^\d]/g, ""), 10);
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((x): x is number => x != null) ?? [];

  // location_text preferable for human-friendly address; backend may expect lat/lng separately too
  const location_text =
    payload.location && typeof payload.location.lat === "number" && typeof payload.location.lng === "number"
      ? `${payload.location.lat.toFixed(6)},${payload.location.lng.toFixed(6)}`
      : null;

  const body: any = {
    // Backend schema does not include filer_name/phone/email (it uses JWT/UserProfile)
    // filer_name: payload.filer_name ?? null,
    // phone: payload.phone ?? null,
    // email: payload.email ?? null,
    crime_type: payload.crime_type,
    description: payload.description,
    station_id: payload.station_id,
    location_text,
    location_lat: payload.location?.lat ? String(payload.location.lat) : null,
    location_lng: payload.location?.lng ? String(payload.location.lng) : null,
    upload_ids: uploadIds.length > 0 ? uploadIds : null,
    evidence: [],
  };

  return body;
}

/** fileComplaint - POST /api/victim/complaints
 *  - requires a non-empty token
 *  - returns parsed JSON on success
 *  - throws Error with a useful message on failure
 */
export async function fileComplaint(payload: FileComplaintPayload, token?: string) {
  if (!token) {
    console.error("[fileComplaint] Missing token (caller must be logged in)");
    throw new Error("Not authenticated. Please log in before filing a complaint.");
  }

  // Sanity checks to catch common client mistakes early
  if (!payload.filer_name || !payload.crime_type || !payload.description) {
    throw new Error("Missing required complaint fields: name/crime_type/description.");
  }
  if (!payload.station_id) {
    throw new Error("Please select a police station before submitting the complaint.");
  }

  const body = mapToBackendComplaintBody(payload);

  const url = `${API_BASE}/api/victim/complaints`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  // inspect response type first
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let parsed: any = null;
  if (isJson) {
    try {
      parsed = await res.json();
    } catch (e) {
      // parsing failed — keep parsed = null
      parsed = null;
    }
  } else {
    parsed = { raw: await res.text() };
  }

  if (!res.ok) {
    // Prefer explicit backend-provided keys
    const serverMsg = parsed?.detail || parsed?.error || parsed?.message || `HTTP ${res.status}`;
    console.error("[fileComplaint] backend error", res.status, serverMsg, { url, body, parsed });
    throw new Error(serverMsg);
  }

  // success: return parsed JSON (or raw text wrapper)
  return parsed ?? { success: true };
}
