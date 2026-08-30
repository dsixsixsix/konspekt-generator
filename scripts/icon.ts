/**
 * Иконка приложения: build/icon.png, 1024×1024. electron-builder сам делает из
 * неё .icns и .ico. Рисуем вручную в буфер RGBA, чтобы не тащить графические
 * зависимости ради одного файла.
 *
 *   node scripts/icon.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const S = 1024;
const buf = Buffer.alloc(S * S * 4, 0);

const PAPER = [0xfb, 0xfa, 0xf6];
const GRID = [0x60, 0x84, 0xb0];
const RULE = [0xb4, 0x45, 0x3f];
const INK = [0x2a, 0x3b, 0x8f];

const put = (x: number, y: number, rgb: number[], alpha = 1) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const back = buf[i + 3]! / 255;
  const a = alpha + back * (1 - alpha);
  if (a <= 0) return;
  for (let c = 0; c < 3; c++) {
    const under = buf[i + c]!;
    buf[i + c] = Math.round((rgb[c]! * alpha + under * back * (1 - alpha)) / a);
  }
  buf[i + 3] = Math.round(a * 255);
};

/** Скруглённый квадрат со сглаженным краем: маска листа. */
const coverage = (x: number, y: number, r: number, pad: number) => {
  const min = pad, max = S - pad;
  const cx = Math.min(Math.max(x, min + r), max - r);
  const cy = Math.min(Math.max(y, min + r), max - r);
  const d = Math.hypot(x - cx, y - cy);
  if (x < min || y < min || x > max || y > max) return 0;
  return Math.min(1, Math.max(0, r + 0.5 - d));
};

// Лист.
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const a = coverage(x + 0.5, y + 0.5, 190, 40);
    if (a > 0) put(x, y, PAPER, a);
  }
}

const onPaper = (x: number, y: number) => coverage(x + 0.5, y + 0.5, 190, 40) > 0.9;

// Клетка 64 px.
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!onPaper(x, y)) continue;
    if (x % 64 === 0 || y % 64 === 0) put(x, y, GRID, 0.34);
  }
}

// Красная линия поля.
for (let y = 0; y < S; y++) {
  for (let x = 248; x < 254; x++) if (onPaper(x, y)) put(x, y, RULE, 0.85);
}

/** Строка почерка: волна с переменной толщиной, как от пера. */
function stroke(y0: number, from: number, to: number, phase: number) {
  for (let x = from; x <= to; x += 0.35) {
    const t = (x - from) / (to - from);
    const y = y0 + Math.sin(x / 42 + phase) * 13 + Math.sin(x / 13 + phase) * 3;
    const w = 7 + Math.sin(x / 25 + phase) * 2.6;
    for (let dy = -w; dy <= w; dy += 0.5) {
      const edge = 1 - Math.abs(dy) / w;
      if (edge <= 0) continue;
      const px = Math.round(x), py = Math.round(y + dy);
      if (onPaper(px, py)) put(px, py, INK, Math.min(1, edge * 1.8) * (0.75 + 0.25 * t));
    }
  }
}

stroke(330, 330, 880, 0.2);
stroke(500, 300, 900, 1.7);
stroke(670, 300, 780, 3.1);
stroke(840, 300, 600, 4.6);

// Клякса рядом с последней строкой.
for (let y = 800; y < 830; y++) {
  for (let x = 660; x < 700; x++) {
    const d = Math.hypot((x - 680) / 20, (y - 815) / 15);
    if (d < 1 && onPaper(x, y)) put(x, y, INK, 0.5 * (1 - d));
  }
}

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const png = encode(buf, S, S);
const dir = join(import.meta.dirname, '..', 'build');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'icon.png'), png);
console.log(`build/icon.png — ${S}×${S}, ${Math.round(png.length / 1024)} КБ`);

function encode(rgba: Buffer, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // фильтр строки: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // бит на канал
  ihdr[9] = 6;   // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
