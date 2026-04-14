import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useStations } from '../hooks/useStations'
import { useTransferRequests, useCreateTransferRequest } from '../hooks/useCopProfile'
import {
    User,
    Shield,
    Building2,
    MapPin,
    ArrowRightLeft,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const CopProfile: React.FC = () => {
    const { user } = useAuth()
    const isCop = user && (user.role === 'police' || user.role === 'COP' || (user as any).is_cop)

    const [selectedStation, setSelectedStation] = useState('')
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)

    const { data: stationsResponse } = useStations()
    const stations = stationsResponse?.data || []

    const { data: transfers = [], isLoading: transfersLoading } = useTransferRequests()
    const createTransferMutation = useCreateTransferRequest()

    const handleTransferRequest = async () => {
        if (!selectedStation) {
            toast.error('Please select a station')
            return
        }

        try {
            await createTransferMutation.mutateAsync(selectedStation)
            toast.success('Transfer request submitted')
            setIsTransferModalOpen(false)
            setSelectedStation('')
        } catch (error: any) {
            toast.error(error.message || 'Failed to request transfer')
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <span className="badge bg-green-500/20 text-green-300 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>
            case 'rejected':
                return <span className="badge bg-red-500/20 text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>
            default:
                return <span className="badge bg-yellow-500/20 text-yellow-200 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
        }
    }

    return (
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--background-dark)', color: 'var(--text-on-dark)' }}>
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-effect rounded-2xl p-8 relative overflow-hidden shadow-elevated"
                >
                    <div className="absolute top-0 right-0 p-32 bg-primary-500/10 blur-3xl rounded-full translate-x-12 -translate-y-12" />

                    <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                            <span className="text-3xl font-heading font-bold text-white">
                                {user?.name?.charAt(0) || 'O'}
                            </span>
                        </div>

                        <div className="flex-1 space-y-2">
                            <h1 className="text-3xl font-heading font-bold">{user?.name}</h1>
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-white/70">
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <Shield className="w-4 h-4 text-primary-300" />
                                    <span>{user?.badge_number || (user as any)?.police_id || 'ID Unknown'}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <Building2 className="w-4 h-4 text-primary-300" />
                                    <span>{(user as any)?.station_name || 'Station Unknown'}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <User className="w-4 h-4 text-primary-300" />
                                    <span>{user?.role?.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Transfer Section (Only for Cops) */}
                {isCop && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-effect rounded-2xl p-6 shadow-soft"
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-heading font-semibold flex items-center gap-2">
                                    <ArrowRightLeft className="w-5 h-5 text-primary-400" />
                                    Transfer Requests
                                </h2>
                                <p className="text-sm text-white/60 mt-1">Manage your station transfer applications.</p>
                            </div>

                            <button
                                onClick={() => setIsTransferModalOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <ArrowRightLeft className="w-4 h-4" />
                                Request Transfer
                            </button>
                        </div>

                        {transfersLoading ? (
                            <div className="py-8 text-center text-white/50 animate-pulse">Loading history...</div>
                        ) : transfers.length === 0 ? (
                            <div className="bg-white/5 rounded-xl p-8 text-center text-white/60 border border-white/5 border-dashed">
                                <ArrowRightLeft className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                <p>No transfer history found.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl bg-white/5 border border-white/5">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-white/5 text-white/70 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">To Station</th>
                                            <th className="px-6 py-4 font-medium">Date</th>
                                            <th className="px-6 py-4 font-medium">Status</th>
                                            <th className="px-6 py-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-white/90">
                                        {transfers.map((req: any) => (
                                            <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium">{req.to_station_name}</div>
                                                    <div className="text-xs text-white/50">ID: {req.to_station_id}</div>
                                                </td>
                                                <td className="px-6 py-4 text-white/70">
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(req.status)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {/* Actions could go here */}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Transfer Request Modal */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-effect rounded-2xl w-full max-w-md p-6 shadow-elevated"
                    >
                        <h3 className="text-xl font-heading font-semibold mb-2">Request Station Transfer</h3>
                        <p className="text-sm text-white/60 mb-6">
                            Select the station you wish to be transferred to. This request will be sent to admin for approval.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-1">Target Station</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                    <select
                                        value={selectedStation}
                                        onChange={(e) => setSelectedStation(e.target.value)}
                                        className="form-input pl-10 bg-white/5 appearance-none"
                                    >
                                        <option value="" className="bg-gray-900">Select a station...</option>
                                        {stations.map((s) => (
                                            <option key={s.id} value={s.id} className="bg-gray-900">
                                                {s.station_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                                <p className="text-xs text-yellow-100/80">
                                    Note: Pending cases assigned to you must be re-assigned or closed before transfer finalization.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleTransferRequest}
                                    disabled={createTransferMutation.isPending || !selectedStation}
                                    className="btn-primary flex-1 flex justify-center items-center gap-2"
                                >
                                    {createTransferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Submit Request
                                </button>
                                <button
                                    onClick={() => setIsTransferModalOpen(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

        </div>
    )
}

export default CopProfile
