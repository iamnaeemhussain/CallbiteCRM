import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CardSim as SimCard,
  Search,
  Plus,
  RefreshCw,
  QrCode,
  Edit2,
  Trash2,
  ExternalLink,
  MessageSquare,
  Package,
  Globe,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EsimFormModal } from '../components/customer/EsimFormModal';
import { RenewEsimModal } from '../components/customer/RenewEsimModal';
import { QRCodeModal } from '../components/common/QRCodeModal';
import { WhatsAppModal } from '../components/common/WhatsAppModal';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate, getExpiryBadge } from '../utils/formatters';
import { DataUsageMeter } from '../components/common/DataUsageMeter';

export const Esims: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialProvider = searchParams.get('provider') || '';

  const [esims, setEsims] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [country, setCountry] = useState('');
  const [provider, setProvider] = useState(initialProvider);
  const [expiryRange, setExpiryRange] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEsim, setEditingEsim] = useState<any | null>(null);
  const [renewingEsim, setRenewingEsim] = useState<any | null>(null);
  const [qrModalEsim, setQrModalEsim] = useState<any | null>(null);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<any | null>(null);
  const [deleteEsim, setDeleteEsim] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  const loadEsims = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/esims', {
        search,
        status,
        country,
        provider,
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
  }, [status, country, provider, expiryRange, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEsims(1);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">eSIM Inventory & Profiles</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manual eSIM management, activation codes, ICCID assignment, carrier providers, and live status
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
          className="shadow-sm"
        >
          Add New eSIM
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ICCID, Package Name, Country, Customer Name, Phone..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search eSIMs
          </Button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              eSIM Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
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
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Expiry Range
            </label>
            <select
              value={expiryRange}
              onChange={(e) => setExpiryRange(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Expiry Dates</option>
              <option value="today">Expires Today</option>
              <option value="3_days">Expires in 3 Days</option>
              <option value="7_days">Expires in 7 Days</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              eSIM Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="created_at">Date Added</option>
              <option value="expiry_date">Expiry Date</option>
              <option value="package_name">Package Name</option>
              <option value="customer_name">Customer Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table with Prominent Edit eSIM button */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading eSIMs inventory..." />
        ) : esims.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <SimCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No eSIMs found</h4>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search filters or add a new eSIM.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">eSIM / ICCID</th>
                  <th className="px-3 py-3.5">Customer</th>
                  <th className="px-3 py-3.5">Data usage</th>
                  <th className="px-3 py-3.5">Expiry Date</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {esims.map((e) => {
                  const expiryBadge = getExpiryBadge(e.expiry_date, e.status);
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/customers/${e.customer_id}?tab=esims`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-slate-900 select-all">{e.iccid}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{e.id}</div>
                      </td>

                      <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                        <div
                          onClick={() => navigate(`/customers/${e.customer_id}`)}
                          className="font-bold text-slate-900 hover:text-emerald-600 transition-colors cursor-pointer"
                        >
                          {e.customer_name}
                        </div>
                        <div className="font-mono text-slate-500 text-[11px]">{e.customer_phone}</div>
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

                      <td className="px-4 py-4">{getStatusBadge(e.status)}</td>

                      <td className="px-5 py-4 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QR Code Viewer */}
                          <button
                            title="View / Update QR Code"
                            onClick={() => setQrModalEsim(e)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Renew */}
                          <Button
                            variant="success"
                            size="xs"
                            leftIcon={<RefreshCw className="w-3 h-3" />}
                            onClick={() => setRenewingEsim(e)}
                            className="font-bold shadow-sm"
                          >
                            Renew
                          </Button>

                          {/* Edit eSIM - Explicit Prominent Button */}
                          <Button
                            variant="secondary"
                            size="xs"
                            leftIcon={<Edit2 className="w-3 h-3 text-emerald-600" />}
                            onClick={() => setEditingEsim(e)}
                            className="font-bold border-slate-300 hover:border-emerald-500 hover:text-emerald-700"
                          >
                            Edit
                          </Button>

                          {/* Cancel / Delete */}
                          <button
                            title="Cancel eSIM"
                            onClick={() =>
                              setDeleteEsim({
                                id: e.id,
                                name: `${e.package_name} (${e.iccid})`,
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          onPageChange={(p) => loadEsims(p)}
        />
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <EsimFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => loadEsims(1)}
        />
      )}

      {editingEsim && (
        <EsimFormModal
          isOpen={Boolean(editingEsim)}
          onClose={() => setEditingEsim(null)}
          esim={editingEsim}
          onSuccess={() => loadEsims(pagination.page)}
        />
      )}

      {renewingEsim && (
        <RenewEsimModal
          isOpen={Boolean(renewingEsim)}
          onClose={() => setRenewingEsim(null)}
          esim={renewingEsim}
          customerName={renewingEsim.customer_name}
          onSuccess={() => loadEsims(pagination.page)}
        />
      )}

      {qrModalEsim && (
        <QRCodeModal
          isOpen={Boolean(qrModalEsim)}
          onClose={() => setQrModalEsim(null)}
          qrData={qrModalEsim.qr_code_data}
          iccid={qrModalEsim.iccid}
          packageName={qrModalEsim.package_name}
          customerName={qrModalEsim.customer_name}
          onQrUpdated={(newQr) => {
            loadEsims(pagination.page);
          }}
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
