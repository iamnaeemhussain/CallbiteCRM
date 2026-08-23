import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Share2,
  Users,
  Search,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CardSim as SimCard,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/formatters';

export const Referrals: React.FC = () => {
  const [data, setData] = useState<{
    referrers: any[];
    referred_customers: any[];
    summary: { total_referrals: number; total_unique_referrers: number; total_referral_revenue: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const { formatPrice } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadReferrals = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/referrals', { search });
      if (res.success) {
        setData(res);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load referrals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReferrals();
  };

  if (isLoading) {
    return <LoadingSpinner label="Loading customer referral network..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Referral Network</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track which existing customers referred new clients, conversion numbers, and revenue generated
          </p>
        </div>

        <Button
          variant="secondary"
          leftIcon={<Users className="w-4 h-4" />}
          onClick={() => navigate('/customers')}
        >
          View All Customers
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Referred Customers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {data?.summary.total_referrals || 0}
          </div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">Acquired via word-of-mouth</span>
        </div>

        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Referrers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {data?.summary.total_unique_referrers || 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Customers recommending Callbite</span>
        </div>

        <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Referral Revenue</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {formatPrice(data?.summary.total_referral_revenue)}
          </div>
          <span className="text-xs text-emerald-700 font-semibold mt-1 block">Total purchases from referred orders</span>
        </div>
      </div>

      {/* Top Referrers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Top Customer Referrers ({data?.referrers?.length || 0})
          </h3>
        </div>

        {data?.referrers?.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs">
            No referral connections found. When adding or editing a customer, select "Referred by" to track referrals.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.referrers.map((r: any) => (
              <div
                key={r.referrer_id}
                onClick={() => navigate(`/customers/${r.referrer_id}`)}
                className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      {r.referrer_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                        {r.referrer_name}
                      </h4>
                      <span className="font-mono text-[11px] text-slate-400">{r.referrer_id}</span>
                    </div>
                  </div>
                  {getStatusBadge(r.referrer_status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Referred</span>
                    <span className="font-bold text-slate-900 text-sm">{r.total_referred_count} people</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Revenue</span>
                    <span className="font-bold text-emerald-900 text-sm">{formatPrice(r.total_revenue_generated)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Phone: <span className="font-mono text-slate-800">{r.referrer_phone}</span></span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                    View 360 <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Referred Customers Table */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900">
          All Referred Customer Relationships
        </h3>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
          {data?.referred_customers?.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No referred customers recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">New Customer</th>
                    <th className="px-4 py-3.5">Referred By (Ambassador)</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">eSIMs Purchased</th>
                    <th className="px-4 py-3.5">Total Spent</th>
                    <th className="px-4 py-3.5">Joined Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {data?.referred_customers.map((c: any) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-emerald-700">
                          {c.full_name}
                        </div>
                        <div className="font-mono text-slate-500 text-[11px]">{c.whatsapp_number}</div>
                      </td>

                      <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                        <div
                          onClick={() => navigate(`/customers/${c.referrer_id}`)}
                          className="font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          {c.referrer_name}
                        </div>
                        <div className="font-mono text-slate-400 text-[11px]">
                          ID: {c.referrer_id} ({c.referrer_phone})
                        </div>
                      </td>

                      <td className="px-4 py-4">{getStatusBadge(c.status)}</td>

                      <td className="px-4 py-4 font-bold text-slate-900">
                        {c.esim_count || 0} eSIMs
                      </td>

                      <td className="px-4 py-4 font-bold text-emerald-700 text-sm">
                        {formatPrice(c.total_spent)}
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-500 text-[11px]">
                        {formatDate(c.created_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Button size="xs" variant="secondary" onClick={() => navigate(`/customers/${c.id}`)}>
                          View 360
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
