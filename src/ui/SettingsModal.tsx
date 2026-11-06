import { useState } from 'react';
import { Check, Copy, Cpu, Database, Eye, EyeOff, GitBranch as Github, Loader2, Plug, Settings, Sparkles, XCircle, Bot, ShieldCheck } from 'lucide-react';
import type { Dict } from '../lib/i18n';
import type { AIConfig, AIProvider, GeminiModelInfo } from '../lib/aiEngine';
import { DEFAULT_GEMINI_MODEL, listGeminiModels, testGeminiKey, testOpenAIKey } from '../lib/aiEngine';
import { Modal, ModalHeader } from './Chrome';
import { getSupabaseConfig, initSupabaseClient, isSupabaseConfigured, SUPABASE_SCHEMA_SQL } from '../supabaseClient';

export const GITHUB_TOKEN_KEY = 'codecity_github_token';

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off" className="input pr-10 font-mono" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function SettingsModal({ t, config, onSave, onClose }: { t: Dict; config: AIConfig; onSave: (c: AIConfig) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'ai' | 'github' | 'cloud'>('ai');
  const [draft, setDraft] = useState<AIConfig>(config);
  const [models, setModels] = useState<GeminiModelInfo[]>([]);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ state: 'idle' });
  const [ghToken, setGhToken] = useState(localStorage.getItem(GITHUB_TOKEN_KEY) || '');
  const [supaUrl, setSupaUrl] = useState(getSupabaseConfig().url);
  const [supaKey, setSupaKey] = useState(getSupabaseConfig().anonKey);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<AIConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setTest({ state: 'idle' });
  };

  const runTest = async () => {
    setTest({ state: 'busy' });
    try {
      if (draft.provider === 'gemini') {
        const list = await listGeminiModels(draft.geminiKey);
        setModels(list);
        let model = draft.geminiModel;
        if (list.length && !list.some((m) => m.id === model)) model = list.find((m) => m.id === DEFAULT_GEMINI_MODEL)?.id || list[0].id;
        const r = await testGeminiKey(draft.geminiKey, model);
        // if Google redirected us to a newer model, keep that one
        setDraft((d) => ({ ...d, geminiModel: r.model }));
        setTest({ state: 'ok', msg: `${t.connOk} · ${r.model} · ${r.ms} ms · “${r.reply.slice(0, 40)}” · ${list.length} ${t.modelsFound}${r.note ? ` · ${r.note}` : ''}` });
      } else if (draft.provider === 'openai') {
        const r = await testOpenAIKey(draft.openaiKey, draft.openaiModel);
        setTest({ state: 'ok', msg: `${t.connOk} · ${draft.openaiModel} · ${r.ms} ms` });
      }
    } catch (e) {
      setTest({ state: 'err', msg: (e as Error).message });
    }
  };

  const save = () => {
    onSave(draft);
    if (ghToken.trim()) localStorage.setItem(GITHUB_TOKEN_KEY, ghToken.trim());
    else localStorage.removeItem(GITHUB_TOKEN_KEY);
    if (supaUrl.trim() !== getSupabaseConfig().url || supaKey.trim() !== getSupabaseConfig().anonKey) {
      initSupabaseClient({ url: supaUrl.trim(), anonKey: supaKey.trim() });
    }
    setSaved(true);
    setTimeout(() => onClose(), 600);
  };

  const providers: Array<{ id: AIProvider; name: string; desc: string; icon: React.ReactNode }> = [
    { id: 'gemini', name: 'Google Gemini', desc: t.geminiDesc, icon: <Sparkles className="h-4 w-4 text-sky-400" /> },
    { id: 'openai', name: 'OpenAI', desc: t.openaiDesc, icon: <Bot className="h-4 w-4 text-emerald-400" /> },
    { id: 'local', name: t.aiLocal, desc: t.localDesc, icon: <ShieldCheck className="h-4 w-4 text-slate-400" /> },
  ];

  return (
    <Modal onClose={onClose} width="w-[640px]">
      <ModalHeader icon={<Settings className="h-5 w-5" />} title={t.settings} onClose={onClose} />
      <div className="flex gap-1 border-b border-slate-200 px-5 pt-1 dark:border-white/[0.07]">
        {([['ai', t.aiTab, Cpu], ['github', t.githubTab, Github], ['cloud', t.cloudTab, Database]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition ${tab === id ? 'border-cyan-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {tab === 'ai' && (
          <>
            <div>
              <div className="label-xs mb-2">{t.provider}</div>
              <div className="grid grid-cols-3 gap-2">
                {providers.map((p) => (
                  <button key={p.id} onClick={() => set({ provider: p.id })} className={`cursor-pointer rounded-xl border p-3 text-left transition ${draft.provider === p.id ? 'border-cyan-500/60 bg-cyan-500/[0.07] ring-4 ring-cyan-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/20'}`}>
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">{p.icon}{p.name}</div>
                    <div className="mt-1 text-[11px] leading-snug text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {draft.provider === 'gemini' && (
              <>
                <div>
                  <div className="label-xs mb-2">{t.apiKey}</div>
                  <SecretInput value={draft.geminiKey} onChange={(v) => set({ geminiKey: v })} placeholder="AIza… / AQ.…" />
                  <div className="mt-1.5 text-[11.5px] text-slate-500">
                    {t.getKey} <a className="text-cyan-600 hover:underline dark:text-cyan-400" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>
                  </div>
                </div>
                <div>
                  <div className="label-xs mb-2">{t.model}</div>
                  {models.length > 0 ? (
                    <select value={draft.geminiModel} onChange={(e) => set({ geminiModel: e.target.value })} className="input font-mono">
                      {models.map((m) => <option key={m.id} value={m.id}>{m.id}{m.displayName && m.displayName !== m.id ? ` — ${m.displayName}` : ''}</option>)}
                    </select>
                  ) : (
                    <input value={draft.geminiModel} onChange={(e) => set({ geminiModel: e.target.value })} className="input font-mono" placeholder={DEFAULT_GEMINI_MODEL} />
                  )}
                </div>
              </>
            )}

            {draft.provider === 'openai' && (
              <>
                <div>
                  <div className="label-xs mb-2">{t.apiKey}</div>
                  <SecretInput value={draft.openaiKey} onChange={(v) => set({ openaiKey: v })} placeholder="sk-…" />
                </div>
                <div>
                  <div className="label-xs mb-2">{t.model}</div>
                  <input value={draft.openaiModel} onChange={(e) => set({ openaiModel: e.target.value })} className="input font-mono" list="openai-models" />
                  <datalist id="openai-models">
                    {['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'].map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </>
            )}

            {draft.provider !== 'local' && (
              <div className="space-y-2">
                <button onClick={runTest} disabled={test.state === 'busy' || (draft.provider === 'gemini' ? !draft.geminiKey.trim() : !draft.openaiKey.trim())} className="btn btn-ghost w-full">
                  {test.state === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  {test.state === 'busy' ? t.testing : t.testConn}
                </button>
                {test.state === 'ok' && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300"><Check className="mt-0.5 h-4 w-4 shrink-0" />{test.msg}</div>}
                {test.state === 'err' && <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{test.msg}</div>}
                <p className="text-[11px] leading-relaxed text-slate-500">{t.keyStored}</p>
              </div>
            )}
          </>
        )}

        {tab === 'github' && (
          <div>
            <div className="label-xs mb-2">{t.ghToken}</div>
            <SecretInput value={ghToken} onChange={setGhToken} placeholder="github_pat_… / ghp_…" />
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
              {t.ghTokenHint}{' '}
              <a className="text-cyan-600 hover:underline dark:text-cyan-400" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">github.com/settings/tokens</a>
            </p>
          </div>
        )}

        {tab === 'cloud' && (
          <>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${isSupabaseConfigured() ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'}`}>
              <Database className="h-4 w-4" />{isSupabaseConfigured() ? t.cloudAccount : t.localAccount}
            </div>
            <div>
              <div className="label-xs mb-2">{t.supaUrl}</div>
              <input value={supaUrl} onChange={(e) => setSupaUrl(e.target.value)} className="input font-mono" placeholder="https://xxxx.supabase.co" />
            </div>
            <div>
              <div className="label-xs mb-2">{t.supaKey}</div>
              <SecretInput value={supaKey} onChange={setSupaKey} placeholder="eyJhbGciOi… / sb_publishable_…" />
              <p className="mt-2 text-[11.5px] text-slate-500">{t.supaHint}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL); setSqlCopied(true); setTimeout(() => setSqlCopied(false), 1500); }}>
              {sqlCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}{sqlCopied ? t.copied : t.copySql}
            </button>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/[0.07]">
        <button className="btn btn-ghost" onClick={onClose}>{t.cancel}</button>
        <button className="btn btn-primary" onClick={save}>{saved ? <Check className="h-4 w-4" /> : null}{saved ? t.saved : t.save}</button>
      </div>
    </Modal>
  );
}
