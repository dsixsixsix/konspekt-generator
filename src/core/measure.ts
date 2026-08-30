import fontkit from '@pdf-lib/fontkit';
import type { Measure } from './types.ts';

const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / MM_PER_INCH;

interface FontkitFont {
  unitsPerEm: number;
  layout(text: string): { advanceWidth: number };
}

export interface FontMetrics {
  /** Ширина строки в мм при заданном кегле (кегль тоже в мм). */
  widthOf(text: string, sizeMm: number): number;
  /** Ширина пробела в мм. */
  spaceWidth(sizeMm: number): number;
  measurerFor(sizeMm: number): Measure;
}

/** Словарь конспекта редко богаче нескольких десятков тысяч слов. */
const CACHE_LIMIT = 60_000;

/**
 * Метрики берём из самого файла шрифта, а не из браузера. Так превью в DOM и
 * текст в PDF ложатся в одни и те же координаты.
 */
export function loadMetrics(bytes: Uint8Array | ArrayBuffer): FontMetrics {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const font = (fontkit as unknown as { create(b: Uint8Array): FontkitFont }).create(buf);

  // Шейпинг слова стоит дорого, а слова в тексте повторяются. Кешируем ширину
  // в единицах шрифта: она не зависит от кегля, поэтому ползунок размера
  // не сбрасывает кеш.
  const advances = new Map<string, number>();
  const advanceOf = (text: string) => {
    const hit = advances.get(text);
    if (hit !== undefined) return hit;
    const advance = font.layout(text).advanceWidth;
    if (advances.size >= CACHE_LIMIT) advances.clear();
    advances.set(text, advance);
    return advance;
  };

  const widthOf = (text: string, sizeMm: number) => (advanceOf(text) / font.unitsPerEm) * sizeMm;

  return {
    widthOf,
    spaceWidth: (sizeMm) => Math.max(widthOf(' ', sizeMm), sizeMm * 0.30),
    measurerFor: (sizeMm) => (text) => widthOf(text, sizeMm),
  };
}
