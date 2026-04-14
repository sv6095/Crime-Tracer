import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Interfaces
export interface TransferRequest {
    id: number
    from_station_id: string
    from_station_name: string
    to_station_id: string
    to_station_name: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    decided_at?: string
}

export interface CreateTransferData {
    to_station_id: string // Backend expects station ID (string usually for stations in this app, but let's verify schema)
}

// Helper
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

// Fetch
const fetchTransferRequests = async (token: string): Promise<TransferRequest[]> => {
    return fetchWithAuth('/cop/me/transfer-requests', token)
}

// Create
const createTransferRequest = async (token: string, toStationId: string) => {
    return fetchWithAuth('/cop/me/transfer-requests', token, {
        method: 'POST',
        body: JSON.stringify({ to_station_id: toStationId }) // Schema says to_station_id
    })
}

// Hooks
export const useTransferRequests = () => {
    const { user } = useAuth()
    const token = localStorage.getItem('auth-token') // Police token usually stored here by legacy logic, or police-token?

    // usePoliceAuth stores in 'police-token'. But 'useAuth' context seems to be generic. 
    // Let's check AuthContext logic. If user is police, token is in token.
    const actualToken = user?.token
    const isCop = user && (user.role === 'police' || user.role === 'COP' || (user as any).is_cop)

    return useQuery({
        queryKey: ['transfer-requests'],
        queryFn: () => fetchTransferRequests(actualToken!),
        enabled: !!(user && actualToken && isCop),
    })
}

export const useCreateTransferRequest = () => {
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const token = user?.token

    return useMutation({
        mutationFn: (toStationId: string) => createTransferRequest(token!, toStationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transfer-requests'] })
        }
    })
}
