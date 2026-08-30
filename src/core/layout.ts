import { noise } from './rng.ts';
import type { FalseStart, Line, Measure, Notebook, Page, PlacedWord } from './types.ts';

export interface LayoutInput {
  text: string;
  notebook: Notebook;
  /** Измеритель ширины строки в мм при текущем кегле. */
  measure: Measure;
  /** Множитель межсловного пробела, задаётся почерком. */
  spaceWidth: number;
  seed: number;
  /** Частота описок, 0..1. Влияет на перенос: под обрывок нужно место. */
  fixes?: number;
}

/**
 * Разбивает текст на строки и страницы. Случайность только там, где она не
 * ломает воспроизводимость: ширина пробелов и ложные старты считаются от seed
 * и порядкового номера слова, поэтому PDF и превью переносят одинаково.
 */
export function layoutText(input: LayoutInput): Page[] {
  const { text, notebook: nb, measure, spaceWidth, seed } = input;
  const fixes = input.fixes ?? 0;
  const usable = nb.pageW - nb.field - nb.edge;
  const lines: Line[] = [];

  const paragraphs = text.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  // Сквозной номер слова: правка хвоста не сдвигает описки в начале.
  let seq = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur: Exclude<Line, null> = [];
    let x = nb.indent ? nb.indentWidth : 0;

    for (const word of words) {
      const width = measure(word);
      const gap = cur.length ? spaceWidth : 0;
      const stub = falseStartOf(word, seed, seq++, fixes);
      // Обрывок пишется перед словом и занимает свою ширину плюс узкий зазор.
      const stubGap = stub ? spaceWidth * 0.4 : 0;
      const stubWidth = stub ? measure(stub) : 0;
      const total = stubWidth + stubGap + width;

      if (cur.length && x + gap + total > usable) {
        lines.push(cur);
        cur = [place(word, stub, 0, stubWidth, stubGap, width)];
        x = total;
      } else {
        x += gap;
        cur.push(place(word, stub, x, stubWidth, stubGap, width));
        x += total;
      }
    }
    if (cur.length) lines.push(cur);
    lines.push(null);
  }
  while (lines.length && lines[lines.length - 1] === null) lines.pop();

  const linePitch = nb.cell * nb.cellsPerLine;
  const perPage = Math.max(1, Math.floor((nb.pageH - nb.top - nb.bottom) / linePitch));

  const pages: Page[] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    const index = pages.length;
    const ruleRight = ruleOnRight(nb.marginSide, index);
    pages.push({
      lines: lines.slice(i, i + perPage),
      ruleRight,
      textLeft: ruleRight ? nb.edge : nb.field,
    });
  }
  return pages;
}

function place(
  text: string, stub: string | null,
  x: number, stubWidth: number, stubGap: number, width: number,
): PlacedWord {
  const falseStart: FalseStart | null = stub ? { text: stub, x, width: stubWidth } : null;
  return { text, x: x + stubWidth + stubGap, width, falseStart };
}

/**
 * Описка: писавший начал слово, бросил на второй-четвёртой букве и зачеркнул.
 * Берём начало самого слова — так ошибка выглядит правдоподобно.
 */
function falseStartOf(word: string, seed: number, seq: number, fixes: number): string | null {
  if (fixes <= 0) return null;
  const letters = [...word];
  if (letters.length < 4) return null;
  if (noise(seed, seq, 31) > fixes * 0.07) return null;
  const len = 2 + Math.floor(noise(seed, seq, 32) * 3);
  return letters.slice(0, Math.min(len, letters.length - 1)).join('');
}

export function ruleOnRight(side: Notebook['marginSide'], pageIndex: number): boolean {
  const even = pageIndex % 2 === 0;
  if (side === 'alt-right') return even;
  if (side === 'alt-left') return !even;
  return side === 'right';
}

export function linesPerPage(nb: Notebook): number {
  const pitch = nb.cell * nb.cellsPerLine;
  return Math.max(1, Math.floor((nb.pageH - nb.top - nb.bottom) / pitch));
}
