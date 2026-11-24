# MapLibre proxy regression

From `viewer`, with the normal development dependencies installed:

```sh
npx webpack --config test/webpack.chart-proxy.js
python3 -m http.server --directory build/chart-proxy 8080
```

Open http://localhost:8080 and run `await runChartProxyTests()` in the browser
console. It returns eight case names on success, or throws on failure. The test
uses the real layer factory, XML parser, style loader and URL translator; only
fetch is replaced with a local response. It checks JSON aliases, XML booleans,
defaults, precedence, remote style/tile proxy URLs and same-origin tile URLs.
No chart server or navigation hardware is required.
