import { INKS, SHEETS, type SheetKey } from '../core/presets.ts';
import type { Binding } from '../core/booklet.ts';
import type { Hand, Notebook } from '../core/types.ts';
import type { Booklet, ThemeEntry } from './App.tsx';
import type { FontEntry, LoadedFont } from './useFont.ts';
import { Choice, Group, Note, NumberBox, Param, Segmented, Slider, TextArea, Toggle } from './Field.tsx';

/** Что показывать справа: страницы, печатные листы A4 или схему сборки. */
export type View = 'pages' | 'sheets' | 'mock';

interface Props {
  text: string;
  /** Растёт, когда текст меняют мимо поля ввода: поле надо перемонтировать. */
  textRevision: number;
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
  onReset: () => void;
  onPdf: (mode: 'pages' | 'booklet') => void;
  busy: boolean;
  stats: string[];
  stale: boolean;
  view: View;
  onView: (v: View) => void;
  booklet: Booklet;
  onBooklet: (patch: Partial<Booklet>) => void;
  themes: ThemeEntry[];
  onTheme: (file: string) => void;
}

const percent = (v: number) => `${Math.round(v * 100)} %`;

export default function Controls(p: Props) {
  return (
    <aside className="panel no-print">
      <header>
        <h1>Конспект от руки</h1>
        <p className="panel__sub">Страницы под тетрадь в клетку</p>
      </header>

      <Group name="Вид">
        <Segmented
          label="Что показывать"
          info="Страницы показывают конспект по одному листу. Листы A4 собирают страницы по две на печатный лист. Макет показывает порядок сборки без текста."
          value={p.view}
          onChange={p.onView}
          options={[
            { value: 'pages', label: 'Страницы' },
            { value: 'sheets', label: 'Листы A4' },
            { value: 'mock', label: 'Макет' },
          ]}
        />
      </Group>

      <Group name="Текст">
        {p.themes.length > 0 && (
          <Param
            label="Готовый конспект"
            info="Тексты лежат в папке public/themes. Выбор подставляет файл целиком, дальше его можно править в поле ниже."
          >
            {id => (
              <select id={id} className="control" defaultValue=""
                onChange={e => { if (e.target.value) p.onTheme(e.target.value); }}>
                <option value="">Не выбран</option>
                {p.themes.map(t => <option key={t.file} value={t.file}>{t.name}</option>)}
              </select>
            )}
          </Param>
        )}

        <Param
          label="Свой текст"
          info="Абзацы разделяются пустой строкой, у каждого будет красная строка. Страницы пересобираются на лету; большой текст обновляется с небольшой задержкой, чтобы ввод не тормозил."
        >
          {id => (
            <TextArea id={id} value={p.text} revision={p.textRevision} onChange={p.onText} />
          )}
        </Param>

        <div className={`stats${p.stale ? ' stats--stale' : ''}`}>
          {p.stats.map(s => <span key={s}>{s}</span>)}
          {p.stale && <span>пересчёт</span>}
        </div>
      </Group>

      <Group name="Почерк">
        <Param
          label="Шрифт"
          info="Ширины букв читаются из файла шрифта, поэтому превью и PDF совпадают буква в букву. Связные шрифты выглядят ближе к настоящей рукописи."
        >
          {id => (
            <select
              id={id}
              className="control"
              value={p.font?.id ?? ''}
              onChange={e => {
                const entry = p.catalog.find(c => c.id === e.target.value);
                if (entry) p.onSelectFont(entry);
              }}
            >
              {p.font?.id.startsWith('user-') && <option value={p.font.id}>Загруженный шрифт</option>}
              {p.catalog.map(c => (
                <option key={c.id} value={c.id}>{c.name}, {c.note}</option>
              ))}
            </select>
          )}
        </Param>

        {p.fontError && <p className="error">{p.fontError}</p>}

        <label className="dropzone">
          Загрузить свой .ttf или .otf
          <input
            type="file" accept=".ttf,.otf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) p.onUploadFont(f); }}
          />
        </label>

        <Slider
          label="Размер букв" value={p.hand.size} min={3} max={8} step={0.1}
          format={v => `${v.toFixed(1)} мм`} onChange={v => p.onHand({ size: v })}
          info="Высота кегля в миллиметрах. От размера зависит, сколько слов помещается в строку и сколько выйдет страниц."
        />
        <Slider
          label="Наклон" value={p.hand.slant} min={-8} max={12} step={0.5}
          format={v => `${v.toFixed(1)}°`} onChange={v => p.onHand({ slant: v })}
          info="Общий наклон букв. Ноль даёт прямой почерк, отрицательные значения заваливают буквы влево."
        />

        <Param
          label="Цвет чернил" group
          info="Цвет пера. Тем же цветом рисуются зачёркивания, наложения и кляксы."
        >
          {() => (
            <div className="swatches" role="group" aria-label="Цвет чернил">
              {INKS.map(i => (
                <button
                  key={i.hex} type="button" title={i.name} aria-label={i.name}
                  aria-pressed={p.hand.ink === i.hex}
                  onClick={() => p.onHand({ ink: i.hex })}
                  style={{ background: i.hex }}
                />
              ))}
            </div>
          )}
        </Param>
      </Group>

      <Group name="Живость письма">
        <Slider
          label="Дрожание слов" value={p.hand.jitter} min={0} max={2} step={0.05}
          format={percent} onChange={v => p.onHand({ jitter: v })}
          info="Каждое слово получает свой сдвиг, поворот и размер. На нуле слова встают ровно по линейке и выдают машину."
        />
        <Slider
          label="Дрейф строки" value={p.hand.drift} min={0} max={2} step={0.05}
          format={percent} onChange={v => p.onHand({ drift: v })}
          info="Базовая линия плавно уходит вверх и вниз внутри строки, как у руки без линейки."
        />
        <Slider
          label="Смещение строк" value={p.hand.lineShift} min={0} max={4} step={0.1}
          format={v => `${v.toFixed(1)} мм`} onChange={v => p.onHand({ lineShift: v })}
          info="Строка целиком уезжает вправо или влево, поэтому левый край текста получается неровным."
        />
        <Slider
          label="Нажим на ручку" value={p.hand.pressure} min={0} max={1} step={0.05}
          format={percent} onChange={v => p.onHand({ pressure: v })}
          info="Волна плотности вдоль строки: где нажим сильнее, буквы темнее и толще."
        />
        <Slider
          label="Усталость к концу страницы" value={p.hand.fatigue} min={0} max={1} step={0.05}
          format={percent} onChange={v => p.onHand({ fatigue: v })}
          info="К нижним строкам почерк сильнее заваливается и слегка сжимается."
        />
        <Slider
          label="Дрожание букв" value={p.hand.charJitter} min={0} max={1} step={0.05}
          format={percent} onChange={v => p.onHand({ charJitter: v })}
          info="Сдвигает буквы внутри слова. Разрывает связки у связных шрифтов, поэтому по умолчанию ноль."
        />
      </Group>

      <Group name="Следы ручки">
        <Slider
          label="Точки и кляксы" value={p.hand.blots} min={0} max={1} step={0.05}
          format={percent} onChange={v => p.onHand({ blots: v })}
          info="Мелкие пятна от пера. Ложатся мимо букв: между строк, у концов слов и на полях."
        />
        <Slider
          label="Описки и исправления" value={p.hand.fixes} min={0} max={1} step={0.05}
          format={percent} onChange={v => p.onHand({ fixes: v })}
          info="Часть слов начинается с зачёркнутого обрывка, часть букв обведена дважды. Слово всегда дописывается верно, текст читается целиком. Под обрывок резервируется место, поэтому параметр меняет перенос строк."
        />
      </Group>

      <Group name="Тетрадь">
        <Choice
          label="Формат страницы" value={p.sheet}
          onChange={v => p.onSheet(v as SheetKey)}
          options={Object.entries(SHEETS).map(([k, v]) => ({ value: k as SheetKey, label: v.label }))}
          info="Размер одной страницы конспекта. A5 это половина A4, две такие страницы ровно ложатся на печатный лист."
        />
        <Choice
          label="Клеток в строке" value={p.notebook.cellsPerLine}
          onChange={v => p.onNotebook({ cellsPerLine: +v })}
          options={[
            { value: 1, label: '1 клетка (5 мм)' },
            { value: 2, label: '2 клетки (10 мм)' },
            { value: 3, label: '3 клетки (15 мм)' },
          ]}
          info="Высота строки в клетках. Две клетки это привычный школьный шаг: буквы не задевают соседнюю строку."
        />
        <Choice
          label="Сторона поля" value={p.notebook.marginSide}
          onChange={v => p.onNotebook({ marginSide: v as Notebook['marginSide'] })}
          options={[
            { value: 'alt-right', label: 'Чередовать, 1-я страница справа' },
            { value: 'alt-left', label: 'Чередовать, 1-я страница слева' },
            { value: 'right', label: 'Всегда справа' },
            { value: 'left', label: 'Всегда слева' },
          ]}
          info="С какой стороны страницы идёт красная линия. Чередование повторяет настоящую тетрадь: на развороте поля смотрят в разные стороны."
        />
        <NumberBox
          label="Ширина поля, мм" value={p.notebook.field}
          onChange={v => p.onNotebook({ field: v })}
          info="Отступ текста со стороны поля. По этой границе проходит красная линия."
        />
        <NumberBox
          label="Отступ с другой стороны, мм" value={p.notebook.edge}
          onChange={v => p.onNotebook({ edge: v })}
          info="Отступ там, где поля нет. В собранной тетради эта сторона оказывается у сгиба."
        />
        <Toggle
          label="Рисовать клетку" checked={p.notebook.drawGrid}
          onChange={v => p.onNotebook({ drawGrid: v })}
          info="Печатает сетку 5 мм. Выключи, если печатаешь на настоящей тетрадной бумаге."
        />
        <Toggle
          label="Рисовать красную линию" checked={p.notebook.drawRule}
          onChange={v => p.onNotebook({ drawRule: v })}
          info="Линия поля. На готовой тетрадной бумаге она уже есть."
        />
        <Toggle
          label="Номера страниц" checked={p.notebook.pageNumbers}
          onChange={v => p.onNotebook({ pageNumbers: v })}
          info="Номер пишется тем же почерком в нижнем углу со стороны поля."
        />
        <Toggle
          label="Красная строка у абзацев" checked={p.notebook.indent}
          onChange={v => p.onNotebook({ indent: v })}
          info="Первая строка каждого абзаца начинается с отступа."
        />
      </Group>

      <Group name="Тетрадь из A4">
        <Choice
          label="Листов A4 в тетрадке" value={p.booklet.sheetsPerSignature}
          onChange={v => p.onBooklet({ sheetsPerSignature: +v })}
          options={[
            { value: 0, label: 'Одной пачкой' },
            { value: 2, label: '2 листа (8 страниц)' },
            { value: 4, label: '4 листа (16 страниц)' },
            { value: 6, label: '6 листов (24 страницы)' },
            { value: 8, label: '8 листов (32 страницы)' },
          ]}
          info="Сколько листов вкладывается друг в друга перед сшивкой. Четыре листа дают тетрадку в 16 страниц. Толстая пачка хуже сгибается и заметно уезжает по обрезу."
        />
        <Choice
          label="Первая страница" value={p.booklet.binding}
          onChange={v => p.onBooklet({ binding: v as Binding })}
          options={[
            { value: 'left', label: 'Справа на лицевой стороне' },
            { value: 'right', label: 'Слева на лицевой стороне' },
          ]}
          info="На какой половине внешнего листа окажется первая страница. Справа означает сшивку слева, как в обычной книге."
        />
        <Toggle
          label="Обороты на 180°" checked={p.booklet.flipBacks}
          onChange={v => p.onBooklet({ flipBacks: v })}
          info="Компенсация того, как принтер переворачивает бумагу. При двусторонней печати с переворотом по короткой стороне галочка не нужна. Включай её, если принтер умеет только переворот по длинной стороне и обороты выходят вверх ногами."
        />
      </Group>

      <Group name="Вывод">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ flex: 1 }} onClick={p.onShuffle}>
            Переписать заново
          </button>
          <button className="btn" style={{ flex: 1 }} disabled={p.busy || !p.font}
            onClick={() => p.onPdf('pages')}>
            PDF страницами
          </button>
        </div>
        <button className="btn btn--primary" disabled={p.busy || !p.font}
          onClick={() => p.onPdf('booklet')}>
          {p.busy ? 'Собираю' : 'PDF тетрадью, по 2 страницы на A4'}
        </button>
        <Note>
          «Переписать заново» берёт новый seed: тот же текст ложится другим почерком.
          В диалоге печати ставь масштаб 100 % и поля «нет».
        </Note>
        <Param
          label="Настройки" group
          info="Текст, почерк и разметка сохраняются в браузере и переживают перезагрузку. Сброс возвращает всё к значениям по умолчанию и перезагружает страницу."
        >
          {() => (
            <button className="btn" onClick={p.onReset}>Сбросить настройки</button>
          )}
        </Param>
      </Group>
    </aside>
  );
}
