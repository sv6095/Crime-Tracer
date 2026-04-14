import React, { useState } from 'react'
import { useCaseChanges, useVerifyIntegrity, EvidenceChange } from '../../hooks/useInvestigationApi'
import { FileText, Shield, CheckCircle, XCircle, Filter, Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChangeLogTableProps {
  caseId: number
}

const ChangeLogTable: React.FC<ChangeLogTableProps> = ({ caseId }) => {
  const [sectionFilter, setSectionFilter] = useState<string>('')
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: changes, isLoading } = useCaseChanges(caseId, {
    section: sectionFilter || undefined,
    change_type: changeTypeFilter || undefined,
  })

  const verifyMutation = useVerifyIntegrity()

  const handleVerify = async (changeIds: string[]) => {
    try {
      const result = await verifyMutation.mutateAsync({ caseId, changeIds })
      if (result.all_valid) {
        toast.success('All selected changes verified successfully')
      } else {
        toast.error('Some changes failed verification')
      }
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    }
  }

  const filteredChanges = (changes || []).filter((change) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        change.user_name.toLowerCase().includes(query) ||
        change.field_changed?.toLowerCase().includes(query) ||
        change.details?.toLowerCase().includes(query) ||
        change.change_id.toLowerCase().includes(query)
      )
    }
    return true
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getChangeTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      INSERT: 'bg-green-500/20 text-green-300',
      UPDATE: 'bg-blue-500/20 text-blue-300',
      DELETE: 'bg-red-500/20 text-red-300',
      APPEND: 'bg-yellow-500/20 text-yellow-300',
      ERASE: 'bg-orange-500/20 text-orange-300',
    }
    return colors[type] || 'bg-white/10 text-white/70'
  }

  return (
    <div className="glass-effect rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold">Immutable Audit Trail</h3>
        </div>
        <button
          onClick={() => {
            // Export functionality
            const csv = [
              ['Change ID', 'Timestamp', 'User', 'Section', 'Type', 'Field', 'Details'].join(','),
              ...(filteredChanges || []).map((c) =>
                [
                  c.change_id,
                  c.timestamp,
                  c.user_name,
                  c.section_modified,
                  c.change_type,
                  c.field_changed || '',
                  c.details || '',
                ].join(',')
              ),
            ].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit_trail_case_${caseId}.csv`
            a.click()
          }}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="form-input pl-10"
          />
        </div>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="form-input bg-white/5"
        >
          <option value="">All Sections</option>
          <option value="case_evidences">Case Evidences</option>
          <option value="personal_diary">Personal Diary</option>
          <option value="case_metadata">Case Metadata</option>
        </select>
        <select
          value={changeTypeFilter}
          onChange={(e) => setChangeTypeFilter(e.target.value)}
          className="form-input bg-white/5"
        >
          <option value="">All Types</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="APPEND">Append</option>
          <option value="ERASE">Erase</option>
        </select>
        <button
          onClick={() => {
            setSectionFilter('')
            setChangeTypeFilter('')
            setSearchQuery('')
          }}
          className="btn-secondary text-sm"
        >
          Clear Filters
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner mr-3" />
          <span className="text-white/70">Loading changes...</span>
        </div>
      ) : filteredChanges.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="h-10 w-10 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No changes found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/60">Change ID</th>
                <th className="text-left py-3 px-4 text-white/60">Timestamp</th>
                <th className="text-left py-3 px-4 text-white/60">User</th>
                <th className="text-left py-3 px-4 text-white/60">Section</th>
                <th className="text-left py-3 px-4 text-white/60">Type</th>
                <th className="text-left py-3 px-4 text-white/60">Field</th>
                <th className="text-left py-3 px-4 text-white/60">Details</th>
                <th className="text-left py-3 px-4 text-white/60">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredChanges.map((change) => (
                <tr key={change.id} className="hover:bg-white/5">
                  <td className="py-3 px-4 font-mono text-xs">{change.change_id}</td>
                  <td className="py-3 px-4">{formatDate(change.timestamp)}</td>
                  <td className="py-3 px-4">{change.user_name}</td>
                  <td className="py-3 px-4">{change.section_modified}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${getChangeTypeBadge(change.change_type)}`}>
                      {change.change_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">{change.field_changed || '-'}</td>
                  <td className="py-3 px-4 max-w-xs truncate">{change.details || '-'}</td>
                  <td className="py-3 px-4">
                    <code className="text-xs font-mono text-white/50">
                      {change.cryptographic_hash.substring(0, 8)}...
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredChanges.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <p className="text-xs text-white/60">
            Showing {filteredChanges.length} of {changes?.length || 0} changes
          </p>
          <button
            onClick={() => handleVerify(filteredChanges.map((c) => c.change_id))}
            disabled={verifyMutation.isPending}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {verifyMutation.isPending ? (
              <div className="spinner w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Verify Integrity
          </button>
        </div>
      )}
    </div>
  )
}

export default ChangeLogTable
