import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, FileText, History, Loader2, LogIn, MapPin, Trash2, UserPlus, Settings } from 'lucide-react';
import type { Dict } from '../lib/i18n';
import { Modal, ModalHeader } from './Chrome';
import { deleteAuditRecord, fetchAuditHistory, isSupabaseConfigured, loginUser, registerUser } from '../supabaseClient';
import type { AuditRecord, UserProfile } from '../supabaseClient';

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
const ROLES = ['Arquitecto de Software', 'Full-Stack', 'Frontend', 'Backend', 'DevOps', 'Tech Lead', 'QA / Auditor', 'Estudiante'];

export function AuthModal({ t, onClose, onAuthed }: { t: Dict; onClose: () => void; onAuthed: (u: UserProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = mode === 'login' ? await loginUser(email, password) : await registerUser(email, password, name, role);
    setBusy(false);
    if (r.user) onAuthed(r.user);
    else if (r.notice) {
      setNotice(r.notice);
      setMode('login');
      setPassword('');
    } else setError(r.error || 'Error');
  };

  return (
    <Modal onClose={onClose} width="w-[420px]">
      <ModalHeader icon={mode === 'login' ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />} title={mode === 'login' ? t.login : t.register} subtitle={isSupabaseConfigured() ? t.cloudAccount : t.localAccount} onClose={onClose} />
      <form onSubmit={submit} className="space-y-3 p-5">
        <div className="seg mb-2 w-full">
          <button type="button" onClick={() => setMode('login')} className={`seg-item flex-1 ${mode === 'login' ? 'seg-item-active' : ''}`}>{t.login}</button>
          <button type="button" onClick={() => setMode('register')} className={`seg-item flex-1 ${mode === 'register' ? 'seg-item-active' : ''}`}>{t.register}</button>
        </div>
        {mode === 'register' && (
          <>
            <input className="input" placeholder={t.fullName} value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </>
        )}
        <input className="input" type="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input className="input" type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} />
        {notice && <div className="flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300"><Check className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
        {error && <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <button className="btn btn-primary w-full py-2.5" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'login' ? t.login : t.register}
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------
// AI report (minimal, safe markdown renderer — no innerHTML)
// ---------------------------------------------------------------
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith('**') ? <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong> : <code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const ul = l.match(/^\s*[-*]\s+(.*)/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul || ol)![1]);
      continue;
    }
    flush();
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) blocks.push(h[1].length <= 2 ? <h2 key={blocks.length}>{inline(h[2], `h${blocks.length}`)}</h2> : <h3 key={blocks.length}>{inline(h[2], `h${blocks.length}`)}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(l, `p${blocks.length}`)}</p>);
  }
  flush();
  return <div className="md text-[13px] text-slate-700 dark:text-slate-300">{blocks}</div>;
}

export function ReportModal({
  t, repoName, state, onClose, onSettings, onRetry,
}: {
  t: Dict;
  repoName: string;
  state: { loading: boolean; markdown?: string; model?: string; error?: string };
  onClose: () => void;
  onSettings: () => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal onClose={onClose} width="w-[760px] h-[min(780px,90vh)]">
      <ModalHeader
        icon={<FileText className="h-5 w-5" />}
        title={t.reportTitle}
        subtitle={state.model ? `${repoName} · ${state.model}` : repoName}
        onClose={onClose}
        right={state.markdown ? (
          <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(state.markdown!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}{copied ? t.copied : t.copy}
          </button>
        ) : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {state.loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />{t.generating}
          </div>
        )}
        {!state.loading && state.error && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="max-w-md rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-[12.5px] text-red-600 dark:text-red-300">{state.error}</div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={onSettings}><Settings className="h-4 w-4" />{t.openSettings}</button>
              <button className="btn btn-primary" onClick={onRetry}>{t.retry}</button>
            </div>
          </div>
        )}
        {!state.loading && state.markdown && <Markdown text={state.markdown} />}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------
// Audit history (Supabase)
// ---------------------------------------------------------------
function scoreTone(score: number | null) {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function HistoryModal({
  t, lang, currentRepo, onClose, onOpen, canOpen,
}: {
  t: Dict;
  lang: 'es' | 'en';
  currentRepo: string | null;
  onClose: () => void;
  onOpen: (path: string) => void;
  canOpen: (repoName: string | null, path: string) => boolean;
}) {
  const [items, setItems] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditHistory().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  const remove = async (id: string) => {
    try {
      await deleteAuditRecord(id);
      setItems((l) => (l ? l.filter((x) => x.id !== id) : l));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Modal onClose={onClose} width="w-[720px] h-[min(720px,90vh)]">
      <ModalHeader icon={<History className="h-5 w-5" />} title={t.history} subtitle={t.historyHint} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {error && <div className="mb-3 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {!items && !error && (
          <div className="flex h-full items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" />{t.loadingHistory}</div>
        )}
        {items && items.length === 0 && <div className="flex h-full items-center justify-center text-[13px] text-slate-500">{t.emptyHistory}</div>}
        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className={`panel flex items-start gap-3 rounded-xl px-3 py-2.5 ${a.repoName && a.repoName === currentRepo ? 'ring-1 ring-cyan-500/30' : ''}`}>
                <div className={`w-11 shrink-0 text-center font-mono text-[18px] font-bold ${scoreTone(a.score)}`}>{a.score ?? '–'}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12.5px] text-slate-800 dark:text-slate-100" title={a.filePath}>{a.filePath}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {[a.repoName, fmt.format(new Date(a.createdAt)), a.modelName || a.provider, `${a.issuesCount} ${t.issuesShort}${a.criticalCount ? ` · ${a.criticalCount} CRITICAL` : ''}${a.highCount ? ` · ${a.highCount} HIGH` : ''}`].filter(Boolean).join(' · ')}
                  </div>
                  {a.summary && <div className="mt-1 line-clamp-2 text-[12px] text-slate-600 dark:text-slate-400">{a.summary}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {canOpen(a.repoName, a.filePath) && (
                    <button className="btn-icon btn" title={t.openInCity} onClick={() => onOpen(a.filePath)}><MapPin className="h-4 w-4" /></button>
                  )}
                  <button className="btn-icon btn hover:text-red-500" title={t.deleteEntry} onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
