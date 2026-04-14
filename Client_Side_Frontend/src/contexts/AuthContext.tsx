// src/contexts/AuthContext.tsx
// Auth provider used across the app.
// Improvements:
//  - robust localStorage restore with graceful fallbacks
//  - keep both ct_user and flat tokens in sync
//  - ensure tokens are available immediately after login/register

import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getApiBaseUrl } from "../lib/apiConfig";

export type Role = "victim" | "police" | "admin" | "guest";

export interface User {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  stationId?: string | null;
  token?: string;
}

interface AuthContextShape {
  user: User | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string, role?: Role) => Promise<User>;
  registerVictim: (payload: {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    address?: string;
    station?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUserFromStorage: () => void;
  refreshUserFromApi: () => Promise<void>;
}

const STORAGE_KEY = "ct_user";
const API_BASE = getApiBaseUrl();

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

/** Normalize backend user payload to our frontend User */
function normalizeBackendUser(data: any, token?: string): User {
  const backendRole = (data?.role ?? "victim").toString().toLowerCase();
  let role: Role = "victim";
  if (backendRole === "cop" || backendRole === "police") role = "police";
  else if (backendRole === "admin") role = "admin";

  return {
    id: String(data?.id ?? data?.user_id ?? ""),
    name: data?.name ?? undefined,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
    role,
    stationId: data?.station_id != null ? String(data.station_id) : data?.stationId != null ? String(data.stationId) : null,
    token,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // ensure token exists as top-level field if present in separate keys
      const token = parsed?.token || localStorage.getItem("victim-token") || localStorage.getItem("auth-token") || undefined;
      const normalized: User = {
        ...parsed,
        token,
      };
      return normalized;
    } catch {
      return null;
    }
  });

  // Keep storage in sync whenever user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      if (user.token) {
        localStorage.setItem("victim-token", user.token);
        localStorage.setItem("auth-token", user.token);
      } else {
        localStorage.removeItem("victim-token");
        localStorage.removeItem("auth-token");
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("victim-token");
      localStorage.removeItem("auth-token");
    }
  }, [user]);

  const refreshUserFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setUser(null);
        return;
      }
      const parsed = JSON.parse(raw);
      const token = parsed?.token || localStorage.getItem("victim-token") || localStorage.getItem("auth-token") || undefined;
      setUser({ ...parsed, token });
    } catch {
      setUser(null);
    }
  };

  const refreshUserFromApi = async () => {
    if (!user?.token) return;
    
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const meBody = await meRes.json().catch(() => ({} as any));
      if (!meRes.ok) {
        console.error("Failed to refresh user:", meBody?.detail);
        return;
      }

      const normalized = normalizeBackendUser(meBody, user.token);
      setUser(normalized);
    } catch (error) {
      console.error("Error refreshing user from API:", error);
    }
  };

  // LOGIN -> OAuth token + /api/auth/me
  const login = async (identifier: string, password: string, _role: Role = "victim") => {
    if (!identifier || !password) throw new Error("Missing credentials");

    // Many FastAPI OAuth flows expect form-encoded body; backend in your repo expects /api/auth/token
    const form = new URLSearchParams();
    form.append("username", identifier);
    form.append("password", password);
    form.append("grant_type", "password");

    // 1) token
    const tokenRes = await fetch(`${API_BASE}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const tokenBody = await tokenRes.json().catch(() => ({} as any));
    if (!tokenRes.ok) {
      const msg = tokenBody?.detail || tokenBody?.error || "Login failed";
      throw new Error(msg);
    }

    const accessToken: string | undefined = tokenBody?.access_token;
    if (!accessToken) throw new Error("No access token returned from server");

    // 2) fetch /me profile
    const meRes = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meBody = await meRes.json().catch(() => ({} as any));
    if (!meRes.ok) {
      const msg = meBody?.detail || "Failed to fetch user profile";
      throw new Error(msg);
    }

    const normalized = normalizeBackendUser(meBody, accessToken);
    setUser(normalized);
    return normalized;
  };

  const registerVictim = async (payload: {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    address?: string;
    station?: string;
  }) => {
    if (!payload.name) throw new Error("Name required");
    if (!payload.password || payload.password.length < 6) throw new Error("Password must be at least 6 characters");

    const bodyToSend: any = {
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      password: payload.password,
      address: payload.address ?? null,
      station_id: payload.station ?? null,
    };

    const res = await fetch(`${API_BASE}/api/auth/victim/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyToSend),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const msg = data?.detail || data?.error || "Registration failed";
      throw new Error(msg);
    }

    // Auto login after register if we have identifier
    const identifier = payload.email || payload.phone;
    if (!identifier) {
      const created: User = {
        id: String(data?.id ?? ""),
        name: data?.name ?? payload.name,
        email: data?.email ?? null,
        phone: data?.phone ?? null,
        role: "victim",
        stationId: null,
        token: undefined,
      };
      setUser(created);
      return created;
    }

    // Use login flow to populate token and profile
    return await login(identifier, payload.password, "victim");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("victim-token");
    localStorage.removeItem("auth-token");
    // backend revoke endpoint can be called here if you add one later
  };

  const value: AuthContextShape = {
    user,
    isAuthenticated: !!user,
    login,
    registerVictim,
    logout,
    refreshUserFromStorage,
    refreshUserFromApi,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

/** ProtectedRoute: enforces auth + role checks */
export const ProtectedRoute: React.FC<{ requiredRoles?: Role[]; children: React.ReactElement }> = ({ requiredRoles, children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?from=${from}`} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && (!auth.user || !requiredRoles.includes(auth.user.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
};
