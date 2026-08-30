/**
 * Кладёт конспекты из themes/ в public/themes и пишет каталог index.json.
 * Запускается перед сборкой: в public/themes лежит копия, а не симлинк, иначе
 * сборка на Windows получала бы вместо текста строку с путём.
 *
 *   node scripts/themes.ts
 */
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'themes');
const out = join(root, 'public', 'themes');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const files = (await readdir(src)).filter(f => ['.txt', '.md'].includes(extname(f))).sort();
const index: { file: string; name: string }[] = [];

for (const file of files) {
  await copyFile(join(src, file), join(out, file));
  const text = await readFile(join(src, file), 'utf8');
  const first = text.split('\n').map(l => l.trim()).find(Boolean) ?? file;
  index.push({ file, name: first.length > 70 ? `${first.slice(0, 69)}…` : first });
}

await writeFile(join(out, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`public/themes — ${files.length} шт.`);
