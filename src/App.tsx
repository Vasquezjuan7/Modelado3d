import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CityScene from './scene/CityScene';
import type { CameraCommand } from './scene/CityScene';
import type { ColorMode } from './scene/CityMeshes';
import type { TrafficMode, TrafficStats } from './scene/Traffic';
import { Landing } from './ui/Landing';
import { Dock, LoadingOverlay, SearchPalette, TopBar } from './ui/Chrome';
import { EmptyInspector, Inspector, Sidebar } from './ui/Panels';
import { AuditModal } from './ui/AuditModal';
import { GITHUB_TOKEN_KEY, SettingsModal } from './ui/SettingsModal';
import { AuthModal, HistoryModal, ReportModal } from './ui/Dialogs';
import { DICTS } from './lib/i18n';
import { buildCity, DISTRICTS } from './lib/cityLayout';
import type { DistrictKey } from './lib/cityLayout';
import { analyzeSource, buildDependencyGraph } from './lib/codeMetrics';
import { desktop, fileWebUrl, isDesktop, loadLocalFolder, loadRepository, pushRecentRepo, syncRecentRepos } from './lib/repoLoader';
import type { LoadedRepo, LoadProgress } from './lib/repoLoader';
import { analyzeCodeLocally, auditFile, getStoredAIConfig, isAIReady, repoReport, saveStoredAIConfig } from './lib/aiEngine';
import type { AIConfig, AuditResult } from './lib/aiEngine';
import { checkInitialSession, fetchCloudSettings, logoutUser, onCloudAuthChange, saveAuditRecord, saveCloudSettings } from './supabaseClient';
import type { UserProfile } from './supabaseClient';

type AuditState = { path: string; loading: boolean; result: AuditResult | null; error: string | null; forceLocal: boolean };

const pref = <T extends string>(key: string, fallback: T): T => (localStorage.getItem(key) as T) || fallback;

export default function App() {
  const [lang, setLang] = useState<'es' | 'en'>(() => pref('codecity_lang', 'es'));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => pref('codecity_theme', 'dark'));
  const t = DICTS[lang];
  const dark = theme === 'dark';

  const [aiConfig, setAiConfig] = useState<AIConfig>(getStoredAIConfig);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [repo, setRepo] = useState<LoadedRepo | null>(null);
  const [loading, setLoading] = useState<{ target: string; progress: LoadProgress } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<DistrictKey | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('district');
  const [showLabels, setShowLabels] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [quality, setQuality] = useState<'high' | 'low'>(() => pref('codecity_quality', 'high'));
  const [traffic, setTraffic] = useState<TrafficMode>('live');
  const [trafficStats, setTrafficStats] = useState<TrafficStats | null>(null);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recentsVersion, setRecentsVersion] = useState(0);
  const [cloudReady, setCloudReady] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [report, setReport] = useState<{ loading: boolean; markdown?: string; model?: string; error?: string } | null>(null);
  const auditAbort = useRef<AbortController | null>(null);

  // ----- preferences -----
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('codecity_theme', theme);
  }, [theme, dark]);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('codecity_lang', lang);
  }, [lang]);
  useEffect(() => localStorage.setItem('codecity_quality', quality), [quality]);
  useEffect(() => {
    checkInitialSession().then(setUser);
    return onCloudAuthChange((u) => setUser((prev) => (u ? (prev?.id === u.id ? prev : u) : prev && !prev.isLocalGuest ? null : prev)));
  }, []);

  // ----- cloud sync (Supabase): ajustes + repos recientes -----
  const cloudUserId = user && !user.isLocalGuest ? user.id : null;
  useEffect(() => {
    setCloudReady(false);
    if (!cloudUserId) return;
    let cancelled = false;
    (async () => {
      const remote = await fetchCloudSettings();
      if (cancelled) return;
      if (remote) {
        setTheme(remote.theme);
        setLang(remote.lang);
        setQuality(remote.quality);
      }
      setCloudReady(true);
      const merged = await syncRecentRepos();
      if (!cancelled && merged) setRecentsVersion((v) => v + 1);
    })();
    return () => { cancelled = true; };
  }, [cloudUserId]);
  useEffect(() => {
    if (!cloudReady) return;
    const id = setTimeout(() => void saveCloudSettings({ theme, lang, quality }), 600);
    return () => clearTimeout(id);
  }, [cloudReady, theme, lang, quality]);

  // ----- derived city data -----
  const city = useMemo(() => (repo ? buildCity(repo.files) : null), [repo]);
  const fileByPath = useMemo(() => new Map((repo?.files || []).map((f) => [f.path, f])), [repo]);
  const localResults = useMemo(() => {
    const m = new Map<string, AuditResult>();
    repo?.files.forEach((f) => {
      if (f.content) m.set(f.path, analyzeCodeLocally(f.content, f.name));
    });
    return m;
  }, [repo]);
  const riskByPath = useMemo(() => new Map([...localResults].map(([p, r]) => [p, r.score])), [localResults]);
  const languageByPath = useMemo(() => new Map((repo?.files || []).map((f) => [f.path, f.language])), [repo]);
  const risky = useMemo(
    () =>
      [...localResults]
        .filter(([, r]) => r.issues.some((i) => i.severity !== 'LOW'))
        .map(([path, r]) => ({ path, score: r.score, critical: r.issues.filter((i) => i.severity === 'CRITICAL').length, high: r.issues.filter((i) => i.severity === 'HIGH').length, total: r.issues.length }))
        .sort((a, b) => a.score - b.score),
    [localResults],
  );
  const hotPaths = useMemo(() => new Set([...localResults].filter(([, r]) => r.issues.some((i) => i.type === 'performance')).map(([p]) => p)), [localResults]);
  const highlight = useMemo(() => (city && activeDistrict ? new Set(city.buildings.filter((b) => b.district === activeDistrict).map((b) => b.path)) : null), [city, activeDistrict]);
  const depsOf = useMemo(() => {
    const out = new Map<string, string[]>();
    const inc = new Map<string, string[]>();
    repo?.edges.forEach((e) => {
      if (!out.has(e.from)) out.set(e.from, []);
      out.get(e.from)!.push(e.to);
      if (!inc.has(e.to)) inc.set(e.to, []);
      inc.get(e.to)!.push(e.from);
    });
    return { out, inc };
  }, [repo]);

  const notice = useMemo(() => {
    if (!repo) return null;
    const parts: string[] = [];
    if (repo.info.skippedFiles > 0 || repo.info.truncated) parts.push(t.truncatedWarn.replace('{n}', String(repo.files.length)));
    return parts.join(' ') || null;
  }, [repo, t]);

  // ----- loading -----
  const startLoad = useCallback(async (input: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadError(null);
    setLoading({ target: input, progress: { phase: isDesktop ? 'clone' : 'resolve', message: '…' } });
    try {
      const loaded = await loadRepository(input, {
        githubToken: localStorage.getItem(GITHUB_TOKEN_KEY) || undefined,
        signal: ctrl.signal,
        onProgress: (p) => setLoading((l) => (l ? { ...l, progress: p } : l)),
      });
      if (ctrl.signal.aborted) return;
      applyLoaded(loaded, input);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setLoadError((e as Error).message || String(e));
    } finally {
      if (abortRef.current === ctrl) setLoading(null);
    }
  }, []);

  const openFolder = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading({ target: '…', progress: { phase: 'scan', message: '…' } });
      const loaded = await loadLocalFolder((p) => setLoading((l) => (l ? { ...l, progress: p } : l)));
      if (loaded) applyLoaded(loaded, loaded.info.localDir || loaded.info.slug);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, []);

  function applyLoaded(loaded: LoadedRepo, input: string) {
    setRepo(loaded);
    setSelectedPath(null);
    setHoveredPath(null);
    setActiveDistrict(null);
    setTraffic('live');
    setColorMode('district');
    setReport(null);
    if (loaded.info.source !== 'local') pushRecentRepo({ input, name: loaded.info.displayName, files: loaded.files.length, at: Date.now() });
  }

  const goHome = () => {
    setRepo(null);
    setSelectedPath(null);
    setAudit(null);
    setReport(null);
  };

  // ----- selection & camera -----
  const pick = useCallback((path: string | null, fly = false) => {
    setSelectedPath(path);
    if (path && fly) setCameraCommand({ kind: 'focus', path, nonce: Date.now() });
  }, []);

  const onDistrict = (d: DistrictKey | null) => {
    setActiveDistrict(d);
    if (d) setCameraCommand({ kind: 'district', key: d, nonce: Date.now() });
    else setCameraCommand({ kind: 'preset', preset: 'iso', nonce: Date.now() });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && repo) {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && !audit && !showSettings && !showSearch && !report && !showAuth) setSelectedPath(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [repo, audit, showSettings, showSearch, report, showAuth]);

  // ----- AI audit -----
  const runAudit = useCallback(async (path: string, forceLocal = false) => {
    const file = fileByPath.get(path);
    if (!file?.content) return;
    auditAbort.current?.abort();
    const ctrl = new AbortController();
    auditAbort.current = ctrl;
    setAudit({ path, loading: true, result: null, error: null, forceLocal });
    try {
      const cfg: AIConfig = forceLocal ? { ...aiConfig, provider: 'local' } : aiConfig;
      const context = repo
        ? `${repo.info.displayName}${repo.info.description ? ` — ${repo.info.description}` : ''}. Imports locales de este archivo: ${(depsOf.out.get(path) || []).slice(0, 15).join(', ') || 'ninguno'}.`
        : undefined;
      const result = await auditFile(file.content, file.name, file.path, cfg, { lang, context, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setAudit({ path, loading: false, result, error: null, forceLocal });
      void saveAuditRecord({
        repoName: repo?.info.displayName,
        filePath: file.path,
        language: file.language,
        provider: result.provider,
        modelName: result.modelName,
        severity: result.severity,
        score: result.score,
        issuesCount: result.issues.length,
        criticalCount: result.issues.filter((i) => i.severity === 'CRITICAL').length,
        highCount: result.issues.filter((i) => i.severity === 'HIGH').length,
        summary: result.summary,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setAudit({ path, loading: false, result: null, error: (e as Error).message, forceLocal });
    }
  }, [fileByPath, aiConfig, repo, depsOf, lang]);

  const applyRefactor = async (path: string, code: string) => {
    const file = fileByPath.get(path);
    if (!file?.absPath || !desktop) throw new Error('Solo disponible en la app de escritorio.');
    await desktop.writeFile(file.absPath, code);
    setRepo((r) => {
      if (!r) return r;
      const files = r.files.map((f) => (f.path === path ? { ...analyzeSource(f.path, new Blob([code]).size, code), absPath: f.absPath } : f));
      return { ...r, files, edges: buildDependencyGraph(files) };
    });
  };

  // ----- repository report -----
  const runReport = useCallback(async () => {
    if (!repo || !city) return;
    if (!isAIReady(aiConfig)) {
      setReport({ loading: false, error: t.needAI });
      return;
    }
    setReport({ loading: true });
    const byLang = new Map<string, number>();
    repo.files.forEach((f) => byLang.set(f.language, (byLang.get(f.language) || 0) + f.lines));
    const inDeg = [...depsOf.inc].map(([p, l]) => [p, l.length] as const).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const digest = [
      `Repositorio: ${repo.info.displayName}${repo.info.description ? ` — ${repo.info.description}` : ''}`,
      `Archivos analizados: ${repo.files.length}; líneas: ${repo.files.reduce((s, f) => s + f.lines, 0)}; dependencias internas: ${repo.edges.length}`,
      `Lenguajes (líneas): ${[...byLang].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, n]) => `${l} ${n}`).join(', ')}`,
      `Distritos: ${city.districts.map((d) => `${DISTRICTS[d.key].role.es} ${d.count} archivos`).join('; ')}`,
      `Archivos más grandes:\n${[...repo.files].sort((a, b) => b.lines - a.lines).slice(0, 25).map((f) => `- ${f.path} (${f.lines} líneas, ${f.functions} funciones)`).join('\n')}`,
      `Más importados:\n${inDeg.map(([p, n]) => `- ${p} (importado por ${n})`).join('\n') || '- (sin datos)'}`,
      `Hallazgos del escáner estático:\n${risky.slice(0, 15).map((r) => `- ${r.path} (puntuación ${r.score}): ${localResults.get(r.path)!.issues.slice(0, 4).map((i) => `${i.title} L${i.line}`).join('; ')}`).join('\n') || '- ninguno'}`,
      `Estructura (rutas):\n${repo.files.slice(0, 250).map((f) => f.path).sort().join('\n')}`,
    ].join('\n\n');
    try {
      const r = await repoReport(digest, aiConfig, lang);
      setReport({ loading: false, markdown: r.markdown, model: r.model });
    } catch (e) {
      setReport({ loading: false, error: (e as Error).message });
    }
  }, [repo, city, aiConfig, depsOf, risky, localResults, lang, t]);

  const selectedFile = selectedPath ? fileByPath.get(selectedPath) : undefined;
  const selectedBuilding = selectedPath && city ? city.byPath.get(selectedPath) : undefined;
  const auditFileObj = audit ? fileByPath.get(audit.path) : undefined;

  const topBar = (
    <TopBar
      t={t}
      info={repo?.info ?? null}
      aiConfig={aiConfig}
      user={user}
      dark={dark}
      lang={lang}
      onBack={goHome}
      onSearch={() => setShowSearch(true)}
      onReport={runReport}
      onSettings={() => setShowSettings(true)}
      onAuth={() => setShowAuth(true)}
      onHistory={() => setShowHistory(true)}
      onLogout={async () => { await logoutUser(); setUser(null); }}
      onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
      onToggleLang={() => setLang(lang === 'es' ? 'en' : 'es')}
    />
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e9eef5] text-slate-900 dark:bg-ink-950 dark:text-slate-100">
      {!repo || !city ? (
        <>
          <Landing t={t} lang={lang} dark={dark} error={loadError} recentsVersion={recentsVersion} onSubmit={startLoad} onOpenFolder={openFolder} onDismissError={() => setLoadError(null)} />
          {topBar}
        </>
      ) : (
        <>
          <div className="absolute inset-0">
            <CityScene
              city={city}
              edges={repo.edges}
              dark={dark}
              lang={lang}
              colorMode={colorMode}
              riskByPath={riskByPath}
              languageByPath={languageByPath}
              selectedPath={selectedPath}
              hoveredPath={hoveredPath}
              highlight={highlight}
              activeDistrict={activeDistrict}
              showLabels={showLabels}
              showArcs={showArcs}
              traffic={traffic}
              hotPaths={hotPaths}
              cameraCommand={cameraCommand}
              autoRotate={autoRotate}
              quality={quality}
              onSelect={(p) => pick(p)}
              onHover={setHoveredPath}
              onTrafficStats={setTrafficStats}
            />
          </div>
          {topBar}

          <div className="pointer-events-none absolute inset-x-3 top-[68px] bottom-3 z-20 flex gap-3">
            <Sidebar
              t={t}
              lang={lang}
              files={repo.files}
              city={city}
              edgesCount={repo.edges.length}
              activeDistrict={activeDistrict}
              onDistrict={onDistrict}
              colorMode={colorMode}
              setColorMode={setColorMode}
              risky={risky}
              onPick={(p) => pick(p, true)}
              traffic={traffic}
              setTraffic={setTraffic}
              trafficStats={trafficStats}
              notice={notice}
            />
            <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              {!selectedFile && <EmptyInspector t={t} />}
              <Dock
                t={t}
                onPreset={(p) => setCameraCommand({ kind: 'preset', preset: p, nonce: Date.now() })}
                showLabels={showLabels}
                setShowLabels={setShowLabels}
                showArcs={showArcs}
                setShowArcs={setShowArcs}
                autoRotate={autoRotate}
                setAutoRotate={setAutoRotate}
                quality={quality}
                setQuality={setQuality}
              />
            </div>
            {selectedFile && selectedBuilding && (
              <Inspector
                key={selectedFile.path}
                t={t}
                lang={lang}
                file={selectedFile}
                building={selectedBuilding}
                local={localResults.get(selectedFile.path) || null}
                imports={depsOf.out.get(selectedFile.path) || []}
                importedBy={depsOf.inc.get(selectedFile.path) || []}
                aiReady={isAIReady(aiConfig)}
                webUrl={fileWebUrl(repo.info, selectedFile.path)}
                canOpenLocal={Boolean(isDesktop && selectedFile.absPath)}
                onAudit={() => runAudit(selectedFile.path)}
                onFocus={() => setCameraCommand({ kind: 'focus', path: selectedFile.path, nonce: Date.now() })}
                onClose={() => setSelectedPath(null)}
                onPick={(p) => pick(p, true)}
                onOpenLocal={() => selectedFile.absPath && desktop?.openPath(selectedFile.absPath)}
              />
            )}
          </div>
        </>
      )}

      {loading && <LoadingOverlay t={t} progress={loading.progress} target={loading.target} onCancel={() => { abortRef.current?.abort(); setLoading(null); }} />}
      {showSearch && city && <SearchPalette t={t} city={city} onClose={() => setShowSearch(false)} onPick={(p) => { setShowSearch(false); pick(p, true); }} />}
      {showSettings && <SettingsModal t={t} config={aiConfig} onClose={() => setShowSettings(false)} onSave={(c) => { setAiConfig(c); saveStoredAIConfig(c); }} />}
      {showHistory && user && !user.isLocalGuest && (
        <HistoryModal
          t={t}
          lang={lang}
          currentRepo={repo?.info.displayName ?? null}
          onClose={() => setShowHistory(false)}
          onOpen={(path) => { if (fileByPath.has(path)) { setShowHistory(false); pick(path, true); } }}
          canOpen={(repoName, path) => Boolean(repo && repoName === repo.info.displayName && fileByPath.has(path))}
        />
      )}
      {showAuth && <AuthModal t={t} onClose={() => setShowAuth(false)} onAuthed={(u) => { setUser(u); setShowAuth(false); }} />}
      {report && repo && (
        <ReportModal t={t} repoName={repo.info.displayName} state={report} onClose={() => setReport(null)} onSettings={() => { setReport(null); setShowSettings(true); }} onRetry={runReport} />
      )}
      {audit && auditFileObj && (
        <AuditModal
          key={audit.path + (audit.result?.durationMs ?? '')}
          t={t}
          fileName={auditFileObj.name}
          filePath={auditFileObj.path}
          original={auditFileObj.content || ''}
          result={audit.result}
          loading={audit.loading}
          error={audit.error}
          canApply={Boolean(isDesktop && auditFileObj.absPath)}
          onClose={() => { auditAbort.current?.abort(); setAudit(null); }}
          onRetry={() => runAudit(audit.path, audit.forceLocal)}
          onUseLocal={() => runAudit(audit.path, true)}
          onOpenSettings={() => { setAudit(null); setShowSettings(true); }}
          onApply={(code) => applyRefactor(audit.path, code)}
        />
      )}
    </div>
  );
}
