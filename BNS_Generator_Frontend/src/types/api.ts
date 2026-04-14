// src/types/api.ts

export type Gender = 'Male' | 'Female' | 'Other' | 'Unknown';
export type WeaponToggle = 'Yes' | 'No' | 'Unknown';

/**
 * Interface for the request body sent to POST /predict
 */
export interface PredictRequest {
  facts: string;
  title?: string;
  victim_age?: number;
  victim_gender?: Gender;
  num_offenders?: number;
  weapon_used?: WeaponToggle;
  // This field is used to pass back answers after a clarification loop
  clarification_answers?: Record<string, string>;
}

/**
 * Interface for a single clarification question returned by the API
 */
export interface ClarificationQuestion {
  question_id: string; // Unique ID for the question
  text: string;
  options: {
    value: string; // The value to send back to the API
    label: string; // The label to display on the button
    // Optional field to update in the main form (victim_age, gender, etc.)
    updates_field?: keyof Omit<PredictRequest, 'facts' | 'title' | 'clarification_answers'>; 
  }[];
}

/**
 * Interface for a predicted BNS section result
 */
export interface PredictedSection {
  section_id: string;
  name: string; // Short title
  meaning: string; // Description/snippet
  score: number; // Confidence score (0.0 to 1.0)
  evidence: string; // Snippet from RAG
  // Fields needed for the Admin/Reviewer UI checklist
  top_rag_source: string;
  matched_keyword: string;
  is_high_stakes: boolean; // Flag for high-stakes sections
}

/**
 * Interface for the full response from POST /predict
 */
export interface PredictResponse {
  bns: PredictedSection[];
  crime_type: string;
  clarifications?: ClarificationQuestion[]; // Present only if clarifications are needed
}

// Initial state for the main form
export const INITIAL_FORM_STATE: PredictRequest = {
  facts: '',
  title: '',
  victim_age: undefined,
  victim_gender: 'Unknown',
  num_offenders: undefined,
  weapon_used: 'Unknown',
  clarification_answers: {},
};