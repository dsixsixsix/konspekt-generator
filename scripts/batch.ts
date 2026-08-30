/**
 * Пакетная сборка: themes/*.txt → out/*.pdf.
 * Тот же движок, что и в браузере, поэтому вид совпадает с превью.
 *
 *   node scripts/batch.ts [--font Pecita.ttf] [--seed 12345] [--merge]
 *                          [--booklet] [--signature 4] [--flip-backs]
 *
 * --booklet раскладывает страницы по A4 под сшивку тетрадью.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { layoutText } from '../src/core/layout.ts';
import { makeStrokes } from '../src/core/handwriting.ts';
import { renderPdf, renderBookletPdf } from '../src/core/pdf.ts';
import { loadMetrics } from '../src/core/measure.ts';
import { defaultHand, defaultNotebook } from '../src/core/presets.ts';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const fontFile = flag('font', 'Pecita.ttf');
const baseSeed = Number(flag('seed', '20260830'));
const merge = args.includes('--merge');
const booklet = args.includes('--booklet');
const sheetsPerSignature = Number(flag('signature', '4'));
const flipBacks = args.includes('--flip-backs');

const fontBytes = new Uint8Array(await readFile(join(root, 'public', 'fonts', fontFile)));
const metrics = loadMetrics(fontBytes);

const notebook = defaultNotebook('a5');
const hand = defaultHand();

const themesDir = join(root, 'themes');
const outDir = join(root, 'out');
await mkdir(outDir, { recursive: true });

const files = (await readdir(themesDir)).filter(f => ['.txt', '.md'].includes(extname(f))).sort();
if (!files.length) {
  console.error('В themes/ нет .txt или .md. Положи туда конспекты по одному файлу на тему.');
  process.exit(1);
}

const built: { name: string; bytes: Uint8Array }[] = [];

for (const [index, file] of files.entries()) {
  const text = await readFile(join(themesDir, file), 'utf8');
  const seed = baseSeed + index * 7919; // у каждой темы свой почерк дня
  const pages = makeStrokes(
    layoutText({
      text, notebook, seed, fixes: hand.fixes,
      measure: metrics.measurerFor(hand.size),
      spaceWidth: metrics.spaceWidth(hand.size) * 1.45,
    }),
    notebook, hand, seed,
  );
  const title = basename(file, extname(file));
  const bytes = booklet
    ? await renderBookletPdf({ pages, notebook, hand, fontBytes, title, sheetsPerSignature, flipBacks })
    : await renderPdf({ pages, notebook, hand, fontBytes, title });
  const name = `${String(index + 1).padStart(2, '0')}-${title}${booklet ? '-tetrad' : ''}.pdf`;
  await writeFile(join(outDir, name), bytes);
  built.push({ name, bytes });
  console.log(`${name} — ${pages.length} стр.${booklet ? `, ${Math.ceil(pages.length / 4)} листов A4` : ''}`);
}

if (merge) {
  const all = await PDFDocument.create();
  for (const doc of built) {
    const src = await PDFDocument.load(doc.bytes);
    const copied = await all.copyPages(src, src.getPageIndices());
    copied.forEach(p => all.addPage(p));
  }
  await writeFile(join(outDir, 'konspekt-all.pdf'), await all.save());
  console.log(`konspekt-all.pdf — ${all.getPageCount()} стр.`);
}
