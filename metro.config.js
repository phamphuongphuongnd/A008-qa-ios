const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Drizzle migrations are .sql files imported as strings (babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

// Inline requires: a module's body runs the first time it is used instead of at bundle load (faster cold start).
const getTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const base = getTransformOptions ? await getTransformOptions(...args) : {};
  return { ...base, transform: { ...base.transform, inlineRequires: true } };
};

module.exports = config;
