import type { Hand, Notebook } from './types.ts';

export const SHEETS = {
  a5: { pageW: 148, pageH: 210, label: 'A5' },
  a4: { pageW: 210, pageH: 297, label: 'A4' },
  school: { pageW: 165, pageH: 205, label: 'Школьная тетрадь 165×205' },
} as const;

export type SheetKey = keyof typeof SHEETS;

export const defaultNotebook = (sheet: SheetKey = 'a5'): Notebook => ({
  pageW: SHEETS[sheet].pageW,
  pageH: SHEETS[sheet].pageH,
  cell: 5,
  cellsPerLine: 2,
  field: 24,
  edge: 8,
  top: 10,
  bottom: 8,
  marginSide: 'alt-right',
  drawGrid: true,
  drawRule: true,
  pageNumbers: false,
  indent: true,
  indentWidth: 10,
});

export const defaultHand = (): Hand => ({
  size: 4.2,
  slant: 1,
  jitter: 1,
  drift: 0.9,
  lineShift: 1.4,
  pressure: 0.55,
  charJitter: 0,
  fatigue: 0.35,
  blots: 0.45,
  fixes: 0.35,
  ink: '#2A3B8F',
});

export const INKS: { hex: string; name: string }[] = [
  { hex: '#2A3B8F', name: 'Синяя шариковая' },
  { hex: '#1B2A5E', name: 'Тёмно-синяя гелевая' },
  { hex: '#3E3172', name: 'Фиолетовая' },
  { hex: '#1A1A1A', name: 'Чёрная' },
];
