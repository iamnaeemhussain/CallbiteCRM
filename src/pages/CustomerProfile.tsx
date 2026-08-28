import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Share2,
  CardSim as SimCard,
  RefreshCw,
  Receipt,
  HelpCircle,
  MessageSquare,
  CheckSquare,
  FileText,
  Clock,
  Plus,
  Edit2,
  Trash2,
  QrCode,
  ExternalLink,
  ChevronLeft,
  DollarSign,
  Pin,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge, getStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CustomerTimeline } from '../components/customer/CustomerTimeline';
import { QRCodeModal } from '../components/common/QRCodeModal';
import { WhatsAppModal } from '../components/common/WhatsAppModal';
import { CustomerFormModal } from '../components/customer/CustomerFormModal';
import { EsimFormModal } from '../components/customer/EsimFormModal';
import { RenewEsimModal } from '../components/customer/RenewEsimModal';
import { TransactionFormModal } from '../components/customer/TransactionFormModal';
import { SupportTicketModal } from '../components/customer/SupportTicketModal';
import { InteractionModal } from '../components/customer/InteractionModal';
import { TaskFormModal } from '../components/customer/TaskFormModal';
import { NoteFormModal } from '../components/customer/NoteFormModal';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getExpiryBadge } from '../utils/formatters';

export const CustomerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'esims';

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAddEsimOpen, setIsAddEsimOpen] = useState(false);
  const [editingEsim, setEditingEsim] = useState<any | null>(null);
  const [renewingEsim, setRenewingEsim] = useState<any | null>(null);
  const [qrModalEsim, setQrModalEsim] = useState<any | null>(null);

  // Transactions Modals
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  // Support Modals
  const [isAddSupportOpen, setIsAddSupportOpen] = useState(false);
  const [editingSupport, setEditingSupport] = useState<any | null>(null);

  // Interaction Modal
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);

  // Task Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // Note Modals
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);

  // Deletion confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: any; name: string } | null>(null);

  const { formatPrice, currencySymbol } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/customers/${id}`);
      if (res && res.success) {
        setData(res);
      } else {
        toast.error(res?.error || 'Customer could not be loaded.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load customer profile.');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const setTab = (tabName: string) => {
    setSearchParams({ tab: tabName });
  };

  // Quick 1-click resolve support ticket
  const handleQuickResolveTicket = async (ticket: any) => {
    try {
      await api.put(`/api/support/${ticket.id}`, {
        status: 'Resolved',
        resolution: ticket.resolution || 'Issue resolved by staff member.',
      });
      toast.success(`Ticket #${ticket.id} marked as Resolved!`);
      loadProfile();
    } catch (err: any) {
      toast.error('Failed to resolve ticket.');
    }
  };

  // Quick toggle task completed
  const handleToggleTaskStatus = async (task: any) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await api.put(`/api/tasks/${task.id}`, {
        status: nextStatus,
      });
      toast.success(`Task marked as ${nextStatus}!`);
      loadProfile();
    } catch (err: any) {
      toast.error('Failed to update task status.');
    }
  };

  // Generic deletion handler
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'esim') {
        await api.delete(`/api/esims/${deleteConfirm.id}`);
        toast.success('eSIM cancelled and removed.');
      } else if (deleteConfirm.type === 'transaction') {
        await api.delete(`/api/transactions/${deleteConfirm.id}`);
        toast.success('Transaction removed from ledger.');
      } else if (deleteConfirm.type === 'support') {
        await api.delete(`/api/support/${deleteConfirm.id}`);
        toast.success('Support ticket deleted.');
      } else if (deleteConfirm.type === 'task') {
        await api.delete(`/api/tasks/${deleteConfirm.id}`);
        toast.success('Task deleted.');
      } else if (deleteConfirm.type === 'note') {
        await api.delete(`/api/notes/${deleteConfirm.id}`);
        toast.success('Note deleted.');
      }

      setDeleteConfirm(null);
      loadProfile();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    }
  };

  if (isLoading && !data) {
    return <LoadingSpinner label="Loading complete Customer 360 profile..." />;
  }

  if (!data || !data.customer) {
    return (
      <div className="text-center py-16">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Customer not found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-6">The requested customer could not be found or was removed.</p>
        <Button variant="secondary" onClick={() => navigate('/customers')}>
          Return to Customer List
        </Button>
      </div>
    );
  }

  const { customer, esims, transactions, support_tickets, interactions, tasks, notes, timeline, referred_customers } = data;

  // Calculate dynamic lifetime metrics from transactions
  const totalSpent = (transactions || []).reduce((acc: number, t: any) => acc + (t.payment_status === 'Paid' ? (Number(t.selling_price) || 0) : 0), 0);
  const totalProfit = (transactions || []).reduce((acc: number, t: any) => acc + (t.payment_status === 'Paid' ? (Number(t.profit) || (Number(t.selling_price) - Number(t.cost_price))) : 0), 0);

  const tabs = [
    { id: 'esims', label: `eSIMs (${esims?.length || 0})`, icon: SimCard },
    { id: 'transactions', label: `Transactions (${transactions?.length || 0})`, icon: Receipt },
    { id: 'support', label: `Support (${support_tickets?.length || 0})`, icon: HelpCircle },
    { id: 'interactions', label: `Contact History (${interactions?.length || 0})`, icon: MessageSquare },
    { id: 'tasks', label: `Tasks (${tasks?.length || 0})`, icon: CheckSquare },
    { id: 'notes', label: `Internal Notes (${notes?.length || 0})`, icon: FileText },
    { id: 'timeline', label: `Activity Timeline (${timeline?.length || 0})`, icon: Clock },
    ...(referred_customers?.length > 0
      ? [{ id: 'referrals', label: `Referrals (${referred_customers.length})`, icon: Share2 }]
      : []),
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Last activity: {formatDate(customer.last_activity_at, true)}</span>
        </div>
      </div>

      {/* CUSTOMER 360 HEADER CARD */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          {/* Customer Avatar & Primary Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-slate-900/10">
              {customer.full_name.charAt(0).toUpperCase()}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  {customer.full_name}
                </h1>
                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {customer.id}
                </span>
                {getStatusBadge(customer.status)}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {customer.tags?.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                  >
                    {tag}
                  </span>
                ))}
                {customer.assigned_staff_name && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    Assigned: <span className="font-bold text-slate-900">{customer.assigned_staff_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* QUICK ACTION BUTTONS BAR */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Contact on WhatsApp Button */}
            <Button
              variant="whatsapp"
              size="sm"
              leftIcon={<MessageSquare className="w-4 h-4" />}
              onClick={() => setIsWhatsAppOpen(true)}
              className="shadow-sm shadow-emerald-500/20 font-bold"
            >
              WhatsApp
            </Button>

            {/* Call */}
            <a
              href={`tel:${customer.whatsapp_number}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>

            {/* Add eSIM */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddEsimOpen(true)}
            >
              Add eSIM
            </Button>

            {/* Record Payment */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={() => setIsAddTransactionOpen(true)}
              className="font-bold border-slate-300"
            >
              Payment
            </Button>

            {/* Add Support */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<HelpCircle className="w-3.5 h-3.5 text-rose-500" />}
              onClick={() => setIsAddSupportOpen(true)}
            >
              Ticket
            </Button>

            {/* Add Task */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckSquare className="w-3.5 h-3.5 text-purple-600" />}
              onClick={() => setIsAddTaskOpen(true)}
            >
              Task
            </Button>

            {/* Add Note */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5 text-slate-600" />}
              onClick={() => setIsAddNoteOpen(true)}
            >
              Note
            </Button>

            {/* Edit Profile */}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setIsEditCustomerOpen(true)}
            >
              Edit
            </Button>
          </div>
        </div>

        {/* CONTACT & PROFILE METRICS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
          {/* WhatsApp Phone */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">WhatsApp</span>
            <span className="font-mono font-bold text-slate-900 select-all">{customer.whatsapp_number}</span>
          </div>

          {/* Email */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Email</span>
            <span className="font-medium text-slate-800 truncate block select-all">{customer.email || '—'}</span>
          </div>

          {/* Location */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Location</span>
            <span className="font-semibold text-slate-800">
              {customer.city ? `${customer.city}, ` : ''}{customer.country || '—'}
            </span>
          </div>

          {/* Source */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Acquisition Source</span>
            <div className="flex items-center gap-1 font-semibold text-emerald-700">
              <span>{customer.source}</span>
              {customer.referred_by_name && (
                <span
                  onClick={() => navigate(`/customers/${customer.referred_by_customer_id}`)}
                  className="underline cursor-pointer hover:text-emerald-900"
                >
                  ({customer.referred_by_name})
                </span>
              )}
            </div>
          </div>

          {/* Total Spent in PKR */}
          <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-0.5">Lifetime Purchases</span>
            <span className="font-bold text-emerald-900 text-sm">
              {formatPrice(totalSpent)}
            </span>
          </div>

          {/* Customer Since */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Member Since</span>
            <span className="font-mono text-slate-700">{formatDate(customer.created_at)}</span>
          </div>
        </div>

        {/* Internal Notes Banner (if any) */}
        {customer.internal_notes && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-950 flex items-start gap-2">
            <Pin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Staff Instructions / Notes: </span>
              {customer.internal_notes}
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-slate-200/60 rounded-2xl w-full max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CURRENT ESIMS */}
      {activeTab === 'esims' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Attached eSIMs ({esims?.length || 0})
            </h3>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddEsimOpen(true)}
            >
              Add Another eSIM
            </Button>
          </div>

          {esims?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <SimCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No eSIMs attached yet</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Add an eSIM profile with package bundle, carrier provider, and ICCID.
              </p>
              <Button size="sm" onClick={() => setIsAddEsimOpen(true)}>
                Add First eSIM
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {esims.map((e: any) => {
                const expiryBadge = getExpiryBadge(e.expiry_date, e.status);
                return (
                  <div
                    key={e.id}
                    className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-card hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: Region & Status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {e.country_region}
                          </span>
                          <h4 className="text-base font-black text-slate-900 tracking-tight">
                            {e.package_name}
                          </h4>
                        </div>
                        {getStatusBadge(e.status)}
                      </div>

                      {/* Package allowance details */}
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 mb-3">
                        <span>{e.data_allowance} Data</span>
                        <span>•</span>
                        <span>{e.duration}</span>
                        <span>•</span>
                        <span className="text-slate-600 font-normal">{e.provider}</span>
                      </div>

                      {/* Dates & Expiry badge */}
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">ICCID:</span>
                          <span className="font-mono text-slate-800 font-bold select-all">{e.iccid}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Expiry Date:</span>
                          <span className="font-bold text-slate-900">{formatDate(e.expiry_date)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Status Alert:</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${expiryBadge.color}`}>
                            {expiryBadge.text}
                          </span>
                        </div>

                        {e.apn_info && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">APN:</span>
                            <span className="font-mono text-slate-700">{e.apn_info}</span>
                          </div>
                        )}

                        {/* eSIM Specific Tag located below APN */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-400">eSIM Tag:</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-emerald-400 border border-slate-800">
                            {e.tag || 'Primary SIM'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <DataUsageMeter
                          dataLeftMb={e.data_left_mb}
                          dataPackageMb={e.data_package_mb}
                          dataUsedMb={e.data_used_mb}
                        />
                      </div>
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* QR Code Scannable modal */}
                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={<QrCode className="w-3.5 h-3.5" />}
                          onClick={() => setQrModalEsim(e)}
                        >
                          QR Code
                        </Button>

                        {/* WhatsApp Message */}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setIsWhatsAppOpen(true)}
                        >
                          WhatsApp
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* 1-Click Renew Button */}
                        <Button
                          variant="success"
                          size="xs"
                          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => setRenewingEsim(e)}
                          className="font-bold"
                        >
                          Renew
                        </Button>

                        {/* Edit eSIM */}
                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={<Edit2 className="w-3 h-3 text-emerald-600" />}
                          onClick={() => setEditingEsim(e)}
                          className="border-slate-300 font-semibold"
                        >
                          Edit
                        </Button>

                        {/* Cancel / Delete */}
                        <button
                          title="Cancel eSIM"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'esim',
                              id: e.id,
                              name: `${e.package_name} (${e.iccid})`,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURCHASE HISTORY / TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Purchase & Payment History ({transactions?.length || 0})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every purchase, renewal, and package change with profit margins
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingTransaction(null);
                setIsAddTransactionOpen(true);
              }}
            >
              Record Payment
            </Button>
          </div>

          {transactions?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs space-y-3">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No transactions recorded yet for {customer.full_name}.</p>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsAddTransactionOpen(true)}
              >
                Record First Payment
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Transaction ID</th>
                    <th className="px-4 py-3.5">Type & Package</th>
                    <th className="px-4 py-3.5">Selling Price</th>
                    <th className="px-4 py-3.5">Cost / Profit</th>
                    <th className="px-4 py-3.5">Method & Status</th>
                    <th className="px-4 py-3.5">Date & Staff</th>
                    <th className="px-5 py-3.5 text-right">Actions (Edit / Remove)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {t.id}
                        {t.reference_id && (
                          <div className="text-[10px] text-slate-400 font-normal">Ref: {t.reference_id}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{t.transaction_type}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.package_name || 'eSIM'} {t.data_allowance ? `(${t.data_allowance})` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {formatPrice(t.selling_price)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-slate-500">Cost: {formatPrice(t.cost_price)}</div>
                        <div className="font-semibold text-emerald-700">Profit: +{formatPrice(t.profit)}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{t.payment_method}</div>
                        {getStatusBadge(t.payment_status)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        <div>{formatDate(t.date, true)}</div>
                        <div className="text-[11px] text-slate-400">By: {t.staff_name || 'Staff'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Transaction */}
                          <Button
                            variant="secondary"
                            size="xs"
                            leftIcon={<Edit2 className="w-3 h-3 text-emerald-600" />}
                            onClick={() => {
                              setEditingTransaction(t);
                              setIsAddTransactionOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'transaction',
                                id: t.id,
                                name: `${t.transaction_type} (${formatPrice(t.selling_price)})`,
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Transaction"
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
        </div>
      )}

      {/* TAB 3: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Support History & Requests ({support_tickets?.length || 0})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Technical inquiries, APN guidance, and customer issue tracking
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingSupport(null);
                setIsAddSupportOpen(true);
              }}
            >
              Open Support Ticket
            </Button>
          </div>

          {support_tickets?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No support tickets logged for {customer.full_name}.</p>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsAddSupportOpen(true)}
              >
                Create First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {support_tickets.map((s: any) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        #{s.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{s.issue_type}</h4>
                      {getStatusBadge(s.priority)}
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(s.status)}
                      {s.status !== 'Resolved' && s.status !== 'Closed' && (
                        <Button
                          variant="success"
                          size="xs"
                          leftIcon={<Check className="w-3 h-3" />}
                          onClick={() => handleQuickResolveTicket(s)}
                        >
                          Quick Resolve
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="xs"
                        leftIcon={<Edit2 className="w-3 h-3 text-emerald-600" />}
                        onClick={() => {
                          setEditingSupport(s);
                          setIsAddSupportOpen(true);
                        }}
                      >
                        Edit / Update
                      </Button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'support',
                            id: s.id,
                            name: `Ticket #${s.id}`,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">{s.description}</p>

                  {s.resolution && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                      <span className="font-bold">Resolution: </span>
                      {s.resolution}
                      {s.resolved_date && (
                        <span className="text-[10px] text-emerald-700 block mt-0.5">
                          Resolved on {formatDate(s.resolved_date, true)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Created: {formatDate(s.created_at, true)}</span>
                    <span>Assigned: {s.assigned_staff_name || 'Unassigned'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONTACT HISTORY / INTERACTIONS */}
      {activeTab === 'interactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Customer Contact History ({interactions?.length || 0})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Logged WhatsApp chats, phone calls, and communication outcomes
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddInteractionOpen(true)}
            >
              Log Interaction
            </Button>
          </div>

          {interactions?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No communication logged yet.</p>
              <Button size="sm" onClick={() => setIsAddInteractionOpen(true)}>
                Record First Call / WhatsApp Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {item.contact_type}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{item.purpose || 'General Contact'}</span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDate(item.interaction_date, true)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    {item.notes}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div>
                      {item.outcome && (
                        <span>
                          Outcome: <span className="font-semibold text-slate-800">{item.outcome}</span>
                        </span>
                      )}
                    </div>
                    <span>Logged by: {item.staff_name || 'Staff'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TASKS / FOLLOW-UPS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Customer Tasks & Follow-ups ({tasks?.length || 0})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scheduled reminders, renewal calls, and action items
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingTask(null);
                setIsAddTaskOpen(true);
              }}
            >
              Add Task
            </Button>
          </div>

          {tasks?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs space-y-3">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No tasks scheduled for {customer.full_name}.</p>
              <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                Schedule Follow-up Reminder
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t: any) => {
                const isDone = t.status === 'Completed';
                return (
                  <div
                    key={t.id}
                    className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      isDone
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : 'bg-white border-slate-200 shadow-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleToggleTaskStatus(t)}
                        className="w-5 h-5 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Click to toggle completed"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {t.task_type}
                          </span>
                          {getStatusBadge(t.priority)}
                          {getStatusBadge(t.status)}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{t.notes}</p>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 font-mono">
                          <span>Due: {t.due_date} {t.due_time || ''}</span>
                          <span>Assigned: {t.assigned_staff_name || 'Staff'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit Task Button */}
                      <Button
                        variant="secondary"
                        size="xs"
                        leftIcon={<Edit2 className="w-3 h-3 text-emerald-600" />}
                        onClick={() => {
                          setEditingTask(t);
                          setIsAddTaskOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'task',
                            id: t.id,
                            name: `${t.task_type}`,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: INTERNAL NOTES */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Staff Internal Notes ({notes?.length || 0})
            </h3>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingNote(null);
                setIsAddNoteOpen(true);
              }}
            >
              Add Note
            </Button>
          </div>

          {notes?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 text-xs">
              No internal notes recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-5 rounded-3xl border transition-all space-y-2 ${
                    n.is_pinned
                      ? 'bg-amber-50/40 border-amber-200 shadow-sm'
                      : 'bg-white border-slate-200 shadow-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {n.is_pinned === 1 && <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      <h4 className="text-xs font-bold text-slate-900">{n.title || 'Note'}</h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingNote(n);
                          setIsAddNoteOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'note',
                            id: n.id,
                            name: `Note #${n.id}`,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{n.content}</p>

                  <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{formatDate(n.created_at, true)}</span>
                    <span>By: {n.staff_name || 'Staff'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: COMPLETE ACTIVITY TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Complete Chronological Activity Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every customer registration, eSIM addition, renewal, payment, and interaction auto-tracked
              </p>
            </div>
          </div>

          <CustomerTimeline entries={timeline} />
        </div>
      )}

      {/* TAB 8: REFERRED CUSTOMERS */}
      {activeTab === 'referrals' && referred_customers && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Customers Referred by {customer.full_name} ({referred_customers.length})
          </h3>

          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Customer Name / ID</th>
                  <th className="px-4 py-3.5">WhatsApp Phone</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">eSIM Count</th>
                  <th className="px-4 py-3.5">Date Joined</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {referred_customers.map((rc: any) => (
                  <tr
                    key={rc.id}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/customers/${rc.id}`)}
                  >
                    <td className="px-5 py-3.5 font-bold text-slate-900">{rc.full_name} ({rc.id})</td>
                    <td className="px-4 py-3.5 font-mono">{rc.whatsapp_number}</td>
                    <td className="px-4 py-3.5">{getStatusBadge(rc.status)}</td>
                    <td className="px-4 py-3.5 font-bold">{rc.esim_count || 0} eSIMs</td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{formatDate(rc.created_at)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <Button size="xs" variant="secondary" onClick={() => navigate(`/customers/${rc.id}`)}>
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ALL MODALS */}

      {/* Edit Customer Modal */}
      {isEditCustomerOpen && (
        <CustomerFormModal
          isOpen={isEditCustomerOpen}
          onClose={() => setIsEditCustomerOpen(false)}
          customer={customer}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* WhatsApp Modal */}
      {isWhatsAppOpen && (
        <WhatsAppModal
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          customerId={customer.id}
          customerName={customer.full_name}
          phone={customer.whatsapp_number}
          contextData={{
            packageName: esims?.length > 0 ? esims[0].package_name : undefined,
            expiryDate: esims?.length > 0 ? formatDate(esims[0].expiry_date) : undefined,
            iccid: esims?.length > 0 ? esims[0].iccid : undefined,
          }}
          onInteractionLogged={() => loadProfile()}
        />
      )}

      {/* Add / Edit eSIM Modal */}
      {(isAddEsimOpen || editingEsim) && (
        <EsimFormModal
          isOpen={isAddEsimOpen || Boolean(editingEsim)}
          onClose={() => {
            setIsAddEsimOpen(false);
            setEditingEsim(null);
          }}
          customerId={customer.id}
          customerName={customer.full_name}
          esim={editingEsim}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Renew eSIM Modal */}
      {renewingEsim && (
        <RenewEsimModal
          isOpen={Boolean(renewingEsim)}
          onClose={() => setRenewingEsim(null)}
          esim={renewingEsim}
          customerName={customer.full_name}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* QR Code Scannable Modal */}
      {qrModalEsim && (
        <QRCodeModal
          isOpen={Boolean(qrModalEsim)}
          onClose={() => setQrModalEsim(null)}
          qrData={qrModalEsim.qr_code_data}
          iccid={qrModalEsim.iccid}
          packageName={qrModalEsim.package_name}
          customerName={customer.full_name}
          onQrUpdated={() => loadProfile()}
        />
      )}

      {/* Record / Edit Transaction Modal */}
      {isAddTransactionOpen && (
        <TransactionFormModal
          isOpen={isAddTransactionOpen}
          onClose={() => {
            setIsAddTransactionOpen(false);
            setEditingTransaction(null);
          }}
          customerId={customer.id}
          customerName={customer.full_name}
          customerEsims={esims}
          transaction={editingTransaction}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Support Ticket Modal (Create / Edit) */}
      {isAddSupportOpen && (
        <SupportTicketModal
          isOpen={isAddSupportOpen}
          onClose={() => {
            setIsAddSupportOpen(false);
            setEditingSupport(null);
          }}
          customerId={customer.id}
          customerName={customer.full_name}
          customerEsims={esims}
          ticket={editingSupport}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Contact Interaction Modal */}
      {isAddInteractionOpen && (
        <InteractionModal
          isOpen={isAddInteractionOpen}
          onClose={() => setIsAddInteractionOpen(false)}
          customerId={customer.id}
          customerName={customer.full_name}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Task Modal (Create / Edit) */}
      {isAddTaskOpen && (
        <TaskFormModal
          isOpen={isAddTaskOpen}
          onClose={() => {
            setIsAddTaskOpen(false);
            setEditingTask(null);
          }}
          customerId={customer.id}
          customerName={customer.full_name}
          customerEsims={esims}
          task={editingTask}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Note Modal (Create / Edit) */}
      {isAddNoteOpen && (
        <NoteFormModal
          isOpen={isAddNoteOpen}
          onClose={() => {
            setIsAddNoteOpen(false);
            setEditingNote(null);
          }}
          customerId={customer.id}
          note={editingNote}
          onSuccess={() => loadProfile()}
        />
      )}

      {/* Generic Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title={`Confirm Delete`}
        message={`Are you sure you want to remove ${deleteConfirm?.name}?`}
        confirmText="Confirm Delete"
      />
    </div>
  );
};
