import { noise, snoise } from './rng.ts';
import type { Blot, GhostDraw, Hand, Notebook, Page, PageDraw, Stroke, WordDraw } from './types.ts';

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

        const x = page.textLeft + word.x + lineDx;
        const baseline = nb.top + li * pitch + pitch * 0.72 + dy;
        const opacity = Math.max(0.42, press);

        words.push({
          text: word.text,
          x,
          baseline,
          width: word.width,
          rotate: snoise(seed, pi, li, wi, 6) * hand.jitter * 1.5 - tired * 0.9,
          skew: hand.slant + snoise(seed, pi, li, wi, 7) * hand.jitter * 1.6,
          scale: 1 + snoise(seed, pi, li, wi, 8) * hand.jitter * 0.05 - tired * 0.02,
          opacity,
          weight: Math.max(0, press - 0.74) * hand.pressure * 0.055,
          chars: hand.charJitter > 0 ? splitChars(word.text, seed, pi, li, wi, hand.charJitter) : null,
          ghost: word.falseStart
            ? makeGhost(
                word.falseStart.text,
                page.textLeft + word.falseStart.x + lineDx,
                word.falseStart.width,
                baseline, opacity, hand, seed, pi, li, wi,
              )
            : null,
          overwrite: makeOverwrite(hand, seed, pi, li, wi),
        });
      });
    });

    return { ruleRight: page.ruleRight, words, blots: makeBlots(words, nb, hand, seed, pi), number: pi + 1 };
  });
}

function splitChars(text: string, seed: number, pi: number, li: number, wi: number, amount: number) {
  return [...text].map((ch, ci) => ({
    ch,
    dx: snoise(seed, pi, li, wi, ci, 9) * amount * 0.12,
    dy: snoise(seed, pi, li, wi, ci, 10) * amount * 0.5,
  }));
}

/**
 * Наложение: писавший обвёл уже написанное, буквы двоятся. Ловится глазом
 * только вблизи — поэтому сдвиг заметно меньше кегля.
 */
function makeOverwrite(hand: Hand, seed: number, pi: number, li: number, wi: number) {
  if (hand.fixes <= 0) return null;
  if (noise(seed, pi, li, wi, 11) > hand.fixes * 0.07) return null;
  return {
    dx: snoise(seed, pi, li, wi, 12) * hand.size * 0.09,
    dy: snoise(seed, pi, li, wi, 13) * hand.size * 0.06,
    opacity: 0.34 + noise(seed, pi, li, wi, 14) * 0.28,
  };
}

/** Обрывок слова и один-два росчерка поверх него. */
function makeGhost(
  text: string, x: number, width: number, baseline: number,
  opacity: number, hand: Hand, seed: number, pi: number, li: number, wi: number,
): GhostDraw {
  const thickness = 0.16 + hand.pressure * 0.12;
  const strokes: Stroke[] = [
    scribble(x, width, baseline, hand.size, thickness, opacity, seed, pi, li, wi, 15),
  ];
  // Иногда одного зачёркивания мало: сверху ложится второй росчерк.
  if (noise(seed, pi, li, wi, 16) < 0.42) {
    strokes.push(scribble(x, width, baseline, hand.size, thickness, opacity * 0.85, seed, pi, li, wi, 17));
  }
  return { text, x, opacity: opacity * 0.9, strokes };
}

/**
 * Росчерк через обрывок: ломаная из четырёх точек с разбросом по вертикали,
 * концы вылезают за буквы — рука не целится в границы слова.
 */
function scribble(
  x: number, width: number, baseline: number, size: number,
  thickness: number, opacity: number, seed: number,
  pi: number, li: number, wi: number, channel: number,
): Stroke {
  const from = x - 0.2 - noise(seed, pi, li, wi, channel, 0) * 0.6;
  const to = x + width + 0.2 + noise(seed, pi, li, wi, channel, 1) * 0.7;
  const mid = baseline - size * (0.26 + noise(seed, pi, li, wi, channel, 2) * 0.16);
  const tilt = snoise(seed, pi, li, wi, channel, 3) * size * 0.14;

  const points = Array.from({ length: 4 }, (_, i) => {
    const t = i / 3;
    return {
      x: from + (to - from) * t,
      y: mid + tilt * (t - 0.5) + snoise(seed, pi, li, wi, channel, 4 + i) * size * 0.05,
    };
  });
  return { points, thickness, opacity: Math.min(1, opacity + 0.1) };
}

/**
 * Пятна от пера. Привязаны к словам, а не к пустому листу: чернила капают там,
 * где рука уже была. Плотность неровная — часть листов остаётся почти чистой.
 */
function makeBlots(words: WordDraw[], nb: Notebook, hand: Hand, seed: number, pi: number): Blot[] {
  const blots: Blot[] = [];
  if (!words.length || hand.blots <= 0) return blots;

  const slots = 18;
  for (let i = 0; i < slots; i++) {
    if (noise(seed, pi, i, 20) > hand.blots * 0.55) continue;

    const anchor = words[Math.floor(noise(seed, pi, i, 21) * words.length)]!;
    const kind = noise(seed, pi, i, 22);
    const scale = noise(seed, pi, i, 23);

    let x: number;
    let y: number;
    let rx: number;
    let ry: number;
    let rotate = 0;
    let opacity: number;

    if (kind < 0.58) {
      // Мелкая брызга рядом со строкой, но не поверх букв: иначе читается
      // как запятая или надстрочный знак.
      x = anchor.x + snoise(seed, pi, i, 24) * 9;
      y = anchor.baseline + gapOffset(hand.size, seed, pi, i, 25);
      rx = 0.09 + scale * 0.18;
      ry = rx * (0.75 + noise(seed, pi, i, 26) * 0.5);
      opacity = 0.3 + scale * 0.45;
    } else if (kind < 0.9) {
      // Капля на отрыве пера: у хвоста слова, чуть выше базовой линии.
      x = anchor.x + anchor.width + 0.2 + noise(seed, pi, i, 27) * 0.8;
      y = anchor.baseline - hand.size * (0.05 + noise(seed, pi, i, 28) * 0.22);
      rx = 0.22 + scale * 0.34;
      ry = rx * (0.6 + noise(seed, pi, i, 29) * 0.55);
      rotate = snoise(seed, pi, i, 30) * 40;
      opacity = 0.45 + scale * 0.4;
    } else {
      // Смазанный след: рука проехала по невысохшим чернилам. Всегда под
      // строкой — над буквами вытянутое пятно читается как надстрочный знак.
      x = anchor.x + snoise(seed, pi, i, 31) * 6;
      y = anchor.baseline + 1.5 + noise(seed, pi, i, 32) * 2.2;
      rx = 0.6 + scale * 1.1;
      ry = 0.06 + scale * 0.1;
      rotate = snoise(seed, pi, i, 33) * 18;
      opacity = 0.12 + scale * 0.2;
    }

    // Пятно за краем листа — это уже не лист, а стол.
    const pad = 2;
    if (x < pad || x > nb.pageW - pad || y < pad || y > nb.pageH - pad) continue;
    blots.push({ x, y, rx, ry, rotate, opacity });
  }
  return blots;
}

/**
 * Смещение от базовой линии в межстрочный просвет: вниз под строку или выше
 * верхних выносных. Буквы занимают полосу от baseline − size до baseline.
 */
function gapOffset(size: number, seed: number, pi: number, i: number, channel: number): number {
  const below = noise(seed, pi, i, channel, 0) < 0.62;
  const away = 0.7 + noise(seed, pi, i, channel, 1) * 2.1;
  return below ? away : -(size * 1.12 + away * 0.8);
}
