// Assembly screen: place part instances, constrain them with mates picked on the model,
// check interferences, list the bill of materials and export STEP/STL.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { uid } from './cad';
import { nextReq, toEnginePart, useEngine, Viewport } from './engine';
import { AssemblyDoc, Component, FromEngine, MATE_LABEL, Mate, Ref, emptyAssembly } from './part';
import { downloadBase64 } from './Part3D';
import { updateAsm, useWorkspace } from './store';
import { Btn, C, Choice, NumField, Sheet, TextField, fmt, u } from './ui';

type Result = Extract<FromEngine, { type: 'asmResult' }>;
type Draft = { type: Mate['type']; a: Ref | null };

export default function Assembly() {
  const { ws, update } = useWorkspace();
  const engine = useEngine();
  const asm = ws.assemblies.find((a) => a.id === ws.activeAsm) ?? ws.assemblies[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [selMate, setSelMate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mateOpen, setMateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  const setAsm = (fn: (a: AssemblyDoc) => AssemblyDoc) => update((w) => updateAsm(w, asm.id, fn));
  const usedParts = useMemo(() => ws.parts.filter((p) => asm.components.some((c) => c.part === p.id)), [ws.parts, asm]);
  const engineParts = useMemo(() => usedParts.map(toEnginePart), [usedParts]);
  const mate = asm.mates.find((m) => m.id === selMate);
  const highlight = draft?.a ? [draft.a] : mate ? [mate.a, mate.b] : [];

  useEffect(() => {
    engine.send({ type: 'assembly', asm, parts: engineParts, selected, pick: !!draft, highlight });
  }, [asm, engineParts, selected, draft, selMate, engine.ready]);

  useEffect(() => engine.listen((m) => {
    if (m.type === 'asmResult') setResult(m);
    if (m.type === 'pick' && m.ref.comp) onPick(m.ref as Ref);
  }), [draft, asm]);

  useEffect(() => { setSelected(null); setDraft(null); setSelMate(null); }, [asm.id]);

  const onPick = (r: Ref) => {
    if (!draft) return setSelected(r.comp);
    if (draft.type === 'axis' && !r.axis) return Alert.alert('Eixos', 'Toque numa face cilíndrica (furo ou pino).');
    if (!draft.a) return setDraft({ ...draft, a: r });
    if (r.comp === draft.a.comp) return Alert.alert('Restrição', 'Escolha uma face de outro componente.');
    const m: Mate = { id: uid(), type: draft.type, a: draft.a, b: r, offset: 0 };
    setAsm((a) => ({ ...a, mates: [...a.mates, m] }));
    setDraft(null);
    setSelMate(m.id);
  };

  const addComponent = (partId: string) => {
    const p = ws.parts.find((x) => x.id === partId)!;
    const n = asm.components.filter((c) => c.part === partId).length + 1;
    const c: Component = {
      id: uid(), part: partId, name: `${p.name}:${n}`, pos: [asm.components.length * 30, 0, 0], rot: [0, 0, 0],
      grounded: asm.components.length === 0, visible: true,
    };
    setAsm((a) => ({ ...a, components: [...a.components, c] }));
    setSelected(c.id);
    setAddOpen(false);
  };

  const updateComp = (id: string, patch: Partial<Component>) =>
    setAsm((a) => ({ ...a, components: a.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const updateMate = (id: string, patch: Partial<Mate>) =>
    setAsm((a) => ({ ...a, mates: a.mates.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  const removeComp = (id: string) => {
    setAsm((a) => ({ ...a, components: a.components.filter((c) => c.id !== id), mates: a.mates.filter((m) => m.a.comp !== id && m.b.comp !== id) }));
    setSelected(null);
  };

  const openBom = async () => {
    setBomOpen(true);
    const r = await engine.request({ type: 'measure', req: nextReq(), parts: engineParts }, 'measure');
    setVolumes(r.volumes);
  };

  const doExport = async (format: 'stl' | 'step') => {
    setExportOpen(false);
    const r = await engine.request({ type: 'export', req: nextReq(), format, scope: 'assembly' }, 'export');
    if (!r.base64) return Alert.alert('Exportar', r.error ?? 'Falha ao exportar');
    await downloadBase64(r.base64, `${asm.name}.${format}`, format === 'stl' ? 'model/stl' : 'model/step');
  };

  const comp = asm.components.find((c) => c.id === selected);
  const nameOf = (id: string) => asm.components.find((c) => c.id === id)?.name ?? '?';
  const bom = usedParts.map((p) => ({ p, qty: asm.components.filter((c) => c.part === p.id).length }));

  return (
    <View style={{ flex: 1 }}>
      <View style={u.bar}>
        <Btn small on label={`▾ ${asm.name}`} onPress={() => setListOpen(true)} />
        {(['iso', 'top', 'front', 'right', 'fit'] as const).map((v) => (
          <Btn key={v} small label={{ iso: 'Iso', top: 'Topo', front: 'Frente', right: 'Direita', fit: 'Ajustar' }[v]} onPress={() => engine.send({ type: 'view', name: v })} />
        ))}
        <Btn small label="Lista de peças" onPress={openBom} />
        <Btn small label="Exportar" onPress={() => setExportOpen(true)} />
      </View>

      <Viewport />

      <View style={u.panel}>
        {draft ? (
          <View style={u.row}>
            <Text style={{ color: C.warn, flex: 1, fontSize: 12 }}>◉ {MATE_LABEL[draft.type]}: toque {draft.a ? 'na 2ª' : 'na 1ª'} {draft.type === 'axis' ? 'face cilíndrica' : 'face'}</Text>
            <Btn small label="Cancelar" onPress={() => setDraft(null)} />
          </View>
        ) : (
          <Text style={{ color: result?.interferences.length ? C.err : C.dim, fontSize: 11 }}>
            {result?.interferences.length
              ? `⚠ Interferência: ${result.interferences.map((i) => `${nameOf(i.a)} × ${nameOf(i.b)} (${fmt(i.volume, 1)} mm³)`).join(', ')}`
              : result?.bbox ? `Sem interferências · ${result.bbox.map((v) => fmt(v, 1)).join('×')} mm` : 'Adicione componentes'}
          </Text>
        )}
        <View style={u.row}>
          <Text style={u.title}>Componentes e restrições</Text>
          <Btn small label="+ Componente" onPress={() => setAddOpen(true)} />
          <Btn small label="+ Restrição" onPress={() => asm.components.length < 2 ? Alert.alert('Restrição', 'Adicione pelo menos 2 componentes.') : setMateOpen(true)} />
        </View>
        <ScrollView style={{ maxHeight: comp || mate ? 90 : 170 }}>
          {asm.components.map((c) => (
            <Pressable key={c.id} style={[u.treeRow, selected === c.id && u.treeRowOn]} onPress={() => { setSelected(selected === c.id ? null : c.id); setSelMate(null); }}>
              <Text style={{ color: c.visible ? '#e5e7eb' : C.dim, flex: 1 }}>{c.grounded ? '⚓ ' : '▣ '}{c.name}</Text>
              {result?.errors[c.id] && <Text style={u.err}>{result.errors[c.id]}</Text>}
            </Pressable>
          ))}
          {asm.mates.map((m) => (
            <Pressable key={m.id} style={[u.treeRow, selMate === m.id && u.treeRowOn]} onPress={() => { setSelMate(selMate === m.id ? null : m.id); setSelected(null); }}>
              <Text style={{ color: m.suppressed ? C.dim : C.warn, flex: 1, fontSize: 13 }} numberOfLines={1}>
                ⛓ {MATE_LABEL[m.type]}: {nameOf(m.a.comp)} ↔ {nameOf(m.b.comp)}{m.offset ? ` (${m.offset})` : ''}
              </Text>
            </Pressable>
          ))}
          {!asm.components.length && <Text style={u.hint}>Crie peças na aba "Peça 3D" e insira aqui. O primeiro componente fica fixo (⚓). Depois use restrições tocando nas faces.</Text>}
        </ScrollView>
        {comp && (
          <ScrollView style={{ maxHeight: 220, borderTopWidth: 1, borderTopColor: C.panel, paddingTop: 6 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            <View style={u.wrap}>
              <Btn small on={comp.grounded} label={comp.grounded ? '⚓ Fixo' : 'Fixar'} onPress={() => updateComp(comp.id, { grounded: !comp.grounded })} />
              <Btn small label={comp.visible ? 'Ocultar' : 'Mostrar'} onPress={() => updateComp(comp.id, { visible: !comp.visible })} />
              <Btn small label="Duplicar" onPress={() => { const c = { ...comp, id: uid(), name: comp.name + "'", pos: [comp.pos[0] + 20, comp.pos[1], comp.pos[2]] as Component['pos'], grounded: false }; setAsm((a) => ({ ...a, components: [...a.components, c] })); setSelected(c.id); }} />
              <Btn small label="Editar peça" onPress={() => update((w) => ({ ...w, activePart: comp.part }))} />
              <Btn small danger label="Remover" onPress={() => removeComp(comp.id)} />
            </View>
            <TextField label="Nome" value={comp.name} onChange={(name) => updateComp(comp.id, { name })} />
            {(['X', 'Y', 'Z'] as const).map((k, i) => (
              <NumField key={'p' + k} label={`Posição ${k}`} value={comp.pos[i]} onChange={(v) => updateComp(comp.id, { pos: comp.pos.map((x, j) => (j === i ? v : x)) as Component['pos'] })} />
            ))}
            {(['X', 'Y', 'Z'] as const).map((k, i) => (
              <NumField key={'r' + k} label={`Rotação ${k} (°)`} value={comp.rot[i]} onChange={(v) => updateComp(comp.id, { rot: comp.rot.map((x, j) => (j === i ? v : x)) as Component['rot'] })} />
            ))}
            <Text style={u.hint}>A posição é o ponto de partida; restrições ajustam o componente a partir dela.</Text>
          </ScrollView>
        )}
        {mate && (
          <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.panel, paddingTop: 6 }}>
            <Choice label="Tipo" value={mate.type} options={(Object.keys(MATE_LABEL) as Mate['type'][]).map((t) => [t, MATE_LABEL[t]])} onChange={(type) => updateMate(mate.id, { type })} />
            <NumField label="Afastamento" value={mate.offset} onChange={(offset) => updateMate(mate.id, { offset })} />
            <View style={u.wrap}>
              <Btn small label="Inverter lados" onPress={() => updateMate(mate.id, { a: mate.b, b: mate.a })} />
              <Btn small label={mate.suppressed ? 'Ativar' : 'Suprimir'} onPress={() => updateMate(mate.id, { suppressed: !mate.suppressed })} />
              <Btn small danger label="Excluir" onPress={() => { setAsm((a) => ({ ...a, mates: a.mates.filter((x) => x.id !== mate.id) })); setSelMate(null); }} />
            </View>
          </View>
        )}
      </View>

      <Sheet open={addOpen} title="Inserir componente" onClose={() => setAddOpen(false)}>
        {ws.parts.map((p) => (
          <Btn key={p.id} label={`${p.name}  (${p.features.length} features)`} onPress={() => addComponent(p.id)} />
        ))}
      </Sheet>

      <Sheet open={mateOpen} title="Nova restrição de montagem" onClose={() => setMateOpen(false)}>
        {(Object.keys(MATE_LABEL) as Mate['type'][]).map((t) => (
          <Btn key={t} label={MATE_LABEL[t]} onPress={() => { setDraft({ type: t, a: null }); setMateOpen(false); setSelected(null); setSelMate(null); }} />
        ))}
        <Text style={u.hint}>Depois toque na face do componente que fica parado e em seguida na face do que se move. Para eixos, toque em superfícies cilíndricas.</Text>
      </Sheet>

      <Sheet open={bomOpen} title={`Lista de peças — ${asm.name}`} onClose={() => setBomOpen(false)}>
        <View style={[u.row, { borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 }]}>
          <Text style={[u.label, { width: 24 }]}>#</Text>
          <Text style={[u.label, { flex: 1 }]}>Peça</Text>
          <Text style={[u.label, { width: 36 }]}>Qtd</Text>
          <Text style={[u.label, { width: 80 }]}>Material</Text>
          <Text style={[u.label, { width: 70, textAlign: 'right' }]}>Massa un.</Text>
        </View>
        {bom.map(({ p, qty }, i) => (
          <View key={p.id} style={u.row}>
            <Text style={{ color: C.text, width: 24 }}>{i + 1}</Text>
            <Text style={{ color: C.text, flex: 1 }}>{p.name}</Text>
            <Text style={{ color: C.text, width: 36 }}>{qty}</Text>
            <Text style={{ color: C.text, width: 80 }} numberOfLines={1}>{p.material.name}</Text>
            <Text style={{ color: C.text, width: 70, textAlign: 'right' }}>{volumes[p.id] !== undefined ? `${fmt((volumes[p.id] / 1000) * p.material.density, 1)} g` : '…'}</Text>
          </View>
        ))}
        <Text style={{ color: C.accent, textAlign: 'right' }}>
          Total: {fmt(bom.reduce((s, { p, qty }) => s + ((volumes[p.id] ?? 0) / 1000) * p.material.density * qty, 0), 1)} g
        </Text>
      </Sheet>

      <Sheet open={exportOpen} title="Exportar montagem" onClose={() => setExportOpen(false)}>
        <Btn label="STEP (com cores e nomes)" onPress={() => doExport('step')} />
        <Btn label="STL (malha única)" onPress={() => doExport('stl')} />
      </Sheet>

      <Sheet open={listOpen} title="Montagens" onClose={() => setListOpen(false)}>
        {ws.assemblies.map((a) => (
          <Pressable key={a.id} style={[u.treeRow, a.id === asm.id && u.treeRowOn]} onPress={() => update((w) => ({ ...w, activeAsm: a.id }))}>
            <Text style={{ color: C.text, flex: 1 }}>{a.name}</Text>
            <Text style={u.hint}>{a.components.length} componentes</Text>
          </Pressable>
        ))}
        <View style={u.wrap}>
          <Btn label="+ Nova montagem" onPress={() => { const a = emptyAssembly(uid(), `Montagem${ws.assemblies.length + 1}`); update((w) => ({ ...w, assemblies: [...w.assemblies, a], activeAsm: a.id })); }} />
          <Btn danger label="Excluir" onPress={() => ws.assemblies.length < 2 ? Alert.alert('Montagens', 'Mantenha pelo menos uma.') : update((w) => {
            const assemblies = w.assemblies.filter((a) => a.id !== asm.id);
            return { ...w, assemblies, activeAsm: assemblies[0].id };
          })} />
        </View>
        <TextField label="Nome" value={asm.name} onChange={(name) => setAsm((a) => ({ ...a, name }))} />
      </Sheet>
    </View>
  );
}
