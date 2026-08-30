import { memo } from 'react';
import type { Hand, Notebook, PageDraw, WordDraw } from '../core/types.ts';

interface Props {
  page: PageDraw;
  notebook: Notebook;
  hand: Hand;
  family: string;
}

/** DOM-превью страницы. Координаты приходят готовыми — считает их core. */
function Sheet({ page, notebook: nb, hand, family }: Props) {
  const wordStyle = (w: WordDraw, opacity: number, dx = 0, dy = 0) => ({
    left: `${w.x + dx}mm`,
    top: `${w.baseline + dy}mm`,
    fontFamily: `"${family}", cursive`,
    fontSize: `${hand.size}mm`,
    color: hand.ink,
    opacity,
    WebkitTextStroke: w.weight > 0.004 ? `${w.weight}mm ${hand.ink}` : undefined,
    transform: `translateY(-100%) rotate(${w.rotate}deg) scale(${w.scale}) skewX(${-w.skew}deg)`,
  });

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
        <span key={`g${i}`}>
          {w.ghost && (
            <span className="word" style={wordStyle(w, w.ghost.opacity, w.ghost.x - w.x)}>
              {w.ghost.text}
            </span>
          )}
          {w.overwrite && (
            <span
              className="word"
              style={wordStyle(w, w.overwrite.opacity, w.overwrite.dx, w.overwrite.dy)}
            >
              {w.text}
            </span>
          )}
          <span className="word" style={wordStyle(w, w.opacity)}>
            {w.chars
              ? w.chars.map((c, j) => (
                  <span key={j} style={{ transform: `translate(${c.dx}mm, ${c.dy}mm)` }}>
                    {c.ch}
                  </span>
                ))
              : w.text}
          </span>
        </span>
      ))}

      {/* Чернильный слой: зачёркивания и пятна ложатся поверх букв. */}
      <svg
        className="ink-layer"
        viewBox={`0 0 ${nb.pageW} ${nb.pageH}`}
        style={{ width: `${nb.pageW}mm`, height: `${nb.pageH}mm` }}
      >
        {page.words.flatMap((w, i) =>
          (w.ghost?.strokes ?? []).map((s, j) => (
            <polyline
              key={`s${i}-${j}`}
              points={s.points.map(pt => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke={hand.ink}
              strokeWidth={s.thickness}
              strokeLinecap="round"
              opacity={s.opacity}
            />
          )),
        )}
        {page.blots.map((b, i) => (
          <ellipse
            key={`b${i}`}
            cx={b.x} cy={b.y} rx={b.rx} ry={b.ry}
            transform={`rotate(${b.rotate} ${b.x} ${b.y})`}
            fill={hand.ink}
            opacity={b.opacity}
          />
        ))}
      </svg>

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

/** Страниц много, а меняется обычно одна: лишние перерисовки стоят дорого. */
export default memo(Sheet);
