import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Interfaces
export interface Complaint {
  id: number
  complaint_id: string
  filer_name: string
  phone: string
  email?: string
  timestamp: string
  location_text?: string
  lat?: number
  lng?: number
  station_id: number
  crime_type: string
  description: string
  attachments: string[]
  photo_metadata: Record<string, any>
  mapped_bns: any[]
  officers_required: number
  predicted_severity?: string
  assigned_police_id?: number
  officer_summary?: string
  llm_summary?: string
  accepted_by?: string
  status: string
  status_timeline: StatusUpdate[]
  ai_source: string
  victim_confirmation_deadline?: string
  created_at: string
  updated_at: string
  bns_sections?: any[]
  precautions?: string[]
  station?: {
    id: number
    station_name: string
    station_code: string
    address?: string
  }
  accepted_officer?: {
    id: number
    police_id: string
    name: string
  }
}

export interface StatusUpdate {
  status: string
  timestamp: string
  updated_by: string
  note?: string
}

export interface ComplaintUpdateData {
  status?: string
  note?: string
}

export interface CommentData {
  comment: string
  is_internal?: boolean
}

// API functions
const getAuthHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
})

const fetchWithAuth = async (url: string, token: string, options: RequestInit = {}) => {
  console.log(`API Request: ${options.method || 'GET'} ${API_BASE_URL}${url}`)

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers
    }
  })

  console.log(`API Response: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }))
    console.error(`API Error:`, errorData)
    throw new Error(errorData.detail || 'Request failed')
  }

  const data = await response.json()
  console.log(`API Success:`, data)
  return data
}

// Fetch complaints for police dashboard
const fetchPoliceComplaints = async (
  token: string,
  params: {
    status?: string
    assigned?: boolean
    limit?: number
    offset?: number
    search?: string
    admin?: boolean  // If true, fetch all complaints (admin view)
  }
): Promise<{ success: boolean; data: Complaint[] }> => {
  const searchParams = new URLSearchParams()

  if (params.status && params.status !== 'all') {
    // If frontend says 'Filed', backend expects 'Filed' (which it maps internally to NOT_ASSIGNED)
    searchParams.append('status_filter', params.status === 'Filed' ? 'Filed' : params.status)
  }
  if (params.limit) searchParams.append('limit', params.limit.toString())
  if (params.offset) searchParams.append('offset', params.offset.toString())
  // Note: search functionality would need to be added to backend endpoint

  // Use admin endpoint if admin flag is set
  const endpoint = params.admin 
    ? `/api/cases/admin/all-complaints?${searchParams}`
    : `/api/cases/station-complaints?${searchParams}`
  
  const list = await fetchWithAuth(endpoint, token)

  // Map backend CaseDetailOut to frontend Complaint interface
  const mapped = list.map((c: any) => ({
    ...c,
    filer_name: c.victim_name || "Unknown",
    phone: c.victim_phone || "Not provided",
    location_text: c.location_text || "",
    timestamp: c.created_at, // Map created_at to timestamp for compatibility
    created_at: c.created_at,
    updated_at: c.updated_at || c.created_at, // Fallback to created_at if updated_at not available
    // Ensure arrays are present
    bns_sections: c.bns_sections || [],
    precautions: c.precautions || [],
    attachments: c.evidence ? c.evidence.map((e: any) => e.storage_path) : [],
    // Cop assignment info
    assigned_police_id: c.assigned_police_id,
    accepted_officer: c.assigned_cop_name ? {
      name: c.assigned_cop_name,
      police_id: c.assigned_police_id || c.assigned_cop_station || "N/A"
    } : null,
    station: c.station_name ? {
      station_name: c.station_name,
      station_code: c.station_name
    } : null,
    // Ensure required fields
    id: c.id || 0,
    station_id: 0,
  }))

  return { success: true, data: mapped }
}

// Update complaint status
const updateComplaintStatus = async (
  token: string,
  complaintId: string,
  updateData: ComplaintUpdateData
): Promise<{ success: boolean; data: any }> => {
  // Points to: /api/cases/status (Backend cases.py)
  // Backend expects: { complaint_id, new_status, reason? }
  // Frontend updateData: { status, note }
  return fetchWithAuth(`/api/cases/status`, token, {
    method: 'POST',
    body: JSON.stringify({
      complaint_id: complaintId,
      new_status: updateData.status, // Backend expects 'new_status' field
      reason: updateData.note
    })
  })
}

// Assign complaint to current officer
const assignComplaintToSelf = async (
  token: string,
  complaintId: string
): Promise<{ success: boolean; data: any }> => {
  // Points to: /api/cases/assign (Backend cases.py)
  return fetchWithAuth(`/api/cases/assign`, token, {
    method: 'POST',
    body: JSON.stringify({ complaint_id: complaintId })
  })
}

// Add comment to complaint
const addComplaintComment = async (
  token: string,
  complaintId: string,
  commentData: CommentData
): Promise<{ success: boolean; data: any }> => {
  return fetchWithAuth(`/api/complaints/${complaintId}/comments`, token, {
    method: 'POST',
    body: JSON.stringify(commentData)
  })
}

// Get complaint details
const fetchComplaintDetails = async (
  token: string,
  complaintId: string
): Promise<{ success: boolean; data: any }> => {
  const response = await fetchWithAuth(`/api/cases/${complaintId}`, token)
  // Backend returns CaseDetailOut directly, wrap it for consistency
  return {
    success: true,
    data: response
  }
}

// React Query Hooks

// Hook to fetch complaints for police dashboard
export const usePoliceComplaints = (params: {
  status?: string
  assigned?: boolean
  limit?: number
  offset?: number
  search?: string
  enabled?: boolean
  admin?: boolean  // If true, fetch all complaints (admin view)
}) => {
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')
  
  // Auto-detect admin if not explicitly set
  const isAdmin = params.admin !== undefined 
    ? params.admin 
    : (user?.role === 'admin' || user?.role === 'ADMIN')

  console.log('usePoliceComplaints hook:', {
    hasUser: !!user,
    userRole: user?.role,
    isAdmin,
    hasToken: !!token,
    paramsEnabled: params.enabled,
    willExecute: !!(user && token && params.enabled !== false)
  })

  return useQuery({
    queryKey: ['police-complaints', { ...params, admin: isAdmin }],
    queryFn: () => fetchPoliceComplaints(token!, { ...params, admin: isAdmin }),
    enabled: !!(user && token && params.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute for real-time updates
  })
}

// Hook to get single complaint details
export const useComplaintDetails = (complaintId?: string) => {
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')

  return useQuery({
    queryKey: ['complaint-details', complaintId],
    queryFn: () => fetchComplaintDetails(token!, complaintId!),
    enabled: !!(user && token && complaintId),
    staleTime: 10 * 1000, // 10 seconds
  })
}

// Hook to update complaint status
export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')

  return useMutation({
    mutationFn: ({ complaintId, updateData }: {
      complaintId: string
      updateData: ComplaintUpdateData
    }) => updateComplaintStatus(token!, complaintId, updateData),
    onSuccess: () => {
      // Invalidate and refetch complaints
      queryClient.invalidateQueries({ queryKey: ['police-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-details'] })
    },
  })
}

// Hook to assign complaint to self
export const useAssignComplaint = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')

  return useMutation({
    mutationFn: (complaintId: string) => assignComplaintToSelf(token!, complaintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['police-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-details'] })
    },
  })
}

// Hook to add comment
export const useAddComment = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')

  return useMutation({
    mutationFn: ({ complaintId, commentData }: {
      complaintId: string
      commentData: CommentData
    }) => addComplaintComment(token!, complaintId, commentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint-details'] })
    },
  })
}

// Hook to get dashboard statistics
export const usePoliceDashboardStats = () => {
  const { user } = useAuth()
  const token = user?.token || localStorage.getItem('auth-token')

  return useQuery({
    queryKey: ['police-dashboard-stats'],
    queryFn: async () => {
      // Fetch basic stats by getting counts with different filters
      const [newComplaints, assignedComplaints, completedComplaints] = await Promise.all([
        fetchPoliceComplaints(token!, { status: 'Filed', limit: 50 }),
        fetchPoliceComplaints(token!, { assigned: true, limit: 1 }),
        fetchPoliceComplaints(token!, { status: 'Closed', limit: 1 })
      ])

      return {
        success: true,
        data: {
          newComplaints: newComplaints.data.length,
          assignedComplaints: assignedComplaints.data.length,
          completedComplaints: completedComplaints.data.length,
          // These would need additional API endpoints in the backend
          urgentCases: 0
        }
      }
    },
    enabled: !!(user && token),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}