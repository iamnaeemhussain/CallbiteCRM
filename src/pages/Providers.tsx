import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Globe,
  Phone,
  Mail,
  CardSim as SimCard,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { EsimProvider } from '../types';

export const Providers: React.FC = () => {
  const [providers, setProviders] = useState<EsimProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EsimProvider | null>(null);
  const [deleteProvider, setDeleteProvider] = useState<EsimProvider | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [countryCoverage, setCountryCoverage] = useState('Global');
  const [networkTypes, setNetworkTypes] = useState('5G / 4G LTE');
  const [portalUrl, setPortalUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Maintenance'>('Active');
  const [integrationType, setIntegrationType] = useState('Manual Wholesale Portal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refreshSettings } = useSettings();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/providers', { search, status: statusFilter });
      if (res.success && res.providers) {
        setProviders(res.providers);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load providers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProviders();
  };

  const openCreateModal = () => {
    setEditingProvider(null);
    setName('');
    setCode('');
    setCountryCoverage('Global');
    setNetworkTypes('5G / 4G LTE');
    setPortalUrl('');
    setSupportEmail('');
    setSupportPhone('');
    setAccountManager('');
    setStatus('Active');
    setIntegrationType('Manual Wholesale Portal');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: EsimProvider) => {
    setEditingProvider(p);
    setName(p.name);
    setCode(p.code);
    setCountryCoverage(p.country_coverage);
    setNetworkTypes(p.network_types || '5G / 4G LTE');
    setPortalUrl(p.portal_url || '');
    setSupportEmail(p.support_email || '');
    setSupportPhone(p.support_phone || '');
    setAccountManager(p.account_manager || '');
    setStatus(p.status || 'Active');
    setIntegrationType(p.integration_type || 'Manual Wholesale Portal');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Provider Name and Code are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingProvider) {
        await api.put(`/api/providers/${editingProvider.id}`, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          country_coverage: countryCoverage.trim(),
          network_types: networkTypes.trim(),
          portal_url: portalUrl.trim() || null,
          support_email: supportEmail.trim() || null,
          support_phone: supportPhone.trim() || null,
          account_manager: accountManager.trim() || null,
          status,
          integration_type: integrationType,
          notes: notes.trim() || null,
        });
        toast.success(`Provider ${name} updated!`);
      } else {
        await api.post('/api/providers', {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          country_coverage: countryCoverage.trim(),
          network_types: networkTypes.trim(),
          portal_url: portalUrl.trim() || null,
          support_email: supportEmail.trim() || null,
          support_phone: supportPhone.trim() || null,
          account_manager: accountManager.trim() || null,
          status,
          integration_type: integrationType,
          notes: notes.trim() || null,
        });
        toast.success(`Provider ${name} created!`);
      }

      setIsModalOpen(false);
      loadProviders();
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save provider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProvider) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/providers/${deleteProvider.id}`);
      toast.success('Provider removed.');
      setDeleteProvider(null);
      loadProviders();
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete provider.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalActiveEsims = providers.reduce((sum, p) => sum + (p.active_esim_count || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">eSIM Providers & Suppliers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Directory of wholesale roaming suppliers, carrier breakouts, and provisioning endpoints
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Add eSIM Provider
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Providers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{providers.length}</div>
          <span className="text-xs text-slate-500 mt-1 block">Wholesale suppliers & carriers</span>
        </div>

        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Operational</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {providers.filter((p) => p.status === 'Active').length}
          </div>
          <span className="text-xs text-emerald-700 font-medium mt-1 block">Ready for provisioning</span>
        </div>

        <div className="p-5 rounded-3xl border border-blue-200 bg-blue-50/40 shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Provisioned eSIMs</span>
          <div className="text-2xl font-black text-blue-950 mt-1">{totalActiveEsims}</div>
          <span className="text-xs text-blue-700 font-medium mt-1 block">Active lines routed through suppliers</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search provider by name, code, coverage, or account manager..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search Providers
          </Button>
        </form>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
          {['', 'Active', 'Inactive', 'Maintenance'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Providers Grid */}
      {isLoading ? (
        <LoadingSpinner label="Loading eSIM providers directory..." />
      ) : providers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <Server className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No eSIM Providers found</h4>
          <p className="text-xs text-slate-400 mt-1">Add providers to categorize eSIM stock and carriers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {providers.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-sm shadow-inner">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">{p.name}</h3>
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {p.code}
                      </span>
                    </div>
                  </div>

                  {getStatusBadge(p.status)}
                </div>

                {/* Coverage & Tech details */}
                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" /> Coverage:
                    </span>
                    <span className="font-bold text-slate-900 text-right">{p.country_coverage}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> Technology:
                    </span>
                    <span className="font-semibold text-slate-800">{p.network_types}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Integration:</span>
                    <span className="font-medium text-slate-700 text-right">{p.integration_type}</span>
                  </div>

                  {p.account_manager && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Manager:</span>
                      <span className="font-semibold text-slate-800">{p.account_manager}</span>
                    </div>
                  )}

                  {/* Provisioned eSIMs metric */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between mt-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <SimCard className="w-3.5 h-3.5 text-blue-600" /> Active Lines:
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {p.active_esim_count || 0}{' '}
                      <span className="text-[11px] text-slate-400 font-normal">({p.total_esim_count || 0} total)</span>
                    </span>
                  </div>

                  {p.notes && (
                    <p className="text-[11px] text-slate-500 bg-amber-50/50 p-2 rounded-xl border border-amber-200/50 mt-1 line-clamp-2">
                      {p.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                {p.portal_url ? (
                  <a
                    href={p.portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold"
                  >
                    <span>Portal Login</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-slate-400 text-[11px]">Manual Portal</span>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate(`/esims?provider=${encodeURIComponent(p.name)}`)}
                  >
                    View eSIMs
                  </Button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteProvider(p)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Provider Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProvider ? `Edit Provider: ${editingProvider.name}` : 'Add New eSIM Provider'}
          subtitle="Wholesale roaming partner & carrier integration details"
          maxWidth="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
                {editingProvider ? 'Save Changes' : 'Create Provider'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Provider Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. eSIMGo Wholesale / Redtea Mobile"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Provider Code *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. ESIMGO, REDTEA, TURKCELL"
                  className="w-full text-sm font-mono uppercase rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Country Coverage *</label>
                <input
                  type="text"
                  required
                  value={countryCoverage}
                  onChange={(e) => setCountryCoverage(e.target.value)}
                  placeholder="e.g. Global (160+ Countries) / Europe"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Network Types</label>
                <input
                  type="text"
                  value={networkTypes}
                  onChange={(e) => setNetworkTypes(e.target.value)}
                  placeholder="e.g. 5G / 4G LTE"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Integration Type</label>
                <select
                  value={integrationType}
                  onChange={(e) => setIntegrationType(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
                >
                  <option value="Manual Wholesale Portal">Manual Wholesale Portal</option>
                  <option value="Direct Carrier Partner">Direct Carrier Partner</option>
                  <option value="API Direct / Reseller Console">API Direct / Reseller Console</option>
                  <option value="WhatsApp Wholesale Group">WhatsApp Wholesale Group</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Portal Login URL</label>
                <input
                  type="url"
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Account Manager</label>
                <input
                  type="text"
                  value={accountManager}
                  onChange={(e) => setAccountManager(e.target.value)}
                  placeholder="e.g. David Vance"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@provider.com"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Support Phone</label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+44..."
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Notes & Ordering Instructions</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ordering instructions, SM-DP+ server address, batch download notes..."
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteProvider)}
        onClose={() => setDeleteProvider(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete eSIM Provider"
        message={`Are you sure you want to remove provider ${deleteProvider?.name}?`}
        confirmText="Delete Provider"
        isLoading={isDeleting}
      />
    </div>
  );
};
