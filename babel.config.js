module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle migrations (drizzle/*.sql) are bundled as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
