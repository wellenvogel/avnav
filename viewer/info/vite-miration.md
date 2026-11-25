# Vite/Vitest migration plan

## 1. Define parity targets ✅

- Keep output compatibility for:
  - `build/debug`, `build/release`
  - `avnav_viewer.html`, `avnav_min.js`
  - CSS/assets in expected paths (`images`, `layout`, `settings`, `sounds`, `modules`)
  - generated `license.html`
- Preserve version and suffix behavior (`AVNAV_VERSION`, `SUFFIX`, `_SFX` replacements).

## 2. Introduce Vite in parallel ✅

- Added `vite.config.js` without removing webpack.
- Add scripts:
  - `vite:dev`
  - `vite:build`
  - `vite:preview`
- First target output: `build/debug-vite` to compare artifacts safely.
- Added parallel entry files:
  - `index-vite.html`
  - `vite-main.js`
  - `version.vite.js`

## 3. Port webpack-specific build logic

- Replace `CopyWebpackPlugin` rules, including transformed copy from `static/`.
- Replace `GenerateFilePlugin` + `collectLicense.js` for `license.html`.
- Replace `val-loader` (`version.js`) with Vite define/plugin or prebuild-generated module.
- Ensure `avnav_viewer.html` template behavior remains equivalent.
- Verify maplibre worker bundling/URL handling.

## 4. Align style and asset handling

- Reproduce LESS and CSS-module behavior.
- Specifically validate imports from:
  - `style/icons.less`
  - `style/button_text.less`
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
