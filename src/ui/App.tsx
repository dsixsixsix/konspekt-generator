import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { layoutText } from '../core/layout.ts';
import { makeStrokes } from '../core/handwriting.ts';
import { renderPdf, renderBookletPdf, sheetSize } from '../core/pdf.ts';
import { imposeBooklet, type Binding } from '../core/booklet.ts';
import { SHEETS, type SheetKey } from '../core/presets.ts';
import type { Hand, Notebook } from '../core/types.ts';
import Controls, { type View } from './Controls.tsx';
import Sheet from './Sheet.tsx';
import SheetPair from './SheetPair.tsx';
import BookletMock from './BookletMock.tsx';
import Lazy from './Lazy.tsx';
import { usePrintMount } from './usePrintMount.ts';
import { useFont, type FontEntry } from './useFont.ts';
import { plural } from './plural.ts';
import { clearSettings, loadSettings, saveSettings } from './persist.ts';

export interface Booklet {
  /** Листов A4 в тетрадке. 0 — вся книга одной пачкой. */
  sheetsPerSignature: number;
  binding: Binding;
  /** Обороты перевёрнуты на 180° — для принтеров с переворотом по длинной стороне. */
  flipBacks: boolean;
}

export interface ThemeEntry {
  file: string;
  name: string;
}

// Настройки прошлого сеанса читаются один раз, до первого рендера.
const saved = loadSettings();

export default function App() {
  const [text, setText] = useState(saved.text);
  const [textRevision, setTextRevision] = useState(0);
  const [sheet, setSheet] = useState<SheetKey>(saved.sheet);
  const [notebook, setNotebook] = useState<Notebook>(saved.notebook);
  const [hand, setHand] = useState<Hand>(saved.hand);
  const [seed, setSeed] = useState(saved.seed);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>(saved.view);
  const [booklet, setBooklet] = useState<Booklet>(saved.booklet);
  const [themes, setThemes] = useState<ThemeEntry[]>([]);
  const { catalog, font, error, select, upload } = useFont(saved.fontId);

  // Тяжёлый пересчёт отстаёт от ввода на один кадр: набор текста не тормозит.
  const laidText = useDeferredValue(text);
  const stale = laidText !== text;
  const printing = usePrintMount();

  // Готовые конспекты лежат в public/themes рядом со шрифтами.
  useEffect(() => {
    fetch('/themes/index.json')
      .then(r => (r.ok ? r.json() : []))
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);

  // Пишем с задержкой: ползунок за одно движение шлёт десятки значений.
  useEffect(() => {
    const id = setTimeout(() => saveSettings({
      text, sheet, notebook, hand, booklet, view, seed,
      fontId: font && !font.id.startsWith('user-') ? font.id : null,
    }), 400);
    return () => clearTimeout(id);
  }, [text, sheet, notebook, hand, booklet, view, seed, font]);

  const patchNotebook = useCallback((patch: Partial<Notebook>) => {
    setNotebook(prev => ({ ...prev, ...patch }));
  }, []);
  const patchHand = useCallback((patch: Partial<Hand>) => {
    setHand(prev => ({ ...prev, ...patch }));
  }, []);
  const patchBooklet = useCallback((patch: Partial<Booklet>) => {
    setBooklet(prev => ({ ...prev, ...patch }));
  }, []);

  const changeSheet = useCallback((key: SheetKey) => {
    setSheet(key);
    patchNotebook({ pageW: SHEETS[key].pageW, pageH: SHEETS[key].pageH });
  }, [patchNotebook]);

  const selectFont = useCallback((entry: FontEntry) => {
    void select(entry);
    patchHand({ size: entry.size });
  }, [select, patchHand]);

  const loadTheme = useCallback((file: string) => {
    void fetch(`/themes/${file}`)
      .then(r => (r.ok ? r.text() : ''))
      .then(t => { if (t) { setText(t); setTextRevision(r => r + 1); } });
  }, []);

  // Вёрстка стоит дороже штрихов и зависит только от текста, шрифта и полей.
  // Ползунки живости письма её не трогают.
  const laid = useMemo(() => {
    if (!font) return [];
    return layoutText({
      text: laidText, notebook, seed, fixes: hand.fixes,
      measure: font.metrics.measurerFor(hand.size),
      spaceWidth: font.metrics.spaceWidth(hand.size) * 1.45,
    });
  }, [laidText, notebook, seed, hand.fixes, hand.size, font]);

  const pages = useMemo(
    () => (font ? makeStrokes(laid, notebook, hand, seed) : []),
    [laid, notebook, hand, seed, font],
  );

  const imposed = useMemo(
    () => imposeBooklet(pages.length, {
      sheetsPerSignature: booklet.sheetsPerSignature,
      binding: booklet.binding,
    }),
    [pages.length, booklet.sheetsPerSignature, booklet.binding],
  );

  const resetSettings = useCallback(() => {
    clearSettings();
    location.reload();
  }, []);

  const exportPdf = useCallback(async (mode: 'pages' | 'booklet') => {
    if (!font) return;
    setBusy(true);
    try {
      const common = { pages, notebook, hand, fontBytes: font.bytes, title: 'Конспект' };
      const bytes = mode === 'booklet'
        ? await renderBookletPdf({ ...common, ...booklet })
        : await renderPdf(common);
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'booklet' ? 'konspekt-tetrad.pdf' : 'konspekt.pdf';
      // Ссылка должна быть в документе, а адрес blob жить дольше клика:
      // иначе часть браузеров отменяет скачивание.
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(false);
    }
  }, [pages, notebook, hand, font, booklet]);

  const stats = font
    ? [
        plural(pages.length, 'страница', 'страницы', 'страниц'),
        `${plural(imposed.length, 'лист', 'листа', 'листов')} A4`,
        `${text.replace(/\s+/g, '').length} знаков`,
      ]
    : ['шрифт не загружен'];

  const a4 = sheetSize(notebook);

  return (
    <div className="flex min-h-screen">
      <Controls
        text={text} textRevision={textRevision} onText={setText}
        notebook={notebook} onNotebook={patchNotebook}
        hand={hand} onHand={patchHand}
        sheet={sheet} onSheet={changeSheet}
        catalog={catalog} font={font} fontError={error}
        onSelectFont={selectFont} onUploadFont={f => void upload(f)}
        onShuffle={() => setSeed(Math.floor(Math.random() * 1e9))}
        onReset={resetSettings}
        onPdf={mode => void exportPdf(mode)}
        busy={busy} stats={stats} stale={stale}
        view={view} onView={setView}
        booklet={booklet} onBooklet={patchBooklet}
        themes={themes} onTheme={loadTheme}
      />
      <main className="stage flex flex-1 flex-col items-center gap-6 overflow-x-auto p-7">
        {view === 'pages' && pages.map((page, i) => (
          <Lazy key={page.number} width={notebook.pageW} height={notebook.pageH}
            eager={printing} initial={i < 2}>
            {() => (
              <Sheet page={page} notebook={notebook} hand={hand} family={font!.family} />
            )}
          </Lazy>
        ))}

        {view === 'sheets' && imposed.flatMap((s, si) => (['front', 'back'] as const).map(side => (
          <figure key={`${s.index}-${side}`} className="flex flex-col items-center gap-2">
            <Lazy width={a4.w} height={a4.h} eager={printing} initial={si === 0}>
              {() => (
                <SheetPair
                  sheet={s} side={side} pages={pages}
                  notebook={notebook} hand={hand} family={font!.family}
                />
              )}
            </Lazy>
            <figcaption className="no-print font-mono text-[11px] opacity-55">
              лист {s.index + 1}, {side === 'front' ? 'лицо' : 'оборот'}, тетрадка {s.signature + 1}
            </figcaption>
          </figure>
        )))}

        {view === 'mock' && (
          <BookletMock
            pageCount={pages.length}
            sheetsPerSignature={booklet.sheetsPerSignature}
            binding={booklet.binding}
          />
        )}

        {!pages.length && (
          <p className="no-print max-w-[60ch] pt-10 text-center text-sm opacity-60">
            {error ?? 'Вставь текст темы слева. Страницы пересобираются на лету.'}
          </p>
        )}
      </main>
    </div>
  );
}
