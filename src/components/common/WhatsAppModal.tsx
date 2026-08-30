import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { MessageSquare, ExternalLink, Copy, Check, Send } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { cleanPhoneForWhatsApp } from '../../utils/formatters';
import { api } from '../../utils/api';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  phone: string;
  defaultTemplate?: 'renewal' | 'expiry' | 'confirmation' | 'support' | 'custom';
  contextData?: {
    packageName?: string;
    expiryDate?: string;
    iccid?: string;
    ticketId?: string;
  };
  onInteractionLogged?: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  phone,
  defaultTemplate = 'renewal',
  contextData = {},
  onInteractionLogged,
}) => {
  const { settings } = useSettings();
  const toast = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultTemplate);
  const [customText, setCustomText] = useState<string>('');
  const [autoLogInteraction, setAutoLogInteraction] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const cleanPhone = cleanPhoneForWhatsApp(phone);

  const getTemplateText = (templateKey: string) => {
    let raw = '';
    if (templateKey === 'renewal') {
      raw = settings.wa_template_renewal || 'Hello {customer_name}! Your {package_name} eSIM ({iccid}) is expiring on {expiry_date}. Would you like to renew it today to stay connected seamlessly?';
    } else if (templateKey === 'expiry') {
      raw = settings.wa_template_expiry || 'Hi {customer_name}, friendly reminder from Pak-tel.com that your eSIM plan will expire on {expiry_date}.';
    } else if (templateKey === 'confirmation') {
      raw = settings.wa_template_confirmation || 'Thank you {customer_name}! Your eSIM renewal for {package_name} has been processed successfully. Your new expiry date is {expiry_date}.';
    } else if (templateKey === 'support') {
      raw = settings.wa_template_support || 'Hi {customer_name}, thank you for contacting Pak-tel.com support regarding ticket #{ticket_id}. We are working on your request.';
    } else {
      return customText;
    }

    return raw
      .replace(/{customer_name}/g, customerName || 'Customer')
      .replace(/{package_name}/g, contextData.packageName || 'eSIM Package')
      .replace(/{expiry_date}/g, contextData.expiryDate || 'soon')
      .replace(/{iccid}/g, contextData.iccid || '')
      .replace(/{ticket_id}/g, contextData.ticketId || '');
  };

  const currentMessage = selectedTemplate === 'custom' ? customText : getTemplateText(selectedTemplate);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    toast.success('Message text copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = async () => {
    if (!cleanPhone) {
      toast.error('Invalid or missing WhatsApp phone number.');
      return;
    }

    setIsSending(true);

    try {
      if (autoLogInteraction && customerId) {
        await api.post('/api/interactions', {
          customer_id: customerId,
          contact_type: 'WhatsApp',
          purpose:
            selectedTemplate === 'renewal'
              ? 'Renewal Reminder'
              : selectedTemplate === 'expiry'
              ? 'Expiry Notification'
              : selectedTemplate === 'confirmation'
              ? 'Renewal Confirmation'
              : selectedTemplate === 'support'
              ? 'Support Follow-up'
              : 'Direct WhatsApp Contact',
          notes: currentMessage,
          outcome: 'Message sent via WhatsApp Web',
          interaction_date: new Date().toISOString(),
        });

        if (onInteractionLogged) {
          onInteractionLogged();
        }
      }

      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(currentMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toast.success('Opening WhatsApp and logged interaction!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record interaction, but you can still open WhatsApp.');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(currentMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Contact Customer on WhatsApp"
      subtitle={`Recipient: ${customerName} (${phone})`}
      maxWidth="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopyMessage}
          >
            {copied ? 'Copied' : 'Copy Text'}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="whatsapp"
              size="sm"
              isLoading={isSending}
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={handleOpenWhatsApp}
            >
              Open WhatsApp
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Template Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Select Message Template
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'renewal', label: 'Renewal Reminder' },
              { id: 'expiry', label: 'Expiry Notice' },
              { id: 'confirmation', label: 'Renewal Success' },
              { id: 'support', label: 'Support Reply' },
              { id: 'custom', label: 'Custom Message' },
            ].map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedTemplate(tmpl.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                  selectedTemplate === tmpl.id
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Editor / Preview */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Message Preview & Edit
          </label>
          {selectedTemplate === 'custom' ? (
            <textarea
              rows={5}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              className="w-full text-sm rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 text-sm text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
              {currentMessage}
            </div>
          )}
        </div>

        {/* Auto Log Checkbox */}
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 select-none cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={autoLogInteraction}
            onChange={(e) => setAutoLogInteraction(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>Automatically record this interaction in customer contact history and timeline</span>
        </label>
      </div>
    </Modal>
  );
};
