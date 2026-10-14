// Chip colours: purely visual, bought with cash. They only recolour your own cells, chips and
// tiles on the board, so they cannot change a match. Animated ones shift colour over time.
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

export const CHIP_STYLES = [
  { id: 'classic', name: 'Classic Blue', price: 0, rgb: [56, 169, 255] },
  { id: 'ember', name: 'Ember', price: 25000, rgb: [255, 138, 40] },
  { id: 'lime', name: 'Lime', price: 30000, rgb: [140, 230, 60] },
  { id: 'violet', name: 'Violet', price: 40000, rgb: [170, 110, 255] },
  { id: 'mint', name: 'Mint', price: 50000, rgb: [60, 230, 190] },
  { id: 'gold', name: 'Gold', price: 150000, rgb: [255, 205, 60] },
  { id: 'snow', name: 'Snow', price: 200000, rgb: [235, 245, 255] },
  { id: 'aurora', name: 'Aurora', price: 400000, cycle: [[56, 255, 200], [110, 130, 255], [200, 90, 255]], period: 6000 },
  { id: 'rainbow', name: 'Rainbow', price: 750000, spectrum: true, period: 8000 },
  { id: 'plasma', name: 'Plasma', price: 1500000, cycle: [[255, 60, 200], [60, 210, 255]], period: 2500 },
  { id: 'inferno', name: 'Inferno', price: 2500000, cycle: [[255, 50, 20], [255, 210, 50]], period: 3500 },
];

export const getStyle = (id) => CHIP_STYLES.find((s) => s.id === id) || CHIP_STYLES[0];
export const isAnimated = (s) => Boolean(s.cycle || s.spectrum);

// The colour of a style at time `now` (ms), as [r, g, b].
export function colorAt(style, now = 0) {
  if (style.spectrum) return hsl(((now / style.period) * 360) % 360, 0.9, 0.58);
  if (style.cycle) {
    const n = style.cycle.length;
    const p = ((now / style.period) % 1) * n;
    const i = Math.floor(p);
    const t = 0.5 - 0.5 * Math.cos((p - i) * Math.PI); // ease between neighbours
    const a = style.cycle[i % n];
    const b = style.cycle[(i + 1) % n];
    return a.map((v, k) => Math.round(v + (b[k] - v) * t));
  }
  return style.rgb;
}

export const swatch = (style) => (style.spectrum
  ? 'linear-gradient(90deg, #ff4d4d, #ffd24d, #4dff88, #4dc3ff, #b84dff, #ff4d4d)'
  : style.cycle
    ? `linear-gradient(90deg, ${style.cycle.map((c) => `rgb(${c})`).join(', ')}, rgb(${style.cycle[0]}))`
    : `rgb(${style.rgb})`);

export function buyStyle(save, id) {
  const s = CHIP_STYLES.find((x) => x.id === id);
  if (!s || save.style.owned.includes(id) || save.balance < s.price) return null;
  return { ...save, balance: save.balance - s.price, style: { owned: [...save.style.owned, id], equipped: id } };
}

export const equipStyle = (save, id) => (save.style.owned.includes(id) ? { ...save, style: { ...save.style, equipped: id } } : null);
