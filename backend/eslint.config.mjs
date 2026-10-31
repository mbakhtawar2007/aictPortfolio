// ESLint 9 flat config for the Node backend (ES modules, no build step).
// The `node --check` lint script still runs as well; this adds unused
// variables, undefined globals and prefer-const checks.
import js from '@eslint/js';
import globals from 'globals';
export default [
  js.configs.recommended,
  { languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } } },
  { ignores: ['node_modules/**'] },
  // Destructuring to omit a field (({ id, ...rest }) => rest) is a
  // deliberate strip, not an unused variable.
  { rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] } },
];
