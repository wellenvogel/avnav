# Map widget canvas coordinates (#717, #718)

From `viewer`, with its normal npm dependencies installed:

```
npx webpack --config test/webpack.map-widget-coordinates.js
python3 -m http.server 8794 --directory build
```

Open `http://127.0.0.1:8794/map-widget-coordinates/index.html` in a browser.
Every JSON result should have `pass: true` (24 checks).

This mounts the real React MapWidget with real OpenLayers maps/vector canvas
renderers and Drawing instances. It checks canvas dimensions, two pixel
round trips, and a known longitude/latitude at pixel ratios 1 and 2, with
zero, approximately -13 degree and 90 degree rotations. No charts, GPS or
external services are required. The original code fails 15 checks: three
canvas-size checks at ratio 2 and twelve coordinate checks when rotated.
