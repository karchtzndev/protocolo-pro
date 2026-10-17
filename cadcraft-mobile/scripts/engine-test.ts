// End-to-end test of the 3D engine in headless Chromium (dev only, needs `npm i -D playwright`):
//   npm run build:3d && npx tsx scripts/engine-test.ts
// @ts-nocheck
import { chromium } from 'playwright';
import { emptyDrawing, profilesFromDrawing, arcFrom3, Drawing } from '../src/cad';
import type { EnginePart } from '../src/part';

const sk = (id: string, plane: any, offset: number, d: Drawing) => ({ id, plane, offset, profiles: profilesFromDrawing(d) });
const rect = (x: number, y: number, w: number, h: number): Drawing => ({ ...emptyDrawing(), entities: [{ id: 'r', layer: '0', type: 'pline', closed: true, pts: [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}] }] });
const base = rect(0, 0, 60, 40);
base.entities.push({ id: 'c', layer: '0', type: 'circle', c: { x: 30, y: 20 }, r: 6 });
const a = arcFrom3({x:5,y:0},{x:9,y:10},{x:5,y:20})!;
const prof: Drawing = { ...emptyDrawing(), entities: [
  {id:'1',layer:'0',type:'line',a:{x:0,y:0},b:{x:5,y:0}}, {id:'2',layer:'0',type:'arc',...a},
  {id:'3',layer:'0',type:'line',a:{x:5,y:20},b:{x:0,y:20}}, {id:'4',layer:'0',type:'line',a:{x:0,y:20},b:{x:0,y:0}}] };
const part: EnginePart = { id: 'p1', color: '#94a3b8', sketches: [sk('s1','XY',0,base), sk('s2','XZ',-70,prof), sk('s3','XY',0,rect(80,0,20,20)), sk('s4','XY',30,rect(85,5,10,10))], features: [
  { id:'f1', name:'Ext', type:'extrude', sketch:'s1', distance:12, direction:'normal', op:'join' },
  { id:'f2', name:'Furo', type:'hole', d:5, depth:12, cbd:9, cbdepth:3, x:8, y:8, z:12, axis:'Z' },
  { id:'f3', name:'Pad', type:'rectPattern', ref:'f2', nx:2, dx:44, ny:2, dy:24 },
  { id:'f4', name:'Fil', type:'fillet', radius:3, edges:{ mode:'vertical', points:[] } },
  { id:'f5', name:'Cham', type:'chamfer', distance:1, edges:{ mode:'picked', points:[[30,0,12]] } },
  { id:'f6', name:'Rev', type:'revolve', sketch:'s2', angle:360, axis:'Y', op:'join' },
  { id:'f7', name:'Loft', type:'loft', sketches:['s3','s4'], ruled:'não', op:'join' },
  { id:'f8', name:'Cone', type:'cone', r1:6, r2:2, h:10, x:-20, y:20, z:0, axis:'Z', op:'join' },
  { id:'f9', name:'Bad', type:'fillet', radius:50, edges:{ mode:'all', points:[] } },
]};
const box: EnginePart = { id: 'p2', color: '#ef4444', sketches: [], features: [
  { id:'b1', name:'Caixa', type:'box', w:20, d:20, h:20, x:0, y:0, z:0, op:'join' },
  { id:'b2', name:'Casca', type:'shell', thickness:2, faces:[[10,10,20]] } ] };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 500, height: 500 } });
  const msgs: any[] = [];
  await p.exposeFunction('rec', (m: string) => msgs.push(JSON.parse(m)));
  await p.addInitScript('window.ReactNativeWebView = { postMessage: function (m) { window.rec(m); } };');
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('file://' + process.cwd() + '/assets/engine/engine.html');
  const wait = async (pred: (m: any) => boolean, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { const m = msgs.find(pred); if (m) { msgs.splice(msgs.indexOf(m), 1); return m; } await new Promise(r => setTimeout(r, 100)); } throw new Error('timeout'); };
  const send = (m: any) => p.evaluate('window.cadEngine.send(' + JSON.stringify(JSON.stringify(m)) + ')');
  const clickAt = async (w: number[]) => { const xy = JSON.parse(await p.evaluate(`(function(){ var D = window.__dbg; var v = new D.THREE.Vector3(${w}).project(D.camera); return JSON.stringify([(v.x+1)*250, (1-v.y)*250]); })()`) as string); await p.mouse.click(xy[0], xy[1]); };
  await wait((m) => m.type === 'ready'); console.log('ready');
  let t = Date.now();
  await send({ type: 'part', part, selected: null, rollback: null, pick: null, highlight: [] });
  const r1 = await wait((m) => m.type === 'partResult'); console.log('part', Date.now() - t, 'ms', JSON.stringify(r1));
  await p.screenshot({ path: '/tmp/claude-0/e2e/part.png' });
  // edit one late feature: should reuse cache
  t = Date.now();
  part.features[7] = { ...(part.features[7] as any), h: 14 };
  await send({ type: 'part', part, selected: 'f8', rollback: null, pick: null, highlight: [] });
  const r2 = await wait((m) => m.type === 'partResult'); console.log('rebuild', Date.now() - t, 'ms vol', r2.volume.toFixed(1));
  // picking: rollback to fillet, click the model center
  await send({ type: 'part', part, selected: 'f5', rollback: 'f5', pick: 'edge', highlight: [[30,0,12]] });
  await wait((m) => m.type === 'partResult');
  await send({ type: 'view', name: 'top' }); await new Promise(r => setTimeout(r, 500));
  await clickAt([20, 0, 12]);
  console.log('pick', JSON.stringify(await wait((m) => m.type === 'pick', 5000).catch(() => 'none')));
  await p.screenshot({ path: '/tmp/claude-0/e2e/pick.png' });
  for (const format of ['step', 'stl']) {
    await send({ type: 'export', req: 1, format, scope: 'part' });
    const e = await wait((m) => m.type === 'export'); console.log(format, e.error ?? (e.base64.length + ' b64'));
  }
  await send({ type: 'project', req: 2, scope: 'part', views: ['front', 'top', 'left', 'iso'] });
  const pr = await wait((m) => m.type === 'project'); console.log('proj', pr.error ?? pr.views.map((v: any) => `${v.view}:${v.visible.length}/${v.hidden.length} ${v.min}..${v.max}`).join(' | '));
  // assembly: box shelled, mate its bottom face onto the plate top face, then interference
  const asm = { id: 'a', name: 'M', components: [
    { id: 'c1', part: 'p1', name: 'Base', pos: [0,0,0], rot: [0,0,0], grounded: true, visible: true },
    { id: 'c2', part: 'p2', name: 'Caixa', pos: [10,5,40], rot: [30,0,0], grounded: false, visible: true } ],
    mates: [{ id: 'm1', type: 'mate', a: { comp: 'c1', kind: 'face', point: [50,30,12], normal: [0,0,1] }, b: { comp: 'c2', kind: 'face', point: [10,10,0], normal: [0,0,-1] }, offset: 0 }] };
  t = Date.now();
  await send({ type: 'assembly', asm, parts: [part, box], selected: 'c2', pick: true, highlight: [] });
  const ar = await wait((m) => m.type === 'asmResult'); console.log('asm', Date.now() - t, 'ms', JSON.stringify(ar));
  await p.screenshot({ path: '/tmp/claude-0/e2e/asm.png' });

  await clickAt([45, 25, 12]);
  console.log('asm pick', JSON.stringify(await wait((m) => m.type === 'pick', 5000).catch(() => 'none')));
  await send({ type: 'export', req: 3, format: 'step', scope: 'assembly' });
  const ae = await wait((m) => m.type === 'export'); console.log('asm step', ae.error ?? ae.base64.length);
  await send({ type: 'measure', req: 4, parts: [part, box] });
  console.log('measure', JSON.stringify(await wait((m) => m.type === 'measure')));
  const logs = msgs.filter((m) => m.type === 'log'); if (logs.length) console.log('LOGS', JSON.stringify(logs));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
