import React from 'react';

function formatMb(mb?: number | null): string {
  const n = Number(mb);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1024) {
    const gb = n / 1024;
    return `${gb.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} GB`;
  }
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} MB`;
}

interface DataUsageMeterProps {
  dataLeftMb?: number | string | null;
  dataPackageMb?: number | string | null;
  dataUsedMb?: number | string | null;
  compact?: boolean;
}

export const DataUsageMeter: React.FC<DataUsageMeterProps> = ({
  dataLeftMb,
  dataPackageMb,
  dataUsedMb,
  compact = false,
}) => {
  const pack = dataPackageMb == null || dataPackageMb === '' ? null : Number(dataPackageMb);
  const left = dataLeftMb == null || dataLeftMb === '' ? null : Number(dataLeftMb);
  const usedRaw = dataUsedMb == null || dataUsedMb === '' ? null : Number(dataUsedMb);

  if (pack == null && left == null && usedRaw == null) {
    return compact ? <span className="text-[11px] text-slate-400">No usage data</span> : null;
  }

  const total = pack != null && Number.isFinite(pack) ? pack : (left || 0) + (usedRaw || 0);
  const used =
    usedRaw != null && Number.isFinite(usedRaw) ? usedRaw : total && left != null ? Math.max(0, total - left) : 0;
  const remaining = left != null && Number.isFinite(left) ? left : Math.max(0, total - used);
  const usedPct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const leftPct = total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;

  return (
    <div className={compact ? 'space-y-1 min-w-[150px]' : 'space-y-2'}>
      {!compact && <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data usage</div>}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex border border-slate-200/80">
        <div className="h-full bg-slate-400/80" style={{ width: `${usedPct}%` }} title={`Used ${formatMb(used)}`} />
        <div className="h-full bg-emerald-500" style={{ width: `${leftPct}%` }} title={`Left ${formatMb(remaining)}`} />
      </div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-2'} text-center`}>
        <div className={compact ? '' : 'rounded-lg bg-slate-50 border border-slate-100 px-1.5 py-1'}>
          <div className="text-[9px] font-bold uppercase text-slate-400">Used</div>
          <div className="text-[11px] font-black text-slate-700 font-mono">{formatMb(used)}</div>
        </div>
        <div className={compact ? '' : 'rounded-lg bg-emerald-50 border border-emerald-100 px-1.5 py-1'}>
          <div className="text-[9px] font-bold uppercase text-emerald-700">Left</div>
          <div className="text-[11px] font-black text-emerald-800 font-mono">{formatMb(remaining)}</div>
        </div>
        <div className={compact ? '' : 'rounded-lg bg-white border border-slate-100 px-1.5 py-1'}>
          <div className="text-[9px] font-bold uppercase text-slate-400">Package</div>
          <div className="text-[11px] font-black text-slate-900 font-mono">{formatMb(total)}</div>
        </div>
      </div>
    </div>
  );
};
