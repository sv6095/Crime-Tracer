// src/ResultsCard.tsx
import React from 'react';
import { PredictedSection } from '../types/api';
import { ShieldAlert, Send } from 'lucide-react';

interface ResultsCardProps {
  section: PredictedSection;
  onFeedback: (sectionId: string) => void;
}

const ResultsCard: React.FC<ResultsCardProps> = ({ section, onFeedback }) => {
  const scorePercent = Math.round(section.score * 100);
  
  // High-stakes section styling (Admin/Reviewer UI)
  const isHighStakes = section.is_high_stakes;
  const flagStyle = isHighStakes 
    ? 'bg-red-900/40 text-red-400 border border-red-700 animate-bounce-gentle' 
    : 'bg-yellow-900/40 text-yellow-400 border border-yellow-700';

  // Confidence bar color based on score
  const barColor = section.score > 0.8 
    ? 'bg-green-500' 
    : section.score > 0.6 
    ? 'bg-yellow-500' 
    : 'bg-red-500';

  return (
    <div className="card animate-slideUp">
      {/* Header & Admin Flag */}
      <div className="card-header flex justify-between items-start">
        <h3 className="text-xl font-heading text-primary-300">
          {section.section_id} - {section.name}
        </h3>
        {isHighStakes && (
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${flagStyle}`}>
            <ShieldAlert className='h-4 w-4' />
            Human Review Required
          </div>
        )}
      </div>

      <div className='card-body space-y-4'>
        {/* Confidence Score (Visual Bar) */}
        <div>
          <p className="text-sm font-medium text-white/80 mb-1">Confidence: {scorePercent}%</p>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${scorePercent}%` }}
            ></div>
          </div>
        </div>
        
        {/* Evidence Snippet */}
        <div className="bg-white/5 p-4 rounded-md border border-white/10">
          <p className="text-xs font-semibold text-gray-400 mb-2">Evidence Snippet (from RAG):</p>
          <p className="text-sm italic text-white/90 line-clamp-3">
              "{section.evidence}"
          </p>
        </div>

        {/* Provenance/Reasoning (Confidence & Provenance View) */}
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Top RAG Source:</strong> {section.top_rag_source}</p>
          <p><strong>Matched Keyword:</strong> {section.matched_keyword}</p>
          {isHighStakes && (
            <p className='text-red-500 mt-2'>Recommended Action: Double-check source RAG document via `/retrieve`.</p>
          )}
        </div>
      </div>
      
      {/* Feedback Loop Button */}
      <div className='card-footer'>
        <button
          onClick={() => onFeedback(section.section_id)}
          className="text-xs text-primary-400 hover:text-primary-300 transition duration-150 flex items-center gap-2"
        >
          <Send className='h-3 w-3'/> Mark as Incorrect / Add Clarification
        </button>
      </div>
    </div>
  );
};

export default ResultsCard;