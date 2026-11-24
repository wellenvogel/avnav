# MapLibre sprite lists (#715)

From `viewer`, with its normal npm dependencies installed:

```
npx webpack --config test/webpack.maplibre-sprites.js
python3 -m http.server 8794 --directory build
```

Open `http://127.0.0.1:8794/maplibre-sprites/index.html` in a browser.
All eight JSON results should have `pass: true`.

The fixture exercises the real layer factory, prepare and createOL paths with
string, array, empty and absent sprites, both with and without the chart proxy.
It checks relative/absolute URLs, sprite IDs, glyph placeholders and the
subsequent proxy translation. The list structure follows the report's Open
Waters style, using a fixed local fixture rather than a changing remote chart.
The original code throws `url.startsWith is not a function` in four list cases.
This is layer initialization/URL handling coverage, not a WebGL chart-rendering
or network availability test.
