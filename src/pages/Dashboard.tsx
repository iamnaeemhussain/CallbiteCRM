import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CardSim as SimCard,
  RefreshCw,
  HelpCircle,
  Receipt,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getExpiryBadge } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { formatPrice, currencySymbol } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/api/dashboard/stats');
      if (res && res.success) {
        setData(res);
      } else {
        setErrorMsg(res?.error || 'Failed to load statistics.');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard stats:', err);
      setErrorMsg(err?.message || 'Unable to connect to database. Please click retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoading) {
    return <LoadingSpinner label="Loading dashboard statistics from database..." />;
  }

  if (errorMsg || !data) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-card max-w-lg mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Dashboard Statistics</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {errorMsg || 'Failed to load statistics from the database.'}
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={loadStats}
          >
            Retry Loading Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { customers, esims, renewals, support, transactions, attention, sources, sales_trend } = data;

  const expiringSoonCount = (renewals?.expiring_today || 0) + (renewals?.expiring_3_days || 0);
  const openSupportCount = (support?.open || 0) + (support?.in_progress || 0);
  const attentionCount =
    (attention?.overdue_tasks?.length || 0) +
    (attention?.today_tasks?.length || 0) +
    (attention?.urgent_tickets?.length || 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live Operations Hub
            </span>
            <span className="text-xs text-slate-400 font-mono">{new Date().toISOString().slice(0, 10)}</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Callbite Esim Management</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            Real-time Customer 360, manual renewals tracking, and active eSIM monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => navigate('/renewals')}
            className="shadow-sm shadow-emerald-500/20"
          >
            Renewals Queue ({expiringSoonCount})
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Users className="w-4 h-4" />}
            onClick={() => navigate('/customers')}
          >
            All Customers
          </Button>
        </div>
      </div>

      {/* SECTION 1: 5 Top Metric Sections */}
      <div className="space-y-6">
        {/* Row 1: Key Focus Areas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Stat */}
          <StatCard
            title="Total Customers"
            value={customers?.total || 0}
            subtitle={`${customers?.active || 0} active • ${customers?.vip || 0} VIP`}
            icon={<Users className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            trend={`+${customers?.new_this_month || 0} this month`}
            trendPositive={true}
            onClick={() => navigate('/customers')}
            accentColor="#10b981"
          />

          {/* eSIMs Stat */}
          <StatCard
            title="Active eSIMs"
            value={esims?.active || 0}
            subtitle={`${esims?.total || 0} total eSIMs in database`}
            icon={<SimCard className="w-5 h-5 text-blue-600" />}
            iconBgColor="bg-blue-50"
            trend={`${esims?.pending || 0} pending activation`}
            onClick={() => navigate('/esims?status=Active')}
            accentColor="#3b82f6"
          />

          {/* Renewals Urgent */}
          <StatCard
            title="Expiring Soon / Today"
            value={expiringSoonCount}
            subtitle={`${renewals?.expiring_today || 0} today • ${renewals?.expiring_3_days || 0} in 3 days`}
            icon={<RefreshCw className="w-5 h-5 text-amber-600" />}
            iconBgColor="bg-amber-50"
            trend={`${renewals?.expired || 0} already expired`}
            trendPositive={renewals?.expiring_today === 0}
            onClick={() => navigate('/renewals?tab=today')}
            accentColor="#f59e0b"
          />

          {/* Support Stat */}
          <StatCard
            title="Open Support Requests"
            value={openSupportCount}
            subtitle={`${support?.waiting_customer || 0} waiting for customer`}
            icon={<HelpCircle className="w-5 h-5 text-rose-600" />}
            iconBgColor="bg-rose-50"
            trend={`${support?.resolved_today || 0} resolved today`}
            onClick={() => navigate('/support?status=Open')}
            accentColor="#ef4444"
          />
        </div>

        {/* Row 2: Financial & Extended Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Sales"
            value={formatPrice(transactions?.today_sales)}
            subtitle={`Profit: ${formatPrice(transactions?.today_profit)}`}
            icon={<Receipt className="w-5 h-5 text-emerald-600" />}
            iconBgColor="bg-emerald-50"
            onClick={() => navigate('/transactions')}
            accentColor="#059669"
          />

          <StatCard
            title="This Month's Sales"
            value={formatPrice(transactions?.month_sales)}
            subtitle={`Monthly Profit: ${formatPrice(transactions?.month_profit)}`}
            icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
            iconBgColor="bg-indigo-50"
            trend={`${transactions?.month_renewals_count || 0} renewals recorded`}
            onClick={() => navigate('/transactions')}
            accentColor="#6366f1"
          />

          <StatCard
            title="Total Database Revenue"
            value={formatPrice(transactions?.total_revenue)}
            subtitle={`Lifetime Profit: ${formatPrice(transactions?.total_profit)}`}
            icon={<Sparkles className="w-5 h-5 text-purple-600" />}
            iconBgColor="bg-purple-50"
            onClick={() => navigate('/transactions')}
            accentColor="#8b5cf6"
          />

          <StatCard
            title="Actionable Attention"
            value={attentionCount}
            subtitle="Overdue tasks & urgent tickets"
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
            iconBgColor="bg-rose-50"
            onClick={() => navigate('/tasks?filter=overdue')}
            accentColor="#dc2626"
          />
        </div>
      </div>

      {/* SECTION 2: TODAY'S ACTIONABLE ATTENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Overdue & Today's Tasks */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Today's Tasks & Follow-ups</h3>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/tasks')}
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              View All Tasks
            </Button>
          </div>

          {attention?.overdue_tasks?.length === 0 && attention?.today_tasks?.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              ✓ No overdue or pending tasks for today! Great job!
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Overdue */}
              {attention?.overdue_tasks?.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/customers/${t.customer_id}?tab=tasks`)}
                  className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl flex items-center justify-between hover:bg-rose-50 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="danger">OVERDUE</Badge>
                      <span className="text-xs font-bold text-slate-900">{t.task_type}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{t.notes}</p>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Customer: <span className="font-semibold">{t.customer_name}</span> ({t.customer_phone})
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-rose-700 font-mono">{t.due_date}</span>
                </div>
              ))}

              {/* Today */}
              {attention?.today_tasks?.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/customers/${t.customer_id}?tab=tasks`)}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between hover:bg-slate-100/70 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">DUE TODAY</Badge>
                      <span className="text-xs font-bold text-slate-900">{t.task_type}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{t.notes}</p>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Customer: <span className="font-semibold">{t.customer_name}</span> ({t.customer_phone})
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 font-mono">{t.due_time || 'Today'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Urgent / Expiring eSIMs Queue */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Expiring eSIMs (Action Required)</h3>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/renewals')}
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              Open Renewals
            </Button>
          </div>

          {attention?.expiring_esims?.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No eSIMs expiring in the next 3 days.
            </div>
          ) : (
            <div className="space-y-2.5">
              {attention?.expiring_esims?.map((e: any) => {
                const badge = getExpiryBadge(e.expiry_date, e.status);
                return (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/customers/${e.customer_id}?tab=esims`)}
                    className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all shadow-subtle"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{e.package_name}</span>
                        <span className="text-[11px] font-mono text-slate-500">{e.iccid}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Customer: <span className="font-semibold text-slate-800">{e.customer_name}</span> ({e.customer_phone})
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-1 text-xs rounded-full border ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Open Support Tickets & Customer Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Tickets (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-slate-900">Urgent & Active Support Tickets</h3>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/support')}
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              View Support Desk
            </Button>
          </div>

          {attention?.urgent_tickets?.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No active support tickets pending.
            </div>
          ) : (
            <div className="space-y-2.5">
              {attention?.urgent_tickets?.map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/customers/${s.customer_id}?tab=support`)}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all shadow-subtle"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700">#{s.id}</span>
                      <span className="text-xs font-bold text-slate-900">{s.issue_type}</span>
                      {getStatusBadge(s.priority)}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 truncate">{s.description}</p>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Customer: <span className="text-slate-700 font-semibold">{s.customer_name}</span> • Assigned: {s.assigned_staff_name || 'Unassigned'}
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(s.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Acquisition Sources Breakdown (1 Col) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-bold text-slate-900">Acquisition Sources</h3>
            </div>
            <button
              onClick={() => navigate('/referrals')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Referrals &gt;
            </button>
          </div>

          <div className="space-y-3">
            {sources?.map((src: any) => {
              const totalCust = customers?.total || 1;
              const pct = Math.round((src.count / totalCust) * 100);
              return (
                <div key={src.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{src.source}</span>
                    <span className="font-bold text-slate-900">
                      {src.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: Recent System Activity Feed */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Recent Customer Activity Stream</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Auto-recorded staff actions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attention?.recent_activity?.map((act: any) => (
            <div
              key={act.id}
              onClick={() => navigate(`/customers/${act.customer_id}`)}
              className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-2xl flex items-start justify-between hover:bg-white hover:border-slate-300 hover:shadow-subtle cursor-pointer transition-all"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">{act.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">{act.customer_name}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-1">{act.description}</p>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <span>By:</span>
                  <span className="font-semibold text-slate-600">{act.staff_name || 'Staff'}</span>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                {formatDate(act.created_at, true)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
