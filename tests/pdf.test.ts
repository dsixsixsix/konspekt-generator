import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { layoutText } from '../src/core/layout.ts';
import { makeStrokes } from '../src/core/handwriting.ts';
import { renderPdf } from '../src/core/pdf.ts';
import { loadMetrics } from '../src/core/measure.ts';
import { defaultHand, defaultNotebook } from '../src/core/presets.ts';

const fontPath = join(import.meta.dirname, '..', 'public', 'fonts', 'Pecita.ttf');
const text = 'Кровеносная система замкнутая, состоит из сердца и сосудов.';

/** Достаёт из PDF файл шрифта: FontFile2 для TrueType, FontFile3 для CFF. */
function embeddedFont(doc: PDFDocument): Uint8Array | null {
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const ref = obj.get(PDFName.of('FontFile2'))
      ?? obj.get(PDFName.of('FontFile3'))
      ?? obj.get(PDFName.of('FontFile'));
    if (!ref) continue;
    const stream = doc.context.lookup(ref) as PDFRawStream;
    const bytes = stream.getContents();
    const filter = String(stream.dict.get(PDFName.of('Filter')) ?? '');
    return filter.includes('Flate') ? new Uint8Array(inflateSync(Buffer.from(bytes))) : bytes;
  }
  return null;
}

// Шрифты не лежат в репозитории: без `pnpm fonts` проверять нечего.
describe.skipIf(!existsSync(fontPath))('шрифт в PDF', () => {
  const fontBytes = existsSync(fontPath) ? new Uint8Array(readFileSync(fontPath)) : new Uint8Array();

  const build = async () => {
    const nb = defaultNotebook('a5');
    const hand = defaultHand();
    const metrics = loadMetrics(fontBytes);
    const pages = makeStrokes(
      layoutText({
        text, notebook: nb, seed: 11, fixes: hand.fixes,
        measure: metrics.measurerFor(hand.size),
        spaceWidth: metrics.spaceWidth(hand.size) * 1.45,
      }),
      nb, hand, 11,
    );
    return PDFDocument.load(await renderPdf({ pages, notebook: nb, hand, fontBytes }));
  };

  it('вшивает файл шрифта целиком', async () => {
    const embedded = embeddedFont(await build());
    expect(embedded).not.toBeNull();
    // Сабсеттер fontkit ломает Pecita: поток перестаёт быть шрифтом,
    // и просмотрщик рисует вместо букв кашу.
    expect(embedded!.length).toBe(fontBytes.length);
    expect([...embedded!.slice(0, 4)]).toEqual([...fontBytes.slice(0, 4)]);
  });

  it('оставляет в PDF шрифт, который читается и покрывает кириллицу', async () => {
    const embedded = embeddedFont(await build())!;
    const font = (fontkit as unknown as { create(b: Buffer): {
      layout(t: string): { glyphs: { id: number; path: { commands: unknown[] } }[] };
    } }).create(Buffer.from(embedded));
    const glyphs = font.layout(text).glyphs;
    expect(glyphs.length).toBeGreaterThan(0);
    // id 0 — .notdef: буквы нет в шрифте, вместо неё пустой квадрат.
    expect(glyphs.filter(g => g.id === 0)).toHaveLength(0);
    expect(glyphs.filter(g => g.path.commands.length > 0).length).toBeGreaterThan(glyphs.length / 2);
  });
});
