// Workspace persistence: one JSON document (2D drawing, parts, assemblies, sheet settings) in the
// app's documents folder, plus imported STEP files stored beside it.
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drawing, emptyDrawing, uid } from './cad';
import { AssemblyDoc, PartDoc, emptyAssembly, emptyPart } from './part';

export type SheetSettings = { source: string; views: string[]; size: 'A4' | 'A3'; title: string; author: string; scale: number | null };

export type Workspace = {
  drawing: Drawing;
  parts: PartDoc[];
  assemblies: AssemblyDoc[];
  activePart: string;
  activeAsm: string;
  sheet: SheetSettings;
};

const initial = (): Workspace => {
  const p = emptyPart(uid(), 'Peça1');
  const a = emptyAssembly(uid(), 'Montagem1');
  return {
    drawing: emptyDrawing(), parts: [p], assemblies: [a], activePart: p.id, activeAsm: a.id,
    sheet: { source: p.id, views: ['front', 'top', 'left', 'iso'], size: 'A4', title: '', author: '', scale: null },
  };
};

const wsFile = () => new File(Paths.document, 'workspace.json');
const filesDir = () => new Directory(Paths.document, 'files');

type Ctx = {
  ws: Workspace;
  update: (fn: (w: Workspace) => Workspace) => void;
  saveStep: (base64: string) => string;
  readStep: (id: string) => Promise<string | null>;
};
const WsContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      let w: Workspace | null = null;
      try {
        const raw = Platform.OS === 'web' ? localStorage.getItem('cadcraft.workspace') : wsFile().exists ? await wsFile().text() : null;
        if (raw) w = { ...initial(), ...JSON.parse(raw) };
      } catch {}
      if (!w) {
        // migrate the 2D drawing saved by the first version of the app
        w = initial();
        try {
          const old = await AsyncStorage.getItem('cadcraft.drawing.v1');
          if (old) w.drawing = { ...emptyDrawing(), ...JSON.parse(old) };
        } catch {}
      }
      setWs(w);
    })();
  }, []);

  useEffect(() => {
    if (!ws) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        if (Platform.OS === 'web') localStorage.setItem('cadcraft.workspace', JSON.stringify(ws));
        else wsFile().write(JSON.stringify(ws));
      } catch {}
    }, 400);
  }, [ws]);

  if (!ws) return null;
  const value: Ctx = {
    ws,
    update: (fn) => setWs((w) => (w ? fn(w) : w)),
    saveStep: (base64) => {
      const id = uid();
      const dir = filesDir();
      if (!dir.exists) dir.create({ intermediates: true });
      new File(dir, `${id}.b64`).write(base64);
      return id;
    },
    readStep: async (id) => {
      const f = new File(filesDir(), `${id}.b64`);
      return f.exists ? f.text() : null;
    },
  };
  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export const useWorkspace = () => useContext(WsContext)!;

export function updatePart(w: Workspace, id: string, fn: (p: PartDoc) => PartDoc): Workspace {
  return { ...w, parts: w.parts.map((p) => (p.id === id ? fn(p) : p)) };
}
export function updateAsm(w: Workspace, id: string, fn: (a: AssemblyDoc) => AssemblyDoc): Workspace {
  return { ...w, assemblies: w.assemblies.map((a) => (a.id === id ? fn(a) : a)) };
}
