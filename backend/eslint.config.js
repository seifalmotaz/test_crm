const js      = require('@eslint/js')
const globals = require('globals')

module.exports = [
  { ignores: ['node_modules/**', 'prisma/generated/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals:     { ...globals.node },
      ecmaVersion: 2022,
    },
    rules: {
      'no-console':     'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq:           ['error', 'always'],
    },
  },
]
