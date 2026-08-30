import React, { useEffect, useState } from 'react';
import { Package, RefreshCw, Globe, Radio, Eye } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { api } from '../utils/api';

export const Packages: React.FC = () => {
  const toast = useToast();
  const { formatPrice } = useSettings();
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/yesim/pakistan-plans');
      setPlans(res.plans || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Pakistan plans.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/api/yesim/sync-pakistan-plans', {});
      toast.success(res.message || 'Pakistan plans saved.');
      await loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch Pakistan plans from Yesim.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Packages</h2>
          <p className="text-xs text-slate-500 mt-1">Pakistan plans from Yesim Partner API. Saved in D1. Read-only cards.</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
          onClick={handleRefresh}
          isLoading={isSyncing}
        >
          Load Pakistan plans
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading Pakistan packages..." />
        ) : plans.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No Pakistan plans saved yet</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">Fetch live Yesim plans for Pakistan and store them in D1.</p>
            <Button size="sm" onClick={handleRefresh} isLoading={isSyncing}>
              Load Pakistan plans
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Plan</th>
                  <th className="px-3 py-3.5">Data / Days</th>
                  <th className="px-3 py-3.5">Coverage</th>
                  <th className="px-3 py-3.5">Price (PKR)</th>
                  <th className="px-3 py-3.5">Plan ID</th>
                  <th className="px-4 py-3.5 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.operators || 'Yesim'}</div>
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-emerald-700">
                      {p.data_amount || '—'}
                      {p.data_unit || 'GB'} • {p.days || '—'}d
                    </td>
                    <td className="px-3 py-3.5">{p.countries_included || 'Pakistan'}</td>
                    <td className="px-3 py-3.5">
                      <div className="font-bold text-slate-900">{formatPrice(p.selling_price_pkr)}</div>
                      <div className="text-[10px] text-slate-400">Cost {formatPrice(p.cost_price_pkr)}</div>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-[10px] text-slate-500">
                      {p.old_id || p.yesim_plan_id || p.id}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="xs" variant="secondary" leftIcon={<Eye className="w-3 h-3" />} onClick={() => setSelected(p)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={selected.name}
          subtitle="Read-only Pakistan plan card"
          maxWidth="lg"
          footer={
            <Button variant="primary" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] font-bold uppercase text-emerald-800">Data</div>
                <div className="text-lg font-black text-emerald-950">
                  {selected.data_amount || '—'} {selected.data_unit || 'GB'}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-500">Duration</div>
                <div className="text-lg font-black text-slate-900">{selected.days || '—'} days</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-500">Selling (PKR)</div>
                <div className="text-base font-black text-slate-900">{formatPrice(selected.selling_price_pkr)}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-bold uppercase text-slate-500">Cost (PKR)</div>
                <div className="text-base font-black text-slate-900">{formatPrice(selected.cost_price_pkr)}</div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Globe className="w-3.5 h-3.5" /> {selected.countries_included || 'Pakistan'}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Radio className="w-3.5 h-3.5" /> {selected.operators || '—'}
              </div>
              {selected.apn && <div className="font-mono text-slate-500">APN: {selected.apn}</div>}
              <div className="font-mono text-slate-400">
                plan_id: {selected.old_id || selected.yesim_plan_id || selected.id}
              </div>
              <div className="text-slate-400">
                Wholesale {selected.currency || 'EUR'} {selected.wholesale_price}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
