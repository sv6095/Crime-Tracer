// src/lib/apiConfig.ts

// Raw value from Vite env, e.g.
// VITE_API_URL = "http://127.0.0.1:8000"      ✅ good
// VITE_API_URL = "http://127.0.0.1:8000/api"  😅 still works, we'll fix it
const RAW_API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Normalize the base URL:
 * - remove trailing slashes
 * - if it ends with "/api", strip that too
 *
 * So BOTH of these become: "http://127.0.0.1:8000"
 *   - "http://127.0.0.1:8000"
 *   - "http://127.0.0.1:8000/api"
 */
function normalizeBaseUrl(url: string): string {
  if (!url) return "http://127.0.0.1:8000";

  // remove trailing slashes
  let clean = url.replace(/\/+$/, "");

  // if ends with /api, strip that segment
  if (clean.toLowerCase().endsWith("/api")) {
    clean = clean.slice(0, -4); // remove "/api"
  }

  return clean;
}

const NORMALIZED_BASE_URL = normalizeBaseUrl(RAW_API_URL);

/**
 * Return the normalized base URL for backend API.
 *
 * Example:
 *   "http://127.0.0.1:8000"
 */
export function getApiBaseUrl(): string {
  return NORMALIZED_BASE_URL;
}

/**
 * Central place to read the JWT for victim (or general auth).
 * This matches what we store in AuthContext:
 *   localStorage.setItem('victim-token', token)
 *   localStorage.setItem('auth-token', token)
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("victim-token") ||
    localStorage.getItem("auth-token") ||
    null
  );
}
