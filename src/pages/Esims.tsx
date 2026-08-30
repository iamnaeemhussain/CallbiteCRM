import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CardSim as SimCard, Search, Plus, RefreshCw, Edit2, Trash2, Save, X } from 'lucide-react';
import { Button } from '../components/common/Button';
import { getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EsimFormModal } from '../components/customer/EsimFormModal';
import { EsimProfileModal } from '../components/esim/EsimProfileModal';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate, getExpiryBadge } from '../utils/formatters';
import { DataUsageMeter } from '../components/common/DataUsageMeter';

export const Esims: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [esims, setEsims] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingApi, setIsRefreshingApi] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [expiryRange, setExpiryRange] = useState(searchParams.get('expiry_range') || '');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [profileEsim, setProfileEsim] = useState<any | null>(null);
  const [deleteEsim, setDeleteEsim] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingHolderId, setEditingHolderId] = useState<string | null>(null);
  const [holderName, setHolderName] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [isSavingHolder, setIsSavingHolder] = useState(false);

  const toast = useToast();

  const loadEsims = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/esims', {
        search,
        status,
        expiry_range: expiryRange,
        sort_by: sortBy,
        order: sortOrder,
        page,
        limit: pagination.limit,
      });

      if (res && res.success) {
        setEsims(res.esims || []);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load eSIMs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEsims(1);
  }, [status, expiryRange, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEsims(1);
  };

  const handleRefreshFromApi = async () => {
    setIsRefreshingApi(true);
    try {
      const res = await api.post('/api/yesim/refresh-inventory', {});
      toast.success(res.message || 'eSIMs refreshed from Yesim.');
      await loadEsims(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch eSIMs from Yesim API.');
    } finally {
      setIsRefreshingApi(false);
    }
  };

  const startEditHolder = (e: any) => {
    setEditingHolderId(e.id);
    setHolderName(e.customer_name === 'Unassigned' ? '' : e.customer_name || '');
    setHolderPhone(e.customer_phone || '');
  };

  const saveHolder = async (esimId: string) => {
    setIsSavingHolder(true);
    try {
      await api.put(`/api/esims/${esimId}/holder`, {
        full_name: holderName.trim(),
        whatsapp_number: holderPhone.trim(),
      });
      toast.success('User profile saved.');
      setEditingHolderId(null);
      await loadEsims(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user profile.');
    } finally {
      setIsSavingHolder(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEsim) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/esims/${deleteEsim.id}`);
      toast.success('eSIM cancelled and removed.');
      setDeleteEsim(null);
      loadEsims(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete eSIM.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">eSIM Inventory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Refresh from Yesim, assign a name and WhatsApp number, then open the live SIM profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshingApi ? 'animate-spin' : ''}`} />}
            onClick={handleRefreshFromApi}
            isLoading={isRefreshingApi}
          >
            Refresh from API
          </Button>
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateModalOpen(true)}>
            Add New eSIM
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ICCID, name, WhatsApp, package..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search eSIMs
          </Button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">eSIM Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Expiry Range</label>
            <select
              value={expiryRange}
              onChange={(e) => setExpiryRange(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800"
            >
              <option value="">All Expiry Dates</option>
              <option value="today">Expires Today</option>
              <option value="3_days">Expires in 3 Days</option>
              <option value="7_days">Expires in 7 Days</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800"
            >
              <option value="created_at">Date Added</option>
              <option value="expiry_date">Expiry Date</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading eSIMs inventory..." />
        ) : esims.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <SimCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No eSIMs found</h4>
            <p className="text-xs text-slate-400 mt-1">Refresh from the Yesim API or add an eSIM.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-3 py-3.5">eSIM / ICCID</th>
                  <th className="px-3 py-3.5">Data usage</th>
                  <th className="px-3 py-3.5">Expiry</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {esims.map((e) => {
                  const expiryBadge = getExpiryBadge(e.expiry_date, e.status);
                  const editing = editingHolderId === e.id;
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => !editing && setProfileEsim(e)}
                    >
                      <td className="px-4 py-4 min-w-[200px]" onClick={(ev) => ev.stopPropagation()}>
                        {editing ? (
                          <div className="space-y-1.5">
                            <input
                              value={holderName}
                              onChange={(ev) => setHolderName(ev.target.value)}
                              placeholder="Full name"
                              className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1"
                            />
                            <input
                              value={holderPhone}
                              onChange={(ev) => setHolderPhone(ev.target.value)}
                              placeholder="WhatsApp number"
                              className="w-full text-xs font-mono rounded-lg border border-slate-300 px-2 py-1"
                            />
                            <div className="flex gap-1">
                              <Button
                                size="xs"
                                variant="success"
                                leftIcon={<Save className="w-3 h-3" />}
                                isLoading={isSavingHolder}
                                onClick={() => saveHolder(e.id)}
                              >
                                Save
                              </Button>
                              <Button size="xs" variant="ghost" leftIcon={<X className="w-3 h-3" />} onClick={() => setEditingHolderId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900">{e.customer_name || 'Unassigned'}</div>
                            <div className="font-mono text-slate-500 text-[11px]">{e.customer_phone || 'No number'}</div>
                            <button
                              type="button"
                              className="mt-1 text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"
                              onClick={() => startEditHolder(e)}
                            >
                              <Edit2 className="w-3 h-3" /> Edit / Save
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-mono font-bold text-slate-900 select-all">{e.iccid}</div>
                        <div className="text-[10px] text-slate-400">{e.package_name}</div>
                      </td>
                      <td className="px-3 py-4 min-w-[170px]" onClick={(ev) => ev.stopPropagation()}>
                        <DataUsageMeter
                          dataLeftMb={e.data_left_mb}
                          dataPackageMb={e.data_package_mb}
                          dataUsedMb={e.data_used_mb}
                          compact
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formatDate(e.expiry_date)}</div>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${expiryBadge.color}`}>
                          {expiryBadge.text}
                        </span>
                      </td>
                      <td className="px-3 py-4">{getStatusBadge(e.status)}</td>
                      <td className="px-4 py-4 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          title="Remove eSIM"
                          onClick={() => setDeleteEsim({ id: e.id, name: `${e.package_name} (${e.iccid})` })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          onPageChange={(p) => loadEsims(p)}
        />
      </div>

      {isCreateModalOpen && (
        <EsimFormModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={() => loadEsims(1)} />
      )}

      {profileEsim && (
        <EsimProfileModal
          isOpen={Boolean(profileEsim)}
          onClose={() => setProfileEsim(null)}
          esim={profileEsim}
          onUpdated={() => loadEsims(pagination.page)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteEsim)}
        onClose={() => setDeleteEsim(null)}
        onConfirm={handleDeleteConfirm}
        title="Cancel eSIM"
        message={`Are you sure you want to cancel ${deleteEsim?.name}?`}
        confirmText="Cancel eSIM"
        isLoading={isDeleting}
      />
    </div>
  );
};
