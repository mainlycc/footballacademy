import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });

const PORT = process.env.PORT ? Number(process.env.PORT) : 5179;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Brak SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY w środowisku (backend).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const BUCKET = 'badges';
const TABLE = 'badges';

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/badges/replace-file', upload.single('file'), async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        upsert: true,
        contentType: req.file.mimetype || 'model/gltf-binary',
        cacheControl: '0'
      });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/storage/save-json', async (req, res) => {
  try {
    const { path, value } = req.body || {};
    if (!path) return res.status(400).json({ error: 'path required' });

    const body = Buffer.from(JSON.stringify(value ?? null, null, 2));
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '0'
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/badges/upload', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });

    const fileExt = (req.file.originalname.split('.').pop() || 'glb').toLowerCase();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = fileName;

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        upsert: false,
        contentType: req.file.mimetype || 'model/gltf-binary',
        cacheControl: '0'
      });
    if (storageError) return res.status(500).json({ error: storageError.message });

    const { data, error: dbError } = await supabase
      .from(TABLE)
      .insert([{ name, file_path: filePath, zoom_level: 0 }])
      .select()
      .single();
    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/badges/delete', async (req, res) => {
  try {
    const { id, filePath } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!filePath) return res.status(400).json({ error: 'filePath required' });

    const { error: dbError } = await supabase.from(TABLE).delete().eq('id', id);
    if (dbError) return res.status(500).json({ error: dbError.message });

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (storageError) return res.status(500).json({ error: storageError.message });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/badges/zoom', async (req, res) => {
  try {
    const { id, level } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (typeof level !== 'number') return res.status(400).json({ error: 'level must be number' });

    const { error } = await supabase.from(TABLE).update({ zoom_level: level }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}`);
});

