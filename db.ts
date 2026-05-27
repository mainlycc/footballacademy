
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

const supabaseUrl = SUPABASE_URL || (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || '';
const supabaseAnonKey = SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const BUCKET_NAME = 'badges';
const TABLE_NAME = 'badges';

const LOCAL_VERSION_PREFIX = 'fa_badge_version:'; // key: fa_badge_version:<file_path>

const getLocalFileVersion = (filePath: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LOCAL_VERSION_PREFIX + filePath);
  } catch {
    return null;
  }
};

const setLocalFileVersion = (filePath: string, version: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_VERSION_PREFIX + filePath, version);
  } catch {
    // ignore
  }
};

export const uploadBadgeToSupabase = async (file: File, name: string): Promise<any> => {
  // Opcja B: zapis do Supabase tylko przez backend (service role),
  // żeby anon key w przeglądarce nie łamał RLS.
  const form = new FormData();
  form.append('name', name);
  form.append('file', file);

  const res = await fetch('/api/badges/upload', { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd uploadu (API)');
  return json.data;
};

export const getBadgesFromSupabase = async (): Promise<any[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map(item => {
    const baseUrl = supabase!.storage.from(BUCKET_NAME).getPublicUrl(item.file_path).data.publicUrl;
    // Cache-buster:
    // - preferuj wersję ustawioną lokalnie po zapisie pliku (nie wymaga UPDATE w DB, omija RLS)
    // - fallback: created_at/updated_at jeśli dostępne w schemacie.
    const localVersion = typeof item.file_path === 'string' ? getLocalFileVersion(item.file_path) : null;
    const version = localVersion || item.updated_at || item.created_at || '';
    const url = version ? `${baseUrl}?v=${encodeURIComponent(version)}` : baseUrl;
    return {
      id: item.id,
      name: item.name,
      url,
      file_path: item.file_path,
      zoom_level: parseFloat(item.zoom_level ?? 0)
    };
  });
};

export const updateBadgeName = async (id: string, name: string): Promise<void> => {
  const res = await fetch('/api/badges/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: name.trim() })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd zmiany nazwy (API)');
};

export const updateBadgeZoomLevel = async (id: string, level: number): Promise<void> => {
  const res = await fetch('/api/badges/zoom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, level })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd zapisu zoom (API)');
};

export const deleteBadgeFromSupabase = async (id: string, filePath: string): Promise<void> => {
  const res = await fetch('/api/badges/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, filePath })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd usuwania (API)');
};

/**
 * Nadpisuje istniejący plik GLB w Storage (zachowując tę samą ścieżkę).
 * Po zapisie aktualizuje `updated_at` w tabeli, dzięki czemu
 * `getBadgesFromSupabase` zwróci nowy cache-buster w URL.
 */
export const replaceBadgeFile = async (
  id: string,
  filePath: string,
  file: Blob | File
): Promise<void> => {
  const form = new FormData();
  form.append('filePath', filePath);
  // Blob → File dla czytelnego mimetype
  const asFile = file instanceof File ? file : new File([file], 'badge.glb', { type: 'model/gltf-binary' });
  form.append('file', asFile);

  const res = await fetch('/api/badges/replace-file', { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd zapisu pliku (API)');

  setLocalFileVersion(filePath, String(Date.now()));
};

/**
 * Pobiera dowolny plik JSON z bucket-u `badges`.
 * Zwraca `null`, jeśli plik nie istnieje (np. paleta jeszcze nie utworzona).
 */
export const loadJsonFromStorage = async <T = any>(path: string): Promise<T | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(path);
    if (error || !data) return null;
    const text = await data.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn(`loadJsonFromStorage(${path}) failed:`, err);
    return null;
  }
};

export const saveJsonToStorage = async (path: string, value: unknown): Promise<void> => {
  const res = await fetch('/api/storage/save-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, value })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Błąd zapisu JSON (API)');
};
