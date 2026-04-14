// src/InputForm.tsx
import React, { useState, useEffect } from 'react';
import { PredictRequest, Gender, WeaponToggle } from '../types/api'; // adjust path if necessary

interface InputFormProps {
  onSubmit: (data: PredictRequest) => void;
  isLoading: boolean;
  formState: PredictRequest;
  setFormState: React.Dispatch<React.SetStateAction<PredictRequest>>;
}

const genderOptions: Gender[] = ['Male', 'Female', 'Other', 'Unknown'];
// UPDATED: Removed 'Unknown' from weaponOptions
const weaponOptions: WeaponToggle[] = ['Yes', 'No']; 

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, formState, setFormState }) => {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(Boolean(formState.facts && formState.facts.trim().length > 0));
  }, [formState.facts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    let finalValue: any = value;

    if (type === 'number') {
      finalValue = value ? parseInt(value as string, 10) : undefined;
    }

    // Special handling for Weapon Used: If 'Unknown' is removed and nothing is selected,
    // we should ensure it defaults to 'No' or another sensible value if necessary,
    // but here we just pass the value and let the formState default handle it if empty.
    if (name === 'weapon_used' && value !== 'Yes' && value !== 'No') {
      // If the previously selected value was 'Unknown' and is no longer an option,
      // we need to implicitly handle the change. For now, we'll let the user choose Yes/No.
      // If the value is somehow empty, it remains undefined/empty string which the API should handle.
    }


    setFormState(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      const dataToSend: PredictRequest = {
        ...formState,
        // Ensure weapon_used is set to 'Unknown' if the user hasn't explicitly clicked Yes/No
        // This handles cases where the default formState might conflict with the new restricted options.
        weapon_used: formState.weapon_used === 'Unknown' ? 'No' : formState.weapon_used, 
        
        title: formState.title?.trim() || undefined,
        victim_age:
          formState.victim_age === undefined || isNaN(Number(formState.victim_age))
            ? undefined
            : Number(formState.victim_age),
        num_offenders:
          formState.num_offenders === undefined || isNaN(Number(formState.num_offenders))
            ? undefined
            : Number(formState.num_offenders),
      };
      onSubmit(dataToSend);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading mb-2">Case Details Input</h2>
      </div>

      {/* Facts */}
      <div>
        <label htmlFor="facts" className="block text-sm font-medium text-gray-200 mb-2">
          Multi-line facts text area (Primary)
        </label>
        <textarea
          id="facts"
          name="facts"
          rows={4}
          value={formState.facts}
          onChange={handleChange}
          required
          placeholder="Describe the incident details (who, what, when, where, why)..."
          className="w-full bg-black/50 border border-white/10 rounded-md p-3 text-sm placeholder:text-gray-400 resize-none"
        />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-200 mb-2">
          Title (Optional)
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formState.title || ''}
          onChange={handleChange}
          placeholder="A short descriptive title for the case"
          className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-sm placeholder:text-gray-400"
        />
      </div>

      {/* Structured Fields: Explicit two rows with two columns each */}
      <div className="space-y-4">
        {/* Row 1: Victim Age | Victim Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="victim_age" className="block text-sm text-gray-200 mb-1">Victim Age</label>
            <input
              id="victim_age"
              name="victim_age"
              type="number"
              min={0}
              max={120}
              value={formState.victim_age === undefined ? '' : String(formState.victim_age)}
              onChange={handleChange}
              placeholder="e.g., 35"
              className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="victim_gender" className="block text-sm text-gray-200 mb-1">Victim Gender</label>
            <select
              id="victim_gender"
              name="victim_gender"
              value={formState.victim_gender || ''}
              onChange={handleChange}
              className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-sm"
            >
              <option value="">Select</option>
              {genderOptions.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Num Offenders | Weapon Used */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="num_offenders" className="block text-sm text-gray-200 mb-1">Num Offenders</label>
            <input
              id="num_offenders"
              name="num_offenders"
              type="number"
              min={1}
              value={formState.num_offenders === undefined ? '' : String(formState.num_offenders)}
              onChange={handleChange}
              placeholder="e.g., 1"
              className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-200 mb-1">Weapon Used</label>
            <div className="flex items-center gap-4">
              {/* UPDATED: Only maps 'Yes' and 'No' */}
              {weaponOptions.map(w => (
                <label key={w} className="flex items-center gap-2 text-sm select-none">
                  <input
                    type="radio"
                    name="weapon_used"
                    value={w}
                    checked={formState.weapon_used === w}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 border-white/30 bg-white/10"
                  />
                  <span className="text-gray-200">{w}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-4"> 
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className={`w-full py-2 px-4 rounded-md text-sm font-semibold transition ${
            isValid && !isLoading
              ? 'bg-primary-600 text-black'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Running Analysis...' : 'Run Analysis / Predict Sections'}
        </button>

        {!isValid && (
          <p className="text-sm text-red-400 mt-1 text-center">
            Facts Text Area is required.
          </p>
        )}
      </div>
    </form>
  );
};

export default InputForm;