import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  trend?: string;
  trendPositive?: boolean;
  onClick?: () => void;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-slate-100 text-slate-700',
  trend,
  trendPositive,
  onClick,
  accentColor,
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-md transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      }`}
    >
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <h4 className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight">{value}</h4>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className={`p-3 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${iconBgColor}`}>
          {icon}
        </div>
      </div>

      {(trend || onClick) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {trend && (
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                trendPositive === true
                  ? 'text-emerald-600'
                  : trendPositive === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend}
            </span>
          )}
          {onClick && (
            <span className="text-slate-400 group-hover:text-slate-700 flex items-center gap-0.5 ml-auto font-medium transition-colors">
              View records <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}
    </div>
  );
};
