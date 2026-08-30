import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Customer, CustomerStatus, CustomerSource } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { Plus, CardSim as SimCard } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess: (customerId?: string) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const { tags: availableTags, staffList, currencySymbol } = useSettings();
  const presets: any[] = [];
  const contextPackages: any[] = [];
  const { user } = useAuth();
  const toast = useToast();

  const isEdit = Boolean(customer);

  const [catalogPackages, setCatalogPackages] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<CustomerSource>('Instagram');
  const [referredByCustomerId, setReferredByCustomerId] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('Active');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing customers for "Referred by" dropdown
  const [allCustomersList, setAllCustomersList] = useState<{ id: string; full_name: string; whatsapp_number: string }[]>([]);

  // Optional Initial eSIM section when creating new customer
  const [addInitialEsim, setAddInitialEsim] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [esimIccid, setEsimIccid] = useState('');
  const [esimCountry, setEsimCountry] = useState('Pakistan');
  const [esimProvider, setEsimProvider] = useState('Callbite Partner');
  const [esimPackage, setEsimPackage] = useState('Standard 10GB');
  const [esimData, setEsimData] = useState('10GB');
  const [esimDuration, setEsimDuration] = useState('30 Days');
  const [esimExpiry, setEsimExpiry] = useState('');
  const [esimPrice, setEsimPrice] = useState('4500');
  const [esimCost, setEsimCost] = useState('2800');
  const [esimPaymentMethod, setEsimPaymentMethod] = useState('Easypaisa');

  // Load customer list & package list for initial esim
  useEffect(() => {
    if (isOpen) {
      api.get('/api/customers', { limit: 100 }).then((res) => {
        if (res.success && res.customers) {
          setAllCustomersList(
            res.customers.map((c: any) => ({
              id: c.id,
              full_name: c.full_name,
              whatsapp_number: c.whatsapp_number,
            }))
          );
        }
      }).catch(() => {});


    }
  }, [isOpen]);

  const packagesList = catalogPackages.length > 0 ? catalogPackages : contextPackages;

  useEffect(() => {
    if (customer) {
      setFullName(customer.full_name || '');
      setWhatsapp(customer.whatsapp_number || '');
      setPhone(customer.phone_number || '');
      setEmail(customer.email || '');
      setCountry(customer.country || '');
      setCity(customer.city || '');
      setSource(customer.source || 'Instagram');
      setReferredByCustomerId(customer.referred_by_customer_id || '');
      setStatus(customer.status || 'Active');
      setAssignedStaffId(customer.assigned_staff_id || user?.id || '');
      setInternalNotes(customer.internal_notes || '');
      setSelectedTags(customer.tags || []);
      setAddInitialEsim(false);
    } else {
      setFullName('');
      setWhatsapp('');
      setPhone('');
      setEmail('');
      setCountry('');
      setCity('');
      setSource('Instagram');
      setReferredByCustomerId('');
      setStatus('Active');
      setAssignedStaffId(user?.id || '');
      setInternalNotes('');
      setSelectedTags(['Instagram']);
      setAddInitialEsim(false);

      // Default 30 days ahead expiry for new initial esim
      const defaultExp = new Date();
      defaultExp.setDate(defaultExp.getDate() + 30);
      setEsimExpiry(defaultExp.toISOString().slice(0, 10));
      setEsimIccid(`890141032111185${Math.floor(1000 + Math.random() * 9000)}F`);
    }
  }, [customer, user, isOpen]);

  // Handle Preset or Package selection for initial eSIM
  const handlePresetSelect = (presetIdStr: string) => {
    setSelectedPresetId(presetIdStr);
    const cleanId = presetIdStr.replace(/^pkg_/, '').replace(/^preset_/, '');
    const found =
      packagesList.find((p) => String(p.id) === cleanId || String(p.id) === presetIdStr) ||
      presets.find((p) => String(p.id) === cleanId || String(p.id) === presetIdStr);

    if (found) {
      setEsimCountry(found.country_region);
      setEsimProvider(found.provider || 'Callbite Partner');
      setEsimPackage(found.package_name);
      setEsimData(found.data_allowance);
      setEsimDuration(found.duration);
      const sell = (found as any).selling_price ?? (found as any).default_selling_price ?? 4500;
      const cost = (found as any).cost_price ?? (found as any).default_cost_price ?? 2800;
      setEsimPrice(sell.toString());
      setEsimCost(cost.toString());

      // Parse duration to calculate expiry
      const daysMatch = (found.duration || '30 Days').match(/(\d+)\s*Days?/i);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;
      const d = new Date();
      d.setDate(d.getDate() + days);
      setEsimExpiry(d.toISOString().slice(0, 10));
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Customer Full Name is required.');
      return;
    }
    if (!whatsapp.trim()) {
      toast.error('WhatsApp Number is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && customer) {
        await api.put(`/api/customers/${customer.id}`, {
          full_name: fullName.trim(),
          whatsapp_number: whatsapp.trim(),
          phone_number: phone.trim() || null,
          email: email.trim() || null,
          country: country.trim() || null,
          city: city.trim() || null,
          source,
          referred_by_customer_id: source === 'Referred by' ? referredByCustomerId || null : null,
          status,
          assigned_staff_id: assignedStaffId || null,
          internal_notes: internalNotes.trim() || null,
          tags: selectedTags,
        });

        toast.success('Customer updated successfully!');
        onSuccess(customer.id);
        onClose();
      } else {
        const payload: any = {
          full_name: fullName.trim(),
          whatsapp_number: whatsapp.trim(),
          phone_number: phone.trim() || null,
          email: email.trim() || null,
          country: country.trim() || null,
          city: city.trim() || null,
          source,
          referred_by_customer_id: source === 'Referred by' ? referredByCustomerId || null : null,
          status,
          assigned_staff_id: assignedStaffId || user?.id,
          internal_notes: internalNotes.trim() || null,
          tags: selectedTags,
        };

        if (addInitialEsim && esimIccid.trim()) {
          payload.initial_esim = {
            iccid: esimIccid.trim(),
            country_region: esimCountry,
            provider: esimProvider,
            package_name: esimPackage,
            data_allowance: esimData,
            duration: esimDuration,
            expiry_date: esimExpiry,
            selling_price: parseFloat(esimPrice) || 0,
            cost_price: parseFloat(esimCost) || 0,
            payment_method: esimPaymentMethod,
          };
        }

        const res = await api.post('/api/customers', payload);
        toast.success('Customer created successfully!');
        onSuccess(res.customer_id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Customer: ${customer?.full_name}` : 'Create New Customer'}
      subtitle={isEdit ? `Customer ID: ${customer?.id}` : 'Register a new customer to Callbite Esim'}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Core Customer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ahmed Khan"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              WhatsApp Number *
            </label>
            <input
              type="text"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. +923001234567"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Alternative Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +923219876543"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ahmed@gmail.com"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Pakistan / UAE / UK"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Lahore / Dubai"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Customer Acquisition Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as CustomerSource)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Website">Website</option>
              <option value="Referred by">Referred by (Existing Customer)</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {source === 'Referred by' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Select Referrer Customer
              </label>
              <select
                value={referredByCustomerId}
                onChange={(e) => setReferredByCustomerId(e.target.value)}
                className="w-full text-sm rounded-xl border border-emerald-300 px-3.5 py-2 text-slate-900 bg-emerald-50/50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Choose referrer customer --</option>
                {allCustomersList
                  .filter((c) => !customer || c.id !== customer.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.id} - {c.whatsapp_number})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Customer Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="VIP">VIP</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Assigned Staff
            </label>
            <select
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
            >
              <option value="">-- Select Staff --</option>
              {staffList.map((stf) => (
                <option key={stf.id} value={stf.id}>
                  {stf.name} ({stf.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Customer Tags
          </label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.name);
              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Internal Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Internal Staff Notes
          </label>
          <textarea
            rows={2}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Important customer notes, travel habits, special instructions..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Option to Add Initial eSIM on Creation */}
        {!isEdit && (
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAddInitialEsim(!addInitialEsim)}
              className="flex items-center gap-2 text-sm font-bold text-slate-800 hover:text-emerald-600 transition-colors"
            >
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  addInitialEsim ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {addInitialEsim && '✓'}
              </div>
              <SimCard className="w-4 h-4 text-emerald-600" />
              <span>Attach Initial eSIM Immediately</span>
            </button>

            {addInitialEsim && (
              <div className="mt-3 p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200 space-y-3 animate-modal">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-900 tracking-wider">
                    Quick Preset Selection
                  </span>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    className="text-xs rounded-lg border border-emerald-300 bg-white px-2 py-1 text-slate-800"
                  >
                    <option value="">-- Or choose a package preset --</option>
                    {packagesList && packagesList.length > 0
                      ? packagesList.map((p) => (
                          <option key={`pkg_${p.id}`} value={`pkg_${p.id}`}>
                            {p.country_region}: {p.package_name} ({p.data_allowance}) - {currencySymbol} {Number(p.selling_price || p.default_selling_price || 0).toLocaleString()}
                          </option>
                        ))
                      : presets.map((p) => (
                          <option key={`preset_${p.id}`} value={`preset_${p.id}`}>
                            {p.country_region}: {p.package_name} ({p.data_allowance}) - {currencySymbol} {Number(p.default_selling_price || 0).toLocaleString()}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      ICCID *
                    </label>
                    <input
                      type="text"
                      required={addInitialEsim}
                      value={esimIccid}
                      onChange={(e) => setEsimIccid(e.target.value)}
                      placeholder="890141032111185..."
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Package Name
                    </label>
                    <input
                      type="text"
                      value={esimPackage}
                      onChange={(e) => setEsimPackage(e.target.value)}
                      placeholder="e.g. Pakistan 10GB Standard"
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Data Allowance & Duration
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={esimData}
                        onChange={(e) => setEsimData(e.target.value)}
                        placeholder="10GB"
                        className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 bg-white"
                      />
                      <input
                        type="text"
                        value={esimDuration}
                        onChange={(e) => setEsimDuration(e.target.value)}
                        placeholder="30 Days"
                        className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={esimExpiry}
                      onChange={(e) => setEsimExpiry(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Selling Price ({currencySymbol}) & Method
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        step="1"
                        value={esimPrice}
                        onChange={(e) => setEsimPrice(e.target.value)}
                        className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 bg-white"
                      />
                      <select
                        value={esimPaymentMethod}
                        onChange={(e) => setEsimPaymentMethod(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 bg-white"
                      >
                        <option value="Easypaisa">Easypaisa</option>
                        <option value="JazzCash">JazzCash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
