// Core CAD model: entities, snapping, hit-testing, DXF export.

export type Pt = { x: number; y: number };

export type Entity =
  | { id: string; layer: string; type: 'line'; a: Pt; b: Pt }
  | { id: string; layer: string; type: 'pline'; pts: Pt[]; closed: boolean }
  | { id: string; layer: string; type: 'circle'; c: Pt; r: number }
  | { id: string; layer: string; type: 'text'; p: Pt; h: number; text: string };

export type Layer = { name: string; color: string; visible: boolean; aci: number };

export type Drawing = { entities: Entity[]; layers: Layer[]; current: string };

export const DEFAULT_LAYERS: Layer[] = [
  { name: '0', color: '#e5e7eb', visible: true, aci: 7 },
  { name: 'Paredes', color: '#f87171', visible: true, aci: 1 },
  { name: 'Cotas', color: '#fbbf24', visible: true, aci: 2 },
  { name: 'Eixos', color: '#60a5fa', visible: true, aci: 5 },
];

export const emptyDrawing = (): Drawing => ({ entities: [], layers: DEFAULT_LAYERS, current: '0' });

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function segments(e: Entity): [Pt, Pt][] {
  if (e.type === 'line') return [[e.a, e.b]];
  if (e.type === 'pline') {
    const s: [Pt, Pt][] = [];
    for (let i = 1; i < e.pts.length; i++) s.push([e.pts[i - 1], e.pts[i]]);
    if (e.closed && e.pts.length > 2) s.push([e.pts[e.pts.length - 1], e.pts[0]]);
    return s;
  }
  return [];
}

export type SnapKind = 'end' | 'mid' | 'cen' | 'quad' | 'grid';
export type Snap = { p: Pt; kind: SnapKind };

function snapCandidates(e: Entity): Snap[] {
  const out: Snap[] = [];
  for (const [a, b] of segments(e)) {
    out.push({ p: a, kind: 'end' }, { p: b, kind: 'end' }, { p: mid(a, b), kind: 'mid' });
  }
  if (e.type === 'circle') {
    out.push({ p: e.c, kind: 'cen' });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      out.push({ p: { x: e.c.x + dx * e.r, y: e.c.y + dy * e.r }, kind: 'quad' });
  }
  if (e.type === 'text') out.push({ p: e.p, kind: 'end' });
  return out;
}

export function findSnap(
  p: Pt, d: Drawing, tol: number, opts: { osnap: boolean; grid: number | null },
): Snap | null {
  if (opts.osnap) {
    let best: Snap | null = null;
    let bd = tol;
    for (const e of visible(d))
      for (const s of snapCandidates(e)) {
        const dd = dist(p, s.p);
        if (dd < bd) { bd = dd; best = s; }
      }
    if (best) return best;
  }
  if (opts.grid) {
    const g = opts.grid;
    return { p: { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }, kind: 'grid' };
  }
  return null;
}

export const visible = (d: Drawing) =>
  d.entities.filter((e) => d.layers.find((l) => l.name === e.layer)?.visible !== false);

function distToSeg(p: Pt, a: Pt, b: Pt) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!l2) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

export function hitTest(p: Pt, d: Drawing, tol: number): Entity | null {
  let best: Entity | null = null;
  let bd = tol;
  for (const e of visible(d)) {
    let dd = Infinity;
    if (e.type === 'circle') dd = Math.abs(dist(p, e.c) - e.r);
    else if (e.type === 'text') dd = dist(p, e.p);
    else for (const [a, b] of segments(e)) dd = Math.min(dd, distToSeg(p, a, b));
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}

export function translate(e: Entity, dx: number, dy: number): Entity {
  const t = (q: Pt) => ({ x: q.x + dx, y: q.y + dy });
  switch (e.type) {
    case 'line': return { ...e, a: t(e.a), b: t(e.b) };
    case 'pline': return { ...e, pts: e.pts.map(t) };
    case 'circle': return { ...e, c: t(e.c) };
    case 'text': return { ...e, p: t(e.p) };
  }
}

export function extents(d: Drawing): { min: Pt; max: Pt } | null {
  const pts: Pt[] = [];
  for (const e of visible(d)) {
    if (e.type === 'circle') pts.push({ x: e.c.x - e.r, y: e.c.y - e.r }, { x: e.c.x + e.r, y: e.c.y + e.r });
    else if (e.type === 'line') pts.push(e.a, e.b);
    else if (e.type === 'pline') pts.push(...e.pts);
    else pts.push(e.p, { x: e.p.x + e.h * e.text.length * 0.6, y: e.p.y + e.h });
  }
  if (!pts.length) return null;
  return {
    min: { x: Math.min(...pts.map((q) => q.x)), y: Math.min(...pts.map((q) => q.y)) },
    max: { x: Math.max(...pts.map((q) => q.x)), y: Math.max(...pts.map((q) => q.y)) },
  };
}

// Parses AutoCAD-style point input relative to the last point:
// "10,20" absolute, "@5,0" relative, "@10<45" polar, "25" distance along current direction.
export function parsePoint(s: string, last: Pt | null, dir: Pt | null): Pt | null {
  const t = s.trim();
  let m = t.match(/^(@?)(-?[\d.]+)\s*<\s*(-?[\d.]+)$/);
  if (m) {
    const base = m[1] ? last ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    const r = +m[2], a = (+m[3] * Math.PI) / 180;
    return { x: base.x + r * Math.cos(a), y: base.y + r * Math.sin(a) };
  }
  m = t.match(/^(@?)(-?[\d.]+)\s*[,;]\s*(-?[\d.]+)$/);
  if (m) {
    const base = m[1] ? last ?? { x: 0, y: 0 } : { x: 0, y: 0 };
    return { x: base.x + +m[2], y: base.y + +m[3] };
  }
  m = t.match(/^(-?[\d.]+)$/);
  if (m && last) {
    const len = +m[1];
    const u = dir && (dir.x || dir.y) ? dir : { x: 1, y: 0 };
    const n = Math.hypot(u.x, u.y);
    return { x: last.x + (u.x / n) * len, y: last.y + (u.y / n) * len };
  }
  return null;
}

// Minimal ASCII DXF (R12) writer — opens in AutoCAD, LibreCAD, CADCraft, etc.
export function toDXF(d: Drawing): string {
  const o: (string | number)[] = [];
  const g = (code: number, v: string | number) => o.push(code, v);
  const layerOf = (n: string) => d.layers.find((l) => l.name === n)?.aci ?? 7;
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, d.layers.length);
  for (const l of d.layers) { g(0, 'LAYER'); g(2, l.name); g(70, 0); g(62, l.visible ? l.aci : -l.aci); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const line = (a: Pt, b: Pt, layer: string) => {
    g(0, 'LINE'); g(8, layer); g(62, layerOf(layer));
    g(10, a.x); g(20, a.y); g(30, 0); g(11, b.x); g(21, b.y); g(31, 0);
  };
  for (const e of d.entities) {
    if (e.type === 'circle') { g(0, 'CIRCLE'); g(8, e.layer); g(10, e.c.x); g(20, e.c.y); g(30, 0); g(40, e.r); }
    else if (e.type === 'text') { g(0, 'TEXT'); g(8, e.layer); g(10, e.p.x); g(20, e.p.y); g(30, 0); g(40, e.h); g(1, e.text); }
    else for (const [a, b] of segments(e)) line(a, b, e.layer);
  }
  g(0, 'ENDSEC'); g(0, 'EOF');
  return o.join('\n') + '\n';
}
