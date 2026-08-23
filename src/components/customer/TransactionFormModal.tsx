import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Transaction, TransactionType, PaymentMethod, PaymentStatus, Esim } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  customerEsims?: Esim[];
  transaction?: Transaction | null;
  onSuccess: (txnId?: string) => void;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerEsims = [],
  transaction,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const toast = useToast();

  const isEdit = Boolean(transaction);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [esimId, setEsimId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('New eSIM');
  const [packageName, setPackageName] = useState('');
  const [dataAllowance, setDataAllowance] = useState('10GB');
  const [duration, setDuration] = useState('30 Days');
  const [date, setDate] = useState('');
  const [sellingPrice, setSellingPrice] = useState('18.00');
  const [costPrice, setCostPrice] = useState('11.50');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Easypaisa');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allCustomers, setAllCustomers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (isOpen && !customerId && !isEdit) {
      api.get('/api/customers', { limit: 100 }).then((res) => {
        if (res.success && res.customers) {
          setAllCustomers(res.customers);
        }
      }).catch(() => {});
    }
  }, [isOpen, customerId, isEdit]);

  useEffect(() => {
    if (transaction) {
      setSelectedCustomerId(transaction.customer_id);
      setEsimId(transaction.esim_id || '');
      setTransactionType(transaction.transaction_type);
      setPackageName(transaction.package_name || '');
      setDataAllowance(transaction.data_allowance || '');
      setDuration(transaction.duration || '');
      setDate(transaction.date ? transaction.date.slice(0, 16) : '');
      setSellingPrice(transaction.selling_price.toString());
      setCostPrice(transaction.cost_price.toString());
      setPaymentMethod(transaction.payment_method);
      setPaymentStatus(transaction.payment_status);
      setReferenceId(transaction.reference_id || '');
      setNotes(transaction.notes || '');
    } else {
      setSelectedCustomerId(customerId || '');
      setEsimId(customerEsims.length > 0 ? customerEsims[0].id : '');
      setTransactionType('New eSIM');
      setPackageName(customerEsims.length > 0 ? customerEsims[0].package_name : 'eSIM Package');
      setDataAllowance(customerEsims.length > 0 ? customerEsims[0].data_allowance : '10GB');
      setDuration(customerEsims.length > 0 ? customerEsims[0].duration : '30 Days');
      setDate(new Date().toISOString().slice(0, 16));
      setSellingPrice('4500');
      setCostPrice('2800');
      setPaymentMethod('Easypaisa');
      setPaymentStatus('Paid');
      setReferenceId('');
      setNotes('');
    }
  }, [transaction, customerId, customerEsims, isOpen]);

  const handleEsimChange = (selectedId: string) => {
    setEsimId(selectedId);
    const found = customerEsims.find((e) => e.id === selectedId);
    if (found) {
      setPackageName(found.package_name);
      setDataAllowance(found.data_allowance);
      setDuration(found.duration);
    }
  };

  const calculateProfit = () => {
    const s = parseFloat(sellingPrice) || 0;
    const c = parseFloat(costPrice) || 0;
    return s - c;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCust = customerId || selectedCustomerId;
    if (!targetCust) {
      toast.error('Customer is required.');
      return;
    }

    if (sellingPrice === '' || isNaN(parseFloat(sellingPrice))) {
      toast.error('Valid selling price is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && transaction) {
        await api.put(`/api/transactions/${transaction.id}`, {
          transaction_type: transactionType,
          package_name: packageName.trim() || null,
          data_allowance: dataAllowance.trim() || null,
          duration: duration.trim() || null,
          date: date || new Date().toISOString(),
          selling_price: parseFloat(sellingPrice),
          cost_price: parseFloat(costPrice) || 0,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          reference_id: referenceId.trim() || null,
          notes: notes.trim() || null,
        });

        toast.success('Transaction updated successfully!');
        onSuccess(transaction.id);
        onClose();
      } else {
        const res = await api.post('/api/transactions', {
          customer_id: targetCust,
          esim_id: esimId || null,
          transaction_type: transactionType,
          package_name: packageName.trim() || null,
          data_allowance: dataAllowance.trim() || null,
          duration: duration.trim() || null,
          date: date || new Date().toISOString(),
          selling_price: parseFloat(sellingPrice),
          cost_price: parseFloat(costPrice) || 0,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          reference_id: referenceId.trim() || null,
          notes: notes.trim() || null,
        });

        toast.success('Transaction recorded successfully!');
        onSuccess(res.transaction_id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Transaction (${transaction?.id})` : 'Record Payment / Transaction'}
      subtitle={customerName ? `Customer: ${customerName}` : 'Financial ledger entry'}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Record Transaction'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer selector if not provided */}
        {!customerId && !isEdit && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Select Customer *
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- Select Customer --</option>
              {allCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Transaction Type *
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as TransactionType)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="New eSIM">New eSIM</option>
              <option value="Renewal">Renewal</option>
              <option value="Package Upgrade">Package Upgrade</option>
              <option value="Package Change">Package Change</option>
              <option value="Refund">Refund</option>
              <option value="Adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Linked eSIM (Optional)
            </label>
            <select
              value={esimId}
              onChange={(e) => handleEsimChange(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- No specific eSIM --</option>
              {customerEsims.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.package_name} ({e.iccid}) - {e.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Package Name
            </label>
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. Pakistan 10GB Standard"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Selling Price ({currencySymbol}) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full text-sm font-bold rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Cost Price ({currencySymbol})
            </label>
            <input
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Payment Status *
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white font-semibold"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Refunded">Refunded</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Transaction Reference / Receipt ID
            </label>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="e.g. EP-889911 / Bank Ref 990022"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Profit preview banner */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
          <span className="font-bold text-emerald-900">
            Estimated Profit: {currencySymbol}
            {calculateProfit().toFixed(2)}
          </span>
          <span className="text-emerald-700">
            {sellingPrice} (Selling) - {costPrice || 0} (Cost)
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment notes, invoice details..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </form>
    </Modal>
  );
};
