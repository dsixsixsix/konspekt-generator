import { useCallback, useEffect, useState } from 'react';
import { loadMetrics, type FontMetrics } from '../core/measure.ts';

export interface FontEntry {
  id: string;
  file: string;
  name: string;
  note: string;
  size: number;
}

export interface LoadedFont {
  id: string;
  family: string;
  bytes: Uint8Array;
  metrics: FontMetrics;
}

/** Один и тот же файл шрифта кормит и метрики раскладки, и рендер в DOM. */
async function adopt(id: string, bytes: Uint8Array): Promise<LoadedFont> {
  const family = `hand-${id}`;
  const face = new FontFace(family, bytes.slice().buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  return { id, family, bytes, metrics: loadMetrics(bytes) };
}

export function useFont() {
  const [catalog, setCatalog] = useState<FontEntry[]>([]);
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/fonts/fonts.json')
      .then(r => r.json() as Promise<FontEntry[]>)
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const select = useCallback(async (entry: FontEntry) => {
    setError(null);
    try {
      const res = await fetch(`/fonts/${entry.file}`);
      if (!res.ok) throw new Error(String(res.status));
      setFont(await adopt(entry.id, new Uint8Array(await res.arrayBuffer())));
    } catch {
      setError(`Файла /fonts/${entry.file} нет. Запусти pnpm fonts или загрузи шрифт вручную.`);
      setFont(null);
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setFont(await adopt(`user-${Date.now()}`, bytes));
    } catch {
      setError('Не удалось прочитать шрифт. Нужен .ttf или .otf — woff2 не подходит.');
    }
  }, []);

  useEffect(() => {
    if (catalog.length && !font) void select(catalog[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  return { catalog, font, error, select, upload };
}
