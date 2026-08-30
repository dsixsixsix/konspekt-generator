import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage, type Color } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PT_PER_MM } from './measure.ts';
import { imposeBooklet, type BookletOptions, type Half } from './booklet.ts';
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

/** Лист A4 под тетрадь: два конспектных листа рядом, 297×210 мм. */
export interface BookletPdfInput extends PdfInput, BookletOptions {
  /** Обороты печатаются перевёрнутыми на 180°. Нужно, если принтер
   *  переворачивает лист через длинную сторону. */
  flipBacks?: boolean;
}

interface Ctx {
  p: PDFPage;
  nb: Notebook;
  hand: Hand;
  font: PDFFont;
  ink: Color;
  /** Сдвиг конспектного листа по горизонтали внутри печатного, мм. */
  dx: number;
  /** Высота печатного листа, мм: PDF считает от низа. */
  sheetH: number;
}

/**
 * Векторный PDF без участия диалога печати: координаты в пунктах, начало
 * координат снизу, поэтому по вертикали всё зеркалим.
 */
export async function renderPdf(input: PdfInput): Promise<Uint8Array> {
  const { pages, notebook: nb, hand } = input;
  const { doc, font, ink } = await setup(input);

  const w = nb.pageW * PT_PER_MM;
  const h = nb.pageH * PT_PER_MM;

  for (const page of pages) {
    const p = doc.addPage([w, h]);
    drawPage(page, { p, nb, hand, font, ink, dx: 0, sheetH: nb.pageH });
  }
  return doc.save();
}

/** Размер печатного листа под две страницы: A4 поперёк, если помещается. */
export function sheetSize(nb: Notebook): { w: number; h: number } {
  const fitsA4 = nb.pageW * 2 <= 297 && nb.pageH <= 210;
  return fitsA4 ? { w: 297, h: 210 } : { w: nb.pageW * 2, h: nb.pageH };
}

/**
 * Спуск полос: страницы разложены по A4-листам так, что после сгиба и вкладки
 * листов друг в друга читаются подряд. Порядок страниц PDF — порядок печати:
 * лицо первого листа, оборот первого листа, лицо второго и так далее.
 */
export async function renderBookletPdf(input: BookletPdfInput): Promise<Uint8Array> {
  const { pages, notebook: nb, hand, flipBacks } = input;
  const { doc, font, ink } = await setup(input);

  const sheet = sheetSize(nb);
  const w = sheet.w * PT_PER_MM;
  const h = sheet.h * PT_PER_MM;
  // Половинки центруются в своей половине печатного листа.
  const slack = (sheet.w / 2 - nb.pageW) / 2;
  const dxOf = (side: 0 | 1) => slack + side * (sheet.w / 2);

  const sheets = imposeBooklet(pages.length, {
    sheetsPerSignature: input.sheetsPerSignature,
    binding: input.binding,
  });

  const put = (halves: [Half, Half], flip: boolean) => {
    const p = doc.addPage([w, h]);
    if (flip) p.setRotation(degrees(180));
    halves.forEach((half, side) => {
      const page = half === null ? null : pages[half] ?? null;
      drawPage(page, {
        p, nb, hand, font, ink,
        dx: dxOf(side as 0 | 1),
        sheetH: sheet.h,
      }, half === null ? { ruleRight: side === 0 } : undefined);
    });
  };

  for (const s of sheets) {
    put(s.front, false);
    put(s.back, flipBacks === true);
  }
  return doc.save();
}

async function setup(input: PdfInput) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Шрифт вшивается целиком. Сабсеттер fontkit отдаёт для Pecita битый поток
  // CFF («Embedded font file may be invalid» у poppler, каша из глифов в
  // просмотрщиках), а у вариативных шрифтов вроде Caveat теряет контуры.
  // Целый файл стоит 0,1–0,9 МБ один раз на документ и рисуется везде.
  const font = await doc.embedFont(input.fontBytes, { subset: false });
  if (input.title) doc.setTitle(input.title);
  return { doc, font, ink: hexToRgb(input.hand.ink) };
}

/** Рисует один конспектный лист. page === null — пустая страница: только линовка. */
function drawPage(page: PageDraw | null, ctx: Ctx, blank?: { ruleRight: boolean }) {
  const { p, nb, hand, font, ink, dx, sheetH } = ctx;
  const h = sheetH * PT_PER_MM;
  const gridColor = rgb(0.38, 0.52, 0.69);
  const ruleColor = rgb(0.71, 0.27, 0.25);
  const top = (sheetH - nb.pageH) * PT_PER_MM;
  const x0 = dx * PT_PER_MM;

  if (nb.drawGrid) {
    for (let x = 0; x <= nb.pageW; x += nb.cell) {
      p.drawLine({
        start: { x: x0 + x * PT_PER_MM, y: top },
        end: { x: x0 + x * PT_PER_MM, y: h },
        thickness: 0.28, color: gridColor, opacity: 0.42,
      });
    }
    for (let y = 0; y <= nb.pageH; y += nb.cell) {
      const yPt = h - y * PT_PER_MM;
      p.drawLine({
        start: { x: x0, y: yPt },
        end: { x: x0 + nb.pageW * PT_PER_MM, y: yPt },
        thickness: 0.28, color: gridColor, opacity: 0.42,
      });
    }
  }

  const ruleRight = page ? page.ruleRight : blank?.ruleRight ?? false;
  if (nb.drawRule) {
    const xMm = ruleRight ? nb.pageW - nb.field + 2 : nb.field - 2;
    p.drawLine({
      start: { x: x0 + xMm * PT_PER_MM, y: top },
      end: { x: x0 + xMm * PT_PER_MM, y: h },
      thickness: 0.7, color: ruleColor, opacity: 0.55,
    });
  }

  if (!page) return;

  for (const word of page.words) {
    const sizePt = hand.size * PT_PER_MM * word.scale;
    const y = h - word.baseline * PT_PER_MM;
    const x = x0 + word.x * PT_PER_MM;

    const draw = (text: string, xPt: number, yPt: number, opacity: number) =>
      p.drawText(text, {
        x: xPt, y: yPt, size: sizePt, font, color: ink, opacity,
        rotate: degrees(word.rotate),
        xSkew: degrees(word.skew),
      });

    // Описка идёт первой: её потом перечеркнут.
    if (word.ghost) draw(word.ghost.text, x0 + word.ghost.x * PT_PER_MM, y, word.ghost.opacity);
    if (word.overwrite) {
      draw(
        word.text,
        x + word.overwrite.dx * PT_PER_MM,
        y - word.overwrite.dy * PT_PER_MM,
        word.overwrite.opacity,
      );
    }

    draw(word.text, x, y, word.opacity);
    // Нажим: повторный проход с микросдвигом делает штрих плотнее.
    if (word.weight > 0.004) {
      const off = word.weight * PT_PER_MM;
      draw(word.text, x + off, y + off, word.opacity);
    }

    for (const stroke of word.ghost?.strokes ?? []) {
      for (let i = 1; i < stroke.points.length; i++) {
        const a = stroke.points[i - 1]!;
        const b = stroke.points[i]!;
        p.drawLine({
          start: { x: x0 + a.x * PT_PER_MM, y: h - a.y * PT_PER_MM },
          end: { x: x0 + b.x * PT_PER_MM, y: h - b.y * PT_PER_MM },
          thickness: stroke.thickness * PT_PER_MM,
          color: ink, opacity: stroke.opacity,
        });
      }
    }
  }

  for (const blot of page.blots) {
    p.drawEllipse({
      x: x0 + blot.x * PT_PER_MM,
      y: h - blot.y * PT_PER_MM,
      xScale: blot.rx * PT_PER_MM,
      yScale: blot.ry * PT_PER_MM,
      rotate: degrees(blot.rotate),
      color: ink, opacity: blot.opacity, borderWidth: 0,
    });
  }

  if (nb.pageNumbers) {
    const xMm = ruleRight ? nb.pageW - nb.field : nb.edge;
    p.drawText(String(page.number), {
      x: x0 + xMm * PT_PER_MM,
      y: (nb.bottom - 5) * PT_PER_MM,
      size: hand.size * 0.8 * PT_PER_MM,
      font, color: ink, opacity: 0.75,
    });
  }
}
