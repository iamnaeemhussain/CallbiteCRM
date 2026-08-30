import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { useSettings } from '../../contexts/SettingsContext';
import { api } from '../../utils/api';
import { formatDate, cleanPhoneForWhatsApp } from '../../utils/formatters';
import { Copy, MessageSquare, RefreshCw, Zap } from 'lucide-react';

interface EsimProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  esim: any;
  onUpdated?: () => void;
}

function toNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtGb(mb: number | null): string {
  if (mb == null) return '—';
  return `${(mb / 1024).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;
}

function fmtMb(mb: number | null): string {
  if (mb == null) return '—';
  return `${mb.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

function pickPassport(data: any, esim: any): string | null {
  return (
    data?.esim_passport ||
    data?.esimpass ||
    data?.esim_pass ||
    data?.passport_url ||
    data?.esim_passport_url ||
    esim?.esim_passport_url ||
    null
  );
}

function pickIos(data: any, esim: any): string | null {
  return data?.ios_tap_link || data?.ios_link || esim?.ios_tap_link || null;
}

function pickLpa(data: any, esim: any): string {
  const v = data?.qrcode || data?.activation_code || esim?.qr_code_data || '';
  return String(v || '');
}

const WA_TEMPLATES = [
  {
    id: 'renewal',
    label: 'Renewal Reminder',
    key: 'wa_template_renewal',
    fallback: 'Hello! Your {package_name} eSIM ({iccid}) is expiring on {expiry_date}. Would you like to renew it today?',
  },
  {
    id: 'expiry',
    label: 'Expiry Notice',
    key: 'wa_template_expiry',
    fallback: 'Friendly reminder from Pak-tel.com that your {package_name} eSIM ({iccid}) will expire on {expiry_date}.',
  },
  {
    id: 'confirmation',
    label: 'Renewal Success',
    key: 'wa_template_confirmation',
    fallback: 'Your eSIM renewal for {package_name} ({iccid}) has been processed. New expiry date is {expiry_date}.',
  },
  {
    id: 'support',
    label: 'Support Reply',
    key: 'wa_template_support',
    fallback: 'Thank you for contacting Pak-tel.com support about eSIM {iccid} ({package_name}). Expiry: {expiry_date}.',
  },
];

function fillWaTemplate(raw: string, vars: { package_name: string; expiry_date: string; iccid: string }) {
  return String(raw || '')
    .replace(/\{package_name\}/g, vars.package_name)
    .replace(/\{expiry_date\}/g, vars.expiry_date)
    .replace(/\{iccid\}/g, vars.iccid);
}

export const EsimProfileModal: React.FC<EsimProfileModalProps> = ({ isOpen, onClose, esim, onUpdated }) => {
  const toast = useToast();
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [live, setLive] = useState<any>(esim);
  const [raw, setRaw] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [showTopup, setShowTopup] = useState(false);
  const [showWa, setShowWa] = useState(false);
  const [waTemplateId, setWaTemplateId] = useState('renewal');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [isTopping, setIsTopping] = useState(false);

  const loadLive = async () => {
    if (!esim?.iccid) return;
    setIsLoading(true);
    try {
      const res = await api.get('/api/yesim/sim-info', { iccid: esim.iccid });
      setRaw(res.data || null);
      const merged = { ...esim, ...(res.inventory || {}), ...(res.data || {}) };
      if (res.data) {
        merged.data_left_mb = res.data.data_left_mb ?? esim.data_left_mb;
        merged.data_package_mb = res.data.data_package_mb ?? esim.data_package_mb;
        merged.data_used_mb = res.data.data_used_mb ?? esim.data_used_mb;
        merged.plan_activated_at = res.data.plan_activated_at || esim.activation_date;
        merged.plan_expired_at = res.data.plan_expired_at || esim.expiry_date;
        merged.qr_code_data = pickLpa(res.data, esim);
        merged.ios_tap_link = pickIos(res.data, esim);
        merged.esim_passport_url = pickPassport(res.data, esim);
      }
      setLive(merged);
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch live SIM info.');
      setLive(esim);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && esim) {
      setLive(esim);
      setShowTopup(false);
      setShowWa(false);
      loadLive();
      api
        .get('/api/yesim/pakistan-plans')
        .then((res) => setPlans(res.plans || []))
        .catch(() => setPlans([]));
    }
  }, [isOpen, esim?.id, esim?.iccid]);

  const used = toNum(live?.data_used_mb);
  const left = toNum(live?.data_left_mb);
  const pack = toNum(live?.data_package_mb);
  const total = pack != null ? pack : used != null && left != null ? used + left : null;
  const usedPct = total && total > 0 && used != null ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const leftPct = total && total > 0 ? Math.min(100, Math.max(0, 100 - usedPct)) : 0;

  const lpa = pickLpa(raw, live);
  const isImageQr = lpa.startsWith('data:image/') || lpa.startsWith('http://') || lpa.startsWith('https://');
  const iosLink =
    pickIos(raw, live) ||
    (lpa.startsWith('LPA:')
      ? `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`
      : null);
  const passport = pickPassport(raw, live);

  useEffect(() => {
    if (isOpen && !isImageQr && canvasRef.current && lpa && lpa.startsWith('LPA:')) {
      QRCode.toCanvas(canvasRef.current, lpa, { width: 180, margin: 1 }, () => {});
    }
  }, [isOpen, lpa, isImageQr]);

  const holderName = live?.holder_name || live?.customer_name || 'Unassigned';
  const holderPhone = live?.holder_phone || live?.customer_phone || '';

  const waVars = {
    package_name: String(live?.package_name || 'eSIM'),
    expiry_date: formatDate(live?.plan_expired_at || live?.expiry_date),
    iccid: String(live?.iccid || ''),
  };
  const selectedWa = WA_TEMPLATES.find((t) => t.id === waTemplateId) || WA_TEMPLATES[0];
  const waMessage = fillWaTemplate(settings[selectedWa.key] || selectedWa.fallback, waVars);

  const handleTopup = async () => {
    if (!selectedPlanId) {
      toast.error('Select a Pakistan plan to top up.');
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    const planId = plan?.old_id || plan?.yesim_plan_id || selectedPlanId;
    setIsTopping(true);
    try {
      await api.post('/api/yesim/add-plan', {
        iccid: live.iccid,
        plan_id: String(planId),
        payment_id: paymentId.trim() || undefined,
      });
      toast.success('Top-up requested. Refreshing SIM info…');
      await loadLive();
      setShowTopup(false);
    } catch (err: any) {
      toast.error(err.message || 'Top-up failed.');
    } finally {
      setIsTopping(false);
    }
  };

  const handleWhatsAppSend = () => {
    const phone = cleanPhoneForWhatsApp(holderPhone);
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={holderName && holderName !== 'Unassigned' ? holderName : 'eSIM profile'}
      subtitle={live?.iccid}
      maxWidth="2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="whatsapp"
              size="sm"
              leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
              onClick={() => {
                setShowWa((v) => !v);
                setShowTopup(false);
              }}
            >
              WhatsApp
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="success"
              size="sm"
              leftIcon={<Zap className="w-3.5 h-3.5" />}
              onClick={() => {
                setShowTopup((v) => !v);
                setShowWa(false);
              }}
            >
              Top up
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      {isLoading && !raw ? (
        <LoadingSpinner label="Fetching latest SIM info…" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Holder</div>
              <div className="text-base font-black text-slate-900">{holderName}</div>
              <div className="font-mono text-xs text-slate-500">{holderPhone || 'No number'}</div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={loadLive}
            >
              Refresh SIM info
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Used</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{fmtGb(used)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{usedPct.toFixed(1)}% of plan</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Data Left</div>
              <div className="text-2xl font-black text-emerald-950 mt-1">{fmtGb(left)}</div>
              <div className="text-xs text-emerald-700 mt-0.5">{leftPct.toFixed(1)}% remaining</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Usage</div>
                <div className="text-xl font-black text-slate-900">{usedPct.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">used</div>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div className="h-full bg-slate-500" style={{ width: `${usedPct}%` }} />
              <div className="h-full bg-emerald-500" style={{ width: `${leftPct}%` }} />
            </div>
            <div className="text-xs text-slate-600 space-y-0.5 font-mono">
              <div>Used: {fmtMb(used)} ({usedPct.toFixed(1)}%)</div>
              <div>Left: {fmtMb(left)} ({leftPct.toFixed(1)}%)</div>
              <div>Total: {total != null ? total.toLocaleString('en-US') : '—'} MB</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Activated At</div>
              <div className="font-bold text-slate-900 mt-1">
                {formatDate(live?.plan_activated_at || live?.activation_date, true)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Expires At</div>
              <div className="font-bold text-slate-900 mt-1">
                {formatDate(live?.plan_expired_at || live?.expiry_date, true)}
              </div>
            </div>
          </div>

          <div id="esim-print-card" className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">QR Code & Activation</div>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="p-2 bg-white border border-slate-200 rounded-xl">
                {isImageQr ? (
                  <img src={lpa} alt="QR" className="w-36 h-36 object-contain" />
                ) : (
                  <canvas ref={canvasRef} className="rounded-lg" />
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">QR Code & String</div>
                  <div className="font-mono break-all text-slate-800 bg-slate-50 border border-slate-100 rounded-xl p-2">
                    {lpa || '—'}
                  </div>
                  {lpa && (
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(lpa);
                        toast.success('Activation string copied.');
                      }}
                    >
                      <Copy className="w-3 h-3" /> Copy LPA
                    </button>
                  )}
                </div>
                {iosLink && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">iOS Tap Link</div>
                    <a href={iosLink} target="_blank" rel="noreferrer" className="text-emerald-700 break-all underline">
                      {iosLink}
                    </a>
                  </div>
                )}
                {passport && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">eSIM Passport</div>
                    <a href={passport} target="_blank" rel="noreferrer" className="text-emerald-700 break-all underline">
                      {passport}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showWa && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
              <div className="text-xs font-bold text-emerald-950">Predefined WhatsApp Messages</div>
              <p className="text-[11px] text-slate-500">
                Fills Settings templates with <span className="font-mono font-bold">{'{package_name}'}</span>,{' '}
                <span className="font-mono font-bold">{'{expiry_date}'}</span>, <span className="font-mono font-bold">{'{iccid}'}</span>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WA_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWaTemplateId(t.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                      waTemplateId === t.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {waMessage || 'Save a template in Settings → WhatsApp Templates first.'}
              </div>
              <Button variant="whatsapp" size="sm" leftIcon={<MessageSquare className="w-3.5 h-3.5" />} onClick={handleWhatsAppSend}>
                Open WhatsApp
              </Button>
            </div>
          )}

          {showTopup && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
              <div className="text-xs font-bold text-emerald-950">Top up from Pakistan packages</div>
              {plans.length === 0 ? (
                <p className="text-xs text-slate-500">No saved Pakistan plans. Open Packages and load plans first.</p>
              ) : (
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-emerald-300 bg-white px-3 py-2"
                >
                  <option value="">-- Choose plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.data_amount}
                      {p.data_unit}/{p.days}d — {p.currency || 'EUR'} {p.wholesale_price}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="payment_id (optional)"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
              />
              <Button variant="success" size="sm" isLoading={isTopping} onClick={handleTopup}>
                Add plan to ICCID
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
