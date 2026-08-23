import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MessageCircle,
  Eye,
  Edit2,
  Trash2,
  Share2,
  CardSim as SimCard,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CustomerFormModal } from '../components/customer/CustomerFormModal';
import { WhatsAppModal } from '../components/common/WhatsAppModal';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate, getExpiryBadge } from '../utils/formatters';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [esimStatus, setEsimStatus] = useState('');
  const [source, setSource] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [expiryRange, setExpiryRange] = useState('');
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // WhatsApp quick modal
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<any | null>(null);

  const { tags, staffList } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadCustomers = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/customers', {
        search,
        status,
        esim_status: esimStatus,
        source,
        assigned_staff_id: assignedStaffId,
        tag: selectedTag,
        expiry_range: expiryRange,
        sort_by: sortBy,
        order: sortOrder,
        page,
        limit: pagination.limit,
      });

      if (res.success) {
        setCustomers(res.customers || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(1);
  }, [status, esimStatus, source, assignedStaffId, selectedTag, expiryRange, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCustomer) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/customers/${deleteCustomer.id}`);
      toast.success(`Customer ${deleteCustomer.full_name} deleted.`);
      setDeleteCustomer(null);
      loadCustomers(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setEsimStatus('');
    setSource('');
    setAssignedStaffId('');
    setSelectedTag('');
    setExpiryRange('');
    setSortBy('last_activity_at');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    Boolean(search || status || esimStatus || source || assignedStaffId || selectedTag || expiryRange);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete database of all Callbite customers, multiple eSIMs, and activity history
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
          className="shadow-sm"
        >
          Add New Customer
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, WhatsApp Number, Email, Customer ID, ICCID..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search Records
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="md" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </form>

        {/* Detailed Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Customer Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="VIP">VIP</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          {/* eSIM Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              eSIM Status
            </label>
            <select
              value={esimStatus}
              onChange={(e) => setEsimStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All eSIM Statuses</option>
              <option value="Active">Has Active eSIM</option>
              <option value="Expired">Has Expired eSIM</option>
              <option value="Pending">Has Pending eSIM</option>
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Acquisition Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Sources</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Website">Website</option>
              <option value="Referred by">Referred by</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>

          {/* Assigned Staff */}
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

          {/* Tags */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Tags
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Expiry Range */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Expiry Alert
            </label>
            <select
              value={expiryRange}
              onChange={(e) => setExpiryRange(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">Any Expiry</option>
              <option value="today">Expires Today</option>
              <option value="3_days">Expires in 3 Days</option>
              <option value="7_days">Expires in 7 Days</option>
              <option value="expired">Already Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading customer directory..." />
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No customers found</h4>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Try adjusting your search filters.' : 'Click "Add New Customer" to register your first record.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Customer / ID</th>
                  <th className="px-4 py-3.5">WhatsApp / Phone</th>
                  <th className="px-4 py-3.5">Status & Tags</th>
                  <th className="px-4 py-3.5">eSIMs</th>
                  <th className="px-4 py-3.5">Next Expiry</th>
                  <th className="px-4 py-3.5">Staff / Source</th>
                  <th className="px-4 py-3.5">Last Activity</th>
                  <th className="px-5 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customers.map((c) => {
                  const expiryBadge = getExpiryBadge(c.next_expiry_date, c.latest_esim_status);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      {/* Customer Name & ID */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 shadow-inner">
                            {c.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {c.full_name}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp / Phone */}
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="font-mono font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{c.whatsapp_number}</span>
                        </div>
                        {c.email && <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[140px]">{c.email}</div>}
                      </td>

                      {/* Status & Tags */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {getStatusBadge(c.status)}
                          {c.tags?.slice(0, 2).map((t: string) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {t}
                            </span>
                          ))}
                          {c.tags?.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              +{c.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* eSIM count */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <SimCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-900">{c.esim_count || 0}</span>
                          <span className="text-slate-400">({c.active_esim_count || 0} active)</span>
                        </div>
                      </td>

                      {/* Next Expiry */}
                      <td className="px-4 py-4">
                        {c.next_expiry_date ? (
                          <div>
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${expiryBadge.color}`}>
                              {expiryBadge.text}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {formatDate(c.next_expiry_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No active expiry</span>
                        )}
                      </td>

                      {/* Assigned Staff & Source */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">{c.assigned_staff_name || 'Unassigned'}</div>
                        <div className="text-[11px] text-emerald-600 font-medium">{c.source}</div>
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-4 text-slate-400 font-mono text-[11px]">
                        {formatDate(c.last_activity_at, true)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick WhatsApp Contact Button */}
                          <button
                            title="Contact on WhatsApp"
                            onClick={() => setWhatsAppCustomer(c)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* 360 Profile Button */}
                          <button
                            title="Customer 360 View"
                            onClick={() => navigate(`/customers/${c.id}`)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Customer */}
                          <button
                            title="Edit Customer"
                            onClick={() => setEditingCustomer(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            title="Delete Customer"
                            onClick={() => setDeleteCustomer(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(p) => loadCustomers(p)}
        />
      </div>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <CustomerFormModal
          isOpen={Boolean(editingCustomer)}
          onClose={() => setEditingCustomer(null)}
          customer={editingCustomer}
          onSuccess={() => {
            loadCustomers(pagination.page);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Create Customer Modal */}
      <CustomerFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newId) => {
          loadCustomers(1);
          if (newId) navigate(`/customers/${newId}`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteCustomer)}
        onClose={() => setDeleteCustomer(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete Customer: ${deleteCustomer?.full_name}?`}
        message={
          <>
            Are you sure you want to remove customer <span className="font-bold text-slate-900">{deleteCustomer?.full_name}</span> ({deleteCustomer?.id})?
            Historical records will be preserved safely in the database.
          </>
        }
        confirmText="Delete Customer"
        isLoading={isDeleting}
      />

      {/* Quick WhatsApp Modal */}
      {whatsAppCustomer && (
        <WhatsAppModal
          isOpen={Boolean(whatsAppCustomer)}
          onClose={() => setWhatsAppCustomer(null)}
          customerId={whatsAppCustomer.id}
          customerName={whatsAppCustomer.full_name}
          phone={whatsAppCustomer.whatsapp_number}
          onInteractionLogged={() => loadCustomers(pagination.page)}
        />
      )}
    </div>
  );
};
