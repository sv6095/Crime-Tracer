import React, { useState, useRef } from 'react'
import { useUploadInvestigationEvidence, useUpdateEvidence, useDeleteEvidence, Evidence, EvidenceCreate } from '../../hooks/useInvestigationApi'
import { Upload, FileText, File, Image, Video, Mic, Save, X, Loader2, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface EvidenceUploaderProps {
  caseId: number
  evidence?: Evidence
  onClose?: () => void
}

const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({ caseId, evidence, onClose }) => {
  const [evidenceType, setEvidenceType] = useState<EvidenceCreate['evidence_type']>(evidence?.evidence_type || 'text')
  const [textContent, setTextContent] = useState(evidence?.text_content || '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingFormat, setRecordingFormat] = useState<'audio' | 'video'>('audio')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const uploadMutation = useUploadInvestigationEvidence()
  const updateMutation = useUpdateEvidence()
  const deleteMutation = useDeleteEvidence()

  const isEditing = !!evidence

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-detect evidence type from file
      if (file.type.startsWith('image/')) setEvidenceType('image')
      else if (file.type.startsWith('video/')) setEvidenceType('video')
      else if (file.type.startsWith('audio/')) setEvidenceType('audio')
      else if (file.type === 'application/pdf') setEvidenceType('pdf')
      else if (file.name.endsWith('.csv') || file.type === 'text/csv') setEvidenceType('csv')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) {
      setSelectedFile(file)
      if (file.type.startsWith('image/')) setEvidenceType('image')
      else if (file.type.startsWith('video/')) setEvidenceType('video')
      else if (file.type.startsWith('audio/')) setEvidenceType('audio')
      else if (file.type === 'application/pdf') setEvidenceType('pdf')
      else if (file.name.endsWith('.csv')) setEvidenceType('csv')
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: recordingFormat === 'video',
      })
      
      const mimeType = recordingFormat === 'audio' 
        ? 'audio/webm' 
        : 'video/webm'
      
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const file = new File([blob], `recording.${recordingFormat === 'audio' ? 'webm' : 'webm'}`, { type: mimeType })
        setSelectedFile(file)
        setEvidenceType(recordingFormat === 'audio' ? 'audio' : 'video')
        setRecordingFormat(recordingFormat)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
      
    } catch (error: any) {
      toast.error('Failed to start recording: ' + (error.message || 'Permission denied'))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const handleSave = async () => {
    if (evidenceType === 'text' || evidenceType === 'csv') {
      if (!textContent.trim()) {
        toast.error('Text content cannot be empty')
        return
      }
    } else if (!selectedFile && !isEditing) {
      toast.error('Please select a file or enter text content')
      return
    }

    try {
      if (isEditing) {
        // Update existing evidence
        await updateMutation.mutateAsync({
          caseId,
          evidenceId: evidence.id,
          updateData: {
            text_content: textContent || undefined,
            file_name: selectedFile?.name || undefined,
          },
        })
        toast.success('Evidence updated')
      } else {
        // Upload new evidence
        const uploadData: EvidenceCreate & { file?: File } = {
          evidence_type: evidenceType,
          text_content: evidenceType === 'text' || evidenceType === 'csv' ? textContent : undefined,
          file: selectedFile || undefined,
          file_name: selectedFile?.name,
          content_type: selectedFile?.type,
          recording_duration: recordingDuration > 0 ? recordingDuration : undefined,
          recording_format: recordingFormat === 'audio' ? 'webm' : 'webm',
        }
        
        await uploadMutation.mutateAsync({ caseId, data: uploadData })
        toast.success('Evidence uploaded successfully')
      }
      onClose?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save evidence')
    }
  }

  const handleDelete = async () => {
    if (!isEditing || !confirm('Are you sure you want to delete this evidence?')) return

    try {
      await deleteMutation.mutateAsync({ caseId, evidenceId: evidence.id })
      toast.success('Evidence deleted')
      onClose?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete evidence')
    }
  }

  const isLoading = uploadMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <div className="glass-effect rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold">{isEditing ? 'Edit Evidence' : 'Upload Evidence'}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Evidence Type Selector */}
      <div>
        <label className="form-label">Evidence Type</label>
        <select
          value={evidenceType}
          onChange={(e) => {
            setEvidenceType(e.target.value as EvidenceCreate['evidence_type'])
            setSelectedFile(null)
            setTextContent('')
          }}
          className="form-input bg-white/5"
          disabled={isLoading || isEditing}
        >
          <option value="text">Text</option>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="live_recording">Live Recording</option>
        </select>
      </div>

      {/* Text/CSV Input */}
      {(evidenceType === 'text' || evidenceType === 'csv') && (
        <div>
          <label className="form-label">Content</label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={10}
            className="form-input bg-white/5"
            placeholder={evidenceType === 'csv' ? 'Enter CSV data...' : 'Enter text content...'}
            disabled={isLoading}
          />
        </div>
      )}

      {/* File Upload */}
      {evidenceType !== 'text' && evidenceType !== 'csv' && evidenceType !== 'live_recording' && (
        <div>
          <label className="form-label">File</label>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <File className="w-8 h-8 mx-auto text-primary-400" />
                <p className="text-sm">{selectedFile.name}</p>
                <p className="text-xs text-white/60">{(selectedFile.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-white/40" />
                <p className="text-sm text-white/60">Click or drag file here</p>
                <p className="text-xs text-white/40">Max 10MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept={
              evidenceType === 'pdf' ? '.pdf' :
              evidenceType === 'image' ? 'image/*' :
              evidenceType === 'video' ? 'video/*' :
              evidenceType === 'audio' ? 'audio/*' :
              '*'
            }
            disabled={isLoading}
          />
        </div>
      )}

      {/* Live Recording */}
      {evidenceType === 'live_recording' && (
        <div className="space-y-4">
          <div>
            <label className="form-label">Recording Type</label>
            <select
              value={recordingFormat}
              onChange={(e) => setRecordingFormat(e.target.value as 'audio' | 'video')}
              className="form-input bg-white/5"
              disabled={isLoading || isRecording}
            >
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  onClick={stopRecording}
                  disabled={isLoading}
                  className="btn-danger flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Stop Recording ({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})
                </button>
              </>
            )}
          </div>
          
          {selectedFile && !isRecording && (
            <div className="p-4 bg-white/5 rounded-lg">
              <p className="text-sm">Recording ready: {selectedFile.name}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading || (!textContent.trim() && !selectedFile && !isEditing)}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update' : 'Upload'}
            </>
          )}
        </button>
        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="btn-danger flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default EvidenceUploader
