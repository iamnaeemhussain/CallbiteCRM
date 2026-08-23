import React from 'react';
import { TimelineEntry } from '../../types';
import { formatDate } from '../../utils/formatters';
import {
  UserPlus,
  RefreshCw,
  DollarSign,
  HelpCircle,
  CheckCircle2,
  MessageSquare,
  FileText,
  Calendar,
  CheckSquare,
  CardSim as SimCard,
  Edit3,
  Trash2,
  Clock,
} from 'lucide-react';

interface CustomerTimelineProps {
  entries: TimelineEntry[];
}

export const CustomerTimeline: React.FC<CustomerTimelineProps> = ({ entries }) => {
  if (!entries || entries.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        No activity recorded yet for this customer.
      </div>
    );
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'CUSTOMER_CREATED':
        return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case 'ESIM_ADDED':
        return <SimCard className="w-4 h-4 text-blue-600" />;
      case 'ESIM_RENEWED':
        return <RefreshCw className="w-4 h-4 text-emerald-600" />;
      case 'ESIM_UPDATED':
      case 'ESIM_CANCELLED':
        return <Edit3 className="w-4 h-4 text-amber-600" />;
      case 'TRANSACTION_RECORDED':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'SUPPORT_CREATED':
        return <HelpCircle className="w-4 h-4 text-rose-600" />;
      case 'SUPPORT_RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'INTERACTION_LOGGED':
        return <MessageSquare className="w-4 h-4 text-sky-600" />;
      case 'TASK_CREATED':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'TASK_COMPLETED':
        return <CheckSquare className="w-4 h-4 text-emerald-600" />;
      case 'NOTE_ADDED':
        return <FileText className="w-4 h-4 text-slate-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'CUSTOMER_CREATED':
      case 'ESIM_RENEWED':
      case 'TRANSACTION_RECORDED':
      case 'SUPPORT_RESOLVED':
      case 'TASK_COMPLETED':
        return 'bg-emerald-100/70 ring-4 ring-white';
      case 'ESIM_ADDED':
        return 'bg-blue-100/70 ring-4 ring-white';
      case 'SUPPORT_CREATED':
        return 'bg-rose-100/70 ring-4 ring-white';
      case 'INTERACTION_LOGGED':
        return 'bg-sky-100/70 ring-4 ring-white';
      case 'TASK_CREATED':
        return 'bg-purple-100/70 ring-4 ring-white';
      default:
        return 'bg-slate-100 ring-4 ring-white';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {entries.map((entry) => {
        let metadata: any = null;
        if (entry.metadata_json) {
          try {
            metadata = JSON.parse(entry.metadata_json);
          } catch {}
        }

        return (
          <div key={entry.id} className="relative group">
            {/* Dot / Icon */}
            <div
              className={`absolute -left-6 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ${getIconBg(
                entry.action_type
              )}`}
            >
              {getActionIcon(entry.action_type)}
            </div>

            {/* Content Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle group-hover:border-slate-300 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-slate-900">{entry.title}</span>
                <span className="text-[11px] font-medium text-slate-400">
                  {formatDate(entry.created_at, true)}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{entry.description}</p>

              {entry.staff_name && (
                <div className="mt-2 text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <span>Logged by:</span>
                  <span className="text-slate-700 font-semibold">{entry.staff_name}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
