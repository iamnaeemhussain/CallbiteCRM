import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CustomerNote } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { Pin } from 'lucide-react';

interface NoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  note?: CustomerNote | null;
  onSuccess: () => void;
}

export const NoteFormModal: React.FC<NoteFormModalProps> = ({
  isOpen,
  onClose,
  customerId,
  note,
  onSuccess,
}) => {
  const toast = useToast();
  const isEdit = Boolean(note);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setIsPinned(Boolean(note.is_pinned));
    } else {
      setTitle('');
      setContent('');
      setIsPinned(false);
    }
  }, [note, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Note content is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && note) {
        await api.put(`/api/notes/${note.id}`, {
          title: title.trim() || null,
          content: content.trim(),
          is_pinned: isPinned,
        });
        toast.success('Note updated successfully!');
      } else {
        await api.post('/api/notes', {
          customer_id: customerId,
          title: title.trim() || null,
          content: content.trim(),
          is_pinned: isPinned,
        });
        toast.success('Internal note added!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Internal Note' : 'Add Internal Customer Note'}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Note' : 'Add Note'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Note Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Travel Itinerary / Special Billing Requirement"
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Content *
          </label>
          <textarea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write internal staff notes..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="flex items-center gap-1">
            <Pin className="w-3.5 h-3.5 text-amber-500" />
            Pin this note to top of customer profile
          </span>
        </label>
      </form>
    </Modal>
  );
};
