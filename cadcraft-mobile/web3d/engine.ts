// 3D engine that runs inside the WebView. Builds B-rep solids with OpenCascade (via replicad),
// renders them with three.js, handles picking, assemblies, STEP/STL export and 2D projections
// for technical drawings. Bundled by scripts/build-3d.mjs; the OCCT wasm is loaded from the
// same folder as the page (occt.wasm). Do not import this from the React Native side.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import opencascade from 'replicad-opencascadejs';
import * as R from 'replicad';
import type {
  AssemblyDoc, EnginePart, EngineSketch, Feature, FromEngine, Mate, Polyline, ProjView, Projection, Ref, ToEngine, V3,
} from '../src/part';
import type { Profile } from '../src/cad';

const post = (m: FromEngine) => {
  const s = JSON.stringify(m);
  (window as any).ReactNativeWebView?.postMessage(s);
  if (window.parent !== window) window.parent.postMessage(s, '*'); // web preview in an iframe
  (window as any).__onEngineMessage?.(m); // tests
};

// ---------------------------------------------------------------------------
// three.js scene (Z up, like Inventor)
// ---------------------------------------------------------------------------
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1120');
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100000);
camera.position.set(80, -100, 70);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight('#ffffff', '#334155', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.4);
scene.add(sun);
const grid = new THREE.GridHelper(200, 20, '#334155', '#1e293b');
grid.rotation.x = Math.PI / 2;
scene.add(grid, new THREE.AxesHelper(30));

const edgeMat = new THREE.LineBasicMaterial({ color: '#0f172a' });
const hiEdgeMat = new THREE.LineBasicMaterial({ color: '#f97316', linewidth: 3, depthTest: false });
const toolMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.18, depthWrite: false });
const sketchMat = new THREE.LineBasicMaterial({ color: '#facc15' });
const hiFaceMat = new THREE.MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false });
const content = new THREE.Group();
scene.add(content);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  sun.position.copy(camera.position);
  renderer.render(scene, camera);
});

const bodyMaterial = (color: string, selected = false) =>
  new THREE.MeshStandardMaterial({
    color, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide,
    emissive: selected ? '#0e7490' : '#000000', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

// Mesh of one solid, with face/edge groups kept for picking.
type Meshed = { group: THREE.Group; mesh: THREE.Mesh; edges: THREE.LineSegments; faceGroups: { start: number; count: number }[]; edgeGroups: { start: number; count: number }[] };

function meshShape(shape: any, color: string, size: number, selected = false): Meshed {
  const tol = Math.max(size / 1500, 0.005);
  const m = shape.mesh({ tolerance: tol, angularTolerance: 0.25 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.vertices, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normals, 3));
  g.setIndex(m.triangles);
  const mesh = new THREE.Mesh(g, bodyMaterial(color, selected));
  const e = shape.meshEdges({ tolerance: tol, angularTolerance: 0.25 });
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.Float32BufferAttribute(e.lines, 3));
  const edges = new THREE.LineSegments(eg, edgeMat);
  const group = new THREE.Group();
  group.add(mesh, edges);
  return { group, mesh, edges, faceGroups: m.faceGroups, edgeGroups: e.edgeGroups };
}

// ---------------------------------------------------------------------------
// Part evaluation
// ---------------------------------------------------------------------------
type Built = { body: any | null; tools: Map<string, { shape: any; op: string }>; errors: Record<string, string> };

const files = new Map<string, string>(); // imported STEP text by file id
const imported = new Map<string, any>(); // parsed STEP shapes
let stepCache = new Map<string, Built & { keys: string[] }>(); // per part id: last build + per-step keys
const stepShapes = new Map<string, { body: any; tool: any }>(); // key → shapes after that feature

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
};

function planeOf(sk: { plane: string; offset: number; frame?: { origin: V3; x: V3; n: V3 } }): any {
  if (sk.frame) return new R.Plane(sk.frame.origin, sk.frame.x, sk.frame.n);
  return R.makePlane(sk.plane as any, sk.offset);
}

function profileDrawing(p: Profile): any {
  if (p.kind === 'circle') return R.drawCircle(p.r).translate(p.c.x, p.c.y);
  let pen: any = R.draw([p.segs[0].a.x, p.segs[0].a.y]);
  p.segs.forEach((s, i) => {
    const last = i === p.segs.length - 1;
    if (s.k === 'line') { if (!last) pen = pen.lineTo([s.b.x, s.b.y]); }
    else pen = pen.threePointsArcTo([s.b.x, s.b.y], [s.m.x, s.m.y]);
  });
  return pen.close();
}

function sketchDrawing(sk: EngineSketch, onlyOuter = false): any {
  if (!sk.profiles.length) throw new Error('Esboço sem perfis fechados');
  const byDepth = [...sk.profiles].sort((a, b) => a.depth - b.depth);
  let d: any = null;
  for (const p of byDepth) {
    if (onlyOuter && p.depth > 0) continue;
    const pd = profileDrawing(p);
    if (!d) d = pd;
    else d = p.depth % 2 ? d.cut(pd) : d.fuse(pd);
  }
  return d;
}

const AXIS_DIR: Record<string, V3> = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };

function cone(r1: number, r2: number, h: number) {
  return (R.draw([0, 0]).hLine(r1).lineTo([r2, h]).hLine(-r2).close() as any).sketchOnPlane('XZ').revolve([0, 0, 1]);
}

const alignZ = (shape: any, axis: string) => (axis === 'X' ? shape.rotate(90, [0, 0, 0], [0, 1, 0]) : axis === 'Y' ? shape.rotate(-90, [0, 0, 0], [1, 0, 0]) : shape);

function edgeFilter(f: Feature & { edges: any }, body: any, tol: number) {
  const sel = f.edges;
  const [[, , zmin], [, , zmax]] = body.boundingBox.bounds;
  switch (sel.mode) {
    case 'all': return undefined;
    case 'top': return (e: any) => e.inPlane('XY', zmax);
    case 'bottom': return (e: any) => e.inPlane('XY', zmin);
    case 'vertical': return (e: any) => e.inDirection('Z');
    case 'circular': return (e: any) => e.ofCurveType('CIRCLE');
    default:
      if (!sel.points.length) throw new Error('Toque nas arestas no modelo (modo seleção)');
      return (e: any) => e.either(sel.points.map((p: V3) => (g: any) => g.atDistance(0, p, tol)));
  }
}

function sizeOf(shape: any) {
  const [[a, b, c], [d, e, f]] = shape.boundingBox.bounds;
  return Math.hypot(d - a, e - b, f - c) || 1;
}

function tool(f: Feature, part: EnginePart, body: any, tools: Map<string, { shape: any; op: string }>): { shape: any; op: string; replaces?: boolean } {
  const sketch = (id: string) => {
    const s = part.sketches.find((k) => k.id === id);
    if (!s) throw new Error('Selecione um esboço');
    return s;
  };
  const needBody = () => { if (!body) throw new Error('Precisa de um sólido antes desta feature'); return body; };
  switch (f.type) {
    case 'extrude': {
      const sk = sketch(f.sketch);
      if (!(f.distance > 0)) throw new Error('Distância deve ser > 0');
      const pl = planeOf(sk);
      const n = pl.zDir.toTuple() as V3;
      let s = sketchDrawing(sk).sketchOnPlane(pl).extrude(f.distance);
      // a cut from a sketch on a model face goes into the material (its normal points outwards)
      const dir = sk.frame && f.op === 'cut' && f.direction === 'normal' ? 'reversed' : f.direction;
      const k = dir === 'reversed' ? -f.distance : dir === 'symmetric' ? -f.distance / 2 : 0;
      if (k) s = s.translate(n.map((v) => v * k) as V3);
      return { shape: s, op: f.op };
    }
    case 'revolve': {
      const sk = sketch(f.sketch);
      const pl = planeOf(sk);
      const axis = (f.axis === 'X' ? pl.xDir : pl.yDir).toTuple();
      const s = sketchDrawing(sk).sketchOnPlane(pl)
        .revolve(axis, { origin: pl.origin.toTuple(), angle: Math.min(Math.max(f.angle, 1), 360) });
      return { shape: s, op: f.op };
    }
    case 'loft': {
      const sks = f.sketches.map(sketch);
      if (sks.length < 2) throw new Error('Escolha 2 ou mais esboços');
      const [first, ...rest] = sks.map((sk) => sketchDrawing(sk, true).sketchOnPlane(planeOf(sk)));
      return { shape: first.loftWith(rest, { ruled: f.ruled === 'sim' }), op: f.op };
    }
    case 'box':
      if (!(f.w > 0 && f.d > 0 && f.h > 0)) throw new Error('Dimensões devem ser > 0');
      return { shape: R.makeBox([f.x, f.y, f.z], [f.x + f.w, f.y + f.d, f.z + f.h]), op: f.op };
    case 'cylinder':
      return { shape: R.makeCylinder(f.r, f.h, [f.x, f.y, f.z], AXIS_DIR[f.axis]), op: f.op };
    case 'cone':
      return { shape: alignZ(cone(f.r1, f.r2, f.h), f.axis).translate([f.x, f.y, f.z]), op: f.op };
    case 'sphere':
      return { shape: R.makeSphere(f.r).translate([f.x, f.y, f.z]), op: f.op };
    case 'hole': {
      const d = AXIS_DIR[f.axis];
      const start: V3 = [f.x - d[0] * f.depth, f.y - d[1] * f.depth, f.z - d[2] * f.depth];
      let s: any = R.makeCylinder(f.d / 2, f.depth + 0.01, start, d);
      if (f.cbd > f.d && f.cbdepth > 0) {
        const cb: V3 = [f.x - d[0] * f.cbdepth, f.y - d[1] * f.cbdepth, f.z - d[2] * f.cbdepth];
        s = s.fuse(R.makeCylinder(f.cbd / 2, f.cbdepth + 0.01, cb, d));
      }
      return { shape: s, op: 'cut' };
    }
    case 'fillet': case 'chamfer': {
      const b = needBody();
      const v = f.type === 'fillet' ? f.radius : f.distance;
      if (!(v > 0)) throw new Error('Valor deve ser > 0');
      const filter = edgeFilter(f, b, sizeOf(b) / 300);
      const out = f.type === 'fillet' ? b.fillet(v, filter) : b.chamfer(v, filter);
      if (Math.abs(R.measureVolume(out) - R.measureVolume(b)) < 1e-9) throw new Error('Nenhuma aresta foi alterada');
      return { shape: out, op: 'join', replaces: true };
    }
    case 'shell': {
      const b = needBody();
      if (!f.faces.length) throw new Error('Toque na(s) face(s) a remover (modo seleção)');
      const tol = sizeOf(b) / 300;
      const finder = (q: any) => q.either(f.faces.map((p) => (g: any) => g.atDistance(0, p, tol)));
      const v0 = R.measureVolume(b);
      // OCCT sometimes returns the input unchanged instead of failing; retry with a looser tolerance
      for (const t of [undefined, 1e-2, 5e-2]) {
        const out = b.shell(f.thickness, finder, t);
        if (Math.abs(R.measureVolume(out) - v0) > v0 * 1e-6) return { shape: out, op: 'join', replaces: true };
        out.delete?.();
      }
      throw new Error('A casca falhou nessas faces. Dica: aplique a casca antes dos filetes, ou reduza a espessura.');
    }
    case 'rectPattern': case 'circPattern': case 'mirror': {
      const base = tools.get(f.ref);
      if (!base) throw new Error('Selecione uma feature de origem válida');
      const copies: any[] = [];
      if (f.type === 'rectPattern')
        for (let i = 0; i < Math.max(1, Math.round(f.nx)); i++)
          for (let j = 0; j < Math.max(1, Math.round(f.ny)); j++)
            if (i || j) copies.push(base.shape.clone().translate([i * f.dx, j * f.dy, 0]));
      if (f.type === 'circPattern') {
        const n = Math.max(2, Math.round(f.count));
        const step = f.angle >= 360 ? 360 / n : f.angle / (n - 1);
        for (let i = 1; i < n; i++) copies.push(base.shape.clone().rotate(i * step, [0, 0, 0], AXIS_DIR[f.axis]));
      }
      if (f.type === 'mirror') copies.push(base.shape.clone().mirror(f.plane));
      if (!copies.length) throw new Error('Nada para repetir');
      return { shape: copies.reduce((a, b) => a.fuse(b)), op: base.op };
    }
    case 'import': {
      const s = imported.get(f.file);
      if (!s) throw new Error(files.has(f.file) ? 'STEP inválido' : 'Arquivo STEP não carregado');
      return { shape: s.clone(), op: f.op };
    }
  }
}

async function ensureImports(part: EnginePart) {
  for (const f of part.features) {
    if (f.type !== 'import' || !f.file || imported.has(f.file)) continue;
    const txt = files.get(f.file);
    if (!txt) { post({ type: 'needFile', id: f.file }); continue; }
    try { imported.set(f.file, await R.importSTEP(new Blob([txt]))); } catch {}
  }
}

// Builds a part, reusing cached results for the unchanged prefix of the feature tree.
function buildPart(part: EnginePart, stopBefore: string | null = null): Built {
  const errors: Record<string, string> = {};
  const tools = new Map<string, { shape: any; op: string }>();
  let body: any = null;
  let key = hash(part.color);
  const keys: string[] = [];
  for (const f of part.features) {
    if (f.id === stopBefore) break;
    const deps = 'sketch' in f ? [f.sketch] : 'sketches' in f ? f.sketches : [];
    key = hash(key + JSON.stringify(f) + JSON.stringify(part.sketches.filter((s) => deps.includes(s.id))) + (f.type === 'import' && imported.has(f.file) ? 'ok' : ''));
    keys.push(key);
    if (f.suppressed) continue;
    const hit = stepShapes.get(key);
    if (hit) {
      body = hit.body;
      if (hit.tool) tools.set(f.id, { shape: hit.tool, op: (f as any).op ?? 'cut' });
      continue;
    }
    try {
      const t = tool(f, part, body, tools);
      let next: any;
      if (t.replaces) next = t.shape;
      else if (!body) {
        if (t.op !== 'join') throw new Error('A primeira feature precisa ser "Unir"');
        next = t.shape;
      } else if (t.op === 'join') next = body.clone().fuse(t.shape.clone());
      else if (t.op === 'cut') next = body.clone().cut(t.shape.clone());
      else next = body.clone().intersect(t.shape.clone());
      body = next;
      if (!t.replaces) tools.set(f.id, { shape: t.shape, op: t.op });
      stepShapes.set(key, { body, tool: t.replaces ? undefined : t.shape });
    } catch (e: any) {
      errors[f.id] = e?.message ? String(e.message)
        : 'O OpenCascade não conseguiu gerar esta geometria (valor grande demais ou seleção inválida)';
    }
  }
  return { body, tools, errors, ...{ keys } } as any;
}

// Frees shapes that no recent build references (OCCT memory is not garbage collected).
function collect() {
  const live = new Set<string>();
  for (const b of stepCache.values()) (b.keys ?? []).forEach((k) => live.add(k));
  const keep = new Set<any>();
  for (const k of live) { const s = stepShapes.get(k); if (s) { keep.add(s.body); keep.add(s.tool); } }
  for (const [k, s] of stepShapes) {
    if (live.has(k)) continue;
    for (const sh of [s.body, s.tool]) if (sh && !keep.has(sh)) { try { sh.delete(); } catch {} keep.add(sh); }
    stepShapes.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Display state & picking
// ---------------------------------------------------------------------------
type Pickable = { meshed: Meshed; comp?: string; matrix: THREE.Matrix4 };
let pickables: Pickable[] = [];
let pickMode: 'edge' | 'face' | null = null;
let fitPending = true;

function clearContent() {
  content.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material && o.material !== edgeMat && o.material !== sketchMat) o.material.dispose?.(); });
  content.clear();
  pickables = [];
}

function drawSketch(sk: EngineSketch) {
  const pl = planeOf(sk);
  const toW = (x: number, y: number) => new THREE.Vector3(...(pl.toWorldCoords([x, y, 0]).toTuple() as V3));
  for (const p of sk.profiles) {
    const pts: THREE.Vector3[] = [];
    if (p.kind === 'circle') for (let i = 0; i <= 48; i++) pts.push(toW(p.c.x + p.r * Math.cos((i / 48) * Math.PI * 2), p.c.y + p.r * Math.sin((i / 48) * Math.PI * 2)));
    else { p.segs.forEach((s) => { pts.push(toW(s.a.x, s.a.y)); if (s.k === 'arc') pts.push(toW(s.m.x, s.m.y)); }); pts.push(pts[0]); }
    content.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), sketchMat));
  }
}

function nearestEdge(m: Meshed, p: THREE.Vector3): number {
  const pos = m.edges.geometry.getAttribute('position');
  let best = -1, bd = Infinity;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  m.edgeGroups.forEach((g, gi) => {
    for (let i = g.start; i < g.start + g.count; i += 2) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1);
      new THREE.Line3(a, b).closestPointToPoint(p, true, c);
      const d = c.distanceTo(p);
      if (d < bd) { bd = d; best = gi; }
    }
  });
  return best;
}

function highlightEdge(m: Meshed, gi: number, matrix: THREE.Matrix4) {
  const pos = m.edges.geometry.getAttribute('position');
  const g = m.edgeGroups[gi];
  const pts: THREE.Vector3[] = [];
  for (let i = g.start; i < g.start + g.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), hiEdgeMat);
  l.applyMatrix4(matrix);
  l.renderOrder = 10;
  content.add(l);
}

function faceOfTriangle(m: Meshed, tri: number) {
  return m.faceGroups.findIndex((g) => tri * 3 >= g.start && tri * 3 < g.start + g.count);
}

function highlightFace(m: Meshed, fi: number, matrix: THREE.Matrix4) {
  const g = m.faceGroups[fi];
  const geo = m.mesh.geometry.clone();
  geo.setIndex(Array.from(m.mesh.geometry.index!.array).slice(g.start, g.start + g.count));
  const h = new THREE.Mesh(geo, hiFaceMat);
  h.applyMatrix4(matrix);
  h.renderOrder = 9;
  content.add(h);
}

// Analyses a face: planar faces give a normal; cylindrical faces give an axis.
function faceInfo(m: Meshed, fi: number) {
  const g = m.faceGroups[fi];
  const idx = m.mesh.geometry.index!.array;
  const pos = m.mesh.geometry.getAttribute('position');
  const nor = m.mesh.geometry.getAttribute('normal');
  const verts = [...new Set(Array.from(idx).slice(g.start, g.start + g.count))];
  const n0 = new THREE.Vector3().fromBufferAttribute(nor, verts[0]);
  let other = -1;
  for (const v of verts) if (new THREE.Vector3().fromBufferAttribute(nor, v).dot(n0) < 0.999) { other = v; break; }
  if (other < 0) return { normal: n0, axis: undefined };
  const n1 = new THREE.Vector3().fromBufferAttribute(nor, other);
  const d = n0.clone().cross(n1).normalize();
  // axis passes through p - r·n for every vertex: intersect the two normal lines in the plane ⟂ d
  const p0 = new THREE.Vector3().fromBufferAttribute(pos, verts[0]), p1 = new THREE.Vector3().fromBufferAttribute(pos, other);
  const w = p1.clone().sub(p0);
  const a = n0.dot(n1), b = n0.dot(w), c = n1.dot(w);
  const den = 1 - a * a || 1e-9;
  const t = (b - a * c) / den;
  const p = p0.clone().addScaledVector(n0, t);
  return { normal: n0, axis: { p, d } };
}

// Sketch frame on a planar face (origin = world origin projected on the plane, X kept horizontal
// when possible) plus the face boundary in that frame, used as projected reference geometry.
function sketchFrame(m: Meshed, fi: number, p: THREE.Vector3, normal: THREE.Vector3) {
  const n = normal.clone().normalize();
  const x = Math.abs(n.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1).cross(n).normalize();
  if (Math.abs(n.z) > 0.9 && n.z < 0) x.set(-1, 0, 0); // keep a right-handed view from outside the face
  const y = n.clone().cross(x);
  const origin = n.clone().multiplyScalar(n.dot(p));
  const g = m.faceGroups[fi];
  const idx = Array.from(m.mesh.geometry.index!.array).slice(g.start, g.start + g.count);
  const pos = m.mesh.geometry.getAttribute('position');
  // boundary edges are used by exactly one triangle of the face
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const count = new Map<string, [number, number]>();
  for (let t = 0; t < idx.length; t += 3)
    for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      const k = key(a, b);
      if (count.has(k)) count.delete(k); else count.set(k, [a, b]);
    }
  const to2 = (i: number): [number, number] => {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).sub(origin);
    return [Math.round(v.dot(x) * 1e4) / 1e4, Math.round(v.dot(y) * 1e4) / 1e4];
  };
  // chain boundary edges into loops
  const next = new Map<number, number>();
  for (const [a, b] of count.values()) next.set(a, b);
  const seen = new Set<number>();
  const outline: [number, number][][] = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: [number, number][] = [];
    let cur: number | undefined = start;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(to2(cur)); cur = next.get(cur); }
    // drop points that lie on a straight run
    const simple = loop.filter((q, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
      return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 1e-6;
    });
    if (simple.length > 2) outline.push(simple);
  }
  const r = (v: THREE.Vector3) => v.toArray().map((k) => Math.round(k * 1e6) / 1e6) as V3;
  return { frame: { origin: r(origin), x: r(x), n: r(n) }, outline };
}

let downAt: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8 || !pickMode) return;
  downAt = null;
  const ray = new THREE.Raycaster(undefined, undefined, 0, 1e9);
  ray.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
  ray.params.Line = { threshold: camera.position.distanceTo(controls.target) / 60 };
  const targets = pickables.flatMap((p) => (pickMode === 'edge' ? [p.meshed.edges, p.meshed.mesh] : [p.meshed.mesh]));
  const hits = ray.intersectObjects(targets, false);
  const hit = pickMode === 'edge' ? hits.find((h) => h.object instanceof THREE.LineSegments) ?? hits[0] : hits[0];
  if (!hit) return;
  const owner = pickables.find((p) => p.meshed.edges === hit.object || p.meshed.mesh === hit.object)!;
  const inv = owner.matrix.clone().invert();
  const local = hit.point.clone().applyMatrix4(inv);
  const toArr = (v: THREE.Vector3) => v.toArray().map((k) => Math.round(k * 1e5) / 1e5) as V3;
  if (pickMode === 'edge') {
    const gi = nearestEdge(owner.meshed, local);
    // snap the stored point onto the edge polyline so the rebuild finds it again
    const pos = owner.meshed.edges.geometry.getAttribute('position');
    const g = owner.meshed.edgeGroups[gi];
    const mid = Math.floor(g.count / 4) * 2;
    const a = new THREE.Vector3().fromBufferAttribute(pos, g.start + mid), b = new THREE.Vector3().fromBufferAttribute(pos, g.start + mid + 1);
    post({ type: 'pick', ref: { comp: owner.comp, kind: 'edge', point: toArr(a.add(b).multiplyScalar(0.5)), normal: [0, 0, 1] } });
  } else {
    const fi = faceOfTriangle(owner.meshed, hit.faceIndex ?? 0);
    const info = faceInfo(owner.meshed, fi);
    const sk = info.axis ? null : sketchFrame(owner.meshed, fi, local, info.normal);
    post({ type: 'pick', ref: {
      comp: owner.comp, kind: 'face', point: toArr(local), normal: toArr(info.normal),
      axis: info.axis && { p: toArr(info.axis.p), d: toArr(info.axis.d) },
      ...(sk ?? {}),
    } });
  }
});

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
let lastPart: EnginePart | null = null;

async function showPart(m: Extract<ToEngine, { type: 'part' }>) {
  const part = m.part;
  await ensureImports(part);
  const built = buildPart(part, m.rollback);
  const full = m.rollback ? buildPart(part) : built;
  stepCache.set(part.id, { ...full, keys: [...((full as any).keys ?? []), ...((built as any).keys ?? [])] } as any);
  collect();
  lastPart = part;
  pickMode = m.pick;
  clearContent();
  const body = built.body;
  // like Inventor, a sketch is hidden once a feature consumes it
  const used = new Set(part.features.filter((f) => !f.suppressed).flatMap((f) => ('sketch' in f ? [f.sketch] : 'sketches' in f ? f.sketches : [])));
  part.sketches.filter((s) => !used.has(s.id)).forEach(drawSketch);
  let res: FromEngine = { type: 'partResult', volume: 0, area: 0, bbox: null, errors: full.errors };
  if (full.body) {
    const [[a, b, c], [d, e, f]] = full.body.boundingBox.bounds;
    res = { ...res, volume: R.measureVolume(full.body), area: R.measureArea(full.body), bbox: [d - a, e - b, f - c] };
  }
  if (body) {
    const meshed = meshShape(body, part.color, sizeOf(body));
    content.add(meshed.group);
    const I = new THREE.Matrix4();
    pickables.push({ meshed, matrix: I });
    for (const p of m.highlight) {
      const v = new THREE.Vector3(...p);
      if (m.pick === 'face' || (m.selected && part.features.find((x) => x.id === m.selected)?.type === 'shell')) {
        const hit = closestFace(meshed, v);
        if (hit >= 0) highlightFace(meshed, hit, I);
      } else highlightEdge(meshed, nearestEdge(meshed, v), I);
    }
    const sel = built.tools.get(m.selected ?? '') ?? full.tools.get(m.selected ?? '');
    if (sel && !m.pick) {
      const t = meshShape(sel.shape, '#22d3ee', sizeOf(sel.shape));
      t.mesh.material = toolMat;
      t.edges.visible = false;
      content.add(t.mesh);
    }
  }
  post(res);
  if (fitPending && body) { setView('iso'); fitPending = false; }
}

function closestFace(m: Meshed, p: THREE.Vector3) {
  const pos = m.mesh.geometry.getAttribute('position');
  const idx = m.mesh.geometry.index!.array;
  let best = -1, bd = Infinity;
  const tri = new THREE.Triangle(), q = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    tri.setFromAttributeAndIndices(pos, idx[t], idx[t + 1], idx[t + 2]);
    tri.closestPointToPoint(p, q);
    const d = q.distanceTo(p);
    if (d < bd) { bd = d; best = t / 3; }
  }
  return best < 0 ? -1 : faceOfTriangle(m, best);
}

// --- assemblies ---
const compMatrix = (pos: V3, rot: V3) => {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(rot.map((r) => (r * Math.PI) / 180) as V3), 'XYZ'));
  return m.setPosition(...pos);
};

// Applies mates in order (three passes so chains settle); the non-grounded side moves.
function solveMates(asm: AssemblyDoc): Map<string, THREE.Matrix4> {
  const T = new Map(asm.components.map((c) => [c.id, compMatrix(c.pos, c.rot)] as const));
  const grounded = new Set(asm.components.filter((c) => c.grounded).map((c) => c.id));
  const world = (r: Ref) => {
    const M = T.get(r.comp)!;
    const n3 = new THREE.Matrix3().getNormalMatrix(M);
    return {
      p: new THREE.Vector3(...r.point).applyMatrix4(M), n: new THREE.Vector3(...r.normal).applyMatrix3(n3).normalize(),
      ap: r.axis && new THREE.Vector3(...r.axis.p).applyMatrix4(M), ad: r.axis && new THREE.Vector3(...r.axis.d).applyMatrix3(n3).normalize(),
    };
  };
  const mates = asm.mates.filter((m) => !m.suppressed && T.has(m.a.comp) && T.has(m.b.comp));
  for (let pass = 0; pass < 3; pass++)
    for (const mt of mates) {
      let [fix, mov] = [mt.a, mt.b];
      if (grounded.has(mov.comp) && !grounded.has(fix.comp)) [fix, mov] = [mov, fix];
      if (grounded.has(mov.comp)) continue;
      const A = world(fix), B = world(mov);
      const M = T.get(mov.comp)!;
      const rotateAbout = (from: THREE.Vector3, to: THREE.Vector3, pivot: THREE.Vector3) => {
        const q = new THREE.Quaternion().setFromUnitVectors(from, to);
        const R4 = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
          .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
          .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
        M.premultiply(R4);
      };
      const move = (v: THREE.Vector3) => M.premultiply(new THREE.Matrix4().makeTranslation(v.x, v.y, v.z));
      if (mt.type === 'mate' || mt.type === 'flush') {
        const target = mt.type === 'mate' ? A.n.clone().negate() : A.n.clone();
        rotateAbout(B.n, target, B.p);
        const B2 = world(mov);
        const gap = B2.p.clone().sub(A.p).dot(A.n);
        move(A.n.clone().multiplyScalar(mt.offset - gap));
      } else if (mt.type === 'axis') {
        if (!A.ad || !B.ad || !A.ap || !B.ap) continue;
        const to = B.ad.dot(A.ad) >= 0 ? A.ad.clone() : A.ad.clone().negate();
        rotateAbout(B.ad, to, B.ap);
        const B2 = world(mov);
        const off = B2.ap!.clone().sub(A.ap);
        off.sub(A.ad.clone().multiplyScalar(off.dot(A.ad))); // only remove the radial offset
        move(off.negate());
      } else {
        move(A.p.clone().sub(B.p).add(A.n.clone().multiplyScalar(mt.offset)));
      }
    }
  return T;
}

let lastAsm: { asm: AssemblyDoc; parts: EnginePart[] } | null = null;

function partBody(p: EnginePart) {
  const b = buildPart(p);
  stepCache.set(p.id, b as any);
  return b.body;
}

function placedShapes(asm: AssemblyDoc, parts: EnginePart[]) {
  const T = solveMates(asm);
  const out: { comp: string; name: string; shape: any; color: string; matrix: THREE.Matrix4 }[] = [];
  for (const c of asm.components) {
    if (!c.visible) continue;
    const p = parts.find((x) => x.id === c.part);
    const body = p && partBody(p);
    if (!body) continue;
    const m = T.get(c.id)!;
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(pos, q, s);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    const axis = new THREE.Vector3(q.x, q.y, q.z);
    if (axis.lengthSq() < 1e-12) axis.set(0, 0, 1); else axis.normalize();
    let shape = body.clone();
    if (ang > 1e-9) shape = shape.rotate((Math.sign(q.w || 1) * ang * 180) / Math.PI, [0, 0, 0], axis.toArray());
    shape = shape.translate(pos.toArray());
    out.push({ comp: c.id, name: c.name, shape, color: p!.color, matrix: m });
  }
  return out;
}

let asmShapes: ReturnType<typeof placedShapes> = [];

async function showAssembly(m: Extract<ToEngine, { type: 'assembly' }>) {
  for (const p of m.parts) await ensureImports(p);
  lastAsm = { asm: m.asm, parts: m.parts };
  lastPart = null;
  asmShapes.forEach((s) => { try { s.shape.delete(); } catch {} });
  const T = solveMates(m.asm);
  clearContent();
  pickMode = m.pick ? 'face' : null;
  const errors: Record<string, string> = {};
  const box = new THREE.Box3();
  for (const c of m.asm.components) {
    if (!c.visible) continue;
    const p = m.parts.find((x) => x.id === c.part);
    if (!p) { errors[c.id] = 'Peça não encontrada'; continue; }
    const body = partBody(p);
    if (!body) { errors[c.id] = 'Peça sem sólido'; continue; }
    const meshed = meshShape(body, p.color, sizeOf(body), c.id === m.selected);
    const M = T.get(c.id)!;
    meshed.group.applyMatrix4(M);
    content.add(meshed.group);
    pickables.push({ meshed, comp: c.id, matrix: M });
    box.expandByObject(meshed.group);
    for (const r of m.highlight.filter((h) => h.comp === c.id)) {
      const fi = closestFace(meshed, new THREE.Vector3(...r.point));
      if (fi >= 0) highlightFace(meshed, fi, M);
    }
  }
  collect();
  // interference check between every pair of placed bodies
  asmShapes = placedShapes(m.asm, m.parts);
  const interferences: { a: string; b: string; volume: number }[] = [];
  for (let i = 0; i < asmShapes.length; i++)
    for (let j = i + 1; j < asmShapes.length; j++) {
      try {
        const x = asmShapes[i].shape.clone().intersect(asmShapes[j].shape.clone());
        const v = R.measureVolume(x);
        x.delete();
        if (v > 0.01) interferences.push({ a: asmShapes[i].comp, b: asmShapes[j].comp, volume: v });
      } catch {}
    }
  const s = box.isEmpty() ? null : box.getSize(new THREE.Vector3()).toArray() as V3;
  post({ type: 'asmResult', bbox: s, errors, interferences });
  if (fitPending && s) { setView('iso'); fitPending = false; }
}

function setView(name: string) {
  const box = new THREE.Box3().setFromObject(content);
  const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const r = box.isEmpty() ? 60 : Math.max(box.getSize(new THREE.Vector3()).length(), 10);
  const dirs: Record<string, V3> = { iso: [1, -1, 0.8], top: [0, -0.001, 1], front: [0, -1, 0], right: [1, 0, 0] };
  const d = new THREE.Vector3(...(dirs[name] ?? (camera.position.clone().sub(controls.target).toArray() as V3))).normalize();
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(d, r * 1.6);
  camera.lookAt(c);
}

// ---------------------------------------------------------------------------
// Export & projections
// ---------------------------------------------------------------------------
function currentShapes(scope: 'part' | 'assembly'): { shape: any; name: string; color: string }[] {
  if (scope === 'part') {
    const b = lastPart && stepCache.get(lastPart.id)?.body;
    return b ? [{ shape: b, name: 'peca', color: lastPart!.color }] : [];
  }
  return asmShapes.map((s) => ({ shape: s.shape, name: s.name, color: s.color }));
}

async function blobToBase64(b: Blob) {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function exportShapes(m: Extract<ToEngine, { type: 'export' }>) {
  const shapes = currentShapes(m.scope);
  if (!shapes.length) return post({ type: 'export', req: m.req, error: 'Nada para exportar' });
  try {
    let blob: Blob;
    if (m.format === 'step') blob = R.exportSTEP(shapes.map((s) => ({ shape: s.shape, name: s.name, color: s.color })));
    else {
      const all = shapes.length === 1 ? shapes[0].shape : (R as any).makeCompound(shapes.map((s) => s.shape));
      blob = all.blobSTL({ binary: true, tolerance: sizeOf(all) / 2000, angularTolerance: 0.2 });
    }
    post({ type: 'export', req: m.req, base64: await blobToBase64(blob) });
  } catch (e: any) {
    post({ type: 'export', req: m.req, error: String(e?.message ?? e) });
  }
}

// Flattens a replicad Drawing (Blueprint / Blueprints / CompoundBlueprint) into polylines.
function polylines(drawing: any): Polyline[] {
  const out: Polyline[] = [];
  const walk = (s: any) => {
    if (!s) return;
    if (s.curves) {
      const pl: Polyline = [];
      for (const c of s.curves) {
        if (c.geomType === 'LINE') { if (!pl.length) pl.push(c.firstPoint); pl.push(c.lastPoint); continue; }
        const a = c.firstParameter, b = c.lastParameter;
        for (let i = pl.length ? 1 : 0; i <= 24; i++) pl.push(c.value(a + ((b - a) * i) / 24));
      }
      if (pl.length > 1) out.push(pl.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]));
      return;
    }
    for (const k of ['blueprints', 'innerShape', 'outline', 'holes']) {
      const v = s[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && v !== s) walk(v);
    }
  };
  walk(drawing.innerShape ?? drawing);
  return out;
}

function project(m: Extract<ToEngine, { type: 'project' }>) {
  const shapes = currentShapes(m.scope);
  if (!shapes.length) return post({ type: 'project', req: m.req, error: 'Nada para projetar' });
  try {
    const all = shapes.length === 1 ? shapes[0].shape : (R as any).makeCompound(shapes.map((s) => s.shape.clone()));
    const views: Projection[] = m.views.map((v: ProjView) => {
      const cam = v === 'iso' ? new R.ProjectionCamera([1, -1, 1], [-1, 1, -1]).lookAt(all) : v;
      const { visible, hidden } = R.drawProjection(all, cam as any);
      const vis = polylines(visible), hid = polylines(hidden);
      const xs = vis.flat().map((p) => p[0]), ys = vis.flat().map((p) => p[1]);
      return { view: v, visible: vis, hidden: hid, min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] } as Projection;
    });
    post({ type: 'project', req: m.req, views });
  } catch (e: any) {
    post({ type: 'project', req: m.req, error: String(e?.message ?? e) });
  }
}

function measure(m: Extract<ToEngine, { type: 'measure' }>) {
  const volumes: Record<string, number> = {};
  for (const p of m.parts) {
    try { const b = partBody(p); volumes[p.id] = b ? R.measureVolume(b) : 0; } catch { volumes[p.id] = 0; }
  }
  post({ type: 'measure', req: m.req, volumes });
}

// ---------------------------------------------------------------------------
// Messaging (serialised so builds never overlap)
// ---------------------------------------------------------------------------
let oc: any = null;
let queue = Promise.resolve();
let pendingScene: ToEngine | null = null;

function onMessage(raw: any) {
  let m: ToEngine;
  try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  if (!m?.type || !('type' in m)) return;
  if (m.type === 'part' || m.type === 'assembly') {
    const kind = m.type;
    // a new scene replaces any scene still waiting in the queue
    const isNew = !pendingScene;
    if (lastAsm && kind === 'part' || lastPart && kind === 'assembly') fitPending = true;
    pendingScene = m;
    if (!isNew) return;
  }
  queue = queue.then(async () => {
    if (!oc) return;
    try {
      if (m.type === 'part' || m.type === 'assembly') {
        const s = pendingScene!;
        pendingScene = null;
        if (s.type === 'part') await showPart(s); else if (s.type === 'assembly') await showAssembly(s);
      } else if (m.type === 'file') { files.set(m.id, atob(m.base64)); imported.delete(m.id); }
      else if (m.type === 'view') setView(m.name);
      else if (m.type === 'export') await exportShapes(m);
      else if (m.type === 'project') project(m);
      else if (m.type === 'measure') measure(m);
    } catch (e: any) {
      post({ type: 'log', msg: String(e?.message ?? e) });
    }
  });
}
window.addEventListener('message', (e) => onMessage(e.data));
document.addEventListener('message', (e: any) => onMessage(e.data)); // Android WebView
(window as any).cadEngine = { send: onMessage };

function loadWasm(): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('GET', new URLSearchParams(location.search).get('wasm') ?? 'occt.wasm');
    x.responseType = 'arraybuffer';
    x.onload = () => (x.response && (x.status === 0 || x.status === 200) ? res(x.response) : rej(new Error('HTTP ' + x.status)));
    x.onerror = () => rej(new Error('não foi possível ler occt.wasm'));
    x.send();
  });
}

// The wasm URL may point at a small JSON manifest listing chunk files (used where hosts cap file size).
async function loadEngineBinary(): Promise<ArrayBuffer> {
  const buf = await loadWasm();
  const head = new Uint8Array(buf, 0, Math.min(1, buf.byteLength));
  if (head[0] !== 0x7b) return buf; // not '{'
  const base = new URL(new URLSearchParams(location.search).get('wasm') ?? 'occt.wasm', location.href);
  const { parts } = JSON.parse(new TextDecoder().decode(buf)) as { parts: string[] };
  const chunks = await Promise.all(parts.map((p) => fetch(new URL(p, base)).then((r) => r.arrayBuffer())));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let o = 0;
  for (const c of chunks) { out.set(new Uint8Array(c), o); o += c.byteLength; }
  return out.buffer;
}

loadEngineBinary()
  .then((wasmBinary) => (opencascade as any)({ wasmBinary }))
  .then((instance: any) => {
    R.setOC(instance);
    oc = instance;
    post({ type: 'ready' });
  })
  .catch((e: any) => post({ type: 'log', msg: 'Falha ao iniciar o motor 3D: ' + e }));
(window as any).__dbg = { THREE, camera }; // used by scripts/engine-test.ts
