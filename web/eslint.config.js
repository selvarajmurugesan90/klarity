import reactHooks from 'eslint-plugin-react-hooks'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['dist/**'] },
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
]
