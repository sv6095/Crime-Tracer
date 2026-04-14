import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types
export interface DiaryEntry {
  id: number
  case_id: number
  investigator_id: number
  investigator_name: string
  entry_type: 'note' | 'theory' | 'observation' | 'brainstorm'
  content: string
  encrypted: boolean
  created_at: string
  updated_at: string
}

export interface DiaryEntryCreate {
  entry_type: 'note' | 'theory' | 'observation' | 'brainstorm'
  content: string
  encrypted?: boolean
}

export interface DiaryEntryUpdate {
  content?: string
  entry_type?: 'note' | 'theory' | 'observation' | 'brainstorm'
}

export interface EvidenceChange {
  id: number
  change_id: string
  case_id: number
  user_id: number
  user_name: string
  section_modified: string
  field_changed?: string
  change_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPEND' | 'ERASE'
  old_value?: string
  new_value?: string
  details?: string
  cryptographic_hash: string
  timestamp: string
  ip_address?: string
  user_agent?: string
}

export interface CasePattern {
  id: number
  case_id: number
  related_case_id: number
  related_case_complaint_id?: string
  pattern_type: 'suspect_match' | 'voice_match' | 'object_match' | 'location_cluster' | 'temporal_pattern'
  confidence_score: number
  match_details?: Record<string, any>
  detected_at: string
  verified_by?: number
  verified_at?: string
}

export interface ForensicAnalysis {
  id: number
  evidence_id: number
  analysis_type: 'yolo_object_detection' | 'voice_analysis' | 'ocr_extraction' | 'fir_processing'
  analysis_result: Record<string, any>
  model_version?: string
  confidence_score?: number
  processing_time_ms?: number
  created_at: string
}

// Helper to get token from auth context
const getToken = (): string => {
  try {
    const userStr = localStorage.getItem('ct_user')
    if (userStr) {
      const user = JSON.parse(userStr)
      return user?.token || ''
    }
  } catch {
    // Fallback
  }
  return ''
}

// API helpers
const getAuthHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
})

const fetchWithAuth = async (url: string, token: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(errorData.detail || 'Request failed')
  }

  return response.json()
}

// Diary Hooks
export const useDiaryEntries = (caseId: number, entryType?: string) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['diaryEntries', caseId, entryType],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      const params = entryType ? `?entry_type=${entryType}` : ''
      return fetchWithAuth(`/api/investigation/${caseId}/diary${params}`, token) as Promise<DiaryEntry[]>
    },
    enabled: !!token && !!caseId,
  })
}

export const useCreateDiaryEntry = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, entry }: { caseId: number; entry: DiaryEntryCreate }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/diary`, token, {
        method: 'POST',
        body: JSON.stringify(entry),
      }) as Promise<DiaryEntry>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['diaryEntries', variables.caseId] })
    },
  })
}

export const useUpdateDiaryEntry = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, entryId, entry }: { caseId: number; entryId: number; entry: DiaryEntryUpdate }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/diary/${entryId}`, token, {
        method: 'PUT',
        body: JSON.stringify(entry),
      }) as Promise<DiaryEntry>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['diaryEntries', variables.caseId] })
    },
  })
}

export const useDeleteDiaryEntry = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, entryId }: { caseId: number; entryId: number }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/diary/${entryId}`, token, {
        method: 'DELETE',
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['diaryEntries', variables.caseId] })
    },
  })
}

// Changes/Audit Trail Hooks
export const useCaseChanges = (
  caseId: number,
  filters?: {
    section?: string
    change_type?: string
    user_id?: number
    start_date?: string
    end_date?: string
  }
) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['caseChanges', caseId, filters],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      const params = new URLSearchParams()
      if (filters?.section) params.append('section', filters.section)
      if (filters?.change_type) params.append('change_type', filters.change_type)
      if (filters?.user_id) params.append('user_id', filters.user_id.toString())
      if (filters?.start_date) params.append('start_date', filters.start_date)
      if (filters?.end_date) params.append('end_date', filters.end_date)
      
      const queryString = params.toString()
      return fetchWithAuth(`/api/investigation/${caseId}/changes${queryString ? `?${queryString}` : ''}`, token) as Promise<EvidenceChange[]>
    },
    enabled: !!token && !!caseId,
  })
}

export const useVerifyIntegrity = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useMutation({
    mutationFn: async ({ caseId, changeIds }: { caseId: number; changeIds: string[] }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/changes/verify`, token, {
        method: 'POST',
        body: JSON.stringify({ change_ids: changeIds }),
      })
    },
  })
}

// Pattern Discovery Hooks
export const useCasePatterns = (caseId: number, patternType?: string, minConfidence?: number) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['casePatterns', caseId, patternType, minConfidence],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      const params = new URLSearchParams()
      if (patternType) params.append('pattern_type', patternType)
      if (minConfidence !== undefined) params.append('min_confidence', minConfidence.toString())
      
      const queryString = params.toString()
      return fetchWithAuth(`/api/investigation/${caseId}/patterns${queryString ? `?${queryString}` : ''}`, token) as Promise<CasePattern[]>
    },
    enabled: !!token && !!caseId,
  })
}

export const useAnalyzePatterns = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (caseId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/patterns/analyze`, token, {
        method: 'POST',
      })
    },
    onSuccess: (_, caseId) => {
      queryClient.invalidateQueries({ queryKey: ['casePatterns', caseId] })
    },
  })
}

export const useVerifyPattern = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patternId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/patterns/${patternId}/verify`, token, {
        method: 'POST',
      }) as Promise<CasePattern>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['casePatterns', data.case_id] })
    },
  })
}

// Forensic Analysis Hooks
export const useForensicAnalysis = (evidenceId: number) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['forensicAnalysis', evidenceId],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/${evidenceId}/analyses`, token) as Promise<ForensicAnalysis[]>
    },
    enabled: !!token && !!evidenceId,
  })
}

export const useRunYOLODetection = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (evidenceId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/yolo/${evidenceId}`, token, {
        method: 'POST',
      }) as Promise<ForensicAnalysis>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forensicAnalysis', data.evidence_id] })
    },
  })
}

export const useRunVoiceAnalysis = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (evidenceId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/voice/${evidenceId}`, token, {
        method: 'POST',
      }) as Promise<ForensicAnalysis>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forensicAnalysis', data.evidence_id] })
    },
  })
}

export const useRunOCRExtraction = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (evidenceId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/ocr/${evidenceId}`, token, {
        method: 'POST',
      }) as Promise<ForensicAnalysis>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forensicAnalysis', data.evidence_id] })
    },
  })
}

export const useProcessFIR = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (evidenceId: number) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/fir/process`, token, {
        method: 'POST',
        body: JSON.stringify({ evidence_id: evidenceId }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forensicAnalysis'] })
    },
  })
}

export interface OCRCount {
  case_id: number
  ocr_count: number
  max_allowed: number
  remaining: number
  limit_reached: boolean
}

export const useOCRCount = (caseId: number) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['ocrCount', caseId],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/forensics/case/${caseId}/ocr-count`, token) as Promise<OCRCount>
    },
    enabled: !!token && !!caseId,
  })
}

// Evidence Upload Hook (legacy - for /api/uploads/evidence)
export const useUploadEvidence = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ complaintId, file }: { complaintId: string; file: File }) => {
      if (!token) throw new Error('Not authenticated')
      
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/uploads/evidence/${complaintId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errorData.detail || 'Upload failed')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate complaint details to refresh evidence list
      queryClient.invalidateQueries({ queryKey: ['complaintDetails', variables.complaintId] })
      queryClient.invalidateQueries({ queryKey: ['policeComplaints'] })
      queryClient.invalidateQueries({ queryKey: ['forensicAnalysis'] })
    },
  })
}

// New Evidence Types
export interface Evidence {
  id: number
  file_name: string
  content_type: string
  storage_type: string
  storage_path: string
  sha256?: string
  evidence_type?: 'text' | 'csv' | 'pdf' | 'image' | 'video' | 'audio' | 'live_recording'
  text_content?: string
  deleted_at?: string
  recording_duration?: number
  recording_format?: string
  uploaded_by_id: number
  uploaded_at: string
}

export interface EvidenceCreate {
  evidence_type: 'text' | 'csv' | 'pdf' | 'image' | 'video' | 'audio' | 'live_recording'
  text_content?: string
  file_name?: string
  content_type?: string
  recording_duration?: number
  recording_format?: string
}

export interface EvidenceUpdate {
  file_name?: string
  text_content?: string
  forensic_tags?: string[]
}

// Investigation Evidence Hooks
export const useEvidenceList = (caseId: number, evidenceType?: string, includeDeleted?: boolean) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['evidenceList', caseId, evidenceType, includeDeleted],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      const params = new URLSearchParams()
      if (evidenceType) params.append('evidence_type', evidenceType)
      if (includeDeleted) params.append('include_deleted', 'true')
      
      const queryString = params.toString()
      return fetchWithAuth(`/api/investigation/${caseId}/evidence${queryString ? `?${queryString}` : ''}`, token) as Promise<Evidence[]>
    },
    enabled: !!token && !!caseId,
  })
}

export const useUploadInvestigationEvidence = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, data }: { caseId: number; data: EvidenceCreate & { file?: File } }) => {
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('evidence_type', data.evidence_type)
      if (data.text_content != null && data.text_content !== '') formData.append('text_content', data.text_content)
      if (data.file) formData.append('file', data.file)
      if (data.file_name != null && data.file_name !== '') formData.append('file_name', data.file_name)
      if (data.content_type != null && data.content_type !== '') formData.append('content_type', data.content_type)
      if (data.recording_duration != null) formData.append('recording_duration', String(data.recording_duration))
      if (data.recording_format != null && data.recording_format !== '') formData.append('recording_format', data.recording_format)

      const response = await fetch(`${API_BASE_URL}/api/investigation/${caseId}/evidence`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
        const message = typeof errorData?.detail === 'string' ? errorData.detail : Array.isArray(errorData?.detail) ? errorData.detail.map((e: any) => e?.msg ?? e).join('; ') : 'Upload failed'
        throw new Error(message)
      }

      return response.json() as Promise<Evidence>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidenceList', variables.caseId] })
      queryClient.invalidateQueries({ queryKey: ['complaintDetails'] })
    },
  })
}

export const useUpdateEvidence = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, evidenceId, updateData }: { caseId: number; evidenceId: number; updateData: EvidenceUpdate }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/evidence/${evidenceId}`, token, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      }) as Promise<Evidence>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidenceList', variables.caseId] })
    },
  })
}

export const useDeleteEvidence = () => {
  const { user } = useAuth()
  const token = user?.token || getToken()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ caseId, evidenceId }: { caseId: number; evidenceId: number }) => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/evidence/${evidenceId}`, token, {
        method: 'DELETE',
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidenceList', variables.caseId] })
      queryClient.invalidateQueries({ queryKey: ['deletedEvidence', variables.caseId] })
    },
  })
}

export const useDeletedEvidence = (caseId: number) => {
  const { user } = useAuth()
  const token = user?.token || getToken()

  return useQuery({
    queryKey: ['deletedEvidence', caseId],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated')
      return fetchWithAuth(`/api/investigation/${caseId}/evidence/deleted`, token) as Promise<EvidenceChange[]>
    },
    enabled: !!token && !!caseId,
  })
}
