/**
 * Спуск полос под тетрадь: два конспектных листа на одном A4, лист сгибается
 * пополам, листы вкладываются друг в друга и сшиваются по сгибу.
 *
 * Порядок половинок неочевиден: на внешнем листе рядом оказываются первая и
 * последняя страницы, на следующем — вторая с конца и вторая с начала. Считаем
 * это здесь, чтобы и печать, и макет брали один и тот же расчёт.
 */

export type Binding = 'left' | 'right';

/** Половина A4-листа. null — пустая страница добивки до кратности четырём. */
export type Half = number | null;

export interface BookletSheet {
  /** Номер A4-листа по порядку печати, с нуля. */
  index: number;
  /** Номер тетрадки (пачки вложенных листов), с нуля. */
  signature: number;
  /** Лицо листа: [левая половина, правая половина], индексы страниц с нуля. */
  front: [Half, Half];
  /** Оборот. Перевёрнут через длинную сторону: левая половина оборота — та же
   *  сторона сгиба, что и правая половина лица. */
  back: [Half, Half];
}

export interface BookletOptions {
  /** Листов A4 в одной тетрадке. 0 — вся книга одной пачкой. */
  sheetsPerSignature?: number;
  /** Сторона сшивки: 'left' — обложка справа на лицевой стороне внешнего листа. */
  binding?: Binding;
}

/**
 * Раскладка страниц по A4-листам. Возвращает листы в порядке печати:
 * лист 1 лицо, лист 1 оборот, лист 2 лицо, ...
 */
export function imposeBooklet(pageCount: number, options: BookletOptions = {}): BookletSheet[] {
  const binding = options.binding ?? 'left';
  const perSignature = Math.max(0, Math.floor(options.sheetsPerSignature ?? 0));

  if (pageCount <= 0) return [];

  // Пустые страницы в конце: тетрадь всегда кратна четырём страницам.
  const total = Math.ceil(pageCount / 4) * 4;
  const chunk = perSignature > 0 ? perSignature * 4 : total;

  const sheets: BookletSheet[] = [];
  for (let start = 0; start < total; start += chunk) {
    const size = Math.min(chunk, total - start);
    const signature = sheets.length ? sheets[sheets.length - 1]!.signature + 1 : 0;

    for (let i = 0; i < size / 4; i++) {
      // Внутри тетрадки: внешний лист несёт первую и последнюю страницы пачки.
      const first = start + 2 * i;           // 0-я, 2-я, 4-я … страница пачки
      const last = start + size - 1 - 2 * i; // и симметричные ей с конца

      sheets.push({
        index: sheets.length,
        signature,
        front: pair(page(last, pageCount), page(first, pageCount), binding),
        back: pair(page(first + 1, pageCount), page(last - 1, pageCount), binding),
      });
    }
  }
  return sheets;
}

/** Страница за пределами текста — пустая половина. */
function page(index: number, pageCount: number): Half {
  return index < pageCount ? index : null;
}

/** При сшивке справа половинки меняются местами. */
function pair(left: Half, right: Half, binding: Binding): [Half, Half] {
  return binding === 'right' ? [right, left] : [left, right];
}

/**
 * Порядок чтения собранной тетрадки: сложили листы, вложили друг в друга,
 * листаем. Половинки идут не подряд — сначала правые половины лиц от внешнего
 * листа к внутреннему, потом обратный ход по оборотам. Служит проверкой:
 * результат обязан совпасть с 0, 1, 2, … по всей книге.
 */
export function readingOrder(sheets: BookletSheet[], binding: Binding = 'left'): Half[] {
  const order: Half[] = [];
  const bySignature = new Map<number, BookletSheet[]>();
  for (const sheet of sheets) {
    const list = bySignature.get(sheet.signature) ?? [];
    list.push(sheet);
    bySignature.set(sheet.signature, list);
  }

  for (const stack of bySignature.values()) {
    // Наружные листы первыми: их правые половины открываются раньше.
    for (const sheet of stack) {
      const [outer, inner] = sides(sheet, binding);
      // Правая половина лица, за ней её же оборотная сторона — левая половина оборота.
      order.push(inner.front, outer.back);
    }
    // Обратно к обложке: вторая половина разворота.
    for (const sheet of [...stack].reverse()) {
      const [outer, inner] = sides(sheet, binding);
      order.push(inner.back, outer.front);
    }
  }
  return order;
}

/**
 * Половины листа в терминах «ближе к сгибу» и «ближе к обрезу»: при сшивке
 * справа лево и право меняются местами, а физика листания не меняется.
 */
function sides(sheet: BookletSheet, binding: Binding) {
  const flip = binding === 'right';
  const outer = {
    front: flip ? sheet.front[1] : sheet.front[0],
    back: flip ? sheet.back[1] : sheet.back[0],
  };
  const inner = {
    front: flip ? sheet.front[0] : sheet.front[1],
    back: flip ? sheet.back[0] : sheet.back[1],
  };
  return [outer, inner] as const;
}
