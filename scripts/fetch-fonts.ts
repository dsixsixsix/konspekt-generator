/**
 * Скачивает шрифты под свободными лицензиями в public/fonts.
 * Запускается вручную: pnpm fonts
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'public', 'fonts');

const FONTS = [
  { file: 'Pecita.ttf', url: 'https://pecita.eu/b/Pecita.otf', license: 'SIL OFL 1.1' },
  { file: 'Pacifico-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf', license: 'SIL OFL 1.1' },
  { file: 'MarckScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/marckscript/MarckScript-Regular.ttf', license: 'SIL OFL 1.1' },
  { file: 'BadScript-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/badscript/BadScript-Regular.ttf', license: 'SIL OFL 1.1' },
  { file: 'Caveat-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf', license: 'SIL OFL 1.1' },
];

await mkdir(DIR, { recursive: true });

for (const font of FONTS) {
  const path = join(DIR, font.file);
  try {
    await access(path);
    console.log(`= ${font.file} уже на месте`);
    continue;
  } catch { /* качаем */ }

  process.stdout.write(`↓ ${font.file} … `);
  const res = await fetch(font.url);
  if (!res.ok) {
    console.log(`ошибка ${res.status}, качай вручную: ${font.url}`);
    continue;
  }
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  console.log(`ок (${font.license})`);
}
