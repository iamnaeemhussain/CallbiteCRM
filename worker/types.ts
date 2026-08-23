export interface Env {
  DB: D1Database;
  APP_NAME?: string;
  ASSETS?: Fetcher;
}

export type StaffRole = 'ADMIN' | 'SUPPORT_STAFF';
export type StaffStatus = 'active' | 'inactive';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: StaffRole;
  phone?: string | null;
  status: StaffStatus;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export type CustomerStatus = 'Active' | 'Inactive' | 'VIP' | 'Blocked';
export type CustomerSource = 'Instagram' | 'Facebook' | 'TikTok' | 'WhatsApp' | 'Website' | 'Referred by' | 'Walk-in' | 'Other';

export interface Customer {
  id: string;
  full_name: string;
  whatsapp_number: string;
  phone_number?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  source: CustomerSource;
  referred_by_customer_id?: string | null;
  referred_by_name?: string | null;
  status: CustomerStatus;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  internal_notes?: string | null;
  is_deleted?: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  tags?: string[];
  esim_count?: number;
  active_esim_count?: number;
  latest_esim_status?: string | null;
  next_expiry_date?: string | null;
}

export type EsimStatus = 'Pending' | 'Active' | 'Expired' | 'Suspended' | 'Cancelled';

export interface Esim {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  iccid: string;
  country_region: string;
  provider: string;
  package_name: string;
  data_allowance: string;
  duration: string;
  start_date?: string | null;
  expiry_date: string;
  renewal_date?: string | null;
  activation_date?: string | null;
  status: EsimStatus;
  qr_code_data?: string | null;
  apn_info?: string | null;
  notes?: string | null;
  created_by_staff_id?: string | null;
  created_by_staff_name?: string | null;
  is_deleted?: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'New eSIM' | 'Renewal' | 'Package Upgrade' | 'Package Change' | 'Refund' | 'Adjustment';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Easypaisa' | 'JazzCash' | 'Card' | 'Other';
export type PaymentStatus = 'Paid' | 'Pending' | 'Partially Paid' | 'Refunded' | 'Cancelled';

export interface Transaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  esim_id?: string | null;
  esim_iccid?: string | null;
  transaction_type: TransactionType;
  package_name?: string | null;
  data_allowance?: string | null;
  duration?: string | null;
  date: string;
  selling_price: number;
  cost_price: number;
  profit: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  staff_id?: string | null;
  staff_name?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type IssueType = 'Renewal' | 'eSIM Not Working' | 'Installation' | 'Data Issue' | 'Package Inquiry' | 'Activation Issue' | 'Refund' | 'Other';
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Waiting for Customer' | 'Resolved' | 'Closed';

export interface SupportTicket {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  esim_id?: string | null;
  esim_iccid?: string | null;
  issue_type: IssueType;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  description: string;
  resolution?: string | null;
  internal_notes?: string | null;
  resolved_date?: string | null;
  created_by_staff_id?: string | null;
  created_by_staff_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactType = 'WhatsApp' | 'Phone Call' | 'SMS' | 'Other';

export interface Interaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  staff_id: string;
  staff_name?: string;
  contact_type: ContactType;
  purpose?: string | null;
  notes: string;
  outcome?: string | null;
  interaction_date: string;
  created_at: string;
}

export type TaskType = 'Renewal Follow-up' | 'Customer Follow-up' | 'Payment Follow-up' | 'Support Follow-up' | 'Other';
export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

export interface Task {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  esim_id?: string | null;
  task_type: TaskType;
  due_date: string;
  due_time?: string | null;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  notes: string;
  completed_at?: string | null;
  created_by_staff_id?: string | null;
  created_by_staff_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: number;
  customer_id: string;
  staff_id: string;
  staff_name?: string;
  title?: string | null;
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  id: number;
  customer_id: string;
  staff_id?: string | null;
  staff_name?: string | null;
  action_type: string;
  title: string;
  description: string;
  metadata_json?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  staff_id: string;
  staff_name: string;
  action: string;
  record_type: string;
  record_id: string;
  previous_value_json?: string | null;
  new_value_json?: string | null;
  change_summary?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface PackagePreset {
  id: number;
  country_region: string;
  package_name: string;
  data_allowance: string;
  duration: string;
  provider: string;
  default_selling_price: number;
  default_cost_price: number;
  is_active: number;
}
