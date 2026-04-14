import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPin, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Navigation, 
  Loader2, 
  AlertCircle,
  Check
} from 'lucide-react'
import { useStations, useAutoDetectStation, Station } from '../hooks/useStations'

interface StationSelectorProps {
  value?: number | null
  onChange: (stationId: number | null, station?: Station) => void
  placeholder?: string
  className?: string
  error?: string
  required?: boolean
  showAutoDetect?: boolean
  label?: string
}

const StationSelector: React.FC<StationSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select a police station",
  className = "",
  error,
  required = false,
  showAutoDetect = true,
  label = "Police Station"
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Fetch all stations
  const { 
    data: stationsResponse, 
    isLoading: isLoadingStations, 
    error: stationsError 
  } = useStations({
    search: searchQuery || undefined,
    limit: 50
  })
  
  // Auto-detect nearest stations
  const {
    location,
    locationError,
    isDetecting,
    detectLocation,
    nearestStations,
    isLoading: isLoadingNearest
  } = useAutoDetectStation({
    limit: 3,
    max_distance_km: 25,
    enabled: showAutoDetect
  })

  const stations = stationsResponse?.data || []

  // Find selected station details
  useEffect(() => {
    if (value && stations.length > 0) {
      const station = stations.find(s => s.id === value) || nearestStations.find(s => s.id === value)
      setSelectedStation(station || null)
    } else {
      setSelectedStation(null)
    }
  }, [value, stations, nearestStations])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStationSelect = (station: Station) => {
    setSelectedStation(station)
    onChange(station.id, station)
    setIsOpen(false)
    setSearchQuery("")
  }

  const handleAutoDetect = () => {
    detectLocation()
  }

  // Filter stations based on search
  const filteredStations = stations.filter(station =>
    station.station_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    station.station_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    station.address?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hasError = error || stationsError || locationError

  return (
    <div className={`relative ${className}`} style={{ zIndex: isOpen ? 9998 : 'auto' }}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Main selector */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between px-3 py-2 
            border rounded-md shadow-sm bg-white text-left
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            transition-colors
            ${hasError ? 'border-red-300' : 'border-gray-300'}
            ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
          `}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className={`truncate ${selectedStation ? 'text-gray-900' : 'text-gray-500'}`}>
              {selectedStation ? (
                <span>
                  <span className="font-medium">{selectedStation.station_name}</span>
                  {selectedStation.distance_km && (
                    <span className="text-sm text-gray-500 ml-1">
                      ({selectedStation.distance_km}km away)
                    </span>
                  )}
                </span>
              ) : (
                placeholder
              )}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-96 overflow-hidden"
              style={{ maxHeight: '384px' }}
            >
              {/* Search input */}
              <div className="p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stations..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Auto-detect section */}
              {showAutoDetect && (
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={isDetecting}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDetecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isDetecting ? 'Detecting Location...' : 'Find Nearest Stations'}
                    </span>
                  </button>

                  {/* Show nearest stations */}
                  {location && nearestStations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-2">Nearest stations:</p>
                      {nearestStations.slice(0, 3).map((station) => (
                        <button
                          key={`nearest-${station.id}`}
                          type="button"
                          onClick={() => handleStationSelect(station)}
                          className="w-full text-left px-2 py-1 text-xs bg-white border border-gray-200 rounded mb-1 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-900 truncate">
                              {station.station_name}
                            </span>
                            <span className="text-gray-500 ml-2">
                              {station.distance_km}km
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {locationError && (
                    <div className="mt-2 flex items-center space-x-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>{locationError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Stations list */}
              <div className="max-h-64 overflow-y-auto">
                {isLoadingStations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading stations...</span>
                  </div>
                ) : filteredStations.length > 0 ? (
                  filteredStations.map((station) => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => handleStationSelect(station)}
                      className={`
                        w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                        border-b border-gray-100 last:border-b-0 transition-colors
                        ${selectedStation?.id === station.id ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Station Name - on top */}
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900 truncate">
                              {station.station_name}
                            </span>
                            {selectedStation?.id === station.id && (
                              <Check className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          {/* GPS and Location - below */}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{station.station_code}</span>
                              {station.officer_count && (
                                <span>• {station.officer_count} officers</span>
                              )}
                              {station.distance_km && (
                                <span className="text-blue-600 font-medium">• {station.distance_km}km away</span>
                              )}
                            </div>
                            {station.address && (
                              <p className="text-xs text-gray-400 truncate">
                                📍 {station.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : searchQuery ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No stations found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No stations available
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export default StationSelector