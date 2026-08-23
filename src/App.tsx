import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Layout } from './components/layout/Layout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { CustomerProfile } from './pages/CustomerProfile';
import { Esims } from './pages/Esims';
import { Packages } from './pages/Packages';
import { Providers } from './pages/Providers';
import { Renewals } from './pages/Renewals';
import { Support } from './pages/Support';
import { Transactions } from './pages/Transactions';
import { Tasks } from './pages/Tasks';
import { Referrals } from './pages/Referrals';
import { Staff } from './pages/Staff';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullPage label="Authenticating staff session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullPage label="Verifying admin role..." />;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SettingsProvider>
            <Routes>
              {/* Public Staff Login */}
              <Route path="/login" element={<Login />} />

              {/* Protected Staff CRM Portal */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customers/:id" element={<CustomerProfile />} />
                <Route path="esims" element={<Esims />} />
                <Route path="packages" element={<Packages />} />
                <Route path="providers" element={<Providers />} />
                <Route path="renewals" element={<Renewals />} />
                <Route path="referrals" element={<Referrals />} />
                <Route path="support" element={<Support />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="staff" element={<Staff />} />
                <Route
                  path="audit-logs"
                  element={
                    <AdminRoute>
                      <AuditLogs />
                    </AdminRoute>
                  }
                />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
