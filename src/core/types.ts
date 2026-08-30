/** Все геометрические величины — в миллиметрах. */

export type MarginSide = 'alt-right' | 'alt-left' | 'right' | 'left';

export interface Notebook {
  /** Размер листа, мм. */
  pageW: number;
  pageH: number;
  /** Сторона клетки, мм. */
  cell: number;
  /** Высота строки в клетках. */
  cellsPerLine: number;
  /** Ширина поля под красной линией, мм. */
  field: number;
  /** Отступ от противоположного края (корешка), мм. */
  edge: number;
  top: number;
  bottom: number;
  marginSide: MarginSide;
  drawGrid: boolean;
  drawRule: boolean;
  pageNumbers: boolean;
  /** Красная строка (абзацный отступ). */
  indent: boolean;
  indentWidth: number;
}

export interface Hand {
  /** Кегль, мм. */
  size: number;
  /** Постоянный наклон, градусы (положительный — вправо). */
  slant: number;
  /** Дрожание слов, 0..2. */
  jitter: number;
  /** Дрейф базовой линии, 0..2. */
  drift: number;
  /** Смещение строки по горизонтали, мм (амплитуда). */
  lineShift: number;
  /** Сила нажима, 0..1. */
  pressure: number;
  /** Дрожание отдельных букв, 0..1. Рвёт связки — держать около нуля. */
  charJitter: number;
  /** Накопление усталости к концу страницы, 0..1. */
  fatigue: number;
  ink: string;
}

/** Слово с позицией внутри строки. */
export interface PlacedWord {
  text: string;
  /** Отступ от начала текстового блока, мм. */
  x: number;
  width: number;
}

export type Line = PlacedWord[] | null;

export interface Page {
  lines: Line[];
  /** true — красная линия справа, текст прижат к корешку слева. */
  ruleRight: boolean;
  /** Отступ текстового блока от левого края листа, мм. */
  textLeft: number;
}

/** Готовый к отрисовке штрих: одно слово со всей своей случайностью. */
export interface WordDraw {
  text: string;
  /** мм от левого края листа. */
  x: number;
  /** мм от верха листа до базовой линии. */
  baseline: number;
  rotate: number;
  skew: number;
  scale: number;
  opacity: number;
  /** Дополнительная толщина штриха, мм. Имитация нажима. */
  weight: number;
  chars: { ch: string; dx: number; dy: number }[] | null;
}

export interface PageDraw {
  ruleRight: boolean;
  words: WordDraw[];
  number: number;
}

export type Measure = (text: string) => number;
