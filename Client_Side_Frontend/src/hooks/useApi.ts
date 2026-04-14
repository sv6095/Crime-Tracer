// src/hooks/useApi.ts
//
// Shared API utilities + hooks for CrimeTracer (victim + future cop/admin).
// All victim-facing stuff is wired to /api/...; uploads have a smart fallback.

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiBaseUrl } from '@/lib/apiConfig'

const API_BASE_URL = getApiBaseUrl()

// ------------------------------------------------------
// Core helper
// ------------------------------------------------------
const apiRequest = async (url: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    let errorBody: any = null
    try {
      errorBody = await response.json()
    } catch {
      errorBody = { error: 'Network error' }
    }
    throw new Error(errorBody?.detail || errorBody?.error || `HTTP ${response.status}`)
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

// ------------------------------------------------------
// Stations
// ------------------------------------------------------

export const useStations = () => {
  return useQuery({
    queryKey: ['stations'],
    // 🔁 backend wired to /api/stations (FastAPI will 307 → /api/stations/)
    queryFn: () => apiRequest('/api/stations'),
    select: (data: any) => data?.data || data || [],
  })
}

export const useNearestStations = (lat?: number, lng?: number, limit = 5) => {
  return useQuery({
    queryKey: ['stations', 'nearest', lat, lng, limit],
    // 🔁 backend wired to /api/stations/nearest
    queryFn: () =>
      apiRequest(`/api/stations/nearest?lat=${lat}&lng=${lng}&limit=${limit}`),
    enabled: !!(lat && lng),
    select: (data: any) => data?.data || data || [],
  })
}

// ------------------------------------------------------
// Victim complaint flows
// ------------------------------------------------------

export const useFileComplaint = () => {
  const queryClient = useQueryClient()

  return useMutation({
    // 🔁 backend: POST /api/complaints
    mutationFn: (complaintData: any) =>
      apiRequest('/api/complaints', {
        method: 'POST',
        body: JSON.stringify(complaintData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export const useTrackComplaint = () => {
  return useMutation({
    // 🔁 backend: GET /api/complaints/{id}
    mutationFn: (complaintId: string) => apiRequest(`/api/complaints/${complaintId}`),
  })
}

export const useTrackComplaintsByPhone = () => {
  return useMutation({
    // 🔁 frontend now hits /api/complaints?phone=
    //    NOTE: needs matching backend route.
    mutationFn: (phone: string) => apiRequest(`/api/complaints?phone=${phone}`),
  })
}

// ------------------------------------------------------
// File uploads (evidence, attachments) – with smart fallback
// ------------------------------------------------------

export const useUploadFile = () => {
  return useMutation({
    mutationFn: async ({
      file,
      type = 'attachment',
    }: {
      file: File | Blob
      type?: 'photo' | 'attachment'
    }) => {
      const formData = new FormData()
      formData.append('file', file)

      const endpoints = [
        // 1) Preferred: /api/uploads/{type}
        `${API_BASE_URL}/api/uploads/${type}`,
        // 2) Fallback: /uploads/{type} (no /api)
        `${API_BASE_URL}/uploads/${type}`,
      ]

      let lastError: Error | null = null

      for (const url of endpoints) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            // If 404, try next endpoint; otherwise throw immediately
            if (response.status === 404) {
              let errBody: any = null
              try {
                errBody = await response.json()
              } catch {
                errBody = { error: `Upload endpoint ${url} not found` }
              }
              lastError = new Error(
                errBody?.detail || errBody?.error || `Upload 404 at ${url}`,
              )
              continue
            } else {
              let errBody: any = null
              try {
                errBody = await response.json()
              } catch {
                errBody = { error: 'Upload failed' }
              }
              throw new Error(errBody?.detail || errBody?.error || 'Upload failed')
            }
          }

          try {
            return await response.json()
          } catch {
            return null
          }
        } catch (e: any) {
          // network issue etc – store and try next endpoint
          lastError = e
          continue
        }
      }

      // if all endpoints failed
      if (lastError) throw lastError
      throw new Error('Upload failed: no working upload endpoint found')
    },
  })
}

// ------------------------------------------------------
// Police auth (for future cops dashboard)
// ------------------------------------------------------

export const usePoliceAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('police-token')
    const userData = localStorage.getItem('police-user')

    if (token && userData) {
      setIsAuthenticated(true)
      try {
        setUser(JSON.parse(userData))
      } catch {
        setUser(null)
      }
    }
  }, [])

  const login = async (payload: { username: string; password: string }) => {
    // 🔁 expects backend: POST /api/auth/token for cops later
    const data = await apiRequest('/api/auth/token', {
      method: 'POST',
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
      }),
    })

    const token = data?.access_token
    if (token) {
      localStorage.setItem('police-token', token)
      localStorage.setItem(
        'police-user',
        JSON.stringify({
          username: payload.username,
          role: 'cop',
        }),
      )
      setIsAuthenticated(true)
      setUser({ username: payload.username, role: 'cop' })
    }

    return data
  }

  const logout = () => {
    localStorage.removeItem('police-token')
    localStorage.removeItem('police-user')
    setIsAuthenticated(false)
    setUser(null)
  }

  return { isAuthenticated, user, login, logout }
}

// ------------------------------------------------------
// Admin / stats hooks (future admin panel)
// ------------------------------------------------------

export const useComplaintStats = (days = 30) => {
  return useQuery({
    queryKey: ['stats', 'complaints-summary', days],
    queryFn: () => apiRequest(`/api/stats/complaints/summary?days=${days}`),
    select: (data: any) => data?.data || data || {},
  })
}

export const useComplaintTrends = (days = 30) => {
  return useQuery({
    queryKey: ['stats', 'complaint-trends', days],
    queryFn: () => apiRequest(`/api/stats/complaints/trends?days=${days}`),
    select: (data: any) => data?.data || data || {},
  })
}

export const useStationPerformance = (days = 30) => {
  return useQuery({
    queryKey: ['stats', 'station-performance', days],
    queryFn: () => apiRequest(`/api/stats/stations/performance?days=${days}`),
    select: (data: any) => data?.data || data || {},
  })
}

export const useOfficerWorkload = (days = 30, limit = 50) => {
  return useQuery({
    queryKey: ['stats', 'officer-workload', days, limit],
    queryFn: () =>
      apiRequest(`/api/stats/officers/workload?days=${days}&limit=${limit}`),
    select: (data: any) => data?.data || data || {},
  })
}

export const useDashboardStats = (days = 30) => {
  return useQuery({
    queryKey: ['stats', 'dashboard', days],
    queryFn: () => apiRequest(`/api/stats/dashboard?days=${days}`),
    select: (data: any) => data?.data || data || {},
    refetchInterval: 5 * 60 * 1000,
  })
}

// admin approvals

export const usePendingApprovals = () => {
  const token = localStorage.getItem('admin-token')

  return useQuery({
    queryKey: ['admin', 'approvals'],
    queryFn: () =>
      apiRequest('/api/admin/approvals', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    enabled: !!token,
    select: (data: any) => data?.data || data || [],
  })
}

export const useHandleApproval = () => {
  const queryClient = useQueryClient()
  const token = localStorage.getItem('admin-token')

  return useMutation({
    mutationFn: ({
      approvalId,
      action,
      reason,
    }: {
      approvalId: string
      action: 'approve' | 'reject'
      reason?: string
    }) =>
      apiRequest(`/api/admin/approvals/${approvalId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] })
    },
  })
}
