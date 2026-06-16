import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Search, MessageSquare, Workflow, Library, Share2,
  Upload, FlaskConical, BarChart3, Tags, Sparkles, ShieldCheck, Menu, X,
} from 'lucide-react';
import { Logo } from '../Logo';
import { useConfig } from '../../lib/hooks';

export interface NavItem { to: string; label: string; icon: ReactNode; section: string }

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.75} />, section: 'Overview' },
  { to: '/ingest', label: 'Add content', icon: <Upload size={18} strokeWidth={1.75} />, section: 'Build' },
  { to: '/taxonomy', label: 'Taxonomy', icon: <Tags size={18} strokeWidth={1.75} />, section: 'Build' },
  { to: '/search', label: 'Search', icon: <Search size={18} strokeWidth={1.75} />, section: 'Explore' },
  { to: '/library', label: 'Library', icon: <Library size={18} strokeWidth={1.75} />, section: 'Explore' },
  { to: '/assistant', label: 'Assistant', icon: <MessageSquare size={18} strokeWidth={1.75} />, section: 'Reason' },
  { to: '/agentic', label: 'Agentic', icon: <Workflow size={18} strokeWidth={1.75} />, section: 'Reason' },
  { to: '/generate', label: 'Generate', icon: <Sparkles size={18} strokeWidth={1.75} />, section: 'Reason' },
  { to: '/graph', label: 'Knowledge graph', icon: <Share2 size={18} strokeWidth={1.75} />, section: 'Reason' },
  { to: '/workspace', label: 'Workspace', icon: <FlaskConical size={18} strokeWidth={1.75} />, section: 'Organize' },
  { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} strokeWidth={1.75} />, section: 'Manage' },
  { to: '/settings', label: 'Governance', icon: <ShieldCheck size={18} strokeWidth={1.75} />, section: 'Manage' },
];

function currentItem(path: string) {
  return NAV.find((n) => (n.to === '/' ? path === '/' : path.startsWith(n.to)));
}

export function AppLayout({ children }: { children: ReactNode }) {
  const config = useConfig();
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Per-route document title.
  useEffect(() => {
    const item = currentItem(loc.pathname);
    document.title = item ? `${item.label} · Research Portal` : 'Research Portal';
  }, [loc.pathname]);

  // Close the mobile drawer on navigation.
  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar config={config} drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-ink-50/85 px-4 backdrop-blur md:px-8">
          <button onClick={() => setDrawerOpen(true)} className="btn-ghost -ml-1.5 px-2 md:hidden" aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="md:hidden"><Logo /></div>
          <button onClick={() => window.dispatchEvent(new Event('rp-open-palette'))}
            className="hidden items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700 sm:inline-flex"
            aria-label="Open command palette">
            <Search size={14} /> Search or ask
            <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-sans text-[10px] text-ink-400">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <KbStatus config={config} compact />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ config, drawerOpen, onClose }: { config: ReturnType<typeof useConfig>; drawerOpen: boolean; onClose: () => void }) {
  return (
    <>
      {drawerOpen && <div className="fixed inset-0 z-40 bg-ink-900/30 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed z-50 flex h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <NavLink to="/" aria-label="Research Portal home"><Logo /></NavLink>
          <button onClick={onClose} className="btn-ghost px-1.5 md:hidden" aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
          <NavSections />
        </nav>
        <div className="border-t border-ink-200 px-5 py-4">
          <KbStatus config={config} />
        </div>
      </aside>
    </>
  );
}

function NavSections() {
  const sections = NAV.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([section, items]) => (
        <div key={section}>
          <div className="px-3 pb-1 t-overline text-ink-400">{section}</div>
          <div className="space-y-0.5">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-md py-2 pl-3 pr-3 text-sm font-medium transition-colors focus-visible:outline-none ${
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${isActive ? 'bg-brand-600' : 'bg-transparent'}`} />
                    <span className={`flex w-5 shrink-0 items-center justify-center ${isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600'}`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KbStatus({ config, compact }: { config: ReturnType<typeof useConfig>; compact?: boolean }) {
  const loading = config === null;
  const connected = config?.kbConfigured;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-600">
        <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-ink-300 animate-pulse' : connected ? 'bg-brand-500' : 'bg-accent-400'}`} />
        {loading ? 'Connecting…' : connected ? 'KB connected' : 'KB offline'}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${loading ? 'bg-ink-300 animate-pulse' : connected ? 'bg-brand-500' : 'bg-accent-400'}`} />
      <div className="min-w-0 leading-tight">
        <div className="text-xs font-semibold text-ink-700">{loading ? 'Connecting…' : connected ? 'Knowledge Box connected' : 'Not configured'}</div>
        {config?.zone && <div className="truncate text-[10px] text-ink-400">{config.zone}</div>}
      </div>
    </div>
  );
}
