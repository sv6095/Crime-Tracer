import React, { useState, useEffect, useRef } from 'react'
import { Complaint, useComplaintDetails, useAssignComplaint } from '../../hooks/usePoliceApi'
import EvidenceUploader from './EvidenceUploader'
import ChangeLogTable from './ChangeLogTable'
import { useEvidenceList, useDeletedEvidence, useUploadInvestigationEvidence, Evidence } from '../../hooks/useInvestigationApi'
import { FileText, Shield, Plus, X, Loader2, AlertCircle, CheckCircle, AlertTriangle, Upload, File, Edit2, Trash2, History } from 'lucide-react'
import toast from 'react-hot-toast'

interface CaseDetailViewProps {
  complaint: Complaint
  onClose: () => void
  onAccept?: () => void
  onReject?: () => void
}

const CaseDetailView: React.FC<CaseDetailViewProps> = ({ complaint, onClose, onAccept, onReject }) => {
  const [activeSection, setActiveSection] = useState<'evidences' | 'evidence_upload' | 'changes'>('evidences')
  const [showEvidenceUploader, setShowEvidenceUploader] = useState(false)
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
  const [showDeletedEvidence, setShowDeletedEvidence] = useState(false)
  const [caseId, setCaseId] = useState<number | null>(null)
  
  // Check if case is assigned
  const isAssigned = !!(complaint.assigned_police_id || complaint.status === 'INVESTIGATING')
  const assignComplaintMutation = useAssignComplaint()
  
  // Handle accept assignment
  const handleAccept = async () => {
    if (onAccept) {
      onAccept()
    } else {
      try {
        await assignComplaintMutation.mutateAsync(complaint.complaint_id)
        toast.success('Complaint assigned successfully')
        onClose() // Close modal after successful assignment
      } catch (error: any) {
        toast.error(error?.message || 'Failed to assign complaint')
      }
    }
  }
  
  // Handle reject
  const handleReject = () => {
    // Close this modal first
    onClose()
    // Then call the reject handler (which will open comment modal)
    if (onReject) {
      // Use setTimeout to ensure modal closes before opening new one
      setTimeout(() => {
        onReject()
      }, 100)
    }
  }

  // Fetch complaint details to get the integer ID
  const { data: complaintDetails, isLoading: loadingDetails, error: detailsError } = useComplaintDetails(complaint.complaint_id)

  useEffect(() => {
    // First try to get ID from the complaint object itself (from list)
    if ((complaint as any).id) {
      const id = typeof (complaint as any).id === 'string' ? parseInt((complaint as any).id) : (complaint as any).id
      if (id && !isNaN(id) && id > 0) {
        setCaseId(id)
        return
      }
    }
    
    // Then try from complaintDetails response (from detail endpoint)
    if (complaintDetails && !loadingDetails && !detailsError) {
      // Handle response structure: { success: boolean, data: CaseDetailOut }
      const data = (complaintDetails as any)?.data || complaintDetails
      
      if (data && typeof data === 'object') {
        // Try to get ID from various possible fields
        const id = data.id || data.case_id
        if (id !== undefined && id !== null) {
          const numId = typeof id === 'string' ? parseInt(id) : id
          if (!isNaN(numId) && numId > 0) {
            setCaseId(numId)
            return
          }
        }
      }
    }
  }, [complaintDetails, complaint, loadingDetails, detailsError])

  // Fetch evidence list using new hooks
  const { data: evidenceList = [], isLoading: loadingEvidence } = useEvidenceList(caseId || 0, undefined, showDeletedEvidence)
  const { data: deletedEvidenceChanges = [] } = useDeletedEvidence(caseId || 0)

  // Only show investigation platform tabs for assigned cases
  const sections = isAssigned ? [
    { id: 'evidences' as const, label: 'Case Evidences', icon: FileText },
    { id: 'evidence_upload' as const, label: 'Evidence Upload', icon: Upload },
    { id: 'changes' as const, label: 'Changes', icon: Shield },
  ] : [
    { id: 'evidences' as const, label: 'Case Evidences', icon: FileText },
  ]

  const handleNewEvidence = () => {
    setEditingEvidence(null)
    setShowEvidenceUploader(true)
  }

  const handleEditEvidence = (evidence: Evidence) => {
    setEditingEvidence(evidence)
    setShowEvidenceUploader(true)
  }

  // Get evidence list from new hook or fallback
  const displayEvidenceList = evidenceList.length > 0 ? evidenceList : (complaintDetails?.data?.evidence || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-7xl w-full max-h-[90vh] overflow-hidden glass-effect rounded-2xl shadow-elevated flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-heading font-semibold mb-1">
              Case: {complaint.complaint_id}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-white/60">{complaint.crime_type}</p>
              {!isAssigned && (
                <span className="badge bg-yellow-500/20 text-yellow-300 text-xs">
                  New Assignment
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs - Only show if there are multiple sections */}
        {sections.length > 1 && (
          <div className="border-b border-white/10 px-6">
            <div className="flex gap-6">
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                      activeSection === section.id
                        ? 'border-primary-500 text-primary-300'
                        : 'border-transparent text-white/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              <span className="text-white/70">Loading case details...</span>
            </div>
          ) : detailsError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-white/70 mb-2">Failed to load case details</p>
              <p className="text-sm text-white/50">{(detailsError as any)?.message || 'Unknown error'}</p>
              <button
                onClick={onClose}
                className="btn-secondary mt-4"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {activeSection === 'evidences' && (
                <div className="space-y-6">
                  {/* Case Details Section - Show for all cases */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Case Details</h3>
                    
                    {/* Description */}
                    <div className="glass-effect rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-white/80 mb-2">Description</h4>
                      <p className="text-sm text-white/70 whitespace-pre-wrap">{complaint.description}</p>
                    </div>
                    
                    {/* AI Analysis / Officer Summary (strip markdown **) */}
                    {(complaintDetails?.data?.officer_summary || complaintDetails?.data?.llm_summary || complaint.officer_summary || complaint.llm_summary) && (() => {
                      const raw = complaintDetails?.data?.officer_summary || complaint.officer_summary ||
                        complaintDetails?.data?.llm_summary || complaint.llm_summary || ''
                      const stripped = typeof raw === 'string' ? raw.replace(/\*\*/g, '') : String(raw).replace(/\*\*/g, '')
                      return (
                        <div className="glass-effect rounded-lg p-4 border border-primary-500/20">
                          <h4 className="text-sm font-semibold text-primary-300 mb-2">
                            {complaintDetails?.data?.officer_summary || complaint.officer_summary ? 'Officer Case Brief' : 'AI Analysis'}
                          </h4>
                          <div className="text-sm text-white/80 whitespace-pre-wrap">
                            {stripped}
                          </div>
                        </div>
                      )
                    })()}
                    
                    {/* BNS Sections */}
                    {(complaintDetails?.data?.bns_sections || complaint.bns_sections) && (
                      <div className="glass-effect rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">Applicable BNS Sections</h4>
                        <div className="flex flex-wrap gap-2">
                          {(complaintDetails?.data?.bns_sections || complaint.bns_sections || []).map((sec: any, i: number) => {
                            // Handle different BNS section structures
                            let sectionDisplay: string
                            if (typeof sec === 'string') {
                              sectionDisplay = sec
                            } else if (sec && typeof sec === 'object') {
                              // Try different possible field names
                              sectionDisplay = sec.section_id || sec.section || sec.name || sec.title || String(sec.id || i + 1)
                            } else {
                              sectionDisplay = String(sec || i + 1)
                            }
                            
                            return (
                              <span key={i} className="badge bg-primary-500/20 text-primary-300 text-xs">
                                {sectionDisplay}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Precautions */}
                    {(complaintDetails?.data?.precautions || complaint.precautions) && (
                      <div className="glass-effect rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-white/80 mb-3">Precautions</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-white/70">
                          {(complaintDetails?.data?.precautions || complaint.precautions || []).map((p: any, i: number) => {
                            // Handle both string and object precautions
                            const precautionText = typeof p === 'string' 
                              ? p 
                              : (p?.text || p?.title || p?.description || p?.precaution || String(p || ''))
                            return <li key={i}>{precautionText}</li>
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                    {/* Evidence List - Quick View */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Case Evidences</h3>
                      {isAssigned && (
                        <button
                          onClick={() => setActiveSection('evidence_upload')}
                          className="btn-secondary text-sm flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Evidence
                        </button>
                      )}
                    </div>
                    
                    {loadingEvidence ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span className="text-white/70">Loading evidence...</span>
                      </div>
                    ) : displayEvidenceList.length > 0 || (complaint.attachments && complaint.attachments.length > 0) ? (
                      <div className="space-y-4">
                        {/* Render evidence from backend if available */}
                        {displayEvidenceList.length > 0 ? (
                          displayEvidenceList
                            .filter((e: any) => !e.deleted_at)
                            .map((evidence: any, idx: number) => {
                            const evidenceId = evidence.id
                            
                            return (
                              <div key={evidenceId} className="glass-effect rounded-xl p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <File className="w-4 h-4 text-primary-300" />
                                      <p className="font-semibold">{evidence.file_name || `Evidence #${idx + 1}`}</p>
                                      {evidence.evidence_type && (
                                        <span className="badge bg-primary-500/20 text-primary-300 text-xs">
                                          {evidence.evidence_type}
                                        </span>
                                      )}
                                    </div>
                                    {evidence.text_content && (
                                      <p className="text-sm text-white/70 mb-2 line-clamp-2">
                                        {evidence.text_content}
                                      </p>
                                    )}
                                    {evidence.storage_path && (
                                      <a
                                        href={evidence.storage_path}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-primary-300 hover:underline"
                                      >
                                        View Evidence
                                      </a>
                                    )}
                                    <p className="text-xs text-white/60 mt-1">
                                      {evidence.content_type} • {evidence.storage_type}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          // Fallback to attachments URLs if evidence list not available
                          complaint.attachments?.map((url, idx) => (
                            <div key={idx} className="glass-effect rounded-xl p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-semibold">Evidence #{idx + 1}</p>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-primary-300 hover:underline"
                                  >
                                    View Evidence
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-10 w-10 text-white/30 mx-auto mb-3" />
                        <p className="text-sm font-medium mb-2">No evidence uploaded</p>
                        {isAssigned && (
                          <p className="text-xs text-white/60 mb-4">
                            Upload text, CSV, PDF, images, videos, audio, or record live evidence
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'evidence_upload' && isAssigned && caseId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Evidence Upload</h3>
                    <button
                      onClick={handleNewEvidence}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Upload Evidence
                    </button>
                  </div>

                  {showEvidenceUploader && caseId && (
                    <EvidenceUploader
                      caseId={caseId}
                      evidence={editingEvidence || undefined}
                      onClose={() => {
                        setShowEvidenceUploader(false)
                        setEditingEvidence(null)
                      }}
                    />
                  )}

                  {!showEvidenceUploader && (
                    <>
                      {displayEvidenceList.length > 0 ? (
                        <div className="space-y-3">
                          {displayEvidenceList.map((evidence: any) => {
                            const isDeleted = evidence.deleted_at
                            return (
                              <div
                                key={evidence.id}
                                className={`glass-effect rounded-lg p-4 border transition-colors ${
                                  isDeleted 
                                    ? 'border-red-500/30 opacity-60' 
                                    : 'border-white/10 hover:border-primary-500/30'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {evidence.evidence_type === 'text' && <FileText className="w-4 h-4 text-primary-300" />}
                                      {evidence.evidence_type === 'image' && <File className="w-4 h-4 text-primary-300" />}
                                      {evidence.evidence_type === 'video' && <File className="w-4 h-4 text-primary-300" />}
                                      {evidence.evidence_type === 'audio' && <File className="w-4 h-4 text-primary-300" />}
                                      {evidence.evidence_type === 'pdf' && <File className="w-4 h-4 text-primary-300" />}
                                      {!evidence.evidence_type && <File className="w-4 h-4 text-primary-300" />}
                                      <span className="badge bg-primary-500/20 text-primary-300 mr-2">
                                        {evidence.evidence_type || 'file'}
                                      </span>
                                      {isDeleted && (
                                        <span className="badge bg-red-500/20 text-red-300 text-xs">
                                          Deleted
                                        </span>
                                      )}
                                      <span className="text-xs text-white/60">
                                        {new Date(evidence.uploaded_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="font-semibold text-sm mb-1">{evidence.file_name || 'Untitled'}</p>
                                    {evidence.text_content && (
                                      <p className="text-sm text-white/70 whitespace-pre-wrap line-clamp-3">
                                        {evidence.text_content}
                                      </p>
                                    )}
                                    {evidence.storage_path && (
                                      <a
                                        href={evidence.storage_path}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-primary-300 hover:underline mt-1 inline-block"
                                      >
                                        View Evidence
                                      </a>
                                    )}
                                  </div>
                                  {!isDeleted && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditEvidence(evidence)}
                                        className="text-white/60 hover:text-white text-sm p-1"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Upload className="h-10 w-10 text-white/30 mx-auto mb-3" />
                          <p className="text-sm font-medium mb-2">No evidence uploaded yet</p>
                          <p className="text-xs text-white/60 mb-4">
                            Upload text, CSV, PDF, images, videos, audio, or record live evidence
                          </p>
                          <button onClick={handleNewEvidence} className="btn-primary text-sm">
                            Upload First Evidence
                          </button>
                        </div>
                      )}
                      
                      {/* Deleted Evidence Section */}
                      {deletedEvidenceChanges.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-semibold flex items-center gap-2">
                              <History className="w-4 h-4" />
                              Deleted Evidence (Immutable Audit Trail)
                            </h4>
                            <button
                              onClick={() => setShowDeletedEvidence(!showDeletedEvidence)}
                              className="text-xs text-primary-300 hover:text-primary-200"
                            >
                              {showDeletedEvidence ? 'Hide' : 'Show'} Deleted
                            </button>
                          </div>
                          {showDeletedEvidence && (
                            <div className="space-y-2">
                              {deletedEvidenceChanges.map((change) => (
                                <div
                                  key={change.id}
                                  className="glass-effect rounded-lg p-3 border border-red-500/30 opacity-70"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-red-300 mb-1">
                                        {change.old_value || 'Deleted Evidence'}
                                      </p>
                                      <p className="text-xs text-white/60">
                                        Deleted by {change.user_name} • {new Date(change.timestamp).toLocaleString()}
                                      </p>
                                      {change.details && (
                                        <p className="text-xs text-white/50 mt-1">{change.details}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeSection === 'changes' && isAssigned && caseId && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Immutable Audit Trail</h3>
                  <ChangeLogTable caseId={caseId} />
                </div>
              )}

              {/* Show message if trying to access investigation features for unassigned case */}
              {!isAssigned && (activeSection === 'evidence_upload' || activeSection === 'changes') && (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-10 h-10 text-yellow-400 mb-3" />
                  <p className="text-white/70 mb-2">Investigation Platform Features</p>
                  <p className="text-sm text-white/50 text-center mb-4">
                    These features are only available after accepting the case assignment.
                  </p>
                  <button
                    onClick={() => setActiveSection('evidences')}
                    className="btn-primary text-sm"
                  >
                    View Case Evidences
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer with Accept/Reject buttons for unassigned cases only */}
        {!isAssigned && (
          <div className="border-t border-white/10 p-6 bg-white/5">
            <div className="flex gap-4 justify-end">
              {/* Reject button only shown if onReject handler is provided (for new assignments) */}
              {onReject && (
                <button
                  onClick={handleReject}
                  className="btn-danger flex items-center gap-2 px-6"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Reject
                </button>
              )}
              <button
                onClick={handleAccept}
                disabled={assignComplaintMutation.isPending}
                className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50"
              >
                {assignComplaintMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Accept Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CaseDetailView
