# Browser compatibility checks

This document describes the compatibility checks added for the viewer.

## Scope

These checks cover:

1. **Web API compatibility in source code** (e.g. unsupported browser APIs)
2. **ECMAScript syntax compatibility in generated bundles**

The browser/API floor is taken from `viewer/package.json` `browserslist`.
The Vite JS syntax floor is a single target: `es2018` (`build.target` in `vite.config.mjs`).

## Commands

Run from `viewer`:

```bash
npm run compat:targets
```

Prints the resolved browser targets from `browserslist`.

```bash
npm run compat:lint
```

Runs ESLint with `eslint.compat.config.mjs` and `eslint-plugin-compat` to detect unsupported browser APIs in source files.

```bash
npm run compat:syntax:debug
```

Checks syntax level of JS files in `build/debug/**` with `es-check` (currently set to `es2018`).

```bash
npm run compat:syntax:release
```

Checks syntax level of JS files in `build/release/**` with `es-check` (currently set to `es2018`).

```bash
npm run compat:check:debug
```

Convenience command: runs webpack debug build, then syntax check.

## Typical workflow

1. `npm run compat:targets` (confirm browser/API floor)
2. `npm run compat:lint` (source API compatibility)
3. `npm run compat:check:debug` (built output syntax compatibility)
4. Optionally run release syntax check:
   - `npm run production`
   - `npm run compat:syntax:release`

## How to read failures

- **`compat:lint` failures** (`compat/compat`) mean code uses browser APIs not supported by your target set.
  - Fix by adding fallback/feature detection/polyfill or changing implementation.

- **`compat:syntax:*` failures** mean emitted bundle syntax is newer than the configured `es-check` target.
  - Check failing file/chunk and transform settings.
  - If a dependency emits newer syntax, consider transpiling/adjusting build config or revisiting required floor.

## Notes

- `compat:lint` is intentionally isolated in `eslint.compat.config.mjs` so normal lint config is not affected.
- `es-check` currently uses `es2018`, matching Vite `build.target`.

## OS mapping for browser targets

The compatibility list is browser-version based. OS mapping differs by platform:

- **iOS:** mapping is mostly direct (all iOS browsers use WebKit/Safari engine).
  - Current floor corresponds roughly to **iOS 11+**.
- **Android:** mapping is not direct (browser/WebView versions are decoupled from Android OS version).
  - Treat Android support as **browser-version support**, not as one exact Android OS minimum.

### Practical interpretation

- iOS support policy can be expressed as: **iOS 11 and newer**.
- Android support policy should be expressed as: **devices that can run the required browser/WebView versions from `compat:targets`**.

If a single Android OS number is needed for release notes, use a conservative policy label and document that actual compatibility is determined by installed browser/WebView version.
