export function formatCurrency(amount: number | string | undefined | null, symbol = 'Rs.'): string {
  const num = Number(amount || 0);
  return `${symbol} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr?: string | null, includeTime = false): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Might be YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${monthNames[mIdx]} ${parts[0]}`;
      }
      return dateStr;
    }

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return dateStr || '—';
  }
}

export function getDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);

  const diffMs = exp.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getExpiryBadge(expiryDateStr?: string | null, status?: string) {
  if (!expiryDateStr) {
    return { text: 'No Expiry', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }

  if (status === 'Cancelled') {
    return { text: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  const days = getDaysRemaining(expiryDateStr);

  if (days < 0) {
    return {
      text: `Expired ${Math.abs(days)}d ago`,
      color: 'bg-red-50 text-red-700 border-red-200 font-semibold',
      isExpired: true,
    };
  }

  if (days === 0) {
    return {
      text: 'Expires Today',
      color: 'bg-amber-500 text-white border-amber-600 animate-pulse font-bold',
      isToday: true,
    };
  }

  if (days <= 3) {
    return {
      text: `Expires in ${days}d`,
      color: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
      isUrgent: true,
    };
  }

  if (days <= 7) {
    return {
      text: `Expires in ${days}d`,
      color: 'bg-orange-50 text-orange-700 border-orange-200',
      isSoon: true,
    };
  }

  return {
    text: `Active (${days}d left)`,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    isActive: true,
  };
}

export function cleanPhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return '';
  // Remove all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  // Strip leading + for wa.me
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

export function getWhatsAppLink(phone?: string | null, message?: string): string {
  const clean = cleanPhoneForWhatsApp(phone);
  if (!clean) return '#';
  let url = `https://wa.me/${clean}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  return url;
}
