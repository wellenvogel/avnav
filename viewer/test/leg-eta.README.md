# Waypoint arrival-time regression

From `viewer`, with the normal viewer dependencies installed:

```sh
npx webpack --config test/webpack.leg-eta.js
python3 -m http.server --directory build/leg-eta 8081 --bind 127.0.0.1
```

Open `http://127.0.0.1:8081` in a browser and run `runLegEtaTests()` in its
console. It returns 12 results on success or throws at the first failed
assertion. The test imports the real viewer modules in their normal order,
without starting the viewer UI or contacting an AvNav server.

Both great-circle and rhumb-line modes are checked with an exactly one-hour
leg: an old replay date, a midnight rollover and the Unix epoch. Additional
controls check missing GPS time, zero speed and motion away from the waypoint.
The test changes the route mode in the store temporarily and restores it.
