import React, { useState } from 'react'
import { useCreateDiaryEntry, useUpdateDiaryEntry, useDeleteDiaryEntry, DiaryEntry } from '../../hooks/useInvestigationApi'
import { BookOpen, Edit, Trash2, Save, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface DiaryEditorProps {
  caseId: number
  entry?: DiaryEntry
  onClose?: () => void
}

const DiaryEditor: React.FC<DiaryEditorProps> = ({ caseId, entry, onClose }) => {
  const [entryType, setEntryType] = useState<'note' | 'theory' | 'observation' | 'brainstorm'>(entry?.entry_type || 'note')
  const [content, setContent] = useState(entry?.content || '')
  const [encrypted, setEncrypted] = useState(entry?.encrypted ?? true)

  const createMutation = useCreateDiaryEntry()
  const updateMutation = useUpdateDiaryEntry()
  const deleteMutation = useDeleteDiaryEntry()

  const isEditing = !!entry

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Content cannot be empty')
      return
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          caseId,
          entryId: entry.id,
          entry: { content, entry_type: entryType },
        })
        toast.success('Diary entry updated')
      } else {
        await createMutation.mutateAsync({
          caseId,
          entry: { content, entry_type: entryType, encrypted },
        })
        toast.success('Diary entry created')
      }
      onClose?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save entry')
    }
  }

  const handleDelete = async () => {
    if (!isEditing || !confirm('Are you sure you want to delete this entry?')) return

    try {
      await deleteMutation.mutateAsync({ caseId, entryId: entry.id })
      toast.success('Diary entry deleted')
      onClose?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete entry')
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <div className="glass-effect rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold">{isEditing ? 'Edit Entry' : 'New Diary Entry'}</h3>
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

      <div>
        <label className="form-label">Event name</label>
        <select
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as any)}
          className="form-input bg-white/5"
          disabled={isLoading}
        >
          <option value="note">Note</option>
          <option value="theory">Theory</option>
          <option value="observation">Observation</option>
          <option value="brainstorm">Brainstorm</option>
        </select>
      </div>

      <div>
        <label className="form-label">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          className="form-input bg-white/5"
          placeholder="Write your notes here..."
          disabled={isLoading}
        />
      </div>

      {!isEditing && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="encrypted"
            checked={encrypted}
            onChange={(e) => setEncrypted(e.target.checked)}
            className="rounded"
            disabled={isLoading}
          />
          <label htmlFor="encrypted" className="text-sm text-white/70">
            Encrypt entry (recommended)
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading || !content.trim()}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update' : 'Create'}
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

export default DiaryEditor
