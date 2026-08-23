import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { SupportTicketModal } from '../components/customer/SupportTicketModal';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/formatters';

export const Support: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [issueType, setIssueType] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { staffList } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadTickets = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/support', {
        search,
        status,
        priority,
        issue_type: issueType,
        assigned_staff_id: assignedStaffId,
        page,
        limit: pagination.limit,
      });

      if (res.success) {
        setTickets(res.tickets || []);
        if (res.counts) setCounts(res.counts);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load support tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets(1);
  }, [status, priority, issueType, assignedStaffId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTickets(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTicket) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/support/${deleteTicket.id}`);
      toast.success('Support ticket deleted.');
      setDeleteTicket(null);
      loadTickets(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete ticket.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Support Desk & Inquiries</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track customer issues, technical troubleshooting, APN guidance, and resolutions
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Support Ticket
        </Button>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: '', label: 'All Tickets', count: counts.total, color: 'text-slate-900' },
          { id: 'Open', label: 'Open', count: counts.open, color: 'text-rose-600' },
          { id: 'In Progress', label: 'In Progress', count: counts.in_progress, color: 'text-amber-600' },
          { id: 'Waiting for Customer', label: 'Waiting on Customer', count: counts.waiting, color: 'text-blue-600' },
          { id: 'Resolved', label: 'Resolved', count: counts.resolved, color: 'text-emerald-600' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setStatus(item.id)}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              status === item.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-card'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${status === item.id ? 'text-slate-300' : 'text-slate-400'}`}>
              {item.label}
            </span>
            <div className={`text-xl font-black mt-1 ${status === item.id ? 'text-white' : item.color}`}>
              {item.count}
            </div>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets by ID, Description, Customer Name, Phone..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search
          </Button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Issue Type
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Issue Types</option>
              <option value="Renewal">Renewal</option>
              <option value="eSIM Not Working">eSIM Not Working</option>
              <option value="Installation">Installation</option>
              <option value="Data Issue">Data Issue</option>
              <option value="Package Inquiry">Package Inquiry</option>
              <option value="Activation Issue">Activation Issue</option>
              <option value="Refund">Refund</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Assigned Staff
            </label>
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading tickets..." />
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No support tickets found</h4>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search filters or create a new ticket.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Ticket ID</th>
                  <th className="px-4 py-3.5">Customer / Contact</th>
                  <th className="px-4 py-3.5">Issue Type & Details</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Assigned Staff</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tickets.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/customers/${s.customer_id}?tab=support`)}
                  >
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">#{s.id}</td>

                    <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                      <div
                        onClick={() => navigate(`/customers/${s.customer_id}`)}
                        className="font-bold text-slate-900 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {s.customer_name}
                      </div>
                      <div className="font-mono text-slate-500 text-[11px]">{s.customer_phone}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">{s.issue_type}</div>
                      <p className="text-slate-600 text-xs line-clamp-1 max-w-xs mt-0.5">{s.description}</p>
                      {s.resolution && (
                        <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">
                          ✓ {s.resolution}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">{getStatusBadge(s.priority)}</td>
                    <td className="px-4 py-4">{getStatusBadge(s.status)}</td>
                    <td className="px-4 py-4 font-medium text-slate-800">{s.assigned_staff_name || 'Unassigned'}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-[11px]">{formatDate(s.created_at)}</td>

                    <td className="px-5 py-4 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          leftIcon={<Edit2 className="w-3 h-3" />}
                          onClick={() => setEditingTicket(s)}
                        >
                          Update
                        </Button>
                        <button
                          title="Delete Ticket"
                          onClick={() => setDeleteTicket(s)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(p) => loadTickets(p)}
        />
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <SupportTicketModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => loadTickets(1)}
        />
      )}

      {editingTicket && (
        <SupportTicketModal
          isOpen={Boolean(editingTicket)}
          onClose={() => setEditingTicket(null)}
          ticket={editingTicket}
          onSuccess={() => loadTickets(pagination.page)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTicket)}
        onClose={() => setDeleteTicket(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Support Ticket"
        message={`Are you sure you want to delete ticket #${deleteTicket?.id}?`}
        confirmText="Delete Ticket"
        isLoading={isDeleting}
      />
    </div>
  );
};
