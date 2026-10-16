import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Drawing, Entity, Pt, Snap, dist, emptyDrawing, extents, findSnap, hitTest, parsePoint,
  toDXF, translate, uid, visible,
} from './src/cad';

type Tool = 'select' | 'line' | 'pline' | 'rect' | 'circle' | 'move' | 'erase' | 'dist' | 'text';

const TOOLS: { id: Tool; label: string; alias: string[] }[] = [
  { id: 'select', label: 'Selec.', alias: ['SEL', 'ESC'] },
  { id: 'line', label: 'Linha', alias: ['L', 'LINE'] },
  { id: 'pline', label: 'PLinha', alias: ['PL', 'PLINE'] },
  { id: 'rect', label: 'Retâng.', alias: ['REC', 'RECTANG'] },
  { id: 'circle', label: 'Círculo', alias: ['C', 'CIRCLE'] },
  { id: 'move', label: 'Mover', alias: ['M', 'MOVE'] },
  { id: 'erase', label: 'Apagar', alias: ['E', 'ERASE'] },
  { id: 'dist', label: 'Medir', alias: ['DI', 'DIST'] },
  { id: 'text', label: 'Texto', alias: ['T', 'TEXT'] },
];

const PROMPTS: Record<Tool, (n: number) => string> = {
  select: () => 'Toque para selecionar · arraste para mover a vista',
  line: (n) => (n ? 'Próximo ponto ou [Enter] para terminar' : 'Primeiro ponto'),
  pline: (n) => (n ? 'Próximo ponto, [C] fechar ou [Enter] terminar' : 'Ponto inicial'),
  rect: (n) => (n ? 'Canto oposto' : 'Primeiro canto'),
  circle: (n) => (n ? 'Raio (número ou ponto)' : 'Centro'),
  move: (n) => (n ? 'Ponto de destino' : 'Ponto base (selecione objetos antes)'),
  erase: () => 'Toque em um objeto para apagar',
  dist: (n) => (n ? 'Segundo ponto' : 'Primeiro ponto'),
  text: (n) => (n ? 'Digite o texto e [Enter]' : 'Ponto de inserção'),
};

const STORAGE_KEY = 'cadcraft.drawing.v1';
const SNAP_PX = 18;

function Editor() {
  const [dwg, setDwg] = useState<Drawing>(emptyDrawing);
  const [undo, setUndo] = useState<Entity[][]>([]);
  const [redo, setRedo] = useState<Entity[][]>([]);
  const [tool, setTool] = useState<Tool>('line');
  const [pts, setPts] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ x: -20, y: 60, z: 8 }); // world coord at screen top-left, px per unit
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [osnap, setOsnap] = useState(true);
  const [gridOn, setGridOn] = useState(true);
  const [ortho, setOrtho] = useState(false);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState<string[]>(['CADCraft Mobile — digite L, PL, REC, C, M, E, DI, T, U, Z']);
  const [layersOpen, setLayersOpen] = useState(false);
  const loaded = useRef(false);

  const msg = (s: string) => setLog((l) => [...l.slice(-3), s]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) try { setDwg(JSON.parse(raw)); } catch {}
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dwg)).catch(() => {});
  }, [dwg]);

  const gridStep = useMemo(() => {
    const target = 30 / view.z; // ~30px
    const p = 10 ** Math.floor(Math.log10(target));
    return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= target) ?? p * 10;
  }, [view.z]);

  const toScreen = (p: Pt) => ({ x: (p.x - view.x) * view.z, y: (view.y - p.y) * view.z });
  const toWorld = (sx: number, sy: number): Pt => ({ x: view.x + sx / view.z, y: view.y - sy / view.z });

  // --- model mutations ---
  const commit = (entities: Entity[]) => {
    setUndo((u) => [...u.slice(-99), dwg.entities]);
    setRedo([]);
    setDwg((d) => ({ ...d, entities }));
  };
  const add = (...es: Omit<Entity, 'id' | 'layer'>[]) =>
    commit([...dwg.entities, ...es.map((e) => ({ ...e, id: uid(), layer: dwg.current }) as Entity)]);

  const doUndo = () => {
    if (!undo.length) return msg('Nada para desfazer');
    setRedo((r) => [...r, dwg.entities]);
    setDwg((d) => ({ ...d, entities: undo[undo.length - 1] }));
    setUndo((u) => u.slice(0, -1));
  };
  const doRedo = () => {
    if (!redo.length) return;
    setUndo((u) => [...u, dwg.entities]);
    setDwg((d) => ({ ...d, entities: redo[redo.length - 1] }));
    setRedo((r) => r.slice(0, -1));
  };

  const zoomExtents = () => {
    const ext = extents(dwg);
    if (!ext) return setView({ x: -20, y: 60, z: 8 });
    const w = Math.max(ext.max.x - ext.min.x, 1), h = Math.max(ext.max.y - ext.min.y, 1);
    const z = Math.min(size.w / w, size.h / h) * 0.85;
    setView({ x: (ext.min.x + ext.max.x) / 2 - size.w / 2 / z, y: (ext.min.y + ext.max.y) / 2 + size.h / 2 / z, z });
  };

  const switchTool = (t: Tool) => {
    finish();
    setTool(t);
    if (t !== 'move' && t !== 'select') setSelected(new Set());
  };

  // Ends the running command (Enter / Esc semantics).
  const finish = (close = false) => {
    if (tool === 'pline' && pts.length > 1) add({ type: 'pline', pts, closed: close && pts.length > 2 } as any);
    setPts([]);
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

  const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

  const point = (p: Pt) => {
    const n = pts.length;
    switch (tool) {
      case 'line':
        if (n) add({ type: 'line', a: pts[n - 1], b: p } as any);
        setPts([...pts, p]);
        break;
      case 'pline':
        setPts([...pts, p]);
        break;
      case 'rect':
        if (!n) return setPts([p]);
        add({ type: 'pline', closed: true, pts: [pts[0], { x: p.x, y: pts[0].y }, p, { x: pts[0].x, y: p.y }] } as any);
        setPts([]);
        break;
      case 'circle':
        if (!n) return setPts([p]);
        add({ type: 'circle', c: pts[0], r: dist(pts[0], p) } as any);
        setPts([]);
        break;
      case 'dist':
        if (!n) return setPts([p]);
        {
          const dx = p.x - pts[0].x, dy = p.y - pts[0].y;
          msg(`Distância = ${fmt(Math.hypot(dx, dy))}  ΔX = ${fmt(dx)}  ΔY = ${fmt(dy)}  Ângulo = ${fmt((Math.atan2(dy, dx) * 180) / Math.PI)}°`);
        }
        setPts([]);
        break;
      case 'move':
        if (!selected.size) return msg('Selecione objetos primeiro (ferramenta Selec.)');
        if (!n) return setPts([p]);
        {
          const dx = p.x - pts[0].x, dy = p.y - pts[0].y;
          commit(dwg.entities.map((e) => (selected.has(e.id) ? translate(e, dx, dy) : e)));
        }
        setPts([]);
        break;
      case 'text':
        setPts([p]);
        break;
    }
  };

  const tap = (sx: number, sy: number) => {
    const tol = SNAP_PX / view.z;
    if (tool === 'select') {
      const e = hitTest(toWorld(sx, sy), dwg, tol);
      setSelected((s) => {
        if (!e) return new Set();
        const n = new Set(s);
        n.has(e.id) ? n.delete(e.id) : n.add(e.id);
        return n;
      });
      return;
    }
    if (tool === 'erase') {
      const e = hitTest(toWorld(sx, sy), dwg, tol);
      if (e) commit(dwg.entities.filter((x) => x.id !== e.id));
      return;
    }
    point(resolve(sx, sy).p);
  };

  // --- gestures: 1 finger = aim/place (or pan in select), 2 fingers = pan + pinch zoom ---
  const g = useRef({ mode: 'none' as 'none' | 'aim' | 'pan' | 'pinch', sx: 0, sy: 0, moved: false, d0: 0, v0: view, c0: { x: 0, y: 0 } });
  const handlers = useRef<any>({});
  handlers.current = { tap, resolve, setCursor, setSnap, setView, view, tool };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          const h = handlers.current;
          g.current = { ...g.current, mode: h.tool === 'select' ? 'pan' : 'aim', sx: x, sy: y, moved: false, v0: h.view };
          if (h.tool !== 'select') {
            const r = h.resolve(x, y);
            h.setCursor(r.p); h.setSnap(r.s);
          }
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
            const z = Math.min(2000, Math.max(0.01, v0.z * (d / g.current.d0)));
            // keep the world point under the initial pinch centre under the current centre
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
      }),
    [],
  );

  // --- command line ---
  const runCommand = () => {
    const raw = cmd.trim();
    setCmd('');
    const up = raw.toUpperCase();
    if (!raw) {
      finish();
      if (tool === 'line' || tool === 'pline') msg('Comando finalizado');
      return;
    }
    if (tool === 'text' && pts.length) {
      add({ type: 'text', p: pts[0], h: Math.max(gridStep, 1), text: raw } as any);
      return setPts([]);
    }
    const t = TOOLS.find((x) => x.alias.includes(up));
    if (t) { switchTool(t.id); return msg(`Comando: ${t.label}`); }
    if (up === 'U' || up === 'UNDO') return doUndo();
    if (up === 'REDO') return doRedo();
    if (up === 'Z' || up === 'ZE') return zoomExtents();
    if (up === 'C' && tool === 'pline') { finish(true); return; }
    if (up === 'F8') { setOrtho((o) => !o); return; }
    if (tool === 'circle' && pts.length === 1 && /^[\d.]+$/.test(raw)) {
      add({ type: 'circle', c: pts[0], r: +raw } as any);
      return setPts([]);
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
      f.write(toDXF(dwg));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/dxf', dialogTitle: 'Exportar DXF' });
      else msg(`Salvo em ${f.uri}`);
    } catch (err) {
      Alert.alert('Erro ao exportar', String(err));
    }
  };

  const newDrawing = () =>
    Alert.alert('Novo desenho', 'Descartar o desenho atual?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { commit([]); setPts([]); setSelected(new Set()); } },
    ]);

  // --- render ---
  const colorOf = (layer: string) => dwg.layers.find((l) => l.name === layer)?.color ?? '#fff';
  const gridLines = useMemo(() => {
    if (!gridOn) return null;
    const out = [];
    const x0 = Math.floor(view.x / gridStep) * gridStep;
    const y1 = view.y, y0 = view.y - size.h / view.z;
    for (let x = x0; x <= view.x + size.w / view.z; x += gridStep) {
      const sx = (x - view.x) * view.z;
      out.push(<Line key={`x${x}`} x1={sx} x2={sx} y1={0} y2={size.h} stroke={Math.abs(x) < 1e-9 ? '#3b82f6' : '#1f2937'} strokeWidth={1} />);
    }
    for (let y = Math.floor(y0 / gridStep) * gridStep; y <= y1; y += gridStep) {
      const sy = (view.y - y) * view.z;
      out.push(<Line key={`y${y}`} y1={sy} y2={sy} x1={0} x2={size.w} stroke={Math.abs(y) < 1e-9 ? '#ef4444' : '#1f2937'} strokeWidth={1} />);
    }
    return out;
  }, [gridOn, gridStep, view, size]);

  const renderEntity = (e: Entity, color: string, w = 1.5) => {
    switch (e.type) {
      case 'line': {
        const a = toScreen(e.a), b = toScreen(e.b);
        return <Line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={w} />;
      }
      case 'pline': {
        const ps = (e.closed ? [...e.pts, e.pts[0]] : e.pts).map(toScreen).map((q) => `${q.x},${q.y}`).join(' ');
        return <Polyline key={e.id} points={ps} stroke={color} strokeWidth={w} fill="none" />;
      }
      case 'circle': {
        const c = toScreen(e.c);
        return <Circle key={e.id} cx={c.x} cy={c.y} r={e.r * view.z} stroke={color} strokeWidth={w} fill="none" />;
      }
      case 'text': {
        const p = toScreen(e.p);
        return <SvgText key={e.id} x={p.x} y={p.y} fill={color} fontSize={e.h * view.z}>{e.text}</SvgText>;
      }
    }
  };

  // rubber-band preview of the entity being drawn
  const preview = (() => {
    if (!cursor || !pts.length) return null;
    const a = pts[pts.length - 1];
    const c = '#22d3ee';
    switch (tool) {
      case 'line': case 'dist': case 'move':
        return renderEntity({ id: 'pv', layer: '', type: 'line', a, b: cursor }, c, 1);
      case 'pline':
        return renderEntity({ id: 'pv', layer: '', type: 'pline', pts: [...pts, cursor], closed: false }, c, 1);
      case 'rect':
        return renderEntity({ id: 'pv', layer: '', type: 'pline', closed: true, pts: [a, { x: cursor.x, y: a.y }, cursor, { x: a.x, y: cursor.y }] }, c, 1);
      case 'circle':
        return renderEntity({ id: 'pv', layer: '', type: 'circle', c: a, r: dist(a, cursor) }, c, 1);
    }
    return null;
  })();

  const cur = cursor && toScreen(cursor);
  const snapMarker = snap && snap.kind !== 'grid' && toScreen(snap.p);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.topbar}>
        <Text style={s.brand}>CADCraft</Text>
        <Btn label="↶" onPress={doUndo} />
        <Btn label="↷" onPress={doRedo} />
        <Btn label="Zoom" onPress={zoomExtents} />
        <Btn label="Camadas" onPress={() => setLayersOpen(true)} />
        <Btn label="DXF ⇪" onPress={exportDXF} />
        <Btn label="Novo" onPress={newDrawing} />
      </View>

      <View style={s.canvas} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
        <Svg width={size.w} height={size.h} pointerEvents="none">
          <Rect width={size.w} height={size.h} fill="#0b1120" />
          <G>{gridLines}</G>
          {visible(dwg).map((e) => renderEntity(e, selected.has(e.id) ? '#22d3ee' : colorOf(e.layer), selected.has(e.id) ? 3 : 1.5))}
          {preview}
          {cur && (
            <G>
              <Line x1={cur.x - 2000} x2={cur.x + 2000} y1={cur.y} y2={cur.y} stroke="#9ca3af" strokeWidth={0.5} />
              <Line y1={cur.y - 2000} y2={cur.y + 2000} x1={cur.x} x2={cur.x} stroke="#9ca3af" strokeWidth={0.5} />
            </G>
          )}
          {snapMarker && (
            <G>
              <Rect x={snapMarker.x - 7} y={snapMarker.y - 7} width={14} height={14} stroke="#facc15" strokeWidth={2} fill="none" />
              <SvgText x={snapMarker.x + 10} y={snapMarker.y - 10} fill="#facc15" fontSize={11}>{snap!.kind.toUpperCase()}</SvgText>
            </G>
          )}
        </Svg>
        {cursor && (
          <Text style={s.coords}>
            X {fmt(cursor.x)}  Y {fmt(cursor.y)}
            {pts.length ? `   L ${fmt(dist(pts[pts.length - 1], cursor))}` : ''}
          </Text>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.status}>
          <Toggle label="OSNAP" on={osnap} onPress={() => setOsnap(!osnap)} />
          <Toggle label="GRADE" on={gridOn} onPress={() => setGridOn(!gridOn)} />
          <Toggle label="ORTHO" on={ortho} onPress={() => setOrtho(!ortho)} />
          <Text style={s.layerTag}>Camada: {dwg.current}</Text>
        </View>
        <View style={s.log}>
          {log.map((l, i) => <Text key={i} style={s.logLine} numberOfLines={1}>{l}</Text>)}
          <Text style={s.prompt}>{TOOLS.find((t) => t.id === tool)!.label}: {PROMPTS[tool](pts.length)}</Text>
        </View>
        <View style={s.cmdRow}>
          <Text style={s.cmdCaret}>›</Text>
          <TextInput
            style={s.cmd} value={cmd} onChangeText={setCmd} onSubmitEditing={runCommand}
            placeholder="Comando ou coordenada (ex: 10,20  @5,0  @10<45)" placeholderTextColor="#6b7280"
            autoCapitalize="characters" autoCorrect={false} blurOnSubmit={false} returnKeyType="send"
          />
          <Btn label="↵" onPress={runCommand} />
          <Btn label="Esc" onPress={() => { setPts([]); setSelected(new Set()); setCursor(null); }} />
        </View>
        <ScrollView horizontal style={s.tools} contentContainerStyle={{ paddingHorizontal: 8 }} keyboardShouldPersistTaps="handled">
          {TOOLS.map((t) => (
            <Pressable key={t.id} onPress={() => switchTool(t.id)} style={[s.tool, tool === t.id && s.toolOn]}>
              <Text style={[s.toolText, tool === t.id && { color: '#0b1120' }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={layersOpen} transparent animationType="slide" onRequestClose={() => setLayersOpen(false)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Camadas</Text>
            {dwg.layers.map((l) => (
              <View key={l.name} style={s.layerRow}>
                <View style={[s.swatch, { backgroundColor: l.color }]} />
                <Pressable style={{ flex: 1 }} onPress={() => setDwg((d) => ({ ...d, current: l.name }))}>
                  <Text style={[s.layerName, dwg.current === l.name && { color: '#22d3ee' }]}>
                    {dwg.current === l.name ? '● ' : ''}{l.name}
                  </Text>
                </Pressable>
                <Btn
                  label={l.visible ? 'Visível' : 'Oculta'}
                  onPress={() => setDwg((d) => ({ ...d, layers: d.layers.map((x) => (x.name === l.name ? { ...x, visible: !x.visible } : x)) }))}
                />
              </View>
            ))}
            {selected.size > 0 && (
              <Btn
                label={`Mover ${selected.size} objeto(s) para "${dwg.current}"`}
                onPress={() => commit(dwg.entities.map((e) => (selected.has(e.id) ? { ...e, layer: dwg.current } : e)))}
              />
            )}
            <Btn label="Fechar" onPress={() => setLayersOpen(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.btn, pressed && { opacity: 0.6 }]}>
    <Text style={s.btnText}>{label}</Text>
  </Pressable>
);

const Toggle = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[s.toggle, on && s.toggleOn]}>
    <Text style={[s.toggleText, on && { color: '#0b1120' }]}>{label}</Text>
  </Pressable>
);

export default function App() {
  return (
    <SafeAreaProvider>
      <Editor />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, flexWrap: 'wrap' },
  brand: { color: '#f9fafb', fontWeight: '800', fontSize: 16, marginRight: 'auto' },
  canvas: { flex: 1, overflow: 'hidden' },
  coords: { position: 'absolute', left: 8, top: 8, color: '#d1d5db', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12, backgroundColor: '#0b1120cc', padding: 4, borderRadius: 4 },
  status: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingTop: 6, alignItems: 'center' },
  layerTag: { color: '#9ca3af', fontSize: 12, marginLeft: 'auto' },
  log: { paddingHorizontal: 10, paddingTop: 4 },
  logLine: { color: '#9ca3af', fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  prompt: { color: '#f9fafb', fontSize: 12, fontWeight: '600', marginTop: 2 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  cmdCaret: { color: '#22d3ee', fontSize: 18, fontWeight: '700' },
  cmd: { flex: 1, color: '#f9fafb', backgroundColor: '#1f2937', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  tools: { flexGrow: 0, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1f2937' },
  tool: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1f2937', marginRight: 6 },
  toolOn: { backgroundColor: '#22d3ee' },
  toolText: { color: '#e5e7eb', fontWeight: '600' },
  btn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: '#374151', marginVertical: 2 },
  btnText: { color: '#f9fafb', fontSize: 13, fontWeight: '600' },
  toggle: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#374151' },
  toggleOn: { backgroundColor: '#facc15', borderColor: '#facc15' },
  toggleText: { color: '#9ca3af', fontSize: 11, fontWeight: '700' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { backgroundColor: '#111827', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 6 },
  sheetTitle: { color: '#f9fafb', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 16, height: 16, borderRadius: 3 },
  layerName: { color: '#e5e7eb', fontSize: 15 },
});
