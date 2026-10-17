# CADCraft Mobile

CAD para iOS e Android (Expo / React Native): desenho 2D estilo AutoCAD + modelagem 3D
paramétrica, montagens e desenho técnico estilo Inventor. Funciona offline.

## Abas
**2D** — linha, polilinha, retângulo, círculo, arco, texto, mover, apagar, medir; linha de comando
(`L`, `PL`, `REC`, `C`, `A`, `D`, `R`, `M`, `E`, `DI`, `T`, `U`, `Z`), coordenadas `10,20` `@5,0` `@10<45`,
OSNAP, grade, ORTHO, camadas, desfazer/refazer, exportar DXF.
- **Restrições**: horizontal, vertical, coincidente, paralela, perpendicular, igual, tangente,
  concêntrica, fixar — com solver (Levenberg–Marquardt) e contagem de graus de liberdade.
- **Cotas paramétricas**: comprimento, distância entre pontos, raio/diâmetro, ângulo. Mudar o valor
  redimensiona a geometria. Restrições automáticas ao desenhar (retângulo H/V, pontas encadeadas).
- Linhas de construção (ignoradas nos perfis).

**Peça** — navegador do modelo com esboços (editados no 2D, planos XY/XZ/YZ com deslocamento) e
árvore de features paramétricas (editar, suprimir, reordenar):
extrusão, revolução, loft, caixa, cilindro, cone, esfera, furo (com rebaixo), **filete**, **chanfro**
(arestas tocadas no modelo ou por regra: todas/topo/base/verticais/circulares), **casca** (faces tocadas),
padrão retangular/circular, espelhar, unir/cortar/interseção, **importar STEP**.
Material e cor por peça, massa, volume, área. Exporta **STEP** e **STL**. Várias peças por projeto.

**Montagem** — insere peças como componentes, fixa (⚓), posiciona/rotaciona, restrições tocando nas
faces: face com face, faces niveladas, eixos coincidentes, ponto com ponto (com afastamento).
Detecção de interferências, lista de peças com massa, exporta STEP (com nomes e cores) e STL.

**Folha** — desenho técnico em A4/A3 (1º diedro/ABNT): vistas frontal, superior, lateral e
isométrica com linhas ocultas, cotas gerais, escala automática e legenda. Exporta PDF, DXF, SVG ou
abre as vistas no 2D.

## Arquitetura
- `src/cad.ts` — modelo 2D, snaps, solver de restrições, perfis fechados, DXF.
- `src/part.ts` — modelo de peças/montagens e mensagens do motor.
- `web3d/engine.ts` — motor 3D: [OpenCascade](https://dev.opencascade.org/) via
  [replicad](https://replicad.xyz) (B-rep: booleanas, filetes, casca, STEP, projeções HLR) + three.js.
  Roda num WebView (iframe na web); `scripts/build-3d.mjs` gera `assets/engine/` (roda no `npm install`).
- `src/engine.tsx` — ponte com o WebView, compartilhado por todas as telas 3D.
- `src/store.tsx` — projeto salvo em `workspace.json` (documentos do app).

O OpenCascade é LGPL-2.1: o `.wasm` é distribuído como arquivo separado e não modificado
(`assets/engine/occt.wasm`), o que permite substituí-lo. Inclua a menção à licença na tela "Sobre"/loja.

## Rodar
```bash
npm install          # também gera o motor 3D
npx expo start       # Expo Go, emulador, ou "w" para web
```
Teste do motor (opcional): `npm i -D playwright && npx tsx scripts/engine-test.ts`.

## Publicar nas lojas
1. Troque `com.seuapp.cadcraft` em `app.json` pelo seu identificador e os ícones em `assets/`.
2. `npm i -g eas-cli && eas login && eas init`
3. `eas build -p android --profile production` e `eas build -p ios --profile production`
4. `eas submit -p android` (Google Play, US$ 25) e `eas submit -p ios` (Apple Developer, US$ 99/ano)
