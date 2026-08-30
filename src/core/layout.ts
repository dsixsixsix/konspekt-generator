import type { Line, Measure, Notebook, Page } from './types.ts';

export interface LayoutInput {
  text: string;
  notebook: Notebook;
  /** Измеритель ширины строки в мм при текущем кегле. */
  measure: Measure;
  /** Множитель межсловного пробела, задаётся почерком. */
  spaceWidth: number;
  seed: number;
}

/**
 * Разбивает текст на строки и страницы. Никакой случайности, кроме ширины
 * пробелов: перенос должен быть воспроизводимым, иначе PDF и превью разъедутся.
 */
export function layoutText(input: LayoutInput): Page[] {
  const { text, notebook: nb, measure, spaceWidth } = input;
  const usable = nb.pageW - nb.field - nb.edge;
  const lines: Line[] = [];

  const paragraphs = text.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur: Exclude<Line, null> = [];
    let x = nb.indent ? nb.indentWidth : 0;

    for (const word of words) {
      const width = measure(word);
      const gap = cur.length ? spaceWidth : 0;
      if (cur.length && x + gap + width > usable) {
        lines.push(cur);
        cur = [{ text: word, x: 0, width }];
        x = width;
      } else {
        x += gap;
        cur.push({ text: word, x, width });
        x += width;
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
