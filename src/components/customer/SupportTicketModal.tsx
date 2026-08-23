import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SupportTicket, IssueType, TicketPriority, TicketStatus, Esim } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  customerEsims?: Esim[];
  ticket?: SupportTicket | null;
  onSuccess: (ticketId?: string) => void;
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerEsims = [],
  ticket,
  onSuccess,
}) => {
  const { staffList } = useSettings();
  const { user } = useAuth();
  const toast = useToast();

  const isEdit = Boolean(ticket);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [esimId, setEsimId] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('eSIM Not Working');
  const [priority, setPriority] = useState<TicketPriority>('Normal');
  const [status, setStatus] = useState<TicketStatus>('Open');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allCustomers, setAllCustomers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (isOpen && !customerId && !isEdit) {
      api.get('/api/customers', { limit: 100 }).then((res) => {
        if (res.success && res.customers) {
          setAllCustomers(res.customers);
        }
      }).catch(() => {});
    }
  }, [isOpen, customerId, isEdit]);

  useEffect(() => {
    if (ticket) {
      setSelectedCustomerId(ticket.customer_id);
      setEsimId(ticket.esim_id || '');
      setIssueType(ticket.issue_type);
      setPriority(ticket.priority);
      setStatus(ticket.status);
      setAssignedStaffId(ticket.assigned_staff_id || '');
      setDescription(ticket.description || '');
      setResolution(ticket.resolution || '');
      setInternalNotes(ticket.internal_notes || '');
    } else {
      setSelectedCustomerId(customerId || '');
      setEsimId(customerEsims.length > 0 ? customerEsims[0].id : '');
      setIssueType('eSIM Not Working');
      setPriority('Normal');
      setStatus('Open');
      setAssignedStaffId(user?.id || '');
      setDescription('');
      setResolution('');
      setInternalNotes('');
    }
  }, [ticket, customerId, customerEsims, user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCust = customerId || selectedCustomerId;
    if (!targetCust) {
      toast.error('Customer is required.');
      return;
    }

    if (!description.trim()) {
      toast.error('Issue description is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && ticket) {
        await api.put(`/api/support/${ticket.id}`, {
          esim_id: esimId || null,
          issue_type: issueType,
          priority,
          status,
          assigned_staff_id: assignedStaffId || null,
          description: description.trim(),
          resolution: resolution.trim() || null,
          internal_notes: internalNotes.trim() || null,
        });

        toast.success('Support ticket updated successfully!');
        onSuccess(ticket.id);
        onClose();
      } else {
        const res = await api.post('/api/support', {
          customer_id: targetCust,
          esim_id: esimId || null,
          issue_type: issueType,
          priority,
          status,
          assigned_staff_id: assignedStaffId || user?.id,
          description: description.trim(),
          internal_notes: internalNotes.trim() || null,
        });

        toast.success('Support ticket created successfully!');
        onSuccess(res.ticket_id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Ticket #${ticket?.id}` : 'Create Support Ticket'}
      subtitle={customerName ? `Customer: ${customerName}` : 'Log customer request or technical inquiry'}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Update Ticket' : 'Create Ticket'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!customerId && !isEdit && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Select Customer *
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- Select Customer --</option>
              {allCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Issue Type *
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="Renewal">Renewal</option>
              <option value="eSIM Not Working">eSIM Not Working</option>
              <option value="Installation">Installation / QR Scan</option>
              <option value="Data Issue">Data Issue / APN</option>
              <option value="Package Inquiry">Package Inquiry</option>
              <option value="Activation Issue">Activation Issue</option>
              <option value="Refund">Refund</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Related eSIM (Optional)
            </label>
            <select
              value={esimId}
              onChange={(e) => setEsimId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- General Issue (No specific eSIM) --</option>
              {customerEsims.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.package_name} ({e.iccid}) - {e.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white font-medium"
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white font-semibold"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Waiting for Customer">Waiting for Customer</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Assigned Staff Member
            </label>
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- Unassigned --</option>
              {staffList.map((stf) => (
                <option key={stf.id} value={stf.id}>
                  {stf.name} ({stf.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Issue Description *
          </label>
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the customer request or technical problem..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {isEdit && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Resolution Details
            </label>
            <textarea
              rows={2}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="How the issue was resolved (e.g. APN settings corrected, roaming toggled, refund processed)..."
              className="w-full text-sm rounded-xl border border-emerald-300 bg-emerald-50/30 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Internal Staff Notes
          </label>
          <input
            type="text"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Private notes for staff..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </form>
    </Modal>
  );
};
