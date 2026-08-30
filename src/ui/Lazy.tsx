import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Размер места под лист в миллиметрах: прокрутка не должна прыгать. */
  width: number;
  height: number;
  /** Смонтировать сразу, не дожидаясь прокрутки. */
  eager: boolean;
  /** Первые листы рисуем не дожидаясь наблюдателя: он ждёт первого кадра. */
  initial?: boolean;
  children: () => ReactNode;
}

/**
 * Лист рисуется, только когда подходит к экрану. Конспект на сотню страниц
 * это десятки тысяч слов; держать их все в DOM браузер не успевает.
 */
export default function Lazy({ width, height, eager, initial = false, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => setNear(entries[entries.length - 1]!.isIntersecting),
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="slot" style={{ width: `${width}mm`, height: `${height}mm` }}>
      {(eager || near) && children()}
    </div>
  );
}
