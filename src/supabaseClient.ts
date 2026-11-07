import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
  createdAt?: string;
  isLocalGuest?: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface CloudSettings {
  theme: 'dark' | 'light';
  lang: 'es' | 'en';
  quality: 'high' | 'low';
}

export interface CloudRecent {
  input: string;
  name: string;
  files: number;
  at: number;
}

export interface AuditRecord {
  id: string;
  repoName: string | null;
  filePath: string;
  language: string | null;
  provider: string | null;
  modelName: string | null;
  severity: string | null;
  score: number | null;
  issuesCount: number;
  criticalCount: number;
  highCount: number;
  summary: string | null;
  createdAt: string;
}

const STORAGE_KEY_CONFIG = 'codecity_supabase_config';
const STORAGE_KEY_LOCAL_USER = 'codecity_auth_current_user';
const STORAGE_KEY_LOCAL_USERS_DB = 'codecity_auth_local_users_db';

// Proyecto Supabase oficial de CodeCity Nexus 3D. La clave publishable es pública por diseño
// (va en el cliente); la seguridad la garantizan las políticas RLS de cada tabla.
const BUILTIN_CONFIG: SupabaseConfig = {
  url: 'https://qzhzlvhaqgpqxccblzvj.supabase.co',
  anonKey: 'sb_publishable_ElZN8_0zvpwWFkTWYqvGfw_OVBy3YzS',
};

function getDefaultConfig(): SupabaseConfig {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) return parsed;
      }
    } catch {
      // ignore
    }
  }
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY };
  return { ...BUILTIN_CONFIG };
}

let activeConfig: SupabaseConfig = getDefaultConfig();
let supabaseInstance: SupabaseClient | null = null;
let cloudUserId: string | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  return { ...activeConfig };
}

export function getBuiltinSupabaseConfig(): SupabaseConfig {
  return { ...BUILTIN_CONFIG };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    activeConfig.url &&
    activeConfig.url.trim().startsWith('https://') &&
    activeConfig.anonKey &&
    activeConfig.anonKey.trim().length > 20
  );
}

export function initSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  if (config) {
    // Vaciar los campos = volver al proyecto integrado
    const useBuiltin = !config.url.trim() && !config.anonKey.trim();
    activeConfig = useBuiltin ? { ...BUILTIN_CONFIG } : config;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (useBuiltin) localStorage.removeItem(STORAGE_KEY_CONFIG);
        else localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      } catch {
        // ignore
      }
    }
  }

  cloudUserId = null;
  if (isSupabaseConfigured()) {
    try {
      supabaseInstance = createClient(activeConfig.url.trim(), activeConfig.anonKey.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('Error inicializando Supabase client:', err);
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
  return null;
}

initSupabaseClient();

// ----------------------------------------------------
// Local Users Database Helper (fallback sin Supabase)
// ----------------------------------------------------
function getLocalUsersDB(): Array<{ email: string; passwordHash: string; profile: UserProfile }> {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_USERS_DB);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsersDB(users: Array<{ email: string; passwordHash: string; profile: UserProfile }>) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_LOCAL_USERS_DB, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}`;
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado. Abre el enlace que te enviamos y vuelve a iniciar sesión.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con este correo. Inicia sesión.';
  if (m.includes('rate limit')) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  if (m.includes('password should be')) return 'La contraseña es demasiado débil (mínimo 6 caracteres).';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  return msg;
}

type SupaUser = { id: string; email?: string; created_at?: string; user_metadata?: Record<string, string> };

function profileFromUser(u: SupaUser, fallbackName?: string, fallbackRole?: string): UserProfile {
  const email = u.email || '';
  return {
    id: u.id,
    email,
    fullName: u.user_metadata?.full_name || fallbackName || email.split('@')[0] || 'Arquitecto',
    role: u.user_metadata?.role || fallbackRole || 'Arquitecto de Software',
    createdAt: u.created_at,
    isLocalGuest: false,
  };
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------
export type AuthResult = { user: UserProfile | null; error: string | null; notice?: string };

export async function registerUser(email: string, password: string, fullName: string, role = 'Arquitecto de Software'): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return { user: null, error: 'Por favor ingresa un correo electrónico válido.' };
  if (!password || password.length < 6) return { user: null, error: 'La contraseña debe tener al menos 6 caracteres.' };

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data, error } = await supabaseInstance.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: fullName.trim() || 'Arquitecto Nexus', role: role.trim() || 'Arquitecto de Software' } },
      });
      if (error) return { user: null, error: translateAuthError(error.message) };
      // Supabase devuelve un usuario sin identidades cuando el correo ya existía
      if (data.user && Array.isArray((data.user as { identities?: unknown[] }).identities) && (data.user as { identities: unknown[] }).identities.length === 0) {
        return { user: null, error: 'Ya existe una cuenta con este correo. Inicia sesión.' };
      }
      if (data.user && data.session) {
        const profile = profileFromUser(data.user as SupaUser, fullName.trim(), role.trim());
        cloudUserId = profile.id;
        saveCurrentSessionUser(profile);
        return { user: profile, error: null };
      }
      if (data.user) {
        return { user: null, error: null, notice: `Cuenta creada. Te enviamos un correo a ${cleanEmail}: abre el enlace de confirmación y luego inicia sesión aquí.` };
      }
    } catch (err) {
      return { user: null, error: translateAuthError(`Error conectando con Supabase: ${(err as Error).message}`) };
    }
  }

  const localDB = getLocalUsersDB();
  if (localDB.find((u) => u.email === cleanEmail)) return { user: null, error: 'Ya existe una cuenta registrada con este correo electrónico.' };
  const newProfile: UserProfile = {
    id: `local-usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: cleanEmail,
    fullName: fullName.trim() || 'Arquitecto Nexus',
    role: role.trim() || 'Arquitecto de Software',
    createdAt: new Date().toISOString(),
    isLocalGuest: true,
  };
  localDB.push({ email: cleanEmail, passwordHash: simpleHash(password), profile: newProfile });
  saveLocalUsersDB(localDB);
  saveCurrentSessionUser(newProfile);
  return { user: newProfile, error: null };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return { user: null, error: 'Ingresa un correo electrónico válido.' };
  if (!password) return { user: null, error: 'Ingresa tu contraseña.' };

  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data, error } = await supabaseInstance.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) return { user: null, error: translateAuthError(error.message) };
      if (data.user) {
        const profile = profileFromUser(data.user as SupaUser);
        cloudUserId = profile.id;
        saveCurrentSessionUser(profile);
        return { user: profile, error: null };
      }
    } catch (err) {
      return { user: null, error: translateAuthError(`Error de autenticación Supabase: ${(err as Error).message}`) };
    }
  }

  const userRecord = getLocalUsersDB().find((u) => u.email === cleanEmail);
  if (!userRecord || userRecord.passwordHash !== simpleHash(password)) {
    return { user: null, error: 'Credenciales inválidas. Revisa tu correo y contraseña o crea una cuenta nueva.' };
  }
  saveCurrentSessionUser(userRecord.profile);
  return { user: userRecord.profile, error: null };
}

export async function logoutUser(): Promise<void> {
  cloudUserId = null;
  if (supabaseInstance) {
    try {
      await supabaseInstance.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut error:', e);
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) localStorage.removeItem(STORAGE_KEY_LOCAL_USER);
}

export function getCurrentSessionUser(): UserProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCurrentSessionUser(user: UserProfile) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_LOCAL_USER, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function checkInitialSession(): Promise<UserProfile | null> {
  const cached = getCurrentSessionUser();
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data } = await supabaseInstance.auth.getSession();
      if (data.session?.user) {
        const profile = profileFromUser(data.session.user as SupaUser);
        cloudUserId = profile.id;
        saveCurrentSessionUser(profile);
        return profile;
      }
    } catch (e) {
      console.warn('Error checking Supabase session:', e);
    }
    // Una cuenta en la nube sin sesión válida (caducada) ya no cuenta como iniciada
    if (cached && !cached.isLocalGuest) {
      localStorage.removeItem(STORAGE_KEY_LOCAL_USER);
      return null;
    }
  }
  return cached;
}

/** Avisa cuando la sesión en la nube se cierra o cambia (p. ej. token caducado). */
export function onCloudAuthChange(cb: (user: UserProfile | null) => void): () => void {
  if (!supabaseInstance) return () => {};
  const { data } = supabaseInstance.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      cloudUserId = null;
      cb(null);
    } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
      const profile = profileFromUser(session.user as SupaUser);
      cloudUserId = profile.id;
      saveCurrentSessionUser(profile);
      cb(profile);
    }
  });
  return () => data.subscription.unsubscribe();
}

// ----------------------------------------------------
// Datos en la nube (solo con una cuenta Supabase real)
// ----------------------------------------------------
function cloud(): { db: SupabaseClient; uid: string } | null {
  return supabaseInstance && cloudUserId ? { db: supabaseInstance, uid: cloudUserId } : null;
}

export async function fetchCloudSettings(): Promise<CloudSettings | null> {
  const c = cloud();
  if (!c) return null;
  const { data, error } = await c.db.from('user_settings').select('theme, lang, quality').eq('user_id', c.uid).maybeSingle();
  if (error) {
    console.warn('No se pudieron leer los ajustes:', error.message);
    return null;
  }
  return (data as CloudSettings) || null;
}

export async function saveCloudSettings(s: CloudSettings): Promise<void> {
  const c = cloud();
  if (!c) return;
  const { error } = await c.db.from('user_settings').upsert({ user_id: c.uid, ...s, updated_at: new Date().toISOString() });
  if (error) console.warn('No se pudieron guardar los ajustes:', error.message);
}

export async function fetchCloudRecents(): Promise<CloudRecent[] | null> {
  const c = cloud();
  if (!c) return null;
  const { data, error } = await c.db.from('recent_repos').select('name, input, files, opened_at').eq('user_id', c.uid).order('opened_at', { ascending: false }).limit(12);
  if (error) {
    console.warn('No se pudieron leer los repos recientes:', error.message);
    return null;
  }
  return (data || []).map((r) => ({ name: r.name, input: r.input, files: r.files, at: new Date(r.opened_at).getTime() }));
}

export async function upsertCloudRecents(list: CloudRecent[]): Promise<void> {
  const c = cloud();
  if (!c || !list.length) return;
  const rows = list.map((r) => ({ user_id: c.uid, name: r.name, input: r.input, files: r.files, opened_at: new Date(r.at).toISOString() }));
  const { error } = await c.db.from('recent_repos').upsert(rows, { onConflict: 'user_id,name' });
  if (error) console.warn('No se pudo guardar el repo reciente:', error.message);
}

export async function deleteCloudRecent(name: string): Promise<void> {
  const c = cloud();
  if (!c) return;
  const { error } = await c.db.from('recent_repos').delete().eq('user_id', c.uid).eq('name', name);
  if (error) console.warn('No se pudo borrar el repo reciente:', error.message);
}

export async function saveAuditRecord(record: {
  repoName?: string;
  filePath: string;
  language: string;
  provider: string;
  modelName: string;
  severity: string;
  score: number;
  issuesCount: number;
  criticalCount: number;
  highCount: number;
  summary: string;
}): Promise<void> {
  const c = cloud();
  if (!c) return;
  const { error } = await c.db.from('code_audits').insert({
    user_id: c.uid,
    repo_name: record.repoName || null,
    file_path: record.filePath,
    language: record.language,
    provider: record.provider,
    model_name: record.modelName,
    severity: record.severity,
    score: record.score,
    issues_count: record.issuesCount,
    critical_count: record.criticalCount,
    high_count: record.highCount,
    summary: record.summary.slice(0, 2000),
  });
  if (error) console.warn('No se pudo guardar la auditoría:', error.message);
}

export async function fetchAuditHistory(limit = 100): Promise<AuditRecord[]> {
  const c = cloud();
  if (!c) return [];
  const { data, error } = await c.db.from('code_audits').select('*').eq('user_id', c.uid).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({
    id: r.id,
    repoName: r.repo_name,
    filePath: r.file_path,
    language: r.language,
    provider: r.provider,
    modelName: r.model_name,
    severity: r.severity,
    score: r.score === null ? null : Number(r.score),
    issuesCount: r.issues_count,
    criticalCount: r.critical_count,
    highCount: r.high_count,
    summary: r.summary,
    createdAt: r.created_at,
  }));
}

export async function deleteAuditRecord(id: string): Promise<void> {
  const c = cloud();
  if (!c) return;
  const { error } = await c.db.from('code_audits').delete().eq('id', id).eq('user_id', c.uid);
  if (error) throw new Error(error.message);
}

export const SUPABASE_SCHEMA_SQL = `-- ========================================================
-- ESQUEMA CODECITY NEXUS 3D PARA SUPABASE (solo si usas tu propio proyecto)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ========================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text default 'Arquitecto de Software',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  lang text not null default 'es' check (lang in ('es','en')),
  quality text not null default 'high' check (quality in ('high','low')),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "settings_select_own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'Arquitecto de Software'))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.recent_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  input text not null,
  files integer not null default 0,
  opened_at timestamptz not null default now(),
  unique (user_id, name)
);
create index recent_repos_user_opened_idx on public.recent_repos (user_id, opened_at desc);
alter table public.recent_repos enable row level security;
create policy "recents_select_own" on public.recent_repos for select to authenticated using ((select auth.uid()) = user_id);
create policy "recents_insert_own" on public.recent_repos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recents_update_own" on public.recent_repos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recents_delete_own" on public.recent_repos for delete to authenticated using ((select auth.uid()) = user_id);

create table public.code_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  repo_name text,
  file_path text not null,
  language text,
  provider text,
  model_name text,
  severity text,
  score numeric,
  issues_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  summary text,
  created_at timestamptz not null default now()
);
create index code_audits_user_created_idx on public.code_audits (user_id, created_at desc);
alter table public.code_audits enable row level security;
create policy "audits_select_own" on public.code_audits for select to authenticated using ((select auth.uid()) = user_id);
create policy "audits_insert_own" on public.code_audits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "audits_delete_own" on public.code_audits for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on public.recent_repos to authenticated;
grant select, insert, delete on public.code_audits to authenticated;
`;
