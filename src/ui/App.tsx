import { useCallback, useMemo, useState } from 'react';
import { layoutText } from '../core/layout.ts';
import { makeStrokes } from '../core/handwriting.ts';
import { renderPdf } from '../core/pdf.ts';
import { defaultHand, defaultNotebook, SHEETS, type SheetKey } from '../core/presets.ts';
import type { Hand, Notebook } from '../core/types.ts';
import Controls from './Controls.tsx';
import Sheet from './Sheet.tsx';
import { useFont, type FontEntry } from './useFont.ts';
import { SAMPLE } from './sample.ts';

export default function App() {
  const [text, setText] = useState(SAMPLE);
  const [sheet, setSheet] = useState<SheetKey>('a5');
  const [notebook, setNotebook] = useState<Notebook>(() => defaultNotebook('a5'));
  const [hand, setHand] = useState<Hand>(defaultHand);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [busy, setBusy] = useState(false);
  const { catalog, font, error, select, upload } = useFont();

  const patchNotebook = useCallback((patch: Partial<Notebook>) => {
    setNotebook(prev => ({ ...prev, ...patch }));
  }, []);
  const patchHand = useCallback((patch: Partial<Hand>) => {
    setHand(prev => ({ ...prev, ...patch }));
  }, []);

  const changeSheet = useCallback((key: SheetKey) => {
    setSheet(key);
    patchNotebook({ pageW: SHEETS[key].pageW, pageH: SHEETS[key].pageH });
  }, [patchNotebook]);

  const selectFont = useCallback((entry: FontEntry) => {
    void select(entry);
    patchHand({ size: entry.size });
  }, [select, patchHand]);

  const pages = useMemo(() => {
    if (!font) return [];
    const laid = layoutText({
      text, notebook, seed,
      measure: font.metrics.measurerFor(hand.size),
      spaceWidth: font.metrics.spaceWidth(hand.size) * 1.45,
    });
    return makeStrokes(laid, notebook, hand, seed);
  }, [text, notebook, hand, seed, font]);

  const exportPdf = useCallback(async () => {
    if (!font) return;
    setBusy(true);
    try {
      const bytes = await renderPdf({ pages, notebook, hand, fontBytes: font.bytes, title: 'Конспект' });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'konspekt.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }, [pages, notebook, hand, font]);

  const stats = font
    ? `${pages.length} стр. · ${text.replace(/\s+/g, '').length} знаков`
    : 'шрифт не загружен';

  return (
    <div className="flex min-h-screen">
      <Controls
        text={text} onText={setText}
        notebook={notebook} onNotebook={patchNotebook}
        hand={hand} onHand={patchHand}
        sheet={sheet} onSheet={changeSheet}
        catalog={catalog} font={font} fontError={error}
        onSelectFont={selectFont} onUploadFont={f => void upload(f)}
        onShuffle={() => setSeed(Math.floor(Math.random() * 1e9))}
        onPdf={() => void exportPdf()}
        busy={busy} stats={stats}
      />
      <main className="stage flex flex-1 flex-col items-center gap-6 overflow-x-auto p-7">
        {pages.map(page => (
          <Sheet key={page.number} page={page} notebook={notebook} hand={hand} family={font!.family} />
        ))}
        {!pages.length && (
          <p className="no-print max-w-[60ch] pt-10 text-center text-sm opacity-60">
            {error ?? 'Вставь текст темы слева. Страницы пересобираются на лету.'}
          </p>
        )}
      </main>
    </div>
  );
}
