-- Clean Production Baseline for Callbite Customer Management Portal (Callbite Esim)
-- ONLY Staff Accounts, Default Settings & Default Tags (Zero Dummy Data)

-- 1. Staff Users
INSERT OR REPLACE INTO users (id, name, email, password, role, phone, status, avatar_url, created_at, updated_at, last_login_at) VALUES
('STF-001', 'System Admin', 'Admin@callbite.com', 'Touch@11223', 'ADMIN', '+923000000001', 'active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-002', 'Naeem Hussain', 'Naeem@callbite.com', 'Touch@11223', 'ADMIN', '+923000000002', 'active', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-003', 'Operations Admin', 'aaa@callbite.com', 'Touch@786', 'ADMIN', '+923000000003', 'active', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '2026-01-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T08:00:00Z'),
('STF-004', 'Sara Khan', 'sara.khan@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923011112233', 'active', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', '2026-02-15T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T07:10:00Z'),
('STF-005', 'Ali Raza', 'ali.raza@callbite.com', 'Support@123', 'SUPPORT_STAFF', '+923022223344', 'active', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', '2026-03-01T00:00:00Z', '2026-08-23T00:00:00Z', '2026-08-23T05:40:00Z');

-- 2. Default Settings (PKR Currency)
INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES
('company_name', 'Callbite Esim', 'Portal branding name', '2026-08-23T00:00:00Z'),
('currency_symbol', 'Rs.', 'Default display currency symbol (PKR)', '2026-08-23T00:00:00Z'),
('currency_code', 'PKR', 'Default currency code', '2026-08-23T00:00:00Z'),
('support_phone', '+923001234567', 'Official WhatsApp support contact', '2026-08-23T00:00:00Z'),
('wa_template_renewal', 'Hello {customer_name}! Your {package_name} eSIM ({iccid}) is expiring on {expiry_date}. Would you like to renew it today for {selling_price} to stay connected seamlessly? Reply to confirm!', 'Template for renewal prompt', '2026-08-23T00:00:00Z'),
('wa_template_expiry', 'Hi {customer_name}, friendly reminder from Callbite Esim that your eSIM plan will expire on {expiry_date}. Please contact us if you need more data or extension.', 'Template for expiry alert', '2026-08-23T00:00:00Z'),
('wa_template_confirmation', 'Thank you {customer_name}! Your eSIM renewal for {package_name} has been processed successfully. Your new expiry date is {expiry_date}. Safe travels!', 'Template for renewal success', '2026-08-23T00:00:00Z'),
('wa_template_support', 'Hi {customer_name}, thank you for reaching out to Callbite Esim support regarding ticket #{ticket_id}. Our team is actively on it and will update you shortly.', 'Template for support response', '2026-08-23T00:00:00Z');

-- 3. Default Tags
INSERT OR REPLACE INTO tags (id, name, color, description) VALUES
(1, 'VIP', '#8b5cf6', 'High volume and priority customer'),
(2, 'Frequent Buyer', '#3b82f6', 'Regular recurring purchases'),
(3, 'Instagram', '#ec4899', 'Acquired via Instagram Direct/Ads'),
(4, 'Facebook', '#2563eb', 'Acquired via Facebook campaign'),
(5, 'TikTok', '#000000', 'Acquired via TikTok viral/leads'),
(6, 'Referral', '#10b981', 'Referred by existing happy customer'),
(7, 'Business', '#6366f1', 'Corporate or frequent business traveler'),
(8, 'High Value', '#f59e0b', 'High cumulative lifetime value'),
(9, 'Needs Follow-up', '#ef4444', 'Requires staff attention or check-in'),
(10, 'Returning Customer', '#06b6d4', 'Has renewed or bought secondary eSIM');
