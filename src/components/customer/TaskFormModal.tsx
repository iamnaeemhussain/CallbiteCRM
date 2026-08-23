import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task, TaskType, TaskPriority, TaskStatus, Esim } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  customerEsims?: Esim[];
  task?: Task | null;
  onSuccess: (taskId?: string) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerEsims = [],
  task,
  onSuccess,
}) => {
  const { staffList } = useSettings();
  const { user } = useAuth();
  const toast = useToast();

  const isEdit = Boolean(task);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [esimId, setEsimId] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Renewal Follow-up');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [notes, setNotes] = useState('');
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
    if (task) {
      setSelectedCustomerId(task.customer_id);
      setEsimId(task.esim_id || '');
      setTaskType(task.task_type);
      setDueDate(task.due_date || '');
      setDueTime(task.due_time || '');
      setPriority(task.priority);
      setStatus(task.status);
      setAssignedStaffId(task.assigned_staff_id || '');
      setNotes(task.notes || '');
    } else {
      setSelectedCustomerId(customerId || '');
      setEsimId(customerEsims.length > 0 ? customerEsims[0].id : '');
      setTaskType('Renewal Follow-up');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().slice(0, 10));
      setDueTime('12:00');

      setPriority('Normal');
      setStatus('Pending');
      setAssignedStaffId(user?.id || '');
      setNotes('');
    }
  }, [task, customerId, customerEsims, user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCust = customerId || selectedCustomerId;
    if (!targetCust) {
      toast.error('Customer is required.');
      return;
    }

    if (!dueDate || !notes.trim()) {
      toast.error('Due date and task notes are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && task) {
        await api.put(`/api/tasks/${task.id}`, {
          esim_id: esimId || null,
          task_type: taskType,
          due_date: dueDate,
          due_time: dueTime?.trim() || null,
          assigned_staff_id: assignedStaffId || null,
          priority,
          status,
          notes: notes.trim(),
        });

        toast.success('Task updated successfully!');
        onSuccess(task.id);
        onClose();
      } else {
        const res = await api.post('/api/tasks', {
          customer_id: targetCust,
          esim_id: esimId || null,
          task_type: taskType,
          due_date: dueDate,
          due_time: dueTime?.trim() || null,
          assigned_staff_id: assignedStaffId || user?.id,
          priority,
          notes: notes.trim(),
        });

        toast.success('Task created successfully!');
        onSuccess(res.task_id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Task (${task?.id})` : 'Create Follow-up Task'}
      subtitle={customerName ? `Customer: ${customerName}` : 'Assign actionable follow-up reminder'}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Task'}
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
              Task Type *
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="Renewal Follow-up">Renewal Follow-up</option>
              <option value="Customer Follow-up">Customer Follow-up</option>
              <option value="Payment Follow-up">Payment Follow-up</option>
              <option value="Support Follow-up">Support Follow-up</option>
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
              <option value="">-- No specific eSIM --</option>
              {customerEsims.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.package_name} ({e.iccid})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Due Time
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {isEdit ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Assign Staff
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
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Task Description / Follow-up Notes *
          </label>
          <textarea
            rows={3}
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Details of action needed: e.g. Call customer for renewal, verify payment screenshot..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </form>
    </Modal>
  );
};
