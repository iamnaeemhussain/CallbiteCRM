import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Plus,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Trash2,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Pagination } from '../components/common/Pagination';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TransactionFormModal } from '../components/customer/TransactionFormModal';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/formatters';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total_revenue: 0,
    total_cost: 0,
    total_profit: 0,
    paid_count: 0,
    pending_count: 0,
    refunded_count: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { formatPrice, currencySymbol } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadTransactions = async (page = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/transactions', {
        search,
        transaction_type: transactionType,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        from_date: fromDate,
        to_date: toDate,
        page,
        limit: pagination.limit,
      });

      if (res.success) {
        setTransactions(res.transactions || []);
        if (res.summary) setSummary(res.summary);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load transactions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(1);
  }, [transactionType, paymentMethod, paymentStatus, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions(1);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export.');
      return;
    }

    const headers = ['Transaction ID', 'Customer', 'Phone', 'Type', 'Package', 'Selling Price', 'Cost Price', 'Profit', 'Payment Method', 'Payment Status', 'Reference ID', 'Date', 'Staff'];
    const rows = transactions.map((t) => [
      t.id,
      t.customer_name || '',
      t.customer_phone || '',
      t.transaction_type,
      t.package_name || '',
      t.selling_price,
      t.cost_price,
      t.profit,
      t.payment_method,
      t.payment_status,
      t.reference_id || '',
      t.date,
      t.staff_name || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callbite-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV Export downloaded!');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTransaction) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/transactions/${deleteTransaction.id}`);
      toast.success('Transaction removed.');
      setDeleteTransaction(null);
      loadTransactions(pagination.page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete transaction.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Financial Ledger & Purchases</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track all customer payments, renewal transactions, cost of goods, and net profits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue (Paid)</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatPrice(summary.total_revenue)}
          </div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">
            {summary.paid_count} completed payments
          </span>
        </div>

        <div className="p-5 rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cost Price</span>
          <div className="text-2xl font-black text-slate-700 mt-1">
            {formatPrice(summary.total_cost)}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">eSIM supplier & roaming cost</span>
        </div>

        <div className="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 shadow-card">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Net Profit</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            +{formatPrice(summary.total_profit)}
          </div>
          <span className="text-xs text-emerald-700 font-semibold mt-1 block">
            Margin: {summary.total_revenue > 0 ? Math.round((summary.total_profit / summary.total_revenue) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Transaction ID, Reference, Package, Customer Name..."
              className="w-full text-sm rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search
          </Button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Type
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Types</option>
              <option value="New eSIM">New eSIM</option>
              <option value="Renewal">Renewal</option>
              <option value="Package Upgrade">Package Upgrade</option>
              <option value="Package Change">Package Change</option>
              <option value="Refund">Refund</option>
              <option value="Adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Methods</option>
              <option value="Easypaisa">Easypaisa</option>
              <option value="JazzCash">JazzCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Refunded">Refunded</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        {isLoading ? (
          <LoadingSpinner label="Loading transactions..." />
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">No transactions recorded</h4>
            <p className="text-xs text-slate-400 mt-1">Record purchases or renewals to populate the ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Type & Package</th>
                  <th className="px-4 py-3.5">Selling Price</th>
                  <th className="px-4 py-3.5">Cost / Profit</th>
                  <th className="px-4 py-3.5">Method & Status</th>
                  <th className="px-4 py-3.5">Date & Staff</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/customers/${t.customer_id}?tab=transactions`)}
                  >
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {t.id}
                      {t.reference_id && (
                        <div className="text-[10px] text-slate-400 font-normal font-mono select-all">
                          Ref: {t.reference_id}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                      <div
                        onClick={() => navigate(`/customers/${t.customer_id}`)}
                        className="font-bold text-slate-900 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {t.customer_name}
                      </div>
                      <div className="font-mono text-slate-500 text-[11px]">{t.customer_phone}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">{t.transaction_type}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.package_name || 'eSIM'} {t.data_allowance ? `(${t.data_allowance})` : ''}
                      </div>
                    </td>

                    <td className="px-4 py-4 font-extrabold text-slate-900 text-sm">
                      {formatPrice(t.selling_price)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-slate-500">Cost: {formatPrice(t.cost_price)}</div>
                      <div className="font-bold text-emerald-700">+{formatPrice(t.profit)}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800">{t.payment_method}</div>
                      {getStatusBadge(t.payment_status)}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      <div>{formatDate(t.date, true)}</div>
                      <div className="text-[10px] text-slate-400">By: {t.staff_name || 'Staff'}</div>
                    </td>

                    <td className="px-5 py-4 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingTransaction(t)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTransaction({
                              id: t.id,
                              name: `${t.transaction_type} (${formatPrice(t.selling_price)})`,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(p) => loadTransactions(p)}
        />
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <TransactionFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => loadTransactions(1)}
        />
      )}

      {editingTransaction && (
        <TransactionFormModal
          isOpen={Boolean(editingTransaction)}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onSuccess={() => loadTransactions(pagination.page)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTransaction)}
        onClose={() => setDeleteTransaction(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Transaction"
        message={`Are you sure you want to remove ${deleteTransaction?.name}?`}
        confirmText="Delete Transaction"
        isLoading={isDeleting}
      />
    </div>
  );
};
