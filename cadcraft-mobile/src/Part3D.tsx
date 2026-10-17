// Part modeling screen: Inventor-style model browser (sketches + feature tree), property
// panel, picking edges/faces on the model, materials and STEP/STL exchange.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { uid } from './cad';
import { nextReq, toEnginePart, useEngine, Viewport } from './engine';
import {
  CHOICE_LABEL, EDGE_MODES, FEATURE_LABEL, Feature, FeatureType, FromEngine, MATERIALS, PARAMS, PartDoc, Plane, V3,
  defaults, emptyPart, newSketch,
} from './part';
import { updatePart, useWorkspace } from './store';
import { Btn, C, Choice, NumField, Sheet, TextField, fmt, u } from './ui';

const ADD: { group: string; types: FeatureType[] }[] = [
  { group: 'Esboço', types: ['extrude', 'revolve', 'loft'] },
  { group: 'Primitivas', types: ['box', 'cylinder', 'cone', 'sphere'] },
  { group: 'Modificar', types: ['hole', 'fillet', 'chamfer', 'shell'] },
  { group: 'Padrão', types: ['rectPattern', 'circPattern', 'mirror'] },
];

const COLORS = ['#94a3b8', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#e5e7eb', '#78716c'];

export const downloadBase64 = async (base64: string, name: string, mime: string) => {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  await f.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
};

type Result = Extract<FromEngine, { type: 'partResult' }>;

export default function Part3D({ onEditSketch }: { onEditSketch: (partId: string, sketchId: string) => void }) {
  const { ws, update, saveStep } = useWorkspace();
  const engine = useEngine();
  const part = ws.parts.find((p) => p.id === ws.activePart) ?? ws.parts[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const setPart = (fn: (p: PartDoc) => PartDoc) => update((w) => updatePart(w, part.id, fn));
  const sel = part.features.find((f) => f.id === selected) ?? null;
  const pickKind: 'edge' | 'face' | null = picking && sel
    ? (sel.type === 'shell' ? 'face' : (sel.type === 'fillet' || sel.type === 'chamfer') && sel.edges.mode === 'picked' ? 'edge' : null) : null;
  const highlight: V3[] = sel?.type === 'fillet' || sel?.type === 'chamfer' ? (sel.edges.mode === 'picked' ? sel.edges.points : []) : sel?.type === 'shell' ? sel.faces : [];
  const enginePart = useMemo(() => toEnginePart(part), [part]);

  useEffect(() => {
    engine.send({ type: 'part', part: enginePart, selected, rollback: pickKind ? selected : null, pick: pickKind, highlight });
  }, [enginePart, selected, pickKind, engine.ready]);

  useEffect(() => engine.listen((m) => {
    if (m.type === 'partResult') setResult(m);
    if (m.type === 'pick') onPick(m.ref.point);
  }), [sel, picking]);

  useEffect(() => { setSelected(null); setPicking(false); }, [part.id]);

  const updateFeature = (id: string, patch: Partial<Feature>) =>
    setPart((p) => ({ ...p, features: p.features.map((f) => (f.id === id ? ({ ...f, ...patch } as Feature) : f)) }));

  // tapping a picked edge/face again removes it
  const onPick = (p: V3) => {
    if (!sel || !picking) return;
    const toggle = (list: V3[]) => {
      const i = list.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-3);
      return i >= 0 ? list.filter((_, k) => k !== i) : [...list, p];
    };
    if (sel.type === 'fillet' || sel.type === 'chamfer') updateFeature(sel.id, { edges: { mode: 'picked', points: toggle(sel.edges.points) } } as any);
    if (sel.type === 'shell') updateFeature(sel.id, { faces: toggle(sel.faces) } as any);
  };

  const addFeature = (type: FeatureType) => {
    if (['extrude', 'revolve', 'loft'].includes(type) && !part.sketches.length)
      return Alert.alert('Sem esboço', 'Crie um esboço primeiro (botão "+ Esboço").');
    if (type === 'loft' && part.sketches.length < 2) return Alert.alert('Loft', 'O loft precisa de pelo menos 2 esboços em planos/deslocamentos diferentes.');
    const f = defaults(type, part, uid());
    setPart((p) => ({ ...p, features: [...p.features, f] }));
    setSelected(f.id);
    setPicking(type === 'fillet' || type === 'chamfer' || type === 'shell');
    setAddOpen(false);
  };

  const remove = (id: string) => {
    setPart((p) => ({ ...p, features: p.features.filter((f) => f.id !== id) }));
    setSelected(null);
  };

  const move = (id: string, d: -1 | 1) =>
    setPart((p) => {
      const i = p.features.findIndex((f) => f.id === id), j = i + d;
      if (j < 0 || j >= p.features.length) return p;
      const fs = [...p.features];
      [fs[i], fs[j]] = [fs[j], fs[i]];
      return { ...p, features: fs };
    });

  const createSketch = (plane: Plane, offset: number, from2d: boolean) => {
    const sk = newSketch(uid(), part.sketches.length + 1, plane, offset);
    if (from2d) sk.drawing = { ...ws.drawing, constraints: ws.drawing.constraints ?? [] };
    setPart((p) => ({ ...p, sketches: [...p.sketches, sk] }));
    setSketchOpen(false);
    onEditSketch(part.id, sk.id);
  };

  const importStep = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (r.canceled) return;
    const asset = r.assets[0];
    if (!/\.(step|stp)$/i.test(asset.name)) return Alert.alert('Importar', 'Escolha um arquivo .step ou .stp');
    const b64 = await new File(asset.uri).base64();
    const id = saveStep(b64);
    engine.send({ type: 'file', id, base64: b64 });
    const f = { ...defaults('import', part, uid()), file: id, fileName: asset.name } as Feature;
    setPart((p) => ({ ...p, features: [...p.features, f] }));
    setSelected(f.id);
  };

  const doExport = async (format: 'stl' | 'step') => {
    setExportOpen(false);
    const r = await engine.request({ type: 'export', req: nextReq(), format, scope: 'part' }, 'export');
    if (!r.base64) return Alert.alert('Exportar', r.error ?? 'Falha ao exportar');
    await downloadBase64(r.base64, `${part.name}.${format === 'stl' ? 'stl' : 'step'}`, format === 'stl' ? 'model/stl' : 'model/step');
  };

  const mass = result ? (result.volume / 1000) * part.material.density : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={u.bar}>
        <Btn small on label={`▾ ${part.name}`} onPress={() => setPartsOpen(true)} />
        {(['iso', 'top', 'front', 'right', 'fit'] as const).map((v) => (
          <Btn key={v} small label={{ iso: 'Iso', top: 'Topo', front: 'Frente', right: 'Direita', fit: 'Ajustar' }[v]} onPress={() => engine.send({ type: 'view', name: v })} />
        ))}
        <Btn small label="Exportar" onPress={() => setExportOpen(true)} />
        <Btn small label="STEP ⇩" onPress={importStep} />
      </View>

      <Viewport />

      <View style={u.panel}>
        <Text style={{ color: C.dim, fontSize: 11 }}>
          {result?.bbox
            ? `${part.material.name} · ${fmt(mass, 1)} g · Vol ${fmt(result.volume / 1000, 2)} cm³ · ${result.bbox.map((v) => fmt(v, 1)).join('×')} mm`
            : 'Sem sólido'}
          {pickKind ? `   ◉ Toque ${pickKind === 'edge' ? 'nas arestas' : 'nas faces'} no modelo` : ''}
        </Text>
        <View style={u.row}>
          <Text style={u.title}>Navegador do modelo</Text>
          <Btn small label="+ Esboço" onPress={() => setSketchOpen(true)} />
          <Btn small label="+ Feature" onPress={() => setAddOpen(true)} />
        </View>
        <ScrollView style={{ maxHeight: sel ? 96 : 170 }}>
          {part.sketches.map((sk) => (
            <View key={sk.id} style={u.treeRow}>
              <Text style={{ color: C.warn, fontSize: 13, flex: 1 }} numberOfLines={1}>✎ {sk.name} · {sk.plane}{sk.offset ? ` ${sk.offset > 0 ? '+' : ''}${sk.offset}` : ''}</Text>
              <Btn small label="Editar" onPress={() => onEditSketch(part.id, sk.id)} />
              <Btn small danger label="✕" onPress={() => Alert.alert('Excluir esboço', `Excluir ${sk.name}?`, [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: () => setPart((p) => ({ ...p, sketches: p.sketches.filter((x) => x.id !== sk.id) })) }])} />
            </View>
          ))}
          {part.features.map((f) => (
            <Pressable key={f.id} style={[u.treeRow, selected === f.id && u.treeRowOn]} onPress={() => { setSelected(selected === f.id ? null : f.id); setPicking(false); }}>
              <Text style={[{ color: '#e5e7eb', fontSize: 14 }, f.suppressed && { opacity: 0.4, textDecorationLine: 'line-through' }]}>
                {result?.errors[f.id] ? '⚠ ' : '■ '}{f.name}
              </Text>
              {result?.errors[f.id] && <Text style={u.err} numberOfLines={1}>{result.errors[f.id]}</Text>}
            </Pressable>
          ))}
          {!part.features.length && !part.sketches.length && (
            <Text style={u.hint}>1) + Esboço → desenhe e cote o perfil → Concluir  2) + Feature → Extrusão. Ou comece com uma primitiva.</Text>
          )}
        </ScrollView>
        {sel && (
          <Props f={sel} part={part} update={updateFeature} remove={remove} move={move}
            picking={picking} setPicking={setPicking} error={result?.errors[sel.id]} />
        )}
      </View>

      <Sheet open={addOpen} title="Nova feature" onClose={() => setAddOpen(false)}>
        {ADD.map((g) => (
          <View key={g.group}>
            <Text style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>{g.group}</Text>
            <View style={u.wrap}>{g.types.map((t) => <Btn key={t} label={FEATURE_LABEL[t]} onPress={() => addFeature(t)} />)}</View>
          </View>
        ))}
        <Text style={{ color: C.dim, fontSize: 12 }}>Importar</Text>
        <Btn label="Arquivo STEP (.step/.stp)" onPress={() => { setAddOpen(false); importStep(); }} />
      </Sheet>

      <SketchSheet open={sketchOpen} onClose={() => setSketchOpen(false)} onCreate={createSketch} has2d={ws.drawing.entities.length > 0} />

      <Sheet open={exportOpen} title="Exportar peça" onClose={() => setExportOpen(false)}>
        <Btn label="STEP (CAD: Inventor, SolidWorks, Fusion…)" onPress={() => doExport('step')} />
        <Btn label="STL (impressão 3D)" onPress={() => doExport('stl')} />
      </Sheet>

      <PartsSheet open={partsOpen} onClose={() => setPartsOpen(false)} />
    </View>
  );
}

function Props({ f, part, update, remove, move, picking, setPicking, error }: {
  f: Feature; part: PartDoc; update: (id: string, p: Partial<Feature>) => void; remove: (id: string) => void;
  move: (id: string, d: -1 | 1) => void; picking: boolean; setPicking: (b: boolean) => void; error?: string;
}) {
  const refOptions = part.features.filter((x) => x.id !== f.id && !['rectPattern', 'circPattern', 'mirror', 'fillet', 'chamfer', 'shell'].includes(x.type));
  const sketches = part.sketches.map((k) => [k.id, k.name] as [string, string]);
  return (
    <ScrollView style={{ maxHeight: 230, borderTopWidth: 1, borderTopColor: C.panel, paddingTop: 6 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
      <View style={u.wrap}>
        <Text style={{ color: C.accent, fontWeight: '700' }}>{FEATURE_LABEL[f.type]}</Text>
        <Btn small label="↑" onPress={() => move(f.id, -1)} />
        <Btn small label="↓" onPress={() => move(f.id, 1)} />
        <Btn small label={f.suppressed ? 'Ativar' : 'Suprimir'} onPress={() => update(f.id, { suppressed: !f.suppressed })} />
        <Btn small danger label="Excluir" onPress={() => remove(f.id)} />
      </View>
      {error && <Text style={u.err}>{error}</Text>}
      <TextField label="Nome" value={f.name} onChange={(name) => update(f.id, { name })} />
      {'sketch' in f && <Choice label="Esboço" value={f.sketch} options={sketches} onChange={(v) => update(f.id, { sketch: v } as any)} />}
      {f.type === 'loft' && <Choice multi label="Esboços (ordem)" value={f.sketches} options={sketches} onChange={(v) => update(f.id, { sketches: v } as any)} />}
      {'ref' in f && <Choice label="Feature de origem" value={f.ref} options={refOptions.map((x) => [x.id, x.name])} onChange={(v) => update(f.id, { ref: v } as any)} />}
      {f.type === 'import' && <Text style={u.hint}>Arquivo: {f.fileName}</Text>}
      {(f.type === 'fillet' || f.type === 'chamfer') && (
        <>
          <Choice label="Arestas" value={f.edges.mode} options={EDGE_MODES.map((m) => [m, CHOICE_LABEL[m]])} onChange={(mode) => update(f.id, { edges: { ...f.edges, mode } } as any)} />
          {f.edges.mode === 'picked' && (
            <View style={u.wrap}>
              <Btn small on={picking} label={picking ? '◉ Selecionando…' : 'Selecionar no modelo'} onPress={() => setPicking(!picking)} />
              <Text style={u.hint}>{f.edges.points.length} aresta(s)</Text>
              <Btn small label="Limpar" onPress={() => update(f.id, { edges: { ...f.edges, points: [] } } as any)} />
            </View>
          )}
        </>
      )}
      {f.type === 'shell' && (
        <View style={u.wrap}>
          <Btn small on={picking} label={picking ? '◉ Selecionando…' : 'Faces a remover'} onPress={() => setPicking(!picking)} />
          <Text style={u.hint}>{f.faces.length} face(s)</Text>
          <Btn small label="Limpar" onPress={() => update(f.id, { faces: [] } as any)} />
        </View>
      )}
      {PARAMS[f.type].map((p) =>
        p.kind === 'num' ? (
          <NumField key={p.key} label={p.label} value={(f as any)[p.key]} onChange={(v) => update(f.id, { [p.key]: v } as any)} />
        ) : (
          <Choice key={p.key} label={p.label} value={(f as any)[p.key]} options={p.options.map((o) => [o, CHOICE_LABEL[o] ?? o])} onChange={(v) => update(f.id, { [p.key]: v } as any)} />
        ),
      )}
    </ScrollView>
  );
}

function SketchSheet({ open, onClose, onCreate, has2d }: { open: boolean; onClose: () => void; onCreate: (p: Plane, o: number, from2d: boolean) => void; has2d: boolean }) {
  const [plane, setPlane] = useState<Plane>('XY');
  const [offset, setOffset] = useState(0);
  return (
    <Sheet open={open} title="Novo esboço" onClose={onClose}>
      <Text style={u.hint}>O esboço abre no editor 2D com cotas e restrições. Formas fechadas viram perfis; formas internas viram furos. Linhas de construção são ignoradas.</Text>
      <Choice label="Plano" value={plane} options={[['XY', 'XY (topo)'], ['XZ', 'XZ (frente)'], ['YZ', 'YZ (lateral)']]} onChange={(v) => setPlane(v as Plane)} />
      <NumField label="Deslocamento" value={offset} onChange={setOffset} />
      <Btn on label="Criar esboço vazio" onPress={() => onCreate(plane, offset, false)} />
      {has2d && <Btn label="Criar a partir do Desenho 2D" onPress={() => onCreate(plane, offset, true)} />}
    </Sheet>
  );
}

function PartsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ws, update } = useWorkspace();
  const part = ws.parts.find((p) => p.id === ws.activePart) ?? ws.parts[0];
  const setPart = (fn: (p: PartDoc) => PartDoc) => update((w) => updatePart(w, part.id, fn));
  return (
    <Sheet open={open} title="Peças" onClose={onClose}>
      {ws.parts.map((p) => (
        <Pressable key={p.id} style={[u.treeRow, p.id === part.id && u.treeRowOn]} onPress={() => update((w) => ({ ...w, activePart: p.id }))}>
          <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: p.color }} />
          <Text style={{ color: C.text, flex: 1 }}>{p.name}</Text>
          <Text style={u.hint}>{p.features.length} features</Text>
        </Pressable>
      ))}
      <View style={u.wrap}>
        <Btn label="+ Nova peça" onPress={() => { const p = emptyPart(uid(), `Peça${ws.parts.length + 1}`); update((w) => ({ ...w, parts: [...w.parts, p], activePart: p.id })); }} />
        <Btn label="Duplicar" onPress={() => { const p = { ...JSON.parse(JSON.stringify(part)), id: uid(), name: part.name + ' (cópia)' }; update((w) => ({ ...w, parts: [...w.parts, p], activePart: p.id })); }} />
        <Btn danger label="Excluir" onPress={() => {
          if (ws.parts.length < 2) return Alert.alert('Peças', 'Mantenha pelo menos uma peça.');
          Alert.alert('Excluir peça', `Excluir ${part.name}? Componentes de montagens que a usam também serão removidos.`, [{ text: 'Cancelar' }, {
            text: 'Excluir', style: 'destructive', onPress: () => update((w) => {
              const parts = w.parts.filter((p) => p.id !== part.id);
              const assemblies = w.assemblies.map((a) => {
                const gone = new Set(a.components.filter((c) => c.part === part.id).map((c) => c.id));
                return { ...a, components: a.components.filter((c) => !gone.has(c.id)), mates: a.mates.filter((m) => !gone.has(m.a.comp) && !gone.has(m.b.comp)) };
              });
              return { ...w, parts, assemblies, activePart: parts[0].id };
            }),
          }]);
        }} />
      </View>
      <Text style={u.title}>Propriedades de {part.name}</Text>
      <TextField label="Nome" value={part.name} onChange={(name) => setPart((p) => ({ ...p, name }))} />
      <Choice label="Material" value={part.material.name} options={MATERIALS.map((m) => [m.name, `${m.name} (${m.density})`])} onChange={(n) => setPart((p) => ({ ...p, material: MATERIALS.find((m) => m.name === n)! }))} />
      <View style={u.field}>
        <Text style={[u.label, { width: 110 }]}>Cor</Text>
        <View style={u.wrap}>
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => setPart((p) => ({ ...p, color: c }))} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: part.color === c ? 3 : 0, borderColor: C.accent }} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}
