import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  KeyRound,
  Save,
  Trash2,
  RefreshCw,
  Wallet,
  Globe,
  UserPlus,
  CardSim as SimCard,
  Zap,
  Search,
  Download,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Radio,
  Bell,
  FileJson,
  Layers,
  Import,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { api } from '../utils/api';

type TabId =
  | 'token'
  | 'plans'
  | 'issue'
  | 'activate'
  | 'lookup'
  | 'users'
  | 'orders'
  | 'tools'
  | 'logs';

function JsonBlock({ data }: { data: any }) {
  if (data === undefined || data === null) {
    return <p className="text-xs text-slate-400">No response yet.</p>;
  }
  return (
    <pre className="text-[11px] leading-relaxed font-mono bg-slate-950 text-emerald-300 p-4 rounded-2xl overflow-auto max-h-[28rem] border border-slate-800">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${props.className || ''}`}
    />
  );
}

export const EsimApiBox: React.FC = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { formatPrice, refreshSettings } = useSettings();

  const [tab, setTab] = useState<TabId>('token');
  const [config, setConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [tokenInput, setTokenInput] = useState('');
  const [eurToPkr, setEurToPkr] = useState('310');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [showTokenCard, setShowTokenCard] = useState(false);
  const [showBalanceCard, setShowBalanceCard] = useState(false);

  const [balance, setBalance] = useState<any>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const [planSearch, setPlanSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState('');
  const [yesimUserId, setYesimUserId] = useState('');
  const [issueCount, setIssueCount] = useState('1');
  const [issueResult, setIssueResult] = useState<any>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const [activateIccid, setActivateIccid] = useState('');
  const [activatePlanId, setActivatePlanId] = useState('');
  const [activateResult, setActivateResult] = useState<any>(null);
  const [isActivating, setIsActivating] = useState(false);

  const [lookupIccid, setLookupIccid] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [bulkIccids, setBulkIccids] = useState('');
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [userLookupId, setUserLookupId] = useState('');
  const [userResult, setUserResult] = useState<any>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [changeUserId, setChangeUserId] = useState('');
  const [changeResult, setChangeResult] = useState<any>(null);

  const [orderSearch, setOrderSearch] = useState('');
  const [orders, setOrders] = useState<any>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const [cancelIccid, setCancelIccid] = useState('');
  const [cancelPlanId, setCancelPlanId] = useState('');
  const [notifyUrl, setNotifyUrl] = useState('');
  const [operatorCountry, setOperatorCountry] = useState('');
  const [toolsResult, setToolsResult] = useState<any>(null);
  const [isToolsLoading, setIsToolsLoading] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const loadConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await api.get('/api/yesim/config');
      setConfig(res);
      if (res.eur_to_pkr) setEurToPkr(String(res.eur_to_pkr));
      if (res.notification_url) setNotifyUrl(res.notification_url);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Yesim config.');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const copyText = async (value: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can save the Yesim API token.');
      return;
    }
    setIsSavingToken(true);
    try {
      const res = await api.put('/api/yesim/token', { token: tokenInput.trim() });
      toast.success(res.message || 'Token saved to D1.');
      setTokenInput('');
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save token.');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleClearToken = async () => {
    if (!isAdmin) return;
    setIsSavingToken(true);
    try {
      await api.delete('/api/yesim/token');
      toast.success('Yesim API token cleared.');
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear token.');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleSaveRate = async () => {
    if (!isAdmin) return;
    setIsSavingRate(true);
    try {
      await api.put('/api/yesim/settings', { eur_to_pkr: Number(eurToPkr) });
      toast.success('EUR → PKR rate saved.');
      await loadConfig();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rate.');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleBalance = async () => {
    setIsBalanceLoading(true);
    try {
      const res = await api.get('/api/yesim/balance');
      setBalance(res.data);
      toast.success('Balance loaded from Yesim.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load balance.');
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const handleLoadPlans = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsPlansLoading(true);
    try {
      const res = await api.get('/api/yesim/plans', {
        search: planSearch,
        filter: planFilter,
      });
      setPlans(res.plans || []);
      toast.success(`${res.count || 0} Yesim plans loaded.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load plans.');
    } finally {
      setIsPlansLoading(false);
    }
  };

  const handleImportPlan = async (plan: any) => {
    const key = String(plan.old_id || plan.id);
    setImportingId(key);
    try {
      const res = await api.post('/api/yesim/import-plan', {
        ...plan,
        selling_price: undefined,
        cost_price: undefined,
      });
      toast.success(res.message || 'Plan imported.');
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Import failed.');
    } finally {
      setImportingId(null);
    }
  };

  const handleNewUser = async () => {
    if (!userEmail.trim()) {
      toast.error('Email is required.');
      return;
    }
    setIsIssuing(true);
    try {
      const res = await api.post('/api/yesim/new-user', { email: userEmail.trim() });
      setIssueResult(res.data);
      const uid = res.data?.user_id || res.data?.id;
      if (uid) setYesimUserId(String(uid));
      toast.success('Yesim user created.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create Yesim user.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleNewEsim = async () => {
    setIsIssuing(true);
    try {
      const res = await api.post('/api/yesim/new-esim', { user_id: yesimUserId.trim() || undefined });
      setIssueResult(res.data);
      const iccid = res.data?.iccid;
      if (iccid) setActivateIccid(String(iccid));
      toast.success('eSIM issued from Yesim.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue eSIM.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleIssueBulk = async () => {
    setIsIssuing(true);
    try {
      const res = await api.post('/api/yesim/issue-esim', {
        count: Number(issueCount) || 1,
        user_id: yesimUserId.trim() || undefined,
      });
      setIssueResult(res.data);
      toast.success('Bulk eSIM issue completed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to bulk issue eSIMs.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const res = await api.post('/api/yesim/add-plan', {
        iccid: activateIccid.trim(),
        plan_id: activatePlanId.trim(),
      });
      setActivateResult(res.data);
      toast.success('Plan activation requested.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate plan.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSimInfo = async () => {
    setIsLookingUp(true);
    try {
      const res = await api.get('/api/yesim/sim-info', { iccid: lookupIccid.trim() });
      setLookupResult(res.data);
      toast.success('SIM info loaded.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load SIM info.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleBulkSimInfo = async () => {
    setIsBulkLoading(true);
    try {
      const res = await api.post('/api/yesim/bulk-sim-info', { iccids: bulkIccids });
      setBulkResult(res.data);
      toast.success('Bulk SIM info loaded.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load bulk SIM info.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleLoadProfiles = async () => {
    try {
      const res = await api.get('/api/yesim/profiles', { search: lookupIccid.trim() });
      setProfiles(res.profiles || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load cached profiles.');
    }
  };

  const handleUserLookup = async () => {
    setIsUserLoading(true);
    try {
      const res = await api.get('/api/yesim/user', { user_id: userLookupId.trim() });
      setUserResult(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Yesim user.');
    } finally {
      setIsUserLoading(false);
    }
  };

  const handleChangeEsim = async () => {
    setIsUserLoading(true);
    try {
      const res = await api.post('/api/yesim/change-esim', { user_id: changeUserId.trim() });
      setChangeResult(res.data);
      toast.success('eSIM replacement requested.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change eSIM.');
    } finally {
      setIsUserLoading(false);
    }
  };

  const handleOrders = async () => {
    setIsOrdersLoading(true);
    try {
      const res = await api.get('/api/yesim/orders', { search: orderSearch });
      setOrders(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load orders.');
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const runTool = async (fn: () => Promise<any>, okMsg: string) => {
    setIsToolsLoading(true);
    try {
      const data = await fn();
      setToolsResult(data);
      toast.success(okMsg);
    } catch (err: any) {
      toast.error(err.message || 'Request failed.');
    } finally {
      setIsToolsLoading(false);
    }
  };

  const handleLoadLogs = async () => {
    setIsLogsLoading(true);
    try {
      const res = await api.get('/api/yesim/logs', { limit: 80 });
      setLogs(res.logs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load API logs.');
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'logs') handleLoadLogs();
    if (tab === 'lookup') handleLoadProfiles();
  }, [tab]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'token', label: 'Token & Balance' },
    { id: 'plans', label: 'Plans' },
    { id: 'issue', label: 'Issue eSIM' },
    { id: 'activate', label: 'Activate Plan' },
    { id: 'lookup', label: 'SIM Info' },
    { id: 'users', label: 'Users' },
    { id: 'orders', label: 'Orders' },
    { id: 'tools', label: 'More Tools' },
    { id: 'logs', label: 'Activity Log' },
  ];

  const simQr = lookupResult?.qrcode || lookupResult?.img;
  const visiblePlans = useMemo(() => plans.slice(0, 200), [plans]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Box className="w-6 h-6 text-emerald-600" />
            eSIM API Box
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Yesim Partner API console for Callbite Esim staff. Token is stored in the same D1 database (`settings.yesim_api_token`).
          </p>
        </div>
        <a
          href="https://documenter.getpostman.com/view/19324374/2sA3kbgy28"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
        >
          Yesim API docs <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {isLoadingConfig ? (
        <LoadingSpinner label="Loading Yesim API configuration..." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">API Token</span>
              <div className="flex items-center gap-2 mt-1">
                {config?.configured ? (
                  <Badge variant="success" dot>
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="danger" dot>
                    Not set
                  </Badge>
                )}
              </div>
              <p className="text-xs font-mono text-slate-600 mt-2">{config?.token_masked || 'No token saved yet'}</p>
            </div>
            <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cached Yesim Profiles</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{config?.profile_count || 0}</div>
              <span className="text-xs text-slate-500">Stored in D1 `yesim_profiles`</span>
            </div>
            <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/40 shadow-card">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">API Calls Logged</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">{config?.log_count || 0}</div>
              <span className="text-xs text-emerald-700">Stored in D1 `yesim_api_logs`</span>
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                  tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'token' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="text-base font-bold text-slate-900">Where to add your API token</h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    leftIcon={showTokenCard ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    onClick={() => setShowTokenCard((v) => !v)}
                  >
                    {showTokenCard ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showTokenCard && (
                <>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>
                    Open the Yesim partner portal:{' '}
                    <a
                      className="font-bold text-emerald-700"
                      href="https://core.yesim.biz/index.php?act=api_token"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      core.yesim.biz → API Token
                    </a>
                  </li>
                  <li>Copy the access token from that page.</li>
                  <li>
                    Paste it in the field below on this <strong>eSIM API Box</strong> page and click Save. Admins only.
                  </li>
                  <li>
                    It is stored in Cloudflare D1 table <span className="font-mono font-bold">settings</span> under key{' '}
                    <span className="font-mono font-bold">yesim_api_token</span> (same `callbite-crm` database). The worker
                    attaches it to every Yesim request — you never paste it again per call.
                  </li>
                </ol>

                {isAdmin ? (
                  <form onSubmit={handleSaveToken} className="space-y-3 pt-2">
                    <div>
                      <FieldLabel>Yesim Partner API Token</FieldLabel>
                      <TextInput
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste token from core.yesim.biz"
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="primary" leftIcon={<Save className="w-4 h-4" />} isLoading={isSavingToken}>
                        Save Token to D1
                      </Button>
                      {config?.configured && (
                        <Button type="button" variant="danger" leftIcon={<Trash2 className="w-4 h-4" />} onClick={handleClearToken}>
                          Clear Token
                        </Button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    Ask an Admin to paste the Yesim token here. Support staff can use all API actions after it is saved.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <FieldLabel>EUR → PKR rate (plan import)</FieldLabel>
                    <TextInput type="number" value={eurToPkr} onChange={(e) => setEurToPkr(e.target.value)} disabled={!isAdmin} />
                  </div>
                  <div className="flex items-end">
                    {isAdmin && (
                      <Button variant="secondary" isLoading={isSavingRate} onClick={handleSaveRate}>
                        Save Rate
                      </Button>
                    )}
                  </div>
                </div>
                </>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-900">Partner Balance</h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    leftIcon={showBalanceCard ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    onClick={() => setShowBalanceCard((v) => !v)}
                  >
                    {showBalanceCard ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showBalanceCard && (
                <>
                <div className="flex items-center justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    isLoading={isBalanceLoading}
                    onClick={handleBalance}
                  >
                    Check /balance
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Calls Yesim `GET /balance` using the saved D1 token.</p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
                  Live Yesim calls (`/balance`, `/plans`, issue eSIM, etc.) need outbound HTTPS to
                  <span className="font-mono"> partners-api.yesim.biz</span>. This local preview cannot complete that TLS
                  handshake, which is why you see <span className="font-mono">fetch failed</span>. Saving the token to D1
                  still works. Use the deployed Worker at{' '}
                  <span className="font-mono">crm.callbite.workers.dev</span> for live API actions.
                </div>
                <JsonBlock data={balance} />
                </>
                )}
              </div>
            </div>
          )}

          {tab === 'plans' && (
            <div className="space-y-4">
              <form onSubmit={handleLoadPlans} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <FieldLabel>Search plans (name, country, operator)</FieldLabel>
                  <TextInput value={planSearch} onChange={(e) => setPlanSearch(e.target.value)} placeholder="Pakistan, Turkey, 10GB..." />
                </div>
                <div className="w-full md:w-48">
                  <FieldLabel>Filter plan_type</FieldLabel>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="">All</option>
                    <option value="country">country</option>
                    <option value="region">region</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" leftIcon={<Globe className="w-4 h-4" />} isLoading={isPlansLoading}>
                    Load /plans
                  </Button>
                </div>
              </form>

              {isPlansLoading ? (
                <LoadingSpinner label="Fetching Yesim catalog..." />
              ) : plans.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500 text-sm">
                  Load the live Yesim plan catalog, then import any plan into eSIM Packages & Bundles (PKR cost via EUR rate).
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
                  <div className="px-5 py-3 text-xs text-slate-500 border-b border-slate-100">
                    Showing {visiblePlans.length} of {plans.length} plans. Wholesale prices are Yesim currency (usually EUR); import converts cost to PKR.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Data / Days</th>
                          <th className="px-4 py-3">Coverage</th>
                          <th className="px-4 py-3">Wholesale</th>
                          <th className="px-4 py-3">IDs</th>
                          <th className="px-4 py-3 text-right">Import</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visiblePlans.map((p) => {
                          const key = String(p.old_id || p.id);
                          const costPkr = Math.round(Number(p.price || 0) * Number(eurToPkr || 310));
                          return (
                            <tr key={key} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{p.name}</div>
                                <div className="text-[10px] text-slate-400">{p.operators}</div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-emerald-700">
                                {p.data}
                                {p.data_unit || 'GB'} • {p.days}d
                              </td>
                              <td className="px-4 py-3">
                                {p.countries_included}{' '}
                                <span className="text-slate-400">({p.plan_type})</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono">
                                  {p.currency || 'EUR'} {p.price}
                                </div>
                                <div className="text-[10px] text-slate-400">≈ {formatPrice(costPkr)} cost</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                <div>old_id: {p.old_id || '—'}</div>
                                <div className="truncate max-w-[140px]" title={p.id}>
                                  id: {p.id}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  leftIcon={<Import className="w-3 h-3" />}
                                  isLoading={importingId === key}
                                  onClick={() => handleImportPlan(p)}
                                >
                                  To Packages
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'issue' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" /> POST /new_user
                </h3>
                <FieldLabel>Customer email on Yesim</FieldLabel>
                <TextInput type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="customer@email.com" />
                <Button variant="primary" onClick={handleNewUser} isLoading={isIssuing} leftIcon={<UserPlus className="w-4 h-4" />}>
                  Create Yesim User
                </Button>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SimCard className="w-4 h-4 text-emerald-600" /> GET /new_esim
                  </h3>
                  <FieldLabel>Yesim user_id (optional)</FieldLabel>
                  <TextInput value={yesimUserId} onChange={(e) => setYesimUserId(e.target.value)} placeholder="Assign to user_id from /new_user" />
                  <Button variant="success" onClick={handleNewEsim} isLoading={isIssuing}>
                    Issue Single eSIM
                  </Button>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" /> POST /issue_esim
                  </h3>
                  <FieldLabel>Bulk count</FieldLabel>
                  <TextInput type="number" min={1} value={issueCount} onChange={(e) => setIssueCount(e.target.value)} />
                  <Button variant="secondary" onClick={handleIssueBulk} isLoading={isIssuing}>
                    Bulk Issue eSIMs
                  </Button>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-3">
                <h3 className="text-base font-bold text-slate-900">Last issue response</h3>
                {issueResult?.iccid && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
                    <span className="font-mono font-bold text-emerald-900">{issueResult.iccid}</span>
                    <button onClick={() => copyText(String(issueResult.iccid), 'ICCID copied')} className="text-emerald-700">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {issueResult?.qrcode && (
                  <div className="text-[11px] font-mono break-all bg-slate-50 border border-slate-200 rounded-xl p-3">{issueResult.qrcode}</div>
                )}
                <JsonBlock data={issueResult} />
              </div>
            </div>
          )}

          {tab === 'activate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" /> POST /add_plan_iccid
                </h3>
                <p className="text-xs text-slate-500">
                  Use numeric `old_id` from the Plans tab when Yesim expects it (example: 6314), otherwise the plan `id`.
                </p>
                <FieldLabel>ICCID</FieldLabel>
                <TextInput value={activateIccid} onChange={(e) => setActivateIccid(e.target.value)} placeholder="8937..." />
                <FieldLabel>Plan ID</FieldLabel>
                <TextInput value={activatePlanId} onChange={(e) => setActivatePlanId(e.target.value)} placeholder="old_id or plan id" />
                <Button variant="primary" onClick={handleActivate} isLoading={isActivating} leftIcon={<Zap className="w-4 h-4" />}>
                  Activate Plan on ICCID
                </Button>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                <h3 className="text-base font-bold text-slate-900 mb-3">Activation response</h3>
                <JsonBlock data={activateResult} />
              </div>
            </div>
          )}

          {tab === 'lookup' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-600" /> GET /sim_info
                  </h3>
                  <FieldLabel>ICCID</FieldLabel>
                  <TextInput value={lookupIccid} onChange={(e) => setLookupIccid(e.target.value)} placeholder="8937..." />
                  <Button variant="primary" onClick={handleSimInfo} isLoading={isLookingUp}>
                    Fetch SIM Info
                  </Button>
                  {lookupResult?.img && String(lookupResult.img).startsWith('data:image') && (
                    <img src={lookupResult.img} alt="eSIM QR" className="w-40 h-40 rounded-xl border border-slate-200" />
                  )}
                  {simQr && typeof simQr === 'string' && simQr.startsWith('LPA:') && (
                    <div className="text-[11px] font-mono break-all bg-slate-50 border rounded-xl p-3">{simQr}</div>
                  )}
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                  <h3 className="text-base font-bold text-slate-900 mb-3">SIM response</h3>
                  <JsonBlock data={lookupResult} />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-3">
                <h3 className="text-base font-bold text-slate-900">POST /bulk_sim_info</h3>
                <FieldLabel>ICCIDS (comma or new line)</FieldLabel>
                <textarea
                  rows={3}
                  value={bulkIccids}
                  onChange={(e) => setBulkIccids(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 font-mono"
                  placeholder="8937..., 8937..."
                />
                <Button variant="secondary" onClick={handleBulkSimInfo} isLoading={isBulkLoading}>
                  Bulk Lookup
                </Button>
                <JsonBlock data={bulkResult} />
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Cached profiles in D1</h3>
                  <Button size="sm" variant="ghost" onClick={handleLoadProfiles}>
                    Refresh
                  </Button>
                </div>
                {profiles.length === 0 ? (
                  <p className="text-xs text-slate-400">No cached Yesim profiles yet. Issue or look up an eSIM first.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2">ICCID</th>
                          <th>User</th>
                          <th>Status</th>
                          <th>Plan</th>
                          <th>Data left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {profiles.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 font-mono font-bold">{p.iccid}</td>
                            <td>{p.yesim_user_id || '—'}</td>
                            <td>{p.status_qr || '—'}</td>
                            <td>{p.active_plan_id || '—'}</td>
                            <td>{p.data_left_mb != null ? `${p.data_left_mb} MB` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900">GET /user</h3>
                <FieldLabel>Yesim user_id</FieldLabel>
                <TextInput value={userLookupId} onChange={(e) => setUserLookupId(e.target.value)} placeholder="405" />
                <Button variant="primary" onClick={handleUserLookup} isLoading={isUserLoading}>
                  Load User + eSIMs
                </Button>
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h3 className="text-base font-bold text-slate-900">POST /change_esim</h3>
                  <p className="text-xs text-slate-500">Replaces the user eSIM. Yesim allows up to 3 replacements per user.</p>
                  <FieldLabel>Yesim user_id</FieldLabel>
                  <TextInput value={changeUserId} onChange={(e) => setChangeUserId(e.target.value)} placeholder="405" />
                  <Button variant="secondary" onClick={handleChangeEsim} isLoading={isUserLoading}>
                    Replace eSIM
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">User response</h3>
                  <JsonBlock data={userResult} />
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Change eSIM response</h3>
                  <JsonBlock data={changeResult} />
                </div>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleOrders();
                }}
                className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card flex flex-col sm:flex-row gap-3"
              >
                <div className="flex-1">
                  <FieldLabel>Search (iccid, user_id, or empty for all)</FieldLabel>
                  <TextInput value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="ICCID or user_id" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" isLoading={isOrdersLoading} leftIcon={<Download className="w-4 h-4" />}>
                    Load /orders
                  </Button>
                </div>
              </form>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                <JsonBlock data={orders} />
              </div>
            </div>
          )}

          {tab === 'tools' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
                <h3 className="text-base font-bold text-slate-900">POST /cancel_plan</h3>
                <FieldLabel>ICCID</FieldLabel>
                <TextInput value={cancelIccid} onChange={(e) => setCancelIccid(e.target.value)} />
                <FieldLabel>Plan ID (optional)</FieldLabel>
                <TextInput value={cancelPlanId} onChange={(e) => setCancelPlanId(e.target.value)} />
                <Button
                  variant="danger"
                  isLoading={isToolsLoading}
                  onClick={() =>
                    runTool(
                      async () => {
                        const res = await api.post('/api/yesim/cancel-plan', {
                          iccid: cancelIccid.trim(),
                          plan_id: cancelPlanId.trim() || undefined,
                        });
                        return res.data;
                      },
                      'Cancel plan requested.'
                    )
                  }
                >
                  Cancel Plan
                </Button>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-4 h-4" /> POST /set_notification_url
                  </h3>
                  <FieldLabel>Webhook URL</FieldLabel>
                  <TextInput value={notifyUrl} onChange={(e) => setNotifyUrl(e.target.value)} placeholder="https://..." />
                  <Button
                    variant="secondary"
                    isLoading={isToolsLoading}
                    onClick={() =>
                      runTool(async () => {
                        const res = await api.post('/api/yesim/notification-url', { url: notifyUrl.trim() });
                        return res.data;
                      }, 'Notification URL set.')
                    }
                  >
                    Save Notification URL
                  </Button>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Radio className="w-4 h-4" /> GET /allowed_operators
                  </h3>
                  <FieldLabel>Country (optional)</FieldLabel>
                  <TextInput value={operatorCountry} onChange={(e) => setOperatorCountry(e.target.value)} placeholder="PK / Pakistan" />
                  <Button
                    variant="secondary"
                    isLoading={isToolsLoading}
                    onClick={() =>
                      runTool(async () => {
                        const res = await api.get('/api/yesim/allowed-operators', { country: operatorCountry.trim() });
                        return res.data;
                      }, 'Operators loaded.')
                    }
                  >
                    Load Operators
                  </Button>
                </div>

                <Button
                  variant="outline"
                  leftIcon={<Smartphone className="w-4 h-4" />}
                  isLoading={isToolsLoading}
                  onClick={() =>
                    runTool(async () => {
                      const res = await api.get('/api/yesim/supported-devices');
                      return res.data;
                    }, 'Device list loaded.')
                  }
                >
                  GET /supported_devices
                </Button>
              </div>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
                <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <FileJson className="w-4 h-4" /> Tool response
                </h3>
                <JsonBlock data={toolsResult} />
              </div>
            </div>
          )}

          {tab === 'logs' && (
            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Yesim API activity (D1)</h3>
                <Button size="sm" variant="secondary" onClick={handleLoadLogs} isLoading={isLogsLoading}>
                  Refresh
                </Button>
              </div>
              {isLogsLoading ? (
                <LoadingSpinner label="Loading logs..." />
              ) : logs.length === 0 ? (
                <p className="p-8 text-sm text-slate-400 text-center">No Yesim API calls logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Staff</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Endpoint</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="align-top">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{log.created_at?.replace('T', ' ').slice(0, 19)}</td>
                          <td className="px-4 py-3">{log.staff_name || '—'}</td>
                          <td className="px-4 py-3 font-bold">{log.action}</td>
                          <td className="px-4 py-3 font-mono text-[11px]">{log.endpoint}</td>
                          <td className="px-4 py-3">
                            {log.success ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {log.status_code || 'OK'}
                              </span>
                            ) : (
                              <span className="text-rose-600">{log.status_code || 'ERR'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
