// Document model shared by the React Native UI and the 3D engine (web3d/engine.ts):
// parametric parts (sketches + ordered feature tree), assemblies and engine messages.

import { Drawing, Profile, emptyDrawing } from './cad';

export type Plane = 'XY' | 'XZ' | 'YZ';
export type BoolOp = 'join' | 'cut' | 'intersect';
export type V3 = [number, number, number];

// A sketch owns its own constrained 2D drawing, edited in the 2D editor (like Inventor).
export type Sketch = { id: string; name: string; plane: Plane; offset: number; drawing: Drawing };

// Edges for fillet/chamfer: a rule, or points picked on the model (re-found by position on rebuild).
export type EdgeSel = { mode: 'all' | 'picked' | 'top' | 'bottom' | 'vertical' | 'circular'; points: V3[] };

type Base = { id: string; name: string; suppressed?: boolean };
export type Feature = Base & (
  | { type: 'extrude'; sketch: string; distance: number; direction: 'normal' | 'reversed' | 'symmetric'; op: BoolOp }
  | { type: 'revolve'; sketch: string; angle: number; axis: 'X' | 'Y'; op: BoolOp }
  | { type: 'loft'; sketches: string[]; ruled: 'não' | 'sim'; op: BoolOp }
  | { type: 'box'; w: number; d: number; h: number; x: number; y: number; z: number; op: BoolOp }
  | { type: 'cylinder'; r: number; h: number; x: number; y: number; z: number; axis: 'X' | 'Y' | 'Z'; op: BoolOp }
  | { type: 'cone'; r1: number; r2: number; h: number; x: number; y: number; z: number; axis: 'X' | 'Y' | 'Z'; op: BoolOp }
  | { type: 'sphere'; r: number; x: number; y: number; z: number; op: BoolOp }
  | { type: 'hole'; d: number; depth: number; cbd: number; cbdepth: number; x: number; y: number; z: number; axis: 'X' | 'Y' | 'Z' }
  | { type: 'fillet'; radius: number; edges: EdgeSel }
  | { type: 'chamfer'; distance: number; edges: EdgeSel }
  | { type: 'shell'; thickness: number; faces: V3[] }
  | { type: 'rectPattern'; ref: string; nx: number; dx: number; ny: number; dy: number }
  | { type: 'circPattern'; ref: string; count: number; angle: number; axis: 'X' | 'Y' | 'Z' }
  | { type: 'mirror'; ref: string; plane: Plane }
  | { type: 'import'; file: string; fileName: string; op: BoolOp }
);

export type FeatureType = Feature['type'];

export type Material = { name: string; density: number }; // g/cm³
export const MATERIALS: Material[] = [
  { name: 'Aço', density: 7.85 }, { name: 'Aço inox', density: 8.0 }, { name: 'Alumínio', density: 2.7 },
  { name: 'Latão', density: 8.5 }, { name: 'Cobre', density: 8.96 }, { name: 'Ferro fundido', density: 7.2 },
  { name: 'Titânio', density: 4.51 }, { name: 'ABS', density: 1.04 }, { name: 'PLA', density: 1.24 },
  { name: 'Nylon', density: 1.15 }, { name: 'Madeira', density: 0.6 },
];

export type PartDoc = { id: string; name: string; material: Material; color: string; sketches: Sketch[]; features: Feature[] };

export const emptyPart = (id: string, name: string): PartDoc =>
  ({ id, name, material: MATERIALS[2], color: '#94a3b8', sketches: [], features: [] });

// --- assemblies ---
// A geometric reference picked on a component, stored in the component's local frame.
export type Ref = { comp: string; kind: 'face' | 'edge'; point: V3; normal: V3; axis?: { p: V3; d: V3 } };
export type Mate = { id: string; type: 'mate' | 'flush' | 'axis' | 'point'; a: Ref; b: Ref; offset: number; suppressed?: boolean };
export type Component = { id: string; part: string; name: string; pos: V3; rot: V3; grounded: boolean; visible: boolean };
export type AssemblyDoc = { id: string; name: string; components: Component[]; mates: Mate[] };

export const emptyAssembly = (id: string, name: string): AssemblyDoc => ({ id, name, components: [], mates: [] });

export const MATE_LABEL: Record<Mate['type'], string> = {
  mate: 'Face com face (oposta)', flush: 'Faces niveladas', axis: 'Eixos coincidentes', point: 'Ponto com ponto',
};

// --- feature UI metadata ---
export const FEATURE_LABEL: Record<FeatureType, string> = {
  extrude: 'Extrusão', revolve: 'Revolução', loft: 'Loft', box: 'Caixa', cylinder: 'Cilindro', cone: 'Cone',
  sphere: 'Esfera', hole: 'Furo', fillet: 'Filete', chamfer: 'Chanfro', shell: 'Casca',
  rectPattern: 'Padrão retangular', circPattern: 'Padrão circular', mirror: 'Espelhar', import: 'STEP importado',
};

export type Param = { key: string; label: string; kind: 'num' } | { key: string; label: string; kind: 'choice'; options: string[] };
const OP: Param = { key: 'op', label: 'Operação', kind: 'choice', options: ['join', 'cut', 'intersect'] };
const XYZ: Param[] = ['x', 'y', 'z'].map((k) => ({ key: k, label: k.toUpperCase(), kind: 'num' as const }));
const AXIS: Param = { key: 'axis', label: 'Eixo', kind: 'choice', options: ['X', 'Y', 'Z'] };
const num = (key: string, label: string): Param => ({ key, label, kind: 'num' });

export const PARAMS: Record<FeatureType, Param[]> = {
  extrude: [num('distance', 'Distância'), { key: 'direction', label: 'Direção', kind: 'choice', options: ['normal', 'reversed', 'symmetric'] }, OP],
  revolve: [num('angle', 'Ângulo (°)'), { key: 'axis', label: 'Eixo do esboço', kind: 'choice', options: ['Y', 'X'] }, OP],
  loft: [{ key: 'ruled', label: 'Faces retas', kind: 'choice', options: ['não', 'sim'] }, OP],
  box: [num('w', 'Largura (X)'), num('d', 'Profund. (Y)'), num('h', 'Altura (Z)'), ...XYZ, OP],
  cylinder: [num('r', 'Raio'), num('h', 'Altura'), ...XYZ, AXIS, OP],
  cone: [num('r1', 'Raio base'), num('r2', 'Raio topo'), num('h', 'Altura'), ...XYZ, AXIS, OP],
  sphere: [num('r', 'Raio'), ...XYZ, OP],
  hole: [num('d', 'Diâmetro'), num('depth', 'Profundidade'), num('cbd', 'Ø rebaixo (0=não)'), num('cbdepth', 'Prof. rebaixo'), ...XYZ, AXIS],
  fillet: [num('radius', 'Raio')],
  chamfer: [num('distance', 'Distância')],
  shell: [num('thickness', 'Espessura')],
  rectPattern: [num('nx', 'Qtd X'), num('dx', 'Espaç. X'), num('ny', 'Qtd Y'), num('dy', 'Espaç. Y')],
  circPattern: [num('count', 'Quantidade'), num('angle', 'Ângulo total (°)'), AXIS],
  mirror: [{ key: 'plane', label: 'Plano', kind: 'choice', options: ['YZ', 'XZ', 'XY'] }],
  import: [OP],
};

export const CHOICE_LABEL: Record<string, string> = {
  join: 'Unir', cut: 'Cortar', intersect: 'Interseção', normal: 'Normal', reversed: 'Invertida', symmetric: 'Simétrica',
  all: 'Todas', picked: 'Selecionadas', top: 'Topo', bottom: 'Base', vertical: 'Verticais', circular: 'Circulares',
};

export const EDGE_MODES: EdgeSel['mode'][] = ['picked', 'all', 'top', 'bottom', 'vertical', 'circular'];

export const newSketch = (id: string, n: number, plane: Plane = 'XY', offset = 0): Sketch =>
  ({ id, name: `Esboço${n}`, plane, offset, drawing: emptyDrawing() });

export function defaults(type: FeatureType, part: PartDoc, id: string): Feature {
  const n = part.features.filter((f) => f.type === type).length + 1;
  const name = `${FEATURE_LABEL[type]}${n}`;
  const sketch = part.sketches[part.sketches.length - 1]?.id ?? '';
  const ref = [...part.features].reverse().find((f) => !['rectPattern', 'circPattern', 'mirror', 'fillet', 'chamfer', 'shell'].includes(f.type))?.id ?? '';
  const b = { id, name };
  switch (type) {
    case 'extrude': return { ...b, type, sketch, distance: 10, direction: 'normal', op: 'join' };
    case 'revolve': return { ...b, type, sketch, angle: 360, axis: 'Y', op: 'join' };
    case 'loft': return { ...b, type, sketches: part.sketches.slice(-2).map((s) => s.id), ruled: 'não', op: 'join' };
    case 'box': return { ...b, type, w: 40, d: 30, h: 10, x: 0, y: 0, z: 0, op: 'join' };
    case 'cylinder': return { ...b, type, r: 10, h: 20, x: 0, y: 0, z: 0, axis: 'Z', op: 'join' };
    case 'cone': return { ...b, type, r1: 10, r2: 4, h: 20, x: 0, y: 0, z: 0, axis: 'Z', op: 'join' };
    case 'sphere': return { ...b, type, r: 10, x: 0, y: 0, z: 0, op: 'join' };
    case 'hole': return { ...b, type, d: 6, depth: 10, cbd: 0, cbdepth: 3, x: 10, y: 10, z: 10, axis: 'Z' };
    case 'fillet': return { ...b, type, radius: 2, edges: { mode: 'picked', points: [] } };
    case 'chamfer': return { ...b, type, distance: 1, edges: { mode: 'picked', points: [] } };
    case 'shell': return { ...b, type, thickness: 2, faces: [] };
    case 'rectPattern': return { ...b, type, ref, nx: 3, dx: 15, ny: 1, dy: 15 };
    case 'circPattern': return { ...b, type, ref, count: 6, angle: 360, axis: 'Z' };
    case 'mirror': return { ...b, type, ref, plane: 'YZ' };
    case 'import': return { ...b, type, file: '', fileName: '', op: 'join' };
  }
}

// Part sent to the engine: sketches reduced to their closed profiles.
export type EngineSketch = { id: string; plane: Plane; offset: number; profiles: Profile[] };
export type EnginePart = { id: string; color: string; sketches: EngineSketch[]; features: Feature[] };

export type View = 'iso' | 'top' | 'front' | 'right' | 'fit';
export type ProjView = 'front' | 'top' | 'left' | 'right' | 'iso';
export type Polyline = [number, number][];
export type Projection = { view: ProjView; visible: Polyline[]; hidden: Polyline[]; min: [number, number]; max: [number, number] };

export type ToEngine =
  | { type: 'file'; id: string; base64: string }
  | { type: 'part'; part: EnginePart; selected: string | null; rollback: string | null; pick: 'edge' | 'face' | null; highlight: V3[] }
  | { type: 'assembly'; asm: AssemblyDoc; parts: EnginePart[]; selected: string | null; pick: boolean; highlight: Ref[] }
  | { type: 'view'; name: View }
  | { type: 'export'; req: number; format: 'stl' | 'step'; scope: 'part' | 'assembly' }
  | { type: 'project'; req: number; scope: 'part' | 'assembly'; views: ProjView[] }
  | { type: 'measure'; req: number; parts: EnginePart[] };

export type FromEngine =
  | { type: 'ready' }
  | { type: 'log'; msg: string }
  | { type: 'needFile'; id: string }
  | { type: 'partResult'; volume: number; area: number; bbox: V3 | null; errors: Record<string, string> }
  | { type: 'asmResult'; bbox: V3 | null; errors: Record<string, string>; interferences: { a: string; b: string; volume: number }[] }
  | { type: 'pick'; ref: Omit<Ref, 'comp'> & { comp?: string } }
  | { type: 'export'; req: number; base64?: string; error?: string }
  | { type: 'project'; req: number; views?: Projection[]; error?: string }
  | { type: 'measure'; req: number; volumes: Record<string, number> };
