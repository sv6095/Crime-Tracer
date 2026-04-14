// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

export type Role = "victim" | "police" | "admin" | "guest" | "ADMIN" | "COP";

export interface User {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  stationId?: string | null;
  token?: string;
  // Police-specific fields
  badge_number?: string;
  police_id?: string;
  station_name?: string;
  is_cop?: boolean;
  is_admin?: boolean;
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
  registerCop: (payload: {
    name: string;
    email: string;
    phone: string;
    badgeId: string;
    password: string;
    station: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUserFromStorage: () => void;
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

/**
 * Simple localStorage-backed AuthContext for demo and wiring.
 * Replace API calls with real endpoints when ready.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("ct_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("ct_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("ct_user");
    }
  }, [user]);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

  const login = async (identifier: string, password: string, role: Role = "victim") => {
    // 1. Request Token (OAuth2 Password flow)
    const formData = new URLSearchParams();
    formData.append("username", identifier);
    formData.append("password", password);

    const tokenRes = await fetch(`${API_BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 2. Fetch User Details
    const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) throw new Error("Failed to fetch user profile");
    const meData = await meRes.json();

    // 3. Construct User Object
    const userObj: User = {
      id: meData.id,
      name: meData.name,
      email: meData.email,
      phone: meData.phone,
      role: (meData.role === 'COP' ? 'police' : meData.role === 'ADMIN' ? 'admin' : meData.role.toLowerCase()) as Role,
      stationId: meData.station_id,
      station_name: meData.station_name || undefined,
      badge_number: meData.badge_number || undefined,
      token: token,
    };

    setUser(userObj);
    return userObj;
  };

  const registerVictim = async (payload: {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    address?: string;
    station?: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/victim/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        address: payload.address,
        station_id: payload.station, // Map 'station' to 'station_id'
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Registration failed");
    }

    // Auto-login after registration? Or just return user.
    // Logic here: usually we want them to login explicitly or we auto-login.
    // For now, let's login them in automatically to match previous mock behavior if possible,
    // but standard flow is: fetch token.
    // Let's just return the created user and let UI handle "Registration success, please login".
    // Or we can auto-login:
    const identifier = payload.email || payload.phone || "";
    if (identifier) {
      return login(identifier, payload.password, "victim");
    }

    // Fallback if no identifier (shouldn't happen)
    throw new Error("Registration successful but auto-login failed");
  };

  const registerCop = async (payload: {
    name: string;
    email: string; // used as username for cops in UI usually? Let's check AuthCop.
    // AuthCop sends 'email' as identifier, but backend expects 'username'.
    // We should map email to username or handle it.
    // Backend Cop Register: username, name, station_id, password.
    // AuthCop UI inputs: name, email, phone, badgeId, station, password.
    // We'll use email as username for now to keep it simple, OR badgeId?
    // Let's use email as username.
    phone: string;
    badgeId: string;
    password: string;
    station: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/cop/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        username: payload.email, // using email as username
        station_id: payload.station,
        password: payload.password,
        phone: payload.phone,
        badge_number: payload.badgeId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Registration failed");
    }

    const data = await res.json();
    // Return a temporary user object (not logged in)
    return {
      id: data.id,
      name: data.name,
      role: "police",
      token: undefined
    } as User;
  };

  const logout = () => {
    setUser(null);
    // optionally revoke tokens on server
  };

  const refreshUserFromStorage = () => {
    try {
      const raw = localStorage.getItem("ct_user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
  };

  const value: AuthContextShape = {
    user,
    isAuthenticated: !!user,
    login,
    registerVictim,
    registerCop,
    logout,
    refreshUserFromStorage
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextShape => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

/**
 * ProtectedRoute wrapper for routing.
 * usage:
 * <ProtectedRoute requiredRoles={['police']}> <Dashboard/> </ProtectedRoute>
 */
import { Navigate } from "react-router-dom";

export const ProtectedRoute: React.FC<{ requiredRoles?: Role[]; children: React.ReactElement }> = ({ requiredRoles, children }) => {
  const auth = useAuth();

  // Not logged in -> go to auth page (victim login) or to police login depending on path/role needed
  if (!auth.isAuthenticated) {
    return <Navigate to="/cop/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = auth.user!.role.toLowerCase()
    const hasRole = requiredRoles.some(r => r.toLowerCase() === userRole)
    if (!hasRole) {
      // user logged in but doesn't have required role
      return <Navigate to="/" replace />;
    }
  }

  return children;
};
