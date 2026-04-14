// src/hooks/usePublicApi.ts
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fileComplaint(payload: {
  filer_name: string;
  phone?: string;
  email?: string;
  crime_type: string;
  description: string;
  station_id: string;    // IMPORTANT: station where the victim files the complaint
  location?: { lat: number; lng: number } | null;
  attachments?: string[]; // URLs or upload ids
}) {
  const res = await fetch(`${API_BASE}/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getComplaint(complaintId: string) {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}
