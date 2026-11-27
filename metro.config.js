const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);
// Transform cache inside this project, never the machine-wide %TEMP%\metro-cache: other apps on this machine have a
// byte-identical drizzle/migrations.js, and inline-import (below) bakes the .sql into the cached output — a shared cache
// once shipped A007's tables in this app's release bundle ("no such table: rentals", 2026-11-27).
config.cacheStores = [new FileStore({ root: path.join(__dirname, '.metro-cache') })];
// Drizzle migrations are .sql files imported as strings (babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

// Inline requires: a module's body runs the first time it is used instead of at bundle load (faster cold start).
const getTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const base = getTransformOptions ? await getTransformOptions(...args) : {};
  return { ...base, transform: { ...base.transform, inlineRequires: true } };
};

module.exports = config;
