import { describe, expect, it } from 'vitest';
import { layoutText, linesPerPage, ruleOnRight } from '../src/core/layout.ts';
import { makeStrokes } from '../src/core/handwriting.ts';
import { imposeBooklet, readingOrder, type Binding } from '../src/core/booklet.ts';
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

describe('описки', () => {
  const laid = (fixes: number) =>
    layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed: 3, fixes });

  it('резервирует место под обрывок и не выпускает строку за поля', () => {
    const usable = nb.pageW - nb.field - nb.edge;
    for (const page of laid(1)) {
      for (const line of page.lines) {
        if (!line) continue;
        expect(line[0]!.falseStart?.x ?? 0).toBeGreaterThanOrEqual(0);
        const last = line.at(-1)!;
        expect(last.x + last.width).toBeLessThanOrEqual(usable + 1e-9);
      }
    }
  });

  it('зачёркивает начало того же слова, а не чужой текст', () => {
    let seen = 0;
    for (const page of laid(1)) {
      for (const line of page.lines) {
        for (const word of line ?? []) {
          if (!word.falseStart) continue;
          seen++;
          expect(word.text.startsWith(word.falseStart.text)).toBe(true);
          expect(word.falseStart.text.length).toBeLessThan(word.text.length);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('на нуле описок не появляется', () => {
    for (const page of laid(0)) {
      for (const line of page.lines) {
        for (const word of line ?? []) expect(word.falseStart).toBeNull();
      }
    }
  });
});

describe('следы ручки', () => {
  const build = (patch: Partial<typeof hand>, seed = 5) =>
    makeStrokes(
      layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed, fixes: patch.fixes ?? 0 }),
      nb, { ...hand, ...patch }, seed,
    );

  it('сажает пятна на каждой странице с текстом', () => {
    for (const page of build({ blots: 1 })) {
      expect(page.words.length).toBeGreaterThan(0);
      expect(page.blots.length).toBeGreaterThan(0);
    }
  });

  it('держит пятна в пределах листа', () => {
    for (const page of build({ blots: 1 })) {
      for (const blot of page.blots) {
        expect(blot.x).toBeGreaterThan(0);
        expect(blot.x).toBeLessThan(nb.pageW);
        expect(blot.y).toBeGreaterThan(0);
        expect(blot.y).toBeLessThan(nb.pageH);
      }
    }
  });

  it('на нуле оставляет лист чистым', () => {
    for (const page of build({ blots: 0, fixes: 0 })) {
      expect(page.blots).toHaveLength(0);
      for (const word of page.words) {
        expect(word.ghost).toBeNull();
        expect(word.overwrite).toBeNull();
      }
    }
  });

  it('перечёркивает обрывок росчерком поверх букв', () => {
    const ghosts = build({ fixes: 1 }).flatMap(p => p.words.filter(w => w.ghost));
    expect(ghosts.length).toBeGreaterThan(0);
    for (const word of ghosts) {
      const ghost = word.ghost!;
      expect(ghost.strokes.length).toBeGreaterThan(0);
      for (const stroke of ghost.strokes) {
        expect(stroke.points).toHaveLength(4);
        // Росчерк идёт слева направо и лежит внутри строки буквы.
        expect(stroke.points[0]!.x).toBeLessThan(stroke.points[3]!.x);
        for (const pt of stroke.points) {
          expect(pt.y).toBeLessThan(word.baseline);
          expect(pt.y).toBeGreaterThan(word.baseline - hand.size);
        }
      }
    }
  });
});

describe('почерк', () => {
  const build = (seed: number) =>
    makeStrokes(
      layoutText({ text, notebook: nb, measure, spaceWidth: 2, seed, fixes: hand.fixes }),
      nb, hand, seed,
    );

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

describe('спуск полос', () => {
  const order = (n: number, sheetsPerSignature = 0, binding: Binding = 'left') =>
    readingOrder(imposeBooklet(n, { sheetsPerSignature, binding }), binding);

  it('после сборки страницы читаются подряд', () => {
    for (const [n, sig] of [[8, 0], [10, 0], [12, 2], [104, 4], [97, 6]] as const) {
      const read = order(n, sig);
      expect(read.slice(0, n)).toEqual(Array.from({ length: n }, (_, i) => i));
      // Хвост добивки — пустые половины.
      for (const half of read.slice(n)) expect(half).toBeNull();
    }
  });

  it('читается подряд и при сшивке справа', () => {
    expect(order(16, 4, 'right').slice(0, 16)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('кладёт на внешний лист первую и последнюю страницы тетрадки', () => {
    const [first] = imposeBooklet(16, { sheetsPerSignature: 4 });
    expect(first!.front).toEqual([15, 0]);
    expect(first!.back).toEqual([1, 14]);
  });

  it('при сшивке справа половинки меняются местами', () => {
    const [first] = imposeBooklet(16, { sheetsPerSignature: 4, binding: 'right' });
    expect(first!.front).toEqual([0, 15]);
  });

  it('добивает тетрадку до кратности четырём', () => {
    const sheets = imposeBooklet(5);
    expect(sheets).toHaveLength(2);
    const halves = sheets.flatMap(s => [...s.front, ...s.back]);
    expect(halves.filter(h => h === null)).toHaveLength(3);
  });

  it('режет книгу на тетрадки заданной толщины', () => {
    const sheets = imposeBooklet(104, { sheetsPerSignature: 4 });
    expect(sheets).toHaveLength(26);
    expect(new Set(sheets.map(s => s.signature)).size).toBe(7);
    expect(sheets.filter(s => s.signature === 0)).toHaveLength(4);
  });
});
