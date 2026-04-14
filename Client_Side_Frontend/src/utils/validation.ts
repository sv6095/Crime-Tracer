import { z } from 'zod'

// Phone number validation (supports international formats)
export const phoneSchema = z.string()
  .regex(/^[\+]?[0-9\s\-\(\)]{10,15}$/, 'Invalid phone number format')
  .transform(str => str.replace(/\s/g, ''))

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .min(1, 'Email is required')

// Password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number')

// Complaint form validation schema
export const complaintSchema = z.object({
  // Personal Information
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  
  phone: phoneSchema,
  
  email: z.string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  
  address: z.string()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address must not exceed 500 characters'),
  
  // Incident Information
  incidentType: z.string()
    .min(1, 'Please select an incident type'),
  
  incidentDate: z.string()
    .min(1, 'Incident date is required')
    .refine((date) => {
      const incidentDate = new Date(date)
      const today = new Date()
      return incidentDate <= today
    }, 'Incident date cannot be in the future'),
  
  incidentTime: z.string()
    .min(1, 'Incident time is required')
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  
  incidentLocation: z.string()
    .min(10, 'Incident location must be at least 10 characters')
    .max(500, 'Incident location must not exceed 500 characters'),
  
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description must not exceed 2000 characters'),
  
  // Optional fields
  suspectDetails: z.string()
    .max(1000, 'Suspect details must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  
  witnessDetails: z.string()
    .max(1000, 'Witness details must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  
  // Location coordinates (optional)
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  
  // Selected station
  stationId: z.string()
    .min(1, 'Please select a police station'),
  
  // Evidence files
  photos: z.array(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
})

// Track complaint validation schema
export const trackComplaintSchema = z.object({
  searchType: z.enum(['id', 'phone'], {
    required_error: 'Please select a search method',
  }),
  
  complaintId: z.string()
    .min(1, 'Complaint ID is required')
    .optional(),
  
  phone: phoneSchema.optional(),
}).refine((data) => {
  if (data.searchType === 'id' && !data.complaintId) {
    return false
  }
  if (data.searchType === 'phone' && !data.phone) {
    return false
  }
  return true
}, {
  message: 'Please provide the required information for the selected search method',
  path: ['searchType'],
})

// Police registration schema
export const policeRegistrationSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  
  email: emailSchema,
  
  password: passwordSchema,
  
  confirmPassword: z.string(),
  
  badgeNumber: z.string()
    .min(3, 'Badge number must be at least 3 characters')
    .max(20, 'Badge number must not exceed 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Badge number must contain only uppercase letters and numbers'),
  
  rank: z.string()
    .min(1, 'Please select a rank'),
  
  station: z.string()
    .min(1, 'Please select a station'),
  
  phone: phoneSchema,
  
  department: z.string()
    .min(1, 'Please select a department'),
  
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

// Police login schema
export const policeLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

// Station schema
export const stationSchema = z.object({
  name: z.string()
    .min(2, 'Station name must be at least 2 characters')
    .max(100, 'Station name must not exceed 100 characters'),
  
  address: z.string()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address must not exceed 500 characters'),
  
  phone: phoneSchema,
  
  email: emailSchema.optional().or(z.literal('')),
  
  latitude: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude'),
  
  longitude: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude'),
  
  jurisdiction: z.string()
    .min(2, 'Jurisdiction must be at least 2 characters')
    .max(100, 'Jurisdiction must not exceed 100 characters'),
})

// Status update schema
export const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'investigating', 'resolved', 'closed'], {
    required_error: 'Please select a status',
  }),
  
  comment: z.string()
    .min(10, 'Comment must be at least 10 characters')
    .max(1000, 'Comment must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
})

// Contact form schema
export const contactSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  
  email: emailSchema,
  
  subject: z.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must not exceed 200 characters'),
  
  message: z.string()
    .min(20, 'Message must be at least 20 characters')
    .max(2000, 'Message must not exceed 2000 characters'),
})

// Admin approval schema
export const approvalSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: 'Please select an action',
  }),
  
  reason: z.string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
}).refine((data) => {
  if (data.action === 'reject' && !data.reason) {
    return false
  }
  return true
}, {
  message: 'Reason is required when rejecting',
  path: ['reason'],
})

// File upload validation
export const fileSchema = z.object({
  file: z.any()
    .refine((file) => file instanceof File, 'Must be a valid file')
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB'), // 10MB limit
})

// Photo validation
export const photoSchema = z.object({
  file: z.any()
    .refine((file) => file instanceof File, 'Must be a valid file')
    .refine((file) => file.size <= 5 * 1024 * 1024, 'Image size must be less than 5MB') // 5MB limit
    .refine((file) => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      return validTypes.includes(file.type)
    }, 'Only JPEG, PNG, and WebP images are allowed'),
})

// Location validation
export const locationSchema = z.object({
  latitude: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude'),
  
  longitude: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude'),
})

// Utility function to validate form data
export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown) => {
  try {
    return { success: true, data: schema.parse(data), errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      return { success: false, data: null, errors }
    }
    return { success: false, data: null, errors: { general: 'Validation failed' } }
  }
}

// Type exports
export type ComplaintFormData = z.infer<typeof complaintSchema>
export type TrackComplaintData = z.infer<typeof trackComplaintSchema>
export type PoliceRegistrationData = z.infer<typeof policeRegistrationSchema>
export type PoliceLoginData = z.infer<typeof policeLoginSchema>
export type StationData = z.infer<typeof stationSchema>
export type StatusUpdateData = z.infer<typeof statusUpdateSchema>
export type ContactData = z.infer<typeof contactSchema>
export type ApprovalData = z.infer<typeof approvalSchema>
export type LocationData = z.infer<typeof locationSchema>