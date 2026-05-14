/**
 * Pobiera wszystkie pliki z wybranego bucketa Supabase Storage na dysk lokalny.
 *
 * Uruchom z katalogu głównego projektu:
 *   npm run download-storage
 *
 * Wymagane zmienne środowiskowe:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY  lub  SUPABASE_SERVICE_ROLE_KEY  (dla prywatnych bucketów często potrzebny jest service role)
 *
 * Opcjonalnie:
 *   SUPABASE_BUCKET   — domyślnie: badges
 *   SUPABASE_DOWNLOAD_DIR — domyślnie: ./supabase-download
 *
 * PowerShell (przykład):
 *   $env:SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   npm run download-storage
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const DEFAULT_BUCKET = 'badges';
const DEFAULT_OUT = './supabase-download';

function parseArgs(argv) {
  const out = { bucket: process.env.SUPABASE_BUCKET || DEFAULT_BUCKET, dir: process.env.SUPABASE_DOWNLOAD_DIR || DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bucket' && argv[i + 1]) {
      out.bucket = argv[++i];
    } else if (a === '--out' && argv[i + 1]) {
      out.dir = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log(`Użycie: node scripts/download-supabase-storage.mjs [--bucket nazwa] [--out folder]

Zmienne środowiskowe: SUPABASE_URL, SUPABASE_ANON_KEY lub SUPABASE_SERVICE_ROLE_KEY,
opcjonalnie SUPABASE_BUCKET, SUPABASE_DOWNLOAD_DIR`);
      process.exit(0);
    }
  }
  return out;
}

/** Rekursywne listowanie — wpisy bez metadata traktujemy jak podfoldery. */
async function listAllFilePaths(supabase, bucket, prefix = '') {
  const paths = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      /* Pliki mają metadata ze znanym rozmiarem; „foldery” w API mają metadata: null */
      const isFile =
        item.metadata != null && typeof item.metadata.size === 'number';

      if (isFile) {
        paths.push(rel);
      } else {
        const nested = await listAllFilePaths(supabase, bucket, rel);
        paths.push(...nested);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function main() {
  const { bucket, dir: outDir } = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.error(
      'Brak SUPABASE_URL oraz SUPABASE_ANON_KEY lub SUPABASE_SERVICE_ROLE_KEY w środowisku.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const rootAbs = path.resolve(outDir);

  console.log(`Bucket: ${bucket}`);
  console.log(`Folder docelowy: ${rootAbs}`);

  const filePaths = await listAllFilePaths(supabase, bucket, '');
  console.log(`Znaleziono plików: ${filePaths.length}`);

  let ok = 0;
  let fail = 0;

  for (const filePath of filePaths) {
    const localPath = path.join(rootAbs, ...filePath.split('/'));
    await fs.mkdir(path.dirname(localPath), { recursive: true });

    const { data: blob, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) {
      console.error(`[błąd] ${filePath}:`, error.message);
      fail++;
      continue;
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    await fs.writeFile(localPath, buf);
    console.log(`OK  ${filePath}`);
    ok++;
  }

  console.log(`\nGotowe: ${ok} pobranych, ${fail} błędów.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
