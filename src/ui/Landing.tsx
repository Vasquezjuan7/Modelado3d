import { useMemo, useState } from 'react';
import { ArrowRight, Boxes, Clock, FolderOpen, GitBranch, Monitor, Network, ShieldCheck, Sparkles, X, AlertTriangle, Globe } from 'lucide-react';
import CityScene from '../scene/CityScene';
import { buildCity } from '../lib/cityLayout';
import { analyzeSource } from '../lib/codeMetrics';
import type { Dict } from '../lib/i18n';
import { getRecentRepos, isDesktop, removeRecentRepo } from '../lib/repoLoader';

const EXAMPLES = ['expressjs/express', 'pmndrs/zustand', 'pallets/flask', 'gin-gonic/gin'];

/** Purely decorative backdrop city (not tied to any repository) */
function useBackdropCity() {
  return useMemo(() => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinds = ['src/core/x.ts', 'src/components/x.tsx', 'db/models/x.py', 'config/x.yaml', 'tests/x.test.ts', 'styles/x.css', 'docs/x.md'];
    const files = Array.from({ length: 150 }, (_, i) => {
      const k = kinds[Math.floor(Math.pow(rnd(), 1.6) * kinds.length)].replace('x', `f${i}`);
      const lines = Math.round(20 + Math.pow(rnd(), 3) * 1600);
      const f = analyzeSource(k, lines * 32);
      return { ...f, lines, functions: Math.round(lines / 18) };
    });
    return buildCity(files);
  }, []);
}

export function Landing({
  t, lang, dark, error, onSubmit, onOpenFolder, onDismissError,
}: {
  t: Dict;
  lang: 'es' | 'en';
  dark: boolean;
  error: string | null;
  onSubmit: (input: string) => void;
  onOpenFolder: () => void;
  onDismissError: () => void;
}) {
  const [value, setValue] = useState('');
  const [recents, setRecents] = useState(getRecentRepos());
  const city = useBackdropCity();
  const empty = useMemo(() => new Map<string, number>(), []);
  const emptyS = useMemo(() => new Map<string, string>(), []);
  const emptySet = useMemo(() => new Set<string>(), []);

  const submit = (v?: string) => {
    const input = (v ?? value).trim();
    if (input) onSubmit(input);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* decorative city */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <CityScene
          city={city} edges={[]} dark={dark} lang={lang} colorMode="district" riskByPath={empty} languageByPath={emptyS}
          selectedPath={null} hoveredPath={null} highlight={null} activeDistrict={null} showLabels={false} showArcs={false}
          traffic="live" hotPaths={emptySet} cameraCommand={null} autoRotate quality="high"
          onSelect={() => {}} onHover={() => {}} onTrafficStats={() => {}}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(233,238,245,0.55)_0%,rgba(233,238,245,0.92)_55%,#e9eef5_100%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(5,7,13,0.45)_0%,rgba(5,7,13,0.9)_55%,#05070d_100%)]" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-10">
        <div className="animate-rise flex w-full max-w-3xl flex-col items-center text-center">
          <span className="chip mb-6 border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
            {isDesktop ? <Monitor className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {isDesktop ? t.desktopBadge : t.webBadge} · {t.tagline}
          </span>
          <h1 className="font-display text-4xl leading-[1.08] font-semibold tracking-tight text-slate-900 md:text-[56px] dark:text-white">
            {t.heroTitle1}
            <br />
            <span className="text-gradient">{t.heroTitle2}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{t.heroSub}</p>

          <form
            className="panel mt-9 flex w-full items-center gap-2 p-2 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <GitBranch className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t.inputPlaceholder}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            <button type="submit" disabled={!value.trim()} className="btn btn-primary px-5 py-2.5">
              {t.analyze} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {error && (
            <div className="animate-fade-in mt-4 flex w-full items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-[13px] text-red-700 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={onDismissError} className="cursor-pointer opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <span className="text-slate-500">{t.tryExample}</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setValue(ex); submit(ex); }} className="btn-ghost btn rounded-full px-3 py-1 font-mono text-[11.5px]">
                {ex}
              </button>
            ))}
            {isDesktop && (
              <button onClick={onOpenFolder} className="btn btn-ghost rounded-full px-3 py-1 text-[11.5px]">
                <FolderOpen className="h-3.5 w-3.5" /> {t.openFolder}
              </button>
            )}
          </div>

          {recents.length > 0 && (
            <div className="mt-8 w-full">
              <div className="label-xs mb-2 flex items-center justify-center gap-1.5"><Clock className="h-3 w-3" /> {t.recent}</div>
              <div className="flex flex-wrap justify-center gap-2">
                {recents.map((r) => (
                  <div key={r.name} className="group panel flex items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3 text-[12px]">
                    <button className="cursor-pointer font-mono text-slate-700 hover:text-cyan-600 dark:text-slate-200 dark:hover:text-cyan-300" onClick={() => submit(r.input)}>
                      {r.name}
                    </button>
                    <span className="text-[10.5px] text-slate-400">{r.files} {t.files.toLowerCase()}</span>
                    <button
                      className="cursor-pointer rounded-md p-0.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      onClick={() => { removeRecentRepo(r.name); setRecents(getRecentRepos()); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 grid w-full grid-cols-1 gap-3 text-left md:grid-cols-3">
            {[
              { icon: Boxes, title: t.feat1, desc: t.feat1d, color: 'text-cyan-500' },
              { icon: ShieldCheck, title: t.feat2, desc: t.feat2d, color: 'text-indigo-400' },
              { icon: Network, title: t.feat3, desc: t.feat3d, color: 'text-pink-400' },
            ].map((f) => (
              <div key={f.title} className="panel p-4">
                <f.icon className={`h-5 w-5 ${f.color}`} />
                <div className="mt-3 text-[13.5px] font-semibold text-slate-900 dark:text-white">{f.title}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="h-3 w-3" /> CodeCity Nexus 3D
          </div>
        </div>
      </div>
    </div>
  );
}
