import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  fullPage = false,
}) => {
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm font-semibold text-slate-700">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
};
