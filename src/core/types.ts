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
  /** Плотность точек и клякс от пера, 0..1. */
  blots: number;
  /** Частота описок: ложных стартов и наложений, 0..1. */
  fixes: number;
  ink: string;
}

/** Обрывок слова, который писавший начал не так и зачеркнул. */
export interface FalseStart {
  text: string;
  /** Отступ от начала текстового блока, мм. */
  x: number;
  width: number;
}

/** Слово с позицией внутри строки. */
export interface PlacedWord {
  text: string;
  /** Отступ от начала текстового блока, мм. */
  x: number;
  width: number;
  /** Описка перед словом. Место под неё резервирует раскладка. */
  falseStart: FalseStart | null;
}

export type Line = PlacedWord[] | null;

export interface Page {
  lines: Line[];
  /** true — красная линия справа, текст прижат к корешку слева. */
  ruleRight: boolean;
  /** Отступ текстового блока от левого края листа, мм. */
  textLeft: number;
}

/** Пятно от пера: точка, капля или смазанный след. Всё в мм от краёв листа. */
export interface Blot {
  x: number;
  y: number;
  /** Полуоси эллипса, мм. */
  rx: number;
  ry: number;
  rotate: number;
  opacity: number;
}

/** Росчерк от руки: ломаная в мм от краёв листа. */
export interface Stroke {
  points: { x: number; y: number }[];
  /** Толщина линии, мм. */
  thickness: number;
  opacity: number;
}

/** Зачёркнутый обрывок слова вместе с росчерками поверх него. */
export interface GhostDraw {
  text: string;
  /** мм от левого края листа. */
  x: number;
  opacity: number;
  strokes: Stroke[];
}

/** Готовый к отрисовке штрих: одно слово со всей своей случайностью. */
export interface WordDraw {
  text: string;
  /** мм от левого края листа. */
  x: number;
  /** мм от верха листа до базовой линии. */
  baseline: number;
  /** Ширина слова, мм. */
  width: number;
  rotate: number;
  skew: number;
  scale: number;
  opacity: number;
  /** Дополнительная толщина штриха, мм. Имитация нажима. */
  weight: number;
  chars: { ch: string; dx: number; dy: number }[] | null;
  /** Описка перед словом: зачёркнутый обрывок. */
  ghost: GhostDraw | null;
  /** Повторный проход по слову с микросдвигом: буквы наложились. */
  overwrite: { dx: number; dy: number; opacity: number } | null;
}

export interface PageDraw {
  ruleRight: boolean;
  words: WordDraw[];
  blots: Blot[];
  number: number;
}

export type Measure = (text: string) => number;
