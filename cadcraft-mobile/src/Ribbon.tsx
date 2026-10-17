// Inventor-style ribbon: tabs on top, labelled panels of large icon buttons below.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './icons';
import { C } from './ui';

export type RibbonButton = { icon: IconName; label: string; onPress: () => void; big?: boolean; on?: boolean; color?: string; disabled?: boolean };
export type RibbonPanel = { title: string; buttons: RibbonButton[] };
export type RibbonTab = { id: string; label: string; panels: RibbonPanel[] };

export function Ribbon({ tabs, initial, right }: { tabs: RibbonTab[]; initial?: string; right?: React.ReactNode }) {
  const [tab, setTab] = useState(initial ?? tabs[0].id);
  const cur = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <View style={s.wrap}>
      <View style={s.tabs}>
        {tabs.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[s.tab, t.id === cur.id && s.tabOn]}>
            <Text style={[s.tabText, t.id === cur.id && { color: C.text }]}>{t.label}</Text>
          </Pressable>
        ))}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>{right}</View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.panels}>
        {cur.panels.map((p) => (
          <View key={p.title} style={s.panel}>
            <View style={s.buttons}>
              {p.buttons.map((b) => (
                <Pressable key={b.label} disabled={b.disabled} onPress={b.onPress}
                  style={({ pressed }) => [s.btn, b.big && s.big, b.on && s.btnOn, (pressed || b.disabled) && { opacity: 0.5 }]}>
                  <Icon name={b.icon} size={b.big ? 30 : 24} color={b.color ?? '#e5e7eb'} />
                  <Text style={[s.btnText, b.color ? { color: b.color } : null]} numberOfLines={2}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.panelTitle}>{p.title}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#1a2233', borderBottomWidth: 1, borderBottomColor: '#0b1120' },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: '#111827' },
  tab: { paddingHorizontal: 10, paddingVertical: 7, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  tabOn: { backgroundColor: '#1a2233' },
  tabText: { color: C.dim, fontSize: 12, fontWeight: '600' },
  panels: { paddingHorizontal: 4, paddingTop: 4 },
  panel: { borderRightWidth: 1, borderRightColor: '#2b3548', paddingHorizontal: 4, alignItems: 'center' },
  buttons: { flexDirection: 'row', gap: 2 },
  btn: { width: 58, alignItems: 'center', paddingVertical: 4, borderRadius: 6, gap: 2 },
  big: { width: 66 },
  btnOn: { backgroundColor: '#1e3a5f' },
  btnText: { color: '#e5e7eb', fontSize: 10, textAlign: 'center' },
  panelTitle: { color: C.dim, fontSize: 9, paddingVertical: 2, letterSpacing: 0.4 },
});
