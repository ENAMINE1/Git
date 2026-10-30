import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BookA,
  Clapperboard,
  Columns2,
  Compass,
  FolderOpen,
  Images,
  Library,
  Menu,
  Moon,
  Palette,
  Plus,
  Search,
  Sparkles,
  Sun,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useSearch } from './search';
import { useQuickAdd } from './quickadd';
import { Popover, MenuItem } from './ui';

const NAV = [
  { to: '/', label: 'Discover', icon: Compass, end: true },
  { to: '/videos', label: 'Video references', icon: Video },
  { to: '/techniques', label: 'Effects & transitions', icon: Sparkles },
  { to: '/art-directions', label: 'Art directions', icon: Palette },
  { to: '/moodboards', label: 'Moodboards', icon: Images },
  { to: '/breakdowns', label: 'Breakdowns', icon: Clapperboard },
  { to: '/creators', label: 'Creators', icon: Users },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/glossary', label: 'Glossary', icon: BookA },
  { to: '/compare', label: 'Compare', icon: Columns2 },
];

// Theme is shared by every toggle instance through one tiny external store.
type Theme = 'light' | 'dark' | 'system';
const themeStore = (() => {
  let value: Theme = 'system';
  try {
    value = (JSON.parse(localStorage.getItem('framework:theme') ?? '"system"') as Theme) || 'system';
  } catch {
    /* storage unavailable */
  }
  const subs = new Set<() => void>();
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const resolved = () => (value === 'system' ? (mq?.matches ? 'dark' : 'light') : value);
  const apply = () => {
    document.documentElement.dataset.theme = resolved();
    subs.forEach((f) => f());
  };
  mq?.addEventListener('change', apply);
  apply();
  return {
    get: () => value,
    resolved,
    set(v: Theme) {
      value = v;
      try {
        localStorage.setItem('framework:theme', JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
      apply();
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
})();

function useResolvedTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.resolved);
}

function Wordmark() {
  return (
    <NavLink to="/" className="block select-none">
      <span className="font-mono text-[13px] font-semibold tracking-[0.32em]">FRAMEWORK</span>
      <span className="mt-0.5 block font-serif text-[13px] italic text-muted">a library of moving images</span>
    </NavLink>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors',
              isActive ? 'bg-ink text-paper' : 'text-ink/75 hover:bg-ink/[0.05] hover:text-ink',
            )
          }
        >
          <Icon size={15} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function QuickAddMenu({ full }: { full?: boolean }) {
  const quick = useQuickAdd();
  return (
    <Popover
      align="left"
      width={230}
      trigger={(p) => (
        <button className={clsx('btn-solid', full && 'w-full')} {...p}>
          <Plus size={15} /> Save
        </button>
      )}
    >
      {(close) => (
        <>
          {(
            [
              ['video', 'Video reference'],
              ['technique', 'Technique'],
              ['breakdown', 'Breakdown'],
              ['artDirection', 'Art direction'],
              ['moodboard', 'Moodboard'],
              ['creator', 'Creator'],
            ] as const
          ).map(([k, label]) => (
            <MenuItem
              key={k}
              onClick={() => {
                close();
                quick(k);
              }}
            >
              {label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function ThemeToggle() {
  const isDark = useResolvedTheme() === 'dark';
  return (
    <button
      className="icon-btn"
      onClick={() => themeStore.set(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title="Toggle theme"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { openPalette } = useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Wordmark />
        <button onClick={openPalette} className="mt-6 flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-faint hover:border-ink/30">
          <Search size={14} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="font-mono text-[10px]">⌘K</kbd>
        </button>
        <div className="mt-3">
          <QuickAddMenu full />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <NavLink
            to="/library"
            className={({ isActive }) => clsx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]', isActive ? 'text-ink' : 'text-muted hover:text-ink')}
          >
            <Library size={15} strokeWidth={1.75} /> Library & backup
          </NavLink>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <button className="icon-btn -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <span className="font-mono text-[12px] font-semibold tracking-[0.32em]">FRAMEWORK</span>
        <div className="flex items-center">
          <button className="icon-btn" onClick={openPalette} aria-label="Search">
            <Search size={17} />
          </button>
          <ThemeToggle />
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="fade-in h-full w-[270px] overflow-y-auto bg-paper px-4 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <Wordmark />
              <button className="icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <QuickAddMenu full />
            <div className="mt-5">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <NavLink to="/library" className="mt-4 flex items-center gap-2 border-t border-line px-2.5 pt-4 text-[13.5px] text-muted">
              <Library size={15} /> Library & backup
            </NavLink>
          </div>
        </div>
      )}

      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-[232px] lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
