// Architecture rules (HAN-126). Layers, top to bottom:
//   pages (+ App, main)  →  components / hooks / stores / contexts  →  api / auth  →  lib / types / const / i18n
// A layer may import its own layer and anything below it, never above.
// Tests and src/test helpers are exempt from layering (they wire everything together).

const TESTS = '(\\.test\\.tsx?$|^src/test/)';
const BOTTOM = '^src/(lib|types|const|i18n)/';
const API = '^src/(api|auth)/';
const SHARED = '^src/(components|hooks|stores|contexts)/';
const TOP = '^src/(pages/|App\\.tsx$|main\\.tsx$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports. Extract the shared part into a lower layer.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'layers-bottom-is-leaf',
      severity: 'error',
      comment:
        'lib/types/const/i18n are the bottom layer: they cannot import api, auth, components, hooks, stores, contexts or pages. Move the code up or pass the value in.',
      from: { path: BOTTOM, pathNot: TESTS },
      to: { path: `${API}|${SHARED}|${TOP}` },
    },
    {
      name: 'layers-api-below-ui',
      severity: 'error',
      comment:
        'api/auth cannot import components, hooks, stores, contexts or pages. Return data; let the hook or component decide what to show.',
      from: { path: API, pathNot: TESTS },
      to: { path: `${SHARED}|${TOP}` },
    },
    {
      name: 'layers-shared-below-pages',
      severity: 'error',
      comment:
        'components/hooks/stores/contexts cannot import a page. Move the shared part into components/, hooks/ or lib/.',
      from: { path: SHARED, pathNot: TESTS },
      to: { path: TOP },
    },
    {
      name: 'no-page-to-page',
      severity: 'error',
      comment:
        'A page cannot import another page. Move the shared part into components/ or lib/.',
      from: { path: '^src/pages/([^/]+)/' },
      to: { path: '^src/pages/', pathNot: '^src/pages/$1/' },
    },
    {
      name: 'ui-is-leaf',
      severity: 'error',
      comment:
        'components/ui is the design-system layer: it may import only lib/ and packages. Pass app data in through props.',
      from: { path: '^src/components/ui/', pathNot: TESTS },
      to: { path: '^src/', pathNot: '^src/(lib|components/ui)/' },
    },
    {
      name: 'axios-only-in-api',
      severity: 'error',
      comment:
        'axios is used only in src/api/ and src/auth/apiClient.ts. Call an api/ client instead.',
      from: { pathNot: `^src/api/|^src/auth/apiClient\\.ts$|${TESTS}` },
      to: { path: 'node_modules/axios/' },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'File is not imported by anything. Delete it or import it.',
      from: {
        orphan: true,
        pathNot: [
          '^src/main\\.tsx$',
          TESTS,
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(c|m)?js$',
          '\\.config\\.(c|m)?(js|ts)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: ['^src/', 'node_modules/axios/'],
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.d.ts'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
