// Core 2D CAD model: entities, snapping, hit-testing, geometric constraints + solver,
// profile (closed loop) extraction for 3D sketches, and DXF export.

export type Pt = { x: number; y: number };

export type Entity =
  | { id: string; layer: string; type: 'line'; a: Pt; b: Pt; construction?: boolean }
  | { id: string; layer: string; type: 'pline'; pts: Pt[]; closed: boolean; construction?: boolean }
  | { id: string; layer: string; type: 'circle'; c: Pt; r: number; construction?: boolean }
  // counter-clockwise from angle a0 to a1 (radians)
  | { id: string; layer: string; type: 'arc'; c: Pt; r: number; a0: number; a1: number; construction?: boolean }
  | { id: string; layer: string; type: 'text'; p: Pt; h: number; text: string; construction?: boolean };

export type Layer = { name: string; color: string; visible: boolean; aci: number };

// A point on an entity: line 0=a 1=b · pline i=pts[i] · circle 0=centre · arc 0=centre 1=start 2=end · text 0
export type Handle = { e: string; p: number };
// A straight segment: line s=0 · pline segment s (pts[s] → pts[s+1])
export type Seg = { e: string; s: number };

export type Constraint = { id: string } & (
  | { type: 'coincident'; h: [Handle, Handle] }
  | { type: 'fix'; h: Handle; at: Pt }
  | { type: 'horizontal' | 'vertical'; l: Seg }
  | { type: 'parallel' | 'perpendicular' | 'equal'; l: [Seg, Seg] }
  | { type: 'equalRadius' | 'concentric'; c: [string, string] }
  | { type: 'tangent'; l: Seg; c: string }
  | { type: 'distance'; h: [Handle, Handle]; value: number }
  | { type: 'length'; l: Seg; value: number }
  | { type: 'radius' | 'diameter'; c: string; value: number }
  | { type: 'angle'; l: [Seg, Seg]; value: number }
);

export type Drawing = { entities: Entity[]; layers: Layer[]; current: string; constraints?: Constraint[] };

export const DEFAULT_LAYERS: Layer[] = [
  { name: '0', color: '#e5e7eb', visible: true, aci: 7 },
  { name: 'Paredes', color: '#f87171', visible: true, aci: 1 },
  { name: 'Cotas', color: '#fbbf24', visible: true, aci: 2 },
  { name: 'Eixos', color: '#60a5fa', visible: true, aci: 5 },
];

export const emptyDrawing = (): Drawing => ({ entities: [], layers: DEFAULT_LAYERS, current: '0', constraints: [] });

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const polar = (c: Pt, r: number, a: number): Pt => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
const TAU = Math.PI * 2;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

export const arcStart = (e: { c: Pt; r: number; a0: number }) => polar(e.c, e.r, e.a0);
export const arcEnd = (e: { c: Pt; r: number; a1: number }) => polar(e.c, e.r, e.a1);
export const arcSweep = (e: { a0: number; a1: number }) => norm(e.a1 - e.a0) || TAU;
export const arcMid = (e: { c: Pt; r: number; a0: number; a1: number }) => polar(e.c, e.r, e.a0 + arcSweep(e) / 2);

// Arc through three points (start, any point on the arc, end); null when collinear.
export function arcFrom3(p1: Pt, p2: Pt, p3: Pt): { c: Pt; r: number; a0: number; a1: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-12) return null;
  const s1 = p1.x ** 2 + p1.y ** 2, s2 = p2.x ** 2 + p2.y ** 2, s3 = p3.x ** 2 + p3.y ** 2;
  const c = { x: (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / d, y: (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / d };
  const ang = (p: Pt) => Math.atan2(p.y - c.y, p.x - c.x);
  const [A, M, B] = [ang(p1), ang(p2), ang(p3)];
  // counter-clockwise from p1 to p3 passes through p2?
  const ccw = norm(M - A) < norm(B - A);
  return { c, r: dist(c, p1), a0: ccw ? A : B, a1: ccw ? B : A };
}

// --- handles & segments ---
export function handlePt(e: Entity, p: number): Pt {
  switch (e.type) {
    case 'line': return p ? e.b : e.a;
    case 'pline': return e.pts[p];
    case 'circle': return e.c;
    case 'arc': return p === 0 ? e.c : p === 1 ? arcStart(e) : arcEnd(e);
    case 'text': return e.p;
  }
}

export function handles(e: Entity): number[] {
  switch (e.type) {
    case 'line': return [0, 1];
    case 'pline': return e.pts.map((_, i) => i);
    case 'arc': return [0, 1, 2];
    default: return [0];
  }
}

export function segPts(e: Entity, s: number): [Pt, Pt] | null {
  if (e.type === 'line') return [e.a, e.b];
  if (e.type === 'pline') return [e.pts[s], e.pts[(s + 1) % e.pts.length]];
  return null;
}

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

// --- snapping ---
export type SnapKind = 'end' | 'mid' | 'cen' | 'quad' | 'grid';
export type Snap = { p: Pt; kind: SnapKind; h?: Handle };

function snapCandidates(e: Entity): Snap[] {
  const out: Snap[] = [];
  if (e.type === 'line' || e.type === 'pline') {
    handles(e).forEach((p) => out.push({ p: handlePt(e, p), kind: 'end', h: { e: e.id, p } }));
    for (const [a, b] of segments(e)) out.push({ p: mid(a, b), kind: 'mid' });
  }
  if (e.type === 'circle' || e.type === 'arc') {
    out.push({ p: e.c, kind: 'cen', h: { e: e.id, p: 0 } });
    if (e.type === 'arc') {
      out.push({ p: arcStart(e), kind: 'end', h: { e: e.id, p: 1 } }, { p: arcEnd(e), kind: 'end', h: { e: e.id, p: 2 } }, { p: arcMid(e), kind: 'mid' });
    } else
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        out.push({ p: { x: e.c.x + dx * e.r, y: e.c.y + dy * e.r }, kind: 'quad' });
  }
  if (e.type === 'text') out.push({ p: e.p, kind: 'end' });
  return out;
}

export function findSnap(p: Pt, d: Drawing, tol: number, opts: { osnap: boolean; grid: number | null }): Snap | null {
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

const onArc = (e: { a0: number; a1: number }, ang: number) => norm(ang - e.a0) <= arcSweep(e) + 1e-9;

export type Hit = { e: Entity; s: number };
export function hitTest(p: Pt, d: Drawing, tol: number): Hit | null {
  let best: Hit | null = null;
  let bd = tol;
  for (const e of visible(d)) {
    let dd = Infinity, s = 0;
    if (e.type === 'circle') dd = Math.abs(dist(p, e.c) - e.r);
    else if (e.type === 'arc') {
      dd = onArc(e, Math.atan2(p.y - e.c.y, p.x - e.c.x)) ? Math.abs(dist(p, e.c) - e.r) : Math.min(dist(p, arcStart(e)), dist(p, arcEnd(e)));
    } else if (e.type === 'text') dd = dist(p, e.p);
    else segments(e).forEach(([a, b], i) => {
      const k = distToSeg(p, a, b);
      if (k < dd) { dd = k; s = i; }
    });
    if (dd < bd) { bd = dd; best = { e, s }; }
  }
  return best;
}

// Nearest entity point handle within tol (for coincident / fix / point distance).
export function hitHandle(p: Pt, d: Drawing, tol: number): Handle | null {
  let best: Handle | null = null;
  let bd = tol;
  for (const e of visible(d))
    for (const h of handles(e)) {
      const dd = dist(p, handlePt(e, h));
      if (dd < bd) { bd = dd; best = { e: e.id, p: h }; }
    }
  return best;
}

export function translate(e: Entity, dx: number, dy: number): Entity {
  const t = (q: Pt) => ({ x: q.x + dx, y: q.y + dy });
  switch (e.type) {
    case 'line': return { ...e, a: t(e.a), b: t(e.b) };
    case 'pline': return { ...e, pts: e.pts.map(t) };
    case 'circle': case 'arc': return { ...e, c: t(e.c) };
    case 'text': return { ...e, p: t(e.p) };
  }
}

export function extents(d: Drawing): { min: Pt; max: Pt } | null {
  const pts: Pt[] = [];
  for (const e of visible(d)) {
    if (e.type === 'circle' || e.type === 'arc') pts.push({ x: e.c.x - e.r, y: e.c.y - e.r }, { x: e.c.x + e.r, y: e.c.y + e.r });
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

// ---------------------------------------------------------------------------
// Constraint solver: Levenberg–Marquardt over the parameters of every entity a
// constraint touches. Entities without constraints are never moved.
// ---------------------------------------------------------------------------

function params(e: Entity): number[] {
  switch (e.type) {
    case 'line': return [e.a.x, e.a.y, e.b.x, e.b.y];
    case 'pline': return e.pts.flatMap((p) => [p.x, p.y]);
    case 'circle': return [e.c.x, e.c.y, e.r];
    case 'arc': return [e.c.x, e.c.y, e.r, e.a0, e.a1];
    case 'text': return [e.p.x, e.p.y];
  }
}

function withParams(e: Entity, v: number[]): Entity {
  switch (e.type) {
    case 'line': return { ...e, a: { x: v[0], y: v[1] }, b: { x: v[2], y: v[3] } };
    case 'pline': return { ...e, pts: e.pts.map((_, i) => ({ x: v[2 * i], y: v[2 * i + 1] })) };
    case 'circle': return { ...e, c: { x: v[0], y: v[1] }, r: v[2] };
    case 'arc': return { ...e, c: { x: v[0], y: v[1] }, r: v[2], a0: v[3], a1: v[4] };
    case 'text': return { ...e, p: { x: v[0], y: v[1] } };
  }
}

export const constraintRefs = (c: Constraint): string[] => {
  switch (c.type) {
    case 'coincident': case 'distance': return [c.h[0].e, c.h[1].e];
    case 'fix': return [c.h.e];
    case 'horizontal': case 'vertical': case 'length': return [c.l.e];
    case 'parallel': case 'perpendicular': case 'equal': case 'angle': return [c.l[0].e, c.l[1].e];
    case 'equalRadius': case 'concentric': return c.c;
    case 'tangent': return [c.l.e, c.c];
    case 'radius': case 'diameter': return [c.c];
  }
};

const isDimension = (c: Constraint) => ['distance', 'length', 'radius', 'diameter', 'angle'].includes(c.type);
export { isDimension };

function residuals(c: Constraint, get: (id: string) => Entity | undefined): number[] {
  const P = (h: Handle) => { const e = get(h.e); return e ? handlePt(e, h.p) : { x: 0, y: 0 }; };
  const S = (l: Seg) => { const e = get(l.e); const s = e && segPts(e, l.s); return s ?? [{ x: 0, y: 0 }, { x: 1, y: 0 }] as [Pt, Pt]; };
  const V = (l: Seg) => { const [a, b] = S(l); return { x: b.x - a.x, y: b.y - a.y }; };
  const C = (id: string) => { const e = get(id); return e && (e.type === 'circle' || e.type === 'arc') ? e : { c: { x: 0, y: 0 }, r: 1 }; };
  const unit = (v: Pt) => { const n = Math.hypot(v.x, v.y) || 1; return { x: v.x / n, y: v.y / n }; };
  switch (c.type) {
    case 'coincident': { const [a, b] = c.h.map(P); return [a.x - b.x, a.y - b.y]; }
    case 'fix': { const a = P(c.h); return [a.x - c.at.x, a.y - c.at.y]; }
    case 'horizontal': { const [a, b] = S(c.l); return [a.y - b.y]; }
    case 'vertical': { const [a, b] = S(c.l); return [a.x - b.x]; }
    case 'parallel': { const [u, v] = c.l.map(V).map(unit); return [u.x * v.y - u.y * v.x]; }
    case 'perpendicular': { const [u, v] = c.l.map(V).map(unit); return [u.x * v.x + u.y * v.y]; }
    case 'equal': { const [u, v] = c.l.map(V); return [Math.hypot(u.x, u.y) - Math.hypot(v.x, v.y)]; }
    case 'equalRadius': { const [a, b] = c.c.map(C); return [a.r - b.r]; }
    case 'concentric': { const [a, b] = c.c.map(C); return [a.c.x - b.c.x, a.c.y - b.c.y]; }
    case 'tangent': {
      const [a, b] = S(c.l); const k = C(c.c);
      const d = ((b.x - a.x) * (a.y - k.c.y) - (a.x - k.c.x) * (b.y - a.y)) / (dist(a, b) || 1);
      return [Math.abs(d) - k.r];
    }
    case 'distance': { const [a, b] = c.h.map(P); return [dist(a, b) - c.value]; }
    case 'length': { const [a, b] = S(c.l); return [dist(a, b) - c.value]; }
    case 'radius': return [C(c.c).r - c.value];
    case 'diameter': return [2 * C(c.c).r - c.value];
    case 'angle': {
      const [u, v] = c.l.map(V).map(unit);
      const t = (c.value * Math.PI) / 180;
      // compare the unsigned angle so the user's line direction does not matter
      return [Math.acos(Math.max(-1, Math.min(1, Math.abs(u.x * v.x + u.y * v.y)))) - Math.min(t, Math.PI - t)];
    }
  }
}

// Solves a linear system with partial pivoting; returns null when singular.
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-14) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function rank(J: number[][]): number {
  const M = J.map((r) => [...r]);
  let r = 0;
  const cols = M[0]?.length ?? 0;
  for (let c = 0; c < cols && r < M.length; c++) {
    let p = r;
    for (let k = r + 1; k < M.length; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
    if (Math.abs(M[p][c]) < 1e-7) continue;
    [M[r], M[p]] = [M[p], M[r]];
    for (let k = r + 1; k < M.length; k++) {
      const f = M[k][c] / M[r][c];
      for (let j = c; j < cols; j++) M[k][j] -= f * M[r][j];
    }
    r++;
  }
  return r;
}

export type SolveResult = { drawing: Drawing; ok: boolean; dof: number; error: number };

export function solve(d: Drawing): SolveResult {
  const cons = d.constraints ?? [];
  const ids = [...new Set(cons.flatMap(constraintRefs))].filter((id) => d.entities.some((e) => e.id === id));
  if (!cons.length || !ids.length) return { drawing: d, ok: true, dof: freeDof(d, new Set()), error: 0 };
  const ents = ids.map((id) => d.entities.find((e) => e.id === id)!);
  const offs: number[] = [];
  let x: number[] = [];
  for (const e of ents) { offs.push(x.length); x = x.concat(params(e)); }
  const build = (v: number[]) => {
    const m = new Map<string, Entity>();
    ents.forEach((e, i) => m.set(e.id, withParams(e, v.slice(offs[i], offs[i] + params(e).length))));
    return m;
  };
  const F = (v: number[]) => { const m = build(v); return cons.flatMap((c) => residuals(c, (id) => m.get(id))); };
  const jac = (v: number[], r0: number[]) => {
    const J = r0.map(() => new Array(v.length).fill(0));
    for (let j = 0; j < v.length; j++) {
      const h = 1e-7 * Math.max(1, Math.abs(v[j]));
      const vv = [...v]; vv[j] += h;
      const r1 = F(vv);
      for (let i = 0; i < r0.length; i++) J[i][j] = (r1[i] - r0[i]) / h;
    }
    return J;
  };
  const sq = (r: number[]) => r.reduce((s, k) => s + k * k, 0);
  let r = F(x), err = sq(r), lambda = 1e-3;
  for (let it = 0; it < 100 && err > 1e-20; it++) {
    const J = jac(x, r);
    const n = x.length;
    const JtJ = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => J.reduce((s, row) => s + row[i] * row[j], 0)));
    const Jtr = Array.from({ length: n }, (_, i) => J.reduce((s, row, k) => s + row[i] * r[k], 0));
    let improved = false;
    for (let tries = 0; tries < 10; tries++) {
      // damping proportional to 1 keeps steps small → geometry moves as little as possible
      const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v + lambda * (1 + v) : v)));
      const dx = solveLinear(A, Jtr.map((k) => -k));
      if (!dx) { lambda *= 10; continue; }
      const xn = x.map((v, i) => v + dx[i]);
      const rn = F(xn), en = sq(rn);
      if (en < err) { x = xn; r = rn; err = en; lambda = Math.max(lambda / 10, 1e-12); improved = true; break; }
      lambda *= 10;
    }
    if (!improved) break;
  }
  const m = build(x);
  const drawing = { ...d, entities: d.entities.map((e) => m.get(e.id) ?? e) };
  const J = jac(x, r);
  const used = new Set(ids);
  return { drawing, ok: Math.sqrt(err) < 1e-6, dof: x.length - rank(J) + freeDof(d, used), error: Math.sqrt(err) };
}

// Degrees of freedom of geometry that no constraint touches (construction text excluded).
function freeDof(d: Drawing, used: Set<string>) {
  return d.entities.filter((e) => !used.has(e.id) && e.type !== 'text').reduce((s, e) => s + params(e).length, 0);
}

// Value a dimension currently measures (used to pre-fill the input).
export function measure(c: Constraint, d: Drawing): number {
  const get = (id: string) => d.entities.find((e) => e.id === id);
  const probe = { ...c, value: 0 } as Constraint;
  const r = residuals(probe, get)[0];
  if (c.type === 'angle') return Math.round(((r * 180) / Math.PI) * 1e6) / 1e6;
  return Math.round(r * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// Profiles: closed loops for 3D sketches. Closed polylines and circles are loops
// on their own; lines, arcs and open polylines are chained end-to-end.
// ---------------------------------------------------------------------------

export type ProfileSeg = { k: 'line'; a: Pt; b: Pt } | { k: 'arc'; a: Pt; m: Pt; b: Pt };
export type Profile = { kind: 'circle'; c: Pt; r: number; depth: number } | { kind: 'loop'; segs: ProfileSeg[]; depth: number };

function tessellate(p: Profile): Pt[] {
  if (p.kind === 'circle') return Array.from({ length: 48 }, (_, i) => polar(p.c, p.r, (TAU * i) / 48));
  const out: Pt[] = [];
  for (const s of p.segs) {
    if (s.k === 'line') out.push(s.a);
    else {
      const arc = arcFrom3(s.a, s.m, s.b);
      if (!arc) { out.push(s.a); continue; }
      const startsAtA0 = dist(arcStart(arc), s.a) < dist(arcEnd(arc), s.a);
      const sw = arcSweep(arc);
      for (let i = 0; i < 16; i++) out.push(polar(arc.c, arc.r, startsAtA0 ? arc.a0 + (sw * i) / 16 : arc.a1 - (sw * i) / 16));
    }
  }
  return out;
}

function inside(p: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function profilesFromDrawing(d: Drawing): Profile[] {
  const tol = 1e-6 * Math.max(1, ...d.entities.flatMap((e) => params(e).map(Math.abs)));
  const close = (a: Pt, b: Pt) => dist(a, b) <= Math.max(tol, 1e-6);
  const profiles: Profile[] = [];
  const open: ProfileSeg[] = [];
  for (const e of visible(d)) {
    if (e.construction) continue;
    if (e.type === 'circle') profiles.push({ kind: 'circle', c: e.c, r: e.r, depth: 0 });
    else if (e.type === 'pline' && e.closed && e.pts.length > 2)
      profiles.push({ kind: 'loop', depth: 0, segs: e.pts.map((a, i) => ({ k: 'line', a, b: e.pts[(i + 1) % e.pts.length] })) });
    else if (e.type === 'line') open.push({ k: 'line', a: e.a, b: e.b });
    else if (e.type === 'pline') e.pts.slice(1).forEach((b, i) => open.push({ k: 'line', a: e.pts[i], b }));
    else if (e.type === 'arc') open.push({ k: 'arc', a: arcStart(e), m: arcMid(e), b: arcEnd(e) });
  }
  const rev = (s: ProfileSeg): ProfileSeg => (s.k === 'line' ? { k: 'line', a: s.b, b: s.a } : { k: 'arc', a: s.b, m: s.m, b: s.a });
  const used = new Set<number>();
  for (let i = 0; i < open.length; i++) {
    if (used.has(i)) continue;
    const chain = [open[i]];
    used.add(i);
    for (let guard = 0; guard < open.length; guard++) {
      const end = chain[chain.length - 1].b;
      if (chain.length > 1 && close(end, chain[0].a)) break;
      const j = open.findIndex((s, k) => !used.has(k) && (close(s.a, end) || close(s.b, end)));
      if (j < 0) break;
      used.add(j);
      chain.push(close(open[j].a, end) ? open[j] : rev(open[j]));
    }
    if (chain.length > 1 && close(chain[chain.length - 1].b, chain[0].a)) profiles.push({ kind: 'loop', segs: chain, depth: 0 });
  }
  // nesting depth: even = material, odd = hole
  const polys = profiles.map(tessellate);
  profiles.forEach((p, i) => {
    const probe = polys[i][0];
    p.depth = polys.filter((q, j) => j !== i && inside(probe, q)).length;
  });
  return profiles;
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
  const deg = (a: number) => (norm(a) * 180) / Math.PI;
  for (const e of d.entities) {
    if (e.type === 'circle') { g(0, 'CIRCLE'); g(8, e.layer); g(10, e.c.x); g(20, e.c.y); g(30, 0); g(40, e.r); }
    else if (e.type === 'arc') { g(0, 'ARC'); g(8, e.layer); g(10, e.c.x); g(20, e.c.y); g(30, 0); g(40, e.r); g(50, deg(e.a0)); g(51, deg(e.a1)); }
    else if (e.type === 'text') { g(0, 'TEXT'); g(8, e.layer); g(10, e.p.x); g(20, e.p.y); g(30, 0); g(40, e.h); g(1, e.text); }
    else for (const [a, b] of segments(e)) line(a, b, e.layer);
  }
  g(0, 'ENDSEC'); g(0, 'EOF');
  return o.join('\n') + '\n';
}
