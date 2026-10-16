# CADCraft Mobile

App de CAD 2D estilo AutoCAD para iOS e Android (Expo / React Native), inspirado no
[CADCraft](https://github.com/storytold/cadcraft).

## Recursos
- Linha, polilinha, retângulo, círculo, texto, mover, apagar, medir distância
- Linha de comando AutoCAD: `L`, `PL`, `REC`, `C`, `M`, `E`, `DI`, `T`, `U`, `REDO`, `Z`
- Coordenadas: `10,20` (absoluta), `@5,0` (relativa), `@10<45` (polar), `25` (distância na direção do cursor)
- OSNAP (extremidade, ponto médio, centro, quadrante), grade com snap, ORTHO
- Camadas com cor e visibilidade; desfazer/refazer; salvamento automático
- Pan/zoom com dois dedos; exportar e compartilhar **DXF**

## Peça 3D (modelagem paramétrica estilo Inventor)
Aba **Peça 3D**: árvore de features recalculada a cada alteração, com parâmetros editáveis,
suprimir/ativar, reordenar e excluir.
- **Esboço**: importa as formas fechadas do desenho 2D para o plano XY, XZ ou YZ (com deslocamento);
  perfis internos viram furos.
- **Extrusão** (normal / invertida / simétrica) e **Revolução** (eixo X ou Y do esboço, ângulo).
- **Primitivas**: caixa, cilindro, esfera. **Furo** por diâmetro/profundidade.
- Operações booleanas **Unir / Cortar / Interseção** em cada feature.
- **Padrão retangular**, **padrão circular** e **espelhar** de uma feature.
- Vistas Iso/Topo/Frente/Direita, órbita/zoom por toque, volume, área e dimensões totais.
- Exporta **STL** (impressão 3D / outros CADs).

Motor: [Manifold](https://github.com/elalish/manifold) (booleanas robustas, WASM) + three.js,
empacotados offline em `src/engine3d.generated.ts`. Ao alterar `web3d/engine.ts`, rode `npm run build:3d`.

Ainda não tem: filete/chanfro, casca, restrições no esboço, montagens, desenho 2D a partir do 3D, STEP.

## Rodar
```bash
npm install
npx expo start      # abra no Expo Go (celular) ou emulador
```

## Publicar nas lojas
1. Troque `com.seuapp.cadcraft` em `app.json` pelo seu identificador; troque os ícones em `assets/`.
2. `npm i -g eas-cli && eas login && eas init`
3. `eas build -p android --profile production` e `eas build -p ios --profile production`
4. `eas submit -p android` (conta Google Play, US$ 25) e `eas submit -p ios` (Apple Developer, US$ 99/ano)
