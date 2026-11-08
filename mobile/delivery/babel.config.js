module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['module:@react-native/babel-preset', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      ['module:react-native-dotenv', { moduleName: '@env', path: '.env', safe: false, allowUndefined: true }],
      ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
    ],
  };
};
