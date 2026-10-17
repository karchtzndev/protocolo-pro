// 2D CAD editor: AutoCAD-style drawing (command line, snaps, layers) plus Inventor-style
// sketch constraints and driving dimensions. Used for the free 2D drawing and for part sketches.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Constraint, Drawing, Entity, Handle, Pt, Seg, Snap, arcEnd, arcFrom3, arcMid, arcStart, arcSweep, constraintRefs,
  dist, extents, findSnap, handlePt, hitHandle, hitTest, isDimension, measure, parsePoint, segPts, solve, toDXF,
  translate, uid, visible,
} from './cad';
import { Btn, C, Sheet, Toggle, mono } from './ui';

type Tool = 'select' | 'line' | 'pline' | 'rect' | 'circle' | 'arc' | 'move' | 'erase' | 'dist' | 'text' | 'dim' | 'constrain';
type CType = 'horizontal' | 'vertical' | 'coincident' | 'parallel' | 'perpendicular' | 'equal' | 'tangent' | 'concentric' | 'fix';

const TOOLS: { id: Tool; label: string; alias: string[] }[] = [
  { id: 'select', label: 'Selec.', alias: ['SEL'] },
  { id: 'line', label: 'Linha', alias: ['L', 'LINE'] },
  { id: 'pline', label: 'PLinha', alias: ['PL', 'PLINE'] },
  { id: 'rect', label: 'Retâng.', alias: ['REC', 'RECTANG'] },
  { id: 'circle', label: 'Círculo', alias: ['C', 'CIRCLE'] },
  { id: 'arc', label: 'Arco', alias: ['A', 'ARC'] },
  { id: 'dim', label: 'Cota', alias: ['D', 'DIM', 'COTA'] },
  { id: 'constrain', label: 'Restrição', alias: ['R', 'REST'] },
  { id: 'move', label: 'Mover', alias: ['M', 'MOVE'] },
  { id: 'erase', label: 'Apagar', alias: ['E', 'ERASE'] },
  { id: 'dist', label: 'Medir', alias: ['DI', 'DIST'] },
  { id: 'text', label: 'Texto', alias: ['T', 'TEXT'] },
];

const CTYPES: { id: CType; label: string; glyph: string }[] = [
  { id: 'horizontal', label: 'Horizontal', glyph: 'H' }, { id: 'vertical', label: 'Vertical', glyph: 'V' },
  { id: 'coincident', label: 'Coincidente', glyph: '●' }, { id: 'parallel', label: 'Paralela', glyph: '∥' },
  { id: 'perpendicular', label: 'Perpendicular', glyph: '⊥' }, { id: 'equal', label: 'Igual', glyph: '=' },
  { id: 'tangent', label: 'Tangente', glyph: 'T' }, { id: 'concentric', label: 'Concêntrica', glyph: '◎' },
  { id: 'fix', label: 'Fixar', glyph: '⚓' },
];

const PROMPTS: Record<Tool, (n: number) => string> = {
  select: () => 'Toque para selecionar · arraste para mover a vista',
  line: (n) => (n ? 'Próximo ponto ou [Enter] para terminar' : 'Primeiro ponto'),
  pline: (n) => (n ? 'Próximo ponto, [C] fechar ou [Enter] terminar' : 'Ponto inicial'),
  rect: (n) => (n ? 'Canto oposto' : 'Primeiro canto'),
  circle: (n) => (n ? 'Raio (número ou ponto)' : 'Centro'),
  arc: (n) => ['Ponto inicial', 'Ponto no arco', 'Ponto final'][n] ?? '',
  move: (n) => (n ? 'Ponto de destino' : 'Ponto base (selecione objetos antes)'),
  erase: () => 'Toque em um objeto para apagar',
  dist: (n) => (n ? 'Segundo ponto' : 'Primeiro ponto'),
  text: (n) => (n ? 'Digite o texto e [Enter]' : 'Ponto de inserção'),
  dim: () => 'Toque numa linha, círculo/arco, dois pontos ou duas linhas (ângulo)',
  constrain: () => 'Escolha o tipo e toque nos elementos',
};

const SNAP_PX = 18;

type Pick = { kind: 'handle'; h: Handle } | { kind: 'seg'; l: Seg } | { kind: 'curve'; e: string };

export default function Editor2D({ drawing, onChange, title, onDone, onExport }: {
  drawing: Drawing; onChange: (d: Drawing) => void; title?: string; onDone?: () => void; onExport?: boolean;
}) {
  const dwg = drawing;
  const setDwg = (fn: (d: Drawing) => Drawing) => onChange(fn(dwgRef.current));
  const dwgRef = useRef(dwg);
  dwgRef.current = dwg;

  const [undo, setUndo] = useState<Drawing[]>([]);
  const [redo, setRedo] = useState<Drawing[]>([]);
  const [tool, setTool] = useState<Tool>('line');
  const [ctype, setCtype] = useState<CType>('horizontal');
  const [pts, setPts] = useState<Pt[]>([]);
  const [ptSnaps, setPtSnaps] = useState<(Handle | undefined)[]>([]);
  const [chainFrom, setChainFrom] = useState<Handle | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pendingDim, setPendingDim] = useState<Constraint | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ x: -20, y: 60, z: 8 }); // world coord at screen top-left, px per unit
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [osnap, setOsnap] = useState(true);
  const [gridOn, setGridOn] = useState(true);
  const [ortho, setOrtho] = useState(false);
  const [showCons, setShowCons] = useState(true);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState<string[]>(['Digite L, PL, REC, C, A, D (cota), R (restrição), M, E, DI, T, U, Z']);
  const [layersOpen, setLayersOpen] = useState(false);
  const [consOpen, setConsOpen] = useState(false);
  const cmdRef = useRef<any>(null);

  const msg = (s: string) => setLog((l) => [...l.slice(-2), s]);
  const cons = dwg.constraints ?? [];
  const dof = useMemo(() => solve({ ...dwg, constraints: cons }).dof, [dwg]);

  useEffect(() => { zoomExtents(); }, [size.w > 1]);

  const gridStep = useMemo(() => {
    const target = 30 / view.z;
    const p = 10 ** Math.floor(Math.log10(target));
    return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= target) ?? p * 10;
  }, [view.z]);

  const toScreen = (p: Pt) => ({ x: (p.x - view.x) * view.z, y: (view.y - p.y) * view.z });
  const toWorld = (sx: number, sy: number): Pt => ({ x: view.x + sx / view.z, y: view.y - sy / view.z });
  const ent = (id: string) => dwg.entities.find((e) => e.id === id);

  // --- model mutations ---
  const commit = (d: Drawing) => {
    setUndo((u) => [...u.slice(-99), dwgRef.current]);
    setRedo([]);
    onChange(d);
  };

  // Adds constraints and re-solves; rejects them when the sketch becomes inconsistent.
  const constrain = (d: Drawing, add: Constraint[], quiet = false): Drawing | null => {
    const r = solve({ ...d, constraints: [...(d.constraints ?? []), ...add] });
    if (!r.ok) {
      if (!quiet) msg('⚠ Restrição conflitante ou superdefinida — não aplicada');
      return null;
    }
    return r.drawing;
  };

  const addEntities = (es: Entity[], extra: Constraint[] = []) => {
    const d = { ...dwgRef.current, entities: [...dwgRef.current.entities, ...es] };
    commit(constrain(d, extra, true) ?? d);
  };

  const doUndo = () => {
    if (!undo.length) return msg('Nada para desfazer');
    setRedo((r) => [...r, dwgRef.current]);
    onChange(undo[undo.length - 1]);
    setUndo((u) => u.slice(0, -1));
  };
  const doRedo = () => {
    if (!redo.length) return;
    setUndo((u) => [...u, dwgRef.current]);
    onChange(redo[redo.length - 1]);
    setRedo((r) => r.slice(0, -1));
  };

  const zoomExtents = () => {
    const ext = extents(dwg);
    if (!ext || size.w < 2) return setView({ x: -20, y: 60, z: 8 });
    const w = Math.max(ext.max.x - ext.min.x, 1), h = Math.max(ext.max.y - ext.min.y, 1);
    const z = Math.min(size.w / w, size.h / h) * 0.8;
    setView({ x: (ext.min.x + ext.max.x) / 2 - size.w / 2 / z, y: (ext.min.y + ext.max.y) / 2 + size.h / 2 / z, z });
  };

  const reset = () => { setPts([]); setPtSnaps([]); setChainFrom(null); setPicks([]); setPendingDim(null); };

  const switchTool = (t: Tool) => {
    finish();
    setTool(t);
    if (t !== 'move' && t !== 'select') setSelected(new Set());
  };

  const finish = (close = false) => {
    if (tool === 'pline' && pts.length > 1) {
      const id = uid();
      const e: Entity = { id, layer: dwg.current, type: 'pline', pts, closed: close && pts.length > 2 };
      addEntities([e], ptSnaps.flatMap((h, i) => (h ? [{ id: uid(), type: 'coincident' as const, h: [{ e: id, p: i }, h] as [Handle, Handle] }] : [])));
    }
    reset();
  };

  // --- point entry, shared by touch and command line ---
  const applyOrtho = (p: Pt) => {
    const last = pts[pts.length - 1];
    if (!ortho || !last) return p;
    return Math.abs(p.x - last.x) > Math.abs(p.y - last.y) ? { x: p.x, y: last.y } : { x: last.x, y: p.y };
  };

  const resolve = (sx: number, sy: number): { p: Pt; s: Snap | null } => {
    const raw = toWorld(sx, sy);
    const s = findSnap(raw, dwg, SNAP_PX / view.z, { osnap, grid: gridOn ? gridStep : null });
    return { p: applyOrtho(s ? s.p : raw), s };
  };

  const fmtN = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const coin = (a: Handle, b?: Handle | null): Constraint[] => (b && b.e !== a.e ? [{ id: uid(), type: 'coincident', h: [a, b] }] : []);

  const point = (p: Pt, h?: Handle) => {
    const n = pts.length;
    const L = dwg.current;
    switch (tool) {
      case 'line': {
        if (!n) { setPts([p]); setPtSnaps([h]); return; }
        const id = uid();
        const extra = [...coin({ e: id, p: 0 }, chainFrom ?? ptSnaps[n - 1]), ...coin({ e: id, p: 1 }, h)];
        // nearly horizontal / vertical lines get the matching constraint, like Inventor
        const a = pts[n - 1];
        if (Math.abs(p.y - a.y) < 1e-9 && Math.abs(p.x - a.x) > 1e-9) extra.push({ id: uid(), type: 'horizontal', l: { e: id, s: 0 } });
        else if (Math.abs(p.x - a.x) < 1e-9 && Math.abs(p.y - a.y) > 1e-9) extra.push({ id: uid(), type: 'vertical', l: { e: id, s: 0 } });
        addEntities([{ id, layer: L, type: 'line', a, b: p }], extra);
        setPts([...pts, p]);
        setPtSnaps([...ptSnaps, h]);
        setChainFrom({ e: id, p: 1 });
        break;
      }
      case 'pline':
        setPts([...pts, p]); setPtSnaps([...ptSnaps, h]);
        break;
      case 'rect': {
        if (!n) { setPts([p]); setPtSnaps([h]); return; }
        const id = uid();
        const q = pts[0];
        if (Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.y - q.y) < 1e-9) return msg('Retângulo com largura ou altura zero');
        addEntities([{ id, layer: L, type: 'pline', closed: true, pts: [q, { x: p.x, y: q.y }, p, { x: q.x, y: p.y }] }], [
          { id: uid(), type: 'horizontal', l: { e: id, s: 0 } }, { id: uid(), type: 'vertical', l: { e: id, s: 1 } },
          { id: uid(), type: 'horizontal', l: { e: id, s: 2 } }, { id: uid(), type: 'vertical', l: { e: id, s: 3 } },
          ...coin({ e: id, p: 0 }, ptSnaps[0]), ...coin({ e: id, p: 2 }, h),
        ]);
        reset();
        break;
      }
      case 'circle': {
        if (!n) { setPts([p]); setPtSnaps([h]); return; }
        const id = uid();
        addEntities([{ id, layer: L, type: 'circle', c: pts[0], r: dist(pts[0], p) }], coin({ e: id, p: 0 }, ptSnaps[0]));
        reset();
        break;
      }
      case 'arc': {
        if (n < 2) { setPts([...pts, p]); setPtSnaps([...ptSnaps, h]); return; }
        const a = arcFrom3(pts[0], pts[1], p);
        if (!a) return msg('Pontos alinhados — escolha outro ponto final');
        const id = uid();
        const startIsFirst = dist(arcStart(a), pts[0]) < dist(arcEnd(a), pts[0]);
        const [h1, h2] = startIsFirst ? [ptSnaps[0], h] : [h, ptSnaps[0]];
        addEntities([{ id, layer: L, type: 'arc', ...a }], [...coin({ e: id, p: 1 }, h1), ...coin({ e: id, p: 2 }, h2)]);
        reset();
        break;
      }
      case 'dist': {
        if (!n) return setPts([p]);
        const dx = p.x - pts[0].x, dy = p.y - pts[0].y;
        msg(`Distância = ${fmtN(Math.hypot(dx, dy))}  ΔX = ${fmtN(dx)}  ΔY = ${fmtN(dy)}  Ângulo = ${fmtN((Math.atan2(dy, dx) * 180) / Math.PI)}°`);
        setPts([]);
        break;
      }
      case 'move': {
        if (!selected.size) return msg('Selecione objetos primeiro (ferramenta Selec.)');
        if (!n) return setPts([p]);
        const dx = p.x - pts[0].x, dy = p.y - pts[0].y;
        const moved = { ...dwg, entities: dwg.entities.map((e) => (selected.has(e.id) ? translate(e, dx, dy) : e)) };
        const r = solve(moved);
        commit(r.ok ? r.drawing : moved);
        if (!r.ok) msg('⚠ Movido, mas restrições não puderam ser mantidas');
        setPts([]);
        break;
      }
      case 'text':
        setPts([p]);
        cmdRef.current?.focus();
        break;
    }
  };

  // --- dimension & constraint picking ---
  const pickAt = (w: Pt): Pick | null => {
    const tol = SNAP_PX / view.z;
    const h = hitHandle(w, dwg, tol * 0.8);
    if (h) {
      const e = ent(h.e)!;
      // centres of circles/arcs act as the curve itself for curve constraints
      if ((e.type === 'circle' || e.type === 'arc') && h.p === 0 && tool === 'constrain' && ['tangent', 'concentric', 'equal'].includes(ctype)) return { kind: 'curve', e: e.id };
      return { kind: 'handle', h };
    }
    const hit = hitTest(w, dwg, tol);
    if (!hit) return null;
    if (hit.e.type === 'line' || hit.e.type === 'pline') return { kind: 'seg', l: { e: hit.e.id, s: hit.s } };
    if (hit.e.type === 'circle' || hit.e.type === 'arc') return { kind: 'curve', e: hit.e.id };
    return null;
  };

  const askDim = (c: Constraint) => {
    const v = measure(c, dwg);
    setPendingDim({ ...(c as any), value: Math.abs(v) });
    setCmd(fmtN(Math.abs(v)));
    msg(`Valor da cota (atual ${fmtN(Math.abs(v))}) e [Enter]`);
    setTimeout(() => cmdRef.current?.focus(), 50);
  };

  const dimPick = (pk: Pick) => {
    const prev = picks[0];
    // tapping an entity that already has a dimension edits it
    const existing = cons.find((c) => isDimension(c) && (
      (pk.kind === 'seg' && c.type === 'length' && c.l.e === pk.l.e && c.l.s === pk.l.s) ||
      (pk.kind === 'curve' && (c.type === 'radius' || c.type === 'diameter') && c.c === pk.e)));
    if (!prev && existing) {
      setPendingDim(existing); setCmd(String((existing as any).value)); msg('Novo valor da cota e [Enter]');
      return setTimeout(() => cmdRef.current?.focus(), 50);
    }
    if (pk.kind === 'curve') { setPicks([]); return askDim({ id: uid(), type: ent(pk.e)?.type === 'arc' ? 'radius' : 'diameter', c: pk.e, value: 0 }); }
    if (!prev) {
      setPicks([pk]);
      if (pk.kind === 'seg') {
        msg('Toque outra linha para ângulo, ou [Enter] para comprimento');
        setPendingDim({ id: uid(), type: 'length', l: pk.l, value: 0 });
      } else msg('Toque o segundo ponto');
      return;
    }
    setPicks([]);
    if (prev.kind === 'seg' && pk.kind === 'seg') return askDim({ id: uid(), type: 'angle', l: [prev.l, pk.l], value: 0 });
    if (prev.kind === 'handle' && pk.kind === 'handle') return askDim({ id: uid(), type: 'distance', h: [prev.h, pk.h], value: 0 });
    msg('Combinação não suportada para cota');
    setPendingDim(null);
  };

  const consPick = (pk: Pick) => {
    const all = [...picks, pk];
    const need = ['horizontal', 'vertical', 'fix'].includes(ctype) ? 1 : 2;
    const ok = (k: Pick['kind'][]) => all.every((p, i) => p.kind === k[i]);
    let c: Constraint | null = null;
    if (ctype === 'horizontal' || ctype === 'vertical') {
      if (pk.kind === 'seg') c = { id: uid(), type: ctype, l: pk.l };
    } else if (ctype === 'fix') {
      if (pk.kind === 'handle') c = { id: uid(), type: 'fix', h: pk.h, at: handlePt(ent(pk.h.e)!, pk.h.p) };
      else if (pk.kind === 'curve') c = { id: uid(), type: 'fix', h: { e: pk.e, p: 0 }, at: handlePt(ent(pk.e)!, 0) };
    } else if (all.length < need) {
      setPicks(all);
      return msg('Toque o segundo elemento');
    } else if (ctype === 'coincident' && ok(['handle', 'handle'])) c = { id: uid(), type: 'coincident', h: [(all[0] as any).h, (all[1] as any).h] };
    else if ((ctype === 'parallel' || ctype === 'perpendicular' || ctype === 'equal') && ok(['seg', 'seg'])) c = { id: uid(), type: ctype, l: [(all[0] as any).l, (all[1] as any).l] };
    else if (ctype === 'equal' && ok(['curve', 'curve'])) c = { id: uid(), type: 'equalRadius', c: [(all[0] as any).e, (all[1] as any).e] };
    else if (ctype === 'concentric' && ok(['curve', 'curve'])) c = { id: uid(), type: 'concentric', c: [(all[0] as any).e, (all[1] as any).e] };
    else if (ctype === 'tangent' && (ok(['seg', 'curve']) || ok(['curve', 'seg']))) {
      const s = all.find((p) => p.kind === 'seg') as any, k = all.find((p) => p.kind === 'curve') as any;
      c = { id: uid(), type: 'tangent', l: s.l, c: k.e };
    }
    setPicks([]);
    if (!c) return msg('Elementos inválidos para esta restrição');
    const d = constrain(dwg, [c]);
    if (d) { commit(d); msg(`Restrição aplicada: ${CTYPES.find((x) => x.id === ctype)!.label}`); }
  };

  const tap = (sx: number, sy: number) => {
    const tol = SNAP_PX / view.z;
    const w = toWorld(sx, sy);
    if (tool === 'select') {
      const hit = hitTest(w, dwg, tol);
      setSelected((s) => {
        if (!hit) return new Set();
        const n = new Set(s);
        n.has(hit.e.id) ? n.delete(hit.e.id) : n.add(hit.e.id);
        return n;
      });
      return;
    }
    if (tool === 'erase') {
      const hit = hitTest(w, dwg, tol);
      if (hit) commit({ ...dwg, entities: dwg.entities.filter((x) => x.id !== hit.e.id), constraints: cons.filter((c) => !constraintRefs(c).includes(hit.e.id)) });
      return;
    }
    if (tool === 'dim' || tool === 'constrain') {
      const pk = pickAt(w);
      if (!pk) return;
      return tool === 'dim' ? dimPick(pk) : consPick(pk);
    }
    const r = resolve(sx, sy);
    point(r.p, r.s?.h);
  };

  // --- gestures: 1 finger = aim/place (or pan in select), 2 fingers = pan + pinch zoom ---
  const g = useRef({ mode: 'none' as 'none' | 'aim' | 'pan' | 'pinch', sx: 0, sy: 0, moved: false, d0: 0, v0: view, c0: { x: 0, y: 0 } });
  const handlers = useRef<any>({});
  handlers.current = { tap, resolve, setCursor, setSnap, setView, view, tool };
  const aimTools: Tool[] = ['line', 'pline', 'rect', 'circle', 'arc', 'move', 'dist', 'text'];

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const h = handlers.current;
      const aim = aimTools.includes(h.tool);
      g.current = { ...g.current, mode: aim ? 'aim' : 'pan', sx: x, sy: y, moved: false, v0: h.view };
      if (aim) { const r = h.resolve(x, y); h.setCursor(r.p); h.setSnap(r.s); }
    },
    onPanResponderMove: (e, gs) => {
      const h = handlers.current;
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        const [a, b] = [t[0], t[1]];
        const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        const c = { x: (a.locationX + b.locationX) / 2, y: (a.locationY + b.locationY) / 2 };
        if (g.current.mode !== 'pinch') {
          g.current = { ...g.current, mode: 'pinch', d0: d, v0: h.view, c0: c, moved: true };
          h.setCursor(null);
          return;
        }
        const v0 = g.current.v0;
        const z = Math.min(5000, Math.max(0.005, v0.z * (d / g.current.d0)));
        const wx = v0.x + g.current.c0.x / v0.z, wy = v0.y - g.current.c0.y / v0.z;
        h.setView({ x: wx - c.x / z, y: wy + c.y / z, z });
        return;
      }
      if (g.current.mode === 'pinch') return;
      if (Math.hypot(gs.dx, gs.dy) > 6) g.current.moved = true;
      if (g.current.mode === 'pan') {
        const v0 = g.current.v0;
        h.setView({ ...v0, x: v0.x - gs.dx / v0.z, y: v0.y + gs.dy / v0.z });
      } else {
        const r = h.resolve(g.current.sx + gs.dx, g.current.sy + gs.dy);
        h.setCursor(r.p); h.setSnap(r.s);
      }
    },
    onPanResponderRelease: (_e, gs) => {
      const h = handlers.current;
      const { mode, moved, sx, sy } = g.current;
      if (mode === 'aim' || (mode === 'pan' && !moved)) h.tap(sx + gs.dx, sy + gs.dy);
      g.current.mode = 'none';
      h.setSnap(null);
    },
    onPanResponderTerminate: () => { g.current.mode = 'none'; },
  }), []);

  // --- command line ---
  const runCommand = () => {
    const raw = cmd.trim();
    setCmd('');
    const up = raw.toUpperCase();
    if (pendingDim) {
      const v = raw ? parseFloat(raw.replace(',', '.')) : (pendingDim as any).value;
      if (!Number.isFinite(v) || v <= 0) return msg('Valor inválido');
      const others = cons.filter((c) => c.id !== pendingDim.id);
      const d = constrain({ ...dwg, constraints: others }, [{ ...(pendingDim as any), value: v }]);
      if (d) { commit(d); msg('Cota aplicada'); }
      setPendingDim(null); setPicks([]);
      return;
    }
    if (!raw) {
      finish();
      if (tool === 'line' || tool === 'pline') msg('Comando finalizado');
      return;
    }
    if (tool === 'text' && pts.length) {
      addEntities([{ id: uid(), layer: dwg.current, type: 'text', p: pts[0], h: Math.max(gridStep, 1), text: raw }]);
      return setPts([]);
    }
    const t = TOOLS.find((x) => x.alias.includes(up));
    if (t) { switchTool(t.id); return msg(`Comando: ${t.label}`); }
    if (up === 'U' || up === 'UNDO') return doUndo();
    if (up === 'REDO') return doRedo();
    if (up === 'Z' || up === 'ZE') return zoomExtents();
    if (up === 'C' && tool === 'pline') return finish(true);
    if (tool === 'circle' && pts.length === 1 && /^[\d.,]+$/.test(raw)) {
      const id = uid();
      addEntities([{ id, layer: dwg.current, type: 'circle', c: pts[0], r: parseFloat(raw.replace(',', '.')) }], coin({ e: id, p: 0 }, ptSnaps[0]));
      return reset();
    }
    const last = pts[pts.length - 1] ?? null;
    const dir = cursor && last ? { x: cursor.x - last.x, y: cursor.y - last.y } : null;
    const p = parsePoint(raw, last, dir);
    if (p) return point(p);
    msg(`Comando desconhecido: ${raw}`);
  };

  const exportDXF = async () => {
    try {
      const f = new File(Paths.cache, `desenho-${Date.now()}.dxf`);
      await f.write(toDXF(dwg));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/dxf', dialogTitle: 'Exportar DXF' });
      else msg(`Salvo em ${f.uri}`);
    } catch (err) {
      Alert.alert('Erro ao exportar', String(err));
    }
  };

  const clearAll = () =>
    Alert.alert('Limpar', 'Apagar todo o desenho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { commit({ ...dwg, entities: [], constraints: [] }); reset(); setSelected(new Set()); } },
    ]);

  const toggleConstruction = () => {
    if (!selected.size) return msg('Selecione objetos primeiro');
    commit({ ...dwg, entities: dwg.entities.map((e) => (selected.has(e.id) ? { ...e, construction: !e.construction } : e)) });
  };

  // --- render ---
  const colorOf = (e: Entity) => (e.construction ? '#64748b' : dwg.layers.find((l) => l.name === e.layer)?.color ?? '#fff');
  const gridLines = useMemo(() => {
    if (!gridOn) return null;
    const out = [];
    const x0 = Math.floor(view.x / gridStep) * gridStep;
    const y0 = view.y - size.h / view.z;
    for (let x = x0; x <= view.x + size.w / view.z; x += gridStep) {
      const sx = (x - view.x) * view.z;
      out.push(<Line key={`x${x}`} x1={sx} x2={sx} y1={0} y2={size.h} stroke={Math.abs(x) < 1e-9 ? '#3b82f6' : '#1f2937'} strokeWidth={1} />);
    }
    for (let y = Math.floor(y0 / gridStep) * gridStep; y <= view.y; y += gridStep) {
      const sy = (view.y - y) * view.z;
      out.push(<Line key={`y${y}`} y1={sy} y2={sy} x1={0} x2={size.w} stroke={Math.abs(y) < 1e-9 ? '#ef4444' : '#1f2937'} strokeWidth={1} />);
    }
    return out;
  }, [gridOn, gridStep, view, size]);

  const renderEntity = (e: Entity, color: string, w = 1.5, key = e.id) => {
    const dash = e.construction ? '6 4' : undefined;
    switch (e.type) {
      case 'line': {
        const a = toScreen(e.a), b = toScreen(e.b);
        return <Line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} strokeDasharray={dash} />;
      }
      case 'pline': {
        const ps = (e.closed ? [...e.pts, e.pts[0]] : e.pts).map(toScreen).map((q) => `${q.x},${q.y}`).join(' ');
        return <Polyline key={key} points={ps} stroke={color} strokeWidth={w} fill="none" strokeDasharray={dash} />;
      }
      case 'circle': {
        const c = toScreen(e.c);
        return <Circle key={key} cx={c.x} cy={c.y} r={e.r * view.z} stroke={color} strokeWidth={w} fill="none" strokeDasharray={dash} />;
      }
      case 'arc': {
        const a = toScreen(arcStart(e)), b = toScreen(arcEnd(e));
        const r = e.r * view.z;
        const large = arcSweep(e) > Math.PI ? 1 : 0;
        // screen Y is flipped: a CCW world arc is clockwise on screen, which is SVG sweep-flag 1
        return <Path key={key} d={`M${a.x},${a.y} A${r},${r} 0 ${large} 1 ${b.x},${b.y}`} stroke={color} strokeWidth={w} fill="none" strokeDasharray={dash} />;
      }
      case 'text': {
        const p = toScreen(e.p);
        return <SvgText key={key} x={p.x} y={p.y} fill={color} fontSize={e.h * view.z}>{e.text}</SvgText>;
      }
    }
  };

  // dimension & constraint annotations
  const annotations = useMemo(() => {
    if (!showCons) return null;
    const out: React.ReactElement[] = [];
    const segOf = (l: Seg) => { const e = ent(l.e); return e && segPts(e, l.s); };
    const glyphAt = (p: Pt, s: string, key: string, color = C.warn) => {
      const q = toScreen(p);
      out.push(<SvgText key={key} x={q.x + 4} y={q.y - 4} fill={color} fontSize={11} fontWeight="bold">{s}</SvgText>);
    };
    const dimText = (p: Pt, s: string, key: string) => {
      const q = toScreen(p);
      out.push(<G key={key}><Rect x={q.x - s.length * 3.6 - 3} y={q.y - 9} width={s.length * 7.2 + 6} height={16} fill="#0b1120" opacity={0.85} rx={3} /><SvgText x={q.x} y={q.y + 3} fill="#38bdf8" fontSize={12} textAnchor="middle">{s}</SvgText></G>);
    };
    const off = 14 / view.z;
    for (const c of cons) {
      const v = (c as any).value as number;
      switch (c.type) {
        case 'length': case 'distance': {
          const s = c.type === 'length' ? segOf(c.l) : c.h.map((h) => handlePt(ent(h.e)!, h.p));
          if (!s || s.some((p) => !p)) break;
          const [a, b] = s as [Pt, Pt];
          const len = dist(a, b) || 1;
          const n = { x: -(b.y - a.y) / len * off, y: (b.x - a.x) / len * off };
          const A = toScreen({ x: a.x + n.x, y: a.y + n.y }), B = toScreen({ x: b.x + n.x, y: b.y + n.y });
          out.push(<Line key={c.id} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#38bdf8" strokeWidth={1} />);
          dimText({ x: (a.x + b.x) / 2 + n.x, y: (a.y + b.y) / 2 + n.y }, fmtN(v), c.id + 't');
          break;
        }
        case 'radius': case 'diameter': {
          const e = ent(c.c);
          if (!e || (e.type !== 'circle' && e.type !== 'arc')) break;
          const p = e.type === 'arc' ? arcMid(e) : { x: e.c.x + e.r * Math.SQRT1_2, y: e.c.y + e.r * Math.SQRT1_2 };
          const A = toScreen(e.c), B = toScreen(p);
          out.push(<Line key={c.id} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#38bdf8" strokeWidth={1} />);
          dimText(p, (c.type === 'radius' ? 'R' : 'Ø') + fmtN(v), c.id + 't');
          break;
        }
        case 'angle': {
          const s = segOf(c.l[0]);
          if (s) dimText({ x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 - off }, fmtN(v) + '°', c.id);
          break;
        }
        case 'horizontal': case 'vertical': case 'parallel': case 'perpendicular': case 'equal': case 'tangent': {
          const l = 'l' in c ? (Array.isArray(c.l) ? c.l : [c.l]) : [];
          const glyph = CTYPES.find((t) => t.id === c.type)?.glyph ?? '';
          l.forEach((x, i) => { const s = segOf(x); if (s) glyphAt({ x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 }, glyph, c.id + i); });
          break;
        }
        case 'equalRadius': case 'concentric':
          c.c.forEach((id, i) => { const e = ent(id); if (e && 'c' in e) glyphAt(e.c, c.type === 'concentric' ? '◎' : '=', c.id + i); });
          break;
        case 'coincident': {
          const e = ent(c.h[0].e);
          if (e) { const q = toScreen(handlePt(e, c.h[0].p)); out.push(<Circle key={c.id} cx={q.x} cy={q.y} r={3} fill={C.warn} />); }
          break;
        }
        case 'fix': glyphAt(c.at, '⚓', c.id, '#f87171'); break;
      }
    }
    return out;
  }, [cons, dwg, view, showCons]);

  const preview = (() => {
    if (!cursor || !pts.length) return null;
    const a = pts[pts.length - 1];
    const c = C.accent;
    const pv = (e: any) => renderEntity({ id: 'pv', layer: '', ...e }, c, 1);
    switch (tool) {
      case 'line': case 'dist': case 'move': return pv({ type: 'line', a, b: cursor });
      case 'pline': return pv({ type: 'pline', pts: [...pts, cursor], closed: false });
      case 'rect': return pv({ type: 'pline', closed: true, pts: [a, { x: cursor.x, y: a.y }, cursor, { x: a.x, y: cursor.y }] });
      case 'circle': return pv({ type: 'circle', c: a, r: dist(a, cursor) });
      case 'arc': {
        if (pts.length === 1) return pv({ type: 'line', a, b: cursor });
        const arc = arcFrom3(pts[0], pts[1], cursor);
        return arc ? pv({ type: 'arc', ...arc }) : null;
      }
    }
    return null;
  })();

  const cur = cursor && aimTools.includes(tool) && toScreen(cursor);
  const snapMarker = snap && snap.kind !== 'grid' && toScreen(snap.p);
  const pickedIds = new Set(picks.map((p) => (p.kind === 'handle' ? p.h.e : p.kind === 'seg' ? p.l.e : p.e)));
  const dimCount = cons.filter(isDimension).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.topbar}>
        {title && <Text style={s.title} numberOfLines={1}>{title}</Text>}
        <Btn small label="↶" onPress={doUndo} />
        <Btn small label="↷" onPress={doRedo} />
        <Btn small label="Zoom" onPress={zoomExtents} />
        <Btn small label="Camadas" onPress={() => setLayersOpen(true)} />
        <Btn small label={`Restrições (${cons.length})`} onPress={() => setConsOpen(true)} />
        {onExport && <Btn small label="DXF ⇪" onPress={exportDXF} />}
        <Btn small label="Limpar" onPress={clearAll} />
        {onDone && <Btn small on label="✓ Concluir esboço" onPress={() => { finish(); onDone(); }} />}
      </View>

      <View style={s.canvas} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
        <Svg width={size.w} height={size.h} pointerEvents="none">
          <Rect width={size.w} height={size.h} fill={C.canvas} />
          <G>{gridLines}</G>
          {visible(dwg).map((e) => renderEntity(e, selected.has(e.id) || pickedIds.has(e.id) ? C.accent : colorOf(e), selected.has(e.id) || pickedIds.has(e.id) ? 3 : 1.5))}
          {annotations}
          {preview}
          {cur && (
            <G>
              <Line x1={cur.x - 2000} x2={cur.x + 2000} y1={cur.y} y2={cur.y} stroke="#9ca3af" strokeWidth={0.5} />
              <Line y1={cur.y - 2000} y2={cur.y + 2000} x1={cur.x} x2={cur.x} stroke="#9ca3af" strokeWidth={0.5} />
            </G>
          )}
          {snapMarker && (
            <G>
              <Rect x={snapMarker.x - 7} y={snapMarker.y - 7} width={14} height={14} stroke={C.warn} strokeWidth={2} fill="none" />
              <SvgText x={snapMarker.x + 10} y={snapMarker.y - 10} fill={C.warn} fontSize={11}>{snap!.kind.toUpperCase()}</SvgText>
            </G>
          )}
        </Svg>
        {cursor && aimTools.includes(tool) && (
          <Text style={s.coords}>
            X {fmtN(cursor.x)}  Y {fmtN(cursor.y)}
            {pts.length ? `   L ${fmtN(dist(pts[pts.length - 1], cursor))}` : ''}
          </Text>
        )}
        <Text style={[s.dof, { color: dof === 0 ? C.ok : C.dim }]}>
          {dof === 0 ? 'Totalmente restrito' : `${dof} grau(s) de liberdade`} · {dimCount} cota(s)
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {tool === 'constrain' && (
          <ScrollView horizontal style={s.sub} contentContainerStyle={{ gap: 6, paddingHorizontal: 8 }} keyboardShouldPersistTaps="handled">
            {CTYPES.map((t) => <Btn key={t.id} small on={ctype === t.id} label={`${t.glyph} ${t.label}`} onPress={() => { setCtype(t.id); setPicks([]); }} />)}
          </ScrollView>
        )}
        {tool === 'select' && selected.size > 0 && (
          <View style={[s.sub, { flexDirection: 'row', gap: 6, paddingHorizontal: 8 }]}>
            <Btn small label="Construção ⇄" onPress={toggleConstruction} />
            <Btn small label="Mover" onPress={() => setTool('move')} />
            <Btn small danger label="Apagar" onPress={() => {
              commit({ ...dwg, entities: dwg.entities.filter((e) => !selected.has(e.id)), constraints: cons.filter((c) => !constraintRefs(c).some((id) => selected.has(id))) });
              setSelected(new Set());
            }} />
          </View>
        )}
        <View style={s.status}>
          <Toggle label="OSNAP" on={osnap} onPress={() => setOsnap(!osnap)} />
          <Toggle label="GRADE" on={gridOn} onPress={() => setGridOn(!gridOn)} />
          <Toggle label="ORTHO" on={ortho} onPress={() => setOrtho(!ortho)} />
          <Toggle label="COTAS" on={showCons} onPress={() => setShowCons(!showCons)} />
          <Text style={s.layerTag}>Camada: {dwg.current}</Text>
        </View>
        <View style={s.log}>
          {log.map((l, i) => <Text key={i} style={s.logLine} numberOfLines={1}>{l}</Text>)}
          <Text style={s.prompt}>{TOOLS.find((t) => t.id === tool)!.label}: {pendingDim ? 'Digite o valor e [Enter]' : PROMPTS[tool](pts.length)}</Text>
        </View>
        <View style={s.cmdRow}>
          <Text style={s.cmdCaret}>›</Text>
          <TextInput
            ref={cmdRef}
            style={s.cmd} value={cmd} onChangeText={setCmd} onSubmitEditing={runCommand}
            placeholder="Comando, coordenada (10,20 @5,0 @10<45) ou valor" placeholderTextColor="#6b7280"
            autoCapitalize="characters" autoCorrect={false} blurOnSubmit={false} returnKeyType="send"
          />
          <Btn label="↵" onPress={runCommand} />
          <Btn label="Esc" onPress={() => { reset(); setSelected(new Set()); setCursor(null); setCmd(''); }} />
        </View>
        <ScrollView horizontal style={s.tools} contentContainerStyle={{ paddingHorizontal: 8 }} keyboardShouldPersistTaps="handled">
          {TOOLS.map((t) => (
            <Pressable key={t.id} onPress={() => switchTool(t.id)} style={[s.tool, tool === t.id && s.toolOn]}>
              <Text style={[s.toolText, tool === t.id && { color: C.canvas }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet open={layersOpen} title="Camadas" onClose={() => setLayersOpen(false)}>
        {dwg.layers.map((l) => (
          <View key={l.name} style={s.layerRow}>
            <View style={[s.swatch, { backgroundColor: l.color }]} />
            <Pressable style={{ flex: 1 }} onPress={() => setDwg((d) => ({ ...d, current: l.name }))}>
              <Text style={[s.layerName, dwg.current === l.name && { color: C.accent }]}>{dwg.current === l.name ? '● ' : ''}{l.name}</Text>
            </Pressable>
            <Btn small label={l.visible ? 'Visível' : 'Oculta'} onPress={() => setDwg((d) => ({ ...d, layers: d.layers.map((x) => (x.name === l.name ? { ...x, visible: !x.visible } : x)) }))} />
          </View>
        ))}
        {selected.size > 0 && (
          <Btn label={`Mover ${selected.size} objeto(s) para "${dwg.current}"`} onPress={() => commit({ ...dwg, entities: dwg.entities.map((e) => (selected.has(e.id) ? { ...e, layer: dwg.current } : e)) })} />
        )}
      </Sheet>

      <Sheet open={consOpen} title={`Restrições e cotas (${cons.length})`} onClose={() => setConsOpen(false)}>
        {!cons.length && <Text style={{ color: C.dim }}>Nenhuma. Use as ferramentas Cota e Restrição.</Text>}
        {cons.map((c) => (
          <View key={c.id} style={s.layerRow}>
            <Text style={[s.layerName, { flex: 1 }]}>
              {isDimension(c) ? `Cota ${c.type === 'angle' ? 'angular' : c.type === 'radius' ? 'raio' : c.type === 'diameter' ? 'diâmetro' : 'linear'}: ${(c as any).value}` : CTYPES.find((t) => t.id === c.type)?.label ?? (c.type === 'equalRadius' ? 'Raios iguais' : c.type)}
            </Text>
            {isDimension(c) && <Btn small label="Editar" onPress={() => { setConsOpen(false); setTool('dim'); setPendingDim(c); setCmd(String((c as any).value)); setTimeout(() => cmdRef.current?.focus(), 300); }} />}
            <Btn small danger label="✕" onPress={() => commit({ ...dwg, constraints: cons.filter((x) => x.id !== c.id) })} />
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 6, flexWrap: 'wrap' },
  title: { color: C.warn, fontWeight: '700', marginRight: 4, maxWidth: 140 },
  canvas: { flex: 1, overflow: 'hidden' },
  coords: { position: 'absolute', left: 8, top: 8, color: '#d1d5db', fontFamily: mono, fontSize: 12, backgroundColor: '#0b1120cc', padding: 4, borderRadius: 4 },
  dof: { position: 'absolute', right: 8, bottom: 6, fontSize: 11, fontFamily: mono, backgroundColor: '#0b1120cc', padding: 3, borderRadius: 4 },
  sub: { flexGrow: 0, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.panel },
  status: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingTop: 6, alignItems: 'center' },
  layerTag: { color: C.dim, fontSize: 12, marginLeft: 'auto' },
  log: { paddingHorizontal: 10, paddingTop: 4 },
  logLine: { color: C.dim, fontSize: 11, fontFamily: mono },
  prompt: { color: C.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  cmdCaret: { color: C.accent, fontSize: 18, fontWeight: '700' },
  cmd: { flex: 1, color: C.text, backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  tools: { flexGrow: 0, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.panel },
  tool: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: C.panel, marginRight: 6 },
  toolOn: { backgroundColor: C.accent },
  toolText: { color: '#e5e7eb', fontWeight: '600' },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 16, height: 16, borderRadius: 3 },
  layerName: { color: '#e5e7eb', fontSize: 15 },
});
