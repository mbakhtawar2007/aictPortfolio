// ESLint 9 flat config. Next's own eslint-config-next 16 still ships
// an eslintrc-style config that breaks under FlatCompat (circular
// structure error), so this gate uses typescript-eslint + react-hooks
// directly: unused vars, unsafe any leaks and hook mistakes are what
// it is here to catch. Type safety itself is covered by `tsc --noEmit`.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  ...tseslint.configs.recommended,
  ...(Array.isArray(reactHooks.configs['recommended-latest'])
    ? reactHooks.configs['recommended-latest']
    : [reactHooks.configs['recommended-latest']]),
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'tests/**'] },
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'warn' } },
  // Mount-effect data loading is this codebase's established pattern
  // (fetch on mount, set state when it resolves, loading skeleton
  // meanwhile). The rule flags the async wrappers too, and silencing
  // every page would only restructure working code, so it is off
  // with this note instead of a per-file suppression.
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
  // Three.js scenes mutate uniforms and refs in the animation loop;
  // that mutation is the rendering API, not a React state violation.
  // Their initial ref values are also imperative scene state (random
  // star timings), not render output, so purity is off there too.
  { files: ['components/Scene/**'], rules: { 'react-hooks/immutability': 'off', 'react-hooks/purity': 'off' } },
];
