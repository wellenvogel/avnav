# Vite/Vitest migration plan

## 1. Define parity targets ✅

- Keep output compatibility for:
  - `build/debug`, `build/release`
  - `avnav_viewer.html`, `avnav_min.js`
  - CSS/assets in expected paths (`images`, `layout`, `settings`, `sounds`, `modules`)
  - generated `license.html`
- Preserve version and suffix behavior (`AVNAV_VERSION`, `SUFFIX`, `_SFX` replacements).

## 2. Introduce Vite in parallel ✅

- Added `vite.config.mjs` without removing webpack.
- Add scripts:
  - `vite:dev`
  - `vite:build`
  - `vite:preview`
- First target output: `build/debug-vite` to compare artifacts safely.
- Added parallel entry files:
  - `avnav_viewer.html` (Vite entry, replacing temporary `index-vite.html`)
  - `vite-main.js`
  - `version.vite.js`

## 3. Port webpack-specific build logic ✅

- Added Vite build parity plugin that:
  - copies webpack parity artifacts (`layout`, `settings`, `demo/*.xml`, `sounds`, icon subsets, optional `test/static` in debug builds)
  - applies `SUFFIX/_SFX` replacement to copied static text files (except `avnav_viewer.html`, which is now Vite's direct entry)
  - generates `license.html` via `collectLicense.mjs`
- Version replacement is handled by `version.vite.js` + `__AVNAV_VERSION__` define.
- Verified maplibre worker code path remains bundled and referenced by output.

## 4. Align style and asset handling

- Reproduce LESS and CSS-module behavior.
- `style/icons.less` and `style/button_text.less` now export class-name maps in
  both Vite and webpack, with the original unscoped class names. Vite wraps
  these two existing files as CSS modules without renaming them.
- `test/style-exports.ts` checks the button definitions, icon exports, text
  styles, and default/legacy icon assets. In Vite dev mode, run
  `import('/viewer/test/style-exports.ts').then(m => m.runStyleExportTests())`
  in the browser console.
- Check image/icon output paths (`images/default`, `images/legacy`, etc.).

## 5. Cut over main build scripts

- Switch `watch`, `debug`, `production` scripts to Vite after parity is confirmed.
- Keep webpack scripts temporarily as fallback for one stabilization cycle.

## 6. Introduce Vitest in parallel

- Start with pure logic modules (nav/util) in Vitest `node` environment.
- Add `jsdom` for React/UI-focused tests.
- Keep current browser regression harnesses initially.

## 7. Migrate existing regression tests

- Convert each `test/webpack.*.js` bundle-based test to Vitest specs.
- Replace `window.runRegressionTests()` browser-console flow with automated assertions.
- For browser-heavy map behavior, use Vitest browser mode and/or Playwright.

## 8. Finalize and clean up

- Remove webpack configs/dependencies only after parity + stable CI.
- Update test READMEs and developer workflows.
- Add explicit type-check in CI (`tsc --noEmit`) because Vite does not type-check by default.

## Potential problems (high priority)

1. **Build parity gaps** in custom copy/transform and generated files can break runtime silently.
2. **CSS module differences** may break named imports from LESS modules.
3. **Worker/asset URL differences** (maplibre/OpenLayers) can fail only at runtime.
4. **Legacy browser test model** (`window.runRegressionTests`) is not directly unit-test friendly.
5. **CommonJS usage in tests** requires ESM migration for Vitest.
6. **Type-check blind spot** if CI relies on Vite build alone.
7. **Output path/name compatibility** may affect downstream consumers expecting current filenames.
8. **No 1:1 plugin mapping** for some webpack plugins; custom Vite plugins/scripts will be needed.


## Current Browser compatibility
{
"android": "142",
"chrome": "109",
"edge": "140",
"firefox": "143",
"ios": "11",
"opera": "122",
"opera_mobile": "80",
"safari": "12",
"samsung": "28"
}

Vite syntax target is configured as a single floor: `build.target = "es2018"`.