import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ContactType } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

interface InteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  defaultContactType?: ContactType;
  onSuccess: () => void;
}

export const InteractionModal: React.FC<InteractionModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  defaultContactType = 'WhatsApp',
  onSuccess,
}) => {
  const toast = useToast();
  const [contactType, setContactType] = useState<ContactType>(defaultContactType);
  const [purpose, setPurpose] = useState('Renewal Reminder');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('Customer responded positively');
  const [interactionDate, setInteractionDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContactType(defaultContactType);
      setPurpose('Renewal Reminder');
      setNotes('');
      setOutcome('Customer responded positively');
      setInteractionDate(new Date().toISOString().slice(0, 16));
    }
  }, [isOpen, defaultContactType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error('Notes / conversation summary are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/interactions', {
        customer_id: customerId,
        contact_type: contactType,
        purpose: purpose.trim() || null,
        notes: notes.trim(),
        outcome: outcome.trim() || null,
        interaction_date: interactionDate ? new Date(interactionDate).toISOString() : new Date().toISOString(),
      });

      toast.success('Interaction recorded to customer history!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record interaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Contact Interaction"
      subtitle={`Customer: ${customerName || customerId}`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            Save Interaction
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Contact Channel *
            </label>
            <select
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ContactType)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Phone Call">Phone Call</option>
              <option value="SMS">SMS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={interactionDate}
              onChange={(e) => setInteractionDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Purpose of Contact
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Renewal reminder / Data check-in / Installation assistance"
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Interaction Notes *
          </label>
          <textarea
            rows={3}
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Summary of conversation, questions asked, customer feedback..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Outcome / Result
          </label>
          <input
            type="text"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Customer agreed to renew / No answer / Issue resolved"
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </form>
    </Modal>
  );
};
