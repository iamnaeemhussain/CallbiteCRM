import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { RenewEsimModal } from '../components/customer/RenewEsimModal';
import { WhatsAppModal } from '../components/common/WhatsAppModal';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate, getExpiryBadge } from '../utils/formatters';

export const Renewals: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'today';

  const [renewals, setRenewals] = useState<any[]>([]);
  const [counts, setCounts] = useState({ expired: 0, today: 0, three_days: 0, seven_days: 0, active: 0, total: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [renewingEsim, setRenewingEsim] = useState<any | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<any | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  const loadRenewals = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/renewals', {
        tab: activeTab,
        search,
        page,
        limit: pagination.limit,
      });

      if (res.success) {
        setRenewals(res.renewals || []);
        if (res.counts) setCounts(res.counts);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load renewals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals(1);
  }, [activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRenewals(1);
  };

  const handleTabChange = (tabKey: string) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Manual Renewals Operations</h2>
          <p className="text-xs text-slate-500 mt-1">
            Proactively contact customers before expiration and process manual plan extensions
          </p>
        </div>
      </div>

      {/* Tabs Bar with Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { id: 'today', label: 'Expiring Today', count: counts.today, color: 'text-amber-600', icon: AlertTriangle },
          { id: 'three_days', label: 'Expires in 3 Days', count: counts.three_days, color: 'text-orange-600', icon: Clock },
          { id: 'seven_days', label: 'Expires in 7 Days', count: counts.seven_days, color: 'text-blue-600', icon: Calendar },
          { id: 'expired', label: 'Already Expired', count: counts.expired, color: 'text-rose-600', icon: AlertTriangle },
          { id: 'all', label: 'All Active eSIMs', count: counts.total, color: 'text-slate-600', icon: RefreshCw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
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
              <div className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                {tab.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search renewals by customer name, phone, ICCID..."
              className="w-full text-xs rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading renewal queue..." />
        ) : renewals.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No renewals pending in this category</h4>
            <p className="text-xs text-slate-400 mt-1">All customers in this filter are up to date!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Customer / Contact</th>
                  <th className="px-4 py-3.5">eSIM Package & ICCID</th>
                  <th className="px-4 py-3.5">Region</th>
                  <th className="px-4 py-3.5">Expiry Date</th>
                  <th className="px-4 py-3.5">Urgency</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {renewals.map((r) => {
                  const expiryBadge = getExpiryBadge(r.expiry_date, r.status);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/customers/${r.customer_id}?tab=esims`)}
                    >
                      {/* Customer Info */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-emerald-700">
                          {r.customer_name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {r.customer_phone}
                        </div>
                      </td>

                      {/* Package & ICCID */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-emerald-700">{r.package_name}</div>
                        <div className="font-mono text-slate-400 text-[11px] select-all">{r.iccid}</div>
                      </td>

                      {/* Region */}
                      <td className="px-4 py-4 font-semibold text-slate-800">{r.country_region}</td>

                      {/* Expiry Date */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900">{formatDate(r.expiry_date)}</div>
                        <div className="text-[10px] text-slate-400">Duration: {r.duration}</div>
                      </td>

                      {/* Urgency Badge */}
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 text-xs rounded-full border ${expiryBadge.color}`}>
                          {expiryBadge.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Send WhatsApp Renewal Reminder */}
                          <Button
                            variant="whatsapp"
                            size="xs"
                            leftIcon={<MessageCircle className="w-3.5 h-3.5" />}
                            onClick={() =>
                              setWhatsAppTarget({
                                customer_id: r.customer_id,
                                customer_name: r.customer_name,
                                phone: r.customer_phone,
                                package_name: r.package_name,
                                expiry_date: formatDate(r.expiry_date),
                                iccid: r.iccid,
                              })
                            }
                          >
                            WhatsApp Reminder
                          </Button>

                          {/* 1-Click Renew Button */}
                          <Button
                            variant="success"
                            size="xs"
                            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                            onClick={() => setRenewingEsim(r)}
                            className="font-bold shadow-sm"
                          >
                            Renew Now
                          </Button>
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
          onPageChange={(p) => loadRenewals(p)}
        />
      </div>

      {/* Renew Modal */}
      {renewingEsim && (
        <RenewEsimModal
          isOpen={Boolean(renewingEsim)}
          onClose={() => setRenewingEsim(null)}
          esim={renewingEsim}
          customerName={renewingEsim.customer_name}
          onSuccess={() => loadRenewals(pagination.page)}
        />
      )}

      {/* WhatsApp Reminder Modal */}
      {whatsAppTarget && (
        <WhatsAppModal
          isOpen={Boolean(whatsAppTarget)}
          onClose={() => setWhatsAppTarget(null)}
          customerId={whatsAppTarget.customer_id}
          customerName={whatsAppTarget.customer_name}
          phone={whatsAppTarget.phone}
          defaultTemplate="renewal"
          contextData={{
            packageName: whatsAppTarget.package_name,
            expiryDate: whatsAppTarget.expiry_date,
            iccid: whatsAppTarget.iccid,
          }}
          onInteractionLogged={() => loadRenewals(pagination.page)}
        />
      )}
    </div>
  );
};
