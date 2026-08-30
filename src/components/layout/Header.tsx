import React, { useState, useEffect } from 'react';
import { Menu, Search, Plus, Command } from 'lucide-react';
import { Button } from '../common/Button';
import { GlobalSearchModal } from './GlobalSearchModal';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleSidebar}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-400 hover:border-slate-300 hover:bg-white hover:text-slate-600 transition-all shadow-subtle group"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
            <span className="flex-1 text-left truncate">Search ICCID, holder name, WhatsApp, package...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              <Command className="w-3 h-3" /> K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-4">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/esims')}
            className="shadow-sm"
          >
            <span className="hidden sm:inline">eSIM Inventory</span>
            <span className="sm:hidden">eSIMs</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2 pl-1">
            <div className="flex flex-col text-right hidden md:block">
              <span className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user?.role}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center text-xs font-bold shadow-inner">
              {user?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
          </div>
        </div>
      </header>

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
