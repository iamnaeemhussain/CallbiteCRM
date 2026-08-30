import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CardSim as SimCard, ArrowRight, X, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ esims: any[] }>({ esims: [] });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ esims: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ esims: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get('/api/search', { q: query.trim() });
        if (res.success && res.results) {
          setResults({ esims: res.results.esims || [] });
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelectEsim = () => {
    navigate('/esims');
    onClose();
  };

  if (!isOpen) return null;

  const totalResults = results.esims.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative mx-auto max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all animate-modal">
        <div className="relative flex items-center border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ICCID, holder name, WhatsApp, package..."
            className="h-10 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0 mr-2" />}
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query.trim() && (
            <div className="py-8 text-center text-xs text-slate-400">Type an ICCID, holder name, or WhatsApp number.</div>
          )}

          {query.trim() && !isLoading && totalResults === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching eSIMs for "<span className="font-semibold text-slate-800">{query}</span>".
            </div>
          )}

          {results.esims.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <SimCard className="w-3.5 h-3.5 text-blue-600" />
                <span>eSIMs & ICCIDs ({results.esims.length})</span>
              </div>
              <div className="space-y-1">
                {results.esims.map((e) => (
                  <div
                    key={e.id}
                    onClick={handleSelectEsim}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                          {e.package_name} ({e.data_allowance})
                        </span>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{e.iccid}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {e.customer_name}
                        {e.customer_phone ? ` (${e.customer_phone})` : ''} • Expires: {formatDate(e.expiry_date)}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>Opens eSIM inventory</span>
        </div>
      </div>
    </div>
  );
};
