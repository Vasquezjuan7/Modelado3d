import { useState } from 'react';
import { AlertTriangle, Check, Copy, FileText, Loader2, LogIn, UserPlus, Settings } from 'lucide-react';
import type { Dict } from '../lib/i18n';
import { Modal, ModalHeader } from './Chrome';
import { isSupabaseConfigured, loginUser, registerUser } from '../supabaseClient';
import type { UserProfile } from '../supabaseClient';

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === 'login' ? await loginUser(email, password) : await registerUser(email, password, name, role);
    setBusy(false);
    if (r.error || !r.user) setError(r.error || 'Error');
    else onAuthed(r.user);
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
