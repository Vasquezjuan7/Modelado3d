import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, Crosshair, ExternalLink, FileCode2, Layers, Palette, Radio,
  ShieldAlert, Sparkles, X, Zap, ChevronRight, FolderOpen, Info,
} from 'lucide-react';
import type { Dict } from '../lib/i18n';
import { compact, formatBytes } from '../lib/i18n';
import { DISTRICTS, riskColor } from '../lib/cityLayout';
import type { Building, CityModel, DistrictKey } from '../lib/cityLayout';
import type { RepoFile } from '../lib/codeMetrics';
import type { AuditResult, Severity } from '../lib/aiEngine';
import type { ColorMode } from '../scene/CityMeshes';
import { languageColor } from '../scene/CityMeshes';
import type { TrafficMode, TrafficStats } from '../scene/Traffic';

export const SEV_STYLE: Record<Severity | 'CLEAN', string> = {
  CRITICAL: 'border-red-500/40 bg-red-500/12 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/40 bg-orange-500/12 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-amber-500/40 bg-amber-500/12 text-amber-600 dark:text-amber-300',
  LOW: 'border-sky-500/40 bg-sky-500/12 text-sky-600 dark:text-sky-300',
  CLEAN: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel-inset px-3 py-2.5">
      <div className="label-xs">{label}</div>
      <div className="mt-1 font-display text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-[10.5px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Sidebar({
  t, lang, files, city, edgesCount, activeDistrict, onDistrict, colorMode, setColorMode, risky, onPick, traffic, setTraffic, trafficStats, notice,
}: {
  t: Dict;
  lang: 'es' | 'en';
  files: RepoFile[];
  city: CityModel;
  edgesCount: number;
  activeDistrict: DistrictKey | null;
  onDistrict: (d: DistrictKey | null) => void;
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  risky: Array<{ path: string; score: number; critical: number; high: number; total: number }>;
  onPick: (path: string) => void;
  traffic: TrafficMode;
  setTraffic: (m: TrafficMode) => void;
  trafficStats: TrafficStats | null;
  notice: string | null;
}) {
  const totals = useMemo(() => {
    let lines = 0, fns = 0, est = 0;
    for (const f of files) {
      lines += f.lines;
      fns += f.functions;
      if (f.linesEstimated) est++;
    }
    return { lines, fns, est };
  }, [files]);

  const langs = useMemo(() => {
    const m = new Map<string, number>();
    files.forEach((f) => m.set(f.language, (m.get(f.language) || 0) + f.lines));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const top = arr.slice(0, 6);
    const rest = arr.slice(6).reduce((s, x) => s + x[1], 0);
    if (rest) top.push([lang === 'es' ? 'Otros' : 'Other', rest]);
    const total = arr.reduce((s, x) => s + x[1], 0) || 1;
    return top.map(([name, v]) => ({ name, v, pct: (v / total) * 100 }));
  }, [files, lang]);

  const maxLines = Math.max(...city.districts.map((d) => d.lines), 1);

  return (
    <aside className="panel pointer-events-auto flex h-full w-[300px] flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {notice && (
          <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {notice}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t.files} value={compact(files.length)} />
          <Stat label={t.lines} value={compact(totals.lines)} sub={totals.est ? `${totals.est} ${t.estimated}` : undefined} />
          <Stat label={t.functions} value={compact(totals.fns)} />
          <Stat label={t.deps} value={compact(edgesCount)} />
        </div>

        <section>
          <div className="label-xs mb-2">{t.languages}</div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
            {langs.map((l) => (
              <div key={l.name} style={{ width: `${l.pct}%`, background: languageColor(l.name) }} title={`${l.name} ${l.pct.toFixed(1)}%`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {langs.map((l) => (
              <span key={l.name} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: languageColor(l.name) }} />
                {l.name} <span className="text-slate-400 dark:text-slate-500">{l.pct.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="label-xs flex items-center gap-1.5"><Layers className="h-3 w-3" />{t.districts}</div>
            {activeDistrict && <button onClick={() => onDistrict(null)} className="cursor-pointer text-[11px] text-cyan-600 hover:underline dark:text-cyan-400">{t.all}</button>}
          </div>
          <div className="space-y-1">
            {city.districts.map((d) => {
              const def = DISTRICTS[d.key];
              const active = activeDistrict === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => onDistrict(active ? null : d.key)}
                  className={`group w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition ${active ? 'border-cyan-500/40 bg-cyan-500/[0.07]' : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04]'} ${activeDistrict && !active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: def.color, boxShadow: `0 0 10px ${def.color}88` }} />
                    <span className="flex-1 truncate text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{def.name[lang]}</span>
                    <span className="font-mono text-[11px] text-slate-500">{d.count}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-[18px]">
                    <span className="truncate text-[10.5px] text-slate-500">{def.role[lang]}</span>
                    <span className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                      <span className="block h-full rounded-full" style={{ width: `${(d.lines / maxLines) * 100}%`, background: def.color }} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="label-xs mb-2 flex items-center gap-1.5"><Palette className="h-3 w-3" />{t.colorBy}</div>
          <div className="seg w-full">
            {(['district', 'risk', 'language'] as ColorMode[]).map((m) => (
              <button key={m} onClick={() => setColorMode(m)} className={`seg-item flex-1 ${colorMode === m ? 'seg-item-active' : ''}`}>
                {m === 'district' ? t.cmDistrict : m === 'risk' ? t.cmRisk : t.cmLanguage}
              </button>
            ))}
          </div>
          {colorMode === 'risk' && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>100</span>
              <span className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${riskColor(95)}, ${riskColor(80)}, ${riskColor(60)}, ${riskColor(40)}, ${riskColor(10)})` }} />
              <span>0</span>
            </div>
          )}
        </section>

        <section>
          <div className="label-xs mb-2 flex items-center gap-1.5"><ShieldAlert className="h-3 w-3" />{t.riskiest}</div>
          {risky.length === 0 ? (
            <div className="panel-inset px-3 py-2.5 text-[11.5px] text-slate-500">{t.noRisk}</div>
          ) : (
            <div className="space-y-1">
              {risky.slice(0, 7).map((r) => (
                <button key={r.path} onClick={() => onPick(r.path)} className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/[0.04]">
                  <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold text-white" style={{ background: riskColor(r.score) }}>{r.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">{r.path.split('/').pop()}</span>
                    <span className="block truncate text-[10.5px] text-slate-500">
                      {r.critical > 0 && <span className="text-red-500">{r.critical} crit · </span>}
                      {r.high > 0 && <span className="text-orange-500">{r.high} high · </span>}
                      {r.total} total
                    </span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="label-xs mb-2 flex items-center gap-1.5"><Radio className="h-3 w-3" />{t.traffic}</div>
          <div className="seg w-full">
            {(['off', 'live', 'stress'] as TrafficMode[]).map((m) => (
              <button key={m} onClick={() => setTraffic(m)} className={`seg-item flex flex-1 items-center justify-center gap-1 ${traffic === m ? 'seg-item-active' : ''} ${m === 'stress' && traffic === m ? '!text-red-500' : ''}`}>
                {m === 'live' && <Activity className="h-3 w-3" />}
                {m === 'stress' && <Zap className="h-3 w-3" />}
                {m === 'off' ? t.trafficOff : m === 'live' ? t.trafficLive : t.trafficStress}
              </button>
            ))}
          </div>
          {traffic !== 'off' && trafficStats && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="panel-inset px-2 py-1.5 text-center">
                <div className="font-mono text-[14px] font-semibold text-slate-900 dark:text-white">{trafficStats.packetsPerSec}</div>
                <div className="text-[9.5px] text-slate-500">{t.pps}</div>
              </div>
              <div className="panel-inset px-2 py-1.5 text-center">
                <div className={`font-mono text-[14px] font-semibold ${trafficStats.p99 > 400 ? 'text-red-500' : trafficStats.p99 > 150 ? 'text-amber-500' : 'text-emerald-500'}`}>{trafficStats.p99}ms</div>
                <div className="text-[9.5px] text-slate-500">{t.p99}</div>
              </div>
              <div className="panel-inset px-2 py-1.5 text-center">
                <div className={`font-mono text-[14px] font-semibold ${trafficStats.congested > 40 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{trafficStats.congested}</div>
                <div className="text-[9.5px] text-slate-500">{t.congested}</div>
              </div>
            </div>
          )}
          <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">{t.trafficHint}</p>
        </section>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------
// Inspector (right)
// ---------------------------------------------------------------
export function Inspector({
  t, lang, file, building, local, imports, importedBy, aiReady, webUrl, canOpenLocal, onAudit, onFocus, onClose, onPick, onOpenLocal,
}: {
  t: Dict;
  lang: 'es' | 'en';
  file: RepoFile;
  building: Building;
  local: AuditResult | null;
  imports: string[];
  importedBy: string[];
  aiReady: boolean;
  webUrl?: string;
  canOpenLocal: boolean;
  onAudit: () => void;
  onFocus: () => void;
  onClose: () => void;
  onPick: (p: string) => void;
  onOpenLocal: () => void;
}) {
  const def = DISTRICTS[building.district];
  const [depTab, setDepTab] = useState<'out' | 'in'>('out');
  const preview = useMemo(() => (file.content ? file.content.split(/\r?\n/).slice(0, 400) : null), [file]);
  const issueLines = useMemo(() => new Map((local?.issues || []).map((i) => [i.line, i.severity])), [local]);
  const deps = depTab === 'out' ? imports : importedBy;

  return (
    <aside className="panel animate-rise pointer-events-auto flex h-full w-[380px] flex-col overflow-hidden">
      <div className="border-b border-slate-200 p-4 dark:border-white/[0.07]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${def.color}22`, color: def.color }}>
            <FileCode2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[15px] font-semibold text-slate-900 dark:text-white" title={file.name}>{file.name}</div>
            <div className="truncate font-mono text-[11px] text-slate-500" title={file.path}>{file.path}</div>
          </div>
          <button onClick={onClose} className="btn-icon btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip" style={{ borderColor: `${def.color}55`, background: `${def.color}14`, color: def.color }}>{def.name[lang]}</span>
          <span className="chip border-slate-300 text-slate-600 dark:border-white/10 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: languageColor(file.language) }} />{file.language}
          </span>
          {local && (
            <span className={`chip ${SEV_STYLE[local.severity]}`}>{local.issues.length ? `${local.issues.length} ${t.findings.toLowerCase()}` : t.clean}</span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t.lines} value={file.lines.toLocaleString()} sub={file.linesEstimated ? t.estimated : undefined} />
          <Stat label={t.sloc} value={file.sloc.toLocaleString()} />
          <Stat label={t.functions} value={String(file.functions)} />
          <Stat label={t.size} value={formatBytes(file.size)} />
          <Stat label={t.imports} value={String(imports.length)} />
          <Stat label={t.importedBy} value={String(importedBy.length)} />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={onAudit} className="btn btn-primary py-2.5" disabled={!file.content}>
            <Sparkles className="h-4 w-4" />{aiReady ? t.auditAI : t.auditLocal}
          </button>
          <button onClick={onFocus} className="btn btn-ghost" title={t.focus}><Crosshair className="h-4 w-4" /></button>
        </div>
        {(webUrl || canOpenLocal) && (
          <div className="flex gap-2">
            {webUrl && <a href={webUrl} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1 text-[12px]"><ExternalLink className="h-3.5 w-3.5" />{t.openGithub}</a>}
            {canOpenLocal && <button onClick={onOpenLocal} className="btn btn-ghost flex-1 text-[12px]"><FolderOpen className="h-3.5 w-3.5" />{lang === 'es' ? 'Abrir archivo' : 'Open file'}</button>}
          </div>
        )}

        {local && local.issues.length > 0 && (
          <section>
            <div className="label-xs mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" />{t.localFindings}</div>
            <div className="space-y-1.5">
              {local.issues.slice(0, 6).map((i, k) => (
                <div key={k} className="panel-inset px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`chip px-1.5 py-0 text-[9.5px] ${SEV_STYLE[i.severity]}`}>{i.severity}</span>
                    <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">{i.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10.5px] text-slate-500">L{i.line}</span>
                  </div>
                </div>
              ))}
              {local.issues.length > 6 && <div className="text-center text-[11px] text-slate-500">+{local.issues.length - 6}</div>}
            </div>
          </section>
        )}

        {(imports.length > 0 || importedBy.length > 0) && (
          <section>
            <div className="seg mb-2 w-full">
              <button onClick={() => setDepTab('out')} className={`seg-item flex flex-1 items-center justify-center gap-1 ${depTab === 'out' ? 'seg-item-active' : ''}`}><ArrowUpRight className="h-3 w-3 text-cyan-500" />{t.imports} ({imports.length})</button>
              <button onClick={() => setDepTab('in')} className={`seg-item flex flex-1 items-center justify-center gap-1 ${depTab === 'in' ? 'seg-item-active' : ''}`}><ArrowDownLeft className="h-3 w-3 text-amber-500" />{t.importedBy} ({importedBy.length})</button>
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {deps.map((p) => (
                <button key={p} onClick={() => onPick(p)} className="block w-full cursor-pointer truncate rounded-md px-2 py-1 text-left font-mono text-[11px] text-slate-600 hover:bg-slate-100 hover:text-cyan-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-cyan-300">
                  {p}
                </button>
              ))}
              {deps.length === 0 && <div className="px-2 py-1 text-[11px] text-slate-500">—</div>}
            </div>
          </section>
        )}

        <section>
          <div className="label-xs mb-2">{t.preview}</div>
          {preview ? (
            <div className="panel-inset max-h-[340px] overflow-auto py-2">
              <pre className="code-area">
                {preview.map((l, i) => {
                  const sev = issueLines.get(i + 1);
                  return (
                    <div key={i} className={`flex pr-3 ${sev ? (sev === 'CRITICAL' || sev === 'HIGH' ? 'bg-red-500/10' : 'bg-amber-500/10') : ''}`}>
                      <span className="w-10 shrink-0 pr-3 text-right text-slate-400 select-none dark:text-slate-600">{i + 1}</span>
                      <span className="whitespace-pre text-slate-700 dark:text-slate-300">{l || ' '}</span>
                    </div>
                  );
                })}
              </pre>
            </div>
          ) : (
            <div className="panel-inset px-3 py-2.5 text-[11.5px] text-slate-500">{t.noContent}</div>
          )}
        </section>
      </div>
    </aside>
  );
}

export function EmptyInspector({ t }: { t: Dict }) {
  return (
    <div className="panel pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-slate-500">
      <Crosshair className="h-4 w-4 text-cyan-500" /> {t.selectHint}
    </div>
  );
}
