import type { Hand, Notebook, PageDraw } from '../core/types.ts';

interface Props {
  page: PageDraw;
  notebook: Notebook;
  hand: Hand;
  family: string;
}

/** DOM-превью страницы. Координаты приходят готовыми — считает их core. */
export default function Sheet({ page, notebook: nb, hand, family }: Props) {
  return (
    <div
      className={`sheet${nb.drawGrid ? ' sheet--grid' : ''}`}
      style={{ width: `${nb.pageW}mm`, height: `${nb.pageH}mm` }}
    >
      {nb.drawRule && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '0.25mm',
            background: 'color-mix(in srgb, var(--color-rule) 55%, transparent)',
            left: `${page.ruleRight ? nb.pageW - nb.field + 2 : nb.field - 2}mm`,
          }}
        />
      )}

      {page.words.map((w, i) => (
        <span
          key={i}
          className="word"
          style={{
            left: `${w.x}mm`,
            top: `${w.baseline}mm`,
            fontFamily: `"${family}", cursive`,
            fontSize: `${hand.size}mm`,
            color: hand.ink,
            opacity: w.opacity,
            WebkitTextStroke: w.weight > 0.004 ? `${w.weight}mm ${hand.ink}` : undefined,
            transform: `translateY(-100%) rotate(${w.rotate}deg) scale(${w.scale}) skewX(${-w.skew}deg)`,
          }}
        >
          {w.chars
            ? w.chars.map((c, j) => (
                <span key={j} style={{ transform: `translate(${c.dx}mm, ${c.dy}mm)` }}>
                  {c.ch}
                </span>
              ))
            : w.text}
        </span>
      ))}

      {nb.pageNumbers && (
        <span
          style={{
            position: 'absolute',
            bottom: `${Math.max(2, nb.bottom - 5)}mm`,
            [page.ruleRight ? 'right' : 'left']: `${page.ruleRight ? nb.field : nb.edge}mm`,
            fontFamily: `"${family}", cursive`,
            fontSize: `${hand.size * 0.8}mm`,
            color: hand.ink,
            opacity: 0.75,
          }}
        >
          {page.number}
        </span>
      )}
    </div>
  );
}
