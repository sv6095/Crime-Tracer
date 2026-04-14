import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useStations,
  useCreateStation,
  useUpdateStation,
  useDeleteStation,
  type Station,
  type CreateStationData,
  type UpdateStationData
} from '../hooks/useAdminApi'
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  Building2,
  Users,
  Navigation,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  X,
  Map,
  Compass
} from 'lucide-react'
import toast from 'react-hot-toast'

interface StationFormData {
  station_name: string
  station_code: string
  address?: string
  phone?: string
  email?: string
  station_lat?: number
  station_lng?: number
}

const StationManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [formData, setFormData] = useState<StationFormData>({
    station_name: '',
    station_code: '',
    address: '',
    phone: '',
    email: '',
    station_lat: undefined,
    station_lng: undefined
  })
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // API hooks
  const { data: stationsResponse, isLoading: stationsLoading, error: stationsError } = useStations({
    limit: 100
  })
  
  const createStationMutation = useCreateStation()
  const updateStationMutation = useUpdateStation()
  const deleteStationMutation = useDeleteStation()

  const stations = stationsResponse?.data || []

  // Utility functions
  const resetForm = () => {
    setFormData({
      station_name: '',
      station_code: '',
      address: '',
      phone: '',
      email: '',
      station_lat: undefined,
      station_lng: undefined
    })
  }

  const formatCoordinates = (lat?: number, lng?: number): string => {
    if (!lat || !lng) return 'Not available'
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  // Get current location
  const getCurrentLocation = async () => {
    setIsGettingLocation(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        })
      })
      
      setFormData(prev => ({
        ...prev,
        station_lat: position.coords.latitude,
        station_lng: position.coords.longitude
      }))
      toast.success('Location captured successfully')
    } catch (error: any) {
      toast.error('Failed to get current location. Please enter coordinates manually.')
    } finally {
      setIsGettingLocation(false)
    }
  }

  // Filter functions
  const filteredStations = stations.filter(station =>
    station.station_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    station.station_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    station.address?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Action handlers
  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const stationData: CreateStationData = {
        station_name: formData.station_name,
        station_code: formData.station_code,
        ...(formData.address && { address: formData.address }),
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.email && { email: formData.email }),
        ...(formData.station_lat && { station_lat: formData.station_lat }),
        ...(formData.station_lng && { station_lng: formData.station_lng })
      }

      await createStationMutation.mutateAsync(stationData)
      toast.success('Station created successfully')
      setShowCreateModal(false)
      resetForm()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create station')
    }
  }

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStation) return

    try {
      const updateData: UpdateStationData = {
        station_name: formData.station_name,
        station_code: formData.station_code,
        ...(formData.address && { address: formData.address }),
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.email && { email: formData.email }),
        ...(formData.station_lat && { station_lat: formData.station_lat }),
        ...(formData.station_lng && { station_lng: formData.station_lng })
      }

      await updateStationMutation.mutateAsync({
        stationId: selectedStation.id,
        stationData: updateData
      })
      toast.success('Station updated successfully')
      setShowEditModal(false)
      setSelectedStation(null)
      resetForm()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update station')
    }
  }

  const handleDeleteStation = async () => {
    if (!selectedStation) return

    try {
      await deleteStationMutation.mutateAsync(selectedStation.id)
      toast.success('Station deleted successfully')
      setShowDeleteModal(false)
      setSelectedStation(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete station')
    }
  }

  const openEditModal = (station: Station) => {
    setSelectedStation(station)
    setFormData({
      station_name: station.station_name,
      station_code: station.station_code,
      address: station.address || '',
      phone: station.phone || '',
      email: station.email || '',
      station_lat: station.station_lat,
      station_lng: station.station_lng
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (station: Station) => {
    setSelectedStation(station)
    setShowDeleteModal(true)
  }

  if (stationsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Stations</h3>
          <p className="text-gray-600">{stationsError.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Building2 className="h-8 w-8 mr-3 text-blue-600" />
            Station Management
          </h2>
          <p className="text-gray-600 mt-1">Manage police stations and their information</p>
        </div>
        
        <button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Station
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full"
          />
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Showing {filteredStations.length} of {stations.length} stations
        </div>
      </div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stationsLoading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading stations...</span>
          </div>
        ) : filteredStations.length > 0 ? (
          filteredStations.map((station, index) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {station.station_name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {station.station_code}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => openEditModal(station)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="Edit station"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(station)}
                      className="text-red-600 hover:text-red-900 p-1 rounded"
                      title="Delete station"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  {/* Address */}
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-600">
                      {station.address || 'Address not specified'}
                    </span>
                  </div>

                  {/* Officers Count */}
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {station.officer_count} officers
                    </span>
                  </div>

                  {/* Contact Info */}
                  {(station.phone || station.email) && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      {station.phone && (
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{station.phone}</span>
                        </div>
                      )}
                      {station.email && (
                        <div className="flex items-center">
                          <Mail className="w-3 h-3 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{station.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coordinates */}
                  <div className="flex items-center pt-2 border-t border-gray-100">
                    <Navigation className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {formatCoordinates(station.station_lat, station.station_lng)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stations found</h3>
            <p>No stations match your current search criteria.</p>
          </div>
        )}
      </div>

      {/* Create Station Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          >
            <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
              <form onSubmit={handleCreateStation}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Create New Station</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Station Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.station_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, station_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Central Police Station"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Station Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.station_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, station_code: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., CPS001"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter complete address..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., +91-9876543210"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., central@police.gov.in"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Location Coordinates
                    </label>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.station_lat || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, station_lat: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 28.6139"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Longitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.station_lng || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, station_lng: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 77.2090"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Compass className="w-4 h-4 mr-2" />
                      )}
                      Use Current Location
                    </button>
                  </div>
                </div>

                <div className="flex space-x-4 pt-6 border-t mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStationMutation.isPending}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createStationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Create Station'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Station Modal */}
      <AnimatePresence>
        {showEditModal && selectedStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          >
            <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
              <form onSubmit={handleUpdateStation}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Edit Station - {selectedStation.station_code}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedStation(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Station Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.station_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, station_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Station Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.station_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, station_code: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Location Coordinates
                    </label>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.station_lat || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, station_lat: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Longitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.station_lng || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, station_lng: e.target.value ? Number(e.target.value) : undefined }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isGettingLocation ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Compass className="w-4 h-4 mr-2" />
                      )}
                      Update to Current Location
                    </button>
                  </div>
                </div>

                <div className="flex space-x-4 pt-6 border-t mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedStation(null)
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateStationMutation.isPending}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateStationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Station Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          >
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 shadow-lg rounded-md bg-white">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Station</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{selectedStation.station_name}</strong> ({selectedStation.station_code})?
                  This action cannot be undone and may affect officers assigned to this station.
                </p>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedStation(null)
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteStation}
                    disabled={deleteStationMutation.isPending}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteStationMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Delete Station'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StationManagement