import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Editor2D from './src/Editor2D';
import Part3D from './src/Part3D';
import Assembly from './src/Assembly';
import DrawingSheet from './src/DrawingSheet';
import { EngineProvider } from './src/engine';
import { WorkspaceProvider, updatePart, useWorkspace } from './src/store';
import { C } from './src/ui';

type Tab = '2d' | 'part' | 'asm' | 'sheet';
const TABS: [Tab, string][] = [['2d', '2D'], ['part', 'Peça'], ['asm', 'Montagem'], ['sheet', 'Folha']];

function Shell() {
  const { ws, update } = useWorkspace();
  const [tab, setTab] = useState<Tab>('2d');
  const [editing, setEditing] = useState<{ part: string; sketch: string } | null>(null);

  const part = editing && ws.parts.find((p) => p.id === editing.part);
  const sketch = part?.sketches.find((s) => s.id === editing!.sketch);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.brand}>CADCraft</Text>
        {!sketch && TABS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[s.tab, tab === id && s.tabOn]}>
            <Text style={[s.tabText, tab === id && { color: C.canvas }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {sketch && part ? (
        <Editor2D
          key={sketch.id}
          title={`${part.name} › ${sketch.name} (${sketch.plane})`}
          drawing={sketch.drawing}
          onChange={(drawing) => update((w) => updatePart(w, part.id, (p) => ({ ...p, sketches: p.sketches.map((k) => (k.id === sketch.id ? { ...k, drawing } : k)) })))}
          onDone={() => { setEditing(null); setTab('part'); }}
        />
      ) : tab === '2d' ? (
        <Editor2D key="main" drawing={ws.drawing} onChange={(drawing) => update((w) => ({ ...w, drawing }))} onExport />
      ) : tab === 'part' ? (
        <Part3D onEditSketch={(p, sk) => setEditing({ part: p, sketch: sk })} />
      ) : tab === 'asm' ? (
        <Assembly />
      ) : (
        <DrawingSheet onOpen2D={() => setTab('2d')} />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WorkspaceProvider>
        <EngineProvider>
          <Shell />
        </EngineProvider>
      </WorkspaceProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, flexWrap: 'wrap' },
  brand: { color: C.text, fontWeight: '800', fontSize: 16, marginRight: 'auto' },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.accent },
  tabText: { color: '#e5e7eb', fontWeight: '600', fontSize: 12 },
});
