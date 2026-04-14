// src/ClarificationsPane.tsx
import React, { useState, useEffect } from 'react';
import { ClarificationQuestion, PredictRequest } from '../types/api';

interface ClarificationsPaneProps {
  questions: ClarificationQuestion[];
  initialFormState: PredictRequest;
  onReRun: (updatedForm: PredictRequest) => void;
  isLoading: boolean;
}

const ClarificationsPane: React.FC<ClarificationsPaneProps> = ({ 
  questions = [], // **FIXED: Ensures 'questions' is always an array, preventing TypeError.**
  initialFormState, 
  onReRun, 
  isLoading 
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [updatedFields, setUpdatedFields] = useState<Partial<PredictRequest>>({});
  const [allAnswered, setAllAnswered] = useState(false);

  useEffect(() => {
    // Check if all questions have an answer
    const answeredCount = Object.keys(answers).length;
    // questions.length is now safe due to the default array assignment
    setAllAnswered(answeredCount === questions.length); 
  }, [answers, questions.length]);

  const handleAnswer = (questionId: string, value: string, updatesField?: keyof PredictRequest) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    // Update structured quick-fields if specified in the API contract
    if (updatesField) {
      // Logic to safely cast string value to number if the field expects it
      let finalValue: string | number = value;
      if (updatesField === 'victim_age' || updatesField === 'num_offenders') {
        finalValue = parseInt(value, 10);
      }
      setUpdatedFields(prev => ({ ...prev, [updatesField]: finalValue }));
    }
  };

  const handleReRun = () => {
    const updatedRequest: PredictRequest = {
      ...initialFormState,
      ...updatedFields,
      clarification_answers: answers,
    };
    onReRun(updatedRequest);
  };

  if (questions.length === 0) return null; // Defensive check, although parent should handle

  return (
    <div className="p-6 bg-yellow-900/40 border border-yellow-700 rounded-lg shadow-xl mb-8 animate-slideUp">
      <h3 className="text-2xl font-heading text-yellow-300 mb-5">
        Clarification Required: {questions.length} Quick Question(s)
      </h3>

      <div className='space-y-4'>
        {questions.map((q) => (
          <div key={q.question_id} className="p-4 bg-white/5 rounded-md border border-white/10">
            <p className="text-base font-semibold text-white/90 mb-3">{q.text}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => {
                const isSelected = answers[q.question_id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleAnswer(q.question_id, option.value, option.updates_field)}
                    className={`py-2 px-4 text-sm rounded-lg transition duration-150 font-medium ${
                      isSelected
                        ? 'bg-yellow-500 text-black shadow-md'
                        : 'bg-yellow-100/10 text-yellow-300 hover:bg-yellow-100/20'
                    }`}
                    disabled={isLoading}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleReRun}
        disabled={!allAnswered || isLoading}
        className={`mt-6 w-full py-3 px-4 rounded-md text-white font-semibold shadow-lg transition duration-300 ${
          allAnswered && !isLoading
            ? 'bg-green-600 hover:bg-green-700 animate-scale-in'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Re-running...' : 'Re-run Analysis with Clarifications'}
      </button>

      {!allAnswered && (
        <p className="form-error text-center mt-2">Please answer all questions to re-run the analysis.</p>
      )}
    </div>
  );
};

export default ClarificationsPane;