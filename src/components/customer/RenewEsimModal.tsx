import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Esim } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { RefreshCw, Sparkles, ArrowRight, Package } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface RenewEsimModalProps {
  isOpen: boolean;
  onClose: () => void;
  esim: Esim | null;
  customerName?: string;
  onSuccess: (newExpiryDate?: string) => void;
}

export const RenewEsimModal: React.FC<RenewEsimModalProps> = ({
  isOpen,
  onClose,
  esim,
  customerName,
  onSuccess,
}) => {
  const { packages, presets, currencySymbol, formatPrice } = useSettings();
  const toast = useToast();

  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [packageName, setPackageName] = useState('');
  const [dataAllowance, setDataAllowance] = useState('10GB');
  const [duration, setDuration] = useState('30 Days');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [sellingPrice, setSellingPrice] = useState('4500');
  const [costPrice, setCostPrice] = useState('2800');
  const [paymentMethod, setPaymentMethod] = useState('Easypaisa');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (esim && isOpen) {
      setPackageName(esim.package_name || '');
      setDataAllowance(esim.data_allowance || '10GB');
      setDuration(esim.duration || '30 Days');

      // Calculate new expiry date based on current expiry or today
      const currentExpiry = new Date(esim.expiry_date);
      const today = new Date();
      const baseDate = currentExpiry > today ? currentExpiry : today;

      const daysMatch = (esim.duration || '30 Days').match(/(\d+)\s*Days?/i);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

      const nextExpiry = new Date(baseDate);
      nextExpiry.setDate(nextExpiry.getDate() + days);
      setNewExpiryDate(nextExpiry.toISOString().slice(0, 10));

      // Match preset/package if possible
      const matched = packages.find((p) => p.package_name === esim.package_name || p.country_region === esim.country_region);
      if (matched) {
        setSelectedPackageId(String(matched.id));
        setSellingPrice(matched.selling_price.toString());
        setCostPrice(matched.cost_price.toString());
      } else {
        setSellingPrice('4500');
        setCostPrice('2800');
      }

      setPaymentMethod('Easypaisa');
      setPaymentStatus('Paid');
      setReferenceId('');
      setNotes(`Monthly renewal for ${esim.package_name}`);
    }
  }, [esim, isOpen, packages]);

  const handlePackageSelect = (pkgIdStr: string) => {
    setSelectedPackageId(pkgIdStr);
    const pkg = packages.find((p) => String(p.id) === pkgIdStr) || presets.find((p) => String(p.id) === pkgIdStr);
    if (pkg) {
      setPackageName(pkg.package_name);
      setDataAllowance(pkg.data_allowance);
      setDuration(pkg.duration);
      setSellingPrice((pkg as any).selling_price ? (pkg as any).selling_price.toString() : (pkg as any).default_selling_price?.toString() || '4500');
      setCostPrice((pkg as any).cost_price ? (pkg as any).cost_price.toString() : (pkg as any).default_cost_price?.toString() || '2800');

      // Recalculate expiry
      const daysMatch = pkg.duration.match(/(\d+)\s*Days?/i);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

      const base = esim && new Date(esim.expiry_date) > new Date() ? new Date(esim.expiry_date) : new Date();
      const nextExp = new Date(base);
      nextExp.setDate(nextExp.getDate() + days);
      setNewExpiryDate(nextExp.toISOString().slice(0, 10));
    }
  };

  const calculateProfit = () => {
    const s = parseFloat(sellingPrice) || 0;
    const c = parseFloat(costPrice) || 0;
    return s - c;
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esim) return;

    if (!newExpiryDate) {
      toast.error('New expiry date is required.');
      return;
    }

    if (sellingPrice === '' || isNaN(parseFloat(sellingPrice))) {
      toast.error('Valid selling price is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/renewals', {
        customer_id: esim.customer_id,
        esim_id: esim.id,
        package_name: packageName.trim(),
        data_allowance: dataAllowance.trim(),
        duration: duration.trim(),
        new_expiry_date: newExpiryDate,
        selling_price: parseFloat(sellingPrice),
        cost_price: parseFloat(costPrice) || 0,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        reference_id: referenceId.trim() || null,
        notes: notes.trim() || null,
      });

      toast.success(`eSIM Renewed! Expiry extended to ${formatDate(newExpiryDate)}`);
      onSuccess(newExpiryDate);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process renewal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!esim) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Renew eSIM Package"
      subtitle={`Customer: ${customerName || esim.customer_name || 'Customer'} — ICCID: ${esim.iccid}`}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleRenew}
            isLoading={isSubmitting}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Process Renewal & Record Payment
          </Button>
        </>
      }
    >
      <form onSubmit={handleRenew} className="space-y-4">
        {/* Previous state vs New state visual card */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Current Expiry Date
            </span>
            <div className="text-sm font-semibold text-rose-300">
              {formatDate(esim.expiry_date)} ({esim.package_name})
            </div>
          </div>

          <div className="hidden sm:flex items-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-emerald-400" />
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              New Expiry Date
            </span>
            <div className="text-sm font-bold text-emerald-400">
              {formatDate(newExpiryDate) || '—'} ({packageName || 'Same Package'})
            </div>
          </div>
        </div>

        {/* Package Selector */}
        <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Select Renewal Package:</span>
          </div>
          <select
            value={selectedPackageId}
            onChange={(e) => handlePackageSelect(e.target.value)}
            className="text-xs font-bold rounded-xl border border-emerald-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 w-full sm:w-auto"
          >
            <option value="">-- Choose Package Bundle (Auto-Fills Price) --</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.country_region}: {p.package_name} ({p.data_allowance} / {p.duration}) — Rs. {p.selling_price.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Package & Date Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Package Name *
            </label>
            <input
              type="text"
              required
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              New Expiry Date *
            </label>
            <input
              type="date"
              required
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="w-full text-sm font-semibold rounded-xl border border-emerald-400 bg-emerald-50/40 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Data Allowance
            </label>
            <input
              type="text"
              value={dataAllowance}
              onChange={(e) => setDataAllowance(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Duration
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Financial & Payment Information (PKR) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Payment & Transaction Details ({currencySymbol})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Selling Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="1"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full text-sm font-bold font-mono rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Cost Price ({currencySymbol})
              </label>
              <input
                type="number"
                step="1"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full text-sm font-mono rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
              >
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Transaction / Receipt Reference
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. EP-998822 / Bank Transfer Ref"
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
            <span className="font-bold text-emerald-700">
              Calculated Net Profit: {currencySymbol} {calculateProfit().toLocaleString()}
            </span>
            <span className="text-slate-400">
              Updates eSIM expiry, logs transaction & timeline
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Renewal Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Renewed via WhatsApp message request"
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </form>
    </Modal>
  );
};
