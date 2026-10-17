// Technical drawing: projects a part or assembly into standard views (1st angle / ABNT),
// lays them out on an A4/A3 sheet with overall dimensions and a title block, and exports
// PDF, SVG or DXF (or sends the views to the 2D editor).
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Drawing, Entity, emptyDrawing, toDXF, uid } from './cad';
import { nextReq, toEnginePart, useEngine } from './engine';
import { Projection, ProjView } from './part';
import { useWorkspace } from './store';
import { Btn, C, Choice, NumField, TextField, u } from './ui';

const SHEETS = { A4: [297, 210], A3: [420, 297] } as const;
const SCALES = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
const VIEW_LABEL: Record<ProjView, string> = { front: 'Frontal', top: 'Superior', left: 'Lateral esq.', right: 'Lateral dir.', iso: 'Isométrica' };
// first-angle (ABNT/ISO E): top view below the front view, left view to the right of it
const CELL: Record<ProjView, [number, number]> = { front: [0, 0], top: [0, 1], left: [1, 0], right: [1, 0], iso: [1, 1] };

const scaleLabel = (s: number) => (s >= 1 ? `${s}:1` : `1:${Math.round(1 / s)}`);

type Line2 = { pts: [number, number][]; kind: 'visible' | 'hidden' | 'dim' | 'frame' };
type Txt = { x: number; y: number; s: string; size: number; anchor?: 'start' | 'middle' | 'end'; rotate?: boolean };

// Builds the sheet as lines + texts in sheet millimetres (origin top-left, y down).
function layout(views: Projection[], size: 'A4' | 'A3', fixed: number | null, info: { title: string; author: string; material: string; mass: string }) {
  const [W, H] = SHEETS[size];
  const lines: Line2[] = [];
  const texts: Txt[] = [];
  const m = 10, tbH = 32;
  const area = { x: m, y: m, w: W - 2 * m, h: H - 2 * m - tbH };
  const cw = area.w / 2, ch = area.h / 2;
  const fits = (s: number) => views.every((v) => (v.max[0] - v.min[0]) * s <= cw * 0.72 && (v.max[1] - v.min[1]) * s <= ch * 0.68);
  const scale = fixed ?? SCALES.find(fits) ?? SCALES[SCALES.length - 1];

  lines.push({ kind: 'frame', pts: [[m, m], [W - m, m], [W - m, H - m], [m, H - m], [m, m]] });
  for (const v of views) {
    const [cx, cy] = CELL[v.view];
    const ox = area.x + cw * cx + cw / 2 - ((v.min[0] + v.max[0]) / 2) * scale;
    const oy = area.y + ch * cy + ch / 2 + ((v.min[1] + v.max[1]) / 2) * scale;
    const P = (p: [number, number]): [number, number] => [ox + p[0] * scale, oy - p[1] * scale];
    v.visible.forEach((pl) => lines.push({ kind: 'visible', pts: pl.map(P) }));
    if (v.view !== 'iso') v.hidden.forEach((pl) => lines.push({ kind: 'hidden', pts: pl.map(P) }));
    const [x0, y1] = P(v.min), [x1, y0] = P(v.max);
    texts.push({ x: (x0 + x1) / 2, y: Math.min(y1 + 14, area.y + ch * (cy + 1) - 2), s: VIEW_LABEL[v.view], size: 3, anchor: 'middle' });
    if (v.view === 'iso') continue;
    // overall dimensions: width under the view, height on its left
    const w = v.max[0] - v.min[0], h = v.max[1] - v.min[1];
    const dy = y1 + 6, dx = x0 - 6;
    const tick = (x: number, y: number, vert: boolean) => lines.push({ kind: 'dim', pts: vert ? [[x - 1, y + 1], [x + 1, y - 1]] : [[x - 1, y + 1], [x + 1, y - 1]] });
    if (v.view !== 'left' && v.view !== 'right' && w > 1e-6) {
      lines.push({ kind: 'dim', pts: [[x0, y1 + 1], [x0, dy + 1.5]] }, { kind: 'dim', pts: [[x1, y1 + 1], [x1, dy + 1.5]] }, { kind: 'dim', pts: [[x0, dy], [x1, dy]] });
      tick(x0, dy, false); tick(x1, dy, false);
      texts.push({ x: (x0 + x1) / 2, y: dy - 1, s: fmtDim(w), size: 3, anchor: 'middle' });
    }
    if (v.view !== 'top' && h > 1e-6) {
      lines.push({ kind: 'dim', pts: [[x0 - 1, y0], [dx - 1.5, y0]] }, { kind: 'dim', pts: [[x0 - 1, y1], [dx - 1.5, y1]] }, { kind: 'dim', pts: [[dx, y0], [dx, y1]] });
      tick(dx, y0, true); tick(dx, y1, true);
      texts.push({ x: dx - 1, y: (y0 + y1) / 2, s: fmtDim(h), size: 3, anchor: 'middle', rotate: true });
    }
    if (v.view === 'top' && h > 1e-6) {
      const rx = x1 + 6;
      lines.push({ kind: 'dim', pts: [[x1 + 1, y0], [rx + 1.5, y0]] }, { kind: 'dim', pts: [[x1 + 1, y1], [rx + 1.5, y1]] }, { kind: 'dim', pts: [[rx, y0], [rx, y1]] });
      tick(rx, y0, true); tick(rx, y1, true);
      texts.push({ x: rx + 4, y: (y0 + y1) / 2, s: fmtDim(h), size: 3, anchor: 'middle', rotate: true });
    }
  }

  // title block (bottom-right)
  const tw = 170, tx = W - m - tw, ty = H - m - tbH;
  lines.push({ kind: 'frame', pts: [[tx, ty], [W - m, ty], [W - m, H - m], [tx, H - m], [tx, ty]] });
  for (const yy of [ty + 12, ty + 22]) lines.push({ kind: 'frame', pts: [[tx, yy], [W - m, yy]] });
  for (const xx of [tx + 85, tx + 125]) lines.push({ kind: 'frame', pts: [[xx, ty + 12], [xx, H - m]] });
  const date = new Date().toLocaleDateString('pt-BR');
  texts.push(
    { x: tx + 3, y: ty + 4.5, s: 'TÍTULO', size: 2 }, { x: tx + 3, y: ty + 10, s: info.title || 'Sem título', size: 5 },
    { x: tx + 3, y: ty + 15.5, s: 'DESENHISTA', size: 2 }, { x: tx + 3, y: ty + 20.5, s: info.author || '—', size: 3.2 },
    { x: tx + 88, y: ty + 15.5, s: 'DATA', size: 2 }, { x: tx + 88, y: ty + 20.5, s: date, size: 3.2 },
    { x: tx + 128, y: ty + 15.5, s: 'ESCALA', size: 2 }, { x: tx + 128, y: ty + 20.5, s: scaleLabel(scale), size: 3.2 },
    { x: tx + 3, y: ty + 25.5, s: 'MATERIAL', size: 2 }, { x: tx + 3, y: ty + 30, s: info.material || '—', size: 3.2 },
    { x: tx + 88, y: ty + 25.5, s: 'MASSA', size: 2 }, { x: tx + 88, y: ty + 30, s: info.mass || '—', size: 3.2 },
    { x: tx + 128, y: ty + 25.5, s: `${size} · 1º DIEDRO · mm`, size: 2.4 },
  );
  return { W, H, lines, texts, scale };
}

const fmtDim = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function toSvg(l: ReturnType<typeof layout>, units = true) {
  const style: Record<Line2['kind'], string> = {
    visible: 'stroke="#000" stroke-width="0.5"', hidden: 'stroke="#000" stroke-width="0.25" stroke-dasharray="2 1"',
    dim: 'stroke="#000" stroke-width="0.18"', frame: 'stroke="#000" stroke-width="0.7"',
  };
  const body = l.lines.map((x) => `<polyline fill="none" stroke-linejoin="round" ${style[x.kind]} points="${x.pts.map((p) => p.map((k) => k.toFixed(3)).join(',')).join(' ')}"/>`).join('');
  const txt = l.texts.map((t) => `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" font-size="${t.size}" font-family="Helvetica, Arial, sans-serif" text-anchor="${t.anchor ?? 'start'}"${t.rotate ? ` transform="rotate(-90 ${t.x.toFixed(2)} ${t.y.toFixed(2)})"` : ''}>${esc(t.s)}</text>`).join('');
  const dims = units ? `width="${l.W}mm" height="${l.H}mm"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${l.W} ${l.H}"><rect width="${l.W}" height="${l.H}" fill="#fff"/>${body}${txt}</svg>`;
}

// Converts the sheet to a 2D drawing (Y up, mm) for DXF export / the 2D editor.
function toDrawing(l: ReturnType<typeof layout>): Drawing {
  const d = emptyDrawing();
  d.layers = [
    { name: 'Visível', color: '#e5e7eb', visible: true, aci: 7 }, { name: 'Oculta', color: '#60a5fa', visible: true, aci: 5 },
    { name: 'Cotas', color: '#fbbf24', visible: true, aci: 2 }, { name: 'Moldura', color: '#9ca3af', visible: true, aci: 8 },
  ];
  d.current = 'Visível';
  const layer = { visible: 'Visível', hidden: 'Oculta', dim: 'Cotas', frame: 'Moldura' } as const;
  const P = ([x, y]: [number, number]) => ({ x, y: l.H - y });
  const es: Entity[] = l.lines.map((x) => ({ id: uid(), layer: layer[x.kind], type: 'pline', pts: x.pts.map(P), closed: false }));
  l.texts.forEach((t) => es.push({ id: uid(), layer: 'Cotas', type: 'text', p: P([t.x - (t.anchor === 'middle' ? t.s.length * t.size * 0.3 : 0), t.y]), h: t.size, text: t.s }));
  return { ...d, entities: es };
}

export default function DrawingSheet({ onOpen2D }: { onOpen2D: () => void }) {
  const { ws, update } = useWorkspace();
  const engine = useEngine();
  const { width } = useWindowDimensions();
  const st = ws.sheet;
  const [views, setViews] = useState<Projection[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const setSheet = (patch: Partial<typeof st>) => update((w) => ({ ...w, sheet: { ...w.sheet, ...patch } }));

  const part = ws.parts.find((p) => p.id === st.source);
  const asm = ws.assemblies.find((a) => a.id === st.source);
  const sourceName = part?.name ?? asm?.name ?? '';

  const generate = async () => {
    if (!part && !asm) return setError('Escolha uma peça ou montagem');
    setBusy(true); setError('');
    if (part) engine.send({ type: 'part', part: toEnginePart(part), selected: null, rollback: null, pick: null, highlight: [] });
    else {
      const parts = ws.parts.filter((p) => asm!.components.some((c) => c.part === p.id)).map(toEnginePart);
      engine.send({ type: 'assembly', asm: asm!, parts, selected: null, pick: false, highlight: [] });
    }
    const r = await engine.request({ type: 'project', req: nextReq(), scope: part ? 'part' : 'assembly', views: st.views as ProjView[] }, 'project');
    setBusy(false);
    if (r.error || !r.views) { setViews(null); setError(r.error ?? 'Falha'); } else setViews(r.views);
  };

  useEffect(() => { if (engine.ready) generate(); }, [engine.ready, st.source, st.views.join()]);

  const sheet = useMemo(() => views && layout(views, st.size, st.scale, {
    title: st.title || sourceName, author: st.author, material: part?.material.name ?? (asm ? 'Conforme lista' : ''), mass: '',
  }), [views, st, sourceName]);
  const svg = useMemo(() => sheet && toSvg(sheet, false), [sheet]);

  const share = async (name: string, content: string, mime: string) => {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
    await f.write(content);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
  };

  const exportPdf = async () => {
    if (!sheet) return;
    try {
      const pt = (mm: number) => Math.round((mm / 25.4) * 72);
      const { uri } = await Print.printToFileAsync({
        html: `<html><head><style>@page{size:${sheet.W}mm ${sheet.H}mm;margin:0}body{margin:0}</style></head><body>${toSvg(sheet)}</body></html>`,
        width: pt(sheet.W), height: pt(sheet.H),
      });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Desenho PDF' });
    } catch (e) { Alert.alert('PDF', String(e)); }
  };

  const viewW = (width - 16) * zoom;
  const base = (st.title || sourceName || 'desenho').replace(/[^\w\-]+/g, '_');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ maxHeight: 210 }} contentContainerStyle={{ padding: 8, gap: 6 }} keyboardShouldPersistTaps="handled">
        <Choice label="Origem" value={st.source} options={[...ws.parts.map((p) => [p.id, `Peça: ${p.name}`] as [string, string]), ...ws.assemblies.map((a) => [a.id, `Montagem: ${a.name}`] as [string, string])]} onChange={(source) => setSheet({ source })} />
        <Choice multi label="Vistas" value={st.views} options={(['front', 'top', 'left', 'iso'] as ProjView[]).map((v) => [v, VIEW_LABEL[v]])} onChange={(views) => setSheet({ views })} />
        <Choice label="Folha" value={st.size} options={[['A4', 'A4 paisagem'], ['A3', 'A3 paisagem']]} onChange={(size) => setSheet({ size })} />
        <Choice label="Escala" value={st.scale === null ? 'auto' : String(st.scale)} options={[['auto', 'Auto'], ...SCALES.map((s) => [String(s), scaleLabel(s)] as [string, string])]} onChange={(v) => setSheet({ scale: v === 'auto' ? null : +v })} />
        <TextField label="Título" value={st.title} onChange={(title) => setSheet({ title })} />
        <TextField label="Desenhista" value={st.author} onChange={(author) => setSheet({ author })} />
      </ScrollView>
      <View style={u.bar}>
        <Btn small label={busy ? 'Gerando…' : '↻ Atualizar'} onPress={generate} disabled={busy} />
        <Btn small label="−" onPress={() => setZoom((z) => Math.max(1, z / 1.5))} />
        <Btn small label="+" onPress={() => setZoom((z) => Math.min(6, z * 1.5))} />
        <Btn small label="PDF" onPress={exportPdf} disabled={!sheet} />
        <Btn small label="DXF" onPress={() => sheet && share(`${base}.dxf`, toDXF(toDrawing(sheet)), 'application/dxf')} disabled={!sheet} />
        <Btn small label="SVG" onPress={() => sheet && share(`${base}.svg`, toSvg(sheet), 'image/svg+xml')} disabled={!sheet} />
        <Btn small label="Abrir no 2D" disabled={!sheet} onPress={() => Alert.alert('Abrir no Desenho 2D', 'Substituir o conteúdo do Desenho 2D pelas vistas?', [
          { text: 'Cancelar' }, { text: 'Substituir', style: 'destructive', onPress: () => { update((w) => ({ ...w, drawing: toDrawing(sheet!) })); onOpen2D(); } },
        ])} />
      </View>
      {!!error && <Text style={[u.err, { paddingHorizontal: 8 }]}>{error}</Text>}
      {!engine.ready && <Text style={u.hint}>Carregando motor 3D…</Text>}
      <ScrollView style={{ flex: 1, backgroundColor: '#374151' }} contentContainerStyle={{ padding: 8 }}>
        <ScrollView horizontal>
          {svg ? <SvgXml xml={svg} width={viewW} height={(viewW * sheet!.H) / sheet!.W} /> : <Text style={{ color: C.dim, padding: 16 }}>{busy ? 'Projetando vistas…' : 'Sem vistas'}</Text>}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

export const _test = { layout, toSvg, toDrawing };
