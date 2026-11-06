import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, Check, Copy, Download, FileDiff, HardDriveDownload, ListChecks, Loader2, RefreshCw, Settings, ShieldCheck, Code2, Lightbulb } from 'lucide-react';
import type { Dict } from '../lib/i18n';
import type { AuditResult } from '../lib/aiEngine';
import { diffLines } from '../lib/diff';
import { Modal, ModalHeader } from './Chrome';
import { SEV_STYLE } from './Panels';
import { riskColor } from '../lib/cityLayout';

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const col = riskColor(score);
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200 dark:text-white/[0.07]" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-semibold" style={{ color: col }}>{score}</div>
    </div>
  );
}

export function AuditModal({
  t, fileName, filePath, original, result, loading, error, canApply, onClose, onRetry, onUseLocal, onOpenSettings, onApply,
}: {
  t: Dict;
  fileName: string;
  filePath: string;
  original: string;
  result: AuditResult | null;
  loading: boolean;
  error: string | null;
  canApply: boolean;
  onClose: () => void;
  onRetry: () => void;
  onUseLocal: () => void;
  onOpenSettings: () => void;
  onApply: (code: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'issues' | 'diff' | 'code'>('issues');
  const [copied, setCopied] = useState(false);
  const [applyState, setApplyState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const lines = useMemo(() => original.split(/\r?\n/), [original]);
  const diff = useMemo(() => (result?.refactoredCode ? diffLines(original, result.refactoredCode) : null), [original, result]);

  const download = () => {
    if (!result?.refactoredCode) return;
    const blob = new Blob([result.refactoredCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const providerBadge = result && (
    <span className="chip hidden border-slate-300 text-slate-600 md:inline-flex dark:border-white/10 dark:text-slate-300">
      <Bot className="h-3 w-3" />{result.modelName} · {(result.durationMs / 1000).toFixed(1)}s
    </span>
  );

  return (
    <Modal onClose={onClose} width="w-[min(1180px,96vw)] h-[min(820px,92vh)]">
      <ModalHeader icon={<ShieldCheck className="h-5 w-5" />} title={fileName} subtitle={filePath} onClose={onClose} right={providerBadge} />

      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-cyan-400/20 to-indigo-500/25"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>
          </div>
          <div className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">{t.auditing}</div>
          <div className="max-w-md text-[13px] text-slate-500">{t.auditingSub}</div>
          <div className="h-1 w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5"><div className="shimmer-bar h-full w-full" /></div>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500"><AlertTriangle className="h-7 w-7" /></div>
          <div className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">{t.auditError}</div>
          <div className="max-w-xl rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 font-mono text-[12px] text-red-600 dark:text-red-300">{error}</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onOpenSettings}><Settings className="h-4 w-4" />{t.openSettings}</button>
            <button className="btn btn-ghost" onClick={onUseLocal}>{t.useLocal}</button>
            <button className="btn btn-primary" onClick={onRetry}><RefreshCw className="h-4 w-4" />{t.retry}</button>
          </div>
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="flex items-center gap-5 border-b border-slate-200 px-5 py-4 dark:border-white/[0.07]">
            <ScoreRing score={result.score} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`chip ${SEV_STYLE[result.severity]}`}>{result.severity}</span>
                <span className="truncate font-display text-[15px] font-semibold text-slate-900 dark:text-white">{result.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">{result.summary}</p>
            </div>
            <div className="hidden gap-2 lg:flex">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
                <div key={s} className={`rounded-xl border px-3 py-1.5 text-center ${SEV_STYLE[s]}`}>
                  <div className="font-mono text-[15px] font-semibold">{result.issues.filter((i) => i.severity === s).length}</div>
                  <div className="text-[9px] tracking-wider">{s}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={onRetry}><RefreshCw className="h-4 w-4" />{t.reaudit}</button>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-2 dark:border-white/[0.07]">
            <div className="seg">
              <button onClick={() => setTab('issues')} className={`seg-item flex items-center gap-1.5 ${tab === 'issues' ? 'seg-item-active' : ''}`}><ListChecks className="h-3.5 w-3.5" />{t.findings} ({result.issues.length})</button>
              <button onClick={() => setTab('diff')} className={`seg-item flex items-center gap-1.5 ${tab === 'diff' ? 'seg-item-active' : ''}`}>
                <FileDiff className="h-3.5 w-3.5" />{t.diff}
                {diff && (diff.added || diff.removed) ? <span className="font-mono text-[10.5px]"><span className="text-emerald-500">+{diff.added}</span> <span className="text-red-500">−{diff.removed}</span></span> : null}
              </button>
              <button onClick={() => setTab('code')} className={`seg-item flex items-center gap-1.5 ${tab === 'code' ? 'seg-item-active' : ''}`}><Code2 className="h-3.5 w-3.5" />{t.refactor}</button>
            </div>
            <div className="flex-1" />
            {result.refactoredCode && (
              <>
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(result.refactoredCode!); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}{copied ? t.copied : t.copy}
                </button>
                <button className="btn btn-ghost" onClick={download}><Download className="h-4 w-4" />{t.download}</button>
                {canApply && (
                  <button
                    className="btn btn-primary"
                    disabled={applyState === 'busy' || applyState === 'done'}
                    onClick={async () => {
                      setApplyState('busy');
                      try {
                        await onApply(result.refactoredCode!);
                        setApplyState('done');
                      } catch (e) {
                        setApplyState((e as Error).message);
                      }
                    }}
                  >
                    {applyState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : applyState === 'done' ? <Check className="h-4 w-4" /> : <HardDriveDownload className="h-4 w-4" />}
                    {applyState === 'done' ? t.applied : t.applyDisk}
                  </button>
                )}
              </>
            )}
          </div>
          {applyState !== 'idle' && applyState !== 'busy' && applyState !== 'done' && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-[12px] text-red-600 dark:text-red-300">{applyState}</div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === 'issues' && (
              <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="space-y-2 overflow-y-auto p-4">
                  {result.issues.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-500">
                      <ShieldCheck className="h-10 w-10 text-emerald-500" />{t.clean}
                    </div>
                  )}
                  {result.issues.map((i, k) => (
                    <button
                      key={k}
                      onClick={() => setFocusLine(i.line)}
                      className={`panel-inset block w-full cursor-pointer px-3.5 py-3 text-left transition hover:border-cyan-500/40 ${focusLine === i.line ? '!border-cyan-500/60' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`chip px-1.5 py-0 text-[9.5px] ${SEV_STYLE[i.severity]}`}>{i.severity}</span>
                        <span className="text-[10.5px] tracking-wide text-slate-500 uppercase">{i.type}</span>
                        <span className="ml-auto font-mono text-[11px] text-slate-500">{t.line} {i.line}</span>
                      </div>
                      <div className="mt-1.5 text-[13px] font-semibold text-slate-900 dark:text-white">{i.title}</div>
                      <div className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">{i.message}</div>
                      {i.snippet && <pre className="code-area mt-2 overflow-x-auto rounded-lg bg-slate-900/[0.04] px-2.5 py-1.5 text-red-600 dark:bg-black/30 dark:text-red-300">{i.snippet}</pre>}
                      {i.fix && (
                        <div className="mt-2 flex gap-1.5 text-[11.5px] text-emerald-700 dark:text-emerald-300">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><b>{t.suggestedFix}:</b> {i.fix}</span>
                        </div>
                      )}
                    </button>
                  ))}
                  {result.explanation && <div className="px-1 pt-2 text-[11.5px] leading-relaxed text-slate-500">{result.explanation}</div>}
                </div>
                <CodeView lines={lines} focus={focusLine} marks={new Map(result.issues.map((i) => [i.line, i.severity]))} />
              </div>
            )}

            {tab === 'diff' && (
              !result.refactoredCode ? <Notice text={t.noRefactor} /> : diff && diff.added + diff.removed === 0 ? <Notice text={t.noChanges} /> : (
                <div className="h-full overflow-auto">
                  <table className="code-area w-full table-fixed border-collapse">
                    <colgroup><col className="w-12" /><col /><col className="w-12" /><col /></colgroup>
                    <tbody>
                      {diff!.rows.map((r, i) => (
                        <tr key={i}>
                          <td className={`border-r border-slate-200 pr-2 text-right align-top text-slate-400 select-none dark:border-white/5 dark:text-slate-600 ${r.kind === 'del' || r.kind === 'change' ? 'bg-red-500/10' : ''}`}>{r.left?.n ?? ''}</td>
                          <td className={`px-3 align-top whitespace-pre-wrap break-all ${r.kind === 'del' || r.kind === 'change' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'} ${!r.left ? 'bg-slate-100/60 dark:bg-white/[0.015]' : ''}`}>{r.left?.text ?? ''}</td>
                          <td className={`border-x border-slate-200 pr-2 text-right align-top text-slate-400 select-none dark:border-white/5 dark:text-slate-600 ${r.kind === 'add' || r.kind === 'change' ? 'bg-emerald-500/10' : ''}`}>{r.right?.n ?? ''}</td>
                          <td className={`px-3 align-top whitespace-pre-wrap break-all ${r.kind === 'add' || r.kind === 'change' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'} ${!r.right ? 'bg-slate-100/60 dark:bg-white/[0.015]' : ''}`}>{r.right?.text ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'code' && (result.refactoredCode ? <CodeView lines={result.refactoredCode.split(/\r?\n/)} /> : <Notice text={t.noRefactor} />)}
          </div>
        </>
      )}
    </Modal>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-slate-500"><div className="max-w-md">{text}</div></div>;
}

function CodeView({ lines, focus, marks }: { lines: string[]; focus?: number | null; marks?: Map<number, string> }) {
  return (
    <div className="h-full overflow-auto border-l border-slate-200 bg-slate-50/60 py-2 dark:border-white/[0.06] dark:bg-black/20">
      <pre className="code-area">
        {lines.map((l, i) => {
          const n = i + 1;
          const m = marks?.get(n);
          return (
            <div
              key={i}
              ref={focus === n ? (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' }) : undefined}
              className={`flex pr-4 ${focus === n ? 'bg-cyan-500/20' : m ? (m === 'CRITICAL' || m === 'HIGH' ? 'bg-red-500/10' : 'bg-amber-500/10') : ''}`}
            >
              <span className="w-12 shrink-0 pr-3 text-right text-slate-400 select-none dark:text-slate-600">{n}</span>
              <span className="whitespace-pre text-slate-700 dark:text-slate-300">{l || ' '}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
