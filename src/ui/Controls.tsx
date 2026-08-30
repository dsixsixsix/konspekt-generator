import type { ChangeEvent } from 'react';
import { INKS, SHEETS, type SheetKey } from '../core/presets.ts';
import type { Hand, Notebook } from '../core/types.ts';
import type { FontEntry, LoadedFont } from './useFont.ts';

interface Props {
  text: string;
  onText: (v: string) => void;
  notebook: Notebook;
  onNotebook: (patch: Partial<Notebook>) => void;
  hand: Hand;
  onHand: (patch: Partial<Hand>) => void;
  sheet: SheetKey;
  onSheet: (v: SheetKey) => void;
  catalog: FontEntry[];
  font: LoadedFont | null;
  fontError: string | null;
  onSelectFont: (e: FontEntry) => void;
  onUploadFont: (f: File) => void;
  onShuffle: () => void;
  onPdf: () => void;
  busy: boolean;
  stats: string;
}

const field = 'w-full rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.06] px-2.5 py-2 text-sm';
const legend = 'text-[10.5px] font-semibold uppercase tracking-[0.09em] opacity-60 border-b border-black/10 dark:border-white/10 pb-1.5';

function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs opacity-70">{props.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-blue-700 dark:text-blue-300">
          {props.format(props.value)}
        </span>
      </span>
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(+e.target.value)}
        className="w-full accent-blue-700 dark:accent-blue-300"
      />
    </label>
  );
}

export default function Controls(p: Props) {
  return (
    <aside className="no-print sticky top-0 flex h-screen w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#1c1f27]">
      <header>
        <h1 className="text-[19px] font-semibold tracking-tight">Конспект от руки</h1>
        <p className="text-xs opacity-60">Текст → страницы под тетрадь в клетку</p>
      </header>

      <section className="flex flex-col gap-2.5">
        <div className={legend}>Текст</div>
        <textarea
          value={p.text} onChange={e => p.onText(e.target.value)} spellCheck={false}
          className={`${field} min-h-[150px] resize-y leading-relaxed`}
        />
        <div className="font-mono text-[11px] tabular-nums opacity-60">{p.stats}</div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className={legend}>Почерк</div>
        <select
          className={field}
          value={p.font?.id ?? ''}
          onChange={e => {
            const entry = p.catalog.find(c => c.id === e.target.value);
            if (entry) p.onSelectFont(entry);
          }}
        >
          {p.font?.id.startsWith('user-') && <option value={p.font.id}>Загруженный шрифт</option>}
          {p.catalog.map(c => (
            <option key={c.id} value={c.id}>{c.name} — {c.note}</option>
          ))}
        </select>
        {p.fontError && <p className="text-xs text-red-600 dark:text-red-400">{p.fontError}</p>}

        <label className="cursor-pointer rounded-lg border border-dashed border-black/20 p-2.5 text-center text-xs opacity-70 hover:border-blue-600 hover:opacity-100 dark:border-white/20">
          Загрузить свой .ttf / .otf
          <input
            type="file" accept=".ttf,.otf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) p.onUploadFont(f); }}
          />
        </label>

        <Slider label="Размер букв" value={p.hand.size} min={3} max={8} step={0.1}
          format={v => `${v.toFixed(1)} мм`} onChange={v => p.onHand({ size: v })} />
        <Slider label="Наклон" value={p.hand.slant} min={-8} max={12} step={0.5}
          format={v => `${v.toFixed(1)}°`} onChange={v => p.onHand({ slant: v })} />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs opacity-70">Цвет чернил</span>
          <div className="flex gap-2">
            {INKS.map(i => (
              <button
                key={i.hex} title={i.name} aria-label={i.name}
                onClick={() => p.onHand({ ink: i.hex })}
                className={`size-6 rounded-full ring-1 ring-black/20 ${p.hand.ink === i.hex ? 'outline-2 outline-offset-2 outline-blue-600' : ''}`}
                style={{ background: i.hex }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className={legend}>Живость письма</div>
        <Slider label="Дрожание слов" value={p.hand.jitter} min={0} max={2} step={0.05}
          format={v => `${Math.round(v * 100)} %`} onChange={v => p.onHand({ jitter: v })} />
        <Slider label="Дрейф строки" value={p.hand.drift} min={0} max={2} step={0.05}
          format={v => `${Math.round(v * 100)} %`} onChange={v => p.onHand({ drift: v })} />
        <Slider label="Смещение строк" value={p.hand.lineShift} min={0} max={4} step={0.1}
          format={v => `±${v.toFixed(1)} мм`} onChange={v => p.onHand({ lineShift: v })} />
        <Slider label="Нажим на ручку" value={p.hand.pressure} min={0} max={1} step={0.05}
          format={v => `${Math.round(v * 100)} %`} onChange={v => p.onHand({ pressure: v })} />
        <Slider label="Усталость к концу страницы" value={p.hand.fatigue} min={0} max={1} step={0.05}
          format={v => `${Math.round(v * 100)} %`} onChange={v => p.onHand({ fatigue: v })} />
        <Slider label="Дрожание букв" value={p.hand.charJitter} min={0} max={1} step={0.05}
          format={v => `${Math.round(v * 100)} %`} onChange={v => p.onHand({ charJitter: v })} />
        <p className="font-mono text-[11px] leading-relaxed opacity-55">
          Дрожание букв рвёт связки в курсиве. Держи на нуле, если шрифт связный.
        </p>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className={legend}>Тетрадь</div>
        <div className="flex gap-2.5">
          <label className="flex flex-1 flex-col gap-1 text-xs opacity-70">
            Формат
            <select className={field} value={p.sheet} onChange={e => p.onSheet(e.target.value as SheetKey)}>
              {Object.entries(SHEETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs opacity-70">
            Строка, клеток
            <select className={field} value={p.notebook.cellsPerLine}
              onChange={e => p.onNotebook({ cellsPerLine: +e.target.value })}>
              <option value={1}>1 (5 мм)</option>
              <option value={2}>2 (10 мм)</option>
              <option value={3}>3 (15 мм)</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs opacity-70">
          Поля (красная линия)
          <select className={field} value={p.notebook.marginSide}
            onChange={e => p.onNotebook({ marginSide: e.target.value as Notebook['marginSide'] })}>
            <option value="alt-right">Чередовать, 1-я страница справа</option>
            <option value="alt-left">Чередовать, 1-я страница слева</option>
            <option value="right">Всегда справа</option>
            <option value="left">Всегда слева</option>
          </select>
        </label>

        <div className="flex gap-2.5">
          <label className="flex flex-1 flex-col gap-1 text-xs opacity-70">
            Ширина поля, мм
            <input type="number" className={field} value={p.notebook.field}
              onChange={e => p.onNotebook({ field: +e.target.value })} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs opacity-70">
            Отступ у корешка, мм
            <input type="number" className={field} value={p.notebook.edge}
              onChange={e => p.onNotebook({ edge: +e.target.value })} />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 text-[13px]">
          {([
            ['drawGrid', 'Рисовать клетку'],
            ['drawRule', 'Рисовать красную линию'],
            ['pageNumbers', 'Номера страниц'],
            ['indent', 'Красная строка у абзацев'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={p.notebook[key]}
                onChange={e => p.onNotebook({ [key]: e.target.checked } as Partial<Notebook>)}
                className="size-4 accent-blue-700 dark:accent-blue-300" />
              {label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <button onClick={p.onShuffle}
          className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm hover:border-blue-600 dark:border-white/20">
          Переписать заново
        </button>
        <button onClick={p.onPdf} disabled={p.busy || !p.font}
          className="flex-1 rounded-lg bg-blue-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-blue-300 dark:text-[#12141a]">
          {p.busy ? 'Собираю…' : 'Скачать PDF'}
        </button>
      </div>

      <p className="font-mono text-[11px] leading-relaxed opacity-55">
        Печатаешь на настоящей тетрадной бумаге — сними «Рисовать клетку».
        В диалоге печати: масштаб 100 %, поля «нет».
      </p>
    </aside>
  );
}
