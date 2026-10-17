// Ships the offline 3D engine (HTML page + OpenCascade wasm) as plain assets.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html', 'wasm');
module.exports = config;
