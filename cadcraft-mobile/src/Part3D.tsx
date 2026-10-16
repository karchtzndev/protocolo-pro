import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Drawing, uid } from './cad';
import { ENGINE_HTML } from './engine3d.generated';
import {
  CHOICE_LABEL, FEATURE_LABEL, Feature, FeatureType, FromEngine, PARAMS, Part, Plane, ToEngine,
  defaults, emptyPart, loopsFromDrawing,
} from './part';

const PART_KEY = 'cadcraft.part.v1';
export const DRAWING_KEY = 'cadcraft.drawing.v1';

const ADD: { group: string; types: FeatureType[] }[] = [
  { group: 'Esboço', types: ['extrude', 'revolve'] },
  { group: 'Primitivas', types: ['box', 'cylinder', 'sphere'] },
  { group: 'Modificar', types: ['hole'] },
  { group: 'Padrão', types: ['rectPattern', 'circPattern', 'mirror'] },
];

type Result = Extract<FromEngine, { type: 'result' }>;

export default function Part3D() {
  const [part, setPart] = useState<Part>(emptyPart);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const web = useRef<any>(null); // WebView's typings don't expose its ref methods
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(PART_KEY).then((raw) => {
      if (raw) try { setPart(JSON.parse(raw)); } catch {}
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(PART_KEY, JSON.stringify(part)).catch(() => {});
  }, [part]);

  const send = (m: ToEngine) =>
    web.current?.injectJavaScript(`window.cadEngine && window.cadEngine.send(${JSON.stringify(JSON.stringify(m))});true;`);

  useEffect(() => { if (ready) send({ type: 'model', part, selected }); }, [ready, part, selected]);

  const onMessage = async (raw: string) => {
    const m: FromEngine = JSON.parse(raw);
    if (m.type === 'ready') setReady(true);
    if (m.type === 'result') setResult(m);
    if (m.type === 'log') Alert.alert('Motor 3D', m.msg);
    if (m.type === 'stl') {
      if (!m.tris) return Alert.alert('Exportar STL', 'A peça ainda não tem sólido.');
      try {
        const f = new File(Paths.cache, `peca-${Date.now()}.stl`);
        await f.write(Uint8Array.from(atob(m.base64), (c) => c.charCodeAt(0)));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'model/stl', dialogTitle: 'Exportar STL' });
      } catch (e) {
        Alert.alert('Erro ao exportar', String(e));
      }
    }
  };

  const update = (id: string, patch: Partial<Feature>) =>
    setPart((p) => ({ ...p, features: p.features.map((f) => (f.id === id ? ({ ...f, ...patch } as Feature) : f)) }));

  const addFeature = (type: FeatureType) => {
    const n = part.features.filter((f) => f.type === type).length + 1;
    const f = defaults(type, part, uid(), n);
    if ((type === 'extrude' || type === 'revolve') && !part.sketches.length)
      return Alert.alert('Sem esboço', 'Crie um esboço primeiro (botão "+ Esboço"), a partir das formas fechadas do desenho 2D.');
    setPart((p) => ({ ...p, features: [...p.features, f] }));
    setSelected(f.id);
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

  const createSketch = async (plane: Plane, offset: number) => {
    const raw = await AsyncStorage.getItem(DRAWING_KEY);
    const loops = raw ? loopsFromDrawing(JSON.parse(raw) as Drawing) : [];
    if (!loops.length)
      return Alert.alert('Nenhum perfil fechado', 'Desenhe retângulos, polilinhas fechadas (PL + C) ou círculos no modo 2D.');
    const sk = { id: uid(), name: `Esboço${part.sketches.length + 1}`, plane, offset, loops };
    setPart((p) => ({ ...p, sketches: [...p.sketches, sk] }));
    setSketchOpen(false);
    Alert.alert('Esboço criado', `${sk.name}: ${loops.length} perfil(is) no plano ${plane}. Agora use Extrusão ou Revolução.`);
  };

  const sel = part.features.find((f) => f.id === selected) ?? null;
  const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('pt-BR');

  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        {(['iso', 'top', 'front', 'right', 'fit'] as const).map((v) => (
          <Btn key={v} small label={{ iso: 'Iso', top: 'Topo', front: 'Frente', right: 'Direita', fit: 'Ajustar' }[v]} onPress={() => send({ type: 'view', name: v })} />
        ))}
        <Btn small label="STL ⇪" onPress={() => send({ type: 'stl' })} />
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html: ENGINE_HTML }}
          onMessage={(e: WebViewMessageEvent) => onMessage(e.nativeEvent.data)}
          style={{ backgroundColor: '#0b1120' }}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled
        />
        {!ready && <Text style={s.loading}>Carregando motor 3D…</Text>}
        {result && (
          <Text style={s.stats}>
            {result.bbox
              ? `Vol ${fmt(result.volume)} mm³ · Área ${fmt(result.area)} mm²\n${result.bbox.map(fmt).join(' × ')} mm`
              : 'Sem sólido'}
          </Text>
        )}
      </View>

      <View style={s.panel}>
        <View style={s.panelHead}>
          <Text style={s.title}>Árvore do modelo</Text>
          <Btn small label="+ Esboço" onPress={() => setSketchOpen(true)} />
          <Btn small label="+ Feature" onPress={() => setAddOpen(true)} />
        </View>
        <ScrollView style={{ maxHeight: 130 }}>
          {part.sketches.map((sk) => (
            <View key={sk.id} style={s.row}>
              <Text style={s.sketchName}>✎ {sk.name} · {sk.plane}{sk.offset ? ` +${sk.offset}` : ''} · {sk.loops.length} perfil(is)</Text>
              <Pressable onPress={() => setPart((p) => ({ ...p, sketches: p.sketches.filter((x) => x.id !== sk.id) }))}><Text style={s.icon}>✕</Text></Pressable>
            </View>
          ))}
          {part.features.map((f) => (
            <Pressable key={f.id} style={[s.row, selected === f.id && s.rowOn]} onPress={() => setSelected(selected === f.id ? null : f.id)}>
              <Text style={[s.feat, f.suppressed && { opacity: 0.4, textDecorationLine: 'line-through' }]}>
                {result?.errors[f.id] ? '⚠ ' : '■ '}{f.name}
              </Text>
              {result?.errors[f.id] && <Text style={s.err} numberOfLines={1}>{result.errors[f.id]}</Text>}
            </Pressable>
          ))}
          {!part.features.length && <Text style={s.hint}>1) Desenhe um perfil fechado no 2D  2) + Esboço  3) + Feature → Extrusão. Ou comece com uma primitiva.</Text>}
        </ScrollView>
        {sel && <Props f={sel} part={part} update={update} remove={remove} move={move} />}
      </View>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Sheet title="Nova feature" onClose={() => setAddOpen(false)}>
          {ADD.map((g) => (
            <View key={g.group}>
              <Text style={s.group}>{g.group}</Text>
              <View style={s.wrap}>{g.types.map((t) => <Btn key={t} label={FEATURE_LABEL[t]} onPress={() => addFeature(t)} />)}</View>
            </View>
          ))}
        </Sheet>
      </Modal>
      <SketchModal open={sketchOpen} onClose={() => setSketchOpen(false)} onCreate={createSketch} />
    </View>
  );
}

function Props({ f, part, update, remove, move }: {
  f: Feature; part: Part; update: (id: string, p: Partial<Feature>) => void; remove: (id: string) => void; move: (id: string, d: -1 | 1) => void;
}) {
  const refOptions = part.features.filter((x) => x.id !== f.id && !['rectPattern', 'circPattern', 'mirror'].includes(x.type));
  return (
    <ScrollView style={s.props} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
      <View style={s.wrap}>
        <TextInput style={[s.input, { flex: 1 }]} value={f.name} onChangeText={(name) => update(f.id, { name })} />
        <Btn small label="↑" onPress={() => move(f.id, -1)} />
        <Btn small label="↓" onPress={() => move(f.id, 1)} />
        <Btn small label={f.suppressed ? 'Ativar' : 'Suprimir'} onPress={() => update(f.id, { suppressed: !f.suppressed })} />
        <Btn small label="Excluir" onPress={() => remove(f.id)} />
      </View>
      {'sketch' in f && (
        <Choice label="Esboço" value={f.sketch} options={part.sketches.map((k) => [k.id, k.name])} onChange={(v) => update(f.id, { sketch: v } as any)} />
      )}
      {'ref' in f && (
        <Choice label="Feature de origem" value={f.ref} options={refOptions.map((x) => [x.id, x.name])} onChange={(v) => update(f.id, { ref: v } as any)} />
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

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const commit = () => {
    const v = parseFloat(txt.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v); else setTxt(String(value));
  };
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={txt} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit} keyboardType="numbers-and-punctuation" selectTextOnFocus />
    </View>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.wrap, { flex: 1 }]}>
        {options.map(([v, l]) => (
          <Pressable key={v} onPress={() => onChange(v)} style={[s.chip, value === v && s.chipOn]}>
            <Text style={[s.chipText, value === v && { color: '#0b1120' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SketchModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: Plane, o: number) => void }) {
  const [plane, setPlane] = useState<Plane>('XY');
  const [offset, setOffset] = useState(0);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Sheet title="Novo esboço a partir do desenho 2D" onClose={onClose}>
        <Text style={s.hint}>Usa as formas fechadas (retângulos, polilinhas fechadas e círculos) das camadas visíveis do 2D. Perfis dentro de outros viram furos.</Text>
        <Choice label="Plano" value={plane} options={[['XY', 'XY (topo)'], ['XZ', 'XZ (frente)'], ['YZ', 'YZ (lateral)']]} onChange={(v) => setPlane(v as Plane)} />
        <NumField label="Deslocamento" value={offset} onChange={setOffset} />
        <Btn label="Criar esboço" onPress={() => onCreate(plane, offset)} />
      </Sheet>
    </Modal>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <View style={s.sheetWrap}>
      <View style={s.sheet}>
        <View style={s.panelHead}>
          <Text style={s.title}>{title}</Text>
          <Btn small label="Fechar" onPress={onClose} />
        </View>
        {children}
      </View>
    </View>
  );
}

const Btn = ({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.btn, small && s.btnSmall, pressed && { opacity: 0.6 }]}>
    <Text style={[s.btnText, small && { fontSize: 12 }]}>{label}</Text>
  </Pressable>
);

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
const s = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 6, flexWrap: 'wrap' },
  loading: { position: 'absolute', alignSelf: 'center', top: '45%', color: '#9ca3af' },
  stats: { position: 'absolute', left: 8, top: 8, color: '#d1d5db', fontFamily: mono, fontSize: 11, backgroundColor: '#0b1120cc', padding: 4, borderRadius: 4 },
  panel: { borderTopWidth: 1, borderTopColor: '#1f2937', padding: 8, gap: 4 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#f9fafb', fontWeight: '700', fontSize: 15, marginRight: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
  rowOn: { backgroundColor: '#1e3a5f' },
  sketchName: { color: '#facc15', fontSize: 13, flex: 1 },
  feat: { color: '#e5e7eb', fontSize: 14 },
  err: { color: '#f87171', fontSize: 11, flex: 1 },
  icon: { color: '#9ca3af', paddingHorizontal: 6 },
  hint: { color: '#9ca3af', fontSize: 12, padding: 4 },
  props: { maxHeight: 220, borderTopWidth: 1, borderTopColor: '#1f2937', paddingTop: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#9ca3af', fontSize: 12, width: 110 },
  input: { flex: 1, color: '#f9fafb', backgroundColor: '#1f2937', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#374151' },
  chipOn: { backgroundColor: '#22d3ee', borderColor: '#22d3ee' },
  chipText: { color: '#e5e7eb', fontSize: 12 },
  group: { color: '#9ca3af', fontSize: 12, marginTop: 8, marginBottom: 4 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#374151' },
  btnSmall: { paddingHorizontal: 8, paddingVertical: 5 },
  btnText: { color: '#f9fafb', fontSize: 14, fontWeight: '600' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { backgroundColor: '#111827', padding: 16, paddingBottom: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 8 },
});
