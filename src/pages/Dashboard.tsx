import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CardSim as SimCard,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { formatDate, getExpiryBadge } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          <Button variant="primary" size="sm" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={loadStats}>
            Retry Loading Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { esims, expiry, attention } = data;
  const expiringSoonCount = (expiry?.expiring_today || 0) + (expiry?.expiring_3_days || 0);

  return (
    <div className="space-y-8 pb-12">
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
            Welcome {user?.name || 'staff'}. eSIM inventory from D1.
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<SimCard className="w-4 h-4" />} onClick={() => navigate('/esims')}>
          eSIM Inventory
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <StatCard
          title="Expiring Soon / Today"
          value={expiringSoonCount}
          subtitle={`${expiry?.expiring_today || 0} today • ${expiry?.expiring_3_days || 0} in 3 days`}
          icon={<RefreshCw className="w-5 h-5 text-amber-600" />}
          iconBgColor="bg-amber-50"
          trend={`${expiry?.expired || 0} already expired`}
          trendPositive={expiry?.expiring_today === 0}
          onClick={() => navigate('/esims?expiry_range=3_days')}
          accentColor="#f59e0b"
        />
        <StatCard
          title="Expired eSIMs"
          value={esims?.expired || 0}
          subtitle="Needs follow-up in inventory"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          iconBgColor="bg-rose-50"
          onClick={() => navigate('/esims?status=Expired')}
          accentColor="#ef4444"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900">Expiring eSIMs</h3>
          </div>
          <Button variant="outline" size="xs" onClick={() => navigate('/esims')}>
            Open Inventory
          </Button>
        </div>
        {attention?.expiring_esims?.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No eSIMs expiring in the next 3 days.</div>
        ) : (
          <div className="space-y-2.5">
            {attention?.expiring_esims?.map((e: any) => {
              const badge = getExpiryBadge(e.expiry_date, e.status);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate('/esims')}
                  className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{e.package_name}</span>
                      <span className="text-[11px] font-mono text-slate-500">{e.iccid}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {e.holder_name || e.customer_name || 'Unassigned'}{' '}
                      {e.holder_phone || e.customer_phone ? `(${e.holder_phone || e.customer_phone})` : ''}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full border ${badge.color}`}>{badge.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
