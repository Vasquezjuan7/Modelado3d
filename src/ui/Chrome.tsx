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

