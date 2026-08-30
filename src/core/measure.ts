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

/**
 * Метрики берём из самого файла шрифта, а не из браузера. Так превью в DOM и
 * текст в PDF ложатся в одни и те же координаты.
 */
export function loadMetrics(bytes: Uint8Array | ArrayBuffer): FontMetrics {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const font = (fontkit as unknown as { create(b: Uint8Array): FontkitFont }).create(buf);

  const widthOf = (text: string, sizeMm: number) =>
    (font.layout(text).advanceWidth / font.unitsPerEm) * sizeMm;

  return {
    widthOf,
    spaceWidth: (sizeMm) => Math.max(widthOf(' ', sizeMm), sizeMm * 0.30),
    measurerFor: (sizeMm) => (text) => widthOf(text, sizeMm),
  };
}
