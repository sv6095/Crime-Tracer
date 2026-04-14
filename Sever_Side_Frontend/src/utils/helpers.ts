// Date and time utilities
export const formatDate = (date: string | Date): string => {
  const dateObj = new Date(date)
  return dateObj.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':')
  const hour24 = parseInt(hours)
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour12}:${minutes} ${ampm}`
}

export const formatDateTime = (dateTime: string | Date): string => {
  const dateObj = new Date(dateTime)
  return dateObj.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date()
  const dateObj = new Date(date)
  const diffInMs = now.getTime() - dateObj.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  
  return formatDate(dateObj)
}

// String utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const capitalizeWords = (text: string): string => {
  return text.split(' ').map(word => capitalizeFirst(word)).join(' ')
}

export const generateId = (prefix = 'CT'): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 5)
  return `${prefix}${timestamp}${random}`.toUpperCase()
}

// Phone number utilities
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Handle Indian phone numbers
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  
  // Handle international numbers with country code
  if (cleaned.length > 10) {
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`
    }
    return `+${cleaned}`
  }
  
  return phone
}

export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

// Location utilities
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c // Distance in kilometers
}

export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }
  return `${distance.toFixed(1)}km`
}

// File utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
  return imageExtensions.includes(getFileExtension(filename))
}

export const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob(resolve as BlobCallback, 'image/jpeg', quality)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

// Status utilities
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'pending': 'orange',
    'investigating': 'blue',
    'resolved': 'green',
    'closed': 'gray',
    'rejected': 'red'
  }
  return statusColors[status.toLowerCase()] || 'gray'
}

export const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'pending': 'Pending Review',
    'investigating': 'Under Investigation',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'rejected': 'Rejected'
  }
  return statusLabels[status.toLowerCase()] || capitalizeFirst(status)
}

// Clipboard utilities
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      textArea.remove()
      return result
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

// URL utilities
export const createObjectURL = (file: File | Blob): string => {
  return URL.createObjectURL(file)
}

export const revokeObjectURL = (url: string): void => {
  URL.revokeObjectURL(url)
}

// Array utilities
export const sortByDate = <T>(array: T[], dateKey: keyof T, ascending = false): T[] => {
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateKey] as string).getTime()
    const dateB = new Date(b[dateKey] as string).getTime()
    return ascending ? dateA - dateB : dateB - dateA
  })
}

export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const group = String(item[key])
    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue || null
    } catch {
      return defaultValue || null
    }
  },
  
  set: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  },
  
  remove: (key: string): void => {
    localStorage.removeItem(key)
  },
  
  clear: (): void => {
    localStorage.clear()
  }
}

// Debounce utility
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

// Theme utilities
export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Error utilities
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unexpected error occurred'
}

// Incident type utilities
export const getIncidentTypes = () => [
  'Theft',
  'Robbery',
  'Assault',
  'Domestic Violence',
  'Fraud',
  'Cybercrime',
  'Vandalism',
  'Drug Related',
  'Traffic Accident',
  'Missing Person',
  'Harassment',
  'Other'
]

// Police ranks
export const getPoliceRanks = () => [
  'Constable',
  'Head Constable',
  'Assistant Sub-Inspector',
  'Sub-Inspector',
  'Inspector',
  'Deputy Superintendent',
  'Superintendent',
  'Deputy Inspector General',
  'Inspector General',
  'Director General'
]

// Police departments
export const getPoliceDepartments = () => [
  'Crime Branch',
  'Traffic Police',
  'Special Branch',
  'Law and Order',
  'Cybercrime',
  'Women and Child Safety',
  'Anti-Corruption',
  'Intelligence',
  'Armed Reserve',
  'Administrative'
]