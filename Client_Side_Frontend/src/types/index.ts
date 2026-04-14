// User and Authentication Types
export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: 'citizen' | 'police' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface PoliceOfficer extends User {
  role: 'police'
  badgeNumber: string
  rank: string
  department: string
  stationId: string
  isApproved: boolean
  approvedBy?: string
  approvedAt?: string
}

export interface Admin extends User {
  role: 'admin'
  permissions: string[]
}

// Station Types
export interface Station {
  id: string
  name: string
  address: string
  phone: string
  email?: string
  latitude: number
  longitude: number
  jurisdiction: string
  station_code?: string
  officer_count?: number
  distance?: number
  createdAt: string
  updatedAt: string
}

// Complaint Types
export interface Complaint {
  id: string
  complaintNumber: string
  fullName: string
  phone: string
  email?: string
  address: string
  incidentType: string
  incidentDate: string
  incidentTime: string
  incidentLocation: string
  description: string
  suspectDetails?: string
  witnessDetails?: string
  latitude?: number
  longitude?: number
  stationId: string
  station?: Station
  status: ComplaintStatus
  priority: ComplaintPriority
  assignedOfficer?: string
  officerDetails?: PoliceOfficer
  photos?: string[]
  attachments?: string[]
  statusHistory: StatusUpdate[]
  createdAt: string
  updatedAt: string
}

export type ComplaintStatus = 'pending' | 'investigating' | 'resolved' | 'closed' | 'rejected'

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface StatusUpdate {
  id: string
  complaintId: string
  status: ComplaintStatus
  comment?: string
  updatedBy: string
  updatedByName: string
  updatedAt: string
}

// Form Types
export interface ComplaintFormData {
  fullName: string
  phone: string
  email?: string
  address: string
  incidentType: string
  incidentDate: string
  incidentTime: string
  incidentLocation: string
  description: string
  suspectDetails?: string
  witnessDetails?: string
  latitude?: number
  longitude?: number
  stationId: string
  photos?: File[]
  attachments?: File[]
}

export interface TrackComplaintFormData {
  searchType: 'id' | 'phone'
  complaintId?: string
  phone?: string
}

export interface PoliceLoginData {
  email: string
  password: string
}

export interface PoliceRegistrationData {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  badgeNumber: string
  rank: string
  station: string
  phone: string
  department: string
}

// Analytics Types
export interface AnalyticsData {
  totalComplaints: number
  pendingComplaints: number
  resolvedComplaints: number
  averageResolutionTime: number
  complaintsByType: Record<string, number>
  complaintsByStation: Record<string, number>
  monthlyTrends: Array<{
    month: string
    complaints: number
    resolved: number
  }>
  statusDistribution: Array<{
    status: string
    count: number
    percentage: number
  }>
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  errors?: Record<string, string>
}

export interface PaginatedResponse<T = any> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Location Types
export interface LocationCoords {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp?: number
}

export interface LocationError {
  code: number
  message: string
}

// File Upload Types
export interface FileUpload {
  file: File
  url?: string
  uploadProgress?: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export interface UploadResponse {
  success: boolean
  url: string
  filename: string
  size: number
  mimeType: string
}

// Toast/Notification Types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

// Navigation Types
export interface NavItem {
  label: string
  href: string
  icon?: React.ComponentType<any>
  isActive?: boolean
  badge?: string | number
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system'

// Form Validation Types
export interface ValidationError {
  field: string
  message: string
}

export interface FormState<T = any> {
  data: T
  errors: Record<string, string>
  isValid: boolean
  isSubmitting: boolean
  isDirty: boolean
}

// Filter Types
export interface ComplaintFilters {
  status?: ComplaintStatus[]
  priority?: ComplaintPriority[]
  incidentType?: string[]
  stationId?: string
  assignedOfficer?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface StationFilters {
  jurisdiction?: string
  search?: string
}

// Permission Types
export type Permission = 
  | 'view_complaints'
  | 'update_complaint_status'
  | 'assign_complaints'
  | 'view_analytics'
  | 'manage_officers'
  | 'manage_stations'
  | 'system_admin'

// Settings Types
export interface UserSettings {
  theme: Theme
  language: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
  privacy: {
    showProfile: boolean
    allowContact: boolean
  }
}

export interface SystemSettings {
  siteName: string
  contactEmail: string
  contactPhone: string
  maxFileSize: number
  allowedFileTypes: string[]
  maintenanceMode: boolean
  registrationEnabled: boolean
  features: {
    geoLocation: boolean
    fileUploads: boolean
    smsNotifications: boolean
    emailNotifications: boolean
  }
}

// Incident Types
export type IncidentType = 
  | 'Theft'
  | 'Robbery'
  | 'Assault'
  | 'Domestic Violence'
  | 'Fraud'
  | 'Cybercrime'
  | 'Vandalism'
  | 'Drug Related'
  | 'Traffic Accident'
  | 'Missing Person'
  | 'Harassment'
  | 'Other'

// Police Ranks
export type PoliceRank = 
  | 'Constable'
  | 'Head Constable'
  | 'Assistant Sub-Inspector'
  | 'Sub-Inspector'
  | 'Inspector'
  | 'Deputy Superintendent'
  | 'Superintendent'
  | 'Deputy Inspector General'
  | 'Inspector General'
  | 'Director General'

// Police Departments
export type PoliceDepartment = 
  | 'Crime Branch'
  | 'Traffic Police'
  | 'Special Branch'
  | 'Law and Order'
  | 'Cybercrime'
  | 'Women and Child Safety'
  | 'Anti-Corruption'
  | 'Intelligence'
  | 'Armed Reserve'
  | 'Administrative'

// Component Props Types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface LoadingState {
  loading: boolean
  error?: string | null
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]