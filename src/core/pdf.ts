import { PDFDocument, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PT_PER_MM } from './measure.ts';
import type { Hand, Notebook, PageDraw } from './types.ts';

function hexToRgb(hex: string) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface PdfInput {
  pages: PageDraw[];
  notebook: Notebook;
  hand: Hand;
  fontBytes: Uint8Array;
  title?: string;
}

/**
 * Векторный PDF без участия диалога печати: координаты в пунктах, начало
 * координат снизу, поэтому по вертикали всё зеркалим.
 */
export async function renderPdf(input: PdfInput): Promise<Uint8Array> {
  const { pages, notebook: nb, hand, fontBytes } = input;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  if (input.title) doc.setTitle(input.title);

  const ink = hexToRgb(hand.ink);
  const gridColor = rgb(0.38, 0.52, 0.69);
  const ruleColor = rgb(0.71, 0.27, 0.25);
  const w = nb.pageW * PT_PER_MM;
  const h = nb.pageH * PT_PER_MM;

  for (const page of pages) {
    const p = doc.addPage([w, h]);

    if (nb.drawGrid) {
      for (let x = 0; x <= nb.pageW; x += nb.cell) {
        p.drawLine({
          start: { x: x * PT_PER_MM, y: 0 },
          end: { x: x * PT_PER_MM, y: h },
          thickness: 0.28, color: gridColor, opacity: 0.42,
        });
      }
      for (let y = 0; y <= nb.pageH; y += nb.cell) {
        p.drawLine({
          start: { x: 0, y: y * PT_PER_MM },
          end: { x: w, y: y * PT_PER_MM },
          thickness: 0.28, color: gridColor, opacity: 0.42,
        });
      }
    }

    if (nb.drawRule) {
      const xMm = page.ruleRight ? nb.pageW - nb.field + 2 : nb.field - 2;
      p.drawLine({
        start: { x: xMm * PT_PER_MM, y: 0 },
        end: { x: xMm * PT_PER_MM, y: h },
        thickness: 0.7, color: ruleColor, opacity: 0.55,
      });
    }

    for (const word of page.words) {
      const sizePt = hand.size * PT_PER_MM * word.scale;
      const y = h - word.baseline * PT_PER_MM;
      const x = word.x * PT_PER_MM;

      const draw = (offset: number) =>
        p.drawText(word.text, {
          x: x + offset,
          y: y + offset,
          size: sizePt,
          font,
          color: ink,
          opacity: word.opacity,
          rotate: degrees(word.rotate),
          xSkew: degrees(word.skew),
        });

      draw(0);
      // Нажим: повторный проход с микросдвигом делает штрих плотнее.
      if (word.weight > 0.004) draw(word.weight * PT_PER_MM);
    }

    if (nb.pageNumbers) {
      const xMm = page.ruleRight ? nb.pageW - nb.field : nb.edge;
      p.drawText(String(page.number), {
        x: xMm * PT_PER_MM,
        y: (nb.bottom - 5) * PT_PER_MM,
        size: hand.size * 0.8 * PT_PER_MM,
        font, color: ink, opacity: 0.75,
      });
    }
  }

  return doc.save();
}
