import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Utility function to handle API requests
const apiRequest = async (url: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Hook for fetching stations
export const useStations = (options?: any) => {
  return useQuery({
    queryKey: ['stations', options],
    queryFn: () => apiRequest('/api/stations' + (options?.limit ? `?limit=${options.limit}` : '')),
    select: (data) => data.data || [],
    enabled: options?.enabled !== false,
  })
}

// Hook for fetching nearest stations
export const useNearestStations = (lat?: number, lng?: number, limit = 5) => {
  return useQuery({
    queryKey: ['stations', 'nearest', lat, lng, limit],
    queryFn: () => apiRequest(`/api/stations/nearest?lat=${lat}&lng=${lng}&limit=${limit}`),
    enabled: !!(lat && lng),
    select: (data) => data.data || [],
  })
}

// Hook for filing a complaint
export const useFileComplaint = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (complaintData: any) => apiRequest('/api/victim/complaints', {
      method: 'POST',
      body: JSON.stringify(complaintData),
    }),
    onSuccess: () => {
      // Invalidate and refetch complaints
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

// Hook for tracking a complaint
export const useTrackComplaint = () => {
  return useMutation({
    mutationFn: (complaintId: string) => apiRequest(`/api/victim/complaints/${complaintId}`),
  })
}

// Hook for tracking complaints by phone
export const useTrackComplaintsByPhone = () => {
  return useMutation({
    mutationFn: (phone: string) => apiRequest(`/api/victim/complaints?phone=${phone}`),
  })
}

// Hook for uploading files
export const useUploadFile = () => {
  return useMutation({
    mutationFn: async ({ file, type = 'attachment' }: { file: File | Blob, type?: 'photo' | 'attachment' }) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/uploads/${type}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(error.error || `Upload failed`)
      }

      return response.json()
    },
  })
}

// Hook for police authentication
export const usePoliceAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check for stored auth token
    const token = localStorage.getItem('police-token')
    const userData = localStorage.getItem('police-user')

    if (token && userData) {
      setIsAuthenticated(true)
      setUser(JSON.parse(userData))
    }
  }, [])

  const login = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiRequest('/api/auth/police/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem('police-token', data.token)
      localStorage.setItem('police-user', JSON.stringify(data.user))
      setIsAuthenticated(true)
      setUser(data.user)
    },
  })

  const register = useMutation({
    mutationFn: (userData: any) =>
      apiRequest('/api/auth/police/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
  })

  const logout = () => {
    localStorage.removeItem('police-token')
    localStorage.removeItem('police-user')
    setIsAuthenticated(false)
    setUser(null)
  }

  return {
    isAuthenticated,
    user,
    login,
    register,
    logout,
  }
}

// Hook for fetching complaints (police dashboard)
export const useComplaints = (filters?: any) => {
  const { user } = useAuth()
  const token = user?.token

  return useQuery({
    queryKey: ['complaints', filters],
    queryFn: () => {
      const params = new URLSearchParams(filters)
      // Assuming 'assigned' complaints are fetched via cases endpoints or specialized endpoint
      // Based on main.py, cases router is /api/cases
      // Let's assume /api/cases/station-complaints for general list
      return apiRequest(`/api/cases/station-complaints?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    enabled: !!token,
    select: (data) => data.data || data || [], // Fallback for list
  })
}

// Hook for updating complaint status
export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient()
  const token = localStorage.getItem('police-token')

  return useMutation({
    mutationFn: ({ complaintId, status, comment }: { complaintId: string; status: string; comment?: string }) =>
      apiRequest(`/api/cases/status`, { // /api/cases/status per cases.py
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ complaint_id: complaintId, new_status: status, reason: comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

// Hook for admin analytics
export const useAdminAnalytics = (stationId?: string) => {
  const token = localStorage.getItem('admin-token')

  return useQuery({
    queryKey: ['admin', 'analytics', stationId],
    queryFn: () => {
      const qs = stationId && stationId !== 'all' ? `?station_id=${stationId}` : '';
      return apiRequest(`/api/stats/dashboard${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    enabled: !!token,
    select: (data) => data.data || data || {},
  })
}

// Hook for complaint trends
export const useComplaintTrends = (days = 30, stationId?: string, scope?: string) => {
  const { user } = useAuth()
  const token = user?.token

  return useQuery({
    queryKey: ['stats', 'complaint-trends', days, stationId, scope],
    queryFn: () => {
      let url = `/api/stats/complaints/trends?days=${days}`;
      if (stationId && stationId !== 'all') url += `&station_id=${stationId}`;
      if (scope) url += `&scope=${scope}`;
      return apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    enabled: !!token,
    select: (data) => data.data || data || {},
  })
}

// Hook for station performance
export const useStationPerformance = (days = 30, stationId?: string) => {
  const { user } = useAuth()
  const token = user?.token

  return useQuery({
    queryKey: ['stats', 'station-performance', days, stationId],
    queryFn: () => {
      let url = `/api/stats/stations/performance?days=${days}`;
      if (stationId && stationId !== 'all') url += `&station_id=${stationId}`;
      return apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    enabled: !!token,
    select: (data) => data.data || data || {},
  })
}

// Hook for officer workload
export const useOfficerWorkload = (days = 30, limit = 50, stationId?: string) => {
  const { user } = useAuth()
  const token = user?.token

  return useQuery({
    queryKey: ['stats', 'officer-workload', days, limit, stationId],
    queryFn: () => {
      let url = `/api/stats/officers/workload?days=${days}&limit=${limit}`;
      if (stationId && stationId !== 'all') url += `&station_id=${stationId}`;
      return apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    enabled: !!token,
    select: (data) => data.data || data || {},
  })
}

// Hook for dashboard statistics
export const useDashboardStats = (days = 30, stationId?: string, scope?: string) => {
  const { user } = useAuth()
  const token = user?.token

  return useQuery({
    queryKey: ['stats', 'dashboard', days, stationId, scope],
    queryFn: () => {
      let url = `/api/stats/dashboard?days=${days}`;
      if (stationId && stationId !== 'all') url += `&station_id=${stationId}`;
      if (scope) url += `&scope=${scope}`;
      return apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    enabled: !!token,
    // For now, if no API endpoints exist, these will error 404.
    // The component handles empty/error states adequately.
    select: (data) => data || {},
    retry: 1,
  })
}

// Hook for pending approvals
export const usePendingApprovals = () => {
  const token = localStorage.getItem('admin-token')

  return useQuery({
    queryKey: ['admin', 'approvals'],
    queryFn: () => apiRequest('/api/admin/approvals', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    enabled: !!token,
    select: (data) => data.data || [],
  })
}

// Hook for handling approvals
export const useHandleApproval = () => {
  const queryClient = useQueryClient()
  const token = localStorage.getItem('admin-token')

  return useMutation({
    mutationFn: ({ approvalId, action, reason }: { approvalId: string; action: 'approve' | 'reject'; reason?: string }) =>
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