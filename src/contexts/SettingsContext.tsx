import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tag, PackagePreset, StaffUser, EsimProvider, EsimPackage } from '../types';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  settings: Record<string, string>;
  tags: Tag[];
  presets: PackagePreset[];
  packages: EsimPackage[];
  providers: EsimProvider[];
  staffList: StaffUser[];
  currencySymbol: string;
  companyName: string;
  refreshSettings: () => Promise<void>;
  formatPrice: (amount: number | string | undefined | null) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({
    company_name: 'Callbite Esim',
    currency_symbol: 'Rs.',
    currency_code: 'PKR',
    support_phone: '+923001234567',
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [presets, setPresets] = useState<PackagePreset[]>([]);
  const [packages, setPackages] = useState<EsimPackage[]>([]);
  const [providers, setProviders] = useState<EsimProvider[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  const refreshSettings = useCallback(async () => {
    try {
      const [settingsRes, staffRes, providersRes, packagesRes] = await Promise.all([
        api.get('/api/settings').catch(() => ({ success: false })),
        api.get('/api/staff').catch(() => ({ success: false })),
        api.get('/api/providers').catch(() => ({ success: false })),
        api.get('/api/packages').catch(() => ({ success: false })),
      ]);

      if (settingsRes && settingsRes.success) {
        if (settingsRes.settings) setSettings(settingsRes.settings);
        if (settingsRes.tags) setTags(settingsRes.tags);
        if (settingsRes.package_presets) setPresets(settingsRes.package_presets);
      }

      if (staffRes && staffRes.success && staffRes.staff) {
        setStaffList(staffRes.staff);
      }

      if (providersRes && providersRes.success && providersRes.providers) {
        setProviders(providersRes.providers);
      }

      if (packagesRes && packagesRes.success && packagesRes.packages) {
        setPackages(packagesRes.packages);
      }
    } catch (err) {
      console.error('Failed to load settings, staff, packages & providers:', err);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [user, refreshSettings]);

  const currencySymbol = settings.currency_symbol || 'Rs.';
  const companyName = settings.company_name || 'Callbite Esim';

  const formatPrice = (amount: number | string | undefined | null) => {
    const num = Number(amount || 0);
    return `${currencySymbol} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        tags,
        presets,
        packages,
        providers,
        staffList,
        currencySymbol,
        companyName,
        refreshSettings,
        formatPrice,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
