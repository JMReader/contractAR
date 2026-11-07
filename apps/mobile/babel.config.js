module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 58) ya incluye el plugin de worklets/reanimated;
    // lo declaramos explícito por si la resolución automática falla.
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
