// 3D engine that runs inside the WebView: evaluates the feature tree with Manifold (robust
// mesh booleans) and renders it with three.js. Bundled into src/engine3d.generated.ts by
// scripts/build-3d.mjs — do not import from the React Native side.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Module from 'manifold-3d';
import type { Feature, FromEngine, Part, Plane, Sketch, ToEngine } from '../src/part';

declare const WASM_BASE64: string;

const post = (m: FromEngine) => {
  const s = JSON.stringify(m);
  (window as any).ReactNativeWebView?.postMessage(s);
  if (window.parent !== window) window.parent.postMessage(s, '*'); // web preview in an iframe
};

// --- three.js scene (Z up, like Inventor) ---
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

const bodyMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const edgeMat = new THREE.LineBasicMaterial({ color: '#0f172a' });
const toolMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', wireframe: true, transparent: true, opacity: 0.35 });
const sketchMat = new THREE.LineBasicMaterial({ color: '#facc15' });
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

// --- geometry evaluation ---
let wasm: any;
let lastMesh: { pos: Float32Array; idx: Uint32Array } | null = null;
let lastPart: Part | null = null;

// Rotation (deg) taking sketch-local XY (+Z normal) onto the work plane.
const PLANE_ROT: Record<Plane, [number, number, number]> = { XY: [0, 0, 0], XZ: [90, 0, 0], YZ: [90, 0, 90] };
const PLANE_N: Record<Plane, [number, number, number]> = { XY: [0, 0, 1], XZ: [0, -1, 0], YZ: [1, 0, 0] };
const AXIS_ROT: Record<'X' | 'Y' | 'Z', [number, number, number]> = { Z: [0, 0, 0], X: [0, 90, 0], Y: [-90, 0, 0] };

const onPlane = (m: any, sk: Sketch) => {
  const n = PLANE_N[sk.plane];
  return m.rotate(PLANE_ROT[sk.plane]).translate([n[0] * sk.offset, n[1] * sk.offset, n[2] * sk.offset]);
};

function section(sk: Sketch) {
  if (!sk.loops.length) throw new Error('Esboço sem perfis fechados');
  return new wasm.CrossSection(sk.loops.map((l) => l.map((p) => [p.x, p.y])), 'EvenOdd');
}

// Builds the tool body of one feature (in world space) plus how it combines with the part.
function tool(f: Feature, part: Part, tools: Map<string, { m: any; op: string }>): { m: any; op: string } {
  const { Manifold } = wasm;
  const sketch = (id: string) => {
    const s = part.sketches.find((k) => k.id === id);
    if (!s) throw new Error('Selecione um esboço');
    return s;
  };
  switch (f.type) {
    case 'extrude': {
      const sk = sketch(f.sketch);
      if (!(f.distance > 0)) throw new Error('Distância deve ser > 0');
      let m = section(sk).extrude(f.distance);
      if (f.direction === 'reversed') m = m.translate([0, 0, -f.distance]);
      if (f.direction === 'symmetric') m = m.translate([0, 0, -f.distance / 2]);
      return { m: onPlane(m, sk), op: f.op };
    }
    case 'revolve': {
      const sk = sketch(f.sketch);
      let cs = section(sk);
      if (f.axis === 'X') cs = cs.rotate(-90);
      // Manifold revolves around the section's Y axis and maps it to Z; rotate back so it stays Y.
      let m = cs.revolve(96, Math.min(Math.max(f.angle, 1), 360)).rotate([-90, 0, 0]);
      if (f.axis === 'X') m = m.rotate([0, 0, 90]);
      return { m: onPlane(m, sk), op: f.op };
    }
    case 'box':
      return { m: Manifold.cube([f.w, f.d, f.h]).translate([f.x, f.y, f.z]), op: f.op };
    case 'cylinder':
      return { m: Manifold.cylinder(f.h, f.r, f.r, 96).rotate(AXIS_ROT[f.axis]).translate([f.x, f.y, f.z]), op: f.op };
    case 'sphere':
      return { m: Manifold.sphere(f.r, 96).translate([f.x, f.y, f.z]), op: f.op };
    case 'hole':
      // drilled downward from (x,y,z) along -axis
      return { m: Manifold.cylinder(f.depth, f.d / 2, f.d / 2, 64).translate([0, 0, -f.depth]).rotate(AXIS_ROT[f.axis]).translate([f.x, f.y, f.z]), op: 'cut' };
    case 'rectPattern': case 'circPattern': case 'mirror': {
      const base = tools.get(f.ref);
      if (!base) throw new Error('Selecione uma feature de origem válida');
      const copies: any[] = [];
      if (f.type === 'rectPattern')
        for (let i = 0; i < Math.max(1, Math.round(f.nx)); i++)
          for (let j = 0; j < Math.max(1, Math.round(f.ny)); j++)
            if (i || j) copies.push(base.m.translate([i * f.dx, j * f.dy, 0]));
      if (f.type === 'circPattern') {
        const n = Math.max(2, Math.round(f.count));
        const step = f.angle >= 360 ? 360 / n : f.angle / (n - 1);
        for (let i = 1; i < n; i++) {
          const r: [number, number, number] = [0, 0, 0];
          r['XYZ'.indexOf(f.axis)] = i * step;
          copies.push(base.m.rotate(r));
        }
      }
      if (f.type === 'mirror') copies.push(base.m.mirror(PLANE_N[f.plane].map(Math.abs)));
      return { m: Manifold.union(copies), op: base.op };
    }
  }
}

function evaluate(part: Part, selected: string | null) {
  const { Manifold } = wasm;
  let body: any = null;
  const errors: Record<string, string> = {};
  const tools = new Map<string, { m: any; op: string }>();
  let selTool: any = null;
  for (const f of part.features) {
    if (f.suppressed) continue;
    try {
      const t = tool(f, part, tools);
      if (t.m.isEmpty()) throw new Error('Geometria vazia');
      tools.set(f.id, t);
      if (f.id === selected) selTool = t.m;
      if (!body) body = t.op === 'join' ? t.m : null;
      else if (t.op === 'join') body = Manifold.union(body, t.m);
      else if (t.op === 'cut') body = Manifold.difference(body, t.m);
      else body = Manifold.intersection(body, t.m);
      if (!body && t.op !== 'join') throw new Error('A primeira feature precisa ser "Unir"');
    } catch (e: any) {
      errors[f.id] = String(e?.message ?? e);
    }
  }

  content.clear();
  for (const sk of part.sketches) {
    for (const loop of sk.loops) {
      const g = new THREE.BufferGeometry().setFromPoints(loop.map((p) => new THREE.Vector3(p.x, p.y, 0)));
      const line = new THREE.LineLoop(g, sketchMat);
      const [rx, ry, rz] = PLANE_ROT[sk.plane].map((a) => (a * Math.PI) / 180);
      line.rotation.set(rx, ry, rz, 'XYZ');
      const n = PLANE_N[sk.plane];
      line.position.set(n[0] * sk.offset, n[1] * sk.offset, n[2] * sk.offset);
      line.visible = !body; // sketches only shown before the first solid exists
      content.add(line);
    }
  }
  const toThree = (m: any) => {
    const mesh = m.getMesh();
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(mesh.numVert * 3);
    for (let i = 0; i < mesh.numVert; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = mesh.vertProperties[i * mesh.numProp + k];
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
    g.computeVertexNormals();
    return { g, pos, idx: mesh.triVerts as Uint32Array };
  };
  let res: FromEngine = { type: 'result', volume: 0, area: 0, bbox: null, tris: 0, errors };
  lastMesh = null;
  if (body && !body.isEmpty()) {
    const { g, pos, idx } = toThree(body);
    // flat shading reads better for machined parts
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    content.add(new THREE.Mesh(flat, bodyMat), new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), edgeMat));
    lastMesh = { pos, idx };
    const b = body.boundingBox();
    res = { ...res, volume: body.volume(), area: body.surfaceArea(), tris: idx.length / 3,
      bbox: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] };
  }
  if (selTool) content.add(new THREE.Mesh(toThree(selTool).g, toolMat));
  post(res);
}

function setView(name: string) {
  const box = new THREE.Box3().setFromObject(content);
  const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const r = box.isEmpty() ? 60 : Math.max(box.getSize(new THREE.Vector3()).length(), 10);
  const dirs: Record<string, [number, number, number]> = { iso: [1, -1, 0.8], top: [0, -0.001, 1], front: [0, -1, 0], right: [1, 0, 0] };
  const d = new THREE.Vector3(...(dirs[name] ?? camera.position.clone().sub(controls.target).toArray())).normalize();
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(d, r * 1.6);
  camera.lookAt(c);
}

function stl(): FromEngine {
  if (!lastMesh) return { type: 'stl', base64: '', tris: 0 };
  const { pos, idx } = lastMesh;
  const n = idx.length / 3;
  const buf = new DataView(new ArrayBuffer(84 + n * 50));
  buf.setUint32(80, n, true);
  const v = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [v(idx[t * 3]), v(idx[t * 3 + 1]), v(idx[t * 3 + 2])];
    const nn = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    let o = 84 + t * 50;
    for (const p of [nn, a, b, c]) for (const k of [p.x, p.y, p.z]) { buf.setFloat32(o, k, true); o += 4; }
  }
  const bytes = new Uint8Array(buf.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: 'stl', base64: btoa(s), tris: n };
}

function onMessage(raw: any) {
  let m: ToEngine;
  try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  if (!wasm || !m?.type) return;
  if (m.type === 'model') {
    const first = !lastPart;
    lastPart = m.part;
    evaluate(m.part, m.selected);
    if (first) setView('iso');
  } else if (m.type === 'view') setView(m.name);
  else if (m.type === 'stl') post(stl());
}
window.addEventListener('message', (e) => onMessage(e.data));
document.addEventListener('message', (e: any) => onMessage(e.data)); // Android WebView
(window as any).cadEngine = { send: onMessage };

const bin = Uint8Array.from(atob(WASM_BASE64), (c) => c.charCodeAt(0));
Module({ wasmBinary: bin.buffer } as any).then((w: any) => {
  w.setup();
  wasm = w;
  post({ type: 'ready' });
}).catch((e: any) => post({ type: 'log', msg: 'Falha ao iniciar motor 3D: ' + e }));
