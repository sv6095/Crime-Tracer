import { useState, useCallback, useRef } from 'react'

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

interface UseToastReturn {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearAllToasts: () => void
  success: (title: string, description?: string, duration?: number) => string
  error: (title: string, description?: string, duration?: number) => string
  warning: (title: string, description?: string, duration?: number) => string
  info: (title: string, description?: string, duration?: number) => string
}

export const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutRefs = useRef<Map<string, number>>(new Map())

  const removeToast = useCallback((id: string) => {
    // Clear the timeout if it exists
    const timeoutId = timeoutRefs.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefs.current.delete(id)
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((toastData: Omit<Toast, 'id'>): string => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = {
      id,
      duration: 5000, // Default 5 seconds
      ...toastData,
    }

    setToasts((prev) => [...prev, toast])

    // Auto-remove toast after duration
    if (toast.duration && toast.duration > 0) {
      const timeoutId = setTimeout(() => {
        removeToast(id)
      }, toast.duration)
      
      timeoutRefs.current.set(id, timeoutId)
    }

    return id
  }, [removeToast])

  const clearAllToasts = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })
    timeoutRefs.current.clear()
    
    setToasts([])
  }, [])

  // Convenience methods for different toast types
  const success = useCallback((title: string, description?: string, duration?: number): string => {
    return addToast({
      type: 'success',
      title,
      description,
      duration,
    })
  }, [addToast])

  const error = useCallback((title: string, description?: string, duration?: number): string => {
    return addToast({
      type: 'error',
      title,
      description,
      duration: duration || 7000, // Errors stay longer by default
    })
  }, [addToast])

  const warning = useCallback((title: string, description?: string, duration?: number): string => {
    return addToast({
      type: 'warning',
      title,
      description,
      duration,
    })
  }, [addToast])

  const info = useCallback((title: string, description?: string, duration?: number): string => {
    return addToast({
      type: 'info',
      title,
      description,
      duration,
    })
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  }
}

// Hook for displaying loading toasts
export const useLoadingToast = () => {
  const { addToast, removeToast } = useToast()

  const showLoadingToast = useCallback((message: string): string => {
    return addToast({
      type: 'info',
      title: message,
      duration: 0, // Don't auto-remove
    })
  }, [addToast])

  const updateToast = useCallback((id: string, type: 'success' | 'error', title: string, description?: string) => {
    removeToast(id)
    return addToast({
      type,
      title,
      description,
      duration: type === 'error' ? 7000 : 5000,
    })
  }, [addToast, removeToast])

  return {
    showLoadingToast,
    updateToast,
    removeToast,
  }
}

// Predefined common toasts
export const commonToasts = {
  locationSuccess: (accuracy?: number) => ({
    type: 'success' as const,
    title: 'Location captured successfully',
    description: accuracy ? `Accuracy: ${accuracy.toFixed(0)} meters` : undefined,
  }),
  
  locationError: (message?: string) => ({
    type: 'error' as const,
    title: 'Failed to get location',
    description: message || 'Please enable location services and try again',
  }),
  
  photoSuccess: () => ({
    type: 'success' as const,
    title: 'Photo captured successfully',
  }),
  
  photoError: (message?: string) => ({
    type: 'error' as const,
    title: 'Failed to capture photo',
    description: message || 'Please check camera permissions and try again',
  }),
  
  fileUploadSuccess: (fileName: string) => ({
    type: 'success' as const,
    title: 'File uploaded successfully',
    description: fileName,
  }),
  
  fileUploadError: (message?: string) => ({
    type: 'error' as const,
    title: 'Failed to upload file',
    description: message || 'Please check your internet connection and try again',
  }),
  
  complaintSubmitSuccess: (complaintId: string) => ({
    type: 'success' as const,
    title: 'Complaint submitted successfully',
    description: `Your complaint ID is: ${complaintId}`,
    action: {
      label: 'Copy ID',
      onClick: () => {
        navigator.clipboard?.writeText(complaintId)
      }
    }
  }),
  
  complaintSubmitError: (message?: string) => ({
    type: 'error' as const,
    title: 'Failed to submit complaint',
    description: message || 'Please check your internet connection and try again',
  }),
  
  copySuccess: () => ({
    type: 'success' as const,
    title: 'Copied to clipboard',
  }),
  
  copyError: () => ({
    type: 'error' as const,
    title: 'Failed to copy',
    description: 'Please copy the text manually',
  }),
  
  loginSuccess: (name: string) => ({
    type: 'success' as const,
    title: 'Login successful',
    description: `Welcome back, ${name}!`,
  }),
  
  loginError: (message?: string) => ({
    type: 'error' as const,
    title: 'Login failed',
    description: message || 'Please check your credentials and try again',
  }),
  
  registrationSuccess: () => ({
    type: 'success' as const,
    title: 'Registration successful',
    description: 'Your account is pending approval by admin',
  }),
  
  registrationError: (message?: string) => ({
    type: 'error' as const,
    title: 'Registration failed',
    description: message || 'Please check your information and try again',
  }),
  
  statusUpdateSuccess: (status: string) => ({
    type: 'success' as const,
    title: 'Status updated successfully',
    description: `Complaint status changed to: ${status}`,
  }),
  
  statusUpdateError: (message?: string) => ({
    type: 'error' as const,
    title: 'Failed to update status',
    description: message || 'Please try again later',
  }),
  
  networkError: () => ({
    type: 'error' as const,
    title: 'Network error',
    description: 'Please check your internet connection and try again',
  }),
  
  permissionDenied: (permission: string) => ({
    type: 'warning' as const,
    title: `${permission} permission denied`,
    description: `Please enable ${permission.toLowerCase()} permission in browser settings`,
  }),
  
  featureNotSupported: (feature: string) => ({
    type: 'warning' as const,
    title: `${feature} not supported`,
    description: 'This feature is not supported in your current browser',
  }),
}