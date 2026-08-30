import { useMemo, useState } from 'react';
import { imposeBooklet, readingOrder, type Binding, type Half } from '../core/booklet.ts';
import { plural } from './plural.ts';

interface Props {
  pageCount: number;
  sheetsPerSignature: number;
  binding: Binding;
}

/**
 * Прототип тетради: как страницы конспекта ложатся на A4 и что получается
 * после сгиба и вкладки листов. Печать здесь ни при чём — это схема, на
 * которой видно порядок и можно его проверить руками.
 */
export default function BookletMock({ pageCount, sheetsPerSignature, binding }: Props) {
  const sheets = useMemo(
    () => imposeBooklet(pageCount, { sheetsPerSignature, binding }),
    [pageCount, sheetsPerSignature, binding],
  );
  const order = useMemo(() => readingOrder(sheets, binding), [sheets, binding]);

  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);

  const flip = (index: number) =>
    setFlipped(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  // Разворот: чётная позиция в порядке чтения — правая страница разворота.
  const spread = spreadAt(order, cursor);
  const place = locate(sheets, order[cursor] ?? null, binding);

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-7 pb-16">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.09em] opacity-60">
          Как листается собранная тетрадь
        </h2>

        <div className="flex items-center gap-4">
          <button className={navBtn} onClick={() => setCursor(c => Math.max(0, c - 2))}>
            Назад
          </button>
          <div className="flex flex-1 justify-center gap-1">
            <MockPage half={spread[0]} caption="левая" />
            <MockPage half={spread[1]} caption="правая" />
          </div>
          <button
            className={navBtn}
            onClick={() => setCursor(c => Math.min(order.length - 1, c + 2))}
          >
            Вперёд
          </button>
        </div>

        <p className="text-center font-mono text-[11px] opacity-70">
          {place
            ? `страница ${(order[cursor] ?? 0) + 1}: лист ${place.sheet + 1}, ${place.side}, ${place.half} половина`
            : 'пустая страница добивки'}
        </p>
        <p className="text-center font-mono text-[11px] opacity-55">
          Тетрадка {sheetsPerSignature > 0 ? `по ${plural(sheetsPerSignature, 'листу', 'листа', 'листов')}` : 'одной пачкой'},
          сшивка {binding === 'left' ? 'слева' : 'справа'}, всего {plural(sheets.length, 'лист', 'листа', 'листов')} A4
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.09em] opacity-60">
          Листы A4, клик переворачивает лист
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {sheets.map(sheet => {
            const back = flipped.has(sheet.index);
            const halves = back ? sheet.back : sheet.front;
            return (
              <button
                key={sheet.index}
                onClick={() => flip(sheet.index)}
                className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:border-blue-600 dark:border-white/15 dark:bg-white/[0.04]"
              >
                <div className="flex items-baseline justify-between font-mono text-[11px] opacity-70">
                  <span>лист {sheet.index + 1}</span>
                  <span>{back ? 'оборот' : 'лицо'}</span>
                </div>
                <div className="relative flex gap-0">
                  <MockHalf half={halves[0]} />
                  <MockHalf half={halves[1]} />
                  <span className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-black/30 dark:border-white/30" />
                </div>
                <div className="font-mono text-[10.5px] opacity-50">
                  тетрадка {sheet.signature + 1}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <p className="max-w-[70ch] font-mono text-[11px] leading-relaxed opacity-60">
        Сборка: печатать двусторонне, стопку не тасовать. Каждый лист согнуть
        пополам по пунктиру, листы одной тетрадки вложить друг в друга по
        порядку (первый лист самый внешний), тетрадки сложить подряд и сшить по сгибу.
      </p>
    </div>
  );
}

const navBtn =
  'rounded-lg border border-black/15 px-3 py-2 text-sm hover:border-blue-600 disabled:opacity-40 dark:border-white/20';

function MockPage({ half, caption }: { half: Half; caption: string }) {
  return (
    <div className="flex w-[150px] flex-col items-center gap-1">
      <div className="flex aspect-[148/210] w-full items-center justify-center rounded-md border border-black/12 bg-[var(--color-paper)] text-2xl font-semibold text-[#1a1d26] shadow-inner dark:border-white/15">
        {half === null ? <span className="text-sm opacity-40">пусто</span> : half + 1}
      </div>
      <span className="font-mono text-[10.5px] opacity-55">{caption}</span>
    </div>
  );
}

function MockHalf({ half }: { half: Half }) {
  return (
    <div className="flex aspect-[148/210] flex-1 items-center justify-center border border-black/10 bg-[var(--color-paper)] text-lg font-semibold text-[#1a1d26] dark:border-white/10">
      {half === null ? <span className="text-xs opacity-40">пусто</span> : half + 1}
    </div>
  );
}

/** Разворот вокруг позиции: левая страница — нечётная позиция чтения. */
function spreadAt(order: Half[], cursor: number): [Half, Half] {
  const right = cursor % 2 === 0 ? cursor : cursor - 1;
  return [right === 0 ? null : order[right - 1] ?? null, order[right] ?? null];
}

/** Где физически лежит страница: лист, сторона, половина. */
function locate(sheets: ReturnType<typeof imposeBooklet>, page: Half, binding: Binding) {
  if (page === null) return null;
  for (const sheet of sheets) {
    for (const side of ['front', 'back'] as const) {
      const halves = sheet[side];
      const index = halves.indexOf(page);
      if (index < 0) continue;
      const left = binding === 'left' ? index === 0 : index === 1;
      return {
        sheet: sheet.index,
        side: side === 'front' ? 'лицо' : 'оборот',
        half: left ? 'левая' : 'правая',
      };
    }
  }
  return null;
}
