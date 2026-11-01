// Generador de QR mínimo, escrito para esta prueba (sin librerías externas).
// Modo byte, corrección L, versiones 1-40, máscara 0. Basado en la norma ISO/IEC 18004.
(function (g) {
  'use strict';
  const ECC = [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30];
  const BLK = [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25];
  const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = v => Math.floor(raw(v) / 8) - ECC[v] * BLK[v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  function divisor(d) { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
  function rem(data, dv) { const r = dv.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); dv.forEach((c, i) => r[i] ^= mul(c, f)); } return r; }
  function alignPos(v, size) { if (v === 1) return []; const n = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }
  function make(text) {
    const bytes = new TextEncoder().encode(text);
    let v = 1; for (; v <= 40; v++) { const bits = 4 + (v < 10 ? 8 : 16) + bytes.length * 8; if (bits <= dataCw(v) * 8) break; }
    if (v > 40) throw new Error('Texto demasiado largo para un QR');
    const bb = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCw(v) * 8; put(0, Math.min(4, cap - bb.length)); put(0, (8 - bb.length % 8) % 8);
    for (let p = 0xEC; bb.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bb.length; i += 8) data.push(parseInt(bb.slice(i, i + 8).join(''), 2));
    const nb = BLK[v], el = ECC[v], rc = Math.floor(raw(v) / 8), ns = nb - rc % nb, sl = Math.floor(rc / nb), dv = divisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += d.length; const e = rem(d, dv); if (i < ns) d.push(0); blocks.push(d.concat(e)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) cw.push(b[i]); });
    const size = v * 4 + 17, M = [], F = [];
    for (let y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    const set = (x, y, on) => { M[y][x] = on; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(v, size), L = ap.length;
    for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) { if ((i === 0 && j === 0) || (i === 0 && j === L - 1) || (i === L - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const fmt = () => { const d = (1 << 3) | 0; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true); };
    fmt();
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const on = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, on); set(c, a, on); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && i < cw.length * 8) { M[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; } } }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && (x + y) % 2 === 0) M[y][x] = !M[y][x];
    return { version: v, size, modules: M };
  }
  function draw(canvas, text, px) {
    const q = make(text), s = px || Math.max(2, Math.floor(320 / (q.size + 8))), n = (q.size + 8) * s;
    canvas.width = canvas.height = n; const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, n, n); c.fillStyle = '#000';
    q.modules.forEach((row, y) => row.forEach((on, x) => on && c.fillRect((x + 4) * s, (y + 4) * s, s, s))); return q;
  }
  g.PhenomQR = { make, draw };
})(typeof self !== 'undefined' ? self : globalThis);
