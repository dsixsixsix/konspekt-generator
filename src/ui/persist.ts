import type { Binding } from '../core/booklet.ts';
import { defaultHand, defaultNotebook, SHEETS, type SheetKey } from '../core/presets.ts';
import type { Hand, Notebook } from '../core/types.ts';
import type { Booklet } from './App.tsx';
import type { View } from './Controls.tsx';
import { SAMPLE } from './sample.ts';

const KEY = 'konspekt:settings:v1';

export interface Settings {
  text: string;
  sheet: SheetKey;
  notebook: Notebook;
  hand: Hand;
  booklet: Booklet;
  view: View;
  seed: number;
  fontId: string | null;
}

export function defaultSettings(): Settings {
  return {
    text: SAMPLE,
    sheet: 'a5',
    notebook: defaultNotebook('a5'),
    hand: defaultHand(),
    booklet: { sheetsPerSignature: 4, binding: 'left', flipBacks: false },
    view: 'pages',
    seed: Math.floor(Math.random() * 1e9),
    fontId: null,
  };
}

/**
 * Настройки переживают перезагрузку. Чужие и устаревшие поля отбрасываются:
 * из хранилища берётся только то, что совпадает по типу со значением по
 * умолчанию, иначе одна кривая запись ломала бы весь редактор.
 */
export function loadSettings(): Settings {
  const base = defaultSettings();
  const raw = read();
  if (!raw) return base;

  const view: View[] = ['pages', 'sheets', 'mock'];
  const binding: Binding[] = ['left', 'right'];

  const sheet = str(raw.sheet) && raw.sheet in SHEETS ? (raw.sheet as SheetKey) : base.sheet;
  return {
    text: typeof raw.text === 'string' ? raw.text : base.text,
    sheet,
    notebook: merge(defaultNotebook(sheet), raw.notebook, {
      marginSide: ['alt-right', 'alt-left', 'left', 'right'],
    }),
    hand: merge(base.hand, raw.hand),
    booklet: merge(base.booklet, raw.booklet, { binding }),
    view: view.includes(raw.view as View) ? (raw.view as View) : base.view,
    seed: Number.isFinite(raw.seed) ? Number(raw.seed) : base.seed,
    fontId: str(raw.fontId) ? (raw.fontId as string) : null,
  };
}

export function saveSettings(value: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Приватный режим или переполненное хранилище: работаем без сохранения.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Нечего чистить.
  }
}

function read(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): v is string => typeof v === 'string';

/** Берёт из сохранённого объекта поля, совпадающие по типу с образцом. */
function merge<T extends object>(base: T, raw: unknown, allowed: Partial<Record<keyof T, unknown[]>> = {}): T {
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base) as (keyof T)[]) {
    const value = (raw as Record<string, unknown>)[key as string];
    if (value === undefined || typeof value !== typeof base[key]) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const list = allowed[key];
    if (list && !list.includes(value)) continue;
    out[key] = value as T[keyof T];
  }
  return out;
}
