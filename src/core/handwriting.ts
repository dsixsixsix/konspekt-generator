import { noise, snoise } from './rng.ts';
import type { Hand, Notebook, Page, PageDraw, WordDraw } from './types.ts';

/**
 * Превращает свёрстанные страницы в набор штрихов: к каждому слову
 * подмешивается своя случайность. Один и тот же seed даёт один и тот же
 * результат и в превью, и в PDF — рендереры ничего не решают сами.
 */
export function makeStrokes(pages: Page[], nb: Notebook, hand: Hand, seed: number): PageDraw[] {
  const pitch = nb.cell * nb.cellsPerLine;
  const usable = nb.pageW - nb.field - nb.edge;

  return pages.map((page, pi) => {
    const words: WordDraw[] = [];

    page.lines.forEach((line, li) => {
      if (!line) return;

      // Усталость: к низу листа строка сильнее заваливается и сжимается.
      const tired = hand.fatigue * (li / Math.max(1, page.lines.length - 1));

      // Строка целиком уезжает влево или вправо.
      const lineDx = snoise(seed, pi, li, 1) * hand.lineShift;
      // Своя фаза волны у каждой строки: дрейф базовой линии и волна нажима.
      const driftPhase = noise(seed, pi, li, 2) * Math.PI * 2;
      const pressPhase = noise(seed, pi, li, 3) * Math.PI * 2;

      line.forEach((word, wi) => {
        const k = usable > 0 ? word.x / usable : 0;

        const drift = Math.sin(driftPhase + k * 2.4) * hand.drift * 0.55;
        const dy = drift + snoise(seed, pi, li, wi, 4) * hand.jitter * 0.42;

        const wave = Math.sin(pressPhase + k * 3.1) * 0.5 + 0.5;
        const press = 1 - hand.pressure * (0.26 * wave + 0.20 * noise(seed, pi, li, wi, 5));

        words.push({
          text: word.text,
          x: page.textLeft + word.x + lineDx,
          baseline: nb.top + li * pitch + pitch * 0.72 + dy,
          rotate: snoise(seed, pi, li, wi, 6) * hand.jitter * 1.5 - tired * 0.9,
          skew: hand.slant + snoise(seed, pi, li, wi, 7) * hand.jitter * 1.6,
          scale: 1 + snoise(seed, pi, li, wi, 8) * hand.jitter * 0.05 - tired * 0.02,
          opacity: Math.max(0.42, press),
          weight: Math.max(0, press - 0.74) * hand.pressure * 0.055,
          chars: hand.charJitter > 0 ? splitChars(word.text, seed, pi, li, wi, hand.charJitter) : null,
        });
      });
    });

    return { ruleRight: page.ruleRight, words, number: pi + 1 };
  });
}

function splitChars(text: string, seed: number, pi: number, li: number, wi: number, amount: number) {
  return [...text].map((ch, ci) => ({
    ch,
    dx: snoise(seed, pi, li, wi, ci, 9) * amount * 0.12,
    dy: snoise(seed, pi, li, wi, ci, 10) * amount * 0.5,
  }));
}
