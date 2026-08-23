import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Search,
  Plus,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TaskFormModal } from '../components/customer/TaskFormModal';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';

export const Tasks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterTab = searchParams.get('filter') || 'all';

  const [tasks, setTasks] = useState<any[]>([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0, upcoming: 0, completed: 0, total: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [taskType, setTaskType] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [deleteTask, setDeleteTask] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { staffList } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadTasks = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/tasks', {
        filter: filterTab === 'all' ? undefined : filterTab,
        search,
        priority,
        task_type: taskType,
        assigned_staff_id: assignedStaffId,
        page,
        limit: pagination.limit,
      });

      if (res.success) {
        setTasks(res.tasks || []);
        if (res.counts) setCounts(res.counts);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tasks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks(1);
  }, [filterTab, priority, taskType, assignedStaffId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks(1);
  };

  const handleTabChange = (tabKey: string) => {
    setSearchParams({ filter: tabKey });
  };

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await api.put(`/api/tasks/${task.id}`, { status: nextStatus });
      toast.success(`Task marked as ${nextStatus}!`);
      loadTasks(pagination.page);
    } catch (err: any) {
      toast.error('Failed to update task.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTask) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/tasks/${deleteTask.id}`);
      toast.success('Task deleted.');
      setDeleteTask(null);
      loadTasks(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staff Tasks & Follow-ups</h2>
          <p className="text-xs text-slate-500 mt-1">
            Renewal reminders, payment follow-ups, customer outreach schedules
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Task
        </Button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'all', label: 'All Tasks', count: counts.total, color: 'text-slate-900', icon: CheckSquare },
          { id: 'overdue', label: 'Overdue', count: counts.overdue, color: 'text-rose-600', icon: AlertTriangle },
          { id: 'today', label: 'Due Today', count: counts.today, color: 'text-amber-600', icon: Clock },
          { id: 'upcoming', label: 'Upcoming', count: counts.upcoming, color: 'text-blue-600', icon: Calendar },
          { id: 'completed', label: 'Completed', count: counts.completed, color: 'text-emerald-600', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-card'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : tab.color}`} />
              </div>
              <div className={`text-xl font-black ${isSelected ? 'text-white' : tab.color}`}>
                {tab.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by note, customer name, phone..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search
          </Button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
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
              Task Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Types</option>
              <option value="Renewal Follow-up">Renewal Follow-up</option>
              <option value="Customer Follow-up">Customer Follow-up</option>
              <option value="Payment Follow-up">Payment Follow-up</option>
              <option value="Support Follow-up">Support Follow-up</option>
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

      {/* Task List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading tasks..." />
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No tasks in this view</h4>
            <p className="text-xs text-slate-400 mt-1">Add tasks to stay organized with your customer follow-ups.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((t) => {
              const isDone = t.status === 'Completed';
              return (
                <div
                  key={t.id}
                  className={`p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors ${
                    isDone ? 'bg-slate-50/50 opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleComplete(t)}
                      className="w-5 h-5 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {t.task_type}
                        </span>
                        {getStatusBadge(t.priority)}
                        {getStatusBadge(t.status)}
                        <span
                          onClick={() => navigate(`/customers/${t.customer_id}`)}
                          className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          {t.customer_name} ({t.customer_phone})
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">{t.notes}</p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 mt-2 font-mono">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Due: {t.due_date} {t.due_time || ''}
                        </span>
                        <span>Assigned: {t.assigned_staff_name || 'Staff'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingTask(t)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTask({ id: t.id, name: t.task_type })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(p) => loadTasks(p)}
        />
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <TaskFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => loadTasks(1)}
        />
      )}

      {editingTask && (
        <TaskFormModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSuccess={() => loadTasks(pagination.page)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTask)}
        onClose={() => setDeleteTask(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete this task?`}
        confirmText="Delete Task"
        isLoading={isDeleting}
      />
    </div>
  );
};
