
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

export const uploadBadgeToSupabase = async (file: File, name: string): Promise<any> => {
  if (!supabase) throw new Error("Supabase is not configured");

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from(TABLE_NAME)
    .insert([{ name, file_path: filePath, zoom_level: 0 }])
    .select()
    .single();

  if (dbError) throw dbError;

  return data;
};

export const getBadgesFromSupabase = async (): Promise<any[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map(item => ({
    id: item.id,
    name: item.name,
    url: supabase!.storage.from(BUCKET_NAME).getPublicUrl(item.file_path).data.publicUrl,
    file_path: item.file_path,
    zoom_level: parseFloat(item.zoom_level ?? 0)
  }));
};

export const updateBadgeZoomLevel = async (id: string, level: number): Promise<void> => {
  if (!supabase) throw new Error("Supabase is not configured");

  // level jest teraz floatem przekazywanym bezpośrednio do bazy
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ zoom_level: level })
    .eq('id', id);

  if (error) throw error;
};

export const deleteBadgeFromSupabase = async (id: string, filePath: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error: dbError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (dbError) throw dbError;

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (storageError) console.warn("Storage removal error:", storageError);
};
