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

