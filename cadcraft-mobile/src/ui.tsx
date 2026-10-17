// Small shared UI building blocks (dark CAD theme).
import { ReactNode, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export const C = {
  bg: '#111827', canvas: '#0b1120', panel: '#1f2937', border: '#374151', text: '#f9fafb', dim: '#9ca3af',
  accent: '#22d3ee', warn: '#facc15', err: '#f87171', ok: '#4ade80',
};
export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const Btn = ({ label, onPress, small, on, danger, disabled }: { label: string; onPress: () => void; small?: boolean; on?: boolean; danger?: boolean; disabled?: boolean }) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [u.btn, small && u.btnSmall, on && u.btnOn, danger && { backgroundColor: '#7f1d1d' }, (pressed || disabled) && { opacity: 0.5 }]}>
    <Text style={[u.btnText, small && { fontSize: 12 }, on && { color: C.canvas }]}>{label}</Text>
  </Pressable>
);

export const Toggle = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[u.toggle, on && u.toggleOn]}>
    <Text style={[u.toggleText, on && { color: C.canvas }]}>{label}</Text>
  </Pressable>
);

export function NumField({ label, value, onChange, width = 110 }: { label: string; value: number; onChange: (v: number) => void; width?: number }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const commit = () => {
    const v = parseFloat(txt.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v); else setTxt(String(value));
  };
  return (
    <View style={u.field}>
      <Text style={[u.label, { width }]}>{label}</Text>
      <TextInput style={u.input} value={txt} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit} keyboardType="numbers-and-punctuation" selectTextOnFocus />
    </View>
  );
}

export function TextField({ label, value, onChange, width = 110 }: { label: string; value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <View style={u.field}>
      <Text style={[u.label, { width }]}>{label}</Text>
      <TextInput style={u.input} value={value} onChangeText={onChange} />
    </View>
  );
}

export function Choice({ label, value, options, onChange, multi, width = 110 }: {
  label: string; value: string | string[]; options: [string, string][]; onChange: (v: any) => void; multi?: boolean; width?: number;
}) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  const press = (v: string) => {
    if (!multi) return onChange(v);
    const cur = (value as string[]) ?? [];
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  return (
    <View style={u.field}>
      {!!label && <Text style={[u.label, { width }]}>{label}</Text>}
      <View style={[u.wrap, { flex: 1 }]}>
        {options.map(([v, l]) => (
          <Pressable key={v} onPress={() => press(v)} style={[u.chip, on(v) && u.chipOn]}>
            <Text style={[u.chipText, on(v) && { color: C.canvas }]}>{l}</Text>
          </Pressable>
        ))}
        {!options.length && <Text style={u.hint}>(nenhum)</Text>}
      </View>
    </View>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={u.sheetWrap}>
        <View style={u.sheet}>
          <View style={u.row}>
            <Text style={u.title}>{title}</Text>
            <Btn small label="Fechar" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const fmt = (n: number, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('pt-BR');

export const u = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  title: { color: C.text, fontWeight: '700', fontSize: 15, marginRight: 'auto' },
  hint: { color: C.dim, fontSize: 12, padding: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: C.dim, fontSize: 12 },
  input: { flex: 1, color: C.text, backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: '#e5e7eb', fontSize: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: C.border },
  btnSmall: { paddingHorizontal: 8, paddingVertical: 5 },
  btnOn: { backgroundColor: C.accent },
  btnText: { color: C.text, fontSize: 14, fontWeight: '600' },
  toggle: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: C.border },
  toggleOn: { backgroundColor: C.warn, borderColor: C.warn },
  toggleText: { color: C.dim, fontSize: 11, fontWeight: '700' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { backgroundColor: C.bg, padding: 16, paddingBottom: 28, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 8, maxHeight: '85%' },
  stats: { position: 'absolute', left: 8, top: 8, color: '#d1d5db', fontFamily: mono, fontSize: 11, backgroundColor: '#0b1120cc', padding: 4, borderRadius: 4 },
  bar: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 6, flexWrap: 'wrap', alignItems: 'center' },
  panel: { borderTopWidth: 1, borderTopColor: C.panel, padding: 8, gap: 4 },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
  treeRowOn: { backgroundColor: '#1e3a5f' },
  err: { color: C.err, fontSize: 11, flex: 1 },
});
