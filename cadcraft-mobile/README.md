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
