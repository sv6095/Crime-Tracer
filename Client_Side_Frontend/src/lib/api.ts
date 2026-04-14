// src/lib/api.ts

import { getApiBaseUrl, getAuthToken } from "./apiConfig";

/**
 * Shape of a generic API response wrapper similar to Axios.
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
  headers: Headers;
}

/**
 * Helper to build full URL from a relative path.
 * - If `path` already starts with http, we just return it.
 * - Otherwise, prefix with base URL from apiConfig.
 */
function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  // Ensure we only have a single slash between base and path
  if (!path.startsWith("/")) path = `/${path}`;
  return `${base}${path}`;
}

/**
 * Centralized way to build headers with optional JSON content-type
 * and Authorization bearer token.
 */
function buildHeaders(
  options?: { json?: boolean; extra?: HeadersInit }
): HeadersInit {
  const headers: HeadersInit = {};

  // If this is a JSON request, set content-type
  if (options?.json) {
    headers["Content-Type"] = "application/json";
  }

  // Attach Authorization header if token exists
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Merge any extra headers the caller provides
  if (options?.extra) {
    Object.assign(headers, options.extra);
  }

  return headers;
}

/**
 * Low-level request helper used by apiClient methods.
 */
async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  extraHeaders?: HeadersInit
): Promise<ApiResponse<T>> {
  const url = buildUrl(path);

  const isJsonBody = body !== undefined && !(body instanceof FormData);

  const res = await fetch(url, {
    method,
    headers: buildHeaders({ json: isJsonBody, extra: extraHeaders }),
    body: isJsonBody ? JSON.stringify(body) : body,
  });

  // Try to parse JSON, but don't explode if response is empty or non-JSON
  let data: any = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // If you want, you can handle text / blobs here; for now we just ignore.
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  // Throw a structured error if not ok, similar to axios throwing on !2xx
  if (!res.ok) {
    const message =
      data?.detail ||
      data?.error ||
      data?.message ||
      `HTTP ${res.status} ${res.statusText}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const wrapped: ApiResponse<T> = {
    data: data as T,
    status: res.status,
    ok: res.ok,
    headers: res.headers,
  };

  return wrapped;
}

/**
 * Minimal axios-like API client with .get/.post/.put/.delete.
 *
 * Usage:
 *   const res = await apiClient.get<DashboardSummary>("/api/victim/summary");
 *   console.log(res.data);
 */
export const apiClient = {
  /**
   * GET request with optional query params.
   */
  async get<T = any>(
    path: string,
    options?: { params?: Record<string, string | number | boolean> }
  ): Promise<ApiResponse<T>> {
    let finalPath = path;

    // Append query string if params provided
    if (options?.params) {
      const usp = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        usp.set(key, String(value));
      });
      const qs = usp.toString();
      if (qs) {
        finalPath = `${path}${path.includes("?") ? "&" : "?"}${qs}`;
      }
    }

    return request<T>("GET", finalPath);
  },

  /**
   * POST request.
   * If body is a plain object, it will be JSON-encoded.
   * If body is FormData, it will be sent as-is.
   */
  async post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>("POST", path, body);
  },

  /**
   * PUT request.
   */
  async put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>("PUT", path, body);
  },

  /**
   * DELETE request.
   */
  async delete<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>("DELETE", path, body);
  },
};
