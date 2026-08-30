import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/** Печать снимает DOM как есть, поэтому перед ней монтируем все листы разом. */
export function usePrintMount(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  return printing;
}
