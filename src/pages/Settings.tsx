import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Plus,
  Trash2,
  Edit2,
  Download,
  Sparkles,
  Tag,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';

export const Settings: React.FC = () => {
  const { settings, tags, refreshSettings } = useSettings();
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'templates' | 'tags' | 'backup'>('general');

  // Form states for general settings & templates
  const [companyName, setCompanyName] = useState('');
  const [currencySymbolInput, setCurrencySymbolInput] = useState('Rs.');
  const [currencyCode, setCurrencyCode] = useState('PKR');
  const [supportPhone, setSupportPhone] = useState('');
  const [waRenewal, setWaRenewal] = useState('');
  const [waExpiry, setWaExpiry] = useState('');
  const [waConfirmation, setWaConfirmation] = useState('');
  const [waSupport, setWaSupport] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Preset Modal
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<any | null>(null);
  const [presetRegion, setPresetRegion] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetData, setPresetData] = useState('10GB');
  const [presetDuration, setPresetDuration] = useState('30 Days');
  const [presetProvider, setPresetProvider] = useState('Partner');
  const [presetSellingPrice, setPresetSellingPrice] = useState('4500');
  const [presetCostPrice, setPresetCostPrice] = useState('2800');

  // Tag Modal
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagDesc, setTagDesc] = useState('');

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || 'Callbite Esim');
      setCurrencySymbolInput(settings.currency_symbol || 'Rs.');
      setCurrencyCode(settings.currency_code || 'PKR');
      setSupportPhone(settings.support_phone || '+923001234567');
      setWaRenewal(settings.wa_template_renewal || '');
      setWaExpiry(settings.wa_template_expiry || '');
      setWaConfirmation(settings.wa_template_confirmation || '');
      setWaSupport(settings.wa_template_support || '');
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.put('/api/settings', {
        company_name: companyName.trim(),
        currency_symbol: currencySymbolInput.trim(),
        currency_code: currencyCode.trim(),
        support_phone: supportPhone.trim(),
        wa_template_renewal: waRenewal.trim(),
        wa_template_expiry: waExpiry.trim(),
        wa_template_confirmation: waConfirmation.trim(),
        wa_template_support: waSupport.trim(),
      });
      await refreshSettings();
      toast.success('System settings saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error('Tag name is required.');
      return;
    }

    try {
      await api.post('/api/settings/tags', {
        id: editingTag?.id,
        name: tagName.trim(),
        color: tagColor,
        description: tagDesc.trim() || null,
      });

      toast.success('Tag saved!');
      setIsTagModalOpen(false);
      refreshSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save tag.');
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      await api.delete(`/api/settings/tags/${id}`);
      toast.success('Tag deleted.');
      refreshSettings();
    } catch (err: any) {
      toast.error('Failed to delete tag.');
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await api.get('/api/settings/export');
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `callbite-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        toast.success('Database backup JSON exported successfully!');
      }
    } catch (err: any) {
      toast.error('Export backup failed.');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Portal Configuration & Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Global system settings, default WhatsApp templates, eSIM package presets, and data export
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            leftIcon={<Save className="w-4 h-4" />}
            isLoading={isSaving}
            onClick={handleSaveSettings}
          >
            Save All Settings
          </Button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'general', label: 'General CRM' },
          { id: 'templates', label: 'WhatsApp Templates' },
          { id: 'tags', label: `Customer Tags (${tags.length})` },
          { id: 'backup', label: 'Database Backup & Export' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: GENERAL CRM */}
      {activeSubTab === 'general' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-5 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Branding & Financial Preferences
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Portal Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Official Support Phone (WhatsApp)
              </label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+923001234567"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Currency Symbol
              </label>
              <input
                type="text"
                value={currencySymbolInput}
                onChange={(e) => setCurrencySymbolInput(e.target.value)}
                placeholder="Rs. / PKR / $"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Currency Code
              </label>
              <input
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                placeholder="PKR / USD / AED"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: WHATSAPP TEMPLATES */}
      {activeSubTab === 'templates' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-6 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Predefined WhatsApp Messages</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Available variables: <span className="font-mono font-bold text-emerald-700">{`{customer_name}`}</span>, <span className="font-mono font-bold text-emerald-700">{`{package_name}`}</span>, <span className="font-mono font-bold text-emerald-700">{`{expiry_date}`}</span>, <span className="font-mono font-bold text-emerald-700">{`{iccid}`}</span>, <span className="font-mono font-bold text-emerald-700">{`{ticket_id}`}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                1. Renewal Reminder Template
              </label>
              <textarea
                rows={3}
                value={waRenewal}
                onChange={(e) => setWaRenewal(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                2. Expiry Notification Template
              </label>
              <textarea
                rows={3}
                value={waExpiry}
                onChange={(e) => setWaExpiry(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                3. Renewal Confirmation Template
              </label>
              <textarea
                rows={3}
                value={waConfirmation}
                onChange={(e) => setWaConfirmation(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                4. Support Response Template
              </label>
              <textarea
                rows={3}
                value={waSupport}
                onChange={(e) => setWaSupport(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: CUSTOMER TAGS */}
      {activeSubTab === 'tags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Customer Tags ({tags.length})
            </h3>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingTag(null);
                  setTagName('');
                  setTagColor('#3b82f6');
                  setTagDesc('');
                  setIsTagModalOpen(true);
                }}
              >
                Create Tag
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {tags.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-card flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.color || '#3b82f6' }}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{t.name}</span>
                    {t.description && <span className="text-[10px] text-slate-400 block">{t.description}</span>}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleDeleteTag(t.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 5: DATABASE BACKUP */}
      {activeSubTab === 'backup' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900">Export Full System Database Backup</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Download a JSON snapshot of customers, eSIM records, interactions, notes, and timeline.
          </p>

          <Button
            variant="primary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportBackup}
          >
            Download Database Backup (JSON)
          </Button>
        </div>
      )}

      {/* Tag Modal */}
      {isTagModalOpen && (
        <Modal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          title="Create / Edit Tag"
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsTagModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveTag}>
                Save Tag
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveTag} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tag Name *</label>
              <input
                type="text"
                required
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. High Value Traveler"
                className="w-full text-sm rounded-xl border border-slate-300 px-3 py-1.5"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tag Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-300 p-1 cursor-pointer"
                />
                <input
                  type="text"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Description</label>
              <input
                type="text"
                value={tagDesc}
                onChange={(e) => setTagDesc(e.target.value)}
                placeholder="Short description..."
                className="w-full text-sm rounded-xl border border-slate-300 px-3 py-1.5"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
