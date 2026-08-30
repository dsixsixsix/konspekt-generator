import { memo } from 'react';
import type { BookletSheet, Half } from '../core/booklet.ts';
import { sheetSize } from '../core/pdf.ts';
import type { Hand, Notebook, PageDraw } from '../core/types.ts';
import Sheet from './Sheet.tsx';

interface Props {
  sheet: BookletSheet;
  side: 'front' | 'back';
  pages: PageDraw[];
  notebook: Notebook;
  hand: Hand;
  family: string;
}

/** Печатный лист A4: две конспектные страницы рядом, между ними линия сгиба. */
function SheetPair({ sheet, side, pages, notebook: nb, hand, family }: Props) {
  const size = sheetSize(nb);
  const halves = side === 'front' ? sheet.front : sheet.back;
  const slack = (size.w / 2 - nb.pageW) / 2;

  return (
    <div className="printsheet" style={{ width: `${size.w}mm`, height: `${size.h}mm` }}>
      {halves.map((half, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: `${slack + i * (size.w / 2)}mm` }}>
          <Sheet
            page={pageFor(half, pages, i === 0)}
            notebook={half === null ? { ...nb, pageNumbers: false } : nb}
            hand={hand}
            family={family}
          />
        </div>
      ))}
      <div className="fold" style={{ left: `${size.w / 2}mm` }} />
    </div>
  );
}

export default memo(SheetPair);

/** Пустая половина: линовка есть, текста нет. */
function pageFor(half: Half, pages: PageDraw[], leftSide: boolean): PageDraw {
  const page = half === null ? undefined : pages[half];
  return page ?? { ruleRight: leftSide, words: [], blots: [], number: 0 };
}
