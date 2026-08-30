import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Search, Download, Copy, Radio, ScanSearch } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/formatters';

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

function yesNo(v: any): string {
  if (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'yes') {
    return 'Yes';
  }
  if (v === false || v === 0 || v === '0' || String(v).toLowerCase() === 'false' || String(v).toLowerCase() === 'no') {
    return 'No';
  }
  return v == null || v === '' ? 'No' : String(v);
}

function pickLpa(data: any): string {
  const v = data?.qrcode || data?.activation_code || data?.lpa || '';
  return String(v || '');
}

function pickPassport(data: any): string | null {
  return (
    data?.esim_passport ||
    data?.esimpass ||
    data?.esim_pass ||
    data?.passport_url ||
    data?.esim_passport_url ||
    null
  );
}

function pickIos(data: any, lpa: string): string | null {
  if (data?.ios_tap_link || data?.ios_link) return data.ios_tap_link || data.ios_link;
  if (lpa.startsWith('LPA:')) {
    return `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(lpa)}`;
  }
  return null;
}

function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-black text-slate-900 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  );
}

export const SimInfo: React.FC = () => {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [iccid, setIccid] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const lpa = pickLpa(data);
  const isImageQr = lpa.startsWith('data:image/') || lpa.startsWith('http://') || lpa.startsWith('https://');
  const img = data?.img && String(data.img).startsWith('data:image') ? String(data.img) : isImageQr ? lpa : null;
  const iosLink = pickIos(data, lpa);
  const passport = pickPassport(data);

  const used = toNum(data?.data_used_mb);
  const left = toNum(data?.data_left_mb);
  const pack = toNum(data?.data_package_mb);
  const total = pack != null ? pack : used != null && left != null ? used + left : null;
  const usedPct = total && total > 0 && used != null ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const leftPct = total && total > 0 ? Math.min(100, Math.max(0, 100 - usedPct)) : 0;

  const donut = useMemo(() => {
    const r = 54;
    const c = 2 * Math.PI * r;
    const usedLen = (usedPct / 100) * c;
    const leftLen = (leftPct / 100) * c;
    return { r, c, usedLen, leftLen };
  }, [usedPct, leftPct]);

  useEffect(() => {
    if (!data) return;
    const payload = !img && lpa && lpa.startsWith('LPA:') ? lpa : null;
    if (payload && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, payload, { width: 196, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }, () => {});
    }
  }, [data, lpa, img]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = iccid.trim();
    if (!q) {
      toast.error('Enter an ICCID to search.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get('/api/yesim/sim-info', { iccid: q });
      setData(res.data || null);
      toast.success('SIM info loaded from Yesim.');
    } catch (err: any) {
      setData(null);
      toast.error(err.message || 'Failed to fetch SIM info.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdf = () => {
    if (!data) {
      toast.error('Search an ICCID first.');
      return;
    }
    window.print();
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Could not copy.');
    }
  };

  const simId = data?.id ?? data?.sim_id ?? data?.yesim_id;
  const qrStatus = data?.status_qr || data?.status || '—';
  const planId = data?.active_plan_id || data?.plan_id || '—';
  const userId = data?.user_id ?? data?.yesim_user_id ?? '—';

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ScanSearch className="w-6 h-6 text-emerald-600" />
            Sim info
          </h2>
          <p className="text-xs text-slate-500 mt-1">Look up live Yesim `/sim_info` by ICCID. Share as a clean PDF of this card only.</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={handlePdf}
          disabled={!data}
        >
          Share as PDF
        </Button>
      </div>

      <form onSubmit={handleSearch} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card flex flex-col sm:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={iccid}
            onChange={(e) => setIccid(e.target.value)}
            placeholder="Search via ICCID — e.g. 8948010010084414332"
            className="w-full text-sm font-mono rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <Button type="submit" variant="primary" isLoading={isLoading} leftIcon={<Search className="w-4 h-4" />}>
          Search via ICCID
        </Button>
      </form>

      {isLoading && !data ? (
        <LoadingSpinner label="Fetching SIM info from Yesim..." />
      ) : !data ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-14 text-center print:hidden">
          <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No SIM loaded yet</h4>
          <p className="text-xs text-slate-400 mt-1">Paste an ICCID and search the Yesim Partner API.</p>
        </div>
      ) : (
        <div id="sim-info-print" className="rounded-[28px] border border-slate-200/80 bg-white shadow-card overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">Callbite Esim</div>
            <h3 className="text-xl font-black tracking-tight mt-1">eSIM Info — {data.iccid || iccid}</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Fact label="SIM ID" value={simId != null ? String(simId) : '—'} />
              <Fact label="QR Status" value={String(qrStatus)} />
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

            <div className="rounded-3xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
              <div className="flex flex-col items-center">
                <div className="relative w-[180px] h-[180px]">
                  <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                    <circle cx="70" cy="70" r={donut.r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
                    <circle
                      cx="70"
                      cy="70"
                      r={donut.r}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray={`${donut.leftLen} ${donut.c}`}
                      strokeDashoffset={-donut.usedLen}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={donut.r}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="16"
                      strokeLinecap="butt"
                      strokeDasharray={`${donut.usedLen} ${donut.c}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Usage</div>
                    <div className="text-3xl font-black text-slate-900 leading-none mt-1">{usedPct.toFixed(1)}%</div>
                    <div className="text-xs text-slate-500 mt-1">used</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5 font-mono">
                <div>
                  Used: {fmtMb(used)} ({usedPct.toFixed(1)}%)
                </div>
                <div>
                  Left: {fmtMb(left)} ({leftPct.toFixed(1)}%)
                </div>
                <div>Total: {total != null ? total.toLocaleString('en-US') : '—'} MB</div>
                <div className="flex items-center gap-4 pt-3 text-[11px] font-sans font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Used
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Left
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900 mb-3">Plan Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Fact label="Plan ID" value={String(planId)} mono />
                <Fact label="User ID" value={String(userId)} />
                <Fact label="Activated At" value={formatDate(data.plan_activated_at, true)} />
                <Fact label="Expires At" value={formatDate(data.plan_expired_at, true)} />
                <Fact label="Created At" value={formatDate(data.created_at, true)} />
                <Fact label="Is Voucher" value={yesNo(data.is_voucher)} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900 mb-3">SIM Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Fact label="ICCID" value={data.iccid} mono />
                <Fact label="IMSI" value={data.imsi} mono />
                <Fact label="MSISDN" value={data.msisdn != null ? String(data.msisdn) : '—'} mono />
                <Fact label="Is Deleted" value={yesNo(data.is_deleted ?? data.deleted)} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900 mb-3">QR Code & Activation</h4>
              <div className="rounded-3xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-5 items-start bg-slate-50/40">
                <div className="p-2 bg-white border border-slate-200 rounded-2xl shrink-0">
                  {img ? (
                    <img src={img} alt="eSIM QR" className="w-48 h-48 object-contain" />
                  ) : (
                    <canvas ref={canvasRef} className="rounded-lg" width={196} height={196} />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-3 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">QR Code String</div>
                    <div className="font-mono break-all text-slate-800 bg-white border border-slate-100 rounded-xl p-3">
                      {lpa || '—'}
                    </div>
                    {lpa && (
                      <button
                        type="button"
                        className="mt-1 text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 print:hidden"
                        onClick={() => copyText(lpa, 'Activation string copied.')}
                      >
                        <Copy className="w-3 h-3" /> Copy LPA
                      </button>
                    )}
                  </div>
                  {iosLink && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">iOS Tap Link</div>
                      <a href={iosLink} target="_blank" rel="noreferrer" className="text-emerald-700 break-all underline">
                        {iosLink}
                      </a>
                    </div>
                  )}
                  {passport && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">eSIM Passport</div>
                      <a href={passport} target="_blank" rel="noreferrer" className="text-emerald-700 break-all underline">
                        {passport}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
