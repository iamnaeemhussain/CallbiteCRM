import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { Button } from './Button';
import { Copy, Check, Download, QrCode, Upload, Link as LinkIcon, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  qrData?: string | null;
  iccid?: string;
  esimId?: string;
  packageName?: string;
  customerName?: string;
  onQrUpdated?: (newQrData: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title = 'eSIM QR Code & Activation',
  qrData,
  iccid,
  esimId,
  packageName,
  customerName,
  onQrUpdated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentQr, setCurrentQr] = useState<string>('');
  const [copiedLpa, setCopiedLpa] = useState(false);
  const [copiedIccid, setCopiedIccid] = useState(false);
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);
  const [newMode, setNewMode] = useState<'lpa' | 'link' | 'upload'>('link');
  const [inputUrl, setInputUrl] = useState('');
  const [inputLpa, setInputLpa] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      const activeData = qrData || (iccid ? `LPA:1$smdp.io$CALLBITE-${iccid}` : 'LPA:1$smdp.io$CALLBITE-DEFAULT');
      setCurrentQr(activeData);
      setShowUpdatePanel(false);
      setInputUrl('');
      setInputLpa(activeData);
    }
  }, [isOpen, qrData, iccid]);

  const isImageQr = currentQr.startsWith('data:image/') || currentQr.startsWith('http://') || currentQr.startsWith('https://');

  useEffect(() => {
    if (isOpen && !isImageQr && canvasRef.current && currentQr) {
      QRCode.toCanvas(
        canvasRef.current,
        currentQr,
        {
          width: 240,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [isOpen, currentQr, isImageQr]);

  const handleCopyLpa = () => {
    navigator.clipboard.writeText(currentQr);
    setCopiedLpa(true);
    toast.success('Activation code copied to clipboard!');
    setTimeout(() => setCopiedLpa(false), 2000);
  };

  const handleCopyIccid = () => {
    if (!iccid) return;
    navigator.clipboard.writeText(iccid);
    setCopiedIccid(true);
    toast.success('ICCID copied to clipboard!');
    setTimeout(() => setCopiedIccid(false), 2000);
  };

  const handleDownloadQR = () => {
    if (isImageQr) {
      const a = document.createElement('a');
      a.href = currentQr;
      a.download = `eSIM-${iccid || 'qr'}.png`;
      a.target = '_blank';
      a.click();
    } else if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `eSIM-${iccid || 'qr'}.png`;
      a.href = url;
      a.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG/JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setCurrentQr(base64);
      toast.success('QR Code image file loaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpdatedQr = async () => {
    let finalQr = currentQr;
    if (newMode === 'link') {
      if (!inputUrl.trim()) {
        toast.error('Please enter an image URL.');
        return;
      }
      finalQr = inputUrl.trim();
    } else if (newMode === 'lpa') {
      if (!inputLpa.trim()) {
        toast.error('Please enter an LPA activation code.');
        return;
      }
      finalQr = inputLpa.trim();
    }

    setCurrentQr(finalQr);
    setShowUpdatePanel(false);

    if (onQrUpdated) {
      onQrUpdated(finalQr);
    }
    toast.success('QR Code updated for this eSIM!');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={packageName ? `${packageName} — ${customerName || ''}` : undefined}
      maxWidth="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadQR}
            >
              Download QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setShowUpdatePanel(!showUpdatePanel)}
            >
              {showUpdatePanel ? 'Hide Update' : 'Update QR Image'}
            </Button>
          </div>

          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* QR Display Container */}
        <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm">
          {isImageQr ? (
            <img
              src={currentQr}
              alt="eSIM QR Code"
              className="w-56 h-56 object-contain rounded-2xl border border-slate-100"
              onError={(e) => {
                toast.error('Could not load QR image from link.');
              }}
            />
          ) : (
            <canvas ref={canvasRef} className="rounded-xl max-w-full" />
          )}
        </div>

        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Scan this QR code in <span className="font-semibold text-slate-800">Settings &gt; Cellular &gt; Add eSIM</span> on any iOS or Android device.
        </p>

        {/* In-Modal QR Code Update Panel (Link or Upload) */}
        {showUpdatePanel && (
          <div className="w-full p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-left space-y-3 animate-modal">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Update / Replace QR Code
              </span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-emerald-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setNewMode('link')}
                  className={`px-2 py-0.5 rounded ${newMode === 'link' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  Image Link
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode('upload')}
                  className={`px-2 py-0.5 rounded ${newMode === 'upload' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode('lpa')}
                  className={`px-2 py-0.5 rounded ${newMode === 'lpa' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  LPA Code
                </button>
              </div>
            </div>

            {newMode === 'link' && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://supplier.com/qrcodes/qr-image.png"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white"
                />
              </div>
            )}

            {newMode === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white"
                >
                  Choose QR Image File (PNG / JPG)
                </Button>
              </div>
            )}

            {newMode === 'lpa' && (
              <input
                type="text"
                value={inputLpa}
                onChange={(e) => setInputLpa(e.target.value)}
                placeholder="LPA:1$smdp.io$..."
                className="w-full text-xs font-mono rounded-xl border border-slate-300 px-3 py-1.5 bg-white"
              />
            )}

            <div className="flex justify-end pt-1">
              <Button size="xs" variant="success" onClick={handleSaveUpdatedQr}>
                Apply & Update QR
              </Button>
            </div>
          </div>
        )}

        {/* LPA / Activation String */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Activation Code / Link
            </span>
            <button
              onClick={handleCopyLpa}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
            >
              {copiedLpa ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLpa ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs font-mono text-slate-800 break-all select-all">{currentQr}</p>
        </div>

        {/* ICCID */}
        {iccid && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ICCID Number
              </span>
              <button
                onClick={handleCopyIccid}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                {copiedIccid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIccid ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-800 font-bold">{iccid}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
