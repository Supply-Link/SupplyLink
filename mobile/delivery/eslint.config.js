const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['android/**', 'ios/**', 'node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
