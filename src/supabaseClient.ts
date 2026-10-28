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

const STORAGE_KEY_CONFIG = 'codecity_supabase_config';
const STORAGE_KEY_LOCAL_USER = 'codecity_auth_current_user';
const STORAGE_KEY_LOCAL_USERS_DB = 'codecity_auth_local_users_db';

// Default config from env if available
function getDefaultConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  
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

  return { url: envUrl, anonKey: envKey };
}

let activeConfig: SupabaseConfig = getDefaultConfig();
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  return { ...activeConfig };
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
    activeConfig = config;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      } catch {
        // ignore
      }
    }
  }

  if (isSupabaseConfigured()) {
    try {
      supabaseInstance = createClient(activeConfig.url.trim(), activeConfig.anonKey.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
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

// Initialize on module load
initSupabaseClient();

// ----------------------------------------------------
// Local Users Database Helper (Fallback when no keys)
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

// Simple hash simulation for local guest accounts
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}`;
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

/**
 * Register a new user (Supabase Auth or Local DB Fallback)
 */
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: string = 'Arquitecto de Software'
): Promise<{ user: UserProfile | null; error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { user: null, error: 'Por favor ingresa un correo electrónico válido.' };
  }
  if (!password || password.length < 6) {
    return { user: null, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  // 1. Live Supabase Auth
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data, error } = await supabaseInstance.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim() || 'Arquitecto Nexus',
            role: role.trim() || 'Arquitecto de Software'
          }
        }
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          fullName: data.user.user_metadata?.full_name || fullName.trim() || 'Arquitecto Nexus',
          role: data.user.user_metadata?.role || role.trim() || 'Arquitecto de Software',
          createdAt: data.user.created_at,
          isLocalGuest: false
        };

        // Also try saving to public.profiles table if exists
        try {
          await supabaseInstance.from('profiles').upsert({
            id: profile.id,
            email: profile.email,
            full_name: profile.fullName,
            role: profile.role
          });
        } catch (dbErr) {
          console.warn('Perfil en tabla profiles opcional:', dbErr);
        }

        saveCurrentSessionUser(profile);
        return { user: profile, error: null };
      }
    } catch (err: any) {
      return { user: null, error: `Error conectando con Supabase: ${err.message}` };
    }
  }

  // 2. Local Fallback Database
  const localDB = getLocalUsersDB();
  const existing = localDB.find(u => u.email === cleanEmail);
  if (existing) {
    return { user: null, error: 'Ya existe una cuenta registrada con este correo electrónico.' };
  }

  const newProfile: UserProfile = {
    id: `local-usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: cleanEmail,
    fullName: fullName.trim() || 'Arquitecto Nexus',
    role: role.trim() || 'Arquitecto de Software',
    createdAt: new Date().toISOString(),
    isLocalGuest: true
  };

  localDB.push({
    email: cleanEmail,
    passwordHash: simpleHash(password),
    profile: newProfile
  });
  saveLocalUsersDB(localDB);
  saveCurrentSessionUser(newProfile);

  return { user: newProfile, error: null };
}

/**
 * Log in an existing user (Supabase Auth or Local DB Fallback)
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: UserProfile | null; error: string | null }> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { user: null, error: 'Ingresa un correo electrónico válido.' };
  }
  if (!password) {
    return { user: null, error: 'Ingresa tu contraseña.' };
  }

  // 1. Live Supabase Auth
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data, error } = await supabaseInstance.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          fullName: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          role: data.user.user_metadata?.role || 'Arquitecto de Software',
          createdAt: data.user.created_at,
          isLocalGuest: false
        };
        saveCurrentSessionUser(profile);
        return { user: profile, error: null };
      }
    } catch (err: any) {
      return { user: null, error: `Error de autenticación Supabase: ${err.message}` };
    }
  }

  // 2. Local Fallback Database
  const localDB = getLocalUsersDB();
  const userRecord = localDB.find(u => u.email === cleanEmail);
  
  if (!userRecord || userRecord.passwordHash !== simpleHash(password)) {
    return { user: null, error: 'Credenciales inválidas. Revisa tu correo y contraseña o crea una cuenta nueva.' };
  }

  saveCurrentSessionUser(userRecord.profile);
  return { user: userRecord.profile, error: null };
}

/**
 * Log out user and destroy active session
 */
export async function logoutUser(): Promise<void> {
  if (supabaseInstance) {
    try {
      await supabaseInstance.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut error:', e);
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(STORAGE_KEY_LOCAL_USER);
  }
}

/**
 * Get current stored session user
 */
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

/**
 * Check initial session on boot
 */
export async function checkInitialSession(): Promise<UserProfile | null> {
  if (isSupabaseConfigured() && supabaseInstance) {
    try {
      const { data } = await supabaseInstance.auth.getSession();
      if (data.session?.user) {
        const u = data.session.user;
        const profile: UserProfile = {
          id: u.id,
          email: u.email || '',
          fullName: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Arquitecto',
          role: u.user_metadata?.role || 'Arquitecto de Software',
          createdAt: u.created_at,
          isLocalGuest: false
        };
        saveCurrentSessionUser(profile);
        return profile;
      }
    } catch (e) {
      console.warn('Error checking Supabase session:', e);
    }
  }
  return getCurrentSessionUser();
}

export const SUPABASE_SCHEMA_SQL = `-- ========================================================
-- ESQUEMA COMPLETO CODECITY NEXUS 3D PARA SUPABASE POSTGRESQL
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ========================================================

-- 1. TABLA DE PERFILES DE USUARIOS REGISTRADOS
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text default 'Arquitecto de Software',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. HABILITAR SEGURIDAD POR FILAS (ROW LEVEL SECURITY)
alter table public.profiles enable row level security;

-- 3. POLÍTICAS DE ACCESO RLS
create policy "Usuarios pueden ver su propio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "Usuarios pueden actualizar su propio perfil" on public.profiles
  for update using (auth.uid() = id);

create policy "Usuarios pueden insertar su perfil" on public.profiles
  for insert with check (auth.uid() = id);

-- 4. TRIGGER AUTOMÁTICO: GUARDA AUTOMÁTICAMENTE EL PERFIL AL REGISTRARSE
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'Arquitecto de Software')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. TABLA PARA HISTORIAL DE ANÁLISIS DE CÓDIGO Y AUDITORÍAS AST
create table if not exists public.code_audits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  file_name text not null,
  language text,
  issues_count integer default 0,
  architecture_score numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.code_audits enable row level security;

create policy "Usuarios gestionan sus propios análisis" on public.code_audits
  for all using (auth.uid() = user_id);
`;
