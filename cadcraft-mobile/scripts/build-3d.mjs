// Bundles web3d/engine.ts (three.js + replicad) into assets/engine/engine.html and copies the
// OpenCascade wasm next to it. The app copies both into its documents folder and opens the page
// in react-native-webview, so the 3D modeler works offline. Run: npm run build:3d
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('assets/engine', { recursive: true });
const out = await build({
  entryPoints: ['web3d/engine.ts'],
  bundle: true, minify: true, write: false, format: 'iife', platform: 'browser', target: 'es2020',
  define: { 'import.meta.url': '"file:///"' },
  external: ['node:*'],
  logLevel: 'warning',
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;height:100%;overflow:hidden;background:#0b1120;touch-action:none}canvas{display:block}</style></head><body><script>${js}</script></body></html>`;
writeFileSync('assets/engine/engine.html', html);
copyFileSync('node_modules/replicad-opencascadejs/dist/replicad_single.wasm', 'assets/engine/occt.wasm');
console.log(`engine.html: ${(html.length / 1024).toFixed(0)} KB + occt.wasm`);
