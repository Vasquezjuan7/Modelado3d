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

