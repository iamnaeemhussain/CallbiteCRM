import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Esim, EsimStatus, EsimPackage, EsimProvider } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { QrCode, Sparkles, Radio, Package, Upload, Link, Image as ImageIcon, Check, RefreshCw, Tag, Loader2 } from 'lucide-react';

interface EsimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  esim?: Esim | null;
  onSuccess: (esimId?: string) => void;
}

const DEFAULT_ESIM_TAGS = [
  'Primary SIM',
  'Data Roaming',
  'Traveler Line',
  'Umrah Special',
  'Corporate Line',
  '5G Max Roam',
  'Backup Line',
  'Local Line',
];

export const EsimFormModal: React.FC<EsimFormModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  esim,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const toast = useToast();

  const isEdit = Boolean(esim);

  // Live packages and providers fetched directly from database
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [iccid, setIccid] = useState('');
  const [countryRegion, setCountryRegion] = useState('Pakistan');
  const [provider, setProvider] = useState('Pak-tel.com');
  const [providerId, setProviderId] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [dataAllowance, setDataAllowance] = useState('10GB');
  const [duration, setDuration] = useState('30 Days');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState<EsimStatus>('Active');
  const [qrCodeData, setQrCodeData] = useState('');
  const [qrInputMode, setQrInputMode] = useState<'lpa' | 'link' | 'upload'>('lpa');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [apnInfo, setApnInfo] = useState('APN: internet');
  const [esimTag, setEsimTag] = useState('Primary SIM');
  const [customTagInput, setCustomTagInput] = useState('');
  const [notes, setNotes] = useState('');

  // Transaction fields for new eSIM (in PKR)
  const [recordTransaction, setRecordTransaction] = useState(true);
  const [sellingPrice, setSellingPrice] = useState('4500');
  const [costPrice, setCostPrice] = useState('2800');
  const [paymentMethod, setPaymentMethod] = useState('Easypaisa');

  const [holderName, setHolderName] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Combined packages list: prioritize freshly fetched catalog packages
  useEffect(() => {
    if (esim) {
      setSelectedCustomerId(esim.customer_id);
      setIccid(esim.iccid || '');
      setCountryRegion(esim.country_region || 'Pakistan');
      setProvider(esim.provider || 'Pak-tel.com');
      setProviderId(esim.provider_id || '');
      setPackageName(esim.package_name || '');
      setPackageId(esim.package_id || '');
      setSelectedPackageId(esim.package_id || '');
      setDataAllowance(esim.data_allowance || '10GB');
      setDuration(esim.duration || '30 Days');
      setStartDate(esim.start_date || '');
      setExpiryDate(esim.expiry_date || '');
      setStatus(esim.status || 'Active');
      setEsimTag(esim.tag || 'Primary SIM');
      
      const existingQr = esim.qr_code_data || '';
      setQrCodeData(existingQr);
      if (existingQr.startsWith('http://') || existingQr.startsWith('https://')) {
        setQrInputMode('link');
        setQrImageUrl(existingQr);
      } else if (existingQr.startsWith('data:image/')) {
        setQrInputMode('upload');
      } else {
        setQrInputMode('lpa');
      }

      setApnInfo(esim.apn_info || 'APN: internet');
      setNotes(esim.notes || '');
      setRecordTransaction(false);
    } else {
      const targetCustId = customerId || '';
      setSelectedCustomerId(targetCustId);
      const generatedIccid = `890141032111185${Math.floor(1000 + Math.random() * 9000)}F`;
      setIccid(generatedIccid);
      setCountryRegion('Pakistan');
      setProvider('Pak-tel.com');
      setProviderId('');
      setPackageName('');
      setPackageId('');
      setSelectedPackageId('');
      setDataAllowance('10GB');
      setDuration('30 Days');

      const now = new Date();
      setStartDate(now.toISOString().slice(0, 10));

      const exp = new Date();
      exp.setDate(exp.getDate() + 30);
      const expStr = exp.toISOString().slice(0, 10);
      setExpiryDate(expStr);

      setStatus('Active');
      setQrCodeData(`LPA:1$smdp.io$PAKTEL-${generatedIccid}`);
      setQrInputMode('lpa');
      setQrImageUrl('');
      setApnInfo('APN: internet');
      setEsimTag('Primary SIM');
      setNotes('');
      setRecordTransaction(true);
      setSellingPrice('4500');
      setCostPrice('2800');
      setPaymentMethod('Easypaisa');
    }
  }, [esim, customerId, isOpen]);

  const handleProviderSelect = (selectedName: string) => {
    setProvider(selectedName);
    setProviderId('');
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setQrCodeData(result);
      toast.success('QR Code image file loaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLink = () => {
    if (!qrImageUrl.trim()) {
      toast.error('Please enter a valid QR code image link.');
      return;
    }
    setQrCodeData(qrImageUrl.trim());
    toast.success('QR Code image URL linked!');
  };

  const calculateProfit = () => {
    const s = parseFloat(sellingPrice) || 0;
    const c = parseFloat(costPrice) || 0;
    return s - c;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!iccid.trim()) {
      toast.error('ICCID number is required.');
      return;
    }

    if (!packageName.trim() || !expiryDate) {
      toast.error('Package Name and Expiry Date are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && esim) {
        await api.put(`/api/esims/${esim.id}`, {
          iccid: iccid.trim(),
          country_region: countryRegion.trim(),
          provider: provider.trim(),
          provider_id: providerId || null,
          package_name: packageName.trim(),
          package_id: packageId || null,
          data_allowance: dataAllowance.trim(),
          duration: duration.trim(),
          start_date: startDate || null,
          expiry_date: expiryDate,
          status,
          qr_code_data: qrCodeData.trim() || null,
          apn_info: apnInfo.trim() || null,
          tag: esimTag.trim() || null,
          notes: notes.trim() || null,
        });

        toast.success('eSIM entry updated successfully!');
        onSuccess(esim.id);
        onClose();
      } else {
        const res = await api.post('/api/esims', {
          holder_name: holderName.trim() || undefined,
          holder_phone: holderPhone.trim() || undefined,
          iccid: iccid.trim(),
          country_region: countryRegion.trim(),
          provider: provider.trim(),
          provider_id: providerId || null,
          package_name: packageName.trim(),
          package_id: packageId || null,
          data_allowance: dataAllowance.trim(),
          duration: duration.trim(),
          start_date: startDate || null,
          expiry_date: expiryDate,
          status,
          qr_code_data: qrCodeData.trim() || null,
          apn_info: apnInfo.trim() || null,
          tag: esimTag.trim() || null,
          notes: notes.trim() || null,
          record_transaction: recordTransaction,
          selling_price: parseFloat(sellingPrice) || 0,
          cost_price: parseFloat(costPrice) || 0,
          payment_method: paymentMethod,
        });

        toast.success('eSIM added successfully!');
        onSuccess(res.esim_id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save eSIM.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isImageQr = qrCodeData.startsWith('data:image/') || qrCodeData.startsWith('http://') || qrCodeData.startsWith('https://');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit eSIM Profile (${esim?.iccid})` : 'Add New eSIM Profile'}
      subtitle={customerName ? `Customer: ${customerName}` : 'Manage package, carrier provider, dates, APN, tag & QR image'}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes & Update eSIM' : 'Add eSIM'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Holder name</label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Name for this ICCID"
                className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">WhatsApp number</label>
              <input
                type="text"
                value={holderPhone}
                onChange={(e) => setHolderPhone(e.target.value)}
                placeholder="+92..."
                className="w-full text-sm font-mono rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              ICCID Number *
            </label>
            <input
              type="text"
              required
              value={iccid}
              onChange={(e) => setIccid(e.target.value)}
              placeholder="e.g. 8901410321111851071F"
              className="w-full text-sm font-mono rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Country / Destination *
            </label>
            <input
              type="text"
              required
              value={countryRegion}
              onChange={(e) => setCountryRegion(e.target.value)}
              placeholder="e.g. Pakistan / UAE / Turkey / Europe"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Package Name *
            </label>
            <input
              type="text"
              required
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. Pakistan 20GB Standard"
              className="w-full text-sm font-bold rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Data Allowance * (Auto-filled from Package)
            </label>
            <input
              type="text"
              required
              value={dataAllowance}
              onChange={(e) => setDataAllowance(e.target.value)}
              placeholder="e.g. 10GB, 20GB, Unlimited"
              className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Duration * (Auto-filled from Package)
            </label>
            <input
              type="text"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 30 Days, 15 Days, 7 Days"
              className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              eSIM Provider / Carrier *
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderSelect(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white font-medium"
            >
              <option value="Pak-tel.com">Pak-tel.com</option>

              <option value="Direct Carrier / Partner">Direct Carrier / Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              eSIM Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EsimStatus)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white font-semibold"
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Expiry Date *
            </label>
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full text-sm font-semibold rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* APN SETTINGS */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              APN Settings
            </label>
            <input
              type="text"
              value={apnInfo}
              onChange={(e) => setApnInfo(e.target.value)}
              placeholder="e.g. APN: internet"
              className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* ESIM SPECIFIC TAG (LOCATED DIRECTLY BELOW APN) */}
          <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                eSIM Specific Tag (Visible below APN on profile & inventory)
              </label>
              {esimTag && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-emerald-400">
                  {esimTag}
                </span>
              )}
            </div>

            {/* Quick Tag Chips */}
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ESIM_TAGS.map((t) => {
                const isSelected = esimTag === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEsimTag(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="pt-1 flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                placeholder="Or type a custom eSIM tag (e.g. VIP Dual SIM)..."
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white text-slate-900"
              />
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => {
                  if (customTagInput.trim()) {
                    setEsimTag(customTagInput.trim());
                    setCustomTagInput('');
                  }
                }}
              >
                Set Tag
              </Button>
            </div>
          </div>
        </div>

        {/* QR CODE / IMAGE ATTACHMENT SECTION (MULTI-MODE: LPA, LINK, UPLOAD) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-600" />
              eSIM QR Code / Activation Image
            </span>

            {/* Mode Picker */}
            <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQrInputMode('lpa')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  qrInputMode === 'lpa' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                LPA String
              </button>
              <button
                type="button"
                onClick={() => setQrInputMode('link')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  qrInputMode === 'link' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Link className="w-3 h-3" /> Image Link
              </button>
              <button
                type="button"
                onClick={() => setQrInputMode('upload')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  qrInputMode === 'upload' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3 h-3" /> Upload File
              </button>
            </div>
          </div>

          {/* Mode 1: LPA String */}
          {qrInputMode === 'lpa' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                LPA Activation Code (Auto-generates scannable QR canvas)
              </label>
              <input
                type="text"
                value={qrCodeData}
                onChange={(e) => setQrCodeData(e.target.value)}
                placeholder="LPA:1$smdp.io$PAKTEL-..."
                className="w-full text-xs font-mono rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
              />
            </div>
          )}

          {/* Mode 2: Image Link */}
          {qrInputMode === 'link' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">
                Fetch QR Code from Image URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={qrImageUrl}
                  onChange={(e) => setQrImageUrl(e.target.value)}
                  placeholder="https://provider.com/qrcodes/qr-12345.png"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 bg-white"
                />
                <Button type="button" size="sm" variant="secondary" onClick={handleApplyLink}>
                  Fetch / Set
                </Button>
              </div>
            </div>
          )}

          {/* Mode 3: Image File Upload */}
          {qrInputMode === 'upload' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">
                Upload QR Code Image (PNG / JPG)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-white flex flex-col items-center justify-center gap-1.5 transition-colors group cursor-pointer"
              >
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                  Click to Browse & Upload QR Image
                </span>
                <span className="text-[10px] text-slate-400">Supports PNG, JPG, WEBP formats</span>
              </button>
            </div>
          )}

          {/* Live Preview if an image is attached */}
          {isImageQr && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={qrCodeData}
                  alt="QR Code Preview"
                  className="w-12 h-12 object-contain rounded-lg border border-slate-200"
                  onError={(e) => {
                    (e.target as any).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z"/></svg>';
                  }}
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">QR Code Image Attached</span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs block">
                    {qrCodeData.slice(0, 45)}...
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setQrCodeData(`LPA:1$smdp.io$PAKTEL-${iccid}`);
                  setQrInputMode('lpa');
                  setQrImageUrl('');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            eSIM Specific Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special instructions, SIM slot, device model..."
            className="w-full text-sm rounded-xl border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>


      </form>
    </Modal>
  );
};
