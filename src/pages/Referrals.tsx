import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowRight,
  Inbox,
  CheckCircle2,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/formatters';

type TabId = 'requests' | 'network';

export const Referrals: React.FC = () => {
  const [tab, setTab] = useState<TabId>('requests');
  const [data, setData] = useState<{
    referrers: any[];
    referred_customers: any[];
    summary: { total_referrals: number; total_unique_referrers: number; total_referral_revenue: number };
  } | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestCounts, setRequestCounts] = useState({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { formatPrice } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadNetwork = async () => {
    try {
      const res = await api.get('/api/referrals', { search });
      if (res.success) setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load referrals.');
    }
  };

  const loadRequests = async () => {
    try {
      const res = await api.get('/api/referrals/requests', { search, status: statusFilter });
      if (res.success) {
        setRequests(res.requests || []);
        if (res.counts) setRequestCounts(res.counts);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load referral requests.');
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadRequests(), loadNetwork()]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAll();
  };

  const syncSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/api/referrals/requests/sync-sheet', {});
      toast.success(res.message || 'Sheet synced.');
      await loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  const setRequestStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/referrals/requests/${id}`, { status });
      toast.success(`Marked ${status}.`);
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update.');
    }
  };

  const convertRequest = async (id: string) => {
    setConvertingId(id);
    try {
      const res = await api.post(`/api/referrals/requests/${id}/convert`);
      toast.success(res.message || 'Converted to customer.');
      await loadAll();
      if (res.customer_id) navigate(`/customers/${res.customer_id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert.');
    } finally {
      setConvertingId(null);
    }
  };

  if (isLoading && !data && requests.length === 0) {
    return <LoadingSpinner label="Loading referrals..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Referrals</h2>
          <p className="text-xs text-slate-500 mt-1">
            Referral requests from the Google Sheet, plus in-CRM referral tracking
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Users className="w-4 h-4" />} onClick={() => navigate('/customers')}>
          View All Customers
        </Button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-xl whitespace-nowrap ${tab === 'requests' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Referral Requests ({requestCounts.total})
        </button>
        <button
          onClick={() => setTab('network')}
          className={`px-4 py-2 rounded-xl whitespace-nowrap ${tab === 'network' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Referral Network
        </button>
      </div>

      {tab === 'requests' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[10px] font-bold uppercase text-slate-400">Inbox</span>
              <div className="text-xl font-black text-slate-900">{requestCounts.total}</div>
            </div>
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50">
              <span className="text-[10px] font-bold uppercase text-amber-800">New</span>
              <div className="text-xl font-black text-amber-950">{requestCounts.new}</div>
            </div>
            <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/50">
              <span className="text-[10px] font-bold uppercase text-sky-800">Contacted</span>
              <div className="text-xl font-black text-sky-950">{requestCounts.contacted}</div>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Converted</span>
              <div className="text-xl font-black text-emerald-950">{requestCounts.converted}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Sheet inbox</h3>
              <p className="text-xs text-slate-500 mt-1">
                Rows sync from{' '}
                <a
                  className="font-bold text-emerald-700"
                  href="https://docs.google.com/spreadsheets/d/1vCRClg8BR3K_yWH3Y-TUiiqsYwsqtOCjaBg_lm1ZKRg/edit?gid=0#gid=0"
                  target="_blank"
                  rel="noreferrer"
                >
                  Refer a Friend responses
                </a>
                : name, WhatsApp, phone model, notes.
              </p>
            </div>
            <Button variant="primary" leftIcon={<RefreshCw className="w-4 h-4" />} isLoading={isSyncing} onClick={syncSheet}>
              Sync sheet
            </Button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, WhatsApp, referrer, ID..."
                className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm rounded-xl border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">All statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Converted">Converted</option>
              <option value="Declined">Declined</option>
            </select>
            <Button type="submit" variant="primary">
              Search
            </Button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
            {requests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No referral requests yet. Click Sync sheet to import Google Sheet rows.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Friend</th>
                      <th className="px-4 py-3.5">WhatsApp</th>
                      <th className="px-4 py-3.5">Phone model</th>
                      <th className="px-4 py-3.5">Notes</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Received</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900">{r.friend_name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{r.id}</div>
                          {r.referrer_name && <div className="text-[10px] text-slate-500">via {r.referrer_name}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">{r.friend_whatsapp}</td>
                        <td className="px-4 py-3">{r.friend_phone_model || '—'}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate" title={r.notes || ''}>
                          {r.notes || '—'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(r.created_at, true)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === 'New' && (
                              <Button size="xs" variant="secondary" onClick={() => setRequestStatus(r.id, 'Contacted')}>
                                Contacted
                              </Button>
                            )}
                            {r.status !== 'Converted' && (
                              <Button
                                size="xs"
                                variant="success"
                                leftIcon={<CheckCircle2 className="w-3 h-3" />}
                                isLoading={convertingId === r.id}
                                onClick={() => convertRequest(r.id)}
                              >
                                Convert
                              </Button>
                            )}
                            {r.converted_customer_id && (
                              <Button size="xs" variant="ghost" onClick={() => navigate(`/customers/${r.converted_customer_id}`)}>
                                Customer
                              </Button>
                            )}
                            {r.status !== 'Declined' && r.status !== 'Converted' && (
                              <Button size="xs" variant="ghost" onClick={() => setRequestStatus(r.id, 'Declined')}>
                                Decline
                              </Button>
                            )}
                            <a
                              href={`https://wa.me/${String(r.friend_whatsapp).replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'network' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Referred Customers</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{data?.summary.total_referrals || 0}</div>
            </div>
            <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Referrers</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{data?.summary.total_unique_referrers || 0}</div>
            </div>
            <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Referral Revenue</span>
              <div className="text-2xl font-black text-emerald-900 mt-1">{formatPrice(data?.summary.total_referral_revenue)}</div>
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-900">Top Customer Referrers ({data?.referrers?.length || 0})</h3>
          {data?.referrers?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs">
              No referral connections found. When adding or editing a customer, select &quot;Referred by&quot; to track referrals.
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
                        <h4 className="text-sm font-bold text-slate-900">{r.referrer_name}</h4>
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
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Phone: <span className="font-mono text-slate-800">{r.referrer_phone}</span>
                    </span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      View 360 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-base font-bold text-slate-900">All Referred Customer Relationships</h3>
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
            {data?.referred_customers?.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">No referred customers recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">New Customer</th>
                      <th className="px-4 py-3.5">Referred By</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">eSIMs</th>
                      <th className="px-4 py-3.5">Total Spent</th>
                      <th className="px-4 py-3.5">Joined</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data?.referred_customers.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{c.full_name}</div>
                          <div className="font-mono text-slate-500 text-[11px]">{c.whatsapp_number}</div>
                        </td>
                        <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                          <div onClick={() => navigate(`/customers/${c.referrer_id}`)} className="font-bold text-emerald-700 hover:underline cursor-pointer">
                            {c.referrer_name}
                          </div>
                        </td>
                        <td className="px-4 py-4">{getStatusBadge(c.status)}</td>
                        <td className="px-4 py-4 font-bold">{c.esim_count || 0}</td>
                        <td className="px-4 py-4 font-bold text-emerald-700">{formatPrice(c.total_spent)}</td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-500">{formatDate(c.created_at)}</td>
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
      )}
    </div>
  );
};
