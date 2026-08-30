import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

/**
 * Мелочи панели. У каждого параметра есть кнопка «i»: пояснение лежит рядом,
 * но раскрывается по требованию и не превращает панель в стену текста.
 */

export function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="group">
      <h2 className="group__name">{name}</h2>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="group__note">{children}</p>;
}

interface ParamProps {
  label: string;
  /** Текущее значение справа от названия. */
  value?: string;
  info: string;
  /** Управление не одиночное поле, а группа: подпись не привязывается к id. */
  group?: boolean;
  children: (id: string) => ReactNode;
}

export function Param({ label, value, info, group = false, children }: ParamProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="param">
      <div className="param__head">
        {group
          ? <span className="param__label">{label}</span>
          : <label className="param__label" htmlFor={id}>{label}</label>}
        {value !== undefined && <span className="param__value">{value}</span>}
        <InfoButton label={label} open={open} onToggle={() => setOpen(!open)} target={`${id}-hint`} />
      </div>
      {children(id)}
      {open && <p className="hint" id={`${id}-hint`}>{info}</p>}
    </div>
  );
}

function InfoButton(props: { label: string; open: boolean; onToggle: () => void; target: string }) {
  return (
    <button
      type="button"
      className="param__info"
      onClick={props.onToggle}
      aria-expanded={props.open}
      aria-controls={props.target}
      aria-label={`Пояснение к параметру «${props.label}»`}
      title="Как это работает"
    >
      i
    </button>
  );
}

export function Slider(props: {
  label: string;
  info: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Param label={props.label} value={props.format(props.value)} info={props.info}>
      {id => (
        <input
          id={id}
          type="range"
          className="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(+e.target.value)}
        />
      )}
    </Param>
  );
}

export function Choice<T extends string | number>(props: {
  label: string;
  info: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Param label={props.label} info={props.info}>
      {id => (
        <select id={id} className="control" value={props.value}
          onChange={e => props.onChange(e.target.value)}>
          {props.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Param>
  );
}

export function NumberBox(props: {
  label: string; info: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <Param label={props.label} info={props.info}>
      {id => (
        <input id={id} type="number" className="control" value={props.value}
          onChange={e => props.onChange(+e.target.value)} />
      )}
    </Param>
  );
}

export function Toggle(props: {
  label: string; info: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="param">
      <div className="param__head">
        <label className="check param__label" htmlFor={id}>
          <input id={id} type="checkbox" checked={props.checked}
            onChange={e => props.onChange(e.target.checked)} />
          {props.label}
        </label>
        <InfoButton label={props.label} open={open} onToggle={() => setOpen(!open)} target={`${id}-hint`} />
      </div>
      {open && <p className="hint" id={`${id}-hint`}>{props.info}</p>}
    </div>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  info: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="param">
      <div className="param__head">
        <span className="param__label">{props.label}</span>
        <InfoButton label={props.label} open={open} onToggle={() => setOpen(!open)} target={`${id}-hint`} />
      </div>
      <div className="seg" role="group" aria-label={props.label}>
        {props.options.map(o => (
          <button key={o.value} type="button" aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {open && <p className="hint" id={`${id}-hint`}>{props.info}</p>}
    </div>
  );
}

/**
 * Поле текста живёт само по себе: набор идёт в DOM, наверх значение уходит
 * после паузы. Иначе каждая буква переписывала бы весь конспект целиком.
 */
export function TextArea(props: {
  id: string;
  /** Начальный текст. Меняется извне вместе с revision. */
  value: string;
  revision: number;
  delay?: number;
  onChange: (v: string) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (value: string, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => props.onChange(value), delay);
  };

  return (
    <textarea
      key={props.revision}
      id={props.id}
      className="control"
      spellCheck={false}
      defaultValue={props.value}
      onChange={e => push(e.target.value, props.delay ?? 250)}
      onBlur={e => push(e.target.value, 0)}
    />
  );
}
