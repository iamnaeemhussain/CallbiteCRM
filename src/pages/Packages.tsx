import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Globe,
  Radio,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Layers,
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
import { EsimPackage } from '../types';

export const Packages: React.FC = () => {
  const [packages, setPackages] = useState<EsimPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<EsimPackage | null>(null);
  const [deletePkg, setDeletePkg] = useState<EsimPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields (in PKR)
  const [countryRegion, setCountryRegion] = useState('Pakistan');
  const [packageName, setPackageName] = useState('');
  const [dataAllowance, setDataAllowance] = useState('10GB');
  const [duration, setDuration] = useState('30 Days');
  const [provider, setProvider] = useState('Jazz / Zong Pakistan Hub');
  const [providerId, setProviderId] = useState('PRV-106');
  const [sellingPrice, setSellingPrice] = useState('4500');
  const [costPrice, setCostPrice] = useState('2800');
  const [features, setFeatures] = useState('4G LTE Max, Local Data & Hotspot');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { providers, currencySymbol, formatPrice, refreshSettings } = useSettings();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const loadPackages = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/packages', {
        search,
        country: countryFilter,
        provider: providerFilter,
        status: statusFilter,
      });
      if (res.success && res.packages) {
        setPackages(res.packages);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load packages.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [countryFilter, providerFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPackages();
  };

  const openCreateModal = () => {
    setEditingPkg(null);
    setCountryRegion('Pakistan');
    setPackageName('');
    setDataAllowance('10GB');
    setDuration('30 Days');
    setProvider(providers.length > 0 ? providers[0].name : 'Partner');
    setProviderId(providers.length > 0 ? providers[0].id : '');
    setSellingPrice('4500');
    setCostPrice('2800');
    setFeatures('5G / 4G LTE, Hotspot Enabled');
    setStatus('Active');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: EsimPackage) => {
    setEditingPkg(p);
    setCountryRegion(p.country_region);
    setPackageName(p.package_name);
    setDataAllowance(p.data_allowance);
    setDuration(p.duration);
    setProvider(p.provider);
    setProviderId(p.provider_id || '');
    setSellingPrice(p.selling_price.toString());
    setCostPrice(p.cost_price.toString());
    setFeatures(p.features || '');
    setStatus(p.status || 'Active');
    setDescription(p.description || '');
    setIsModalOpen(true);
  };

  const handleProviderSelect = (selectedName: string) => {
    setProvider(selectedName);
    const found = providers.find((pr) => pr.name === selectedName);
    if (found) {
      setProviderId(found.id);
    }
  };

  const calculateProfit = () => {
    const s = parseFloat(sellingPrice) || 0;
    const c = parseFloat(costPrice) || 0;
    return s - c;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName.trim() || !countryRegion.trim()) {
      toast.error('Country/Region and Package Name are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingPkg) {
        await api.put(`/api/packages/${editingPkg.id}`, {
          country_region: countryRegion.trim(),
          package_name: packageName.trim(),
          data_allowance: dataAllowance.trim(),
          duration: duration.trim(),
          provider: provider.trim(),
          provider_id: providerId || null,
          selling_price: parseFloat(sellingPrice) || 0,
          cost_price: parseFloat(costPrice) || 0,
          features: features.trim() || null,
          status,
          description: description.trim() || null,
        });
        toast.success(`Package ${packageName} updated!`);
      } else {
        await api.post('/api/packages', {
          country_region: countryRegion.trim(),
          package_name: packageName.trim(),
          data_allowance: dataAllowance.trim(),
          duration: duration.trim(),
          provider: provider.trim(),
          provider_id: providerId || null,
          selling_price: parseFloat(sellingPrice) || 0,
          cost_price: parseFloat(costPrice) || 0,
          features: features.trim() || null,
          status,
          description: description.trim() || null,
        });
        toast.success(`Package ${packageName} created!`);
      }

      setIsModalOpen(false);
      loadPackages();
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletePkg) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/packages/${deletePkg.id}`);
      toast.success('Package deleted.');
      setDeletePkg(null);
      loadPackages();
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete package.');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = packages.filter((p) => p.status === 'Active').length;
  const avgProfit =
    packages.length > 0
      ? Math.round(packages.reduce((sum, p) => sum + (p.profit || p.selling_price - p.cost_price), 0) / packages.length)
      : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">eSIM Packages & Bundles</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-configured package bundles with predetermined Selling Price and Cost Price (in PKR) for 1-click selection
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
        >
          Create Package Bundle
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Packages</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{packages.length}</div>
          <span className="text-xs text-slate-500 mt-1 block">Global & regional bundle plans</span>
        </div>

        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Bundles</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</div>
          <span className="text-xs text-emerald-700 font-medium mt-1 block">Available for 1-click selection</span>
        </div>

        <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/40 shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">Avg. Net Profit Margin</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            +{currencySymbol} {avgProfit.toLocaleString()}
          </div>
          <span className="text-xs text-emerald-700 font-medium mt-1 block">Calculated per package sale</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search package name, country/region, provider, or allowance..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search Packages
          </Button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Country / Region
            </label>
            <input
              type="text"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              placeholder="Filter by Country..."
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              eSIM Provider
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Providers</option>
              {providers.map((pr) => (
                <option key={pr.id} value={pr.name}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Packages Grid */}
      {isLoading ? (
        <LoadingSpinner label="Loading package bundles..." />
      ) : packages.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No packages found</h4>
          <p className="text-xs text-slate-400 mt-1">Create predefined package bundles with predetermined prices.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const netProfit = pkg.profit || pkg.selling_price - pkg.cost_price;
            return (
              <div
                key={pkg.id}
                className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {pkg.country_region}
                      </span>
                      <h3 className="text-base font-black text-slate-900 leading-tight">{pkg.package_name}</h3>
                      <span className="font-mono text-[10px] text-slate-400">{pkg.id}</span>
                    </div>

                    {getStatusBadge(pkg.status)}
                  </div>

                  {/* Allowance & Duration Badge */}
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 mb-3">
                    <span>{pkg.data_allowance} Data</span>
                    <span>•</span>
                    <span>{pkg.duration}</span>
                    <span>•</span>
                    <span className="text-slate-600 font-normal">{pkg.provider}</span>
                  </div>

                  {pkg.features && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-3">
                      ✨ {pkg.features}
                    </p>
                  )}

                  {/* Financial Breakdown (in PKR) */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Cost (PKR)</span>
                      <span className="text-xs font-bold text-slate-700 font-mono">{formatPrice(pkg.cost_price)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-900 block">Selling (PKR)</span>
                      <span className="text-xs font-black text-slate-900 font-mono">{formatPrice(pkg.selling_price)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">Profit</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">+{formatPrice(netProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Pre-selectable in eSIM & Renewals</span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(pkg)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Package"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeletePkg(pkg)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Package Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPkg ? `Edit Package: ${editingPkg.package_name}` : 'Create New Package Bundle'}
          subtitle="Pre-set eSIM package details with predetermined PKR Cost & Selling price"
          maxWidth="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
                {editingPkg ? 'Save Changes' : 'Create Package'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Country / Destination *
                </label>
                <input
                  type="text"
                  required
                  value={countryRegion}
                  onChange={(e) => setCountryRegion(e.target.value)}
                  placeholder="e.g. Pakistan / UAE / Turkey / Europe"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. Pakistan 10GB Standard"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Data Allowance *
                </label>
                <input
                  type="text"
                  required
                  value={dataAllowance}
                  onChange={(e) => setDataAllowance(e.target.value)}
                  placeholder="e.g. 5GB, 10GB, 20GB, Unlimited"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Duration *
                </label>
                <input
                  type="text"
                  required
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 30 Days, 15 Days, 7 Days"
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  eSIM Provider / Carrier *
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderSelect(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white font-medium"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.country_coverage})
                    </option>
                  ))}
                  <option value="Direct Carrier / Partner">Direct Carrier / Partner</option>
                </select>
              </div>

              {/* PKR PRICING FIELDS */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cost Price ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="e.g. 2800"
                  className="w-full text-sm font-mono rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-900 mb-1">
                  Selling Price ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full text-sm font-bold font-mono rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>
            </div>

            {/* Net Profit Preview */}
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-950">
                Calculated Net Profit: {currencySymbol} {calculateProfit().toLocaleString()}
              </span>
              <span className="text-emerald-700 font-medium">
                Selling ({sellingPrice}) - Cost ({costPrice})
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Features & Highlights
              </label>
              <input
                type="text"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="e.g. 5G Ultra Speed, Hotspot Allowed, Local Breakout"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
                >
                  <option value="Active">Active (Pre-selectable)</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes..."
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletePkg)}
        onClose={() => setDeletePkg(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Package Bundle"
        message={`Are you sure you want to remove package bundle ${deletePkg?.package_name}?`}
        confirmText="Delete Package"
        isLoading={isDeleting}
      />
    </div>
  );
};
