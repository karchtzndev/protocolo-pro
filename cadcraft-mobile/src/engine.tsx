// Bridge to the 3D engine WebView. One WebView (one OpenCascade instance) is shared by every
// 3D screen: screens place a <Viewport/> and the WebView is positioned over it; when no
// viewport is mounted the WebView is parked off-screen but stays alive.
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { EnginePart, FromEngine, PartDoc, ToEngine } from './part';
import { profilesFromDrawing } from './cad';
import { useWorkspace } from './store';

type Rect = { x: number; y: number; w: number; h: number };
type Listener = (m: FromEngine) => void;
type Ctx = {
  ready: boolean;
  status: string;
  send: (m: ToEngine) => void;
  request: <T extends FromEngine['type']>(m: ToEngine & { req: number }, type: T) => Promise<Extract<FromEngine, { type: T }>>;
  listen: (fn: Listener) => () => void;
  setRect: (r: Rect | null) => void;
  rootRef: React.RefObject<any>;
};
const EngineContext = createContext<Ctx | null>(null);
export const useEngine = () => useContext(EngineContext)!;

let reqSeq = 1;
export const nextReq = () => reqSeq++;

export const toEnginePart = (p: PartDoc): EnginePart => ({
  id: p.id, color: p.color, features: p.features,
  sketches: p.sketches.map((s) => ({ id: s.id, plane: s.plane, offset: s.offset, profiles: profilesFromDrawing(s.drawing) })),
});

// Copies the engine page and wasm out of the app bundle into a folder the WebView can read.
// On web the bundled asset URLs are used directly (the engine runs in an iframe).
async function prepareEngine(): Promise<string> {
  if (Platform.OS === 'web') {
    const [html, wasm] = [Asset.fromModule(require('../assets/engine/engine.html')), Asset.fromModule(require('../assets/engine/occt.wasm'))];
    const abs = (u: string) => new URL(u, window.location.href).href;
    return `${abs(html.uri)}${html.uri.includes('?') ? '&' : '?'}wasm=${encodeURIComponent(abs(wasm.uri))}`;
  }
  const dir = new Directory(Paths.document, 'engine');
  if (!dir.exists) dir.create({ intermediates: true });
  const [html, wasm] = await Asset.loadAsync([require('../assets/engine/engine.html'), require('../assets/engine/occt.wasm')]);
  for (const [asset, name] of [[html, 'engine.html'], [wasm, 'occt.wasm']] as const) {
    const dest = new File(dir, name);
    const marker = new File(dir, name + '.hash');
    if (dest.exists && marker.exists && marker.textSync() === asset.hash) continue;
    if (dest.exists) dest.delete();
    await new File(asset.localUri!).copy(dest);
    marker.write(asset.hash ?? '');
  }
  return dir.uri;
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const { readStep } = useWorkspace();
  const [dirUri, setDirUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Preparando motor 3D…');
  const [rect, setRect] = useState<Rect | null>(null);
  const web = useRef<any>(null); // WebView's typings don't expose its ref methods
  const listeners = useRef(new Set<Listener>());
  const queue = useRef<string[]>([]);
  const rootRef = useRef<any>(null);

  useEffect(() => {
    prepareEngine().then(setDirUri).catch((e) => setStatus('Falha ao preparar motor 3D: ' + e));
  }, []);

  const inject = (s: string) => {
    if (Platform.OS === 'web') web.current?.contentWindow?.postMessage(s, '*');
    else web.current?.injectJavaScript(`window.cadEngine && window.cadEngine.send(${JSON.stringify(s)});true;`);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e: MessageEvent) => { if (e.source === web.current?.contentWindow) onMessage({ nativeEvent: { data: e.data } } as any); };
    window.addEventListener('message', fn);
    return () => window.removeEventListener('message', fn);
  });

  const ctx = useMemo<Ctx>(() => ({
    ready, status, rootRef, setRect,
    send: (m) => {
      const s = JSON.stringify(m);
      if (ready) inject(s); else queue.current.push(s);
    },
    request: (m, type) => new Promise((resolve) => {
      const off = ctx.listen((r: any) => {
        if (r.type === type && r.req === m.req) { off(); resolve(r); }
      });
      ctx.send(m);
    }),
    listen: (fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); },
  }), [ready, status]);

  const onMessage = async (e: WebViewMessageEvent) => {
    let m: FromEngine;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') {
      setReady(true);
      setStatus('');
      queue.current.splice(0).forEach(inject);
    }
    if (m.type === 'log') setStatus(m.msg);
    if (m.type === 'needFile') {
      const b64 = await readStep(m.id);
      if (b64) inject(JSON.stringify({ type: 'file', id: m.id, base64: b64 }));
    }
    listeners.current.forEach((fn) => fn(m));
  };

  const style: ViewStyle = rect
    ? { position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }
    : { position: 'absolute', left: -2000, top: 0, width: 300, height: 300 };

  return (
    <EngineContext.Provider value={ctx}>
      <View ref={rootRef} style={{ flex: 1 }} collapsable={false}>
        {children}
        {dirUri && Platform.OS === 'web' && (
          <View style={style} pointerEvents={rect ? 'auto' : 'none'}>
            <iframe ref={web} src={dirUri} style={{ border: 0, width: '100%', height: '100%' }} />
          </View>
        )}
        {dirUri && Platform.OS !== 'web' && (
          <View style={style} pointerEvents={rect ? 'auto' : 'none'}>
            <WebView
              ref={web}
              source={{ uri: dirUri + 'engine.html' }}
              originWhitelist={['*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              allowingReadAccessToURL={dirUri}
              onMessage={onMessage}
              style={{ backgroundColor: '#0b1120' }}
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              javaScriptEnabled
              onContentProcessDidTerminate={() => { setReady(false); web.current?.reload(); }}
              onRenderProcessGone={() => { setReady(false); web.current?.reload(); }}
            />
          </View>
        )}
      </View>
    </EngineContext.Provider>
  );
}

// Placeholder that the shared engine WebView is laid over.
export function Viewport({ children }: { children?: ReactNode }) {
  const { setRect, rootRef, ready, status } = useEngine();
  const ref = useRef<any>(null);
  const measure = () => {
    const root = rootRef.current, me = ref.current;
    if (!root || !me) return;
    me.measureLayout(root as any, (x: number, y: number, w: number, h: number) => setRect({ x, y, w, h }), () => {});
  };
  useEffect(() => () => setRect(null), []);
  return (
    <View ref={ref} style={{ flex: 1, backgroundColor: '#0b1120' }} onLayout={measure} collapsable={false}>
      {!ready && <Text style={{ color: '#9ca3af', alignSelf: 'center', marginTop: '40%', textAlign: 'center', padding: 16 }}>{status || 'Carregando motor 3D…'}</Text>}
      {children}
    </View>
  );
}

