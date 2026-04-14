import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react'

const Login: React.FC = () => {
  const [userType] = useState<'police' | 'admin'>('police')
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/police'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(credential, password, userType)
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Demo credentials helper
  const fillDemoCredentials = (cred: string, pwd: string) => {
    setCredential(cred)
    setPassword(pwd)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Police Login
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the police portal
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white py-8 px-6 shadow-lg rounded-lg"
        >

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 rounded-md p-4"
              >
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="credential" className="block text-sm font-medium text-gray-700">
                Police ID / Email
              </label>
              <input
                id="credential"
                type="text"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter police ID or email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Sign in as Police'
                )}
              </button>
            </div>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">Demo Credentials:</p>
            <div className="space-y-3 text-xs">
              <div className="bg-green-50 p-3 rounded">
                <p className="font-semibold text-green-800 mb-2">Police Officers:</p>
                <div className="space-y-1">
                  <p className="text-green-600">ADMIN002 / admin456</p>
                  <p className="text-green-600">POL001 / police123</p>
                  <p className="text-green-600">POL002 / police456</p>
                  <p className="text-green-600">POL003 / police789</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => fillDemoCredentials('ADMIN002', 'admin456')}
                className="flex-1 py-1 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Fill ADMIN002
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('POL001', 'police123')}
                className="flex-1 py-1 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Fill POL001
              </button>
            </div>
          </div>
        </motion.div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Crime Tracer - Secure Law Enforcement Portal
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login