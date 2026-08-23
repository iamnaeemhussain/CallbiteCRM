import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Edit2,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  KeyRound,
  UserCog,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/formatters';
import { StaffRole, StaffStatus } from '../types';

export const Staff: React.FC = () => {
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('SUPPORT_STAFF');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<StaffStatus>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/staff');
      if (res && res.success) {
        setStaffMembers(res.staff || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load staff list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const openCreateModal = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('SUPPORT_STAFF');
    setPhone('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (stf: any) => {
    setEditingStaff(stf);
    setName(stf.name || '');
    setEmail(stf.email || '');
    setPassword('');
    setRole(stf.role || 'SUPPORT_STAFF');
    setPhone(stf.phone || '');
    setStatus(stf.status || 'active');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and Email are required.');
      return;
    }

    if (!editingStaff && (!password || password.length < 8)) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingStaff) {
        await api.put(`/api/staff/${editingStaff.id}`, {
          name: name.trim(),
          email: email.trim(),
          password: password ? password : undefined,
          role,
          phone: phone.trim() || null,
          status,
        });
        toast.success(`Staff member ${name} updated successfully!`);
      } else {
        await api.post('/api/staff', {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim() || null,
          status,
        });
        toast.success(`Staff member ${name} created successfully!`);
      }

      setIsModalOpen(false);
      loadStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Loading staff team directory..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Team Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Internal accounts, role permissions (Admin vs Support Staff), passwords, and productivity stats
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
          className="shadow-sm"
        >
          Add Staff Member
        </Button>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {staffMembers.map((stf) => {
          const isStfAdmin = stf.role === 'ADMIN';
          const isActive = stf.status === 'active';
          return (
            <div
              key={stf.id}
              className={`rounded-3xl border bg-white p-6 shadow-card hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between ${
                isActive ? 'border-slate-200/90' : 'border-rose-200 bg-slate-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                        isStfAdmin ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {stf.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">{stf.name}</h3>
                      <span className="text-xs font-mono text-slate-400">{stf.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isStfAdmin ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {stf.role}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        isActive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100 mt-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-800 select-all">{stf.email}</span>
                  </div>
                  {stf.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-800">{stf.phone}</span>
                    </div>
                  )}
                </div>

                {/* Staff Performance Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center mt-3">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Customers</span>
                    <span className="text-sm font-black text-slate-900">{stf.assigned_customers_count || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">eSIMs</span>
                    <span className="text-sm font-black text-slate-900">{stf.created_esims_count || 0}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Resolved</span>
                    <span className="text-sm font-black text-slate-900">{stf.resolved_tickets_count || 0}</span>
                  </div>
                </div>
              </div>

              {/* Improved Prominent Edit Staff Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {stf.last_login_at ? `Active: ${formatDate(stf.last_login_at)}` : 'Active'}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<UserCog className="w-4 h-4 text-emerald-600" />}
                  onClick={() => openEditModal(stf)}
                  className="font-bold border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-sm"
                >
                  Edit Staff
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Form Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStaff ? `Edit Staff Member: ${editingStaff.name}` : 'Add New Staff Member'}
          subtitle={editingStaff ? `Staff ID: ${editingStaff.id} — Modify role, password, or contact` : 'Internal team account setup'}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
                {editingStaff ? 'Save Changes' : 'Create Staff Member'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sara Khan"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@callbite.com"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                {editingStaff ? 'Change Password (Leave empty to keep current)' : 'Password (min 8 characters) *'}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required={!editingStaff}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingStaff ? 'Enter new password (optional)' : 'e.g. Touch@11223'}
                  className="w-full text-sm font-mono rounded-xl border border-slate-300 pl-10 pr-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Staff Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="SUPPORT_STAFF">Support Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StaffStatus)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Deactivated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+923001112233"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
