import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-medium' : 'px-2.5 py-1 text-xs font-semibold';

  const variantClasses = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-sky-50 text-sky-700 border-sky-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
    outline: 'bg-transparent text-slate-700 border-slate-300',
  }[variant];

  const dotColors = {
    default: 'bg-slate-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variantClasses} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      {children}
    </span>
  );
};

export function getStatusBadge(status?: string | null) {
  if (!status) return <Badge variant="neutral">None</Badge>;
  switch (status.toLowerCase()) {
    case 'active':
    case 'paid':
    case 'resolved':
    case 'completed':
      return <Badge variant="success" dot>{status}</Badge>;
    case 'pending':
    case 'in progress':
    case 'waiting for customer':
      return <Badge variant="warning" dot>{status}</Badge>;
    case 'urgent':
    case 'expired':
    case 'blocked':
    case 'refunded':
    case 'overdue':
      return <Badge variant="danger" dot>{status}</Badge>;
    case 'vip':
    case 'high':
      return <Badge variant="purple" dot>{status}</Badge>;
    case 'suspended':
    case 'inactive':
    case 'cancelled':
    case 'closed':
      return <Badge variant="neutral" dot>{status}</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}
