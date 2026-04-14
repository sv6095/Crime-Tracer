import React from 'react'
import { useCasePatterns, useAnalyzePatterns, useVerifyPattern, CasePattern } from '../../hooks/useInvestigationApi'
import { Network, TrendingUp, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface PatternVisualizationProps {
  caseId: number
}

const PatternVisualization: React.FC<PatternVisualizationProps> = ({ caseId }) => {
  const { data: patterns, isLoading } = useCasePatterns(caseId)
  const analyzeMutation = useAnalyzePatterns()
  const verifyMutation = useVerifyPattern()

  const handleAnalyze = async () => {
    try {
      await analyzeMutation.mutateAsync(caseId)
      toast.success('Pattern analysis completed')
    } catch (error: any) {
      toast.error(error.message || 'Analysis failed')
    }
  }

  const handleVerify = async (patternId: number) => {
    try {
      await verifyMutation.mutateAsync(patternId)
      toast.success('Pattern verified')
    } catch (error: any) {
      toast.error(error.message || 'Verification failed')
    }
  }

  const getPatternTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      suspect_match: 'Suspect Match',
      voice_match: 'Voice Match',
      object_match: 'Object Match',
      location_cluster: 'Location Cluster',
      temporal_pattern: 'Temporal Pattern',
    }
    return labels[type] || type
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-300'
    if (score >= 60) return 'text-yellow-300'
    return 'text-red-300'
  }

  return (
    <div className="glass-effect rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold">Case Patterns & Relationships</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {analyzeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          Analyze Patterns
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner mr-3" />
          <span className="text-white/70">Loading patterns...</span>
        </div>
      ) : !patterns || patterns.length === 0 ? (
        <div className="py-12 text-center">
          <Network className="h-10 w-10 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-2">No patterns detected</p>
          <p className="text-xs text-white/60 mb-4">
            Click "Analyze Patterns" to discover relationships with other cases
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-primary-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge bg-primary-500/20 text-primary-300">
                      {getPatternTypeLabel(pattern.pattern_type)}
                    </span>
                    {pattern.verified_by && (
                      <span className="badge bg-green-500/20 text-green-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/90 mb-1">
                    Related Case: <span className="font-mono">{pattern.related_case_complaint_id || pattern.related_case_id}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    <span>
                      Confidence:{' '}
                      <span className={`font-semibold ${getConfidenceColor(pattern.confidence_score)}`}>
                        {pattern.confidence_score.toFixed(1)}%
                      </span>
                    </span>
                    <span>Detected: {new Date(pattern.detected_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {!pattern.verified_by && (
                  <button
                    onClick={() => handleVerify(pattern.id)}
                    disabled={verifyMutation.isPending}
                    className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Verify
                  </button>
                )}
              </div>

              {pattern.match_details && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-white/50 mb-2">Match Details:</p>
                  <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto">
                    {JSON.stringify(pattern.match_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {patterns && patterns.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-white/60">
            Found {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} linking this case to others
          </p>
        </div>
      )}
    </div>
  )
}

export default PatternVisualization
