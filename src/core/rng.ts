/**
 * Хешированный шум вместо последовательного генератора.
 *
 * Важное свойство: значение зависит только от координат (страница, строка,
 * слово, канал) и от seed. Правка одного абзаца не перетряхивает всю тетрадь —
 * остальные страницы остаются буква в букву теми же.
 */
export function noise(seed: number, ...coords: number[]): number {
  let h = seed ^ 0x9e3779b9;
  for (const c of coords) {
    h = Math.imul(h ^ (c + 0x165667b1), 0x27d4eb2d);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Шум в диапазоне [-1, 1]. */
export function snoise(seed: number, ...coords: number[]): number {
  return noise(seed, ...coords) * 2 - 1;
}
