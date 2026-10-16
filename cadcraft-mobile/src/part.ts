// Parametric part model shared by the React Native UI and the 3D engine (web3d/engine.ts).
// A part is an ordered feature tree, re-evaluated from scratch on every change (like Inventor's browser).

import { Drawing, Pt, visible } from './cad';

export type Plane = 'XY' | 'XZ' | 'YZ';
export type BoolOp = 'join' | 'cut' | 'intersect';

// A sketch is a snapshot of closed 2D profiles placed on a work plane.
export type Sketch = { id: string; name: string; plane: Plane; offset: number; loops: Pt[][] };

type Base = { id: string; name: string; suppressed?: boolean };
export type Feature = Base & (
  | { type: 'extrude'; sketch: string; distance: number; direction: 'normal' | 'reversed' | 'symmetric'; op: BoolOp }
  | { type: 'revolve'; sketch: string; angle: number; axis: 'X' | 'Y'; op: BoolOp }
  | { type: 'box'; w: number; d: number; h: number; x: number; y: number; z: number; op: BoolOp }
  | { type: 'cylinder'; r: number; h: number; x: number; y: number; z: number; axis: 'X' | 'Y' | 'Z'; op: BoolOp }
  | { type: 'sphere'; r: number; x: number; y: number; z: number; op: BoolOp }
  | { type: 'hole'; d: number; depth: number; x: number; y: number; z: number; axis: 'X' | 'Y' | 'Z' }
  | { type: 'rectPattern'; ref: string; nx: number; dx: number; ny: number; dy: number }
  | { type: 'circPattern'; ref: string; count: number; angle: number; axis: 'X' | 'Y' | 'Z' }
  | { type: 'mirror'; ref: string; plane: Plane }
);

export type FeatureType = Feature['type'];
export type Part = { sketches: Sketch[]; features: Feature[] };

export const emptyPart = (): Part => ({ sketches: [], features: [] });

export const FEATURE_LABEL: Record<FeatureType, string> = {
  extrude: 'Extrusão', revolve: 'Revolução', box: 'Caixa', cylinder: 'Cilindro', sphere: 'Esfera',
  hole: 'Furo', rectPattern: 'Padrão retangular', circPattern: 'Padrão circular', mirror: 'Espelhar',
};

// Editable numeric/choice parameters per feature type, used to build the property panel.
export type Param = { key: string; label: string; kind: 'num' } | { key: string; label: string; kind: 'choice'; options: string[] };
const OP: Param = { key: 'op', label: 'Operação', kind: 'choice', options: ['join', 'cut', 'intersect'] };
const XYZ: Param[] = ['x', 'y', 'z'].map((k) => ({ key: k, label: k.toUpperCase(), kind: 'num' as const }));
const AXIS: Param = { key: 'axis', label: 'Eixo', kind: 'choice', options: ['X', 'Y', 'Z'] };

export const PARAMS: Record<FeatureType, Param[]> = {
  extrude: [{ key: 'distance', label: 'Distância', kind: 'num' }, { key: 'direction', label: 'Direção', kind: 'choice', options: ['normal', 'reversed', 'symmetric'] }, OP],
  revolve: [{ key: 'angle', label: 'Ângulo (°)', kind: 'num' }, { key: 'axis', label: 'Eixo do esboço', kind: 'choice', options: ['Y', 'X'] }, OP],
  box: [{ key: 'w', label: 'Largura', kind: 'num' }, { key: 'd', label: 'Profundidade', kind: 'num' }, { key: 'h', label: 'Altura', kind: 'num' }, ...XYZ, OP],
  cylinder: [{ key: 'r', label: 'Raio', kind: 'num' }, { key: 'h', label: 'Altura', kind: 'num' }, ...XYZ, AXIS, OP],
  sphere: [{ key: 'r', label: 'Raio', kind: 'num' }, ...XYZ, OP],
  hole: [{ key: 'd', label: 'Diâmetro', kind: 'num' }, { key: 'depth', label: 'Profundidade', kind: 'num' }, ...XYZ, AXIS],
  rectPattern: [{ key: 'nx', label: 'Qtd X', kind: 'num' }, { key: 'dx', label: 'Espaç. X', kind: 'num' }, { key: 'ny', label: 'Qtd Y', kind: 'num' }, { key: 'dy', label: 'Espaç. Y', kind: 'num' }],
  circPattern: [{ key: 'count', label: 'Quantidade', kind: 'num' }, { key: 'angle', label: 'Ângulo total (°)', kind: 'num' }, AXIS],
  mirror: [{ key: 'plane', label: 'Plano', kind: 'choice', options: ['YZ', 'XZ', 'XY'] }],
};

export const CHOICE_LABEL: Record<string, string> = {
  join: 'Unir', cut: 'Cortar', intersect: 'Interseção', normal: 'Normal', reversed: 'Invertida', symmetric: 'Simétrica',
};

// Converts the closed shapes of a 2D drawing into sketch loops (circles are tessellated).
export function loopsFromDrawing(d: Drawing): Pt[][] {
  const loops: Pt[][] = [];
  for (const e of visible(d)) {
    if (e.type === 'pline' && e.closed && e.pts.length > 2) loops.push(e.pts);
    if (e.type === 'circle') {
      const n = 64;
      loops.push(Array.from({ length: n }, (_, i) => ({
        x: e.c.x + e.r * Math.cos((2 * Math.PI * i) / n),
        y: e.c.y + e.r * Math.sin((2 * Math.PI * i) / n),
      })));
    }
  }
  return loops;
}

export function defaults(type: FeatureType, part: Part, id: string, n: number): Feature {
  const name = `${FEATURE_LABEL[type]}${n}`;
  const sketch = part.sketches[part.sketches.length - 1]?.id ?? '';
  const ref = [...part.features].reverse().find((f) => !['rectPattern', 'circPattern', 'mirror'].includes(f.type))?.id ?? '';
  const b = { id, name };
  switch (type) {
    case 'extrude': return { ...b, type, sketch, distance: 10, direction: 'normal', op: 'join' };
    case 'revolve': return { ...b, type, sketch, angle: 360, axis: 'Y', op: 'join' };
    case 'box': return { ...b, type, w: 40, d: 30, h: 10, x: 0, y: 0, z: 0, op: 'join' };
    case 'cylinder': return { ...b, type, r: 10, h: 20, x: 0, y: 0, z: 0, axis: 'Z', op: 'join' };
    case 'sphere': return { ...b, type, r: 10, x: 0, y: 0, z: 0, op: 'join' };
    case 'hole': return { ...b, type, d: 6, depth: 10, x: 10, y: 10, z: 10, axis: 'Z' };
    case 'rectPattern': return { ...b, type, ref, nx: 3, dx: 15, ny: 1, dy: 15 };
    case 'circPattern': return { ...b, type, ref, count: 6, angle: 360, axis: 'Z' };
    case 'mirror': return { ...b, type, ref, plane: 'YZ' };
  }
}

// Messages exchanged with the WebView engine.
export type ToEngine =
  | { type: 'model'; part: Part; selected: string | null }
  | { type: 'view'; name: 'iso' | 'top' | 'front' | 'right' | 'fit' }
  | { type: 'stl' };

export type FromEngine =
  | { type: 'ready' }
  | { type: 'result'; volume: number; area: number; bbox: [number, number, number] | null; tris: number; errors: Record<string, string> }
  | { type: 'stl'; base64: string; tris: number }
  | { type: 'log'; msg: string };
