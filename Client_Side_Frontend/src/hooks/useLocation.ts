import { useState, useCallback, useRef } from 'react'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface LocationError {
  code: number
  message: string
}

interface UseLocationReturn {
  location: LocationData | null
  error: LocationError | null
  loading: boolean
  getCurrentLocation: (options?: PositionOptions) => Promise<LocationData>
  clearLocation: () => void
  isLocationSupported: boolean
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [error, setError] = useState<LocationError | null>(null)
  const [loading, setLoading] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  const isLocationSupported = 'geolocation' in navigator

  const clearLocation = useCallback(() => {
    setLocation(null)
    setError(null)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    }
    setLocation(locationData)
    setError(null)
    setLoading(false)
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    let message = 'An unknown error occurred'
    
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable location access in your browser settings.'
        break
      case err.POSITION_UNAVAILABLE:
        message = 'Location information is unavailable. Please check your internet connection and try again.'
        break
      case err.TIMEOUT:
        message = 'Location request timed out. Please try again.'
        break
    }

    const locationError: LocationError = {
      code: err.code,
      message
    }
    
    setError(locationError)
    setLocation(null)
    setLoading(false)
  }, [])

  const getCurrentLocation = useCallback(async (options?: PositionOptions): Promise<LocationData> => {
    if (!isLocationSupported) {
      const error = {
        code: -1,
        message: 'Geolocation is not supported by this browser'
      }
      setError(error)
      throw new Error(error.message)
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
      ...options
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          }
          handleSuccess(position)
          resolve(locationData)
        },
        (err) => {
          handleError(err)
          reject(new Error(`Location error: ${err.message}`))
        },
        defaultOptions
      )
    })
  }, [isLocationSupported, handleSuccess, handleError])

  // const watchPosition = useCallback((options?: PositionOptions): number | null => {
  //   if (!isLocationSupported) {
  //     setError({
  //       code: -1,
  //       message: 'Geolocation is not supported by this browser'
  //     })
  //     return null
  //   }

  //   const defaultOptions: PositionOptions = {
  //     enableHighAccuracy: true,
  //     timeout: 10000,
  //     maximumAge: 300000,
  //     ...options
  //   }

  //   setLoading(true)
  //   setError(null)

  //   const watchId = navigator.geolocation.watchPosition(
  //     handleSuccess,
  //     handleError,
  //     defaultOptions
  //   )

  //   watchIdRef.current = watchId
  //   return watchId
  // }, [isLocationSupported, handleSuccess, handleError])

  // const stopWatching = useCallback(() => {
  //   if (watchIdRef.current !== null) {
  //     navigator.geolocation.clearWatch(watchIdRef.current)
  //     watchIdRef.current = null
  //     setLoading(false)
  //   }
  // }, [])

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    clearLocation,
    isLocationSupported,
  }
}

// Hook for checking location permission status
export const useLocationPermission = () => {
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null)
  const [loading, setLoading] = useState(false)

  const checkPermission = useCallback(async () => {
    if (!('permissions' in navigator)) {
      return null
    }

    setLoading(true)
    
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      setPermissionState(permission.state)
      
      // Listen for permission changes
      permission.onchange = () => {
        setPermissionState(permission.state)
      }
      
      return permission.state
    } catch (error) {
      console.error('Error checking geolocation permission:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<PermissionState | null> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissionState('granted')
          resolve('granted')
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionState('denied')
            resolve('denied')
          } else {
            // Permission might be granted but location unavailable
            setPermissionState('granted')
            resolve('granted')
          }
        },
        { timeout: 1000 }
      )
    })
  }, [])

  return {
    permissionState,
    loading,
    checkPermission,
    requestPermission
  }
}