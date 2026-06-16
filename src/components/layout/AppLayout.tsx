import { NavLink, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import {
  LayoutDashboard, Search, MessageSquare, Workflow, Library, Share2,
  Upload, FlaskConical, BarChart3, Tags,
} from 'lucide-react';
import { Logo } from '../Logo';
import { useConfig } from '../../lib/hooks';

export interface NavItem { to: string; label: string; icon: ReactNode; soon?: boolean }

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/ingest', label: 'Add Content', icon: <Upload size={18} /> },
  { to: '/taxonomy', label: 'Taxonomy', icon: <Tags size={18} /> },
  { to: '/search', label: 'Search', icon: <Search size={18} /> },
  { to: '/library', label: 'Library', icon: <Library size={18} /> },
  { to: '/assistant', label: 'Assistant', icon: <MessageSquare size={18} /> },
  { to: '/agentic', label: 'Agentic', icon: <Workflow size={18} /> },
  { to: '/graph', label: 'Knowledge Graph', icon: <Share2 size={18} /> },
  { to: '/workspace', label: 'Workspace', icon: <FlaskConical size={18} /> },
  { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const config = useConfig();
  const loc = useLocation();
  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="px-5 py-5">
          <NavLink to="/"><Logo /></NavLink>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
              {item.soon && <span className="ml-auto text-[10px] uppercase text-ink-400">soon</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-200 px-5 py-4">
          <KbBadge connected={config?.kbConfigured} zone={config?.zone} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-ink-200 bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="md:hidden"><Logo /></div>
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-500">
            <span className="hidden sm:inline">{titleFor(loc.pathname)}</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function titleFor(path: string) {
  const item = NAV.find((n) => (n.to === '/' ? path === '/' : path.startsWith(n.to)));
  return item?.label ?? '';
}

function KbBadge({ connected, zone }: { connected?: boolean; zone?: string | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <div className="leading-tight">
        <div className="font-semibold text-ink-700">{connected ? 'KB connected' : 'KB not configured'}</div>
        {zone && <div className="text-[10px] text-ink-400">{zone}</div>}
      </div>
    </div>
  );
}
