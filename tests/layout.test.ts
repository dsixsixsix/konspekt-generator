import { describe, expect, it } from 'vitest';
import { layoutText, linesPerPage, ruleOnRight } from '../src/core/layout.ts';
import { makeStrokes } from '../src/core/handwriting.ts';
import { defaultHand, defaultNotebook } from '../src/core/presets.ts';

const nb = defaultNotebook('a5');
const hand = defaultHand();
// Грубая мера: каждый символ по 2 мм. Для проверки раскладки шрифт не нужен.
const measure = (s: string) => s.length * 2;

const text = Array.from({ length: 40 }, (_, i) => `слово${i}`).join(' ');

describe('раскладка', () => {
  it('не выпускает строку за пределы полезной ширины', () => {
    const usable = nb.pageW - nb.field - nb.edge;
    for (const page of layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed: 1 })) {
      for (const line of page.lines) {
        if (!line) continue;
        const last = line.at(-1)!;
        expect(last.x + last.width).toBeLessThanOrEqual(usable + 1e-9);
      }
    }
  });

  it('кладёт на страницу столько строк, сколько влезает по клеткам', () => {
    const pages = layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed: 1 });
    for (const page of pages) expect(page.lines.length).toBeLessThanOrEqual(linesPerPage(nb));
  });

  it('чередует сторону красной линии', () => {
    expect(ruleOnRight('alt-right', 0)).toBe(true);
    expect(ruleOnRight('alt-right', 1)).toBe(false);
    expect(ruleOnRight('alt-left', 0)).toBe(false);
    expect(ruleOnRight('left', 4)).toBe(false);
    expect(ruleOnRight('right', 5)).toBe(true);
  });

  it('переносит текстовый блок вслед за полем', () => {
    const pages = layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed: 1 });
    expect(pages[0]!.textLeft).toBe(nb.edge);
    if (pages[1]) expect(pages[1].textLeft).toBe(nb.field);
  });
});

describe('почерк', () => {
  const build = (seed: number) =>
    makeStrokes(layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed }), nb, hand, seed);

  it('воспроизводим при одном seed', () => {
    expect(build(42)).toEqual(build(42));
  });

  it('при другом seed пишет иначе', () => {
    expect(build(42)[0]!.words[0]!.rotate).not.toBe(build(43)[0]!.words[0]!.rotate);
  });

  it('правка хвоста не трогает начало', () => {
    const seed = 7;
    const a = makeStrokes(layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed }), nb, hand, seed);
    const b = makeStrokes(
      layoutText({ text: `${text} ещё`, notebook: nb, measure, spaceWidth: 2, seed }), nb, hand, seed,
    );
    expect(b[0]!.words[0]).toEqual(a[0]!.words[0]);
  });
});
