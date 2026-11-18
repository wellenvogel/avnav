# AIS visibility regression

Build the real viewer modules with `npx webpack --config test/webpack.ais-filter.js`.
Serve `build/ais-filter` over HTTP, open its index.html in a browser and call
`runRegressionTests()` in the developer console. It returns 29 successful checks
or throws at the first failure. It covers anchored, moored, distressed, class B,
base-station and navigation-aid reports, threshold behaviour and class filters.
The original moving-only filter fails the anchored class A case.

This uses synthetic AIS reports and does not validate an AIS receiver or navigation hardware.
