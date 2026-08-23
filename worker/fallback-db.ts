// Clean Fallback Store with Zero Dummy Data (Only Admin/Staff Accounts & Default Settings)
import { StaffUser, Customer, Esim, EsimPackage, EsimProvider, Transaction, SupportTicket, Task } from './types';

export function createFallbackD1(): D1Database {
  const users: StaffUser[] = [
    { id: 'STF-001', name: 'System Admin', email: 'Admin@callbite.com', role: 'ADMIN', phone: '+923000000001', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-08-23T00:00:00Z', last_login_at: '2026-08-23T08:00:00Z' },
    { id: 'STF-002', name: 'Naeem Hussain', email: 'Naeem@callbite.com', role: 'ADMIN', phone: '+923000000002', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-08-23T00:00:00Z', last_login_at: '2026-08-23T08:00:00Z' },
    { id: 'STF-003', name: 'Operations Admin', email: 'aaa@callbite.com', role: 'ADMIN', phone: '+923000000003', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-08-23T00:00:00Z', last_login_at: '2026-08-23T08:00:00Z' },
    { id: 'STF-004', name: 'Sara Khan', email: 'sara.khan@callbite.com', role: 'SUPPORT_STAFF', phone: '+923011112233', status: 'active', created_at: '2026-02-15T00:00:00Z', updated_at: '2026-08-23T00:00:00Z', last_login_at: '2026-08-23T07:10:00Z' },
    { id: 'STF-005', name: 'Ali Raza', email: 'ali.raza@callbite.com', role: 'SUPPORT_STAFF', phone: '+923022223344', status: 'active', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-08-23T00:00:00Z', last_login_at: '2026-08-23T05:40:00Z' },
  ];

  const userPasswords: Record<string, string> = {
    'admin@callbite.com': 'Touch@11223',
    'naeem@callbite.com': 'Touch@11223',
    'aaa@callbite.com': 'Touch@786',
    'sara.khan@callbite.com': 'Support@123',
    'ali.raza@callbite.com': 'Support@123',
  };

  const providers: EsimProvider[] = [];
  const packages: EsimPackage[] = [];
  const customers: Customer[] = [];
  const esims: Esim[] = [];
  const transactions: Transaction[] = [];
  const support_tickets: SupportTicket[] = [];
  const tasks: Task[] = [];

  return {
    prepare(query: string) {
      return {
        bind(...params: any[]) {
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const q = query.toLowerCase();
          if (q.includes('from users')) {
            const emailParam = params.find((p) => typeof p === 'string' && p.includes('@'));
            if (emailParam) {
              const u = users.find((x) => x.email.toLowerCase() === emailParam.toLowerCase());
              if (u) {
                return { ...u, password: userPasswords[u.email.toLowerCase()] || 'Touch@11223' } as T;
              }
            }
            return users[0] as T;
          }
          if (q.includes('from sessions')) {
            return { token: 'tok_STF-001_session', user_id: 'STF-001', ...users[0] } as T;
          }
          if (q.includes('count(*)')) {
            return { count: 0, total: 0, active: 0, expired: 0, today: 0, three_days: 0, seven_days: 0, open: 0, in_progress: 0, today_sales: 0, month_sales: 0, today_profit: 0, month_profit: 0, total_revenue: 0, total_profit: 0 } as T;
          }
          if (q.includes('from customers')) return (customers[0] as T) || null;
          if (q.includes('from esims')) return (esims[0] as T) || null;
          if (q.includes('from packages')) return (packages[0] as T) || null;
          if (q.includes('from esim_providers')) return (providers[0] as T) || null;
          return null;
        },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
          const q = query.toLowerCase();
          let res: any[] = [];
          if (q.includes('from users')) res = users;
          else if (q.includes('from customers')) res = customers;
          else if (q.includes('from esims')) res = esims;
          else if (q.includes('from packages')) res = packages;
          else if (q.includes('from esim_providers')) res = providers;
          else if (q.includes('from transactions')) res = transactions;
          else if (q.includes('from tags')) res = [
            { id: 1, name: 'VIP', color: '#8b5cf6' },
            { id: 2, name: 'Frequent Buyer', color: '#3b82f6' },
            { id: 3, name: 'Instagram', color: '#ec4899' },
            { id: 4, name: 'Facebook', color: '#2563eb' },
            { id: 5, name: 'TikTok', color: '#000000' },
            { id: 6, name: 'Referral', color: '#10b981' },
            { id: 7, name: 'Business', color: '#6366f1' },
            { id: 8, name: 'High Value', color: '#f59e0b' },
            { id: 9, name: 'Needs Follow-up', color: '#ef4444' },
            { id: 10, name: 'Returning Customer', color: '#06b6d4' },
          ];
          else if (q.includes('from settings')) res = [
            { key: 'company_name', value: 'Callbite Esim', description: '' },
            { key: 'currency_symbol', value: 'Rs.', description: '' },
            { key: 'currency_code', value: 'PKR', description: '' },
            { key: 'support_phone', value: '+923001234567', description: '' },
          ];
          return { results: res as T[], success: true, meta: { changes: 0, last_row_id: 0 } };
        },
        async run() {
          return { success: true, meta: { changes: 1, last_row_id: 1 } };
        },
        async raw() {
          return [];
        },
      } as unknown as D1PreparedStatement;
    },
    async batch(statements: any[]) {
      return statements.map(() => ({ success: true, meta: { changes: 0, last_row_id: 0 } }));
    },
    async exec(query: string) {
      return { count: 1, duration: 0 };
    },
    dump() {
      throw new Error('dump not supported');
    },
  } as unknown as D1Database;
}
