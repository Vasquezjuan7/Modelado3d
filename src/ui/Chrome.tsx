import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Box, Camera, Check, ChevronDown, Cpu, ExternalLink, FileText, Languages, Loader2, LogIn, LogOut, Moon,
  RotateCw, Search, Settings, Sparkles, Star, Sun, Tag, Waypoints, X, Gauge, GitBranch, Command,
} from 'lucide-react';
import type { Dict } from '../lib/i18n';
import type { LoadProgress, RepoInfo } from '../lib/repoLoader';
import type { AIConfig } from '../lib/aiEngine';
import { isAIReady } from '../lib/aiEngine';
import type { UserProfile } from '../supabaseClient';
import type { CityModel } from '../lib/cityLayout';
import { DISTRICTS } from '../lib/cityLayout';

// ---------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------
export function LoadingOverlay({ t, progress, target, onCancel }: { t: Dict; progress: LoadProgress; target: string; onCancel: () => void }) {
  const pct = progress.total ? Math.round(((progress.done || 0) / progress.total) * 100) : null;
  const order: LoadProgress['phase'][] = progress.phase === 'clone' || progress.phase === 'scan' ? ['clone', 'scan', 'analyze'] : ['resolve', 'tree', 'download', 'analyze'];
  const idx = order.indexOf(progress.phase);
  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-center justify-center bg-slate-100/70 backdrop-blur-md dark:bg-ink-950/75">
      <div className="panel animate-rise w-[440px] p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400/20 to-indigo-500/20">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">{t.loadingTitle}</div>
            <div className="truncate font-mono text-[12px] text-slate-500">{target}</div>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {order.map((ph, i) => (
            <div key={ph} className={`flex items-center gap-2.5 text-[13px] ${i < idx ? 'text-emerald-600 dark:text-emerald-400' : i === idx ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
              {i < idx ? <Check className="h-4 w-4" /> : i === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
              {t.phases[ph]}
              {i === idx && pct !== null && <span className="ml-auto font-mono text-[11px] text-slate-500">{progress.done}/{progress.total}</span>}
            </div>
          ))}
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]">
          {pct !== null ? (
            <div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-indigo-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          ) : (
            <div className="shimmer-bar h-full w-full" />
          )}
        </div>
        <div className="mt-3 truncate font-mono text-[11px] text-slate-500">{progress.message}</div>
        <div className="mt-5 flex justify-end">
          <button className="btn btn-ghost" onClick={onCancel}>{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------
export function TopBar({
  t, info, aiConfig, user, dark, lang, onBack, onSearch, onReport, onSettings, onAuth, onLogout, onToggleTheme, onToggleLang,
}: {
  t: Dict;
  info: RepoInfo | null;
  aiConfig: AIConfig;
  user: UserProfile | null;
  dark: boolean;
  lang: 'es' | 'en';
  onBack?: () => void;
  onSearch?: () => void;
  onReport?: () => void;
  onSettings: () => void;
  onAuth: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  onToggleLang: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const ready = isAIReady(aiConfig);
  const aiLabel = aiConfig.provider === 'local' ? t.aiLocal : ready ? (aiConfig.provider === 'gemini' ? aiConfig.geminiModel : aiConfig.openaiModel) : t.aiNotConfigured;

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/75 px-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-ink-950/70">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-cyan-400 to-indigo-500 shadow-[0_0_20px_-4px_rgba(34,211,238,0.7)]">
          <Box className="h-4 w-4 text-white" strokeWidth={2.4} />
        </div>
        <div className="leading-none">
          <div className="font-display text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">CodeCity <span className="text-gradient">Nexus</span></div>
          <div className="mt-0.5 text-[10px] text-slate-500">{t.tagline}</div>
        </div>
      </div>

      {info && (
        <>
          <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/10" />
          <button onClick={onBack} className="btn-icon btn" title={t.changeRepo}><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="truncate font-mono text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{info.displayName}</span>
            <span className="hidden shrink-0 font-mono text-[11px] text-slate-500 lg:inline">@{info.branch}{info.commit ? ` · ${info.commit.slice(0, 7)}` : ''}</span>
            {info.stars !== undefined && (
              <span className="hidden shrink-0 items-center gap-1 text-[11px] text-amber-500 lg:flex"><Star className="h-3 w-3 fill-current" />{info.stars.toLocaleString()}</span>
            )}
            {info.url && (
              <a href={info.url} target="_blank" rel="noreferrer" className="shrink-0 text-slate-400 hover:text-cyan-500"><ExternalLink className="h-3.5 w-3.5" /></a>
            )}
          </div>
        </>
      )}

      <div className="flex-1" />

      {info && onSearch && (
        <button onClick={onSearch} className="btn btn-ghost hidden w-64 justify-between text-slate-500 md:flex">
          <span className="flex items-center gap-2"><Search className="h-4 w-4" />{t.search}</span>
          <span className="flex items-center gap-0.5"><span className="kbd">Ctrl</span><span className="kbd">K</span></span>
        </button>
      )}
      {info && onReport && (
        <button onClick={onReport} className="btn btn-ghost"><FileText className="h-4 w-4 text-indigo-400" /><span className="hidden xl:inline">{t.report}</span></button>
      )}

      <button onClick={onSettings} className="btn btn-ghost" title={t.settings}>
        <span className={`h-2 w-2 rounded-full ${aiConfig.provider === 'local' ? 'bg-slate-400' : ready ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
        <Cpu className="h-4 w-4" />
        <span className="hidden max-w-[150px] truncate font-mono text-[11.5px] lg:inline">{aiLabel}</span>
      </button>
      <button onClick={onToggleLang} className="btn-icon btn font-mono text-[11px] font-semibold" title="ES / EN"><Languages className="hidden h-4 w-4" />{lang.toUpperCase()}</button>
      <button onClick={onToggleTheme} className="btn-icon btn">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>

      {user ? (
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="btn btn-ghost pl-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-pink-500 text-[11px] font-bold text-white">{user.fullName.slice(0, 1).toUpperCase()}</span>
            <span className="hidden max-w-[110px] truncate lg:inline">{user.fullName}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menu && (
            <div className="panel animate-rise absolute right-0 mt-2 w-60 p-2" onMouseLeave={() => setMenu(false)}>
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{user.fullName}</div>
                <div className="text-[11.5px] text-slate-500">{user.email}</div>
                <div className="mt-1.5 text-[11px] text-slate-500">{user.role} · {user.isLocalGuest ? t.localAccount : t.cloudAccount}</div>
              </div>
              <button onClick={() => { setMenu(false); onLogout(); }} className="btn mt-1 w-full justify-start text-red-500 hover:bg-red-500/10"><LogOut className="h-4 w-4" />{t.logout}</button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={onAuth} className="btn btn-ghost"><LogIn className="h-4 w-4" /><span className="hidden lg:inline">{t.login}</span></button>
      )}
      <button onClick={onSettings} className="btn-icon btn" title={t.settings}><Settings className="h-4 w-4" /></button>
    </header>
  );
}

// ---------------------------------------------------------------
// Bottom dock (camera + view toggles)
// ---------------------------------------------------------------
export function Dock({
  t, onPreset, showLabels, setShowLabels, showArcs, setShowArcs, autoRotate, setAutoRotate, quality, setQuality,
}: {
  t: Dict;
  onPreset: (p: 'iso' | 'top' | 'front') => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  showArcs: boolean;
  setShowArcs: (v: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  quality: 'high' | 'low';
  setQuality: (q: 'high' | 'low') => void;
}) {
  const toggle = (on: boolean) => `seg-item flex items-center gap-1.5 ${on ? 'seg-item-active' : ''}`;
  return (
    <div className="panel pointer-events-auto flex items-center gap-2 p-1.5">
      <div className="flex items-center gap-1 pl-2 text-slate-400"><Camera className="h-3.5 w-3.5" /></div>
      <div className="seg">
        <button className="seg-item" onClick={() => onPreset('iso')}>{t.iso}</button>
        <button className="seg-item" onClick={() => onPreset('top')}>{t.top}</button>
        <button className="seg-item" onClick={() => onPreset('front')}>{t.front}</button>
      </div>
      <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />
      <div className="seg">
        <button className={toggle(showLabels)} onClick={() => setShowLabels(!showLabels)}><Tag className="h-3.5 w-3.5" />{t.labels}</button>
        <button className={toggle(showArcs)} onClick={() => setShowArcs(!showArcs)}><Waypoints className="h-3.5 w-3.5" />{t.arcs}</button>
        <button className={toggle(autoRotate)} onClick={() => setAutoRotate(!autoRotate)}><RotateCw className="h-3.5 w-3.5" />{t.rotate}</button>
        <button className={toggle(quality === 'high')} onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}><Gauge className="h-3.5 w-3.5" />{quality === 'high' ? 'HD' : 'Eco'}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Command palette (file search)
// ---------------------------------------------------------------
function fuzzyScore(q: string, s: string): number {
  const a = q.toLowerCase();
  const b = s.toLowerCase();
  const idx = b.indexOf(a);
  if (idx >= 0) return 1000 - idx - (b.length - a.length) * 0.1 + (b.lastIndexOf('/') < idx ? 200 : 0);
  let j = 0;
  let score = 0;
  for (let i = 0; i < b.length && j < a.length; i++) {
    if (b[i] === a[j]) {
      score += 10;
      j++;
    }
  }
  return j === a.length ? score : -1;
}

export function SearchPalette({ t, city, onPick, onClose }: { t: Dict; city: CityModel; onPick: (path: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    if (!q.trim()) return [...city.buildings].sort((a, b) => b.lines - a.lines).slice(0, 40);
    return city.buildings
      .map((b) => ({ b, s: fuzzyScore(q.trim(), b.path) }))
      .filter((x) => x.s >= 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 60)
      .map((x) => x.b);
  }, [q, city]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-start justify-center bg-slate-900/20 pt-[12vh] backdrop-blur-sm dark:bg-black/50" onMouseDown={onClose}>
      <div className="panel animate-rise w-[620px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-white/[0.07]">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="flex-1 bg-transparent py-3.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === 'Enter' && results[sel]) onPick(results[sel].path);
              if (e.key === 'Escape') onClose();
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.map((b, i) => (
            <button
              key={b.path}
              data-i={i}
              onMouseEnter={() => setSel(i)}
              onClick={() => onPick(b.path)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? 'bg-cyan-500/10' : ''}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DISTRICTS[b.district].color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">{b.name}</span>
                <span className="block truncate font-mono text-[11px] text-slate-500">{b.path}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">{b.lines.toLocaleString()} L</span>
            </button>
          ))}
          {results.length === 0 && <div className="p-6 text-center text-[13px] text-slate-500">—</div>}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 dark:border-white/[0.07]">
          <Command className="h-3 w-3" /> <span className="kbd">↑</span><span className="kbd">↓</span> <span className="kbd">Enter</span>
          <span className="ml-auto flex items-center gap-1"><Sparkles className="h-3 w-3" />{city.buildings.length} {t.files.toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}

export function Modal({ children, onClose, width = 'w-[560px]' }: { children: React.ReactNode; onClose: () => void; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-sm dark:bg-black/55" onMouseDown={onClose}>
      <div className={`panel animate-rise flex max-h-full flex-col overflow-hidden ${width}`} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ icon, title, subtitle, onClose, right }: { icon: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/[0.07]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400/15 to-indigo-500/20 text-cyan-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] font-semibold text-slate-900 dark:text-white">{title}</div>
        {subtitle && <div className="truncate text-[12px] text-slate-500">{subtitle}</div>}
      </div>
      {right}
      <button onClick={onClose} className="btn-icon btn"><X className="h-4 w-4" /></button>
    </div>
  );
}
