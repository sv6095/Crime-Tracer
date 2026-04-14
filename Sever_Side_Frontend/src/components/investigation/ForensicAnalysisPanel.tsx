import React from 'react'
import { useForensicAnalysis, useRunYOLODetection, useRunVoiceAnalysis, useRunOCRExtraction, ForensicAnalysis, useOCRCount } from '../../hooks/useInvestigationApi'
import { Microscope, Image, Mic, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ForensicAnalysisPanelProps {
  evidenceId: number
  evidenceType: string
  caseId?: number
}

const ForensicAnalysisPanel: React.FC<ForensicAnalysisPanelProps> = ({ evidenceId, evidenceType, caseId }) => {
  const { data: analyses, isLoading } = useForensicAnalysis(evidenceId)
  const { data: ocrCount } = useOCRCount(caseId || 0)
  const yoloMutation = useRunYOLODetection()
  const voiceMutation = useRunVoiceAnalysis()
  const ocrMutation = useRunOCRExtraction()

  const isImage = evidenceType.startsWith('image/')
  const isAudio = evidenceType.startsWith('audio/')
  const isDocument = evidenceType.includes('pdf') || evidenceType.includes('document') || isImage
  
  const ocrLimitReached = ocrCount?.limit_reached || false
  const ocrRemaining = ocrCount?.remaining || 0

  const handleRunYOLO = async () => {
    try {
      await yoloMutation.mutateAsync(evidenceId)
      toast.success('YOLO detection completed')
    } catch (error: any) {
      toast.error(error.message || 'YOLO detection failed')
    }
  }

  const handleRunVoice = async () => {
    try {
      await voiceMutation.mutateAsync(evidenceId)
      toast.success('Voice analysis completed')
    } catch (error: any) {
      toast.error(error.message || 'Voice analysis failed')
    }
  }

  const handleRunOCR = async () => {
    if (ocrLimitReached) {
      toast.error('OCR extraction limit reached (10 times max per case)')
      return
    }
    try {
      await ocrMutation.mutateAsync(evidenceId)
      toast.success('OCR extraction completed')
    } catch (error: any) {
      toast.error(error.message || 'OCR extraction failed')
    }
  }

  const renderAnalysisResult = (analysis: ForensicAnalysis) => {
    switch (analysis.analysis_type) {
      case 'yolo_object_detection':
        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Detected Objects:</p>
            {analysis.analysis_result.objects?.map((obj: any, idx: number) => (
              <div key={idx} className="bg-white/5 rounded p-2 text-xs">
                <span className="font-semibold">{obj.class}</span>
                {' '}— Confidence: {(obj.confidence * 100).toFixed(1)}%
                {obj.bbox && (
                  <span className="text-white/60 ml-2">
                    BBox: [{obj.bbox.join(', ')}]
                  </span>
                )}
              </div>
            ))}
            {analysis.confidence_score && (
              <p className="text-xs text-white/60">
                Overall Confidence: {analysis.confidence_score.toFixed(1)}%
              </p>
            )}
          </div>
        )
      case 'voice_analysis':
        return (
          <div className="space-y-2">
            {analysis.analysis_result.background_clues && (
              <div>
                <p className="text-sm font-semibold mb-2">Background Clues:</p>
                {analysis.analysis_result.background_clues.map((clue: any, idx: number) => (
                  <div key={idx} className="bg-white/5 rounded p-2 text-xs mb-1">
                    <span className="font-semibold">{clue.type}</span>
                    {' '}— {clue.details}
                    {' '}(Confidence: {(clue.confidence * 100).toFixed(1)}%)
                  </div>
                ))}
              </div>
            )}
            {analysis.analysis_result.conversations && (
              <div>
                <p className="text-sm font-semibold mb-2">Conversations:</p>
                {analysis.analysis_result.conversations.map((conv: any, idx: number) => (
                  <div key={idx} className="bg-white/5 rounded p-2 text-xs mb-1">
                    {conv.text} (Confidence: {(conv.confidence * 100).toFixed(1)}%)
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 'ocr_extraction':
        return (
          <div className="space-y-2">
            {analysis.analysis_result.text && (
              <div>
                <p className="text-sm font-semibold mb-2">Extracted Text:</p>
                <div className="bg-white/5 rounded p-3 text-xs max-h-40 overflow-y-auto">
                  {analysis.analysis_result.text}
                </div>
              </div>
            )}
            {analysis.analysis_result.entities && (
              <div>
                <p className="text-sm font-semibold mb-2">Extracted Entities:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(analysis.analysis_result.entities).map(([key, values]: [string, any]) => (
                    <div key={key} className="bg-white/5 rounded p-2">
                      <span className="font-semibold capitalize">{key}:</span>{' '}
                      {Array.isArray(values) ? values.join(', ') : values}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {analysis.confidence_score && (
              <p className="text-xs text-white/60">
                OCR Confidence: {analysis.confidence_score.toFixed(1)}%
              </p>
            )}
          </div>
        )
      default:
        return (
          <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto">
            {JSON.stringify(analysis.analysis_result, null, 2)}
          </pre>
        )
    }
  }

  return (
    <div className="glass-effect rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Microscope className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold">Forensic Analysis</h3>
      </div>

      {/* OCR Limit Warning */}
      {caseId && ocrLimitReached && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-yellow-300">
            <p className="font-semibold mb-1">OCR Limit Reached</p>
            <p className="text-yellow-200/80">
              You have reached the maximum of 10 OCR extractions for this case. YOLO detection can still be run multiple times.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {isImage && (
          <button
            onClick={handleRunYOLO}
            disabled={yoloMutation.isPending}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {yoloMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Image className="w-4 h-4" />
            )}
            Run YOLO Detection
          </button>
        )}
        {isAudio && (
          <button
            onClick={handleRunVoice}
            disabled={voiceMutation.isPending}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {voiceMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            Run Voice Analysis
          </button>
        )}
        {isDocument && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunOCR}
              disabled={ocrMutation.isPending || ocrLimitReached}
              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
              title={ocrLimitReached ? 'OCR limit reached (10 times max per case)' : ''}
            >
              {ocrMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Run OCR Extraction
            </button>
            {caseId && ocrCount && (
              <span className={`text-xs px-2 py-1 rounded ${
                ocrLimitReached 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-primary-500/20 text-primary-300'
              }`}>
                {ocrRemaining} remaining
              </span>
            )}
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="spinner mr-3" />
          <span className="text-white/70">Loading analyses...</span>
        </div>
      ) : !analyses || analyses.length === 0 ? (
        <div className="py-8 text-center">
          <Microscope className="h-10 w-10 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-2">No analyses yet</p>
          <p className="text-xs text-white/60">
            Run an analysis using the buttons above
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="bg-white/5 rounded-lg p-4 border border-white/10"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-primary-500/20 text-primary-300">
                      {analysis.analysis_type.replace('_', ' ').toUpperCase()}
                    </span>
                    {analysis.model_version && (
                      <span className="text-xs text-white/60">
                        Model: {analysis.model_version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    <span>
                      {new Date(analysis.created_at).toLocaleString()}
                    </span>
                    {analysis.processing_time_ms && (
                      <span>Processing: {analysis.processing_time_ms}ms</span>
                    )}
                  </div>
                </div>
                {analysis.confidence_score && (
                  <div className={`text-sm font-semibold ${analysis.confidence_score >= 80 ? 'text-green-300' : analysis.confidence_score >= 60 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {analysis.confidence_score.toFixed(1)}%
                  </div>
                )}
              </div>
              {renderAnalysisResult(analysis)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ForensicAnalysisPanel
